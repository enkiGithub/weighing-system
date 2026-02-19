import { eq, desc, and, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { 
  InsertUser, 
  users,
  gateways,
  weighingInstruments,
  cabinetGroups,
  weightChangeRecords,
  alarmRecords,
  InsertGateway,
  InsertWeighingInstrument,
  InsertCabinetGroup,
  InsertWeightChangeRecord,
  InsertAlarmRecord
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

export async function getInstrumentsByGatewayId(gatewayId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select().from(weighingInstruments).where(eq(weighingInstruments.gatewayId, gatewayId));
}

export async function createInstrument(instrument: InsertWeighingInstrument) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(weighingInstruments).values(instrument);
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

export async function createCabinetGroup(group: InsertCabinetGroup) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.insert(cabinetGroups).values(group);
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
