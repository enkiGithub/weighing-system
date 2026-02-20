# 13 — 故障排查手册

## 常见问题速查

### 1. 服务启动失败

**症状**：`pnpm start` 或 `systemctl start weighing-system` 失败

**排查步骤**：

```bash
# 查看错误日志
sudo journalctl -u weighing-system -n 50

# 手动启动查看错误
cd /opt/weighing-system && node dist/index.js
```

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `Error: Cannot find module 'dist/index.js'` | 未构建 | 执行 `pnpm build` |
| `EADDRINUSE: address already in use :::3000` | 端口被占用 | `lsof -i :3000` 找到并终止进程，或修改 PORT |
| `Access denied for user` | 数据库凭证错误 | 检查 `.env` 中的 `DATABASE_URL` |
| `ECONNREFUSED 127.0.0.1:3306` | MySQL 未启动 | `sudo systemctl start mysql` |
| `ER_BAD_DB_ERROR` | 数据库不存在 | 创建数据库：`CREATE DATABASE weighing_system` |

### 2. 登录失败

**症状**：输入用户名密码后提示错误

| 情况 | 原因 | 解决方案 |
|------|------|----------|
| "用户名或密码错误" | 密码不正确 | 检查是否使用了默认密码 admin/admin123 |
| 页面空白 | 前端构建失败 | 检查 `dist/public/index.html` 是否存在 |
| 网络错误 | API 不可达 | 检查 Nginx 代理配置 |

**重置管理员密码**：

```bash
# 使用 bcrypt 生成新密码哈希
node -e "const bcrypt = require('bcryptjs'); bcrypt.hash('newpassword', 10).then(h => console.log(h))"

# 更新数据库
mysql -u weighing -p weighing_system -e "UPDATE users SET passwordHash='<上面的哈希值>' WHERE username='admin'"
```

### 3. 数据库迁移失败

**症状**：`pnpm db:push` 报错

| 错误信息 | 原因 | 解决方案 |
|----------|------|----------|
| `Connection refused` | MySQL 未启动 | `sudo systemctl start mysql` |
| `ER_TABLE_EXISTS_ERROR` | 表已存在 | 检查是否重复执行迁移 |
| `ER_LOCK_WAIT_TIMEOUT` | 表被锁定 | `SHOW PROCESSLIST` 找到并终止阻塞查询 |

### 4. DXF 导入失败

**症状**：上传 DXF 文件后无法解析或显示异常

| 情况 | 原因 | 解决方案 |
|------|------|----------|
| 解析失败 | DXF 版本不兼容 | 使用 AutoCAD 导出为 R12/R14 格式 |
| 柜列不显示 | DXF 中无 INSERT 实体 | 确保 DXF 包含块引用（INSERT） |
| 保存失败 | 数据超过字段限制 | 已使用 MEDIUMTEXT（16MB），检查文件大小 |

### 5. 实时监视无数据

**症状**：布局显示正常但所有柜组重量为 0

| 情况 | 原因 | 解决方案 |
|------|------|----------|
| 所有柜组重量为 0 | 采集服务未运行 | 开发并启动采集服务 |
| 布局不显示 | 无活跃布局 | 在布局编辑器中激活一个布局 |
| 部分柜组无颜色 | 柜组未绑定通道 | 在柜组管理中完成通道绑定 |

### 6. 性能问题

**症状**：页面加载缓慢、API 响应超时

```bash
# 检查 Node.js 进程资源
ps aux | grep node

# 检查 MySQL 慢查询
mysql -e "SHOW VARIABLES LIKE 'slow_query_log'"
mysql -e "SELECT * FROM mysql.slow_log ORDER BY start_time DESC LIMIT 10"

# 检查连接数
mysql -e "SHOW STATUS LIKE 'Threads_connected'"
```

### 7. Nginx 502 Bad Gateway

**症状**：浏览器显示 502 错误

```bash
# 检查 Node.js 是否运行
sudo systemctl status weighing-system

# 检查 Nginx 错误日志
tail -20 /var/log/nginx/weighing-error.log

# 检查 Nginx 代理目标是否可达
curl http://127.0.0.1:3000
```

## 诊断命令速查

```bash
# 系统资源
htop                              # 实时资源监控
df -h                             # 磁盘空间
free -h                           # 内存使用
uptime                            # 系统负载

# 网络
ss -tlnp                          # 监听端口
netstat -an | grep 3000           # 连接状态
curl -v http://localhost:3000     # HTTP 测试

# MySQL
mysql -u weighing -p -e "SHOW PROCESSLIST"     # 活跃连接
mysql -u weighing -p -e "SHOW TABLE STATUS FROM weighing_system"  # 表状态

# 日志
sudo journalctl -u weighing-system --since "1 hour ago"  # 最近1小时日志
sudo journalctl -u weighing-system -p err                # 仅错误日志
```
