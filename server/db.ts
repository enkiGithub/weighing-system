import { eq, desc, and, gte, lte, inArray } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  gateways,
  gatewayComPorts,
  weighingInstruments,
  instrumentChannels,
  cabinetGroups,
  groupChannelBindings,
  weightChangeRecords,
  alarmRecords,
  vaultLayouts,
  auditLogs,
  InsertGateway,
  InsertGatewayComPort,
  InsertWeighingInstrument,
  InsertInstrumentChannel,
  InsertCabinetGroup,
  InsertGroupChannelBinding,
  InsertWeightChangeRecord,
  InsertAlarmRecord,
  InsertVaultLayout,
  InsertAuditLog,
} from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

// Lazily create the drizzle instance so local tooling can run without a DB.
export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  return _db;
}

// ==================== 用户管理 ====================

export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) {
    throw new Error("User openId is required for upsert");
  }

  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot upsert user: database not available");
    return;
  }

  try {
    const values: InsertUser = {
      openId: user.openId,
    };
    const updateSet: Record<string, unknown> = {};

    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];

    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };

    textFields.forEach(assignNullable);

    if (user.lastSignedIn !== undefined) {
      values.lastSignedIn = user.lastSignedIn;
      updateSet.lastSignedIn = user.lastSignedIn;
    }
    if (user.role !== undefined) {
      values.role = user.role;
      updateSet.role = user.role;
    } else if (user.openId === ENV.ownerOpenId) {
      values.role = 'admin';
      updateSet.role = 'admin';
    }

    if (!values.lastSignedIn) {
      values.lastSignedIn = new Date();
    }

    if (Object.keys(updateSet).length === 0) {
      updateSet.lastSignedIn = new Date();
    }

    await db.insert(users).values(values).onDuplicateKeyUpdate({
      set: updateSet,
    });
  } catch (error) {
    console.error("[Database] Failed to upsert user:", error);
    throw error;
  }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) {
    console.warn("[Database] Cannot get user: database not available");
    return undefined;
  }
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(id: number, role: 'admin' | 'user') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(users).set({ role }).where(eq(users.id, id));
}

export async function deleteUser(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(users).where(eq(users.id, id));
}

// ==================== 网关管理 ====================

export async function getAllGateways() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(gateways).orderBy(desc(gateways.createdAt));
}

export async function getGatewayById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gateways).where(eq(gateways.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createGateway(gateway: InsertGateway): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(gateways).values(gateway);
  return Number(result[0].insertId);
}

export async function updateGateway(id: number, gateway: Partial<InsertGateway>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(gateways).set(gateway).where(eq(gateways.id, id));
}

export async function deleteGateway(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(gateways).where(eq(gateways.id, id));
}

export async function updateGatewayStatus(id: number, status: 'online' | 'offline', lastHeartbeat?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(gateways).set({ status, lastHeartbeat }).where(eq(gateways.id, id));
}

// ==================== 网关COM端口管理 ====================

export async function getComPortsByGateway(gatewayId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(gatewayComPorts)
    .where(eq(gatewayComPorts.gatewayId, gatewayId))
    .orderBy(desc(gatewayComPorts.createdAt));
}

export async function getComPortById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(gatewayComPorts).where(eq(gatewayComPorts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createComPort(port: InsertGatewayComPort): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(gatewayComPorts).values(port);
  return Number(result[0].insertId);
}

export async function updateComPort(id: number, port: Partial<InsertGatewayComPort>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(gatewayComPorts).set(port).where(eq(gatewayComPorts.id, id));
}

export async function deleteComPort(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(gatewayComPorts).where(eq(gatewayComPorts.id, id));
}

// ==================== 称重仪表管理 ====================

export async function getAllInstruments() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weighingInstruments).orderBy(desc(weighingInstruments.createdAt));
}

export async function getInstrumentById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(weighingInstruments).where(eq(weighingInstruments.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getInstrumentsByComPortId(comPortId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weighingInstruments).where(eq(weighingInstruments.comPortId, comPortId));
}

export async function createInstrument(instrument: InsertWeighingInstrument): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(weighingInstruments).values(instrument);
  return Number(result[0].insertId);
}

export async function updateInstrument(id: number, instrument: Partial<InsertWeighingInstrument>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(weighingInstruments).set(instrument).where(eq(weighingInstruments.id, id));
}

export async function deleteInstrument(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(weighingInstruments).where(eq(weighingInstruments.id, id));
}

export async function updateInstrumentStatus(id: number, status: 'online' | 'offline', lastHeartbeat?: Date) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(weighingInstruments).set({ status, lastHeartbeat }).where(eq(weighingInstruments.id, id));
}

