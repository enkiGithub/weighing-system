/**
 * WebSocket 客户端模块
 * 用于与后端通信，推送采集数据
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';

export interface CollectionDataMessage {
  type: 'collection_data';
  instrumentId: number;
  instrumentCode: string;
  channelId: number;
  channelNo: number;
  channelLabel: string;
  rawValue: number;
  calibratedValue: number;
  unit: string;
  timestamp: number;
}

export interface ConnectionStatusMessage {
  type: 'connection_status';
  comPortId: number;
  status: 'online' | 'offline';
  timestamp: number;
}

export type Message = CollectionDataMessage | ConnectionStatusMessage;

export class WebSocketClient extends EventEmitter {
  private ws: WebSocket | null = null;
  private url: string;
  private isConnecting = false;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private retryCount = 0;

  constructor(url: string) {
    super();
    this.url = url;
  }

  async connect(): Promise<void> {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;  // 已连接
    }

    if (this.isConnecting) {
      return;  // 正在连接
    }

    this.isConnecting = true;

    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.url);

        const timeout = setTimeout(() => {
          if (this.ws) {
            this.ws.close();
          }
          this.isConnecting = false;
          reject(new Error('WebSocket 连接超时'));
        }, 5000);

        this.ws.on('open', () => {
          clearTimeout(timeout);
          this.isConnecting = false;
          this.retryCount = 0;
          this.emit('connected');
          console.log('[WebSocket] 已连接到后端');
          resolve();
        });

        this.ws.on('error', (err: Error) => {
          clearTimeout(timeout);
          this.isConnecting = false;
          console.error('[WebSocket] 连接错误:', err.message);
          this.emit('error', err);
          reject(err);
        });

        this.ws.on('close', () => {
          this.emit('disconnected');
          console.log('[WebSocket] 已断开连接');
          this.scheduleReconnect();
        });

        this.ws.on('message', (data: Buffer) => {
          try {
            const message = JSON.parse(data.toString());
            // 处理服务端下发的指令
            if (message.type === 'reload_config') {
              console.log(`[WebSocket] 收到重载配置指令 (原因: ${message.reason})`);
              this.emit('reload_config', message);
            } else {
              this.emit('message', message);
            }
          } catch (err) {
            console.error('[WebSocket] 消息解析错误:', err);
          }
        });
      } catch (err) {
        this.isConnecting = false;
        reject(err);
      }
    });
  }

  private scheduleReconnect(): void {
    if (this.retryCount >= 10) {
      console.warn('[WebSocket] 达到最大重试次数，停止重连');
      return;
    }

    this.retryCount++;
    const delay = Math.min(1000 * Math.pow(2, this.retryCount - 1), 30000);

    console.log(`[WebSocket] 将在 ${delay}ms 后重新连接`);

    this.reconnectTimer = setTimeout(() => {
      this.connect().catch(err => {
        console.error('[WebSocket] 重连失败:', err.message);
      });
    }, delay);
  }

  send(message: Message): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        reject(new Error('WebSocket 未连接'));
        return;
      }

      this.ws.send(JSON.stringify(message), (err?: Error) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
  }

  isConnected(): boolean {
    return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
  }
}
