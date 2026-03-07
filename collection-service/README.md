# 称重系统采集服务

独立的 Node.js 应用，负责与网关建立 TCP 连接、读取称重仪表数据（Modbus-RTU 协议）、通过 WebSocket 推送数据给后端。

## 功能

- 根据数据库配置自动建立与所有网关 COM 端口的 TCP 连接
- 定期发送 Modbus-RTU 读命令获取称重数据
- 解析 Modbus 响应并应用校准系数
- 通过 WebSocket 实时推送采集数据给后端
- 监测 TCP 连接状态（在线/离线）
- 自动重连机制（指数退避）

## 安装

```bash
cd collection-service
npm install
# 或
pnpm install
```

## 配置

创建 `.env` 文件：

```env
# 数据库连接字符串
DATABASE_URL=mysql://root:password@localhost:3306/weighing_system

# 后端 WebSocket 服务地址
BACKEND_WS_URL=ws://localhost:3000/api/collection
```

## 运行

开发模式（带自动重启）：

```bash
npm run dev
```

生产模式：

```bash
npm run build
npm start
```

## 架构

### 核心模块

- **modbus.ts** - Modbus-RTU 协议处理（CRC 校验、命令构建、响应解析）
- **database.ts** - 数据库连接和查询
- **tcpConnection.ts** - TCP 连接管理（连接、重连、数据收发）
- **websocketClient.ts** - WebSocket 客户端（与后端通信）
- **index.ts** - 主程序（服务启动、采集流程编排）

### 数据流

```
称重仪表 (Modbus-RTU)
    ↓ (串口)
网关 ZLAN5G12H (TCP Server)
    ↓ (TCP)
采集服务 (TCP Client)
    ↓ (WebSocket)
后端 (Express + tRPC)
    ↓ (WebSocket)
前端 (React)
```

## 采集流程

1. 启动时从数据库读取所有网关 COM 端口配置
2. 为每个 COM 端口建立 TCP 连接
3. 定期（默认 500ms）执行采集循环：
   - 获取该端口上的所有仪表
   - 对每个仪表发送 Modbus 读命令
   - 解析响应，应用校准系数
   - 保存采集数据到数据库
   - 通过 WebSocket 推送给后端
4. 监测连接状态变化，实时更新数据库和推送状态

## Modbus-RTU 协议细节

### 读保持寄存器命令

```
功能码: 0x03
格式: [从机地址] [功能码] [起始地址(2字节)] [数量(2字节)] [CRC(2字节)]
```

### 响应格式

```
格式: [从机地址] [功能码] [字节数] [数据...] [CRC(2字节)]
```

### CRC16 校验

使用 CRC-16-MODBUS 算法（多项式：0xA001）

## 错误处理

- TCP 连接失败：自动重连，指数退避（最多30秒间隔）
- Modbus 响应超时：记录错误，继续下一次采集
- CRC 校验失败：丢弃数据，继续下一次采集
- 数据库错误：记录错误，继续采集其他设备

## 监控和日志

所有操作都有详细的日志输出，格式为：

```
[模块] 日志内容
```

模块标识：
- `[Service]` - 服务启动/停止
- `[TCP]` - TCP 连接相关
- `[WebSocket]` - WebSocket 连接相关
- `[DB]` - 数据库操作
- `[Collection]` - 数据采集
- `[Status]` - 状态更新
