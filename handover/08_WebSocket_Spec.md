# 08 — WebSocket 规范

## 当前状态

**WebSocket 尚未实现。** 当前系统的实时监视页面通过 tRPC Query（HTTP 轮询）获取数据，没有 WebSocket 长连接。

## 规划方案

### 为什么需要 WebSocket

RS485 采集服务以 100ms~1s 的频率读取仪表数据，如果前端通过 HTTP 轮询获取，会产生大量无效请求且延迟较高。WebSocket 可以实现服务端主动推送，前端实时刷新。

### 推荐技术选型

| 方案 | 优点 | 缺点 |
|------|------|------|
| **ws** (npm) | 轻量、原生 WebSocket、与 Express 共享 HTTP server | 需要手动管理房间/广播 |
| **Socket.IO** | 自动重连、房间管理、fallback 到 polling | 包体较大、协议非标准 |
| **tRPC Subscriptions** | 与现有 tRPC 架构一致、类型安全 | 需要 WebSocket adapter |

**推荐**：使用 `ws` 库，因为推送场景简单（单向广播），不需要 Socket.IO 的复杂功能。

### 实现路径

**1. 服务端**

在 `server/_core/index.ts` 中创建 WebSocket 服务器，与 Express HTTP server 共享端口：

```typescript
import { WebSocketServer } from 'ws';

const wss = new WebSocketServer({ server, path: '/ws' });

// 广播函数
function broadcast(data: object) {
  const message = JSON.stringify(data);
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN) {
      client.send(message);
    }
  });
}

// 采集服务写入数据后调用
export function pushWeightUpdate(groupId: number, weight: number, status: string) {
  broadcast({
    type: 'weight_update',
    payload: { groupId, weight, status, timestamp: Date.now() }
  });
}
```

**2. 前端**

在 Monitor.tsx 中建立 WebSocket 连接：

```typescript
useEffect(() => {
  const ws = new WebSocket(`ws://${window.location.host}/ws`);
  ws.onmessage = (event) => {
    const data = JSON.parse(event.data);
    if (data.type === 'weight_update') {
      // 更新对应柜组的重量显示
      updateGroupWeight(data.payload);
    }
  };
  ws.onclose = () => {
    // 自动重连逻辑
    setTimeout(() => reconnect(), 3000);
  };
  return () => ws.close();
}, []);
```

### 消息格式（规划）

**服务端 → 客户端**

```json
{
  "type": "weight_update",
  "payload": {
    "groupId": 1,
    "weight": 15230.5,
    "status": "normal",
    "channels": [
      { "channelId": 1, "value": 7615.25 },
      { "channelId": 2, "value": 7615.25 }
    ],
    "timestamp": 1708416000000
  }
}
```

```json
{
  "type": "alarm",
  "payload": {
    "groupId": 1,
    "alarmType": "threshold_exceeded",
    "message": "内圈1柜组重量变化超过阈值",
    "changeValue": 12.5,
    "threshold": 5.0,
    "timestamp": 1708416000000
  }
}
```

```json
{
  "type": "device_status",
  "payload": {
    "instrumentId": 1,
    "status": "offline",
    "timestamp": 1708416000000
  }
}
```

### Nginx WebSocket 代理配置

```nginx
location /ws {
    proxy_pass http://localhost:3000;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 86400;
}
```
