import { useState } from "react";
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
import { Loader2, AlertTriangle, CheckCircle2, Clock } from "lucide-react";
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
  const { data: unhandledAlarms } = trpc.alarms.getUnhandled.useQuery();

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

  const getUserName = (userId: number | null) => {
    if (!userId) return "-";
    return `用户 #${userId}`;
  };

  const getAlarmTypeText = (type: string) => {
    switch (type) {
      case "threshold_exceeded":
        return "阈值超限";
      case "device_offline":
        return "设备离线";
      default:
        return type;
    }
  };

  const handleAlarm = (id: number) => {
    if (confirm("确认处理此报警？")) {
      handleMutation.mutate({ id, status: 'acknowledged' });
    }
  };

  const AlarmTable = ({ alarms, showActions = true }: { alarms: typeof allAlarms; showActions?: boolean }) => (
    <div className="rounded-lg border border-border">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>柜组名称</TableHead>
            <TableHead>报警类型</TableHead>
            <TableHead>报警信息</TableHead>
            <TableHead>报警时间</TableHead>
            <TableHead>处理状态</TableHead>
            <TableHead>处理人</TableHead>
            <TableHead>处理时间</TableHead>
            {showActions && <TableHead className="text-right">操作</TableHead>}
          </TableRow>
        </TableHeader>
        <TableBody>
          {alarms?.length === 0 ? (
            <TableRow>
              <TableCell colSpan={showActions ? 8 : 7} className="text-center text-muted-foreground py-8">
                暂无报警记录
              </TableCell>
            </TableRow>
          ) : (
            alarms?.map((alarm: any) => {
              const isHandled = alarm.isHandled === 1;
              
              return (
                <TableRow key={alarm.id} className={cn(!isHandled && "bg-destructive/5")}>
                  <TableCell className="font-medium">
                    {getCabinetName(alarm.cabinetGroupId)}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      {getAlarmTypeText(alarm.alarmType)}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md">
                    <p className="text-sm text-muted-foreground">{alarm.alarmMessage}</p>
                  </TableCell>
                  <TableCell className="font-mono text-sm">
                    {format(new Date(alarm.createdAt), "yyyy-MM-dd HH:mm:ss")}
                  </TableCell>
                  <TableCell>
                    {isHandled ? (
                      <Badge variant="default" className="gap-1 bg-success text-success-foreground">
                        <CheckCircle2 className="h-3 w-3" />
                        已处理
                      </Badge>
                    ) : (
                      <Badge variant="destructive" className="gap-1">
                        <Clock className="h-3 w-3" />
                        待处理
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {getUserName(alarm.handledBy)}
                  </TableCell>
                  <TableCell className="font-mono text-sm text-muted-foreground">
                    {alarm.handledAt
                      ? format(new Date(alarm.handledAt), "yyyy-MM-dd HH:mm:ss")
                      : "-"}
                  </TableCell>
                  {showActions && (
                    <TableCell className="text-right">
                      {!isHandled && canEdit && (
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
              {unhandledAlarms?.length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">已处理</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {allAlarms?.filter((a: any) => a.isHandled === 1).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">阈值超限</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {allAlarms?.filter((a: any) => a.alarmType === "threshold_exceeded").length || 0}
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
              <TabsList className="grid w-full max-w-md grid-cols-2">
                <TabsTrigger value="all">
                  全部报警 ({allAlarms?.length || 0})
                </TabsTrigger>
                <TabsTrigger value="unhandled">
                  待处理 ({unhandledAlarms?.length || 0})
                </TabsTrigger>
              </TabsList>
              <TabsContent value="all" className="mt-6">
                <AlarmTable alarms={allAlarms} />
              </TabsContent>
              <TabsContent value="unhandled" className="mt-6">
                <AlarmTable alarms={unhandledAlarms} />
              </TabsContent>
            </Tabs>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
