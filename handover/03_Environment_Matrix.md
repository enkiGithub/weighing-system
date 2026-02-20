# 03 — 环境矩阵

## 操作系统要求

| 项目 | 推荐 | 最低要求 | 说明 |
|------|------|----------|------|
| **发行版** | Ubuntu 22.04.5 LTS (Jammy Jellyfish) | Ubuntu 20.04 LTS | 开发环境使用 Ubuntu 22.04.5 LTS |
| **架构** | x86_64 (amd64) | x86_64 | 开发环境为 x86_64 |
| **内核** | 5.15+ | 5.4+ | Ubuntu 22.04 默认内核 5.15 |
| **内存** | 4GB+ | 2GB | Node.js + MySQL 最低需求 |
| **磁盘** | 20GB+ | 10GB | 含数据库存储空间 |

### 其他兼容操作系统

以下操作系统经验证或理论兼容，但未在开发环境中测试：

| 操作系统 | 版本 | 兼容性 |
|----------|------|--------|
| Ubuntu | 24.04 LTS (Noble Numbat) | 兼容（Node.js 22 官方支持） |
| Debian | 12 (Bookworm) | 兼容 |
| CentOS Stream | 9 | 兼容（需使用 NodeSource 仓库安装 Node.js） |
| Rocky Linux | 9 | 兼容 |
| Windows Server | 2019+ | 理论兼容（Node.js 跨平台），但部署脚本需调整 |

## 运行时依赖版本矩阵

| 依赖 | 开发环境版本 | 最低版本 | 安装方式 |
|------|-------------|----------|----------|
| **Node.js** | 22.13.0 | 22.0.0 | [NodeSource](https://github.com/nodesource/distributions) 或 [nvm](https://github.com/nvm-sh/nvm) |
| **pnpm** | 10.4.1 | 10.0.0 | `corepack enable && corepack prepare pnpm@10.4.1 --activate` |
| **MySQL** | 8.0+ | 8.0.0 | `apt install mysql-server` 或 Docker |
| **TiDB** | 7.x（可选替代） | 7.0.0 | TiUP 部署 |

### 为什么必须使用 Node.js 22

项目的 `package.json` 中指定了 `pnpm@10.4.1` 作为 packageManager，而 pnpm 10.x 要求 Node.js 18.12+。项目代码使用了 `import.meta.dirname`（Node.js 21.2+ 引入）等特性，因此实际最低版本为 Node.js 22 LTS。

## 核心 npm 依赖

### 生产依赖（关键）

| 包名 | 版本 | 用途 |
|------|------|------|
| `react` | 19.2.1 | UI 框架 |
| `express` | 4.21.2 | HTTP 服务器 |
| `@trpc/server` | 11.6.0 | 类型安全 RPC 服务端 |
| `@trpc/client` | 11.6.0 | tRPC 客户端 |
| `@trpc/react-query` | 11.6.0 | tRPC React 绑定 |
| `@tanstack/react-query` | 5.90.2 | 数据获取与缓存 |
| `drizzle-orm` | 0.44.5 | 数据库 ORM |
| `mysql2` | 3.15.0 | MySQL 驱动 |
| `jose` | 6.1.0 | JWT 签发/验证 |
| `bcryptjs` | 3.0.3 | 密码哈希 |
| `dxf-parser` | 1.1.2 | DXF 文件解析 |
| `zod` | 4.1.12 | 运行时类型校验 |
| `wouter` | 3.3.5 | 轻量路由 |
| `tailwindcss` | 4.1.14 | CSS 框架 |

### 开发依赖（关键）

| 包名 | 版本 | 用途 |
|------|------|------|
| `typescript` | 5.9.3 | 类型检查 |
| `vite` | 7.1.7 | 前端构建 & 开发服务器 |
| `esbuild` | 0.25.0 | 后端打包 |
| `drizzle-kit` | 0.31.4 | 数据库迁移工具 |
| `vitest` | 2.1.4 | 测试框架 |
| `tsx` | 4.19.1 | TypeScript 直接执行 |

## 端口使用

| 端口 | 服务 | 说明 |
|------|------|------|
| 3000 | Express + Vite | Web 服务（开发/生产），可通过 `PORT` 环境变量修改 |
| 3306 | MySQL | 数据库默认端口 |

## 网络要求

### 内网部署

本系统设计为内网部署，不需要访问外部互联网。所有依赖在 `pnpm install` 时一次性下载，运行时无外部网络依赖。

### 防火墙规则

| 方向 | 端口 | 协议 | 说明 |
|------|------|------|------|
| 入站 | 3000（或自定义） | TCP | Web 服务访问 |
| 入站 | 80/443（可选） | TCP | Nginx 反向代理 |
| 出站 | 网关 IP:端口 | TCP | 连接 RS485 网关（采集服务需要） |