/** 检查同一COM端口下slaveId是否已存在（排除指定id） */
export async function checkSlaveIdConflict(comPortId: number, slaveId: number, excludeId?: number) {
  const db = await getDb();
  if (!db) return false;
  const conditions = [
    eq(weighingInstruments.comPortId, comPortId),
    eq(weighingInstruments.slaveId, slaveId),
  ];
  const result = await db.select({ id: weighingInstruments.id })
    .from(weighingInstruments)
    .where(and(...conditions));
  if (excludeId) {
    return result.some(r => r.id !== excludeId);
  }
  return result.length > 0;
}

/** 检查deviceCode是否已存在（排除指定id） */
export async function checkDeviceCodeConflict(deviceCode: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: weighingInstruments.id })
    .from(weighingInstruments)
    .where(eq(weighingInstruments.deviceCode, deviceCode));
  if (excludeId) {
    return result.some(r => r.id !== excludeId);
  }
  return result.length > 0;
}

// ==================== 仪表通道管理 ====================

export async function getChannelsByInstrument(instrumentId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(instrumentChannels)
    .where(eq(instrumentChannels.instrumentId, instrumentId))
    .orderBy(instrumentChannels.channelNo);
}

export async function getChannelById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(instrumentChannels).where(eq(instrumentChannels.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getAllChannels() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(instrumentChannels).orderBy(instrumentChannels.instrumentId, instrumentChannels.channelNo);
}

export async function createChannel(channel: InsertInstrumentChannel): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(instrumentChannels).values(channel);
  return Number(result[0].insertId);
}

export async function updateChannel(id: number, channel: Partial<InsertInstrumentChannel>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(instrumentChannels).set(channel).where(eq(instrumentChannels.id, id));
}

export async function deleteChannel(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(instrumentChannels).where(eq(instrumentChannels.id, id));
}

export async function deleteChannelsByInstrument(instrumentId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(instrumentChannels).where(eq(instrumentChannels.instrumentId, instrumentId));
}

/** 为仪表自动生成通道（DY7001→1通道，DY7004→4通道） */
export async function autoGenerateChannels(instrumentId: number, modelType: "DY7001" | "DY7004"): Promise<number[]> {
  const channelCount = modelType === "DY7001" ? 1 : 4;
  const ids: number[] = [];
  for (let i = 1; i <= channelCount; i++) {
    const id = await createChannel({
      instrumentId,
      channelNo: i,
      label: `CH${i}`,
      enabled: 1,
      scale: 1.0,
      offset: 0.0,
      unit: "kg",
      precision: 2,
    });
    ids.push(id);
  }
  return ids;
}

// ==================== 保险柜组管理 ====================

export async function getAllCabinetGroups() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cabinetGroups).orderBy(desc(cabinetGroups.createdAt));
}

export async function getCabinetGroupById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cabinetGroups).where(eq(cabinetGroups.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCabinetGroup(group: InsertCabinetGroup): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cabinetGroups).values(group);
  return Number(result[0].insertId);
}

export async function updateCabinetGroup(id: number, group: Partial<InsertCabinetGroup>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cabinetGroups).set(group).where(eq(cabinetGroups.id, id));
}

export async function deleteCabinetGroup(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cabinetGroups).where(eq(cabinetGroups.id, id));
}

export async function updateCabinetGroupWeight(id: number, currentWeight: number, status: 'normal' | 'warning' | 'alarm') {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cabinetGroups).set({ currentWeight, status }).where(eq(cabinetGroups.id, id));
}

/** 检查assetCode是否已存在（排除指定id） */
export async function checkAssetCodeConflict(assetCode: string, excludeId?: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ id: cabinetGroups.id })
    .from(cabinetGroups)
    .where(eq(cabinetGroups.assetCode, assetCode));
  if (excludeId) {
    return result.some(r => r.id !== excludeId);
  }
  return result.length > 0;
}

// ==================== 柜组通道绑定管理 ====================

export async function getBindingsByGroup(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(groupChannelBindings)
    .where(eq(groupChannelBindings.groupId, groupId))
    .orderBy(groupChannelBindings.sortOrder);
}

export async function getBindingsByChannel(channelId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(groupChannelBindings)
    .where(eq(groupChannelBindings.channelId, channelId));
}

export async function getAllBindings() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(groupChannelBindings).orderBy(groupChannelBindings.groupId, groupChannelBindings.sortOrder);
}

export async function createBinding(binding: InsertGroupChannelBinding): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(groupChannelBindings).values(binding);
  return Number(result[0].insertId);
}

