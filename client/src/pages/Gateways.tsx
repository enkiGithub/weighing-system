import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit, Trash2, Loader2, WifiOff, Wifi, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Gateway } from "../../../drizzle/schema";

const gatewaySchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  ipAddress: z.string().min(1, "IP地址不能为空").max(45, "IP地址过长"),
  port: z.number().int().min(1, "端口必须大于0").max(65535, "端口号无效"),
  description: z.string().optional(),
});

type GatewayForm = z.infer<typeof gatewaySchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Gateways() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const utils = trpc.useUtils();

  const { data: gateways, isLoading } = trpc.gateways.list.useQuery();

  // 分页计算
  const totalItems = gateways?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedGateways = useMemo(() => {
    if (!gateways) return [];
    const start = (currentPage - 1) * pageSize;
    return gateways.slice(start, start + pageSize);
  }, [gateways, currentPage, pageSize]);

  // 当前页的ID集合
  const currentPageIds = useMemo(() => new Set(paginatedGateways.map(g => g.id)), [paginatedGateways]);

  // 全选状态
  const isAllSelected = paginatedGateways.length > 0 && paginatedGateways.every(g => selectedIds.has(g.id));
  const isSomeSelected = paginatedGateways.some(g => selectedIds.has(g.id));

  const createMutation = trpc.gateways.create.useMutation({
    onSuccess: () => {
      utils.gateways.list.invalidate();
      toast.success("网关创建成功");
      setIsDialogOpen(false);
      reset();
    },
    onError: (error) => toast.error(`创建失败: ${error.message}`),
  });

  const updateMutation = trpc.gateways.update.useMutation({
    onSuccess: () => {
      utils.gateways.list.invalidate();
      toast.success("网关更新成功");
      setIsDialogOpen(false);
      setEditingGateway(null);
      reset();
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  const deleteMutation = trpc.gateways.delete.useMutation({
    onSuccess: () => {
      utils.gateways.list.invalidate();
      toast.success("网关删除成功");
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  const batchDeleteMutation = trpc.gateways.batchDelete.useMutation({
    onSuccess: (data) => {
      utils.gateways.list.invalidate();
      setSelectedIds(new Set());
      toast.success(`成功删除 ${data.count} 个网关`);
    },
    onError: (error) => toast.error(`批量删除失败: ${error.message}`),
  });

  const { register, handleSubmit, reset, formState: { errors } } = useForm<GatewayForm>({
    resolver: zodResolver(gatewaySchema),
  });

  const onSubmit = (data: GatewayForm) => {
    if (editingGateway) {
      updateMutation.mutate({ id: editingGateway.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (gateway: Gateway) => {
    setEditingGateway(gateway);
    reset({
      name: gateway.name,
      ipAddress: gateway.ipAddress,
      port: gateway.port,
      description: gateway.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除此网关吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAdd = () => {
    setEditingGateway(null);
    reset({ name: "", ipAddress: "", port: 502, description: "" });
    setIsDialogOpen(true);
  };

  const handleToggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedIds(next);
  };

  const handleToggleAll = () => {
    if (isAllSelected) {
      const next = new Set(selectedIds);
      currentPageIds.forEach(id => next.delete(id));
      setSelectedIds(next);
    } else {
      const next = new Set(selectedIds);
      currentPageIds.forEach(id => next.add(id));
      setSelectedIds(next);
    }
  };

  const handleBatchDelete = () => {
    if (selectedIds.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个网关吗？`)) {
      batchDeleteMutation.mutate({ ids: Array.from(selectedIds) });
    }
  };

  const handlePageChange = (page: number) => {
    setCurrentPage(Math.max(1, Math.min(page, totalPages)));
  };

  const handlePageSizeChange = (size: string) => {
    setPageSize(Number(size));
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">网关管理</h1>
          <p className="text-muted-foreground mt-2">管理所有RS485网关设备</p>
        </div>
        <div className="flex gap-2">
          {selectedIds.size > 0 && (
            <Button variant="destructive" onClick={handleBatchDelete} disabled={batchDeleteMutation.isPending}>
              {batchDeleteMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              <Trash2 className="mr-2 h-4 w-4" />
              删除选中 ({selectedIds.size})
            </Button>
          )}
          <Button onClick={handleAdd}>
            <Plus className="mr-2 h-4 w-4" />
            添加网关
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>网关列表</CardTitle>
          <CardDescription>查看和管理所有网关设备的配置信息</CardDescription>
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
                    <TableHead className="w-12">
                      <Checkbox
                        checked={isAllSelected}
                        onCheckedChange={handleToggleAll}
                        aria-label="全选"
                        {...(isSomeSelected && !isAllSelected ? { "data-state": "indeterminate" } : {})}
                      />
                    </TableHead>
                    <TableHead className="w-16">序号</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>IP地址</TableHead>
                    <TableHead>端口</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>最后心跳</TableHead>
                    <TableHead>描述</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGateways.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center text-muted-foreground py-8">
                        暂无网关设备
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedGateways.map((gateway, index) => (
                      <TableRow key={gateway.id} className={selectedIds.has(gateway.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(gateway.id)}
                            onCheckedChange={() => handleToggleSelect(gateway.id)}
                            aria-label={`选择 ${gateway.name}`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(currentPage - 1) * pageSize + index + 1}
                        </TableCell>
                        <TableCell className="font-medium">{gateway.name}</TableCell>
                        <TableCell className="font-mono text-sm">{gateway.ipAddress}</TableCell>
                        <TableCell>{gateway.port}</TableCell>
                        <TableCell>
                          <Badge
                            variant={gateway.status === "online" ? "default" : "secondary"}
                            className="gap-1"
                          >
                            {gateway.status === "online" ? (
                              <Wifi className="h-3 w-3" />
                            ) : (
                              <WifiOff className="h-3 w-3" />
                            )}
                            {gateway.status === "online" ? "在线" : "离线"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">
                          {gateway.lastHeartbeat
                            ? format(new Date(gateway.lastHeartbeat), "yyyy-MM-dd HH:mm:ss")
                            : "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {gateway.description || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(gateway)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(gateway.id)}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
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
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage - 1)}
                    disabled={currentPage <= 1}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    第 {currentPage} / {totalPages} 页
                  </span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handlePageChange(currentPage + 1)}
                    disabled={currentPage >= totalPages}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          )}
        </CardContent>
      </Card>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingGateway ? "编辑网关" : "添加网关"}</DialogTitle>
            <DialogDescription>
              {editingGateway ? "修改网关配置信息" : "创建新的RS485网关"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">名称 *</Label>
                <Input id="name" placeholder="例如：1号网关" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ipAddress">IP地址 *</Label>
                <Input id="ipAddress" placeholder="例如：192.168.1.100" {...register("ipAddress")} />
                {errors.ipAddress && <p className="text-sm text-destructive">{errors.ipAddress.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="port">端口 *</Label>
                <Input id="port" type="number" placeholder="例如：502" {...register("port", { valueAsNumber: true })} />
                {errors.port && <p className="text-sm text-destructive">{errors.port.message}</p>}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">描述</Label>
                <Textarea id="description" placeholder="网关的详细描述信息" {...register("description")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingGateway(null); reset(); }}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingGateway ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
