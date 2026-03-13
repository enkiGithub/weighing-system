/**
 * 数据自动清理定时任务
 * 每小时检查一次，在配置的清理时间执行清理
 */
import * as db from './db';

let cleanupTimer: NodeJS.Timeout | null = null;
let lastCleanupDate: string | null = null;

/**
 * 启动自动清理定时任务
 * 每小时检查一次是否需要执行清理
 */
export function startAutoCleanup() {
  if (cleanupTimer) return;

  console.log('[DataCleanup] 自动清理任务已启动，每小时检查一次');

  // 每小时检查一次
  cleanupTimer = setInterval(async () => {
    try {
      await checkAndRunCleanup();
    } catch (err: any) {
      console.error('[DataCleanup] 检查清理任务失败:', err.message);
    }
  }, 60 * 60 * 1000); // 1小时

  // 启动后立即检查一次
  setTimeout(() => checkAndRunCleanup().catch(console.error), 10000);
}

/**
 * 停止自动清理定时任务
 */
export function stopAutoCleanup() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
    console.log('[DataCleanup] 自动清理任务已停止');
  }
}

/**
 * 检查是否需要执行清理，并在满足条件时执行
 */
async function checkAndRunCleanup() {
  // 检查是否启用自动清理
  const enabled = await db.getSystemSetting('autoCleanupEnabled');
  if (enabled !== 'true') return;

  // 检查当前小时是否为配置的清理时间
  const cleanupHour = parseInt(await db.getSystemSetting('autoCleanupHour') || '3');
  const now = new Date();
  const currentHour = now.getHours();
  const today = now.toISOString().slice(0, 10); // YYYY-MM-DD

  // 只在配置的小时执行，且每天只执行一次
  if (currentHour !== cleanupHour) return;
  if (lastCleanupDate === today) return;

  lastCleanupDate = today;
  console.log(`[DataCleanup] 开始执行自动清理任务 (${today} ${cleanupHour}:00)`);

  await executeFullCleanup();
}

/**
 * 执行完整的数据清理
 */
export async function executeFullCleanup() {
  const startTime = Date.now();
  const results: string[] = [];

  try {
    // 获取清理配置
    const settings = await db.getAllSystemSettings();
    const config: Record<string, string> = {};
    for (const s of settings) config[s.settingKey] = s.settingValue;

    // 1. 清理采集数据（按时间 + 按最大行数双重保护）
    const cdRetention = parseInt(config['collectionData_retentionDays'] || '30');
    const cdMaxRows = parseInt(config['collectionData_maxRows'] || '5000000');
    const cdCutoff = new Date(Date.now() - cdRetention * 24 * 60 * 60 * 1000);
    await db.purgeCollectionData(cdCutoff);
    await db.trimCollectionData(cdMaxRows);
    results.push(`采集数据: 清理${cdRetention}天前 + 上限${cdMaxRows}条`);

    // 2. 清理重量变化记录（按时间 + 按最大行数双重保护）
    const wcrRetention = parseInt(config['weightChangeRecords_retentionDays'] || '365');
    const wcrMaxRows = parseInt(config['weightChangeRecords_maxRows'] || '2000000');
    const wcrCutoff = new Date(Date.now() - wcrRetention * 24 * 60 * 60 * 1000);
    await db.purgeWeightChangeRecords(wcrCutoff);
    await db.trimWeightChangeRecords(wcrMaxRows);
    results.push(`重量记录: 清理${wcrRetention}天前 + 上限${wcrMaxRows}条`);

    // 3. 清理已处理的报警记录（按时间）
    const arRetention = parseInt(config['alarmRecords_retentionDays'] || '365');
    const arCutoff = new Date(Date.now() - arRetention * 24 * 60 * 60 * 1000);
    const arCount = await db.purgeAlarmRecords(arCutoff);
    results.push(`报警记录: 清理${arRetention}天前已处理记录(${arCount}条)`);

    // 4. 清理审计日志（按时间）
    const alRetention = parseInt(config['auditLogs_retentionDays'] || '365');
    const alCutoff = new Date(Date.now() - alRetention * 24 * 60 * 60 * 1000);
    await db.purgeAuditLogs(alCutoff);
    results.push(`审计日志: 清理${alRetention}天前`);

    const elapsed = Date.now() - startTime;
    console.log(`[DataCleanup] 自动清理完成 (耗时${elapsed}ms):\n  ${results.join('\n  ')}`);

    // 获取清理后的统计
    const stats = await db.getTableRowCounts();
    console.log(`[DataCleanup] 清理后记录数: collectionData=${stats.collectionData}, weightChangeRecords=${stats.weightChangeRecords}, alarmRecords=${stats.alarmRecords}, auditLogs=${stats.auditLogs}`);

  } catch (err: any) {
    console.error('[DataCleanup] 自动清理执行失败:', err.message);
  }
}
