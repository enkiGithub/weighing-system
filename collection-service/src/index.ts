/**
 * 称重系统采集服务
 * 独立的 Node.js 应用，负责：
 * 1. 与网关建立 TCP 连接
 * 2. 定期读取称重仪表数据（Modbus-RTU）
 * 3. 通过 WebSocket 推送数据给后端
 * 4. 监测连接状态
 */

import dotenv from 'dotenv';
import { TCPConnection } from './tcpConnection.js';
import { WebSocketClient } from './websocketClient.js';
import * as db from './database.js';
import * as modbus from './modbus.js';

dotenv.config();

interface CollectorConfig {
  databaseUrl: string;
  backendWebSocketUrl: string;
}

interface PortCollector {
  connection: TCPConnection;
  collectionTimer: NodeJS.Timeout | null;
  lastStatus: 'online' | 'offline';
}

class WeighingCollectionService {
  private config: CollectorConfig;
  private wsClient: WebSocketClient;
  private portCollectors: Map<number, PortCollector> = new Map();
  private isRunning = false;

  constructor(config: CollectorConfig) {
    this.config = config;
    this.wsClient = new WebSocketClient(config.backendWebSocketUrl);
  }

  async start(): Promise<void> {
    console.log('[Service] 启动采集服务...');

    try {
      // 初始化数据库连接
      await db.initDatabase(this.config.databaseUrl);

      // 连接到后端 WebSocket
      await this.wsClient.connect();
      this.wsClient.on('disconnected', () => {
        console.warn('[Service] 后端连接已断开，将自动重连');
      });

      this.isRunning = true;

      // 加载配置并启动采集
      await this.loadAndStartCollectors();

      // 定期重新加载配置（每30秒）
      setInterval(() => {
        this.loadAndStartCollectors().catch(err => {
          console.error('[Service] 重新加载配置失败:', err);
        });
      }, 30000);

    } catch (err) {
      console.error('[Service] 启动失败:', err);
      process.exit(1);
    }
  }

  private async loadAndStartCollectors(): Promise<void> {
    try {
      const comPorts = await db.getAllComPorts();

      // 停止已删除的端口的采集
      for (const [comPortId, collector] of this.portCollectors.entries()) {
        if (!comPorts.find(p => p.id === comPortId)) {
          console.log(`[Service] 停止采集 COM 端口 #${comPortId}`);
          this.stopCollector(comPortId);
        }
      }

      // 启动新的或更新的端口
      for (const comPort of comPorts) {
        if (!this.portCollectors.has(comPort.id)) {
          console.log(`[Service] 启动采集 COM 端口 #${comPort.id} (${comPort.ipAddress}:${comPort.networkPort})`);
          await this.startCollector(comPort);
        }
      }
    } catch (err) {
      console.error('[Service] 加载配置失败:', err);
    }
  }

  private async startCollector(comPort: db.GatewayComPort): Promise<void> {
    const connection = new TCPConnection({
      id: comPort.id,
      ipAddress: comPort.ipAddress,
      networkPort: comPort.networkPort,
      timeoutMs: comPort.timeoutMs,
      retryCount: comPort.retryCount,
    });

    // 连接事件处理
    connection.on('connected', () => {
      this.updatePortStatus(comPort.id, 'online', undefined);
    });

    connection.on('disconnected', () => {
      this.updatePortStatus(comPort.id, 'offline', 'TCP 连接已断开');
    });

    connection.on('error', (err: Error) => {
      this.updatePortStatus(comPort.id, 'offline', err.message);
    });

    // 尝试连接
    try {
      await connection.connect();
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      this.updatePortStatus(comPort.id, 'offline', errorMsg);
    }

    // 启动采集定时器
    const collectionTimer = setInterval(() => {
      this.collectFromPort(comPort, connection).catch(err => {
        console.error(`[Collection] 采集失败 (COM #${comPort.id}):`, err.message);
      });
    }, comPort.collectionIntervalMs);

    this.portCollectors.set(comPort.id, {
      connection,
      collectionTimer,
      lastStatus: 'offline',
    });
  }

  private stopCollector(comPortId: number): void {
    const collector = this.portCollectors.get(comPortId);
    if (!collector) return;

    if (collector.collectionTimer) {
      clearInterval(collector.collectionTimer);
    }

    collector.connection.disconnect();
    this.portCollectors.delete(comPortId);
  }

  private async collectFromPort(comPort: db.GatewayComPort, connection: TCPConnection): Promise<void> {
    if (!connection.isConnected()) {
      return;  // 连接未建立
    }

    try {
      // 获取该 COM 端口上的所有仪表
      const instruments = await db.getInstrumentsByComPort(comPort.id);

      for (const instrument of instruments) {
        await this.collectFromInstrument(instrument, connection, comPort);
      }
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Collection] 采集失败 (COM #${comPort.id}):`, errorMsg);
      this.updatePortStatus(comPort.id, 'offline', errorMsg);
    }
  }

  /**
   * DY7004/DY7001 仪表寄存器地址映射
   * 每个通道的毛重值占用2个寄存器（32位有符号整数）
   * CH1: 0x07D0 (2000), CH2: 0x07D2 (2002), CH3: 0x07D4 (2004), CH4: 0x07D6 (2006)
   */
  private getChannelRegisterAddress(modelType: string, channelNo: number): number {
    // DY7004/DY7001 毛重寄存器起始地址
    const baseAddress = 0x07D0; // 2000
    return baseAddress + (channelNo - 1) * 2;
  }

