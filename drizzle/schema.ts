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
 * 称重仪表表 - 管理所有称重传感器仪表
 */
export const weighingInstruments = mysqlTable("weighingInstruments", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  gatewayId: int("gatewayId").notNull(),
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
  instrumentId: int("instrumentId").notNull(),
  initialWeight: int("initialWeight").notNull(), // 单位：克
  currentWeight: int("currentWeight").notNull(), // 单位：克
  alarmThreshold: int("alarmThreshold").notNull(), // 单位：克
  positionX: int("positionX").notNull().default(0), // 3D位置X坐标
  positionY: int("positionY").notNull().default(0), // 3D位置Y坐标
  positionZ: int("positionZ").notNull().default(0), // 3D位置Z坐标
  status: mysqlEnum("status", ["normal", "warning", "alarm"]).default("normal").notNull(),
  description: text("description"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CabinetGroup = typeof cabinetGroups.$inferSelect;
export type InsertCabinetGroup = typeof cabinetGroups.$inferInsert;

/**
 * 重量变化记录表 - 记录所有重量变化事件
 */
export const weightChangeRecords = mysqlTable("weightChangeRecords", {
  id: int("id").autoincrement().primaryKey(),
  cabinetGroupId: int("cabinetGroupId").notNull(),
  previousWeight: int("previousWeight").notNull(), // 单位：克
  currentWeight: int("currentWeight").notNull(), // 单位：克
  changeValue: int("changeValue").notNull(), // 单位：克
  isAlarm: int("isAlarm").notNull().default(0), // 0: 正常, 1: 报警
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
  isHandled: int("isHandled").notNull().default(0), // 0: 未处理, 1: 已处理
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
  width: int("width").notNull(), // 宽度（毫米）
  height: int("height").notNull(), // 高度（毫米）
  depth: int("depth").notNull(), // 深度（毫米）
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
  layoutData: text("layoutData").notNull(), // JSON格式的布局数据
  isActive: int("isActive").notNull().default(0), // 0: 未激活, 1: 当前激活布局
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
  positionX: int("positionX").notNull().default(0), // 3D位置X坐标
  positionY: int("positionY").notNull().default(0), // 3D位置Y坐标
  positionZ: int("positionZ").notNull().default(0), // 3D位置Z坐标
  rotationX: int("rotationX").notNull().default(0), // 旋转角度X（度数*100）
  rotationY: int("rotationY").notNull().default(0), // 旋转角度Y（度数*100）
  rotationZ: int("rotationZ").notNull().default(0), // 旋转角度Z（度数*100）
  scaleX: int("scaleX").notNull().default(100), // 缩放比例X（百分比）
  scaleY: int("scaleY").notNull().default(100), // 缩放比例Y（百分比）
  scaleZ: int("scaleZ").notNull().default(100), // 缩放比例Z（百分比）
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type CabinetGroupLayout = typeof cabinetGroupLayouts.$inferSelect;
export type InsertCabinetGroupLayout = typeof cabinetGroupLayouts.$inferInsert;