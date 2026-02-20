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
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Loader2, WifiOff, Wifi, ChevronLeft, ChevronRight, Cable, Settings2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import type { Gateway } from "../../../drizzle/schema";

const gatewaySchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  ipAddress: z.string().min(1, "IP地址不能为空").max(45, "IP地址过长"),
  port: z.number().int().min(1, "端口必须大于0").max(65535, "端口号无效"),
  model: z.string().max(50).optional(),
  remark: z.string().optional(),
});

type GatewayForm = z.infer<typeof gatewaySchema>;

// COM端口表单schema
const comPortSchema = z.object({
  portNumber: z.string().min(1, "端口号不能为空").max(10),
  baudRate: z.number().int().optional(),
  dataBits: z.number().int().optional(),
  stopBits: z.number().int().optional(),
  parity: z.string().optional(),
  protocolType: z.string().max(30).optional(),
  timeoutMs: z.number().int().optional(),
  retryCount: z.number().int().optional(),
  remark: z.string().optional(),
});

type ComPortForm = z.infer<typeof comPortSchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Gateways() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingGateway, setEditingGateway] = useState<Gateway | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // COM端口管理状态
  const [isComPortDialogOpen, setIsComPortDialogOpen] = useState(false);
  const [editingComPort, setEditingComPort] = useState<any>(null);
  const [comPortGatewayId, setComPortGatewayId] = useState<number | null>(null);

  const utils = trpc.useUtils();

  const { data: gateways, isLoading } = trpc.gateways.list.useQuery();

  // 查询当前编辑网关的COM端口
  const { data: comPorts, isLoading: comPortsLoading } = trpc.gatewayComPorts.listByGateway.useQuery(
    { gatewayId: comPortGatewayId || 0 },
    { enabled: !!comPortGatewayId }
  );

  // 分页计算
  const totalItems = gateways?.length || 0;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedGateways = useMemo(() => {
    if (!gateways) return [];
    const start = (currentPage - 1) * pageSize;
    return gateways.slice(start, start + pageSize);
  }, [gateways, currentPage, pageSize]);

  const currentPageIds = useMemo(() => new Set(paginatedGateways.map(g => g.id)), [paginatedGateways]);
  const isAllSelected = paginatedGateways.length > 0 && paginatedGateways.every(g => selectedIds.has(g.id));
  const isSomeSelected = paginatedGateways.some(g => selectedIds.has(g.id));

  // 网关mutations
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

  // COM端口mutations
  const createComPortMutation = trpc.gatewayComPorts.create.useMutation({
    onSuccess: () => {
      utils.gatewayComPorts.listByGateway.invalidate();
      toast.success("COM端口创建成功");
      setIsComPortDialogOpen(false);
      resetComPortForm();
    },
    onError: (error) => toast.error(`创建失败: ${error.message}`),
  });

  const updateComPortMutation = trpc.gatewayComPorts.update.useMutation({
    onSuccess: () => {
      utils.gatewayComPorts.listByGateway.invalidate();
      toast.success("COM端口更新成功");
      setIsComPortDialogOpen(false);
      setEditingComPort(null);
      resetComPortForm();
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  const deleteComPortMutation = trpc.gatewayComPorts.delete.useMutation({
    onSuccess: () => {
      utils.gatewayComPorts.listByGateway.invalidate();
      toast.success("COM端口删除成功");
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  // 网关表单
  const { register, handleSubmit, reset, formState: { errors } } = useForm<GatewayForm>({
    resolver: zodResolver(gatewaySchema),
  });

  // COM端口表单
  const {
    register: registerComPort,
    handleSubmit: handleComPortSubmit,
    reset: resetComPortForm,
    control: controlComPort,
    formState: { errors: comPortErrors },
  } = useForm<ComPortForm>({
    resolver: zodResolver(comPortSchema),
    defaultValues: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none", protocolType: "modbus_rtu", timeoutMs: 1000, retryCount: 3 },
  });

  const onSubmit = (data: GatewayForm) => {
    if (editingGateway) {
      updateMutation.mutate({ id: editingGateway.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const onComPortSubmit = (data: any) => {
    if (!comPortGatewayId) return;
    if (editingComPort) {
      updateComPortMutation.mutate({ id: editingComPort.id, ...data });
    } else {
      createComPortMutation.mutate({ gatewayId: comPortGatewayId, ...data });
    }
  };

  const handleEdit = (gateway: Gateway) => {
    setEditingGateway(gateway);
    setComPortGatewayId(gateway.id);
    reset({
      name: gateway.name,
      ipAddress: gateway.ipAddress,
      port: gateway.port,
      model: gateway.model || "",
      remark: gateway.remark || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除此网关吗？关联的COM端口也将被删除。")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAdd = () => {
    setEditingGateway(null);
    setComPortGatewayId(null);
    reset({ name: "", ipAddress: "", port: 502, model: "", remark: "" });
    setIsDialogOpen(true);
  };

  const handleEditComPort = (port: any) => {
    setEditingComPort(port);
    resetComPortForm({
      portNumber: port.portNumber,
      baudRate: port.baudRate,
      dataBits: port.dataBits,
      stopBits: port.stopBits,
      parity: port.parity,
      protocolType: port.protocolType || "modbus_rtu",
      timeoutMs: port.timeoutMs || 1000,
      retryCount: port.retryCount || 3,
      remark: port.remark || "",
    });
    setIsComPortDialogOpen(true);
  };

  const handleAddComPort = () => {
    setEditingComPort(null);
    resetComPortForm({ baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none", protocolType: "modbus_rtu", timeoutMs: 1000, retryCount: 3 });
    setIsComPortDialogOpen(true);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">网关配置</h1>
          <p className="text-muted-foreground mt-2">管理所有RS485网关设备及其COM端口配置</p>
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
          <CardDescription>查看和管理所有网关设备的配置信息，点击编辑可管理COM端口</CardDescription>
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
                    <TableHead>型号</TableHead>
                    <TableHead>备注</TableHead>
                    <TableHead className="text-right">操作</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedGateways.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={10} className="text-center text-muted-foreground py-8">
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
                        <TableCell className="text-sm">
                          {gateway.model || "-"}
                        </TableCell>
                        <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                          {gateway.remark || "-"}
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="flex justify-end gap-1">
                            <Button variant="ghost" size="sm" onClick={() => handleEdit(gateway)} title="编辑网关及COM端口">
                              <Settings2 className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => handleDelete(gateway.id)} title="删除网关">
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

      {/* 网关添加/编辑对话框（含COM端口管理） */}
      <Dialog open={isDialogOpen} onOpenChange={(open) => {
        setIsDialogOpen(open);
        if (!open) {
          setEditingGateway(null);
          setComPortGatewayId(null);
        }
      }}>
        <DialogContent className="sm:max-w-[750px] max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingGateway ? "编辑网关" : "添加网关"}</DialogTitle>
            <DialogDescription>
              {editingGateway ? "修改网关配置信息及管理COM端口" : "创建新的RS485网关"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="name">名称 *</Label>
                  <Input id="name" placeholder="例如：1号网关" {...register("name")} />
                  {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="model">型号</Label>
                  <Input id="model" placeholder="例如：ZLAN6808" {...register("model")} />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="grid gap-2">
                <Label htmlFor="remark">备注</Label>
                <Textarea id="remark" placeholder="网关的备注信息" {...register("remark")} rows={2} />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => { setIsDialogOpen(false); setEditingGateway(null); setComPortGatewayId(null); reset(); }}>
                取消
              </Button>
              <Button type="submit" disabled={createMutation.isPending || updateMutation.isPending}>
                {(createMutation.isPending || updateMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {editingGateway ? "保存网关" : "创建网关"}
              </Button>
            </DialogFooter>
          </form>

          {/* COM端口管理区域（仅编辑模式显示） */}
          {editingGateway && comPortGatewayId && (
            <>
              <Separator className="my-2" />
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Cable className="h-4 w-4 text-primary" />
                    <h3 className="text-sm font-semibold">COM端口配置</h3>
                    <Badge variant="outline" className="text-xs">{comPorts?.length || 0} 个端口</Badge>
                  </div>
                  <Button size="sm" variant="outline" onClick={handleAddComPort}>
                    <Plus className="mr-1 h-3 w-3" />
                    添加端口
                  </Button>
                </div>

                {comPortsLoading ? (
                  <div className="flex justify-center py-4">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : comPorts && comPorts.length > 0 ? (
                  <div className="border rounded-lg overflow-hidden">
                    <Table>
                      <TableHeader>
                        <TableRow className="bg-muted/30">
                          <TableHead className="text-xs h-8">端口号</TableHead>
                          <TableHead className="text-xs h-8">波特率</TableHead>
                          <TableHead className="text-xs h-8">数据位/停止位/校验</TableHead>
                          <TableHead className="text-xs h-8">协议</TableHead>
                          <TableHead className="text-xs h-8">超时/重试</TableHead>
                          <TableHead className="text-xs h-8">备注</TableHead>
                          <TableHead className="text-xs h-8 text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {comPorts.map((port) => (
                          <TableRow key={port.id}>
                            <TableCell className="text-sm font-medium py-2">{port.portNumber}</TableCell>
                            <TableCell className="text-sm py-2">{port.baudRate}</TableCell>
                            <TableCell className="text-sm py-2">{port.dataBits}/{port.stopBits}/{port.parity}</TableCell>
                            <TableCell className="text-xs py-2">
                              <Badge variant="outline" className="text-xs">{port.protocolType}</Badge>
                            </TableCell>
                            <TableCell className="text-xs py-2">{port.timeoutMs}ms / {port.retryCount}次</TableCell>
                            <TableCell className="text-xs text-muted-foreground py-2 max-w-[100px] truncate">{port.remark || "-"}</TableCell>
                            <TableCell className="text-right py-2">
                              <div className="flex justify-end gap-1">
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => handleEditComPort(port)}>
                                  <Edit className="h-3 w-3" />
                                </Button>
                                <Button variant="ghost" size="sm" className="h-7 w-7 p-0" onClick={() => {
                                  if (confirm("确定要删除此COM端口吗？")) {
                                    deleteComPortMutation.mutate({ id: port.id });
                                  }
                                }}>
                                  <Trash2 className="h-3 w-3 text-destructive" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground border rounded-lg bg-muted/10">
                    暂无COM端口，点击上方按钮添加
                  </div>
                )}
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>

      {/* COM端口添加/编辑子对话框 */}
      <Dialog open={isComPortDialogOpen} onOpenChange={setIsComPortDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingComPort ? "编辑COM端口" : "添加COM端口"}</DialogTitle>
            <DialogDescription>配置RS485串口通信参数</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleComPortSubmit(onComPortSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="portNumber">端口号 *</Label>
              <Input id="portNumber" placeholder="如 COM1, COM2" {...registerComPort("portNumber")} />
              {comPortErrors.portNumber && <p className="text-sm text-red-500">{comPortErrors.portNumber.message}</p>}
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label htmlFor="baudRate">波特率</Label>
                <Input id="baudRate" type="number" {...registerComPort("baudRate", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="dataBits">数据位</Label>
                <Input id="dataBits" type="number" {...registerComPort("dataBits", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="stopBits">停止位</Label>
                <Input id="stopBits" type="number" {...registerComPort("stopBits", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="parity">奇偶校验</Label>
                <Controller
                  name="parity"
                  control={controlComPort}
                  render={({ field }) => (
                    <Select value={field.value || "none"} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">无</SelectItem>
                        <SelectItem value="odd">奇</SelectItem>
                        <SelectItem value="even">偶</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
              <div>
                <Label htmlFor="protocolType">协议类型</Label>
                <Controller
                  name="protocolType"
                  control={controlComPort}
                  render={({ field }) => (
                    <Select value={field.value || "modbus_rtu"} onValueChange={field.onChange}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="modbus_rtu">Modbus RTU</SelectItem>
                        <SelectItem value="custom">自定义协议</SelectItem>
                      </SelectContent>
                    </Select>
                  )}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="timeoutMs">超时(ms)</Label>
                <Input id="timeoutMs" type="number" {...registerComPort("timeoutMs", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="retryCount">重试次数</Label>
                <Input id="retryCount" type="number" {...registerComPort("retryCount", { valueAsNumber: true })} />
              </div>
            </div>

            <div>
              <Label htmlFor="comPortRemark">备注</Label>
              <Textarea id="comPortRemark" placeholder="可选的备注信息" {...registerComPort("remark")} rows={2} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsComPortDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={createComPortMutation.isPending || updateComPortMutation.isPending}>
                {(createComPortMutation.isPending || updateComPortMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
