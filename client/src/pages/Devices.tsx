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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Plus, Edit, Trash2, Loader2, WifiOff, Wifi, ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon, Server, Cable } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

// 仪表表单schema
const instrumentSchema = z.object({
  deviceCode: z.string().min(1, "设备编码不能为空").max(50),
  name: z.string().max(100).optional(),
  modelType: z.enum(["DY7001", "DY7004"], { message: "请选择仪表型号" }),
  slaveId: z.number().int().min(1, "从站地址必须大于0").max(247, "从站地址无效"),
  location: z.string().optional(),
  remark: z.string().optional(),
});

type InstrumentForm = z.infer<typeof instrumentSchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Devices() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<any>(null);
  // 选中的COM端口ID（树形选择面板）
  const [selectedComPortId, setSelectedComPortId] = useState<number | null>(null);

  // 分页和多选状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 树形面板展开状态
  const [expandedGateways, setExpandedGateways] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  // 查询数据
  const { data: gateways, isLoading: gatewaysLoading } = trpc.gateways.list.useQuery();
  const { data: allComPorts, isLoading: comPortsLoading } = trpc.gatewayComPorts.listAll.useQuery();
  const { data: instruments, isLoading: instrumentsLoading } = trpc.instruments.list.useQuery();

  // 按网关分组COM端口
  const comPortsByGateway = useMemo(() => {
    if (!allComPorts || !gateways) return new Map<number, any[]>();
    const map = new Map<number, any[]>();
    for (const gw of gateways) {
      map.set(gw.id, allComPorts.filter(p => p.gatewayId === gw.id));
    }
    return map;
  }, [allComPorts, gateways]);

  // 获取COM端口信息
  const getComPortInfo = (comPortId: number | null) => {
    if (!comPortId || !allComPorts || !gateways) return "未配置";
    const port = allComPorts.find(p => p.id === comPortId);
    if (!port) return `COM端口#${comPortId}`;
    const gw = gateways.find(g => g.id === port.gatewayId);
    return gw ? `${gw.name} - ${port.portNumber}` : port.portNumber;
  };

  // 分页
  const totalItems = instruments?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedInstruments = useMemo(() => {
    if (!instruments) return [];
    const start = (currentPage - 1) * pageSize;
    return instruments.slice(start, start + pageSize);
  }, [instruments, currentPage, pageSize]);

  const currentPageIds = useMemo(() => new Set(paginatedInstruments.map(i => i.id)), [paginatedInstruments]);
  const isAllSelected = paginatedInstruments.length > 0 && paginatedInstruments.every(i => selectedIds.has(i.id));
  const isSomeSelected = paginatedInstruments.some(i => selectedIds.has(i.id));

  // 仪表mutations
  const createMutation = trpc.instruments.create.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表创建成功");
      setIsDialogOpen(false);
      resetForm();
      setSelectedComPortId(null);
    },
    onError: (error) => toast.error(`创建失败: ${error.message}`),
  });

  const updateMutation = trpc.instruments.update.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表更新成功");
      setIsDialogOpen(false);
      setEditingInstrument(null);
      resetForm();
      setSelectedComPortId(null);
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  const deleteMutation = trpc.instruments.delete.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表删除成功");
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  const batchDeleteMutation = trpc.instruments.batchDelete.useMutation({
    onSuccess: (data) => {
      utils.instruments.list.invalidate();
      setSelectedIds(new Set());
      toast.success(`成功删除 ${data.count} 个仪表`);
    },
    onError: (error) => toast.error(`批量删除失败: ${error.message}`),
  });

  // 表单
  const {
    register,
    handleSubmit,
    reset: resetForm,
    control,
    formState: { errors },
  } = useForm<InstrumentForm>({
    resolver: zodResolver(instrumentSchema),
  });

  const onSubmit = (data: InstrumentForm) => {
    if (!selectedComPortId) {
      toast.error("请在右侧面板中选择一个COM端口");
      return;
    }
    if (editingInstrument) {
      updateMutation.mutate({ id: editingInstrument.id, comPortId: selectedComPortId, ...data });
    } else {
      createMutation.mutate({ comPortId: selectedComPortId, ...data });
    }
  };

  const handleEdit = (instrument: any) => {
    setEditingInstrument(instrument);
    setSelectedComPortId(instrument.comPortId);
    resetForm({
      deviceCode: instrument.deviceCode,
      name: instrument.name || "",
      modelType: instrument.modelType,
      slaveId: instrument.slaveId,
      location: instrument.location || "",
      remark: instrument.remark || "",
    });
    // 自动展开包含该COM端口的网关
    if (instrument.comPortId && allComPorts) {
      const port = allComPorts.find(p => p.id === instrument.comPortId);
      if (port) {
        setExpandedGateways(prev => { const next = new Set(Array.from(prev)); next.add(port.gatewayId); return next; });
      }
    }
    setIsDialogOpen(true);
  };

  const handleAdd = () => {
    setEditingInstrument(null);
    setSelectedComPortId(null);
    setExpandedGateways(new Set());
    resetForm();
    setIsDialogOpen(true);
  };

  const handleToggleSelect = (id: number) => {
    const next = new Set(selectedIds);
    if (next.has(id)) next.delete(id); else next.add(id);
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
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个仪表吗？`)) {
      batchDeleteMutation.mutate({ ids: Array.from(selectedIds) });
    }
  };

  const toggleGatewayExpand = (gatewayId: number) => {
    setExpandedGateways(prev => {
      const next = new Set(prev);
      if (next.has(gatewayId)) next.delete(gatewayId);
      else next.add(gatewayId);
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">仪表管理</h1>
          <p className="text-muted-foreground mt-2">管理所有RS485称重仪表设备</p>
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
            添加仪表
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>仪表列表</CardTitle>
          <CardDescription>查看和管理所有称重仪表设备的配置信息</CardDescription>
        </CardHeader>
        <CardContent>
          {instrumentsLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : instruments && instruments.length > 0 ? (
            <>
              <div className="overflow-x-auto">
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
                      <TableHead>设备编码</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>型号</TableHead>
                      <TableHead>COM端口</TableHead>
                      <TableHead>从站地址</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>位置</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInstruments.map((instrument, index) => (
                      <TableRow key={instrument.id} className={selectedIds.has(instrument.id) ? "bg-muted/50" : ""}>
                        <TableCell>
                          <Checkbox
                            checked={selectedIds.has(instrument.id)}
                            onCheckedChange={() => handleToggleSelect(instrument.id)}
                            aria-label={`选择 ${instrument.name}`}
                          />
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {(currentPage - 1) * pageSize + index + 1}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{instrument.deviceCode}</TableCell>
                        <TableCell className="font-medium">{instrument.name || "-"}</TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {instrument.modelType}
                            {instrument.modelType === "DY7001" && " (1通道)"}
                            {instrument.modelType === "DY7004" && " (4通道)"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm">{getComPortInfo(instrument.comPortId)}</TableCell>
                        <TableCell>{instrument.slaveId}</TableCell>
                        <TableCell>
                          <Badge variant={instrument.status === "online" ? "default" : "destructive"}>
                            {instrument.status === "online" ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                            {instrument.status === "online" ? "在线" : "离线"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-sm text-muted-foreground">{instrument.location || "-"}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{instrument.remark || "-"}</TableCell>
                        <TableCell className="text-right space-x-1">
                          <Button variant="ghost" size="sm" onClick={() => handleEdit(instrument)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => {
                            if (confirm("确定要删除此仪表吗？")) deleteMutation.mutate({ id: instrument.id });
                          }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* 分页 */}
              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <span>共 {totalItems} 条</span>
                  <span>·</span>
                  <span>每页</span>
                  <Select value={pageSize.toString()} onValueChange={(val) => { setPageSize(Number(val)); setCurrentPage(1); }}>
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
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm text-muted-foreground px-2">
                    第 {currentPage} / {totalPages} 页
                  </span>
                  <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              暂无仪表数据
            </div>
          )}
        </CardContent>
      </Card>

      {/* 仪表添加/编辑对话框（含右侧树形选择面板） */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingInstrument(null);
          setSelectedComPortId(null);
        }
      }}>
        <DialogContent className="sm:max-w-[850px] max-h-[85vh] overflow-hidden p-0">
          <div className="flex h-full">
            {/* 左侧：仪表基本信息表单 */}
            <div className="flex-1 p-6 overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingInstrument ? "编辑仪表" : "添加仪表"}</DialogTitle>
                <DialogDescription>配置RS485称重仪表参数，在右侧选择绑定的COM端口</DialogDescription>
              </DialogHeader>
              <form id="instrument-form" onSubmit={handleSubmit(onSubmit)} className="space-y-4 mt-4">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="deviceCode">设备编码 *</Label>
                    <Input id="deviceCode" placeholder="如 C001, C002" {...register("deviceCode")} />
                    {errors.deviceCode && <p className="text-sm text-red-500">{errors.deviceCode.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="name">显示名称</Label>
                    <Input id="name" placeholder="可选，如 1号仪表" {...register("name")} />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label htmlFor="modelType">仪表型号 *</Label>
                    <Controller
                      name="modelType"
                      control={control}
                      render={({ field }) => (
                        <Select value={field.value || ""} onValueChange={field.onChange}>
                          <SelectTrigger>
                            <SelectValue placeholder="选择仪表型号" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DY7001">DY7001 (1个传感器通道)</SelectItem>
                            <SelectItem value="DY7004">DY7004 (4个传感器通道)</SelectItem>
                          </SelectContent>
                        </Select>
                      )}
                    />
                    {errors.modelType && <p className="text-sm text-red-500">{errors.modelType.message}</p>}
                  </div>
                  <div>
                    <Label htmlFor="slaveId">从站地址 *</Label>
                    <Input id="slaveId" type="number" min="1" max="247" placeholder="1-247" {...register("slaveId", { valueAsNumber: true })} />
                    {errors.slaveId && <p className="text-sm text-red-500">{errors.slaveId.message}</p>}
                  </div>
                </div>

                <div>
                  <Label>已选COM端口</Label>
                  <div className={`mt-1 px-3 py-2 rounded-md border text-sm ${selectedComPortId ? 'border-primary bg-primary/5' : 'border-dashed border-muted-foreground/40 text-muted-foreground'}`}>
                    {selectedComPortId ? (
                      <div className="flex items-center gap-2">
                        <Cable className="h-4 w-4 text-primary" />
                        <span className="font-medium">{getComPortInfo(selectedComPortId)}</span>
                        <Button type="button" variant="ghost" size="sm" className="h-6 ml-auto text-xs" onClick={() => setSelectedComPortId(null)}>
                          清除
                        </Button>
                      </div>
                    ) : (
                      "请在右侧面板中选择COM端口 →"
                    )}
                  </div>
                </div>

                <div>
                  <Label htmlFor="location">安装位置</Label>
                  <Input id="location" placeholder="可选，如 A区1号柜" {...register("location")} />
                </div>

                <div>
                  <Label htmlFor="remark">备注</Label>
                  <Textarea id="remark" placeholder="可选的备注信息" {...register("remark")} rows={2} />
                </div>

                <DialogFooter className="pt-2">
                  <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingInstrument(null); setSelectedComPortId(null); }}>
                    取消
                  </Button>
                  <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                    {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    {editingInstrument ? "保存" : "创建"}
                  </Button>
                </DialogFooter>
              </form>
            </div>

            {/* 右侧：网关→COM端口树形选择面板 */}
            <div className="w-[280px] border-l bg-muted/20 flex flex-col">
              <div className="px-4 py-3 border-b bg-muted/30">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Server className="h-4 w-4 text-primary" />
                  选择COM端口
                </h3>
                <p className="text-xs text-muted-foreground mt-1">展开网关查看COM端口</p>
              </div>
              <ScrollArea className="flex-1 max-h-[500px]">
                <div className="p-2">
                  {gatewaysLoading || comPortsLoading ? (
                    <div className="flex justify-center py-8">
                      <Loader2 className="h-5 w-5 animate-spin" />
                    </div>
                  ) : gateways && gateways.length > 0 ? (
                    <div className="space-y-1">
                      {gateways.map(gateway => {
                        const ports = comPortsByGateway.get(gateway.id) || [];
                        const isExpanded = expandedGateways.has(gateway.id);
                        const hasSelectedPort = ports.some(p => p.id === selectedComPortId);

                        return (
                          <div key={gateway.id}>
                            {/* 网关节点 */}
                            <button
                              type="button"
                              className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors hover:bg-accent/50 ${hasSelectedPort ? 'bg-primary/5' : ''}`}
                              onClick={() => toggleGatewayExpand(gateway.id)}
                            >
                              {isExpanded ? (
                                <ChevronDown className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              ) : (
                                <ChevronRightIcon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              )}
                              <Server className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="truncate font-medium">{gateway.name}</span>
                              <Badge variant={gateway.status === "online" ? "default" : "secondary"} className="text-[10px] px-1 py-0 ml-auto shrink-0">
                                {gateway.status === "online" ? "在线" : "离线"}
                              </Badge>
                            </button>

                            {/* COM端口子节点 */}
                            {isExpanded && (
                              <div className="ml-5 mt-0.5 space-y-0.5">
                                {ports.length > 0 ? (
                                  ports.map(port => {
                                    const isSelected = port.id === selectedComPortId;
                                    return (
                                      <button
                                        key={port.id}
                                        type="button"
                                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-md text-sm transition-colors ${
                                          isSelected
                                            ? 'bg-primary/15 text-primary border border-primary/30'
                                            : 'hover:bg-accent/50'
                                        }`}
                                        onClick={() => setSelectedComPortId(isSelected ? null : port.id)}
                                      >
                                        <Cable className={`h-3.5 w-3.5 shrink-0 ${isSelected ? 'text-primary' : 'text-muted-foreground'}`} />
                                        <span className="truncate">{port.portNumber}</span>
                                        <span className="text-[10px] text-muted-foreground ml-auto shrink-0">{port.baudRate}</span>
                                      </button>
                                    );
                                  })
                                ) : (
                                  <div className="px-2 py-1.5 text-xs text-muted-foreground">
                                    暂无COM端口
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="text-center py-8 text-sm text-muted-foreground">
                      暂无网关设备
                    </div>
                  )}
                </div>
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
