import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, AlertTriangle, CheckCircle2, Clock, RotateCcw } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

export default function Alarms() {
  const { canOperate } = usePermissions();
  const canEdit = canOperate('alarm_management');
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | undefined>(undefined);
  const utils = trpc.useUtils();

  const { data: cabinets } = trpc.cabinetGroups.list.useQuery();
  const { data: allAlarms, isLoading } = trpc.alarms.list.useQuery({
    cabinetGroupId: selectedCabinetId,
    limit: 200,
  });
  const { data: unhandledCount } = trpc.alarms.getUnhandled.useQuery();

  const handleMutation = trpc.alarms.updateStatus.useMutation({
    onSuccess: () => {
      utils.alarms.list.invalidate();
      utils.alarms.getUnhandled.invalidate();
      toast.success("报警已处理");
    },
    onError: (error: any) => {
      toast.error(`处理失败: ${error.message}`);
    },
  });

  const getCabinetName = (cabinetId: number) => {
    return cabinets?.find((c) => c.id === cabinetId)?.name || "未知柜组";
  };

  const getAlarmTypeText = (type: string) => {
    switch (type) {
      case "overweight":
        return "超重报警";
      case "offline":
        return "设备离线";
      default:
        return type;
    }
  };

  const getHandlingStatusBadge = (status: string) => {
    switch (status) {
      case "handled":
        return (
          <Badge variant="default" className="gap-1 bg-success text-success-foreground">
            <CheckCircle2 className="h-3 w-3" />
            已处理
          </Badge>
        );
      case "auto_resolved":
        return (
          <Badge variant="default" className="gap-1 bg-blue-600 text-white">
            <RotateCcw className="h-3 w-3" />
            自动解除
          </Badge>
        );
      case "pending":
      default:
        return (
          <Badge variant="destructive" className="gap-1">
            <Clock className="h-3 w-3" />
            待处理
          </Badge>
        );
    }
  };

  const handleAlarm = (id: number) => {
    if (confirm("确认处理此报警？")) {
      handleMutation.mutate({ id, handlingStatus: 'handled' });
    }
  };

  // 统计数据
  const pendingAlarms = useMemo(() => {
    return allAlarms?.filter((a: any) => a.handlingStatus === 'pending') || [];
  }, [allAlarms]);

  const handledAlarms = useMemo(() => {
    return allAlarms?.filter((a: any) => a.handlingStatus !== 'pending') || [];
  }, [allAlarms]);

  const AlarmTable = ({ alarms, showActions = true }: { alarms: any[]; showActions?: boolean }) => (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>柜组名称</TableHead>
            <TableHead>报警类型</TableHead>
            <TableHead>校准值</TableHead>
            <TableHead>阈值</TableHead>
            <TableHead>超出量</TableHead>
            <TableHead>发生次数</TableHead>
            <TableHead>首次时间</TableHead>
            <TableHead>最后时间</TableHead>
            <TableHead>处理状态</TableHead>
            {showActions && <TableHead className="text-right">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {alarms?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 10 : 9} className="text-center text-muted-foreground py-8">
                暂无报警记录
              </TableCell>
            </TableRow>
          ) : (
            alarms?.map((alarm: any) => {
              const isPending = alarm.handlingStatus === 'pending';
              
              return (
                <TableRow key={alarm.id} className={cn(isPending && "bg-destructive/5")}>
                  <TableCell className="font-medium">
                    {getCabinetName(alarm.cabinetGroupId)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {getAlarmTypeText(alarm.alarmType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {alarm.calibratedValue != null ? `${alarm.calibratedValue.toFixed(2)} kg` : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {alarm.threshold != null ? `${alarm.threshold.toFixed(2)} kg` : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-red-400">
                    {alarm.exceedValue != null && alarm.exceedValue > 0
                      ? `+${alarm.exceedValue.toFixed(2)} kg`
                      : '-'}
                  </TableCell>
                  <TableCell className="text-center">
                    {alarm.occurrenceCount || 1}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {alarm.firstOccurredAt
                      ? format(new Date(alarm.firstOccurredAt), "yyyy-MM-dd HH:mm:ss")
                      : '-'}
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {alarm.lastOccurredAt
                      ? format(new Date(alarm.lastOccurredAt), "yyyy-MM-dd HH:mm:ss")
                      : '-'}
                  </TableCell>
                  <TableCell>
                    {getHandlingStatusBadge(alarm.handlingStatus)}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      {isPending && canEdit && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleAlarm(alarm.id)}
                          disabled={handleMutation.isPending}
                        >
                          {handleMutation.isPending && (
                            <Loader2 className="mr-2 h-3 w-3 animate-spin" />
                          )}
                          处理
                        </Button>
                      )}
                    </TableCell>
                  )}
                </TableRow>
              );
            })
          )}
        </TableBody>
      </Table>
    </div>
  );

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">报警管理</h1>
          <p className="text-muted-foreground mt-2">查看和处理所有报警事件</p>
        </div>
        <div className="w-64">
          <Select
            value={selectedCabinetId?.toString() || "all"}
            onValueChange={(value) => setSelectedCabinetId(value === "all" ? undefined : parseInt(value))}
          >
            <SelectTrigger>
              <SelectValue placeholder="筛选柜组" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部柜组</SelectItem>
              {cabinets?.map((cabinet) => (
                <SelectItem key={cabinet.id} value={cabinet.id.toString()}>
                  {cabinet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">总报警数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{allAlarms?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">待处理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {typeof unhandledCount === 'number' ? unhandledCount : 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">已处理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {allAlarms?.filter((a: any) => a.handlingStatus === 'handled').length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">自动解除</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-blue-500">
              {allAlarms?.filter((a: any) => a.handlingStatus === 'auto_resolved').length || 0}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>报警记录</CardTitle>
          <CardDescription>查看和处理所有报警事件的详细信息</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Tabs defaultValue="all" className="w-full">
              <TabsList className="grid w-full max-w-lg grid-cols-3">
                <TabsTrigger value="all">
                  全部 ({allAlarms?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="pending">
                  待处理 ({pendingAlarms.length})
                </TabsTrigger>
                <TabsTrigger value="handled">
                  已处理 ({handledAlarms.length})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-6">
                <AlarmTable alarms={allAlarms || []} />
              </TabsContent>
              <TabsContent value="pending" className="mt-6">
                <AlarmTable alarms={pendingAlarms} />
              </TabsContent>
              <TabsContent value="handled" className="mt-6">
                <AlarmTable alarms={handledAlarms} showActions={false} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
