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
import { Loader2, AlertTriangle, CheckCircle2, Clock, RotateCcw, ChevronLeft, ChevronRight, Bell } from "lucide-react";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/hooks/usePermissions";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

export default function Alarms() {
  const { canOperate } = usePermissions();
  const canEdit = canOperate('alarm_management');
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | undefined>(undefined);
  const [selectedStatus, setSelectedStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const utils = trpc.useUtils();

  const { data: cabinets } = trpc.cabinetGroups.list.useQuery();
  
  // 根据选中的状态tab过滤
  const handlingStatusFilter = selectedStatus === "all" ? undefined 
    : selectedStatus === "pending" ? "pending" as const
    : selectedStatus === "handled" ? "handled" as const
    : "auto_resolved" as const;

  const { data, isLoading } = trpc.alarms.list.useQuery({
    cabinetGroupId: selectedCabinetId,
    handlingStatus: handlingStatusFilter,
    page: currentPage,
    pageSize,
  });
  const { data: unhandledCount } = trpc.alarms.getUnhandled.useQuery();

  const alarms = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

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

  const handleCabinetChange = (value: string) => {
    setSelectedCabinetId(value === "all" ? undefined : parseInt(value));
    setCurrentPage(1);
  };

  const handleStatusChange = (value: string) => {
    setSelectedStatus(value);
    setCurrentPage(1);
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const showActions = selectedStatus !== "handled";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Bell className="h-8 w-8" />
            报警管理
          </h1>
          <p className="text-muted-foreground mt-2">查看和处理所有报警事件</p>
        </div>
        <div className="flex items-center gap-3">
          <Select value={selectedStatus} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-36">
              <SelectValue placeholder="处理状态" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部状态</SelectItem>
              <SelectItem value="pending">待处理</SelectItem>
              <SelectItem value="handled">已处理</SelectItem>
              <SelectItem value="auto_resolved">自动解除</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={selectedCabinetId?.toString() || "all"}
            onValueChange={handleCabinetChange}
          >
            <SelectTrigger className="w-48">
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

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">总报警数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalItems}</div>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">当前筛选</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{totalItems} 条</div>
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
            <>
              <div className="rounded-lg border border-border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">序号</TableHead>
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
                    {alarms.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={showActions ? 11 : 10} className="text-center text-muted-foreground py-8">
                          暂无报警记录
                        </TableCell>
                      </TableRow>
                    ) : (
                      alarms.map((alarm: any, index: number) => {
                        const isPending = alarm.handlingStatus === 'pending';
                        const globalIndex = (currentPage - 1) * pageSize + index + 1;
                        
                        return (
                          <TableRow key={alarm.id} className={cn(isPending && "bg-destructive/5")}>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              {globalIndex}
                            </TableCell>
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

              {/* 分页控件 */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>共 {totalItems} 条</span>
                  <span>·</span>
                  <span>每页</span>
                  <Select value={pageSize.toString()} onValueChange={handlePageSizeChange}>
                    <SelectTrigger className="w-20 h-8">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {PAGE_SIZE_OPTIONS.map(size => (
                        <SelectItem key={size} value={size.toString()}>{size} 条</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(1)} disabled={currentPage <= 1}>
                    首页
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    第 {currentPage} / {totalPages} 页
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(totalPages)} disabled={currentPage >= totalPages}>
                    末页
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
