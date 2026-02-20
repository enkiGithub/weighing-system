# 04 — 安装与运行

## 一、安装 Node.js 22

### 方式 A：NodeSource 仓库（推荐）

```bash
# Ubuntu 22.04
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs
node --version   # 应输出 v22.x.x
```

### 方式 B：nvm

```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
source ~/.bashrc
nvm install 22
nvm use 22
```

## 二、安装 pnpm

```bash
corepack enable
corepack prepare pnpm@10.4.1 --activate
pnpm --version   # 应输出 10.4.1
```

## 三、安装 MySQL 8.0

### 方式 A：apt 安装

```bash
sudo apt update
sudo apt install -y mysql-server
sudo systemctl start mysql
sudo systemctl enable mysql

# 安全初始化
sudo mysql_secure_installation

# 创建数据库和用户
sudo mysql -e "
  CREATE DATABASE IF NOT EXISTS weighing_system CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
  CREATE USER IF NOT EXISTS 'weighing'@'localhost' IDENTIFIED BY 'your_strong_password';
  GRANT ALL PRIVILEGES ON weighing_system.* TO 'weighing'@'localhost';
  FLUSH PRIVILEGES;
"
```

### 方式 B：Docker

```bash
docker run -d \
  --name weighing-mysql \
  -p 3306:3306 \
  -e MYSQL_ROOT_PASSWORD=rootpassword \
  -e MYSQL_DATABASE=weighing_system \
  -e MYSQL_USER=weighing \
  -e MYSQL_PASSWORD=your_strong_password \
  -v mysql_data:/var/lib/mysql \
  mysql:8.0
```

## 四、获取代码

```bash
# 从 Git 仓库克隆（或从移交压缩包解压）
git clone <your-repo-url> weighing-system
cd weighing-system
```

## 五、安装项目依赖

```bash
pnpm install
```

如果网络较慢，可使用国内镜像：

```bash
pnpm install --registry=https://registry.npmmirror.com
```

## 六、配置环境变量

```bash
cp handover/templates/.env.example .env
```

编辑 `.env` 文件，**必须填写**以下变量：

| 变量 | 示例值 | 说明 |
|------|--------|------|
| `DATABASE_URL` | `mysql://weighing:password@localhost:3306/weighing_system` | MySQL 连接字符串 |
| `JWT_SECRET` | `your-random-secret-key-at-least-32-chars` | JWT 签名密钥（至少 32 字符） |

其他变量为可选，详见 `06_Configuration_Reference.md`。

## 七、初始化数据库

```bash
pnpm db:push
```

该命令执行两步操作：`drizzle-kit generate`（生成迁移 SQL）→ `drizzle-kit migrate`（执行迁移）。首次运行会创建所有表结构。

验证表是否创建成功：

```bash
mysql -u weighing -p weighing_system -e "SHOW TABLES;"
```

应看到 12 张表：`users`, `gateways`, `gatewayComPorts`, `weighingInstruments`, `instrumentChannels`, `cabinetGroups`, `groupChannelBindings`, `weightChangeRecords`, `alarmRecords`, `vaultLayouts`, `auditLogs`, `userPermissions`。

## 八、开发模式运行

```bash
pnpm dev
```

启动后访问 `http://localhost:3000`，使用默认管理员账户 `admin` / `admin123` 登录。

开发模式特点：Vite HMR 热更新、TypeScript 实时编译、详细错误日志。

## 九、生产构建与运行

```bash
# 构建
pnpm build

# 启动
pnpm start
# 或指定端口
PORT=8080 pnpm start
```

构建产物：

| 文件 | 说明 |
|------|------|
| `dist/index.js` | 后端 bundle（esbuild 打包） |
| `dist/public/` | 前端静态文件（Vite 构建） |
| `dist/public/index.html` | SPA 入口 |
| `dist/public/assets/` | JS/CSS 资源（含 hash） |

## 十、运行测试

```bash
pnpm test
```

当前共 42 项测试（3 个测试文件），覆盖认证、权限、称重业务逻辑。测试使用真实数据库连接，测试数据在 `afterAll` 中自动清理。

## 十一、常用脚本

| 命令 | 说明 |
|------|------|
| `pnpm dev` | 开发模式启动 |
| `pnpm build` | 生产构建 |
| `pnpm start` | 生产模式启动 |
| `pnpm test` | 运行测试 |
| `pnpm check` | TypeScript 类型检查 |
| `pnpm format` | Prettier 格式化 |
| `pnpm db:push` | 数据库迁移 |
