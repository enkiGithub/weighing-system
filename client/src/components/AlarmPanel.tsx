"use client";

import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { X, CheckCircle2, Eye, Volume2, VolumeX } from "lucide-react";

interface AlarmPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onAlarmSoundToggle: (enabled: boolean) => void;
  alarmSoundEnabled: boolean;
}

export function AlarmPanel({
  isOpen,
  onClose,
  onAlarmSoundToggle,
  alarmSoundEnabled,
}: AlarmPanelProps) {
  const [alarms, setAlarms] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // 查询未处理报警
  const alarmsQuery = trpc.alarms.list.useQuery(
    { handlingStatus: "pending", limit: 50 },
    { enabled: isOpen, refetchInterval: 3000 }
  );

  // 报警确认mutation
  const confirmAlarmMutation = trpc.alarms.confirm.useMutation({
    onSuccess: () => {
      alarmsQuery.refetch();
    },
  });

  // 报警忽略mutation
  const ignoreAlarmMutation = trpc.alarms.ignore.useMutation({
    onSuccess: () => {
      alarmsQuery.refetch();
    },
  });

  useEffect(() => {
    setAlarms(alarmsQuery.data || []);
  }, [alarmsQuery.data]);

  const handleConfirm = async (alarmId: number) => {
    setIsLoading(true);
    try {
      await confirmAlarmMutation.mutateAsync({ alarmId });
    } finally {
      setIsLoading(false);
    }
  };

  const handleIgnore = async (alarmId: number) => {
    setIsLoading(false);
    try {
      await ignoreAlarmMutation.mutateAsync({ alarmId });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className={`fixed right-0 top-0 h-full w-96 bg-slate-900/95 border-l border-slate-700/50 backdrop-blur-md shadow-2xl transition-transform duration-300 z-40 flex flex-col ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-700/50 shrink-0">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-semibold text-slate-200">报警管理</h2>
          <Badge variant="secondary" className="bg-red-500/20 text-red-400 border-red-500/50">
            {alarms.length}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onAlarmSoundToggle(!alarmSoundEnabled)}
            className="h-8 w-8 p-0"
          >
            {alarmSoundEnabled ? (
              <Volume2 className="h-4 w-4 text-cyan-400" />
            ) : (
              <VolumeX className="h-4 w-4 text-slate-500" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && (
          <div className="text-center text-sm text-slate-400">处理中...</div>
        )}

        {alarms.length === 0 ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-12 w-12 text-green-500/30 mx-auto mb-2" />
            <p className="text-sm text-slate-400">暂无报警</p>
          </div>
        ) : (
          alarms.map((alarm) => (
            <Card
              key={alarm.id}
              className="bg-slate-800/50 border-slate-700/50 hover:border-red-500/30 transition-colors"
            >
              <CardContent className="p-3 space-y-2">
                {/* 报警信息 */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-slate-200 truncate">
                      {alarm.cabinetGroupName || `柜组 #${alarm.cabinetGroupId}`}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      {alarm.alarmType === "overweight" ? "超重报警" : "其他报警"}
                    </div>
                  </div>
                  <Badge
                    variant="destructive"
                    className="bg-red-500/20 text-red-400 border-red-500/50 shrink-0"
                  >
                    {alarm.occurrenceCount || 1}次
                  </Badge>
                </div>

                {/* 报警详情 */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-slate-500">当前重量</div>
                    <div className="font-semibold text-slate-300">
                      {(alarm.currentValue / 1000).toFixed(2)} kg
                    </div>
                  </div>
                  <div className="bg-slate-900/50 rounded p-2">
                    <div className="text-slate-500">阈值</div>
                    <div className="font-semibold text-amber-400">
                      {(alarm.thresholdValue / 1000).toFixed(2)} kg
                    </div>
                  </div>
                </div>

                {/* 时间 */}
                <div className="text-xs text-slate-500 border-t border-slate-700/50 pt-2">
                  {alarm.lastOccurredAt
                    ? new Date(alarm.lastOccurredAt).toLocaleString()
                    : "未知时间"}
                </div>

                {/* 操作按钮 */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    onClick={() => handleConfirm(alarm.id)}
                    disabled={isLoading}
                  >
                    <CheckCircle2 className="h-3 w-3 mr-1" />
                    确认
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 h-7 text-xs"
                    onClick={() => handleIgnore(alarm.id)}
                    disabled={isLoading}
                  >
                    <Eye className="h-3 w-3 mr-1" />
                    忽略
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}
