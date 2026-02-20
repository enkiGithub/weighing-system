# 07 — API 文档

## 概述

本系统使用 **tRPC** 作为 API 层，所有接口通过 HTTP POST 请求 `/api/trpc/*` 端点访问。tRPC 提供端到端类型安全，前端通过 `trpc.*` hooks 调用时自动获得参数和返回值的 TypeScript 类型推断。

### 认证机制

所有 API 请求通过 cookie 中的 JWT session token 进行认证。登录成功后，服务器设置 `app_session_id` cookie，后续请求自动携带。

| Procedure 类型 | 说明 |
|---------------|------|
| `publicProcedure` | 无需登录即可访问 |
| `protectedProcedure` | 需要有效的 session token，`ctx.user` 可用 |
| `adminProcedure` | 需要 admin 角色 |

### 错误码

| HTTP 状态码 | tRPC Code | 含义 |
|------------|-----------|------|
| 401 | `UNAUTHORIZED` | 未登录或 session 过期 |
| 403 | `FORBIDDEN` | 权限不足（非管理员或无模块权限） |
| 400 | `BAD_REQUEST` | 参数校验失败 |
| 409 | `CONFLICT` | 数据冲突（如用户名重复、设备编码重复） |
| 500 | `INTERNAL_SERVER_ERROR` | 服务器内部错误 |

---

## 认证 API (`auth`)

### `auth.me` — 获取当前用户

**类型**：Query（publicProcedure）

**返回**：当前登录用户信息，未登录返回 `null`。

```typescript
{ id: number; username: string; name: string | null; role: 'admin' | 'operator' } | null
```

### `auth.login` — 用户登录

**类型**：Mutation（publicProcedure）

**参数**：`{ username: string; password: string }`

**返回**：`{ success: boolean; user: { id, username, name, role } }`

**副作用**：设置 `app_session_id` cookie。

### `auth.logout` — 退出登录

**类型**：Mutation（protectedProcedure）

**副作用**：清除 session cookie。

### `auth.changePassword` — 修改密码

**类型**：Mutation（protectedProcedure）

**参数**：`{ currentPassword: string; newPassword: string }`

---

## 用户管理 API (`users`)

### `users.list` — 用户列表

**类型**：Query（adminProcedure）

**返回**：所有用户列表（不含密码哈希）。

### `users.create` — 创建用户

**类型**：Mutation（adminProcedure）

**参数**：`{ username: string; password: string; name?: string; role: 'admin' | 'operator' }`

### `users.update` — 更新用户

**类型**：Mutation（adminProcedure）

**参数**：`{ id: number; username?: string; name?: string; role?: 'admin' | 'operator'; password?: string }`

### `users.delete` — 删除用户

**类型**：Mutation（adminProcedure）

**参数**：`{ id: number }`

### `users.getPermissions` — 获取用户权限

**类型**：Query（adminProcedure）

**参数**：`{ userId: number }`

### `users.setPermissions` — 设置用户权限

**类型**：Mutation（adminProcedure）

**参数**：`{ userId: number; permissions: Array<{ module: string; canView: 0|1; canOperate: 0|1 }> }`

---

## 网关管理 API (`gateways`)

### `gateways.list` — 网关列表

**类型**：Query（protectedProcedure）

**返回**：所有网关及其 COM 端口列表。

### `gateways.create` — 创建网关

**类型**：Mutation（protectedProcedure）

**参数**：`{ name: string; ipAddress: string; port: number; model?: string; remark?: string; comPorts: Array<{ portNumber: string; baudRate: number; ... }> }`

### `gateways.update` — 更新网关

**类型**：Mutation（protectedProcedure）

### `gateways.delete` — 删除网关

**类型**：Mutation（protectedProcedure）

**参数**：`{ id: number }`

**注意**：会级联删除关联的 COM 端口。

---

## 仪表管理 API (`instruments`)

### `instruments.list` — 仪表列表

**类型**：Query（protectedProcedure）

