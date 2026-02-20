import { eq, desc, and, gte, lte, inArray, sql } from "drizzle-orm";
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
  userPermissions,
  InsertUserPermission,
} from "../drizzle/schema";
import { ENV } from './_core/env';
import bcrypt from 'bcryptjs';

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

// ==================== 用户管理（本地账户体系） ====================

const BCRYPT_SALT_ROUNDS = 10;

/** 根据用户名查找用户 */
export async function getUserByUsername(username: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.username, username)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

/** 验证用户密码 */
export async function verifyPassword(plainPassword: string, passwordHash: string): Promise<boolean> {
  return bcrypt.compare(plainPassword, passwordHash);
}

/** 哈希密码 */
export async function hashPassword(plainPassword: string): Promise<string> {
  return bcrypt.hash(plainPassword, BCRYPT_SALT_ROUNDS);
}

/** 创建用户（本地账户） */
export async function createUser(data: { username: string; password: string; name?: string; role?: 'admin' | 'operator' }): Promise<number> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const passwordHash = await hashPassword(data.password);
  const result = await db.insert(users).values({
    username: data.username,
    passwordHash,
    name: data.name || data.username,
    role: data.role || 'operator',
  });
  return result[0].insertId;
}

/** 更新用户密码 */
export async function updateUserPassword(id: number, newPassword: string): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const passwordHash = await hashPassword(newPassword);
  await db.update(users).set({ passwordHash }).where(eq(users.id, id));
}

/** 更新用户信息 */
export async function updateUser(id: number, data: { username?: string; name?: string; role?: 'admin' | 'operator' }): Promise<void> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const updateSet: Record<string, unknown> = {};
  if (data.username !== undefined) updateSet.username = data.username;
  if (data.name !== undefined) updateSet.name = data.name;
  if (data.role !== undefined) updateSet.role = data.role;
  if (Object.keys(updateSet).length > 0) {
    await db.update(users).set(updateSet).where(eq(users.id, id));
  }
}

/** 更新最后登录时间 */
export async function updateLastSignedIn(id: number): Promise<void> {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ lastSignedIn: new Date() }).where(eq(users.id, id));
}

/** 检查用户名是否已存在 */
export async function checkUsernameConflict(username: string, excludeId?: number): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const conditions = [eq(users.username, username)];
  if (excludeId) {
    conditions.push(sql`${users.id} != ${excludeId}`);
  }
  const result = await db.select({ id: users.id }).from(users).where(and(...conditions)).limit(1);
  return result.length > 0;
}

/** 初始化默认管理员账户（如果不存在） */
export async function ensureDefaultAdmin(): Promise<void> {
  const db = await getDb();
  if (!db) return;
  const existing = await getUserByUsername('admin');
  if (!existing) {
    console.log('[Auth] Creating default admin account (username: admin, password: admin123)');
    await createUser({ username: 'admin', password: 'admin123', name: '管理员', role: 'admin' });
  }
}

export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  // 不返回passwordHash字段
  return await db.select({
    id: users.id,
    username: users.username,
    name: users.name,
    role: users.role,
    createdAt: users.createdAt,
    updatedAt: users.updatedAt,
    lastSignedIn: users.lastSignedIn,
  }).from(users).orderBy(desc(users.createdAt));
}

export async function getUserById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function updateUserRole(id: number, role: 'admin' | 'operator') {
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

export async function getAllComPorts() {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(gatewayComPorts)
    .orderBy(desc(gatewayComPorts.createdAt));
}

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

/** 根据柜组ID获取关联的仪表和通道信息（通过通道绑定反查） */
export async function getGroupBoundInstruments(groupId: number) {
  const db = await getDb();
  if (!db) return [];
  // 获取柜组绑定的所有通道
  const bindings = await db.select()
    .from(groupChannelBindings)
    .where(eq(groupChannelBindings.groupId, groupId));
  if (bindings.length === 0) return [];
  
  // 获取所有绑定的通道信息
  const channelIds = bindings.map(b => b.channelId);
  const channels = await db.select()
    .from(instrumentChannels)
    .where(inArray(instrumentChannels.id, channelIds));
  
  // 获取关联的仪表
  const instrumentIds = Array.from(new Set(channels.map(c => c.instrumentId)));
  if (instrumentIds.length === 0) return [];
  const instruments = await db.select()
    .from(weighingInstruments)
    .where(inArray(weighingInstruments.id, instrumentIds));
  
  // 组装树形结构：仪表 -> 通道
  return instruments.map(inst => ({
    ...inst,
    channels: channels
      .filter(ch => ch.instrumentId === inst.id)
      .map(ch => {
        const binding = bindings.find(b => b.channelId === ch.id);
        return {
          ...ch,
          coefficient: binding?.coefficient ?? 1,
          offset: binding?.offset ?? 0,
          bindingEnabled: binding?.enabled ?? 1,
        };
      }),
  }));
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

// ==================== 用户权限管理 ====================

/** 系统模块列表 */
export const SYSTEM_MODULES = [
  { id: 'dashboard', name: '实时监视' },
  { id: 'gateway_config', name: '网关配置' },
  { id: 'instrument_config', name: '仪表配置' },
  { id: 'cabinet_group', name: '保险柜组' },
  { id: 'data_records', name: '数据记录' },
  { id: 'alarm_management', name: '报警管理' },
  { id: 'data_analysis', name: '数据分析' },
  { id: 'audit_logs', name: '审计日志' },
  { id: 'user_management', name: '用户管理' },
  { id: 'layout_editor', name: '布局编辑器' },
] as const;

export async function getUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return await db.select()
    .from(userPermissions)
    .where(eq(userPermissions.userId, userId));
}

export async function setUserPermissions(userId: number, permissions: { module: string; canView: number; canOperate: number }[]) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // 删除旧权限
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
  // 插入新权限
  if (permissions.length > 0) {
    await db.insert(userPermissions).values(
      permissions.map(p => ({
        userId,
        module: p.module,
        canView: p.canView,
        canOperate: p.canOperate,
      }))
    );
  }
}

export async function checkUserPermission(userId: number, module: string, action: 'view' | 'operate'): Promise<boolean> {
  const db = await getDb();
  if (!db) return false;
  const result = await db.select()
    .from(userPermissions)
    .where(and(
      eq(userPermissions.userId, userId),
      eq(userPermissions.module, module)
    ))
    .limit(1);
  if (result.length === 0) return false;
  return action === 'view' ? result[0].canView === 1 : result[0].canOperate === 1;
}

export async function deleteUserPermissions(userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userPermissions).where(eq(userPermissions.userId, userId));
}
