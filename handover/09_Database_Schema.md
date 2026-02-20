# 09 — 数据库 Schema

## ER 关系概览

```
users ──1:N──> userPermissions
users ──1:N──> auditLogs (userId)

gateways ──1:N──> gatewayComPorts (gatewayId)
gatewayComPorts ──1:N──> weighingInstruments (comPortId)
weighingInstruments ──1:N──> instrumentChannels (instrumentId)

cabinetGroups ──1:N──> groupChannelBindings (groupId)
instrumentChannels ──1:N──> groupChannelBindings (channelId)

cabinetGroups ──1:N──> weightChangeRecords (cabinetGroupId)
cabinetGroups ──1:N──> alarmRecords (cabinetGroupId)
weightChangeRecords ──1:1──> alarmRecords (weightChangeRecordId)

vaultLayouts (独立表，通过 layoutData JSON 关联 cabinetGroups)
```

## 表结构详细说明

### users — 用户表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| username | VARCHAR(64) | NOT NULL, UNIQUE | 登录用户名 |
| passwordHash | VARCHAR(255) | NOT NULL | bcrypt 密码哈希 |
| name | TEXT | — | 显示名称 |
| role | ENUM('admin','operator') | NOT NULL, DEFAULT 'operator' | 角色 |
| createdAt | TIMESTAMP | NOT NULL, DEFAULT NOW() | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL, ON UPDATE NOW() | 更新时间 |
| lastSignedIn | TIMESTAMP | NOT NULL, DEFAULT NOW() | 最后登录时间 |

### gateways — RS485 网关表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| name | VARCHAR(100) | NOT NULL | 网关名称 |
| ipAddress | VARCHAR(45) | NOT NULL | IP 地址 |
| port | INT | NOT NULL | TCP 端口 |
| model | VARCHAR(50) | — | 型号（如 ZLAN6808） |
| status | ENUM('online','offline') | NOT NULL, DEFAULT 'offline' | 在线状态 |
| lastHeartbeat | TIMESTAMP | — | 最后心跳时间 |
| remark | TEXT | — | 备注 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

### gatewayComPorts — 网关 COM 端口表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| gatewayId | INT | NOT NULL | 所属网关 ID |
| portNumber | VARCHAR(10) | NOT NULL | 端口号（如 COM1） |
| baudRate | INT | NOT NULL, DEFAULT 9600 | 波特率 |
| dataBits | INT | NOT NULL, DEFAULT 8 | 数据位 |
| stopBits | INT | NOT NULL, DEFAULT 1 | 停止位 |
| parity | VARCHAR(10) | NOT NULL, DEFAULT 'none' | 校验位 |
| protocolType | VARCHAR(30) | NOT NULL, DEFAULT 'modbus_rtu' | 协议类型 |
| timeoutMs | INT | NOT NULL, DEFAULT 1000 | 通信超时(ms) |
| retryCount | INT | NOT NULL, DEFAULT 3 | 重试次数 |
| remark | TEXT | — | 备注 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

### weighingInstruments — 称重仪表表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| deviceCode | VARCHAR(50) | NOT NULL, UNIQUE | 管理标识（如 C001） |
| modelType | ENUM('DY7001','DY7004') | NOT NULL | 仪表型号 |
| slaveId | INT | NOT NULL | Modbus 从站地址（1~247） |
| comPortId | INT | NOT NULL | 所属 COM 端口 ID |
| name | VARCHAR(100) | — | 显示名称 |
| location | TEXT | — | 安装位置描述 |
| status | ENUM('online','offline') | NOT NULL, DEFAULT 'offline' | 在线状态 |
| lastHeartbeat | TIMESTAMP | — | 最后心跳时间 |
| remark | TEXT | — | 备注 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

**业务规则**：同一 COM 端口下 slaveId 必须唯一；deviceCode 全局唯一。

### instrumentChannels — 仪表通道表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| instrumentId | INT | NOT NULL | 所属仪表 ID |
| channelNo | INT | NOT NULL | 通道编号（1~4） |
| label | VARCHAR(50) | NOT NULL | 通道标签（如 CH1） |
| enabled | INT | NOT NULL, DEFAULT 1 | 是否启用 |
| scale | FLOAT | NOT NULL, DEFAULT 1.0 | 校准系数 |
| offset | FLOAT | NOT NULL, DEFAULT 0.0 | 校准偏移 |
| unit | VARCHAR(10) | NOT NULL, DEFAULT 'kg' | 单位 |
| precision | INT | NOT NULL, DEFAULT 2 | 小数位数 |
| currentValue | FLOAT | DEFAULT 0 | 当前读数（采集服务写入） |
| lastReadAt | TIMESTAMP | — | 最后读取时间 |
| remark | TEXT | — | 备注 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

**业务规则**：通道由系统根据仪表型号自动生成，DY7001 生成 1 个通道，DY7004 生成 4 个通道。实际值计算公式：`actualValue = rawValue * scale + offset`。

