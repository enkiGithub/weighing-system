/**
 * 报警处理模块
 * 负责：
 * 1. 报警去重（相同柜组的重复报警抑制）
 * 2. 报警自动解除（重量恢复正常时自动解除）
 */

import * as db from './database.js';

interface AlarmState {
  cabinetGroupId: number;
  alarmType: string;
  lastAlarmTime: number;
  occurrenceCount: number;
  isActive: boolean;
}

export class AlarmHandler {
  private alarmStates: Map<string, AlarmState> = new Map();
  private readonly DEDUP_INTERVAL = 30000; // 30秒内的重复报警抑制
  private readonly AUTO_RESOLVE_CHECK_INTERVAL = 5000; // 每5秒检查一次是否需要自动解除

  constructor() {
    // 定期检查是否需要自动解除报警
    setInterval(() => {
      this.checkAutoResolveAlarms().catch(err => {
        console.error('[AlarmHandler] 自动解除检查失败:', err);
      });
    }, this.AUTO_RESOLVE_CHECK_INTERVAL);
  }

  /**
   * 检查并处理报警
   * @param cabinetGroupId 柜组ID
   * @param calibratedValue 校准后的当前值（kg）
   * @param threshold 报警阈值（kg）
   * @param alarmType 报警类型
   * @returns 是否需要创建新报警
   */
  async checkAndHandleAlarm(
    cabinetGroupId: number,
    calibratedValue: number,
    threshold: number,
    alarmType: 'overweight' | 'underweight'
  ): Promise<boolean> {
    const key = `${cabinetGroupId}_${alarmType}`;
    const now = Date.now();

    // 获取柜组信息
    const group = await db.getCabinetGroupById(cabinetGroupId);
    if (!group) {
      console.warn(`[AlarmHandler] 柜组 #${cabinetGroupId} 不存在`);
      return false;
    }

    // 检查是否应该触发报警（比较变化量与阈值）
    const changeValue = Math.abs(calibratedValue - group.initialWeight);
    const shouldAlarm = changeValue > threshold;

    if (!shouldAlarm) {
      // 重量已恢复正常，清除报警状态
      if (this.alarmStates.has(key)) {
        this.alarmStates.delete(key);
      }
      return false;
    }

    // 获取或创建报警状态
    let alarmState = this.alarmStates.get(key);
    if (!alarmState) {
      alarmState = {
        cabinetGroupId,
        alarmType,
        lastAlarmTime: now,
        occurrenceCount: 1,
        isActive: false,
      };
      this.alarmStates.set(key, alarmState);
    }

    // 检查是否在去重间隔内
    const timeSinceLastAlarm = now - alarmState.lastAlarmTime;
    if (timeSinceLastAlarm < this.DEDUP_INTERVAL) {
      // 在去重间隔内，增加计数但不创建新报警
      alarmState.occurrenceCount++;
      console.log(
        `[AlarmHandler] 报警去重: 柜组 #${cabinetGroupId} ${alarmType} ` +
        `(${alarmState.occurrenceCount}次, ${timeSinceLastAlarm}ms)`
      );
      return false;
    }

    // 超过去重间隔，创建新报警
    alarmState.lastAlarmTime = now;
    alarmState.occurrenceCount = 1;
    alarmState.isActive = true;

    console.log(`[AlarmHandler] 创建新报警: 柜组 #${cabinetGroupId} ${alarmType}`);
    return true;
  }

  /**
   * 创建报警记录
   * @param cabinetGroupId 柜组ID
   * @param calibratedValue 校准后的当前值（kg）
   * @param threshold 报警阈值（kg）
   * @param alarmType 报警类型
   */
  async createAlarm(
    cabinetGroupId: number,
    calibratedValue: number,
    threshold: number,
    alarmType: 'overweight' | 'underweight'
  ): Promise<void> {
    try {
      const group = await db.getCabinetGroupById(cabinetGroupId);
      const exceedValue = group
        ? Math.abs(calibratedValue - group.initialWeight) - threshold
        : 0;

      await db.createAlarmRecord({
        cabinetGroupId,
        alarmType,
        calibratedValue,
        threshold,
        exceedValue: Math.max(0, exceedValue),
        occurrenceCount: 1,
      });

      console.log(`[AlarmHandler] 报警记录已创建: 柜组 #${cabinetGroupId}`);
    } catch (err) {
      console.error(`[AlarmHandler] 创建报警记录失败:`, err);
    }
  }

  /**
   * 检查并自动解除已解决的报警
   */
  private async checkAutoResolveAlarms(): Promise<void> {
    try {
      // 获取所有待处理报警
      const pendingAlarms = await db.getPendingAlarms();

      for (const alarm of pendingAlarms) {
        // 获取柜组当前重量
        const group = await db.getCabinetGroupById(alarm.cabinetGroupId);
        if (!group) continue;

        // 检查是否已恢复正常（变化量小于阈值）
        const changeValue = Math.abs(group.currentWeight - group.initialWeight);
        const isResolved = changeValue <= alarm.threshold;

        if (isResolved) {
          // 自动解除报警
          await db.updateAlarmHandlingStatus(alarm.id, 'auto_resolved');
          console.log(
            `[AlarmHandler] 自动解除报警: 柜组 #${alarm.cabinetGroupId} ` +
            `(当前: ${group.currentWeight.toFixed(2)}kg, 阈值: ${alarm.threshold.toFixed(2)}kg)`
          );
        }
      }
    } catch (err) {
      console.error('[AlarmHandler] 自动解除检查失败:', err);
    }
  }

  /**
   * 获取报警状态统计
   */
  getAlarmStats(): { activeAlarms: number; totalOccurrences: number } {
    let activeAlarms = 0;
    let totalOccurrences = 0;

    for (const state of this.alarmStates.values()) {
      if (state.isActive) {
        activeAlarms++;
        totalOccurrences += state.occurrenceCount;
      }
    }

    return { activeAlarms, totalOccurrences };
  }
}
