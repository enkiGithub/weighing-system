import { useState, useMemo, Fragment } from "react";
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
import { Switch } from "@/components/ui/switch";
import {
  Plus, Edit, Trash2, Loader2, WifiOff, Wifi,
  ChevronLeft, ChevronRight, ChevronDown, ChevronRight as ChevronRightIcon,
  Server, Cable, Radio, Zap, Activity,
} from "lucide-react";
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

// 通道子行组件（含内联编辑和通信测试）
function ChannelSubRows({ instrumentId }: { instrumentId: number }) {
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);

  // 编辑表单状态
  const [editLabel, setEditLabel] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editScale, setEditScale] = useState(1.0);
  const [editOffset, setEditOffset] = useState(0.0);
  const [editUnit, setEditUnit] = useState("g");
  const [editPrecision, setEditPrecision] = useState(2);
  const [editRemark, setEditRemark] = useState("");

  const utils = trpc.useUtils();

  const { data: channels, isLoading } = trpc.channels.listByInstrument.useQuery(
    { instrumentId },
    { enabled: true }
  );

  // 更新通道
  const updateMutation = trpc.channels.update.useMutation({
    onSuccess: () => {
      utils.channels.listByInstrument.invalidate({ instrumentId });
      toast.success("通道参数更新成功");
      setIsEditDialogOpen(false);
      setEditingChannel(null);
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  // 通信测试
  const testReadMutation = trpc.channels.testRead.useMutation({
    onSuccess: (data) => {
      utils.channels.listByInstrument.invalidate({ instrumentId });
      toast.success(
        `通信测试成功！原始值: ${data.rawValue}，校准值: ${data.calibratedValue} ${data.unit}`
      );
      setTestingChannelId(null);
    },
    onError: (error) => {
      toast.error(`通信测试失败: ${error.message}`);
      setTestingChannelId(null);
    },
  });

  const handleEdit = (channel: any) => {
    setEditingChannel(channel);
    setEditLabel(channel.label);
    setEditEnabled(!!channel.enabled);
    setEditScale(channel.scale);
    setEditOffset(channel.offset);
    setEditUnit(channel.unit);
    setEditPrecision(channel.precision);
    setEditRemark(channel.remark || "");
    setIsEditDialogOpen(true);
  };

  const handleSave = () => {
    if (!editingChannel) return;
    updateMutation.mutate({
      id: editingChannel.id,
      label: editLabel,
      enabled: editEnabled ? 1 : 0,
      scale: editScale,
      offset: editOffset,
      unit: editUnit,
      precision: editPrecision,
      remark: editRemark || undefined,
    });
  };

  const handleTestRead = (channelId: number) => {
    setTestingChannelId(channelId);
    testReadMutation.mutate({ channelId });
  };

  // 快速切换启用/禁用
  const handleToggleEnabled = (channel: any) => {
    updateMutation.mutate({
      id: channel.id,
      enabled: channel.enabled ? 0 : 1,
    });
  };

  if (isLoading) {
    return (
      <TableRow>
        <TableCell colSpan={11} className="bg-muted/20 border-l-2 border-l-primary/20">
          <div className="flex items-center gap-2 ml-16 pl-4 py-2">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">加载通道信息...</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  if (!channels || channels.length === 0) {
    return (
      <TableRow>
        <TableCell colSpan={11} className="bg-muted/20 border-l-2 border-l-primary/20">
          <div className="flex items-center gap-2 ml-16 pl-4 py-3">
            <Radio className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground italic">暂无通道数据（通道在创建仪表时自动生成）</span>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  return (
    <>
      {channels.map((ch: any) => (
        <TableRow key={`ch-${ch.id}`} className="bg-muted/20 hover:bg-muted/30 border-l-2 border-l-primary/20">
          <TableCell colSpan={11}>
            <div className="flex items-center gap-3 ml-12 pl-4 border-l-2 border-l-amber-500/30 py-1.5">
              <Radio className="h-3.5 w-3.5 text-amber-500 shrink-0" />
              <span className="font-medium text-sm min-w-[60px]">{ch.label}</span>
              <Badge
                variant={ch.enabled ? "default" : "secondary"}
                className={`text-xs cursor-pointer select-none ${ch.enabled ? "bg-emerald-600/80 text-white hover:bg-emerald-700" : "hover:bg-muted"}`}
                onClick={() => handleToggleEnabled(ch)}
                title={ch.enabled ? "点击禁用" : "点击启用"}
              >
                {ch.enabled ? "启用" : "禁用"}
              </Badge>
              <span className="text-xs text-muted-foreground">
                {ch.unit} · {ch.precision}位精度
              </span>
              <span className="text-xs text-muted-foreground">
                校准: {ch.scale}× + {ch.offset}
              </span>
              {ch.currentValue !== null && ch.currentValue !== undefined && (
                <span className="text-xs font-medium text-primary">
                  当前值: {Number(ch.currentValue).toFixed(ch.precision)} {ch.unit}
                </span>
              )}
              {ch.lastReadAt && (
                <span className="text-xs text-muted-foreground">
                  最后读取: {new Date(ch.lastReadAt).toLocaleString()}
                </span>
              )}
              {/* 操作按钮 */}
              <div className="flex items-center gap-1 ml-auto shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleTestRead(ch.id)}
                  disabled={testingChannelId === ch.id}
                  title="通信测试"
                >
                  {testingChannelId === ch.id ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Zap className="h-3.5 w-3.5 text-amber-500" />
                  )}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 w-7 p-0"
                  onClick={() => handleEdit(ch)}
                  title="编辑通道参数"
                >
                  <Edit className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
          </TableCell>
        </TableRow>
      ))}

      {/* 通道参数编辑对话框 */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Activity className="h-5 w-5" />
              编辑通道参数
            </DialogTitle>
            <DialogDescription>
              修改通道 <span className="font-semibold text-foreground">{editingChannel?.label}</span> 的校准和显示参数
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="ch-label">通道标签</Label>
              <Input
                id="ch-label"
                value={editLabel}
                onChange={(e) => setEditLabel(e.target.value)}
                placeholder="例如：CH1-仪表A"
              />
            </div>

            <div className="flex items-center justify-between">
              <div>
                <Label>启用状态</Label>
                <p className="text-xs text-muted-foreground">禁用后通道不参与数据采集</p>
              </div>
              <Switch checked={editEnabled} onCheckedChange={setEditEnabled} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ch-scale">校准系数 (Scale)</Label>
                <Input
                  id="ch-scale"
                  type="number"
                  step="0.001"
                  value={editScale}
                  onChange={(e) => setEditScale(parseFloat(e.target.value) || 1.0)}
                />
                <p className="text-xs text-muted-foreground">校准值 = 原始值 × 系数 + 偏移</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ch-offset">偏移量 (Offset)</Label>
                <Input
                  id="ch-offset"
                  type="number"
                  step="0.01"
                  value={editOffset}
                  onChange={(e) => setEditOffset(parseFloat(e.target.value) || 0.0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="ch-unit">单位</Label>
                <Select value={editUnit} onValueChange={setEditUnit}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="g">克 (g)</SelectItem>
                    <SelectItem value="kg">千克 (kg)</SelectItem>
                    <SelectItem value="t">吨 (t)</SelectItem>
                    <SelectItem value="N">牛顿 (N)</SelectItem>
                    <SelectItem value="mV/V">mV/V</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="ch-precision">小数精度</Label>
                <Select value={editPrecision.toString()} onValueChange={(val) => setEditPrecision(parseInt(val))}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {[0, 1, 2, 3, 4, 5, 6].map(p => (
                      <SelectItem key={p} value={p.toString()}>{p} 位小数</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="ch-remark">备注</Label>
              <Textarea
                id="ch-remark"
                value={editRemark}
                onChange={(e) => setEditRemark(e.target.value)}
                placeholder="通道备注信息"
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setIsEditDialogOpen(false)}>
              取消
            </Button>
            <Button onClick={handleSave} disabled={updateMutation.isPending}>
              {updateMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              保存
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default function Devices() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<any>(null);
  const [selectedComPortId, setSelectedComPortId] = useState<number | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<number | null>(null);

  // 分页和多选状态
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());

  // 仪表展开状态（查看通道）
  const [expandedInstrumentIds, setExpandedInstrumentIds] = useState<Set<number>>(new Set());

  // 树形面板展开状态（对话框中网关→COM端口）
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

  // 展开/收起仪表
  const toggleInstrumentExpand = (id: number) => {
    setExpandedInstrumentIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  // 仪表mutations
  const createMutation = trpc.instruments.create.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表创建成功，通道已自动生成");
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
    onSuccess: (data) => {
      if (data.needConfirm && data.boundChannels) {
        const msg = `该仪表的通道 ${data.boundChannels.join(", ")} 已被柜组绑定。\n确认删除将自动解除这些绑定，是否继续？`;
        if (confirm(msg)) {
          deleteMutation.mutate({ id: pendingDeleteId!, force: true });
        }
        return;
      }
      utils.instruments.list.invalidate();
      toast.success("仪表及其通道已删除");
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  const batchDeleteMutation = trpc.instruments.batchDelete.useMutation({
    onSuccess: (data) => {
      if (data.needConfirm && data.boundInstruments) {
        const details = data.boundInstruments.map((b: any) => `仪表#${b.id}的通道 ${b.channels.join(",")}`).join("\n");
        const msg = `以下仪表的通道已被柜组绑定：\n${details}\n\n确认删除将自动解除这些绑定，是否继续？`;
        if (confirm(msg)) {
          batchDeleteMutation.mutate({ ids: Array.from(selectedIds), force: true });
        }
        return;
      }
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
    if (confirm(`确定要删除选中的 ${selectedIds.size} 个仪表吗？相关通道将一并删除。`)) {
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
          <p className="text-muted-foreground mt-2">
            管理所有RS485称重仪表及其通道。创建仪表时根据型号自动生成通道（DY7001: 1通道, DY7004: 4通道），通道数量固定不可增减。
          </p>
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
          <CardDescription>
            点击行首 ▶ 箭头展开查看通道配置。每个通道可直接编辑参数或进行通信测试。
          </CardDescription>
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
                      <TableHead className="w-10"></TableHead>
                      <TableHead className="w-16">序号</TableHead>
                      <TableHead>设备编码</TableHead>
                      <TableHead>名称</TableHead>
                      <TableHead>型号</TableHead>
                      <TableHead>COM端口</TableHead>
                      <TableHead>从站地址</TableHead>
                      <TableHead>状态</TableHead>
                      <TableHead>备注</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedInstruments.map((instrument, index) => {
                      const isExpanded = expandedInstrumentIds.has(instrument.id);
                      return (
                        <Fragment key={instrument.id}>
                          <TableRow
                            className={`${selectedIds.has(instrument.id) ? "bg-muted/50" : ""} ${isExpanded ? "border-b-0" : ""}`}
                          >
                            <TableCell>
                              <Checkbox
                                checked={selectedIds.has(instrument.id)}
                                onCheckedChange={() => handleToggleSelect(instrument.id)}
                                aria-label={`选择 ${instrument.name}`}
                              />
                            </TableCell>
                            <TableCell>
                              <button
                                onClick={() => toggleInstrumentExpand(instrument.id)}
                                className="p-1 rounded hover:bg-muted transition-colors"
                                title={isExpanded ? "收起通道" : "展开查看通道配置"}
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
                            <TableCell className="text-sm text-muted-foreground max-w-xs truncate">{instrument.remark || "-"}</TableCell>
                            <TableCell className="text-right space-x-1">
                              <Button variant="ghost" size="sm" onClick={() => handleEdit(instrument)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => {
                                if (confirm("确定要删除此仪表吗？相关通道将一并删除。")) {
                                  setPendingDeleteId(instrument.id);
                                  deleteMutation.mutate({ id: instrument.id });
                                }
                              }}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                          {isExpanded && <ChannelSubRows instrumentId={instrument.id} />}
                        </Fragment>
                      );
                    })}
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
              暂无仪表数据，点击"添加仪表"开始配置
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
                <DialogDescription>
                  {editingInstrument
                    ? "修改仪表参数。型号确定后通道数量固定不可更改。"
                    : "配置RS485称重仪表参数。选择型号后将自动生成对应通道（DY7001: CH1, DY7004: CH1-CH4）。"
                  }
                </DialogDescription>
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
                            <SelectItem value="DY7001">DY7001 (自动生成1个通道: CH1)</SelectItem>
                            <SelectItem value="DY7004">DY7004 (自动生成4个通道: CH1-CH4)</SelectItem>
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
                              <Badge variant="outline" className="text-[10px] ml-auto shrink-0">
                                {gateway.status === "online" ? "在线" : "离线"}
                              </Badge>
                            </button>

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
