# 02 — 模块地图

## 目录结构总览

```
weighing-system/
├── client/                    # 前端 React SPA
│   ├── index.html             # HTML 入口
│   ├── public/                # 静态资源
│   └── src/
│       ├── App.tsx            # 路由定义 & DashboardLayout 包装
│       ├── main.tsx           # React 入口 & Provider 注册
│       ├── index.css          # 全局样式 & Tailwind 主题变量
│       ├── const.ts           # 前端常量（登录URL等）
│       ├── lib/trpc.ts        # tRPC 客户端绑定
│       ├── pages/             # 页面级组件（每个对应一个路由）
│       ├── components/        # 可复用 UI 组件
│       ├── contexts/          # React Context（Auth等）
│       └── hooks/             # 自定义 Hooks
├── server/                    # 后端 Express + tRPC
│   ├── _core/                 # 框架基础设施（勿修改）
│   │   ├── index.ts           # 服务器入口 & 启动逻辑
│   │   ├── context.ts         # tRPC 上下文构建（JWT解析→ctx.user）
│   │   ├── oauth.ts           # 本地认证路由（POST /api/auth/login）
│   │   ├── trpc.ts            # tRPC 实例 & procedure 定义
│   │   ├── env.ts             # 环境变量集中读取
│   │   ├── cookies.ts         # Cookie 配置
│   │   ├── sdk.ts             # JWT 签发/验证
│   │   ├── vite.ts            # Vite 开发服务器集成
│   │   └── ...                # LLM/通知/地图等内置服务
│   ├── routers.ts             # 主路由文件（所有 tRPC procedure）
│   ├── routers/
│   │   └── layoutEditor.ts    # 布局编辑器路由（独立拆分）
│   ├── db.ts                  # 数据库查询函数（Drizzle 封装）
│   ├── dxfParser.ts           # DXF 文件解析器
│   ├── storage.ts             # S3 文件存储
│   ├── weighing.test.ts       # 称重业务测试
│   ├── permissions.test.ts    # 权限系统测试
│   └── auth.logout.test.ts    # 认证测试
├── drizzle/                   # 数据库 Schema & 迁移
│   ├── schema.ts              # 表定义（Drizzle ORM）
│   ├── relations.ts           # 表关系定义
│   ├── 0000_*.sql ~ 0008_*.sql # 迁移文件
│   └── meta/                  # 迁移元数据
├── shared/                    # 前后端共享代码
│   ├── const.ts               # 共享常量
│   └── types.ts               # 共享类型导出
├── handover/                  # 移交文档（本目录）
├── docs/                      # 开发文档
├── package.json               # 依赖 & 脚本
├── tsconfig.json              # TypeScript 配置
├── vite.config.ts             # Vite 构建配置
├── vitest.config.ts           # 测试配置
├── drizzle.config.ts          # Drizzle 迁移配置
└── todo.md                    # 功能追踪
```

## 前端页面与路由

| 路由路径 | 页面文件 | 功能 | 权限模块 |
|----------|----------|------|----------|
| `/` | `Monitor.tsx` | 实时监视（DXF 布局可视化） | `dashboard` |
| `/gateways` | `Gateways.tsx` | 网关管理（CRUD、COM 端口配置） | `gateway_config` |
| `/devices` | `Devices.tsx` | 仪表管理（CRUD、通道配置） | `instrument_config` |
| `/cabinets` | `Cabinets.tsx` | 柜组管理（CRUD、通道绑定） | `cabinet_group` |
| `/records` | `Records.tsx` | 数据记录查询 | `data_records` |
| `/alarms` | `Alarms.tsx` | 报警管理 | `alarm_management` |
| `/analytics` | `Analytics.tsx` | 数据分析 | `data_analysis` |
| `/users` | `Users.tsx` | 用户管理 | `user_management` |
| `/audit-logs` | `AuditLogs.tsx` | 审计日志 | `audit_logs` |
| `/layout-editor` | `LayoutEditor.tsx` | 布局编辑器 | `layout_editor` |
| `/login` | `Login.tsx` | 登录页 | — |

## 后端路由（tRPC Procedures）

| 路由命名空间 | 文件位置 | 主要 Procedure |
|-------------|----------|----------------|
| `auth` | `routers.ts:55` | `me`, `logout`, `login`, `changePassword` |
| `users` | `routers.ts:87` | `list`, `create`, `update`, `delete`, `getPermissions`, `setPermissions` |
| `gateways` | `routers.ts:226` | `list`, `create`, `update`, `delete` |
| `gatewayComPorts` | `routers.ts:297` | `listByGateway`, `create`, `update`, `delete` |
| `instruments` | `routers.ts:365` | `list`, `create`, `update`, `delete`, `batchDelete` |
| `channels` | `routers.ts:580` | `listByInstrument`, `listAll`, `update` |
| `cabinetGroups` | `routers.ts:641` | `list`, `create`, `update`, `delete`, `batchDelete`, `getBindings`, `updateBindings`, `getBoundInstruments` |
| `weightRecords` | `routers.ts:862` | `list`, `getByGroup` |
| `alarms` | `routers.ts:886` | `list`, `handle` |
| `auditLogs` | `routers.ts:912` | `list` |
| `layoutEditor` | `routers/layoutEditor.ts` | `list`, `getById`, `create`, `update`, `delete`, `activate` |
| `monitor` | `routers.ts:935` | `getActiveLayout`, `getGroupsWithWeight` |

## 数据库查询层

`server/db.ts`（818 行）是所有数据库操作的集中封装层。每个函数对应一个原子操作，被 tRPC procedure 调用。函数命名规范：`get*`（查询）、`create*`（创建）、`update*`（更新）、`delete*`（删除）、`check*`（冲突检查）。

## 关键调用链

### 创建仪表并自动生成通道

```
前端 Devices.tsx → trpc.instruments.create.useMutation()
  → routers.ts instruments.create procedure
    → db.checkDeviceCodeConflict() 检查编码唯一性
    → db.checkSlaveIdConflict() 检查从站地址唯一性
    → db.createInstrument() 插入仪表记录
    → db.createChannelsForInstrument() 按型号自动生成通道
    → db.createAuditLog() 记录审计日志
```

### 柜组绑定通道

```
前端 Cabinets.tsx → trpc.cabinetGroups.updateBindings.useMutation()
  → routers.ts cabinetGroups.updateBindings procedure
    → db.deleteBindingsByGroup() 清除旧绑定
    → db.createBinding() 逐条创建新绑定
    → db.createAuditLog() 记录审计日志
```

### DXF 布局保存

```
前端 LayoutEditor.tsx → trpc.layoutEditor.create/update.useMutation()
  → routers/layoutEditor.ts create/update procedure
    → db.createVaultLayout() / db.updateVaultLayout()
    → layoutData 字段存储 JSON（含柜列坐标、绑定关系、旋转角度）
```