**返回**：所有仪表及其通道信息。

### `instruments.create` — 创建仪表

**类型**：Mutation（protectedProcedure）

**参数**：`{ deviceCode: string; modelType: 'DY7001' | 'DY7004'; slaveId: number; comPortId: number; name?: string; location?: string; remark?: string }`

**副作用**：根据 `modelType` 自动生成通道（DY7001→CH1，DY7004→CH1~CH4）。

### `instruments.batchDelete` — 批量删除仪表

**类型**：Mutation（protectedProcedure）

**参数**：`{ ids: number[]; force?: boolean }`

**说明**：如果仪表通道被柜组绑定，非 force 模式返回 `{ success: false, needConfirm: true, boundInfo: [...] }`，force 模式强制删除并解除绑定。

---

## 通道管理 API (`channels`)

### `channels.listByInstrument` — 按仪表查询通道

**类型**：Query（protectedProcedure）

**参数**：`{ instrumentId: number }`

### `channels.listAll` — 所有通道

**类型**：Query（protectedProcedure）

### `channels.update` — 更新通道

**类型**：Mutation（protectedProcedure）

**参数**：`{ id: number; label?: string; enabled?: number; scale?: number; offset?: number; unit?: string; precision?: number; remark?: string }`

---

## 柜组管理 API (`cabinetGroups`)

### `cabinetGroups.list` — 柜组列表

**类型**：Query（protectedProcedure）

**返回**：按名称升序排列的所有柜组。

### `cabinetGroups.create` — 创建柜组

**类型**：Mutation（protectedProcedure）

**参数**：`{ name: string; area?: string; initialWeight?: number; alarmThreshold?: number; remark?: string }`

**说明**：`currentWeight` 初始化为 0（不复制 `initialWeight`）。

### `cabinetGroups.updateBindings` — 更新柜组通道绑定

**类型**：Mutation（protectedProcedure）

**参数**：`{ groupId: number; bindings: Array<{ channelId: number; coefficient?: number; offset?: number; sortOrder?: number }> }`

### `cabinetGroups.getBoundInstruments` — 获取柜组绑定的仪表信息

**类型**：Query（protectedProcedure）

**参数**：`{ groupId: number }`

---

## 布局编辑器 API (`layoutEditor`)

### `layoutEditor.list` — 布局列表

**类型**：Query（protectedProcedure）

### `layoutEditor.create` — 创建布局

**类型**：Mutation（protectedProcedure）

**参数**：`{ name: string; description?: string; layoutData: string }`

**说明**：`layoutData` 为 JSON 字符串，包含 DXF 解析后的柜列坐标、绑定关系、旋转角度等。

### `layoutEditor.activate` — 激活布局

**类型**：Mutation（protectedProcedure）

**参数**：`{ id: number }`

**说明**：将指定布局设为活跃状态，其他布局自动取消激活。

---

## 监视 API (`monitor`)

### `monitor.getActiveLayout` — 获取活跃布局

**类型**：Query（protectedProcedure）

### `monitor.getGroupsWithWeight` — 获取柜组重量数据

**类型**：Query（protectedProcedure）

---

## 非 tRPC 端点

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/auth/login` | 本地登录（Express 路由，非 tRPC） |

---

## 外部采集服务写入接口（规划）

未来采集服务需要直接写入数据库（或通过新增的 tRPC procedure）更新以下字段：

| 表 | 字段 | 说明 |
|----|------|------|
| `instrumentChannels` | `currentValue` | 通道当前读数 |
| `instrumentChannels` | `lastReadAt` | 最后读取时间 |
| `weighingInstruments` | `status` | 仪表在线状态 |
| `weighingInstruments` | `lastHeartbeat` | 最后心跳时间 |
| `gateways` | `status` | 网关在线状态 |
| `gateways` | `lastHeartbeat` | 最后心跳时间 |
| `cabinetGroups` | `currentWeight` | 柜组当前重量 |
| `cabinetGroups` | `status` | 柜组状态 |
