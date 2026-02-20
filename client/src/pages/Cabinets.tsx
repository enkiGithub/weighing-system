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
import { Separator } from "@/components/ui/separator";
import {
  Plus, Edit, Trash2, Loader2, AlertTriangle, CheckCircle2,
  Link2, Unlink, Settings2, ChevronLeft, ChevronRight,
  ChevronDown, ChevronRightIcon, Gauge, Radio,
} from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { CabinetGroup } from "../../../drizzle/schema";

// 柜组基本信息schema - area替代assetCode
const cabinetSchema = z.object({
  area: z.string().max(100, "区域名称过长").optional(),
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  initialWeight: z.number().min(0, "初始重量不能为负数"),
  alarmThreshold: z.number().min(0, "报警阈值不能为负数"),
  remark: z.string().optional(),
});

type CabinetForm = z.infer<typeof cabinetSchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

// 展开行子组件：仪表列表
function InstrumentSubRow({ groupId }: { groupId: number }) {
  const [expandedInstrumentIds, setExpandedInstrumentIds] = useState<Set<number>>(new Set());

  const { data: boundInstruments, isLoading } = trpc.cabinetGroups.getBoundInstruments.useQuery(
    { groupId },
    { enabled: true }
  );

  const toggleInstrument = (id: number) => {
    setExpandedInstrumentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="bg-muted/20">
          <div className="flex items-center gap-2 pl-12 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">加载仪表信息...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (!boundInstruments || boundInstruments.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={10} className="bg-muted/20">
          <div className="flex items-center gap-2 pl-12 py-3">
            <Gauge className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground italic">暂无绑定仪表，请通过"配置绑定"添加通道</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {boundInstruments.map((inst: any) => {
        const isExpanded = expandedInstrumentIds.has(inst.id);
        return (
          <TableRow key={`inst-${inst.id}`} className="bg-muted/20 hover:bg-muted/30">
            <TableCell colSpan={10}>
              {/* 仪表行 */}
              <div className="flex items-center gap-2 pl-10">
                <button
                  onClick={() => toggleInstrument(inst.id)}
                  className="p-0.5 rounded hover:bg-muted transition-colors"
                >
                  {isExpanded ? (
                    <ChevronDown className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                  )}
                </button>
                <Gauge className="h-4 w-4 text-blue-500" />
                <span className="text-sm font-medium">{inst.name || inst.deviceCode}</span>
                <Badge variant="outline" className="text-xs">{inst.modelType}</Badge>
                <span className="text-xs text-muted-foreground">设备编码: {inst.deviceCode}</span>
                <span className="text-xs text-muted-foreground">· SlaveID: {inst.slaveId}</span>
                <Badge variant={inst.status === "online" ? "default" : "secondary"} className={`text-xs ${inst.status === "online" ? "bg-emerald-600 text-white" : ""}`}>
                  {inst.status === "online" ? "在线" : "离线"}
                </Badge>
                <span className="text-xs text-muted-foreground ml-auto">
                  {inst.channels?.length || 0} 个通道已绑定
                </span>
              </div>

              {/* 通道子行 */}
              {isExpanded && inst.channels && inst.channels.length > 0 && (
                <div className="pl-20 mt-2 mb-1 space-y-1">
                  {inst.channels.map((ch: any) => (
                    <div
                      key={`ch-${ch.id}`}
                      className="flex items-center gap-3 bg-background/60 rounded px-3 py-1.5 text-sm"
                    >
                      <Radio className="h-3.5 w-3.5 text-amber-500" />
                      <span className="font-medium min-w-[60px]">{ch.label}</span>
                      <Badge variant={ch.enabled ? "default" : "secondary"} className={`text-xs ${ch.enabled ? "bg-emerald-600/80 text-white" : ""}`}>
                        {ch.enabled ? "启用" : "禁用"}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        单位: {ch.unit} · 精度: {ch.precision}位
                      </span>
                      <span className="text-xs text-muted-foreground">
                        校准: {ch.scale}x + {ch.offset}
                      </span>
                      <span className="text-xs font-medium text-primary ml-auto">
                        绑定系数: {ch.coefficient} · 偏移: {ch.offset}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </TableCell>
          </TableRow>
        );
      })}
    </>
  );
}

export default function Cabinets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBindingDialogOpen, setIsBindingDialogOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<CabinetGroup | null>(null);
  const [bindingCabinetId, setBindingCabinetId] = useState<number | null>(null);

  // 展开状态
  const [expandedGroupIds, setExpandedGroupIds] = useState<Set<number>>(new Set());

  // 分页和多选状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 绑定配置状态
  const [selectedChannelId, setSelectedChannelId] = useState<number | null>(null);
  const [bindingCoefficient, setBindingCoefficient] = useState(1.0);
  const [bindingOffset, setBindingOffset] = useState(0.0);

  const utils = trpc.useUtils();

  // 查询数据
  const { data: cabinets, isLoading } = trpc.cabinetGroups.list.useQuery();
  const { data: allChannels } = trpc.channels.listAll.useQuery();

  // 查询当前柜组的通道绑定
  const { data: bindings, refetch: refetchBindings } = trpc.cabinetGroups.getBindings.useQuery(
    { groupId: bindingCabinetId || 0 },
    { enabled: !!bindingCabinetId }
  );

  // 分页计算
  const totalItems = cabinets?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedCabinets = useMemo(() => {
    if (!cabinets) return [];
    const start = (currentPage - 1) * pageSize;
    return cabinets.slice(start, start + pageSize);
  }, [cabinets, currentPage, pageSize]);

  const currentPageIds = useMemo(() => new Set(paginatedCabinets.map(c => c.id)), [paginatedCabinets]);
  const isAllSelected = paginatedCabinets.length > 0 && paginatedCabinets.every(c => selectedIds.has(c.id));
  const isSomeSelected = paginatedCabinets.some(c => selectedIds.has(c.id));

  // 可用通道列表（排除已绑定到其他柜组的通道）
  const availableChannels = useMemo(() => {
    if (!allChannels) return [];
    return allChannels.filter(ch => ch.enabled);
  }, [allChannels]);

  // 展开/收起柜组
  const toggleGroupExpand = (id: number) => {
    setExpandedGroupIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 柜组CRUD mutations
  const createMutation = trpc.cabinetGroups.create.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组创建成功");
      setIsDialogOpen(false);
      reset();
    },
    onError: (error: any) => toast.error(`创建失败: ${error.message}`),
  });

  const updateMutation = trpc.cabinetGroups.update.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组更新成功");
      setIsDialogOpen(false);
      setEditingCabinet(null);
      reset();
    },
    onError: (error: any) => toast.error(`更新失败: ${error.message}`),
  });

  const deleteMutation = trpc.cabinetGroups.delete.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组删除成功");
    },
    onError: (error: any) => toast.error(`删除失败: ${error.message}`),
  });

  const batchDeleteMutation = trpc.cabinetGroups.batchDelete.useMutation({
    onSuccess: (data: any) => {
      utils.cabinetGroups.list.invalidate();
      setSelectedIds(new Set());
      toast.success(`成功删除 ${data.count} 个保险柜组`);
    },
    onError: (error: any) => toast.error(`批量删除失败: ${error.message}`),
  });

  // 绑定mutations
  const addBindingMutation = trpc.cabinetGroups.addBinding.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.getBindings.invalidate();
      utils.cabinetGroups.getBoundInstruments.invalidate();
      refetchBindings();
      toast.success("通道绑定成功");
      setSelectedChannelId(null);
      setBindingCoefficient(1.0);
      setBindingOffset(0.0);
    },
    onError: (error: any) => toast.error(`绑定失败: ${error.message}`),
  });

  const removeBindingMutation = trpc.cabinetGroups.removeBinding.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.getBindings.invalidate();
      utils.cabinetGroups.getBoundInstruments.invalidate();
      refetchBindings();
      toast.success("通道绑定已移除");
    },
    onError: (error: any) => toast.error(`移除失败: ${error.message}`),
  });

  // 表单
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CabinetForm>({
    resolver: zodResolver(cabinetSchema),
  });

  const onSubmit = (data: CabinetForm) => {
    const dataInGrams = {
      ...data,
      area: data.area || "",
      initialWeight: Math.round(data.initialWeight * 1000),
      alarmThreshold: Math.round(data.alarmThreshold * 1000),
    };
    if (editingCabinet) {
      updateMutation.mutate({ id: editingCabinet.id, ...dataInGrams });
    } else {
      createMutation.mutate(dataInGrams);
    }
  };

  const handleEdit = (cabinet: CabinetGroup) => {
    setEditingCabinet(cabinet);
    reset({
      area: cabinet.area || "",
      name: cabinet.name,
      initialWeight: cabinet.initialWeight / 1000,
      alarmThreshold: cabinet.alarmThreshold / 1000,
      remark: cabinet.remark || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除此保险柜组吗？关联的通道绑定也将被删除。")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAdd = () => {
    setEditingCabinet(null);
    reset({ area: "", name: "", initialWeight: 0, alarmThreshold: 1, remark: "" });
    setIsDialogOpen(true);
  };

  // 多选操作
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
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个保险柜组吗？`)) {
      batchDeleteMutation.mutate({ ids: Array.from(selectedIds) });
    }
  };

  // 打开绑定配置对话框
  const handleOpenBinding = (cabinetId: number) => {
    setBindingCabinetId(cabinetId);
    setSelectedChannelId(null);
    setBindingCoefficient(1.0);
    setBindingOffset(0.0);
    setIsBindingDialogOpen(true);
  };

  // 添加通道绑定
  const handleAddBinding = () => {
    if (!bindingCabinetId || !selectedChannelId) {
      toast.error("请选择通道");
      return;
    }
    addBindingMutation.mutate({
      groupId: bindingCabinetId,
      channelId: selectedChannelId,
      coefficient: bindingCoefficient,
      offset: bindingOffset,
    });
  };

  // 获取通道显示信息
  const getChannelLabel = (channelId: number) => {
    const ch = allChannels?.find(c => c.id === channelId);
    if (!ch) return `通道#${channelId}`;
    return ch.label;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "normal":
        return (
          <Badge variant="default" className="gap-1 bg-emerald-600 text-white">
            <CheckCircle2 className="h-3 w-3" />
            正常
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="default" className="gap-1 bg-amber-500 text-white">
            <AlertTriangle className="h-3 w-3" />
            警告
          </Badge>
        );
      case "alarm":
        return (
          <Badge variant="destructive" className="gap-1">
            <AlertTriangle className="h-3 w-3" />
            报警
          </Badge>
        );
      default:
        return <Badge variant="secondary">未知</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">保险柜组管理</h1>
          <p className="text-muted-foreground mt-2">管理保险柜组配置，点击箭头展开查看绑定的仪表和通道</p>
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
            添加保险柜组
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>保险柜组列表</CardTitle>
          <CardDescription>点击行首箭头展开查看绑定的仪表和通道详情</CardDescription>
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
                    <TableHead className="w-10"></TableHead>
                    <TableHead className="w-16">序号</TableHead>
                    <TableHead>区域</TableHead>
                    <TableHead>名称</TableHead>
                    <TableHead>当前重量</TableHead>
                    <TableHead>初始重量</TableHead>
                    <TableHead>报警阈值</TableHead>
                    <TableHead>状态</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedCabinets.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={11} className="text-center text-muted-foreground py-8">
                        暂无保险柜组
                      </TableCell>
                    </TableRow>
                  ) : (
                    paginatedCabinets.map((cabinet, index) => {
                      const isExpanded = expandedGroupIds.has(cabinet.id);
                      return (
                        <>
                          <TableRow
                            key={cabinet.id}
                            className={`${selectedIds.has(cabinet.id) ? "bg-muted/50" : ""} ${isExpanded ? "border-b-0" : ""}`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(cabinet.id)}
                                onCheckedChange={() => handleToggleSelect(cabinet.id)}
                                aria-label={`选择 ${cabinet.name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => toggleGroupExpand(cabinet.id)}
                                className="p-1 rounded hover:bg-muted transition-colors"
                                title={isExpanded ? "收起" : "展开查看仪表"}
                              >
                                {isExpanded ? (
                                  <ChevronDown className="h-4 w-4 text-primary" />
                                ) : (
                                  <ChevronRightIcon className="h-4 w-4 text-muted-foreground" />
                                )}
                              </button>
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {(currentPage - 1) * pageSize + index + 1}
                            </TableCell>
                            <TableCell className="text-sm">
                              {cabinet.area || <span className="text-muted-foreground italic">未设置</span>}
                            </TableCell>
                            <TableCell className="font-medium">{cabinet.name}</TableCell>
                            <TableCell className="font-semibold">
                              {(cabinet.currentWeight / 1000).toFixed(2)} kg
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {(cabinet.initialWeight / 1000).toFixed(2)} kg
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {(cabinet.alarmThreshold / 1000).toFixed(2)} kg
                            </TableCell>
                            <TableCell>{getStatusBadge(cabinet.status)}</TableCell>
                            <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                              {cabinet.remark || "-"}
                            </TableCell>
                            <TableCell className="text-right">
                              <div className="flex justify-end gap-1">
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleOpenBinding(cabinet.id)}
                                  title="配置通道绑定"
                                >
                                  <Settings2 className="h-4 w-4 text-primary" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleEdit(cabinet)}
                                  title="编辑"
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleDelete(cabinet.id)}
                                  title="删除"
                                >
                                  <Trash2 className="h-4 w-4 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          {isExpanded && <InstrumentSubRow groupId={cabinet.id} />}
                        </>
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
          )}
        </CardContent>
      </Card>

      {/* 基本信息编辑对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCabinet ? "编辑保险柜组" : "添加保险柜组"}</DialogTitle>
            <DialogDescription>
              {editingCabinet ? "修改保险柜组基本配置" : "创建新的保险柜组，创建后可配置通道绑定"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="area">区域</Label>
                <Input id="area" placeholder="例如：A区、B区、1号库房" {...register("area")} />
                {errors.area && <p className="text-sm text-destructive">{errors.area.message}</p>}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="name">名称 *</Label>
                <Input id="name" placeholder="例如：1号保险柜组" {...register("name")} />
                {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="initialWeight">初始重量 (kg) *</Label>
                  <Input id="initialWeight" type="number" step="0.01" placeholder="0.00" {...register("initialWeight", { valueAsNumber: true })} />
                  {errors.initialWeight && <p className="text-sm text-destructive">{errors.initialWeight.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alarmThreshold">报警阈值 (kg) *</Label>
                  <Input id="alarmThreshold" type="number" step="0.01" placeholder="1.00" {...register("alarmThreshold", { valueAsNumber: true })} />
                  {errors.alarmThreshold && <p className="text-sm text-destructive">{errors.alarmThreshold.message}</p>}
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="remark">备注</Label>
                <Textarea id="remark" placeholder="保险柜组的备注信息" {...register("remark")} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingCabinet(null); reset(); }}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingCabinet ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* 通道绑定配置对话框 */}
      <Dialog open={isBindingDialogOpen} onOpenChange={setIsBindingDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              配置通道绑定
            </DialogTitle>
            <DialogDescription>
              为柜组 <span className="font-semibold text-foreground">{cabinets?.find(c => c.id === bindingCabinetId)?.name}</span> 配置仪表通道绑定关系
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 已绑定的通道列表 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                <h3 className="text-base font-semibold">已绑定通道</h3>
              </div>

              {bindings && bindings.length > 0 ? (
                <div className="space-y-2">
                  {bindings.map((binding: any) => (
                    <div key={binding.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <Link2 className="h-4 w-4 text-primary" />
                        <span className="text-sm font-medium">{getChannelLabel(binding.channelId)}</span>
                        <Badge variant="outline" className="text-xs">
                          系数: {binding.coefficient}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          偏移: {binding.offset}
                        </Badge>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => removeBindingMutation.mutate({ id: binding.id })}
                        disabled={removeBindingMutation.isPending}
                      >
                        <Unlink className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-sm text-muted-foreground bg-muted/30 rounded-lg p-3">
                  暂无绑定通道
                </div>
              )}
            </div>

            <Separator />

            {/* 添加新的通道绑定 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                <h3 className="text-base font-semibold">添加通道绑定</h3>
              </div>

              <div className="border rounded-lg p-4 space-y-4">
                <div className="space-y-2">
                  <Label className="text-sm">选择通道</Label>
                  <Select
                    value={selectedChannelId?.toString() || ""}
                    onValueChange={(val) => setSelectedChannelId(parseInt(val))}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择仪表通道" />
                    </SelectTrigger>
                    <SelectContent>
                      {availableChannels.map(ch => (
                        <SelectItem key={ch.id} value={ch.id.toString()}>
                          {ch.label} (仪表ID: {ch.instrumentId})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-sm">权重系数</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bindingCoefficient}
                      onChange={(e) => setBindingCoefficient(parseFloat(e.target.value) || 1.0)}
                    />
                    <p className="text-xs text-muted-foreground">通道值 × 系数 + 偏移 = 最终重量贡献</p>
                  </div>
                  <div className="space-y-2">
                    <Label className="text-sm">偏移量</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={bindingOffset}
                      onChange={(e) => setBindingOffset(parseFloat(e.target.value) || 0.0)}
                    />
                  </div>
                </div>

                <Button
                  size="sm"
                  onClick={handleAddBinding}
                  disabled={!selectedChannelId || addBindingMutation.isPending}
                >
                  {addBindingMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  <Plus className="mr-1 h-3 w-3" />
                  添加绑定
                </Button>
              </div>

              <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                <strong>计算公式：</strong>柜组总重量 = Σ (通道值 × 系数 + 偏移)，每个绑定的通道值经过系数和偏移校正后累加得到最终重量。
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsBindingDialogOpen(false)}>
              关闭
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