export async function updateBinding(id: number, binding: Partial<InsertGroupChannelBinding>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(groupChannelBindings).set(binding).where(eq(groupChannelBindings.id, id));
}

export async function deleteBinding(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(groupChannelBindings).where(eq(groupChannelBindings.id, id));
}

export async function deleteBindingsByGroup(groupId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(groupChannelBindings).where(eq(groupChannelBindings.groupId, groupId));
}

export async function deleteBindingsByChannel(channelId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(groupChannelBindings).where(eq(groupChannelBindings.channelId, channelId));
}

/** 检查通道是否已被其他柜组绑定（排除指定groupId） */
export async function checkChannelBindingConflict(channelId: number, excludeGroupId?: number) {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select({ groupId: groupChannelBindings.groupId })
    .from(groupChannelBindings)
    .where(eq(groupChannelBindings.channelId, channelId));
  if (excludeGroupId) {
    return result.some(r => r.groupId !== excludeGroupId);
  }
  return result.length > 0;
}

// ==================== 重量变化记录管理 ====================

export async function createWeightChangeRecord(record: InsertWeightChangeRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(weightChangeRecords).values(record);
}

export async function getWeightChangeRecordsByCabinetGroup(cabinetGroupId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(weightChangeRecords)
    .where(eq(weightChangeRecords.cabinetGroupId, cabinetGroupId))
    .orderBy(desc(weightChangeRecords.recordedAt))
    .limit(limit);
}

export async function getAllWeightChangeRecords(limit = 1000) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(weightChangeRecords)
    .orderBy(desc(weightChangeRecords.recordedAt))
    .limit(limit);
}

export async function getWeightChangeRecordsByDateRange(startDate: Date, endDate: Date) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(weightChangeRecords)
    .where(
      and(
        gte(weightChangeRecords.recordedAt, startDate),
        lte(weightChangeRecords.recordedAt, endDate)
      )
    )
    .orderBy(desc(weightChangeRecords.recordedAt));
}

// ==================== 报警记录管理 ====================

export async function createAlarmRecord(record: InsertAlarmRecord) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(alarmRecords).values(record);
}

export async function getAllAlarmRecords(limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(alarmRecords)
    .orderBy(desc(alarmRecords.createdAt))
    .limit(limit);
}

export async function getUnhandledAlarmRecords() {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(alarmRecords)
    .where(eq(alarmRecords.isHandled, 0))
    .orderBy(desc(alarmRecords.createdAt));
}

export async function handleAlarmRecord(id: number, handledBy: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(alarmRecords).set({ 
    isHandled: 1, 
    handledBy, 
    handledAt: new Date() 
  }).where(eq(alarmRecords.id, id));
}

export async function getAlarmRecordsByCabinetGroup(cabinetGroupId: number, limit = 100) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(alarmRecords)
    .where(eq(alarmRecords.cabinetGroupId, cabinetGroupId))
    .orderBy(desc(alarmRecords.createdAt))
    .limit(limit);
}

// ==================== 保管库布局管理 ====================

export async function getAllVaultLayouts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(vaultLayouts).orderBy(desc(vaultLayouts.createdAt));
}

export async function getVaultLayoutById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vaultLayouts).where(eq(vaultLayouts.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getActiveVaultLayout() {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(vaultLayouts).where(eq(vaultLayouts.isActive, 1)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createVaultLayout(layout: InsertVaultLayout): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(vaultLayouts).values(layout);
  return Number(result[0].insertId);
}

export async function updateVaultLayout(id: number, layout: Partial<InsertVaultLayout>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vaultLayouts).set(layout).where(eq(vaultLayouts.id, id));
}

export async function deleteVaultLayout(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(vaultLayouts).where(eq(vaultLayouts.id, id));
}

export async function setActiveVaultLayout(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(vaultLayouts).set({ isActive: 0 }).where(eq(vaultLayouts.isActive, 1));
  await db.update(vaultLayouts).set({ isActive: 1 }).where(eq(vaultLayouts.id, id));
}

// ==================== 操作审计日志 ====================

export async function createAuditLog(log: InsertAuditLog): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(auditLogs).values(log);
  return Number(result[0].insertId);
}

export async function getAuditLogs(limit = 200) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(auditLogs)
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}

export async function getAuditLogsByTarget(targetType: string, targetId: number, limit = 50) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(auditLogs)
    .where(and(
      eq(auditLogs.targetType, targetType),
      eq(auditLogs.targetId, targetId)
    ))
    .orderBy(desc(auditLogs.createdAt))
    .limit(limit);
}