### cabinetGroups — 保险柜组表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| area | VARCHAR(100) | NOT NULL, DEFAULT '' | 区域标识 |
| name | VARCHAR(100) | NOT NULL | 柜组名称 |
| initialWeight | FLOAT | NOT NULL, DEFAULT 0 | 初始重量/皮重(kg) |
| currentWeight | FLOAT | NOT NULL, DEFAULT 0 | 当前计算重量(kg) |
| alarmThreshold | FLOAT | NOT NULL, DEFAULT 5 | 报警阈值(kg) |
| status | ENUM('normal','warning','alarm') | NOT NULL, DEFAULT 'normal' | 状态 |
| remark | TEXT | — | 备注 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

**业务规则**：柜组重量 = Σ(channelValue × coefficient) + offset。`currentWeight` 创建时初始化为 0，由采集服务实时更新。

### groupChannelBindings — 柜组通道绑定表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| groupId | INT | NOT NULL | 柜组 ID |
| channelId | INT | NOT NULL | 通道 ID |
| coefficient | FLOAT | NOT NULL, DEFAULT 1.0 | 权重系数 |
| offset | FLOAT | NOT NULL, DEFAULT 0.0 | 偏移量 |
| sortOrder | INT | NOT NULL, DEFAULT 0 | 排序顺序 |
| enabled | INT | NOT NULL, DEFAULT 1 | 是否启用 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

**业务规则**：同一通道默认不允许被多个柜组绑定。

### weightChangeRecords — 重量变化记录表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| cabinetGroupId | INT | NOT NULL | 柜组 ID |
| previousWeight | FLOAT | NOT NULL | 变化前重量 |
| currentWeight | FLOAT | NOT NULL | 变化后重量 |
| changeValue | FLOAT | NOT NULL | 变化量 |
| isAlarm | INT | NOT NULL, DEFAULT 0 | 是否触发报警 |
| channelDetails | TEXT | — | 通道明细快照（JSON） |
| recordedAt | TIMESTAMP | NOT NULL | 记录时间 |

### alarmRecords — 报警记录表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| cabinetGroupId | INT | NOT NULL | 柜组 ID |
| weightChangeRecordId | INT | NOT NULL | 关联的重量变化记录 ID |
| alarmType | ENUM('threshold_exceeded','device_offline') | NOT NULL | 报警类型 |
| alarmMessage | TEXT | NOT NULL | 报警消息 |
| isHandled | INT | NOT NULL, DEFAULT 0 | 是否已处理 |
| handledBy | INT | — | 处理人 ID |
| handledAt | TIMESTAMP | — | 处理时间 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |

### vaultLayouts — 保管库布局表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| name | VARCHAR(100) | NOT NULL | 布局名称 |
| description | TEXT | — | 描述 |
| layoutData | MEDIUMTEXT | NOT NULL | 布局数据（JSON，最大 16MB） |
| isActive | INT | NOT NULL, DEFAULT 0 | 是否为活跃布局 |
| createdBy | INT | NOT NULL | 创建者 ID |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

**注意**：`layoutData` 使用 `MEDIUMTEXT` 类型（支持 16MB），因为 DXF 解析后的 JSON 数据通常在 100KB~1MB 范围。

### auditLogs — 审计日志表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| userId | INT | NOT NULL | 操作者 ID |
| userName | VARCHAR(100) | — | 操作者名称 |
| action | VARCHAR(50) | NOT NULL | 操作类型 |
| targetType | VARCHAR(50) | NOT NULL | 操作对象类型 |
| targetId | INT | — | 操作对象 ID |
| summary | TEXT | NOT NULL | 变更摘要 |
| details | TEXT | — | 变更详情（JSON） |
| createdAt | TIMESTAMP | NOT NULL | 操作时间 |

### userPermissions — 用户权限表

| 列名 | 类型 | 约束 | 说明 |
|------|------|------|------|
| id | INT | PK, AUTO_INCREMENT | 主键 |
| userId | INT | NOT NULL | 用户 ID |
| module | VARCHAR(50) | NOT NULL | 模块标识 |
| canView | INT | NOT NULL, DEFAULT 0 | 是否可查看 |
| canOperate | INT | NOT NULL, DEFAULT 0 | 是否可操作 |
| createdAt | TIMESTAMP | NOT NULL | 创建时间 |
| updatedAt | TIMESTAMP | NOT NULL | 更新时间 |

**模块标识列表**：`dashboard`, `gateway_config`, `instrument_config`, `cabinet_group`, `data_records`, `alarm_management`, `data_analysis`, `audit_logs`, `user_management`, `layout_editor`。

## 迁移管理

数据库迁移由 Drizzle Kit 管理，迁移文件位于 `drizzle/` 目录：

```
drizzle/
├── 0000_calm_tarantula.sql    # 初始表结构
├── 0001_nice_unus.sql         # ...
├── ...
├── 0008_fluffy_justin_hammer.sql  # 最新迁移
└── meta/                      # 迁移元数据
```

执行迁移：`pnpm db:push`（等同于 `drizzle-kit generate && drizzle-kit migrate`）。
