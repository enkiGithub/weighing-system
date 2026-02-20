# 称重系统管理平台 — 移交文档包

> 版本：v1.0.0 | 生成日期：2026-02-20 | 适用代码版本：`279cfa52`

---

## 目录

| 序号 | 文件 | 内容 |
|------|------|------|
| — | **本文件 (README.md)** | 总索引、10 分钟快速启动、常见失败排查 |
| 00 | `00_Project_Summary.md` | 产品目标、核心功能、系统边界、运行形态 |
| 01 | `01_Architecture.md` | 组件图、请求链路、实时数据链路、设计决策 |
| 02 | `02_Module_Map.md` | 目录/模块职责、调用关系、代码入口点 |
| 03 | `03_Environment_Matrix.md` | OS、Node.js、DB、依赖版本矩阵 |
| 04 | `04_Installation_and_Run.md` | 本地开发 & 生产部署逐条命令 |
| 05 | `05_Deployment_Options.md` | 单机部署 vs 容器化方案 |
| 06 | `06_Configuration_Reference.md` | 所有配置项逐项说明 |
| 07 | `07_API_Spec.md` | tRPC API 列表、鉴权、错误码 |
| 08 | `08_WebSocket_Spec.md` | WebSocket 现状与规划 |
| 09 | `09_Database_Schema.md` | ER 关系、表字段、索引策略 |
| 10 | `10_Hardware_Integration_Guide.md` | RS485 网关/仪表接入方案与联调路径 |
| 11 | `11_Risk_Register_and_Open_Issues.md` | 风险清单、技术债、已知问题 |
| 12 | `12_Operations_Runbook.md` | 启停、备份、升级、性能关注点 |
| 13 | `13_Troubleshooting.md` | 按症状组织的故障排查手册 |
| 14 | `14_Code_Reading_Guide.md` | 从入口开始的代码阅读路径 |
| 15 | `15_File_by_File_Notes.md` | 逐目录/文件说明 |
| 16 | `16_Testing_and_Smoke_Check.md` | 测试运行、Mock 方式、上线检查清单 |
| — | `templates/.env.example` | 环境变量模板（占位符，无真实密钥） |
| — | `templates/nginx.example.conf` | Nginx 反向代理配置模板 |
| — | `templates/systemd.service.example` | systemd 服务单元模板 |

### 推荐阅读顺序

1. 本文件 → 2. `00_Project_Summary` → 3. `01_Architecture` → 4. `03_Environment_Matrix` → 5. `04_Installation_and_Run` → 6. `06_Configuration_Reference` → 7. `10_Hardware_Integration_Guide`

---

## 10 分钟快速启动（Quick Start）

### 前置条件

| 依赖 | 版本要求 | 说明 |
|------|----------|------|
| **操作系统** | Ubuntu 22.04 LTS (Jammy Jellyfish) x86_64 | 推荐；也支持 Ubuntu 24.04 LTS、Debian 12、CentOS Stream 9 |
| **Node.js** | v22.13.0+（LTS） | 必须使用 v22 系列 |
| **pnpm** | 10.4.1+ | 包管理器，通过 `corepack enable && corepack prepare pnpm@10.4.1 --activate` 安装 |
| **MySQL** | 8.0+ 或 TiDB 7.x | 需创建数据库并提供连接字符串 |

### 快速步骤

```bash
# 1. 克隆代码
git clone <your-repo-url> weighing-system && cd weighing-system

# 2. 安装依赖
corepack enable && corepack prepare pnpm@10.4.1 --activate
pnpm install

# 3. 配置环境变量
cp handover/templates/.env.example .env
# 编辑 .env，至少填写 DATABASE_URL 和 JWT_SECRET

# 4. 初始化数据库
pnpm db:push

# 5. 开发模式启动
pnpm dev
# 浏览器打开 http://localhost:3000
# 默认管理员：admin / admin123

# 6. 生产构建与启动
pnpm build
pnpm start
```

---

## 常见失败点与最短排查路径

### 1. `pnpm install` 失败

**可能原因**：Node.js 版本不匹配（需要 v22+）或网络问题。

**排查**：`node --version` 确认版本；使用 `pnpm install --registry=https://registry.npmmirror.com` 切换国内镜像。

### 2. `pnpm db:push` 报 `DATABASE_URL is required`

**可能原因**：`.env` 文件不存在或 `DATABASE_URL` 未填写。

**排查**：确认 `.env` 文件在项目根目录且 `DATABASE_URL` 格式正确：`mysql://user:password@host:3306/dbname`。

### 3. 启动后页面白屏

**可能原因**：前端构建产物缺失或端口被占用。

**排查**：检查 `dist/public/index.html` 是否存在；检查 3000 端口是否被占用 `lsof -i :3000`。

### 4. 登录失败 "用户名或密码错误"

**可能原因**：数据库未初始化或默认管理员未创建。

**排查**：确认 `pnpm db:push` 已执行成功；系统启动时会自动创建默认管理员 `admin/admin123`。

### 5. 布局编辑器 DXF 导入后保存失败

**可能原因**：`layoutData` 字段类型不是 `mediumtext`（旧版为 `text`，仅支持 64KB）。

**排查**：确认已执行最新的 `pnpm db:push`，该命令会将字段升级为 `mediumtext`（支持 16MB）。

---

## 术语表

| 术语 | 含义 |
|------|------|
| **网关 (Gateway)** | RS485 串口服务器（如 ZLAN6808），负责字节透明转发 |
| **COM 端口 (ComPort)** | 网关上的物理串口，每个端口独立配置波特率等参数 |
| **仪表 (Instrument)** | 称重仪表（如 DY7001/DY7004），通过 Modbus RTU 通信 |
| **通道 (Channel)** | 仪表的称重端子，DY7001 有 1 个通道，DY7004 有 4 个通道 |
| **柜组 (Cabinet Group)** | 保险柜组，由多个通道绑定计算总重量 |
| **布局 (Layout)** | DXF 导入的保管库平面图，用于可视化柜列位置 |
| **SlaveId** | Modbus RTU 从站地址（1~247），同一 COM 端口下必须唯一 |
| **tRPC** | 类型安全的 RPC 框架，前后端共享类型定义 |
| **Drizzle ORM** | TypeScript-first 的数据库 ORM，用于 schema 定义和查询 |
