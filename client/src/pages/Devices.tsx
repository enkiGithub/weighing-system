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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Loader2, WifiOff, Wifi, ChevronLeft, ChevronRight } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";

// COM端口表单schema
const comPortSchema = z.object({
  gatewayId: z.number({ message: "请选择网关" }),
  portNumber: z.string().min(1, "端口号不能为空").max(10),
  baudRate: z.number().int().optional(),
  dataBits: z.number().int().optional(),
  stopBits: z.number().int().optional(),
  parity: z.string().optional(),
  description: z.string().optional(),
});

type ComPortForm = z.infer<typeof comPortSchema>;

// 仪表表单schema
const instrumentSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  modelType: z.enum(["DY7001", "DY7004"], { message: "请选择仪表型号" }),
  gatewayComPortId: z.number({ message: "请选择网关COM端口" }),
  slaveAddress: z.number().int().min(1, "从站地址必须大于0").max(247, "从站地址无效"),
  description: z.string().optional(),
});

type InstrumentForm = z.infer<typeof instrumentSchema>;

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Devices() {
  const [activeTab, setActiveTab] = useState("comports");
  const [isComPortDialogOpen, setIsComPortDialogOpen] = useState(false);
  const [isInstrumentDialogOpen, setIsInstrumentDialogOpen] = useState(false);
  const [editingComPort, setEditingComPort] = useState<any>(null);
  const [editingInstrument, setEditingInstrument] = useState<any>(null);
  const [selectedGatewayId, setSelectedGatewayId] = useState<number | null>(null);

  // 仪表分页和多选状态
  const [instrumentPage, setInstrumentPage] = useState(1);
  const [instrumentPageSize, setInstrumentPageSize] = useState(10);
  const [selectedInstrumentIds, setSelectedInstrumentIds] = useState<Set<number>>(new Set());

  const utils = trpc.useUtils();

  // 查询数据
  const { data: gateways, isLoading: gatewaysLoading } = trpc.gateways.list.useQuery();
  const { data: comPorts, isLoading: comPortsLoading } = trpc.gatewayComPorts.listByGateway.useQuery(
    { gatewayId: selectedGatewayId || 0 },
    { enabled: !!selectedGatewayId }
  );
  const { data: instruments, isLoading: instrumentsLoading } = trpc.instruments.list.useQuery();

  // 仪表分页
  const totalInstruments = instruments?.length || 0;
  const totalInstrumentPages = Math.max(1, Math.ceil(totalInstruments / instrumentPageSize));
  const paginatedInstruments = useMemo(() => {
    if (!instruments) return [];
    const start = (instrumentPage - 1) * instrumentPageSize;
    return instruments.slice(start, start + instrumentPageSize);
  }, [instruments, instrumentPage, instrumentPageSize]);

  const currentInstrumentPageIds = useMemo(() => new Set(paginatedInstruments.map(i => i.id)), [paginatedInstruments]);
  const isAllInstrumentsSelected = paginatedInstruments.length > 0 && paginatedInstruments.every(i => selectedInstrumentIds.has(i.id));
  const isSomeInstrumentsSelected = paginatedInstruments.some(i => selectedInstrumentIds.has(i.id));

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

  // 仪表mutations
  const createInstrumentMutation = trpc.instruments.create.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表创建成功");
      setIsInstrumentDialogOpen(false);
      resetInstrumentForm();
    },
    onError: (error) => toast.error(`创建失败: ${error.message}`),
  });

  const updateInstrumentMutation = trpc.instruments.update.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表更新成功");
      setIsInstrumentDialogOpen(false);
      setEditingInstrument(null);
      resetInstrumentForm();
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  const deleteInstrumentMutation = trpc.instruments.delete.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表删除成功");
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  const batchDeleteInstrumentMutation = trpc.instruments.batchDelete.useMutation({
    onSuccess: (data) => {
      utils.instruments.list.invalidate();
      setSelectedInstrumentIds(new Set());
      toast.success(`成功删除 ${data.count} 个仪表`);
    },
    onError: (error) => toast.error(`批量删除失败: ${error.message}`),
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
    defaultValues: { baudRate: 9600, dataBits: 8, stopBits: 1, parity: "none" },
  });

  // 仪表表单
  const {
    register: registerInstrument,
    handleSubmit: handleInstrumentSubmit,
    reset: resetInstrumentForm,
    control: controlInstrument,
    formState: { errors: instrumentErrors },
  } = useForm<InstrumentForm>({
    resolver: zodResolver(instrumentSchema),
  });

  // COM端口提交
  const onComPortSubmit = (data: any) => {
    if (editingComPort) {
      updateComPortMutation.mutate({ id: editingComPort.id, ...data });
    } else {
      createComPortMutation.mutate(data);
    }
  };

  // 仪表提交
  const onInstrumentSubmit = (data: any) => {
    if (editingInstrument) {
      updateInstrumentMutation.mutate({ id: editingInstrument.id, ...data });
    } else {
      createInstrumentMutation.mutate(data);
    }
  };

  // 编辑COM端口
  const handleEditComPort = (port: any) => {
    setEditingComPort(port);
    resetComPortForm({
      gatewayId: port.gatewayId,
      portNumber: port.portNumber,
      baudRate: port.baudRate,
      dataBits: port.dataBits,
      stopBits: port.stopBits,
      parity: port.parity,
      description: port.description || "",
    });
    setIsComPortDialogOpen(true);
  };

  // 编辑仪表
  const handleEditInstrument = (instrument: any) => {
    setEditingInstrument(instrument);
    resetInstrumentForm({
      name: instrument.name,
      modelType: instrument.modelType,
      gatewayComPortId: instrument.gatewayComPortId,
      slaveAddress: instrument.slaveAddress,
      description: instrument.description || "",
    });
    setIsInstrumentDialogOpen(true);
  };

  // 获取COM端口信息（全局查找）
  const getComPortInfo = (comPortId: number | null) => {
    if (!comPortId || !gateways) return "未配置";
    // 遍历所有网关查找
    for (const gw of gateways) {
      // 简单显示网关名+端口ID
      if (comPorts && selectedGatewayId === gw.id) {
        const port = comPorts.find(p => p.id === comPortId);
        if (port) return `${gw.name} - ${port.portNumber}`;
      }
    }
    return `COM端口#${comPortId}`;
  };

  // 仪表多选操作
  const handleToggleInstrument = (id: number) => {
    const next = new Set(selectedInstrumentIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedInstrumentIds(next);
  };

  const handleToggleAllInstruments = () => {
    if (isAllInstrumentsSelected) {
      const next = new Set(selectedInstrumentIds);
      currentInstrumentPageIds.forEach(id => next.delete(id));
      setSelectedInstrumentIds(next);
    } else {
      const next = new Set(selectedInstrumentIds);
      currentInstrumentPageIds.forEach(id => next.add(id));
      setSelectedInstrumentIds(next);
    }
  };

  const handleBatchDeleteInstruments = () => {
    if (selectedInstrumentIds.size === 0) return;
    if (confirm(`确定要删除选中的 ${selectedInstrumentIds.size} 个仪表吗？`)) {
      batchDeleteInstrumentMutation.mutate({ ids: Array.from(selectedInstrumentIds) });
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">设备管理</h1>
        <p className="text-muted-foreground">管理RS485网关COM端口和称重仪表</p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="comports">网关COM端口</TabsTrigger>
          <TabsTrigger value="instruments">称重仪表</TabsTrigger>
        </TabsList>

        {/* COM端口标签页 */}
        <TabsContent value="comports" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>COM端口配置</CardTitle>
                <CardDescription>配置RS485网关的COM端口参数</CardDescription>
              </div>
              <Button onClick={() => {
                setEditingComPort(null);
                resetComPortForm();
                setIsComPortDialogOpen(true);
              }}>
                <Plus className="mr-2 h-4 w-4" />
                添加COM端口
              </Button>
            </CardHeader>
            <CardContent>
              <div className="mb-4">
                <Label>选择网关</Label>
                <Select value={selectedGatewayId?.toString() || ""} onValueChange={(val) => setSelectedGatewayId(parseInt(val))}>
                  <SelectTrigger>
                    <SelectValue placeholder="选择网关" />
                  </SelectTrigger>
                  <SelectContent>
                    {gateways?.map(gateway => (
                      <SelectItem key={gateway.id} value={gateway.id.toString()}>
                        {gateway.name} ({gateway.ipAddress})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {comPortsLoading ? (
                <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : comPorts && comPorts.length > 0 ? (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead className="w-16">序号</TableHead>
                        <TableHead>端口号</TableHead>
                        <TableHead>波特率</TableHead>
                        <TableHead>数据位</TableHead>
                        <TableHead>停止位</TableHead>
                        <TableHead>奇偶校验</TableHead>
                        <TableHead>描述</TableHead>
                        <TableHead className="text-right">操作</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {comPorts.map((port, index) => (
                        <TableRow key={port.id}>
                          <TableCell className="text-muted-foreground">{index + 1}</TableCell>
                          <TableCell className="font-medium">{port.portNumber}</TableCell>
                          <TableCell>{port.baudRate}</TableCell>
                          <TableCell>{port.dataBits}</TableCell>
                          <TableCell>{port.stopBits}</TableCell>
                          <TableCell>{port.parity}</TableCell>
                          <TableCell className="text-sm text-muted-foreground">{port.description || "-"}</TableCell>
                          <TableCell className="text-right space-x-2">
                            <Button variant="ghost" size="sm" onClick={() => handleEditComPort(port)}>
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => deleteComPortMutation.mutate({ id: port.id })}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  {selectedGatewayId ? "该网关暂无COM端口配置" : "请先选择网关"}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* 仪表标签页 */}
        <TabsContent value="instruments" className="space-y-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>称重仪表</CardTitle>
                <CardDescription>管理所有RS485称重仪表设备</CardDescription>
              </div>
              <div className="flex gap-2">
                {selectedInstrumentIds.size > 0 && (
                  <Button variant="destructive" onClick={handleBatchDeleteInstruments} disabled={batchDeleteInstrumentMutation.isPending}>
                    {batchDeleteInstrumentMutation.isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                    <Trash2 className="mr-2 h-4 w-4" />
                    删除选中 ({selectedInstrumentIds.size})
                  </Button>
                )}
                <Button onClick={() => {
                  setEditingInstrument(null);
                  resetInstrumentForm();
                  setIsInstrumentDialogOpen(true);
                }}>
                  <Plus className="mr-2 h-4 w-4" />
                  添加仪表
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {instrumentsLoading ? (
                <div className="flex justify-center"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : instruments && instruments.length > 0 ? (
                <>
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead className="w-12">
                            <Checkbox
                              checked={isAllInstrumentsSelected}
                              onCheckedChange={handleToggleAllInstruments}
                              aria-label="全选"
                              {...(isSomeInstrumentsSelected && !isAllInstrumentsSelected ? { "data-state": "indeterminate" } : {})}
                            />
                          </TableHead>
                          <TableHead className="w-16">序号</TableHead>
                          <TableHead>仪表名称</TableHead>
                          <TableHead>型号</TableHead>
                          <TableHead>网关COM端口</TableHead>
                          <TableHead>从站地址</TableHead>
                          <TableHead>状态</TableHead>
                          <TableHead>描述</TableHead>
                          <TableHead className="text-right">操作</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {paginatedInstruments.map((instrument, index) => (
                          <TableRow key={instrument.id} className={selectedInstrumentIds.has(instrument.id) ? "bg-muted/50" : ""}>
                            <TableCell>
                              <Checkbox
                                checked={selectedInstrumentIds.has(instrument.id)}
                                onCheckedChange={() => handleToggleInstrument(instrument.id)}
                                aria-label={`选择 ${instrument.name}`}
                              />
                            </TableCell>
                            <TableCell className="text-muted-foreground">
                              {(instrumentPage - 1) * instrumentPageSize + index + 1}
                            </TableCell>
                            <TableCell className="font-medium">{instrument.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {instrument.modelType}
                                {instrument.modelType === "DY7001" && " (1通道)"}
                                {instrument.modelType === "DY7004" && " (4通道)"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm">{getComPortInfo(instrument.gatewayComPortId)}</TableCell>
                            <TableCell>{instrument.slaveAddress}</TableCell>
                            <TableCell>
                              <Badge variant={instrument.status === "online" ? "default" : "destructive"}>
                                {instrument.status === "online" ? <Wifi className="h-3 w-3 mr-1" /> : <WifiOff className="h-3 w-3 mr-1" />}
                                {instrument.status === "online" ? "在线" : "离线"}
                              </Badge>
                            </TableCell>
                            <TableCell className="text-sm text-muted-foreground">{instrument.description || "-"}</TableCell>
                            <TableCell className="text-right space-x-2">
                              <Button variant="ghost" size="sm" onClick={() => handleEditInstrument(instrument)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="ghost" size="sm" onClick={() => deleteInstrumentMutation.mutate({ id: instrument.id })}>
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>

                  {/* 仪表分页 */}
                  <div className="flex items-center justify-between mt-4 pt-4 border-t">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <span>共 {totalInstruments} 条</span>
                      <span>·</span>
                      <span>每页</span>
                      <Select value={instrumentPageSize.toString()} onValueChange={(val) => { setInstrumentPageSize(Number(val)); setInstrumentPage(1); }}>
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
                      <Button variant="outline" size="sm" onClick={() => setInstrumentPage(p => Math.max(1, p - 1))} disabled={instrumentPage <= 1}>
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      <span className="text-sm text-muted-foreground px-2">
                        第 {instrumentPage} / {totalInstrumentPages} 页
                      </span>
                      <Button variant="outline" size="sm" onClick={() => setInstrumentPage(p => Math.min(totalInstrumentPages, p + 1))} disabled={instrumentPage >= totalInstrumentPages}>
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
        </TabsContent>
      </Tabs>

      {/* COM端口对话框 */}
      <Dialog open={isComPortDialogOpen} onOpenChange={setIsComPortDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingComPort ? "编辑COM端口" : "添加COM端口"}</DialogTitle>
            <DialogDescription>配置RS485网关的COM端口参数</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleComPortSubmit(onComPortSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="gateway">网关</Label>
              <Controller
                name="gatewayId"
                control={controlComPort}
                render={({ field }) => (
                  <Select value={field.value?.toString() || ""} onValueChange={(val) => field.onChange(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择网关" />
                    </SelectTrigger>
                    <SelectContent>
                      {gateways?.map(gateway => (
                        <SelectItem key={gateway.id} value={gateway.id.toString()}>
                          {gateway.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              />
              {comPortErrors.gatewayId && <p className="text-sm text-red-500">{comPortErrors.gatewayId.message}</p>}
            </div>

            <div>
              <Label htmlFor="portNumber">端口号</Label>
              <Input id="portNumber" placeholder="如 COM1, COM2" {...registerComPort("portNumber")} />
              {comPortErrors.portNumber && <p className="text-sm text-red-500">{comPortErrors.portNumber.message}</p>}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="baudRate">波特率</Label>
                <Input id="baudRate" type="number" {...registerComPort("baudRate", { valueAsNumber: true })} />
              </div>
              <div>
                <Label htmlFor="dataBits">数据位</Label>
                <Input id="dataBits" type="number" {...registerComPort("dataBits", { valueAsNumber: true })} />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="stopBits">停止位</Label>
                <Input id="stopBits" type="number" {...registerComPort("stopBits", { valueAsNumber: true })} />
              </div>
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
            </div>

            <div>
              <Label htmlFor="description">描述</Label>
              <Textarea id="description" placeholder="可选的描述信息" {...registerComPort("description")} />
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

      {/* 仪表对话框 */}
      <Dialog open={isInstrumentDialogOpen} onOpenChange={setIsInstrumentDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingInstrument ? "编辑仪表" : "添加仪表"}</DialogTitle>
            <DialogDescription>配置RS485称重仪表</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleInstrumentSubmit(onInstrumentSubmit)} className="space-y-4">
            <div>
              <Label htmlFor="name">仪表名称</Label>
              <Input id="name" placeholder="如 仪表1" {...registerInstrument("name")} />
              {instrumentErrors.name && <p className="text-sm text-red-500">{instrumentErrors.name.message}</p>}
            </div>

            <div>
              <Label htmlFor="modelType">仪表型号</Label>
              <Controller
                name="modelType"
                control={controlInstrument}
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
              {instrumentErrors.modelType && <p className="text-sm text-red-500">{instrumentErrors.modelType.message}</p>}
            </div>

            <div>
              <Label htmlFor="gatewayComPortId">网关COM端口</Label>
              <Controller
                name="gatewayComPortId"
                control={controlInstrument}
                render={({ field }) => (
                  <Select value={field.value?.toString() || ""} onValueChange={(val) => field.onChange(parseInt(val))}>
                    <SelectTrigger>
                      <SelectValue placeholder="选择网关COM端口" />
                    </SelectTrigger>
                    <SelectContent>
                      {gateways?.flatMap(gateway => {
                        const ports = comPorts?.filter(p => p.gatewayId === gateway.id) || [];
                        return ports.map(port => (
                          <SelectItem key={port.id} value={port.id.toString()}>
                            {gateway.name} - {port.portNumber}
                          </SelectItem>
                        ));
                      })}
                    </SelectContent>
                  </Select>
                )}
              />
              {instrumentErrors.gatewayComPortId && <p className="text-sm text-red-500">{instrumentErrors.gatewayComPortId.message}</p>}
            </div>

            <div>
              <Label htmlFor="slaveAddress">从站地址</Label>
              <Input id="slaveAddress" type="number" min="1" max="247" placeholder="1-247" {...registerInstrument("slaveAddress", { valueAsNumber: true })} />
              {instrumentErrors.slaveAddress && <p className="text-sm text-red-500">{instrumentErrors.slaveAddress.message}</p>}
            </div>

            <div>
              <Label htmlFor="description">描述</Label>
              <Textarea id="description" placeholder="可选的描述信息" {...registerInstrument("description")} />
            </div>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setIsInstrumentDialogOpen(false)}>取消</Button>
              <Button type="submit" disabled={createInstrumentMutation.isPending || updateInstrumentMutation.isPending}>
                {(createInstrumentMutation.isPending || updateInstrumentMutation.isPending) && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                保存
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
