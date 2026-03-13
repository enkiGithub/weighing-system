import { useState, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Loader2, Database, Trash2, Clock, HardDrive, RefreshCw, Shield, Settings2 } from "lucide-react";

export default function SystemSettings() {
  const { data: config, isLoading: configLoading } = trpc.systemSettings.getCleanupConfig.useQuery();
  const { data: stats, isLoading: statsLoading, refetch: refetchStats } = trpc.systemSettings.getTableStats.useQuery();
  const utils = trpc.useUtils();

  const updateConfig = trpc.systemSettings.updateCleanupConfig.useMutation({
    onSuccess: () => {
      toast.success("清理配置已保存");
      utils.systemSettings.getCleanupConfig.invalidate();
    },
    onError: (err) => toast.error(`保存失败: ${err.message}`),
  });

  const executeCleanup = trpc.systemSettings.executeCleanup.useMutation({
    onSuccess: (results) => {
      const msgs = Object.entries(results).map(([k, v]) => `${tableLabels[k] || k}: ${v}`);
      toast.success(`清理完成\n${msgs.join('\n')}`);
      refetchStats();
    },
    onError: (err) => toast.error(`清理失败: ${err.message}`),
  });

  // 表单状态
  const [form, setForm] = useState({
    collectionData_retentionDays: 30,
    collectionData_maxRows: 5000000,
    weightChangeRecords_retentionDays: 365,
    weightChangeRecords_maxRows: 2000000,
    alarmRecords_retentionDays: 365,
    auditLogs_retentionDays: 365,
    autoCleanupEnabled: false,
    autoCleanupHour: 3,
  });

  useEffect(() => {
    if (config) {
      setForm(config);
    }
  }, [config]);

  const tableLabels: Record<string, string> = {
    collectionData: "采集数据",
    weightChangeRecords: "重量变化记录",
    alarmRecords: "报警记录",
    alarmLogs: "报警处理日志",
    auditLogs: "审计日志",
  };

  const formatNumber = (n: number) => n.toLocaleString('zh-CN');

  const getRowCountBadge = (count: number, warnAt: number, dangerAt: number) => {
    if (count >= dangerAt) return <Badge variant="destructive">{formatNumber(count)}</Badge>;
    if (count >= warnAt) return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{formatNumber(count)}</Badge>;
    return <Badge variant="secondary">{formatNumber(count)}</Badge>;
  };

  const handleSave = () => {
    updateConfig.mutate(form);
  };

  const handleCleanup = (tables: string[], mode: 'byTime' | 'byMaxRows') => {
    executeCleanup.mutate({
      tables: tables as any,
      mode,
    });
  };

  if (configLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">系统设置</h1>
        <p className="text-muted-foreground mt-2">数据库维护与自动清理配置</p>
      </div>

      {/* 数据库统计 */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <HardDrive className="h-5 w-5 text-primary" />
              <CardTitle>数据库记录统计</CardTitle>
            </div>
            <Button variant="outline" size="sm" onClick={() => refetchStats()} disabled={statsLoading}>
              <RefreshCw className={`h-4 w-4 mr-1 ${statsLoading ? 'animate-spin' : ''}`} />
              刷新
            </Button>
          </div>
          <CardDescription>各数据表当前记录数量，红色表示需要清理</CardDescription>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="flex items-center justify-center py-4">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : stats ? (
            <div className="grid gap-4 md:grid-cols-5">
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-sm text-muted-foreground">采集数据</div>
                <div className="text-xl font-bold">{getRowCountBadge(stats.collectionData, 1000000, 5000000)}</div>
                <div className="text-xs text-muted-foreground">增长最快</div>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-sm text-muted-foreground">重量变化记录</div>
                <div className="text-xl font-bold">{getRowCountBadge(stats.weightChangeRecords, 500000, 2000000)}</div>
                <div className="text-xs text-muted-foreground">每5秒/柜组</div>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-sm text-muted-foreground">报警记录</div>
                <div className="text-xl font-bold">{getRowCountBadge(stats.alarmRecords, 10000, 100000)}</div>
                <div className="text-xs text-muted-foreground">报警触发时</div>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-sm text-muted-foreground">报警处理日志</div>
                <div className="text-xl font-bold">{getRowCountBadge(stats.alarmLogs, 10000, 100000)}</div>
                <div className="text-xs text-muted-foreground">处理时写入</div>
              </div>
              <div className="rounded-lg border border-border p-4 space-y-2">
                <div className="text-sm text-muted-foreground">审计日志</div>
                <div className="text-xl font-bold">{getRowCountBadge(stats.auditLogs, 50000, 200000)}</div>
                <div className="text-xs text-muted-foreground">操作时写入</div>
              </div>
            </div>
          ) : null}
        </CardContent>
      </Card>

      {/* 自动清理配置 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Settings2 className="h-5 w-5 text-primary" />
            <CardTitle>自动清理配置</CardTitle>
          </div>
          <CardDescription>配置数据保留期限和最大记录数，系统将在指定时间自动执行清理</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 自动清理开关 */}
          <div className="flex items-center justify-between rounded-lg border border-border p-4">
            <div className="space-y-0.5">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <Label className="text-base font-medium">启用自动清理</Label>
              </div>
              <p className="text-sm text-muted-foreground">
                启用后，系统将每天在指定时间自动清理过期数据
              </p>
            </div>
            <Switch
              checked={form.autoCleanupEnabled}
              onCheckedChange={(checked) => setForm(f => ({ ...f, autoCleanupEnabled: checked }))}
            />
          </div>

          {/* 清理执行时间 */}
          <div className="flex items-center gap-4">
            <Label className="min-w-[100px]">清理执行时间</Label>
            <Select
              value={String(form.autoCleanupHour)}
              onValueChange={(v) => setForm(f => ({ ...f, autoCleanupHour: parseInt(v) }))}
            >
              <SelectTrigger className="w-40">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Array.from({ length: 24 }, (_, i) => (
                  <SelectItem key={i} value={String(i)}>
                    {String(i).padStart(2, '0')}:00
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <span className="text-sm text-muted-foreground">建议选择凌晨低峰时段</span>
          </div>

          <Separator />

          {/* 采集数据配置 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              采集数据 (collectionData)
              <Badge variant="destructive" className="text-xs">增长最快</Badge>
            </h3>
            <p className="text-sm text-muted-foreground">
              每500ms每通道写入一条，4通道约69万条/天。建议保留期限不超过30天。
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>保留天数</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={form.collectionData_retentionDays}
                    onChange={(e) => setForm(f => ({ ...f, collectionData_retentionDays: parseInt(e.target.value) || 30 }))}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">天</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>最大记录数上限</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10000}
                    max={100000000}
                    value={form.collectionData_maxRows}
                    onChange={(e) => setForm(f => ({ ...f, collectionData_maxRows: parseInt(e.target.value) || 5000000 }))}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">条</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 重量变化记录配置 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              重量变化记录 (weightChangeRecords)
            </h3>
            <p className="text-sm text-muted-foreground">
              每5秒每柜组写入一条（有变化时），建议保留1年。
            </p>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label>保留天数</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={1}
                    max={3650}
                    value={form.weightChangeRecords_retentionDays}
                    onChange={(e) => setForm(f => ({ ...f, weightChangeRecords_retentionDays: parseInt(e.target.value) || 365 }))}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">天</span>
                </div>
              </div>
              <div className="space-y-2">
                <Label>最大记录数上限</Label>
                <div className="flex items-center gap-2">
                  <Input
                    type="number"
                    min={10000}
                    max={100000000}
                    value={form.weightChangeRecords_maxRows}
                    onChange={(e) => setForm(f => ({ ...f, weightChangeRecords_maxRows: parseInt(e.target.value) || 2000000 }))}
                  />
                  <span className="text-sm text-muted-foreground whitespace-nowrap">条</span>
                </div>
              </div>
            </div>
          </div>

          <Separator />

          {/* 报警记录配置 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              报警记录 (alarmRecords + alarmLogs)
            </h3>
            <p className="text-sm text-muted-foreground">
              仅清理已处理/自动解除的报警记录及关联日志，未处理的报警不会被清理。
            </p>
            <div className="space-y-2">
              <Label>保留天数</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={form.alarmRecords_retentionDays}
                  onChange={(e) => setForm(f => ({ ...f, alarmRecords_retentionDays: parseInt(e.target.value) || 365 }))}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">天</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* 审计日志配置 */}
          <div className="space-y-3">
            <h3 className="font-semibold flex items-center gap-2">
              <Database className="h-4 w-4" />
              审计日志 (auditLogs)
            </h3>
            <p className="text-sm text-muted-foreground">
              记录用户操作历史，增长较慢，建议保留1年以上。
            </p>
            <div className="space-y-2">
              <Label>保留天数</Label>
              <div className="flex items-center gap-2 max-w-xs">
                <Input
                  type="number"
                  min={1}
                  max={3650}
                  value={form.auditLogs_retentionDays}
                  onChange={(e) => setForm(f => ({ ...f, auditLogs_retentionDays: parseInt(e.target.value) || 365 }))}
                />
                <span className="text-sm text-muted-foreground whitespace-nowrap">天</span>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button onClick={handleSave} disabled={updateConfig.isPending}>
              {updateConfig.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              保存配置
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 手动清理 */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Trash2 className="h-5 w-5 text-destructive" />
            <CardTitle>手动清理</CardTitle>
          </div>
          <CardDescription>立即执行数据清理操作，按照上方配置的保留期限或最大记录数进行清理</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2">
            {/* 按时间清理 */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-primary" />
                <h4 className="font-medium">按保留期限清理</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                删除超过保留天数的历史数据
              </p>
              <div className="flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={executeCleanup.isPending}>
                      清理采集数据
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清理采集数据？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将删除 {form.collectionData_retentionDays} 天前的所有采集数据，此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCleanup(['collectionData'], 'byTime')}>
                        确认清理
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={executeCleanup.isPending}>
                      清理重量记录
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清理重量变化记录？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将删除 {form.weightChangeRecords_retentionDays} 天前的所有重量变化记录，此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCleanup(['weightChangeRecords'], 'byTime')}>
                        确认清理
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={executeCleanup.isPending}>
                      清理报警记录
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清理报警记录？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将删除 {form.alarmRecords_retentionDays} 天前的已处理/自动解除报警记录及关联日志，未处理的报警不受影响。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCleanup(['alarmRecords'], 'byTime')}>
                        确认清理
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={executeCleanup.isPending}>
                      清理审计日志
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认清理审计日志？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将删除 {form.auditLogs_retentionDays} 天前的所有审计日志，此操作不可撤销。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCleanup(['auditLogs'], 'byTime')}>
                        确认清理
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>

              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm" disabled={executeCleanup.isPending} className="w-full mt-2">
                    {executeCleanup.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    一键清理全部过期数据
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>确认一键清理全部过期数据？</AlertDialogTitle>
                    <AlertDialogDescription>
                      将按照配置的保留天数，清理所有表中的过期数据。此操作不可撤销。
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>取消</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleCleanup(['collectionData', 'weightChangeRecords', 'alarmRecords', 'auditLogs'], 'byTime')}>
                      确认清理
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>

            {/* 按最大记录数清理 */}
            <div className="rounded-lg border border-border p-4 space-y-3">
              <div className="flex items-center gap-2">
                <HardDrive className="h-4 w-4 text-primary" />
                <h4 className="font-medium">按最大记录数清理</h4>
              </div>
              <p className="text-sm text-muted-foreground">
                保留最新的N条记录，删除超出部分（仅支持采集数据和重量记录）
              </p>
              <div className="flex flex-wrap gap-2">
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={executeCleanup.isPending}>
                      裁剪采集数据
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认裁剪采集数据？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将保留最新的 {formatNumber(form.collectionData_maxRows)} 条采集数据，删除更早的记录。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCleanup(['collectionData'], 'byMaxRows')}>
                        确认裁剪
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>

                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="outline" size="sm" disabled={executeCleanup.isPending}>
                      裁剪重量记录
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>确认裁剪重量变化记录？</AlertDialogTitle>
                      <AlertDialogDescription>
                        将保留最新的 {formatNumber(form.weightChangeRecords_maxRows)} 条重量变化记录，删除更早的记录。
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>取消</AlertDialogCancel>
                      <AlertDialogAction onClick={() => handleCleanup(['weightChangeRecords'], 'byMaxRows')}>
                        确认裁剪
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