  private async collectFromInstrument(
    instrument: db.WeighingInstrument,
    connection: TCPConnection,
    comPort: db.GatewayComPort
  ): Promise<void> {
    try {
      // 获取仪表的所有启用通道
      const channels = await db.getChannelsByInstrument(instrument.id);

      // 优化：一次性读取所有通道数据（DY7004有4个通道，共8个寄存器）
      const channelCount = instrument.modelType === 'DY7004' ? 4 : 1;
      const baseAddress = this.getChannelRegisterAddress(instrument.modelType, 1);
      const totalRegisters = channelCount * 2; // 每通道2个寄存器

      // 先清空接收缓冲区中的背景数据（网关可能有自动推送）
      try {
        await connection.drainBuffer();
      } catch (_) {
        // 忽略清空错误
      }

      // 构建 Modbus RTU 读命令
      const command = modbus.buildReadHoldingRegistersCommand(
        instrument.slaveId,
        baseAddress,
        totalRegisters
      );

      // 发送命令
      await connection.send(command);

      // 等待一小段时间让仪表响应
      await new Promise(resolve => setTimeout(resolve, 100));

      // 读取响应（传入期望的从站地址和字节数，以从混合数据中正确提取响应帧）
      const expectedByteCount = totalRegisters * 2; // 每个寄存器2字节
      const response = await connection.readResponse(comPort.timeoutMs, instrument.slaveId, expectedByteCount);

      // 解析响应
      const registers = modbus.parseReadHoldingRegistersResponse(response);
      if (!registers || registers.length < totalRegisters) {
        throw new Error(`Modbus 响应格式错误: 期望 ${totalRegisters} 个寄存器，实际 ${registers?.length || 0} 个`);
      }

      // 处理每个通道的数据
      for (const channel of channels) {
        const regIndex = (channel.channelNo - 1) * 2;
        if (regIndex + 1 >= registers.length) continue;

        // 两个16位寄存器组合为32位有符号整数
        const rawValue = modbus.registersToInt32(registers[regIndex], registers[regIndex + 1]);

        // 应用校准系数: 实际值(kg) = rawValue * scale + offset
        // DY7004: scale=0.1, offset=0 → rawValue=13 → 1.3kg
        const calibratedValue = parseFloat((rawValue * channel.scale + channel.offset).toFixed(channel.precision));

        // 保存采集数据
        await db.saveCollectionData(instrument.id, channel.id, rawValue, calibratedValue);

        // 更新通道当前值
        await db.updateChannelValue(channel.id, calibratedValue);

        // 通过 WebSocket 推送数据
        if (this.wsClient.isConnected()) {
          await this.wsClient.send({
            type: 'collection_data',
            instrumentId: instrument.id,
            instrumentCode: instrument.deviceCode,
            channelId: channel.id,
            channelNo: channel.channelNo,
            channelLabel: channel.label,
            rawValue,
            calibratedValue,
            unit: channel.unit,
            timestamp: Date.now(),
          });
        }

        console.log(`[Collection] ${instrument.deviceCode} CH${channel.channelNo}: raw=${rawValue} → ${calibratedValue} ${channel.unit}`);
      }

      // 更新仪表状态为在线
      await db.updateInstrumentStatus(instrument.id, 'online');
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      console.error(`[Collection] 采集失败 (仪表 ${instrument.deviceCode}):`, errorMsg);
      
      // 更新仪表状态为离线
      await db.updateInstrumentStatus(instrument.id, 'offline');
    }
  }

  private async updatePortStatus(
    comPortId: number,
    status: 'online' | 'offline',
    failureReason?: string
  ): Promise<void> {
    const collector = this.portCollectors.get(comPortId);
    if (!collector) return;

    if (collector.lastStatus === status) {
      return;  // 状态未变化
    }

    collector.lastStatus = status;

    try {
      await db.updateConnectionStatus(comPortId, status, failureReason);

      // 通过 WebSocket 推送状态
      if (this.wsClient.isConnected()) {
        await this.wsClient.send({
          type: 'connection_status',
          comPortId,
          status,
          timestamp: Date.now(),
        });
      }

      const statusText = status === 'online' ? '在线' : `离线 (${failureReason})`;
      console.log(`[Status] COM 端口 #${comPortId}: ${statusText}`);
    } catch (err) {
      console.error('[Status] 更新状态失败:', err);
    }
  }

  async stop(): Promise<void> {
    console.log('[Service] 停止采集服务...');
    this.isRunning = false;

    // 停止所有采集器
    for (const comPortId of this.portCollectors.keys()) {
      this.stopCollector(comPortId);
    }

    // 断开 WebSocket 连接
    this.wsClient.disconnect();
  }
}

// 启动服务
const config: CollectorConfig = {
  databaseUrl: process.env.DATABASE_URL || 'mysql://root:password@localhost:3306/weighing_system',
  backendWebSocketUrl: process.env.BACKEND_WS_URL || 'ws://localhost:3000/api/collection',
};

const service = new WeighingCollectionService(config);

service.start().catch(err => {
  console.error('[Service] 启动失败:', err);
  process.exit(1);
});

// 优雅关闭
process.on('SIGTERM', () => {
  console.log('[Service] 收到 SIGTERM 信号，正在关闭...');
  service.stop().then(() => {
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('[Service] 收到 SIGINT 信号，正在关闭...');
  service.stop().then(() => {
    process.exit(0);
  });
});
