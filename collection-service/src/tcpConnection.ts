/**
 * TCP 连接管理模块
 */

import { Socket } from 'net';
import { EventEmitter } from 'events';

export interface ConnectionConfig {
  id: number;
  ipAddress: string;
  tcpPort: number;
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
        reject(new Error(`连接超时: ${this.config.ipAddress}:${this.config.tcpPort}`));
      }, 5000);

      socket.on('connect', () => {
        clearTimeout(timeout);
        this.socket = socket;
        this.isConnecting = false;
        this.retryCount = 0;
        this.emit('connected');
        console.log(`[TCP] 已连接: ${this.config.ipAddress}:${this.config.tcpPort}`);
        resolve();
      });

      socket.on('error', (err) => {
        clearTimeout(timeout);
        this.isConnecting = false;
        console.error(`[TCP] 连接错误 ${this.config.ipAddress}:${this.config.tcpPort}:`, err.message);
        this.emit('error', err);
        reject(err);
      });

      socket.on('close', () => {
        this.socket = null;
        this.emit('disconnected');
        console.log(`[TCP] 已断开: ${this.config.ipAddress}:${this.config.tcpPort}`);
        this.scheduleReconnect();
      });

      socket.on('data', (data) => {
        this.buffer = Buffer.concat([this.buffer, data]);
        this.emit('data', this.buffer);
      });

      socket.connect(this.config.tcpPort, this.config.ipAddress);
    });
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= this.config.retryCount) {
      console.warn(`[TCP] 达到最大重试次数，停止重连: ${this.config.ipAddress}:${this.config.tcpPort}`);
      return;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);  // 指数退避，最多30秒
    
    console.log(`[TCP] 将在 ${delay}ms 后重新连接: ${this.config.ipAddress}:${this.config.tcpPort}`);

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
   * @param timeout 超时时间（毫秒）
   */
  async readResponse(timeout: number = this.config.timeoutMs): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        this.removeListener('data', dataHandler);
        reject(new Error('读取响应超时'));
      }, timeout);

      const dataHandler = (data: Buffer) => {
        clearTimeout(timer);
        this.removeListener('data', dataHandler);
        // 清空缓冲区
        this.buffer = Buffer.alloc(0);
        resolve(data);
      };

      this.on('data', dataHandler);
    });
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
