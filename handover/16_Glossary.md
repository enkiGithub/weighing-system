# 16 — 术语表

## 业务术语

| 术语 | 英文 | 说明 |
|------|------|------|
| **保险柜组** | Cabinet Group | 一组物理保险柜的逻辑集合，绑定若干称重通道，系统计算其总重量 |
| **称重仪表** | Weighing Instrument | 连接称重传感器的数据采集设备，型号包括 DY7001（单通道）和 DY7004（四通道） |
| **通道** | Channel | 仪表上的一个独立称重输入，每个通道连接一个传感器 |
| **网关** | Gateway | RS485 串口服务器（如 ZLAN6808），将 RS485 信号转换为 TCP/IP |
| **COM 端口** | COM Port | 网关上的串口端口，每个端口连接一条 RS485 总线 |
| **从站地址** | Slave ID | Modbus RTU 协议中设备的通信地址（1~247），同一 COM 端口下必须唯一 |
| **皮重/初始重量** | Initial Weight / Tare | 柜组空载时的基准重量 |
| **当前重量** | Current Weight | 采集服务实时计算的柜组总重量 |
| **报警阈值** | Alarm Threshold | 重量变化超过此值时触发报警 |
| **布局** | Layout | DXF 图纸导入后的保管库平面图，用于可视化监视 |
| **柜列** | Vault Column | DXF 图纸中的一个矩形区域，代表一列保险柜 |
| **内圈/外圈** | Inner/Outer Ring | 保管库中保险柜的物理分区 |

## 技术术语

| 术语 | 说明 |
|------|------|
| **tRPC** | TypeScript Remote Procedure Call，类型安全的 API 框架 |
| **Drizzle ORM** | TypeScript 优先的数据库 ORM，用于定义 Schema 和执行查询 |
| **Modbus RTU** | 工业通信协议，通过 RS485 总线连接仪表设备 |
| **RS485** | 差分信号串行通信标准，支持多设备总线连接 |
| **DXF** | Drawing Exchange Format，AutoCAD 的图纸交换格式 |
| **JWT** | JSON Web Token，用于用户会话认证 |
| **RBAC** | Role-Based Access Control，基于角色的访问控制 |
| **HMR** | Hot Module Replacement，Vite 开发模式下的热更新 |
| **SPA** | Single Page Application，单页面应用 |

## 仪表型号对照

| 型号 | 通道数 | 自动生成通道 | 典型用途 |
|------|--------|-------------|----------|
| DY7001 | 1 | CH1 | 单柜称重 |
| DY7004 | 4 | CH1~CH4 | 多柜组合称重 |

## 权限模块标识

| 模块标识 | 中文名称 | 对应页面 |
|----------|----------|----------|
| `dashboard` | 实时监视 | `/` |
| `gateway_config` | 网关配置 | `/gateways` |
| `instrument_config` | 仪表配置 | `/devices` |
| `cabinet_group` | 柜组管理 | `/cabinets` |
| `data_records` | 数据记录 | `/records` |
| `alarm_management` | 报警管理 | `/alarms` |
| `data_analysis` | 数据分析 | `/analytics` |
| `audit_logs` | 审计日志 | `/audit-logs` |
| `user_management` | 用户管理 | `/users` |
| `layout_editor` | 布局编辑器 | `/layout-editor` |

## 柜组状态

| 状态值 | 中文 | 触发条件 |
|--------|------|----------|
| `normal` | 正常 | 重量变化在阈值内 |
| `warning` | 预警 | 重量变化接近阈值 |
| `alarm` | 报警 | 重量变化超过阈值 |

## 设备状态

| 状态值 | 中文 | 说明 |
|--------|------|------|
| `online` | 在线 | 采集服务正常通信 |
| `offline` | 离线 | 通信超时或断开 |
