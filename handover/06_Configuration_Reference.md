# 06 — 配置参考

## 环境变量一览

所有配置通过 `.env` 文件或系统环境变量注入，**不要在代码中硬编码**。

### 必填变量

| 变量名 | 类型 | 示例 | 说明 |
|--------|------|------|------|
| `DATABASE_URL` | string | `mysql://user:pass@localhost:3306/weighing_system` | MySQL 连接字符串 |
| `JWT_SECRET` | string | `a1b2c3d4e5f6...`（≥32字符） | JWT 签名密钥，用于 session cookie 加密 |

### 可选变量

| 变量名 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `PORT` | number | `3000` | Web 服务监听端口 |
| `NODE_ENV` | string | `development` | 运行环境：`development` 或 `production` |
| `VITE_APP_TITLE` | string | — | 网站标题（显示在浏览器标签页） |
| `VITE_APP_LOGO` | string | — | 网站 Logo URL |
| `VITE_APP_ID` | string | — | 应用 ID（Manus 平台专用，本地部署可留空） |
| `OAUTH_SERVER_URL` | string | — | OAuth 服务器 URL（本地部署不使用） |
| `VITE_OAUTH_PORTAL_URL` | string | — | OAuth 登录页 URL（本地部署不使用） |
| `OWNER_OPEN_ID` | string | — | 系统所有者 ID（本地部署可留空） |
| `OWNER_NAME` | string | — | 系统所有者名称 |
| `BUILT_IN_FORGE_API_URL` | string | — | Manus 内置 API URL（本地部署不使用） |
| `BUILT_IN_FORGE_API_KEY` | string | — | Manus 内置 API 密钥（本地部署不使用） |

### 本地部署最小配置

对于纯内网本地部署，只需要两个必填变量：

```env
DATABASE_URL=mysql://weighing:your_password@localhost:3306/weighing_system
JWT_SECRET=your-random-secret-key-at-least-32-characters-long
```

### VITE_ 前缀变量说明

以 `VITE_` 开头的变量会被 Vite 构建工具注入到前端代码中（`import.meta.env.VITE_*`），因此**不要在 VITE_ 变量中放置敏感信息**。

## 数据库连接字符串格式

```
mysql://用户名:密码@主机:端口/数据库名
```

### 特殊字符转义

如果密码中包含特殊字符（如 `@`, `#`, `%`），需要进行 URL 编码：

| 字符 | 编码 |
|------|------|
| `@` | `%40` |
| `#` | `%23` |
| `%` | `%25` |
| `/` | `%2F` |

示例：密码为 `p@ss#word` → `mysql://user:p%40ss%23word@localhost:3306/db`

### TiDB 连接

TiDB 兼容 MySQL 协议，连接字符串格式相同。如果使用 TiDB Cloud，需要启用 SSL：

```
mysql://user:pass@host:4000/db?ssl={"rejectUnauthorized":true}
```

## JWT 密钥生成

```bash
# 方式一：openssl
openssl rand -hex 32

# 方式二：node
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

## 默认管理员账户

系统启动时会自动检查是否存在管理员账户。如果 `users` 表为空，会自动创建：

| 字段 | 值 |
|------|-----|
| 用户名 | `admin` |
| 密码 | `admin123` |
| 角色 | `admin` |

**首次登录后请立即修改默认密码。**

## 端口配置

服务器启动时会尝试使用 `PORT` 环境变量指定的端口（默认 3000）。如果该端口被占用，会自动尝试 3001~3019，找到第一个可用端口。

```bash
# 指定端口
PORT=8080 pnpm start

# 或在 .env 中设置
PORT=8080
```
