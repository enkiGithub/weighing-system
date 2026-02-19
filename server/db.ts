import { eq, desc, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  gateways,
  gatewayComPorts,
  weighingInstruments,
  cabinetGroups,
  cabinetGroupGatewayBindings,
  cabinetGroupSensorBindings,
  weightChangeRecords,
  alarmRecords,
  cabinets,
  vaultLayouts,
  cabinetGroupLayouts,
  InsertGateway,
  InsertGatewayComPort,
  InsertWeighingInstrument,
  InsertCabinetGroup,
  InsertCabinetGroupGatewayBinding,
  InsertCabinetGroupSensorBinding,
  InsertWeightChangeRecord,
  InsertAlarmRecord,
  InsertCabinet,
  InsertVaultLayout,
  InsertCabinetGroupLayout
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

// 用户管理
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

// 网关管理
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

// 称重仪表管理
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
  return await db.select().from(weighingInstruments).where(eq(weighingInstruments.gatewayComPortId, comPortId));
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

// 保险柜组管理
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

// 重量变化记录管理
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

// 报警记录管理
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

// 柜子管理
export async function getAllCabinets() {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(cabinets).orderBy(desc(cabinets.createdAt));
}

export async function getCabinetById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(cabinets).where(eq(cabinets.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function createCabinet(cabinet: InsertCabinet): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cabinets).values(cabinet);
  return Number(result[0].insertId);
}

export async function updateCabinet(id: number, cabinet: Partial<InsertCabinet>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cabinets).set(cabinet).where(eq(cabinets.id, id));
}

export async function deleteCabinet(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cabinets).where(eq(cabinets.id, id));
}

// 保管库布局管理
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
  // 先取消所有激活的布局
  await db.update(vaultLayouts).set({ isActive: 0 }).where(eq(vaultLayouts.isActive, 1));
  // 激活指定布局
  await db.update(vaultLayouts).set({ isActive: 1 }).where(eq(vaultLayouts.id, id));
}

// 柜组布局管理
export async function getCabinetGroupLayoutsByVaultLayout(vaultLayoutId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(cabinetGroupLayouts)
    .where(eq(cabinetGroupLayouts.vaultLayoutId, vaultLayoutId))
    .orderBy(desc(cabinetGroupLayouts.createdAt));
}

export async function createCabinetGroupLayout(layout: InsertCabinetGroupLayout): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cabinetGroupLayouts).values(layout);
  return Number(result[0].insertId);
}

export async function updateCabinetGroupLayout(id: number, layout: Partial<InsertCabinetGroupLayout>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(cabinetGroupLayouts).set(layout).where(eq(cabinetGroupLayouts.id, id));
}

export async function deleteCabinetGroupLayout(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cabinetGroupLayouts).where(eq(cabinetGroupLayouts.id, id));
}

export async function deleteCabinetGroupLayoutsByVaultLayout(vaultLayoutId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cabinetGroupLayouts).where(eq(cabinetGroupLayouts.vaultLayoutId, vaultLayoutId));
}


// 网关COM端口管理
export async function getComPortsByGateway(gatewayId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(gatewayComPorts)
    .where(eq(gatewayComPorts.gatewayId, gatewayId))
    .orderBy(desc(gatewayComPorts.createdAt));
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

// 柜组网关绑定管理
export async function setGatewayBinding(cabinetGroupId: number, gatewayComPortId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  
  // 检查是否已存在绑定
  const existing = await db.select()
    .from(cabinetGroupGatewayBindings)
    .where(eq(cabinetGroupGatewayBindings.cabinetGroupId, cabinetGroupId))
    .limit(1);
  
  if (existing.length > 0) {
    // 更新现有绑定
    await db.update(cabinetGroupGatewayBindings)
      .set({ gatewayComPortId })
      .where(eq(cabinetGroupGatewayBindings.cabinetGroupId, cabinetGroupId));
  } else {
    // 创建新绑定
    await db.insert(cabinetGroupGatewayBindings).values({
      cabinetGroupId,
      gatewayComPortId,
    });
  }
}

export async function getGatewayBinding(cabinetGroupId: number) {
  const db = await getDb();
  if (!db) return null;
  const result = await db.select()
    .from(cabinetGroupGatewayBindings)
    .where(eq(cabinetGroupGatewayBindings.cabinetGroupId, cabinetGroupId))
    .limit(1);
  return result.length > 0 ? result[0] : null;
}

// 柜组传感器绑定管理
export async function addSensorBinding(binding: InsertCabinetGroupSensorBinding): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(cabinetGroupSensorBindings).values(binding);
  return Number(result[0].insertId);
}

export async function getSensorBindings(cabinetGroupId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(cabinetGroupSensorBindings)
    .where(eq(cabinetGroupSensorBindings.cabinetGroupId, cabinetGroupId))
    .orderBy(desc(cabinetGroupSensorBindings.createdAt));
}

export async function removeSensorBinding(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(cabinetGroupSensorBindings).where(eq(cabinetGroupSensorBindings.id, id));
}
