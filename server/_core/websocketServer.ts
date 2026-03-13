/**
 * WebSocket 服务器模块
 * 接收采集服务推送的数据，转发给前端
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';
import * as db from '../db';

export interface CollectionDataMessage {
  type: 'collection_data';
  instrumentId: number;
  channelId: number;
  rawValue: number;
  calibratedValue: number;
  timestamp: number;
}

export interface ConnectionStatusMessage {
  type: 'connection_status';
  comPortId: number;
  status: 'online' | 'offline';
  timestamp: number;
}

export interface GroupWeightUpdateMessage {
  type: 'group_weight_update';
  groupId: number;
  currentWeight: number;
  status: 'normal' | 'warning' | 'alarm';
  timestamp: number;
}

export interface ReloadConfigCommand {
  type: 'reload_config';
  reason: string;
  timestamp: number;
}

export type Message = CollectionDataMessage | ConnectionStatusMessage;
export type ClientMessage = Message | GroupWeightUpdateMessage;
export type ServerCommand = ReloadConfigCommand;

export class CollectionWebSocketServer {
  private wss: WebSocketServer;
  private collectorConnection: WebSocket | null = null;
  private clientConnections: Set<WebSocket> = new Set();
  private _lastPersistError: number = 0;
  // 缓存通道到柜组的绑定关系，避免每次都查数据库
  private _bindingsCache: Map<number, { groupId: number; coefficient: number; offset: number }[]> | null = null;
  private _bindingsCacheTime: number = 0;
  private _groupWeightUpdateQueue: Map<number, NodeJS.Timeout> = new Map();
  // 内存中缓存每个通道的最新值，用于计算柜组重量
  private _channelValues: Map<number, number> = new Map();
  // 记录每个柜组上一次记录的重量，用于判断是否需要写入变化记录
  private _lastRecordedWeight: Map<number, number> = new Map();
  // 记录每个柜组上一次写入记录的时间，避免过于频繁写入
  private _lastRecordTime: Map<number, number> = new Map();

  constructor(httpServer: HTTPServer) {
    this.wss = new WebSocketServer({ 
      server: httpServer,
      path: '/api/collection',
    });

    this.wss.on('connection', (ws: WebSocket, req: any) => {
      const clientIp = req.socket.remoteAddress;
      const url = req.url || '';
      console.log(`[WS] 新连接: ${clientIp} (URL: ${url})`);

      // 通过 URL 参数区分采集服务和前端客户端
      // 采集服务连接时会带上 ?role=collector 参数
      if (url.includes('role=collector')) {
        this.handleCollectorConnection(ws, clientIp);
      } else {
        this.handleClientConnection(ws, clientIp);
      }
    });

    console.log('[WS] WebSocket 服务器已启动 (路径: /api/collection)');
  }

  private handleCollectorConnection(ws: WebSocket, clientIp: string | undefined): void {
    console.log(`[WS] 采集服务已连接: ${clientIp}`);

    // 断开之前的采集服务连接
    if (this.collectorConnection) {
      this.collectorConnection.close();
    }

    this.collectorConnection = ws;

    ws.on('message', (data: any) => {
      try {
        const message = JSON.parse(data.toString()) as Message;
        this.broadcastToClients(message);
        // 持久化采集数据到数据库
        if (message.type === 'collection_data') {
          this.persistCollectionData(message).catch(err => {
            // 仅在非重复错误时打印日志，避免刷屏
            if (!this._lastPersistError || Date.now() - this._lastPersistError > 30000) {
              console.error('[WS] 持久化采集数据失败:', err.message);
              this._lastPersistError = Date.now();
            }
          });
        }
      } catch (err) {
        console.error('[WS] 消息解析失败:', err);
      }
    });

    ws.on('error', (err: Error) => {
      console.error('[WS] 采集服务错误:', err.message);
    });

    ws.on('close', () => {
      console.log('[WS] 采集服务已断开');
      if (this.collectorConnection === ws) {
        this.collectorConnection = null;
      }
    });
  }

  private handleClientConnection(ws: WebSocket, clientIp: string | undefined): void {
    console.log(`[WS] 前端客户端已连接: ${clientIp}`);
    this.clientConnections.add(ws);

    ws.on('error', (err: Error) => {
      console.error('[WS] 客户端错误:', err.message);
    });

    ws.on('close', () => {
      console.log(`[WS] 前端客户端已断开: ${clientIp}`);
      this.clientConnections.delete(ws);
    });
  }

  private broadcastToClients(message: Message | GroupWeightUpdateMessage): void {
    const data = JSON.stringify(message);
    let successCount = 0;
    let errorCount = 0;

    this.clientConnections.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data, (err?: Error) => {
          if (err) {
            errorCount++;
          } else {
            successCount++;
          }
        });
      }
    });

    if (errorCount > 0) {
      console.warn(`[WS] 广播消息: ${successCount} 成功, ${errorCount} 失败`);
    }
  }

  getCollectorConnected(): boolean {
    return this.collectorConnection !== null && this.collectorConnection.readyState === WebSocket.OPEN;
  }

  getClientCount(): number {
    return this.clientConnections.size;
  }

  /**
   * 向采集服务发送重载配置指令
   * @param reason 触发原因（如 "网关配置变更"、"手动触发" 等）
   * @returns 是否成功发送
   */
  sendReloadConfig(reason: string): boolean {
    if (!this.collectorConnection || this.collectorConnection.readyState !== WebSocket.OPEN) {
      console.warn('[WS] 无法发送重载指令：采集服务未连接');
      return false;
    }

    const command: ReloadConfigCommand = {
      type: 'reload_config',
      reason,
      timestamp: Date.now(),
    };

    try {
      this.collectorConnection.send(JSON.stringify(command));
      console.log(`[WS] 已向采集服务发送重载配置指令 (原因: ${reason})`);
      return true;
    } catch (err) {
      console.error('[WS] 发送重载指令失败:', err);
      return false;
    }
  }

  /**
   * 持久化采集数据：更新通道currentValue，并重新计算关联柜组的currentWeight
   */
  private async persistCollectionData(msg: CollectionDataMessage): Promise<void> {
    const { channelId, calibratedValue } = msg;

    // 1. 更新通道的 currentValue 和 lastReadAt
    await db.updateChannel(channelId, {
      currentValue: calibratedValue,
      lastReadAt: new Date(),
    });

    // 2. 缓存通道值到内存
    this._channelValues.set(channelId, calibratedValue);

    // 3. 查找该通道绑定的柜组（使用缓存，每60秒刷新）
    const bindings = await this.getBindingsForChannel(channelId);
    if (bindings.length === 0) return;

    // 4. 对每个关联的柜组，延迟批量更新重量（防止同一柜组多通道同时更新导致频繁写库）
    for (const binding of bindings) {
      this.scheduleGroupWeightUpdate(binding.groupId);
    }
  }

  /**
   * 获取通道的绑定关系（带缓存）
   */
  private async getBindingsForChannel(channelId: number): Promise<{ groupId: number; coefficient: number; offset: number }[]> {
    // 缓存60秒
    if (!this._bindingsCache || Date.now() - this._bindingsCacheTime > 60000) {
      const allBindings = await db.getAllBindings();
      this._bindingsCache = new Map();
      for (const b of allBindings) {
        const list = this._bindingsCache.get(b.channelId) || [];
        list.push({ groupId: b.groupId, coefficient: b.coefficient, offset: b.offset });
        this._bindingsCache.set(b.channelId, list);
      }
      this._bindingsCacheTime = Date.now();
    }
    return this._bindingsCache.get(channelId) || [];
  }

  /**
   * 延迟批量更新柜组重量（500ms内合并同一柜组的多次更新）
   */
  private scheduleGroupWeightUpdate(groupId: number): void {
    // 如果已有pending的更新，跳过（等待已有的定时器触发）
    if (this._groupWeightUpdateQueue.has(groupId)) return;

    const timer = setTimeout(async () => {
      this._groupWeightUpdateQueue.delete(groupId);
      try {
        await this.recalculateGroupWeight(groupId);
      } catch (err: any) {
        if (!this._lastPersistError || Date.now() - this._lastPersistError > 30000) {
          console.error(`[WS] 更新柜组${groupId}重量失败:`, err.message);
          this._lastPersistError = Date.now();
        }
      }
    }, 500);

    this._groupWeightUpdateQueue.set(groupId, timer);
  }

  /**
   * 重新计算柜组重量：weight = sum(channelValue_i * coefficient_i + offset_i)
   * 计算完成后广播 group_weight_update 消息给前端客户端
   */
  private async recalculateGroupWeight(groupId: number): Promise<void> {
    // 获取柜组的所有通道绑定
    const bindings = await db.getBindingsByGroup(groupId);
    if (bindings.length === 0) return;

    // 获取柜组信息
    const group = await db.getCabinetGroupById(groupId);
    if (!group) return;

    // 计算总重量
    let totalWeight = 0;
    for (const binding of bindings) {
      // 优先从内存缓存获取，否则查数据库
      let channelValue = this._channelValues.get(binding.channelId);
      if (channelValue === undefined) {
        const channel = await db.getChannelById(binding.channelId);
        channelValue = channel?.currentValue || 0;
        this._channelValues.set(binding.channelId, channelValue);
      }
      totalWeight += channelValue * binding.coefficient + binding.offset;
    }

    // 计算状态
    const changeValue = totalWeight - group.initialWeight;
    const isAlarm = Math.abs(changeValue) > group.alarmThreshold;
    const isWarning = Math.abs(changeValue) > group.alarmThreshold * 0.7;
    const status = isAlarm ? 'alarm' : isWarning ? 'warning' : 'normal';

    // 上一次记录的重量（用于判断是否有变化）
    const previousWeight = group.currentWeight;

    // 更新柜组重量和状态到数据库
    await db.updateCabinetGroupWeight(groupId, totalWeight, status);

    // 写入重量变化记录（条件：重量变化超过0.001，且距上次记录至少5秒）
    const weightDiff = Math.abs(totalWeight - previousWeight);
    const lastRecordTime = this._lastRecordTime.get(groupId) || 0;
    const now = Date.now();
    if (weightDiff > 0.001 && (now - lastRecordTime > 5000)) {
      this._lastRecordTime.set(groupId, now);
      this._lastRecordedWeight.set(groupId, totalWeight);
      try {
        const recordChangeValue = totalWeight - previousWeight;
        await db.createWeightChangeRecord({
          cabinetGroupId: groupId,
          previousWeight,
          currentWeight: totalWeight,
          changeValue: recordChangeValue,
          isAlarm: isAlarm ? 1 : 0,
        });

        // 如果触发报警，同时写入报警记录
        if (isAlarm) {
          await db.createAlarmRecord({
            alarmType: 'overweight',
            cabinetGroupId: groupId,
            rawValue: totalWeight,
            calibratedValue: totalWeight,
            threshold: group.alarmThreshold,
            exceedValue: Math.abs(changeValue) - group.alarmThreshold,
          });
        }
      } catch (err: any) {
        if (!this._lastPersistError || now - this._lastPersistError > 30000) {
          console.error(`[WS] 写入柜组${groupId}变化记录失败:`, err.message);
          this._lastPersistError = now;
        }
      }
    }

    // 广播柜组重量更新消息给前端客户端（即时推送）
    const updateMsg: GroupWeightUpdateMessage = {
      type: 'group_weight_update',
      groupId,
      currentWeight: totalWeight,
      status,
      timestamp: Date.now(),
    };
    this.broadcastToClients(updateMsg);
  }

  /**
   * 清除绑定缓存（配置变更时调用）
   */
  clearBindingsCache(): void {
    this._bindingsCache = null;
    this._bindingsCacheTime = 0;
    this._channelValues.clear();
    console.log('[WS] 绑定缓存已清除');
  }

  close(): void {
    this.wss.close();
    if (this.collectorConnection) {
      this.collectorConnection.close();
    }
    this.clientConnections.forEach((client) => {
      client.close();
    });
  }
}
