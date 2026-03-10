"use client";

import { useEffect, useRef, useCallback } from "react";

interface AlarmSoundProps {
  enabled: boolean;
  alarmCount: number;
}

/**
 * 报警声音组件
 * 使用 Web Audio API 生成报警蜂鸣声
 * 当报警数量增加时播放声音
 */
export function AlarmSound({ enabled, alarmCount }: AlarmSoundProps) {
  const lastAlarmCountRef = useRef(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  const playAlarmBeep = useCallback(() => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      const ctx = audioContextRef.current;
      if (ctx.state === 'suspended') {
        ctx.resume();
      }

      // 播放三声短促蜂鸣
      const beepDuration = 0.15;
      const gapDuration = 0.1;
      const frequency = 880; // A5 音符

      for (let i = 0; i < 3; i++) {
        const startTime = ctx.currentTime + i * (beepDuration + gapDuration);

        const oscillator = ctx.createOscillator();
        const gainNode = ctx.createGain();

        oscillator.type = 'square';
        oscillator.frequency.setValueAtTime(frequency, startTime);

        gainNode.gain.setValueAtTime(0, startTime);
        gainNode.gain.linearRampToValueAtTime(0.3, startTime + 0.01);
        gainNode.gain.setValueAtTime(0.3, startTime + beepDuration - 0.01);
        gainNode.gain.linearRampToValueAtTime(0, startTime + beepDuration);

        oscillator.connect(gainNode);
        gainNode.connect(ctx.destination);

        oscillator.start(startTime);
        oscillator.stop(startTime + beepDuration);
      }
    } catch {
      // 浏览器可能阻止自动播放，忽略错误
    }
  }, []);

  useEffect(() => {
    // 当报警数量增加且声音启用时，播放声音
    if (enabled && alarmCount > lastAlarmCountRef.current) {
      playAlarmBeep();
    }
    lastAlarmCountRef.current = alarmCount;
  }, [enabled, alarmCount, playAlarmBeep]);

  // 清理 AudioContext
  useEffect(() => {
    return () => {
      if (audioContextRef.current) {
        audioContextRef.current.close().catch(() => {});
      }
    };
  }, []);

  return null; // 不需要渲染任何DOM元素
}
