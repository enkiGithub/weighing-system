# 01 — 架构与数据流

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     浏览器 (React SPA)                       │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌───────────────┐  │
│  │ 实时监视  │ │ 设备管理  │ │ 柜组管理  │ │ 布局编辑器     │  │
│  └────┬─────┘ └────┬─────┘ └────┬─────┘ └──────┬────────┘  │
│       │            │            │               │           │
│       └────────────┴────────────┴───────────────┘           │
│                         │ tRPC (HTTP)                       │
└─────────────────────────┼───────────────────────────────────┘
                          │
┌─────────────────────────┼───────────────────────────────────┐
│                  Express Server (Node.js)                    │
│  ┌──────────┐ ┌────────┴────────┐ ┌──────────────────────┐ │
│  │ 本地认证  │ │  tRPC Router     │ │  静态文件服务         │ │
│  │ /api/auth │ │  /api/trpc/*     │ │  dist/public/*       │ │
│  └──────────┘ └────────┬────────┘ └──────────────────────┘ │
│                        │                                    │
│              ┌─────────┴─────────┐                         │
│              │   Drizzle ORM      │                         │
│              └─────────┬─────────┘                         │
└────────────────────────┼────────────────────────────────────┘
                         │ MySQL Protocol
┌────────────────────────┼────────────────────────────────────┐
│              MySQL 8.0+ / TiDB 7.x                          │
│  users, gateways, gatewayComPorts, weighingInstruments,     │
│  instrumentChannels, cabinetGroups, groupChannelBindings,   │
│  weightChangeRecords, alarmRecords, vaultLayouts,           │
│  auditLogs, userPermissions                                 │
└─────────────────────────────────────────────────────────────┘
```

## 请求链路

### 1. 页面加载

浏览器请求 `GET /` → Express 返回 `dist/public/index.html` → React SPA 初始化 → 调用 `trpc.auth.me.useQuery()` 检查登录状态 → 未登录则跳转 `/login`。

### 2. API 调用

React 组件通过 `trpc.*.useQuery()` 或 `trpc.*.useMutation()` 发起请求 → HTTP POST 到 `/api/trpc/*` → Express 中间件解析 cookie 中的 JWT → `createContext()` 注入 `ctx.user` → tRPC Router 执行对应 procedure → Drizzle ORM 查询数据库 → 返回 JSON 响应 → React Query 缓存并更新 UI。

### 3. 认证流程

```
用户输入用户名+密码 → POST /api/auth/login
  → 查询 users 表获取 passwordHash
  → bcrypt.compare() 验证密码
  → jose.SignJWT 签发 session token
  → Set-Cookie: app_session_id=<jwt>
  → 后续请求自动携带 cookie
  → createContext() 解析 JWT 获取 userId
  → 查询 users 表获取完整用户信息
  → 注入 ctx.user
```

### 4. 数据采集链路（规划中）

```
RS485 仪表 ←Modbus RTU→ 网关 COM 端口 ←TCP→ 采集服务
  → 解析 Modbus 响应帧
  → 应用校准系数: value = rawValue * scale + offset
  → UPDATE instrumentChannels SET currentValue = ?
  → 聚合计算柜组重量: SUM(channelValue * coefficient) + offset
  → UPDATE cabinetGroups SET currentWeight = ?
  → 比较阈值，生成报警记录
  → WebSocket 推送到前端
```

## 设计决策

### 为什么选择 tRPC 而非 REST

tRPC 提供端到端类型安全，前端调用后端 procedure 时自动获得参数和返回值的 TypeScript 类型推断，无需手写 API 文档或生成 SDK。对于内部管理系统，这大幅减少了前后端联调成本。

### 为什么使用本地认证而非 OAuth

本系统部署在金融机构内网，不需要第三方登录。本地用户名+密码认证更简单、更安全（不依赖外部服务），且便于管理员直接管理用户账户。

### 为什么 DXF 数据存储在数据库而非文件系统

DXF 解析后的 JSON 数据（柜列坐标、绑定关系等）存储在 `vaultLayouts.layoutData` 字段（mediumtext，最大 16MB）。这样做的好处是：布局数据与绑定关系在同一事务中保存，部署时无需额外的文件存储服务，备份恢复更简单。

### 为什么采集服务独立于 Web 服务

采集服务需要长连接维护、精确的轮询调度、错误重试等能力，与 Web 请求-响应模型差异较大。独立进程便于单独重启、扩展和监控，不影响 Web 服务的稳定性。
