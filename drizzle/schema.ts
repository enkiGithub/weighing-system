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