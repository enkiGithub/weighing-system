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
import { Badge } from "@/components/ui/badge";
import { Loader2, ChevronLeft, ChevronRight, ClipboardList } from "lucide-react";

const PAGE_SIZE_OPTIONS = [20, 50, 100, 200];

const ACTION_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  create: { label: "创建", variant: "default" },
  update: { label: "更新", variant: "outline" },
  delete: { label: "删除", variant: "destructive" },
  batchDelete: { label: "批量删除", variant: "destructive" },
  addBinding: { label: "添加绑定", variant: "default" },
  updateBinding: { label: "更新绑定", variant: "outline" },
  removeBinding: { label: "移除绑定", variant: "destructive" },
};

const TARGET_LABELS: Record<string, string> = {
  gateway: "网关",
  comPort: "COM端口",
  instrument: "仪表",
  channel: "通道",
  cabinetGroup: "柜组",
  groupChannelBinding: "通道绑定",
};

export default function AuditLogs() {
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(50);

  const { data, isLoading } = trpc.auditLogs.list.useQuery({
    page: currentPage,
    pageSize,
  });

  const logs = data?.items || [];
  const totalItems = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

  const getActionBadge = (action: string) => {
    const info = ACTION_LABELS[action] || { label: action, variant: "secondary" as const };
    return <Badge variant={info.variant}>{info.label}</Badge>;
  };

  const getTargetLabel = (targetType: string) => {
    return TARGET_LABELS[targetType] || targetType;
  };

  const handlePageSizeChange = (val: string) => {
    setPageSize(Number(val));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center gap-3">
          <ClipboardList className="h-8 w-8" />
          审计日志
        </h1>
        <p className="text-muted-foreground mt-2">
          记录所有硬件配置变更操作，包括设备创建、修改、删除和绑定变更等。
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>操作记录</CardTitle>
          <CardDescription>按时间倒序显示配置变更记录，共 {totalItems} 条</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-16">序号</TableHead>
                    <TableHead>时间</TableHead>
                    <TableHead>操作人</TableHead>
                    <TableHead>操作</TableHead>
                    <TableHead>对象类型</TableHead>
                    <TableHead>对象ID</TableHead>
                    <TableHead>摘要</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                        暂无审计日志
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log: any, index: number) => {
                      const globalIndex = (currentPage - 1) * pageSize + index + 1;
                      return (
                        <TableRow key={log.id}>
                          <TableCell className="text-muted-foreground">
                            {globalIndex}
                          </TableCell>
                          <TableCell className="text-sm whitespace-nowrap">
                            {new Date(log.createdAt).toLocaleString()}
                          </TableCell>
                          <TableCell className="font-medium">
                            {log.userName || `用户#${log.userId}`}
                          </TableCell>
                          <TableCell>{getActionBadge(log.action)}</TableCell>
                          <TableCell>{getTargetLabel(log.targetType)}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {log.targetId || "-"}
                          </TableCell>
                          <TableCell className="max-w-md truncate text-sm">
                            {log.summary}
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>

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
