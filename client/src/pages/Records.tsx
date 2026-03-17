import { useState } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Loader2, TrendingUp, TrendingDown, AlertTriangle, ChevronLeft, ChevronRight, Database, CalendarDays, X } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

export default function Records() {
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | undefined>(undefined);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);
  const [startDate, setStartDate] = useState<string>("");
  const [endDate, setEndDate] = useState<string>("");
  
  const { data: cabinets } = trpc.cabinetGroups.list.useQuery();
  const { data, isLoading } = trpc.weightRecords.list.useQuery({
    cabinetGroupId: selectedCabinetId,
    startDate: startDate || undefined,
    endDate: endDate || undefined,
    page: currentPage,
    pageSize,
  });

  const records = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const getCabinetName = (cabinetId: number) => {
    return cabinets?.find((c) => c.id === cabinetId)?.name || "未知柜组";
  };

  // 当筛选条件变化时重置到第一页
  const handleCabinetChange = (value: string) => {
    setSelectedCabinetId(value === "all" ? undefined : parseInt(value));
    setCurrentPage(1);
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  const handleStartDateChange = (value: string) => {
    setStartDate(value);
    setCurrentPage(1);
  };

  const handleEndDateChange = (value: string) => {
    setEndDate(value);
    setCurrentPage(1);
  };

  const clearDateFilter = () => {
    setStartDate("");
    setEndDate("");
    setCurrentPage(1);
  };

  const hasDateFilter = startDate || endDate;

  // 快捷日期范围
  const setQuickRange = (days: number) => {
    const end = new Date();
    const start = new Date();
    start.setDate(start.getDate() - days);
    setStartDate(format(start, "yyyy-MM-dd"));
    setEndDate(format(end, "yyyy-MM-dd"));
    setCurrentPage(1);
  };

  // 统计信息基于当前页数据
  const increaseCount = records.filter(r => r.changeValue > 0).length;
  const decreaseCount = records.filter(r => r.changeValue < 0).length;
  const alarmCount = records.filter(r => r.isAlarm === 1).length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
            <Database className="h-8 w-8" />
            数据记录
          </h1>
          <p className="text-muted-foreground mt-2">查看所有重量变化历史记录</p>
        </div>
        <div className="w-64">
          <Select
            value={selectedCabinetId?.toString() || "all"}
            onValueChange={handleCabinetChange}
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

      {/* 日期范围筛选 */}
      <Card>
        <CardContent className="pt-4 pb-4">
          <div className="flex items-center gap-3 flex-wrap">
            <CalendarDays className="h-5 w-5 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium text-muted-foreground shrink-0">日期范围：</span>
            <Input
              type="date"
              value={startDate}
              onChange={(e) => handleStartDateChange(e.target.value)}
              className="w-40 h-9"
              placeholder="开始日期"
            />
            <span className="text-muted-foreground">至</span>
            <Input
              type="date"
              value={endDate}
              onChange={(e) => handleEndDateChange(e.target.value)}
              className="w-40 h-9"
              placeholder="结束日期"
            />
            {hasDateFilter && (
              <Button variant="ghost" size="sm" onClick={clearDateFilter} className="gap-1 text-muted-foreground hover:text-foreground">
                <X className="h-4 w-4" />
                清除
              </Button>
            )}
            <div className="h-5 w-px bg-border mx-1" />
            <span className="text-sm text-muted-foreground shrink-0">快捷：</span>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setQuickRange(1)}>今天</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setQuickRange(3)}>近3天</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setQuickRange(7)}>近7天</Button>
            <Button variant="outline" size="sm" className="h-8" onClick={() => setQuickRange(30)}>近30天</Button>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">总记录数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">本页重量增加</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">{increaseCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">本页重量减少</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{decreaseCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">本页报警次数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{alarmCount}</div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>重量变化记录</CardTitle>
          <CardDescription>
            记录格式：序号、日期时间、变化前重量、变化后重量、变化值
          </CardDescription>
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
                      <TableHead className="w-20">序号</TableHead>
                      <TableHead>柜组名称</TableHead>
                      <TableHead>日期</TableHead>
                      <TableHead>时间</TableHead>
                      <TableHead className="text-right">变化前重量</TableHead>
                      <TableHead className="text-right">变化后重量</TableHead>
                      <TableHead className="text-right">变化值</TableHead>
                      <TableHead>状态</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {records.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                          暂无记录数据
                        </TableCell>
                      </TableRow>
                    ) : (
                      records.map((record: any, index: number) => {
                        const recordDate = new Date(record.recordedAt);
                        const isIncrease = record.changeValue > 0;
                        const isAlarm = record.isAlarm === 1;
                        // 全局序号：总数 - ((当前页-1)*每页数 + 当前行索引)
                        const globalIndex = totalItems - ((currentPage - 1) * pageSize + index);

                        return (
                          <TableRow key={record.id} className={cn(isAlarm && "bg-destructive/5")}>
                            <TableCell className="font-mono text-sm text-muted-foreground">
                              #{String(globalIndex).padStart(4, '0')}
                            </TableCell>
                            <TableCell className="font-medium">
                              {getCabinetName(record.cabinetGroupId)}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {format(recordDate, "yyyy-MM-dd")}
                            </TableCell>
                            <TableCell className="font-mono text-sm">
                              {format(recordDate, "HH:mm:ss")}
                            </TableCell>
                            <TableCell className="text-right font-mono">
                              {record.previousWeight.toFixed(3)} kg
                            </TableCell>
                            <TableCell className="text-right font-mono font-semibold">
                              {record.currentWeight.toFixed(3)} kg
                            </TableCell>
                            <TableCell className="text-right">
                              <div className={cn(
                                "inline-flex items-center gap-1 font-mono font-semibold",
                                isIncrease ? "text-success" : "text-destructive"
                              )}>
                                {isIncrease ? (
                                  <TrendingUp className="h-4 w-4" />
                                ) : (
                                  <TrendingDown className="h-4 w-4" />
                                )}
                                {isIncrease ? "+" : ""}
                                {record.changeValue.toFixed(3)} kg
                              </div>
                            </TableCell>
                            <TableCell>
                              {isAlarm ? (
                                <Badge variant="destructive" className="gap-1">
                                  <AlertTriangle className="h-3 w-3" />
                                  报警
                                </Badge>
                              ) : (
                                <Badge variant="secondary">正常</Badge>
                              )}
                            </TableCell>
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
