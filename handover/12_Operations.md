# 12 — 运维手册

## 日常运维

### 服务状态检查

```bash
# 检查服务状态
sudo systemctl status weighing-system

# 查看实时日志
sudo journalctl -u weighing-system -f

# 查看最近100行日志
sudo journalctl -u weighing-system -n 100

# 检查端口监听
ss -tlnp | grep 3000

# 检查 MySQL 状态
sudo systemctl status mysql
```

### 服务管理

```bash
# 启动
sudo systemctl start weighing-system

# 停止
sudo systemctl stop weighing-system

# 重启
sudo systemctl restart weighing-system

# 查看启动失败原因
sudo journalctl -u weighing-system --since "5 min ago"
```

### 更新部署

```bash
cd /opt/weighing-system

# 1. 备份当前版本
cp -r dist dist.bak

# 2. 拉取新代码
git pull origin main

# 3. 安装依赖
pnpm install

# 4. 数据库迁移
pnpm db:push

# 5. 构建
pnpm build

# 6. 重启服务
sudo systemctl restart weighing-system

# 7. 验证
curl http://localhost:3000
```

### 回滚

```bash
# 恢复上一版本的构建产物
rm -rf dist
mv dist.bak dist
sudo systemctl restart weighing-system
```

## 数据库备份

### 手动备份

```bash
# 完整备份
mysqldump -u weighing -p weighing_system > backup_$(date +%Y%m%d_%H%M%S).sql

# 仅结构
mysqldump -u weighing -p --no-data weighing_system > schema_backup.sql

# 仅数据
mysqldump -u weighing -p --no-create-info weighing_system > data_backup.sql
```

### 自动备份（cron）

```bash
# 创建备份脚本
sudo mkdir -p /opt/backups/weighing-system

cat << 'EOF' | sudo tee /opt/backups/weighing-system/backup.sh
#!/bin/bash
BACKUP_DIR="/opt/backups/weighing-system"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/weighing_system_${TIMESTAMP}.sql.gz"

# 备份并压缩
mysqldump -u weighing -p'your_password' weighing_system | gzip > "${BACKUP_FILE}"

# 保留最近30天的备份
find "${BACKUP_DIR}" -name "*.sql.gz" -mtime +30 -delete

echo "[$(date)] Backup completed: ${BACKUP_FILE}" >> "${BACKUP_DIR}/backup.log"
EOF

sudo chmod +x /opt/backups/weighing-system/backup.sh

# 添加 cron 任务（每天凌晨2点备份）
echo "0 2 * * * /opt/backups/weighing-system/backup.sh" | sudo crontab -
```

### 恢复备份

```bash
# 解压并恢复
gunzip < backup_20260220_020000.sql.gz | mysql -u weighing -p weighing_system
```

## 日志管理

### 应用日志

```bash
# 查看今日日志
sudo journalctl -u weighing-system --since today

# 按时间范围查看
sudo journalctl -u weighing-system --since "2026-02-20 08:00" --until "2026-02-20 12:00"

# 导出日志
sudo journalctl -u weighing-system --since today > /tmp/app.log
```

### Nginx 日志

```bash
# 访问日志
tail -f /var/log/nginx/weighing-access.log

# 错误日志
tail -f /var/log/nginx/weighing-error.log

# 日志轮转（logrotate 默认已配置）
ls /var/log/nginx/weighing-*.log*
```

### 日志轮转配置

```bash
cat << 'EOF' | sudo tee /etc/logrotate.d/weighing-system
/var/log/nginx/weighing-*.log {
    daily
    missingok
    rotate 30
    compress
    delaycompress
    notifempty
    create 0640 www-data adm
    sharedscripts
    postrotate
        [ -f /var/run/nginx.pid ] && kill -USR1 $(cat /var/run/nginx.pid)
    endscript
}
EOF
```

## 监控建议

### 基础监控项

| 监控项 | 检查方式 | 告警阈值 |
|--------|----------|----------|
| 服务存活 | `curl http://localhost:3000` | HTTP 非 200 |
| CPU 使用率 | `top` / `htop` | > 80% 持续 5 分钟 |
| 内存使用 | `free -h` | 可用 < 500MB |
| 磁盘空间 | `df -h` | 使用 > 85% |
| MySQL 连接数 | `SHOW STATUS LIKE 'Threads_connected'` | > 100 |
| 数据库大小 | `SELECT SUM(data_length+index_length) FROM information_schema.tables WHERE table_schema='weighing_system'` | > 5GB |

### 简易健康检查脚本

```bash
cat << 'EOF' | sudo tee /opt/weighing-system/healthcheck.sh
#!/bin/bash
# 检查 Web 服务
if ! curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "[ALERT] Web service is down, attempting restart..."
    sudo systemctl restart weighing-system
fi

# 检查 MySQL
if ! mysqladmin ping -u weighing -p'password' > /dev/null 2>&1; then
    echo "[ALERT] MySQL is down!"
fi

# 检查磁盘空间
DISK_USAGE=$(df / | awk 'NR==2 {print $5}' | tr -d '%')
if [ "$DISK_USAGE" -gt 85 ]; then
    echo "[WARN] Disk usage: ${DISK_USAGE}%"
fi
EOF

sudo chmod +x /opt/weighing-system/healthcheck.sh

# 每5分钟检查一次
echo "*/5 * * * * /opt/weighing-system/healthcheck.sh >> /var/log/weighing-healthcheck.log 2>&1" | sudo crontab -
```

## 性能调优

### Node.js

```bash
# 增加内存限制（默认约1.5GB）
NODE_OPTIONS="--max-old-space-size=2048" node dist/index.js
```

### MySQL

```ini
# /etc/mysql/mysql.conf.d/mysqld.cnf
[mysqld]
innodb_buffer_pool_size = 512M    # 建议为可用内存的50~70%
max_connections = 100
slow_query_log = 1
slow_query_log_file = /var/log/mysql/slow.log
long_query_time = 2
```
