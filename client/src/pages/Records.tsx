import { useState } from "react";
import { trpc } from "@/lib/trpc";
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
import { Loader2, TrendingUp, TrendingDown, AlertTriangle } from "lucide-react";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

export default function Records() {
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | undefined>(undefined);
  
  const { data: cabinets } = trpc.cabinetGroups.list.useQuery();
  const { data: records, isLoading } = trpc.weightRecords.list.useQuery({
    cabinetGroupId: selectedCabinetId,
    limit: 200,
  });

  const getCabinetName = (cabinetId: number) => {
    return cabinets?.find((c) => c.id === cabinetId)?.name || "未知柜组";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">数据记录</h1>
          <p className="text-muted-foreground mt-2">查看所有重量变化历史记录</p>
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
            <CardTitle className="text-sm font-medium text-muted-foreground">总记录数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{records?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">重量增加</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {records?.filter(r => r.changeValue > 0).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">重量减少</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {records?.filter(r => r.changeValue < 0).length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">报警次数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {records?.filter(r => r.isAlarm === 1).length || 0}
            </div>
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
                  {records?.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        暂无记录数据
                      </TableCell>
                    </TableRow>
                  ) : (
                    records?.map((record, index) => {
                      const recordDate = new Date(record.recordedAt);
                      const isIncrease = record.changeValue > 0;
                      const isAlarm = record.isAlarm === 1;

                      return (
                        <TableRow key={record.id} className={cn(isAlarm && "bg-destructive/5")}>
                          <TableCell className="font-mono text-sm text-muted-foreground">
                            #{String(records.length - index).padStart(4, '0')}
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
                            {(record.previousWeight / 1000).toFixed(3)} kg
                          </TableCell>
                          <TableCell className="text-right font-mono font-semibold">
                            {(record.currentWeight / 1000).toFixed(3)} kg
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
                              {(record.changeValue / 1000).toFixed(3)} kg
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
          )}
        </CardContent>
      </Card>
    </div>
  );
}
