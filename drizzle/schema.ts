import { int, mysqlEnum, mysqlTable, text, timestamp, varchar } from "drizzle-orm/mysql-core";

/**
 * Core user table backing auth flow.
 * Extend this file with additional tables as your product grows.
 * Columns use camelCase to match both database fields and generated types.
 */
export const users = mysqlTable("users", {
  /**
   * Surrogate primary key. Auto-incremented numeric value managed by the database.
   * Use this for relations between tables.
   */
  id: int("id").autoincrement().primaryKey(),
  /** Manus OAuth identifier (openId) returned from the OAuth callback. Unique per user. */
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
 * RS485网关表 - 管理所有RS485网关设备
 */
export const gateways = mysqlTable("gateways", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  ipAddress: varchar("ipAddress", { length: 45 }).notNull(),
  port: int("port").notNull(),
  status: mysqlEnum("status", ["online", "offline"]).default("offline").notNull(),
  lastHeartbeat: timestamp("lastHeartbeat"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Gateway = typeof gateways.$inferSelect;
export type InsertGateway = typeof gateways.$inferInsert;

/**
 * 网关COM端口表 - 管理网关的COM端口配置
 */
export const gatewayComPorts = mysqlTable("gatewayComPorts", {
  id: int("id").autoincrement().primaryKey(),
  gatewayId: int("gatewayId").notNull(),
  portNumber: varchar("portNumber", { length: 10 }).notNull(),
  baudRate: int("baudRate").notNull().default(9600),
  dataBits: int("dataBits").notNull().default(8),
  stopBits: int("stopBits").notNull().default(1),
  parity: varchar("parity", { length: 10 }).notNull().default("none"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type GatewayComPort = typeof gatewayComPorts.$inferSelect;
export type InsertGatewayComPort = typeof gatewayComPorts.$inferInsert;

/**
 * 称重仪表表 - 管理所有称重传感器仪表
 */
export const weighingInstruments = mysqlTable("weighingInstruments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  modelType: mysqlEnum("modelType", ["DY7001", "DY7004"]).notNull(),
  gatewayComPortId: int("gatewayComPortId").notNull(),
  slaveAddress: int("slaveAddress").notNull(),
  status: mysqlEnum("status", ["online", "offline"]).default("offline").notNull(),
  lastHeartbeat: timestamp("lastHeartbeat"),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type WeighingInstrument = typeof weighingInstruments.$inferSelect;
export type InsertWeighingInstrument = typeof weighingInstruments.$inferInsert;

/**
 * 保险柜组表 - 管理保管库中的柜子组
 */
export const cabinetGroups = mysqlTable("cabinetGroups", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  initialWeight: int("initialWeight").notNull(),
  currentWeight: int("currentWeight").notNull(),
  alarmThreshold: int("alarmThreshold").notNull(),
  positionX: int("positionX").notNull().default(0),
  positionY: int("positionY").notNull().default(0),
  positionZ: int("positionZ").notNull().default(0),
  status: mysqlEnum("status", ["normal", "warning", "alarm"]).default("normal").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CabinetGroup = typeof cabinetGroups.$inferSelect;
export type InsertCabinetGroup = typeof cabinetGroups.$inferInsert;

/**
 * 柜组网关绑定表 - 记录柜组与网关COM端口的绑定关系
 */
export const cabinetGroupGatewayBindings = mysqlTable("cabinetGroupGatewayBindings", {
  id: int("id").autoincrement().primaryKey(),
  cabinetGroupId: int("cabinetGroupId").notNull().unique(),
  gatewayComPortId: int("gatewayComPortId").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CabinetGroupGatewayBinding = typeof cabinetGroupGatewayBindings.$inferSelect;
export type InsertCabinetGroupGatewayBinding = typeof cabinetGroupGatewayBindings.$inferInsert;

/**
 * 柜组传感器绑定表 - 记录柜组与仪表端子的绑定关系
 */
export const cabinetGroupSensorBindings = mysqlTable("cabinetGroupSensorBindings", {
  id: int("id").autoincrement().primaryKey(),
  cabinetGroupId: int("cabinetGroupId").notNull(),
  instrumentId: int("instrumentId").notNull(),
  sensorChannel: int("sensorChannel").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CabinetGroupSensorBinding = typeof cabinetGroupSensorBindings.$inferSelect;
export type InsertCabinetGroupSensorBinding = typeof cabinetGroupSensorBindings.$inferInsert;

/**
 * 重量变化记录表 - 记录所有重量变化事件
 */
export const weightChangeRecords = mysqlTable("weightChangeRecords", {
  id: int("id").autoincrement().primaryKey(),
  cabinetGroupId: int("cabinetGroupId").notNull(),
  previousWeight: int("previousWeight").notNull(),
  currentWeight: int("currentWeight").notNull(),
  changeValue: int("changeValue").notNull(),
  isAlarm: int("isAlarm").notNull().default(0),
  recordedAt: timestamp("recordedAt").defaultNow().notNull(),
});

export type WeightChangeRecord = typeof weightChangeRecords.$inferSelect;
export type InsertWeightChangeRecord = typeof weightChangeRecords.$inferInsert;

/**
 * 报警记录表 - 记录所有报警事件
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
 * 柜子表 - 保管库中的最小单元柜子
 */
export const cabinets = mysqlTable("cabinets", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  width: int("width").notNull(),
  height: int("height").notNull(),
  depth: int("depth").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Cabinet = typeof cabinets.$inferSelect;
export type InsertCabinet = typeof cabinets.$inferInsert;

/**
 * 保管库布局表 - 存储保管库的整体布局配置
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
 * 柜组布局详情表 - 记录每个柜组在布局中的位置和变换
 */
export const cabinetGroupLayouts = mysqlTable("cabinetGroupLayouts", {
  id: int("id").autoincrement().primaryKey(),
  vaultLayoutId: int("vaultLayoutId").notNull(),
  cabinetGroupId: int("cabinetGroupId").notNull(),
  positionX: int("positionX").notNull().default(0),
  positionY: int("positionY").notNull().default(0),
  positionZ: int("positionZ").notNull().default(0),
  rotationX: int("rotationX").notNull().default(0),
  rotationY: int("rotationY").notNull().default(0),
  rotationZ: int("rotationZ").notNull().default(0),
  scaleX: int("scaleX").notNull().default(100),
  scaleY: int("scaleY").notNull().default(100),
  scaleZ: int("scaleZ").notNull().default(100),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CabinetGroupLayout = typeof cabinetGroupLayouts.$inferSelect;
export type InsertCabinetGroupLayout = typeof cabinetGroupLayouts.$inferInsert;
