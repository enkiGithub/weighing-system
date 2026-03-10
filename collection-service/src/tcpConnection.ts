/**
 * TCP 连接管理模块
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';

export interface ConnectionConfig {
  id: number;
  ipAddress: string;
  networkPort: number;
  timeoutMs: number;
  retryCount: number;
}

export class TCPConnection extends EventEmitter {
  private socket: Socket | null = null;
  private config: ConnectionConfig;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;
  private buffer = Buffer.alloc(0);

  constructor(config: ConnectionConfig) {
    super();
    this.config = config;
  }

  async connect(): Promise<void> {
    if (this.socket) {
      return;  // 已连接
    }

    if (this.isConnecting) {
      return;  // 正在连接
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      const socket = new Socket();

      const timeout = setTimeout(() => {
        socket.destroy();
        this.isConnecting = false;
        reject(new Error(`连接超时: ${this.config.ipAddress}:${this.config.networkPort}`));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.isConnecting = false;
        this.retryCount = 0;
        this.emit('connected');
        console.log(`[TCP] 已连接: ${this.config.ipAddress}:${this.config.networkPort}`);
        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        this.isConnecting = false;
        console.error(`[TCP] 连接错误 ${this.config.ipAddress}:${this.config.networkPort}:`, err.message);
        this.emit('error', err);
        reject(err);
      });

      socket.on('close', () => {
        this.socket = null;
        this.emit('disconnected');
        console.log(`[TCP] 已断开: ${this.config.ipAddress}:${this.config.networkPort}`);
        this.scheduleReconnect();
      });

      socket.on('data', (data) => {
        this.buffer = Buffer.concat([this.buffer, data]);
        this.emit('data', this.buffer);
      });

      socket.connect(this.config.networkPort, this.config.ipAddress);
    });
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= this.config.retryCount) {
      console.warn(`[TCP] 达到最大重试次数，停止重连: ${this.config.ipAddress}:${this.config.networkPort}`);
      return;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);  // 指数退避，最多30秒
    
    console.log(`[TCP] 将在 ${delay}ms 后重新连接: ${this.config.ipAddress}:${this.config.networkPort}`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(err => {
        console.error(`[TCP] 重连失败:`, err.message);
      });
    }, delay);
  }

  send(data: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.socket) {
        reject(new Error('未连接'));
        return;
      }

      this.socket.write(data, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * 读取一个完整的 Modbus 响应
   * 会从缓冲区中扫描所有数据，找到匹配的响应帧
   * @param timeout 超时时间（毫秒）
   * @param expectedSlaveId 期望的从站地址（可选）
   * @param expectedByteCount 期望的数据字节数（可选）
   */
  async readResponse(timeout: number = this.config.timeoutMs, expectedSlaveId?: number, expectedByteCount?: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      let checkInterval: NodeJS.Timeout;

      const timer = setTimeout(() => {
        if (checkInterval) clearInterval(checkInterval);
        this.buffer = Buffer.alloc(0);
        reject(new Error('读取响应超时'));
      }, timeout);

      // 定期检查缓冲区中是否有完整的响应帧
      checkInterval = setInterval(() => {
        if (this.buffer.length < 5) return; // 最小响应帧: 从站(1)+功能码(1)+字节数(1)+CRC(2) = 5

        // 扫描缓冲区中的所有可能的帧起始位置
        for (let i = 0; i < this.buffer.length - 4; i++) {
          const slaveId = this.buffer[i];
          const funcCode = this.buffer[i + 1];

          // 只处理功能码 0x03 的响应
          if (funcCode !== 0x03) continue;

          // 如果指定了期望的从站地址，跳过不匹配的
          if (expectedSlaveId !== undefined && slaveId !== expectedSlaveId) continue;

          const byteCount = this.buffer[i + 2];

          // 如果指定了期望字节数，检查是否匹配
          if (expectedByteCount !== undefined && byteCount !== expectedByteCount) continue;

          // 检查数据是否完整
          const frameLength = 3 + byteCount + 2; // 从站+功能码+字节数+数据+CRC
          if (i + frameLength > this.buffer.length) continue;

          // 提取帧数据
          const frame = this.buffer.slice(i, i + frameLength);

          // 清空缓冲区
          this.buffer = Buffer.alloc(0);
          clearTimeout(timer);
          clearInterval(checkInterval);
          resolve(frame);
          return;
        }
      }, 20); // 每20ms检查一次
    });
  }

  /**
   * 清空接收缓冲区中的残留数据
   * 网关可能有自动推送的背景数据，发送命令前需要清空
   */
  async drainBuffer(): Promise<void> {
    this.buffer = Buffer.alloc(0);
    // 等待一小段时间让背景数据到达，然后清空
    await new Promise(resolve => setTimeout(resolve, 50));
    this.buffer = Buffer.alloc(0);
  }

  isConnected(): boolean {
    return this.socket !== null && !this.socket.destroyed;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.socket) {
      this.socket.destroy();
      this.socket = null;
    }
  }

  getConfig(): ConnectionConfig {
    return this.config;
  }
}
