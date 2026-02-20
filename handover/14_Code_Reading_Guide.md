# 14 — 代码阅读指南

## 阅读顺序建议

按以下顺序阅读代码，可以最快理解系统全貌：

### 第一轮：数据模型（30 分钟）

1. **`drizzle/schema.ts`** — 所有数据库表定义，理解业务实体和关系
2. **`shared/types.ts`** — 前后端共享的类型定义
3. **`shared/const.ts`** — 共享常量（权限模块列表、仪表型号等）

### 第二轮：后端逻辑（1~2 小时）

4. **`server/_core/index.ts`** — 服务器启动入口，理解中间件注册顺序
5. **`server/_core/context.ts`** — tRPC 上下文构建，理解认证流程
6. **`server/db.ts`** — 数据库查询函数，理解所有数据操作
7. **`server/routers.ts`** — tRPC 路由定义，理解业务逻辑和权限控制

### 第三轮：前端界面（1~2 小时）

8. **`client/src/App.tsx`** — 路由定义和布局结构
9. **`client/src/contexts/AuthContext.tsx`** — 认证状态管理
10. **`client/src/pages/Monitor.tsx`** — 实时监视页面（最复杂的前端组件）
11. **`client/src/pages/LayoutEditor.tsx`** — 布局编辑器（DXF 解析和 SVG 渲染）

## 关键设计决策

### 为什么使用 tRPC 而非 REST

tRPC 提供端到端类型安全。在 `routers.ts` 中定义 procedure 的输入/输出类型后，前端调用时自动获得 TypeScript 类型推断，无需手动维护 API 文档或类型定义文件。

### 为什么通道由系统自动生成

仪表型号决定了物理通道数量（DY7001=1, DY7004=4），这是硬件约束。自动生成避免了用户手动创建通道时可能出现的数量不匹配问题。

### 为什么 currentWeight 初始化为 0

`currentWeight` 是采集服务实时更新的计算值，不应与 `initialWeight`（皮重/空柜重量）混淆。创建柜组时 `currentWeight` 为 0，待采集服务运行后自动更新。

### 为什么布局数据使用 JSON 而非关系表

DXF 解析后的柜列坐标数据结构复杂（包含多边形顶点、旋转角度、嵌套块引用等），使用 JSON 存储比拆分为多张关系表更灵活。布局数据的读写是整体操作，不需要对单个柜列进行 SQL 查询。

### 权限系统设计

采用 RBAC（基于角色的访问控制）：
- **admin** 角色拥有所有权限，无需配置
- **operator** 角色通过 `userPermissions` 表控制每个模块的查看/操作权限
- 前端通过 `useAuth()` 获取用户角色，条件渲染菜单和按钮
- 后端通过 `protectedProcedure` 中间件检查权限

## 代码风格约定

| 约定 | 说明 |
|------|------|
| 文件命名 | 页面组件 PascalCase（`Monitor.tsx`），工具函数 camelCase（`db.ts`） |
| 变量命名 | camelCase，数据库列名也使用 camelCase |
| 组件 | 函数式组件 + Hooks，不使用 class 组件 |
| 状态管理 | React Query（通过 tRPC）管理服务端状态，useState 管理本地 UI 状态 |
| 样式 | Tailwind CSS 工具类，不使用 CSS Modules 或 styled-components |
| 错误处理 | tRPC 抛出 `TRPCError`，前端通过 `onError` 回调处理 |

## 扩展开发指南

### 添加新的数据库表

1. 在 `drizzle/schema.ts` 中定义表结构
2. 执行 `pnpm db:push` 生成并执行迁移
3. 在 `server/db.ts` 中添加查询函数
4. 在 `server/routers.ts` 中添加 tRPC procedure
5. 在前端页面中通过 `trpc.*.useQuery/useMutation` 调用

### 添加新的前端页面

1. 创建 `client/src/pages/NewPage.tsx`
2. 在 `client/src/App.tsx` 中注册路由
3. 在 `DashboardLayout` 的侧边栏配置中添加菜单项
4. 在 `shared/const.ts` 中添加权限模块标识（如需要）

### 添加新的仪表型号

1. 在 `drizzle/schema.ts` 的 `modelType` 枚举中添加新型号
2. 在 `server/db.ts` 的 `createChannelsForInstrument` 函数中添加通道数量映射
3. 在前端仪表创建表单中添加新型号选项
4. 执行 `pnpm db:push` 更新数据库枚举
