"use client";

import { useEffect, useRef, useState } from "react";

interface AlarmSoundProps {
  enabled: boolean;
  alarmCount: number;
}

export function AlarmSound({ enabled, alarmCount }: AlarmSoundProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const lastAlarmCountRef = useRef(0);

  useEffect(() => {
    // 当报警数量增加且声音启用时，播放声音
    if (enabled && alarmCount > lastAlarmCountRef.current && audioRef.current) {
      audioRef.current.currentTime = 0;
      audioRef.current.play().catch(() => {
        // 浏览器可能阻止自动播放，忽略错误
      });
    }
    lastAlarmCountRef.current = alarmCount;
  }, [enabled, alarmCount]);

  return (
    <audio
      ref={audioRef}
      src="data:audio/wav;base64,UklGRiYAAABXQVZFZm10IBAAAAABAAEAQB8AAAB9AAACABAAZGF0YQIAAAAAAA=="
      preload="auto"
    />
  );
}
