import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, float, json } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 */
export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

/**
 * RS485网关表（串口服务器，如ZLAN6808）
 * 网关仅做字节透明转发，不理解端子/通道
 */
export const gateways = mysqlTable("gateways", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  port: int("port").notNull(),
  /** 网关型号，如 ZLAN6808-16口、ZLAN6808-32口 */
  model: varchar("model", { length: 50 }),
  status: mysqlEnum("status", ["online", "offline"]).default("offline").notNull(),
  lastHeartbeat: timestamp("lastHeartbeat"),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Gateway = typeof gateways.$inferSelect;
export type InsertGateway = typeof gateways.$inferInsert;

/**
 * 网关COM端口表
 * 每个COM端口独立配置串口参数和协议类型
 */
export const gatewayComPorts = mysqlTable("gatewayComPorts", {
  id: int("id").autoincrement().primaryKey(),
  gatewayId: int("gatewayId").notNull(),
  portNumber: varchar("portNumber", { length: 10 }).notNull(),
  baudRate: int("baudRate").notNull().default(9600),
  dataBits: int("dataBits").notNull().default(8),
  stopBits: int("stopBits").notNull().default(1),
  parity: varchar("parity", { length: 10 }).notNull().default("none"),
  /** 协议类型：Modbus RTU / 厂家自定义协议 */
  protocolType: varchar("protocolType", { length: 30 }).notNull().default("modbus_rtu"),
  /** 通信超时(ms) */
  timeoutMs: int("timeoutMs").notNull().default(1000),
  /** 重试次数 */
  retryCount: int("retryCount").notNull().default(3),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GatewayComPort = typeof gatewayComPorts.$inferSelect;
export type InsertGatewayComPort = typeof gatewayComPorts.$inferInsert;

/**
 * 称重仪表表
 * 管理标识(deviceCode)与通信寻址(slaveId)分离
 * slaveId在同一COM端口下必须唯一
 */
export const weighingInstruments = mysqlTable("weighingInstruments", {
  id: int("id").autoincrement().primaryKey(),
  /** 管理标识/资产编码，如 C001, C002（唯一，可自动生成可手工修改） */
  deviceCode: varchar("deviceCode", { length: 50 }).notNull().unique(),
  /** 仪表型号：DY7001(1通道) / DY7004(4通道) */
  modelType: mysqlEnum("modelType", ["DY7001", "DY7004"]).notNull(),
  /** RS485从站地址（Modbus RTU 1~247） */
  slaveId: int("slaveId").notNull(),
  /** 所属COM端口 */
  comPortId: int("comPortId").notNull(),
  /** 显示名称 */
  name: varchar("name", { length: 100 }),
  /** 安装位置描述 */
  location: text("location"),
  status: mysqlEnum("status", ["online", "offline"]).default("offline").notNull(),
  lastHeartbeat: timestamp("lastHeartbeat"),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeighingInstrument = typeof weighingInstruments.$inferSelect;
export type InsertWeighingInstrument = typeof weighingInstruments.$inferInsert;

/**
 * 仪表通道/端子表
 * 按仪表型号自动生成：DY7001→CH1, DY7004→CH1~CH4
 * 不允许用户逐个新增，由系统按模板自动生成
 */
export const instrumentChannels = mysqlTable("instrumentChannels", {
  id: int("id").autoincrement().primaryKey(),
  instrumentId: int("instrumentId").notNull(),
  /** 通道编号：1, 2, 3, 4 */
  channelNo: int("channelNo").notNull(),
  /** 通道标签，如 CH1, CH2 或用户自定义名称 */
  label: varchar("label", { length: 50 }).notNull(),
  /** 是否启用 */
  enabled: int("enabled").notNull().default(1),
  /** 校准系数 scale: 实际值 = rawValue * scale + offset */
  scale: float("scale").notNull().default(1.0),
  /** 校准偏移 */
  offset: float("offset").notNull().default(0.0),
  /** 单位，如 kg, g */
  unit: varchar("unit", { length: 10 }).notNull().default("kg"),
  /** 精度/小数位数 */
  precision: int("precision").notNull().default(2),
  /** 当前读数值（实时更新） */
  currentValue: float("currentValue").default(0),
  /** 最后更新时间 */
  lastReadAt: timestamp("lastReadAt"),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type InstrumentChannel = typeof instrumentChannels.$inferSelect;
export type InsertInstrumentChannel = typeof instrumentChannels.$inferInsert;

/**
 * 保险柜组表
 * 柜组重量由绑定的通道组合计算得出
 */
export const cabinetGroups = mysqlTable("cabinetGroups", {
  id: int("id").autoincrement().primaryKey(),
  /** 区域标识 */
  area: varchar("area", { length: 100 }).notNull().default(""),
  name: varchar("name", { length: 100 }).notNull(),
  /** 初始重量(kg) */
  initialWeight: float("initialWeight").notNull().default(0),
  /** 当前计算重量(kg) */
  currentWeight: float("currentWeight").notNull().default(0),
  /** 报警阈值(kg)：瞬间变化超过此值报警 */
  alarmThreshold: float("alarmThreshold").notNull().default(5),
  status: mysqlEnum("status", ["normal", "warning", "alarm"]).default("normal").notNull(),
  remark: text("remark"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CabinetGroup = typeof cabinetGroups.$inferSelect;
export type InsertCabinetGroup = typeof cabinetGroups.$inferInsert;

/**
 * 柜组通道绑定表
 * 柜组重量 = sum(channelValue_i * coefficient_i) + groupOffset
 * 一个柜组可绑定多个通道；默认同一通道不允许被多个柜组引用
 */
export const groupChannelBindings = mysqlTable("groupChannelBindings", {
  id: int("id").autoincrement().primaryKey(),
  groupId: int("groupId").notNull(),
  channelId: int("channelId").notNull(),
  /** 权重系数 k_i */
  coefficient: float("coefficient").notNull().default(1.0),
  /** 偏移量 */
  offset: float("offset").notNull().default(0.0),
  /** 排序顺序 */
  sortOrder: int("sortOrder").notNull().default(0),
  /** 是否启用 */
  enabled: int("enabled").notNull().default(1),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GroupChannelBinding = typeof groupChannelBindings.$inferSelect;
export type InsertGroupChannelBinding = typeof groupChannelBindings.$inferInsert;

/**
 * 重量变化记录表
 */
export const weightChangeRecords = mysqlTable("weightChangeRecords", {
  id: int("id").autoincrement().primaryKey(),
  cabinetGroupId: int("cabinetGroupId").notNull(),
  previousWeight: float("previousWeight").notNull(),
  currentWeight: float("currentWeight").notNull(),
  changeValue: float("changeValue").notNull(),
  isAlarm: int("isAlarm").notNull().default(0),
  /** 通道明细快照（JSON） */
  channelDetails: text("channelDetails"),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type WeightChangeRecord = typeof weightChangeRecords.$inferSelect;
export type InsertWeightChangeRecord = typeof weightChangeRecords.$inferInsert;

/**
 * 报警记录表
 */
export const alarmRecords = mysqlTable("alarmRecords", {
  id: int("id").autoincrement().primaryKey(),
  cabinetGroupId: int("cabinetGroupId").notNull(),
  weightChangeRecordId: int("weightChangeRecordId").notNull(),
  alarmType: mysqlEnum("alarmType", ["threshold_exceeded", "device_offline"]).notNull(),
  alarmMessage: text("alarmMessage").notNull(),
  isHandled: int("isHandled").notNull().default(0),
  handledBy: int("handledBy"),
  handledAt: timestamp("handledAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AlarmRecord = typeof alarmRecords.$inferSelect;
export type InsertAlarmRecord = typeof alarmRecords.$inferInsert;

/**
 * 保管库布局表
 */
export const vaultLayouts = mysqlTable("vaultLayouts", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  description: text("description"),
  layoutData: text("layoutData").notNull(),
  isActive: int("isActive").notNull().default(0),
  createdBy: int("createdBy").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type VaultLayout = typeof vaultLayouts.$inferSelect;
export type InsertVaultLayout = typeof vaultLayouts.$inferInsert;

/**
 * 操作审计日志表
 * 记录所有关键操作（创建/修改/删除/绑定变更）
 */
export const auditLogs = mysqlTable("auditLogs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  userName: varchar("userName", { length: 100 }),
  /** 操作类型 */
  action: varchar("action", { length: 50 }).notNull(),
  /** 操作对象类型 */
  targetType: varchar("targetType", { length: 50 }).notNull(),
  /** 操作对象ID */
  targetId: int("targetId"),
  /** 变更摘要 */
  summary: text("summary").notNull(),
  /** 变更详情（JSON） */
  details: text("details"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type AuditLog = typeof auditLogs.$inferSelect;
export type InsertAuditLog = typeof auditLogs.$inferInsert;
