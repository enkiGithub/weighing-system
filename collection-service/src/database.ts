/**
 * 数据库连接和查询模块
 */

import mysql from 'mysql2/promise';
import { createPool } from 'mysql2/promise';

export interface GatewayComPort {
  id: number;
  gatewayId: number;
  portNumber: string;
  ipAddress: string;
  networkPort: number;
  baudRate: number;
  dataBits: number;
  stopBits: number;
  parity: string;
  protocolType: string;
  timeoutMs: number;
  retryCount: number;
  collectionIntervalMs: number;
}

export interface WeighingInstrument {
  id: number;
  deviceCode: string;
  modelType: 'DY7001' | 'DY7004';
  slaveId: number;
  comPortId: number;
  name?: string;
  location?: string;
}

export interface InstrumentChannel {
  id: number;
  instrumentId: number;
  channelNo: number;
  label: string;
  enabled: number;
  scale: number;
  offset: number;
  unit: string;
  precision: number;
}

let pool: mysql.Pool;

export async function initDatabase(connectionUrl: string) {
  pool = createPool({
    uri: connectionUrl,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0,
  });
  
  console.log('[DB] 数据库连接池已初始化');
}

export async function getAllComPorts(): Promise<GatewayComPort[]> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM gatewayComPorts ORDER BY gatewayId, portNumber'
    );
    return rows as GatewayComPort[];
  } finally {
    connection.release();
  }
}

export async function getInstrumentsByComPort(comPortId: number): Promise<WeighingInstrument[]> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM weighingInstruments WHERE comPortId = ? ORDER BY slaveId',
      [comPortId]
    );
    return rows as WeighingInstrument[];
  } finally {
    connection.release();
  }
}

export async function getChannelsByInstrument(instrumentId: number): Promise<InstrumentChannel[]> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT * FROM instrumentChannels WHERE instrumentId = ? AND enabled = 1 ORDER BY channelNo',
      [instrumentId]
    );
    return rows as InstrumentChannel[];
  } finally {
    connection.release();
  }
}

export async function saveCollectionData(
  instrumentId: number,
  channelId: number,
  rawValue: number,
  calibratedValue: number
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      'INSERT INTO collectionData (instrumentId, channelId, rawValue, calibratedValue, collectedAt) VALUES (?, ?, ?, ?, NOW())',
      [instrumentId, channelId, rawValue, calibratedValue]
    );
  } finally {
    connection.release();
  }
}

export async function updateConnectionStatus(
  comPortId: number,
  status: 'online' | 'offline',
  failureReason?: string
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    if (status === 'online') {
      await connection.query(
        'INSERT INTO deviceConnectionStatus (comPortId, status, lastSuccessAt, updatedAt) VALUES (?, ?, NOW(), NOW()) ON DUPLICATE KEY UPDATE status = ?, lastSuccessAt = NOW(), updatedAt = NOW()',
        [comPortId, status, status]
      );
    } else {
      await connection.query(
        'INSERT INTO deviceConnectionStatus (comPortId, status, lastFailureAt, failureReason, updatedAt) VALUES (?, ?, NOW(), ?, NOW()) ON DUPLICATE KEY UPDATE status = ?, lastFailureAt = NOW(), failureReason = ?, updatedAt = NOW()',
        [comPortId, status, failureReason, status, failureReason]
      );
    }
  } finally {
    connection.release();
  }
}

export async function updateInstrumentStatus(
  instrumentId: number,
  status: 'online' | 'offline'
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      'UPDATE weighingInstruments SET status = ?, lastHeartbeat = NOW() WHERE id = ?',
      [status, instrumentId]
    );
  } finally {
    connection.release();
  }
}

export async function updateChannelValue(
  channelId: number,
  value: number
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      'UPDATE instrumentChannels SET currentValue = ?, lastReadAt = NOW() WHERE id = ?',
      [value, channelId]
    );
  } finally {
    connection.release();
  }
}


// ===== 报警处理函数 =====

export interface CabinetGroup {
  id: number;
  name: string;
  currentWeight: number;
  initialWeight: number;
  alarmThreshold: number;
  status: 'normal' | 'warning' | 'alarm';
}

export async function getCabinetGroupById(groupId: number): Promise<CabinetGroup | null> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      'SELECT id, name, currentWeight, initialWeight, alarmThreshold, status FROM cabinetGroups WHERE id = ?',
      [groupId]
    );
    const result = (rows as any[])[0];
    return result || null;
  } finally {
    connection.release();
  }
}

export interface AlarmRecord {
  id: number;
  cabinetGroupId: number;
  alarmType: string;
  calibratedValue: number;
  threshold: number;
  exceedValue: number;
  occurrenceCount: number;
  handlingStatus: 'pending' | 'handled' | 'auto_resolved';
  firstOccurredAt: Date;
  lastOccurredAt: Date;
}

export async function createAlarmRecord(alarm: {
  cabinetGroupId: number;
  alarmType: string;
  calibratedValue: number;
  threshold: number;
  exceedValue: number;
  occurrenceCount?: number;
}): Promise<number> {
  const connection = await pool.getConnection();
  try {
    const [result] = await connection.query(
      `INSERT INTO alarmRecords 
        (cabinetGroupId, alarmType, calibratedValue, threshold, exceedValue, occurrenceCount, handlingStatus, firstOccurredAt, lastOccurredAt, createdAt) 
       VALUES (?, ?, ?, ?, ?, ?, 'pending', NOW(), NOW(), NOW())`,
      [
        alarm.cabinetGroupId,
        alarm.alarmType,
        alarm.calibratedValue,
        alarm.threshold,
        alarm.exceedValue,
        alarm.occurrenceCount || 1,
      ]
    );
    return (result as any).insertId;
  } finally {
    connection.release();
  }
}

export async function getPendingAlarms(): Promise<AlarmRecord[]> {
  const connection = await pool.getConnection();
  try {
    const [rows] = await connection.query(
      `SELECT id, cabinetGroupId, alarmType, calibratedValue, threshold, exceedValue, 
              occurrenceCount, handlingStatus, firstOccurredAt, lastOccurredAt 
       FROM alarmRecords WHERE handlingStatus = 'pending'`
    );
    return rows as AlarmRecord[];
  } finally {
    connection.release();
  }
}

export async function updateAlarmHandlingStatus(
  alarmId: number,
  handlingStatus: 'handled' | 'auto_resolved'
): Promise<void> {
  const connection = await pool.getConnection();
  try {
    await connection.query(
      'UPDATE alarmRecords SET handlingStatus = ?, updatedAt = NOW() WHERE id = ?',
      [handlingStatus, alarmId]
    );
  } finally {
    connection.release();
  }
}
