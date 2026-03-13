/**
 * WebSocket 服务器模块
 * 接收采集服务推送的数据，转发给前端
 */

import { WebSocketServer, WebSocket } from 'ws';
import { Server as HTTPServer } from 'http';

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

export interface ReloadConfigCommand {
  type: 'reload_config';
  reason: string;
  timestamp: number;
}

export type Message = CollectionDataMessage | ConnectionStatusMessage;
export type ServerCommand = ReloadConfigCommand;

export class CollectionWebSocketServer {
  private wss: WebSocketServer;
  private collectorConnection: WebSocket | null = null;
  private clientConnections: Set<WebSocket> = new Set();

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

  private broadcastToClients(message: Message): void {
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
