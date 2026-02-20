# 05 — 部署方案

## 方案一：单机裸机部署（推荐）

适用于金融内网环境，最简单直接。

### 架构

```
客户端浏览器
    │ HTTP(S)
    ▼
Nginx (80/443)  ← 反向代理 + SSL 终止 + 静态缓存
    │ HTTP
    ▼
Node.js (3000)  ← Express + tRPC + 静态文件
    │ MySQL Protocol
    ▼
MySQL 8.0 (3306)
```

### 步骤

**1. 安装 Nginx**

```bash
sudo apt install -y nginx
sudo cp handover/templates/nginx.example.conf /etc/nginx/sites-available/weighing-system
sudo ln -sf /etc/nginx/sites-available/weighing-system /etc/nginx/sites-enabled/
sudo rm -f /etc/nginx/sites-enabled/default
sudo nginx -t && sudo systemctl reload nginx
```

**2. 配置 systemd 服务**

```bash
sudo cp handover/templates/systemd.service.example /etc/systemd/system/weighing-system.service
# 编辑服务文件，修改路径和用户
sudo systemctl daemon-reload
sudo systemctl enable weighing-system
sudo systemctl start weighing-system
```

**3. 验证**

```bash
sudo systemctl status weighing-system
curl http://localhost:3000/api/trpc/auth.me
```

### 进程管理

systemd 提供自动重启、日志收集、开机自启等能力。关键配置：

```ini
Restart=always           # 崩溃后自动重启
RestartSec=5             # 重启间隔 5 秒
Environment=NODE_ENV=production
```

查看日志：

```bash
sudo journalctl -u weighing-system -f          # 实时日志
sudo journalctl -u weighing-system --since today  # 今日日志
```

## 方案二：Docker 容器化部署

适用于有容器化基础设施的环境。

### Dockerfile（参考）

```dockerfile
FROM node:22-slim AS base
RUN corepack enable && corepack prepare pnpm@10.4.1 --activate
WORKDIR /app

# 安装依赖
FROM base AS deps
COPY package.json pnpm-lock.yaml ./
COPY patches/ ./patches/
RUN pnpm install --frozen-lockfile --prod=false

# 构建
FROM deps AS build
COPY . .
RUN pnpm build

# 运行
FROM node:22-slim AS runtime
WORKDIR /app
COPY --from=build /app/dist ./dist
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/package.json ./
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/drizzle.config.ts ./

ENV NODE_ENV=production
EXPOSE 3000
CMD ["node", "dist/index.js"]
```

### docker-compose.yml（参考）

```yaml
version: '3.8'
services:
  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - DATABASE_URL=mysql://weighing:password@db:3306/weighing_system
      - JWT_SECRET=your-secret-key
      - NODE_ENV=production
    depends_on:
      db:
        condition: service_healthy

  db:
    image: mysql:8.0
    environment:
      MYSQL_ROOT_PASSWORD: rootpassword
      MYSQL_DATABASE: weighing_system
      MYSQL_USER: weighing
      MYSQL_PASSWORD: password
    volumes:
      - mysql_data:/var/lib/mysql
    healthcheck:
      test: ["CMD", "mysqladmin", "ping", "-h", "localhost"]
      interval: 10s
      timeout: 5s
      retries: 5

volumes:
  mysql_data:
```

## SSL/HTTPS 配置

### 自签名证书（内网）

```bash
sudo openssl req -x509 -nodes -days 3650 \
  -newkey rsa:2048 \
  -keyout /etc/ssl/private/weighing.key \
  -out /etc/ssl/certs/weighing.crt \
  -subj "/CN=weighing.internal"
```

在 Nginx 配置中启用 SSL：

```nginx
server {
    listen 443 ssl;
    ssl_certificate /etc/ssl/certs/weighing.crt;
    ssl_certificate_key /etc/ssl/private/weighing.key;
    # ... 其他配置同 HTTP
}
```

## 部署检查清单

| 检查项 | 命令 | 预期结果 |
|--------|------|----------|
| Node.js 版本 | `node --version` | v22.x.x |
| pnpm 版本 | `pnpm --version` | 10.x.x |
| MySQL 连接 | `mysql -u weighing -p -e "SELECT 1"` | 成功 |
| 依赖安装 | `pnpm install` | 无错误 |
| 数据库迁移 | `pnpm db:push` | 无错误 |
| 构建 | `pnpm build` | `dist/` 目录生成 |
| 启动 | `pnpm start` | "Server running on http://localhost:3000/" |
| 页面访问 | `curl http://localhost:3000` | 返回 HTML |
| API 访问 | `curl http://localhost:3000/api/trpc/auth.me` | 返回 JSON |
| 登录测试 | 浏览器访问并登录 | admin/admin123 登录成功 |
