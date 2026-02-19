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
import { Separator } from "@/components/ui/separator";
import { Plus, Edit, Trash2, Loader2, AlertTriangle, CheckCircle2, Link2, Unlink, Settings2 } from "lucide-react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import type { CabinetGroup } from "../../../drizzle/schema";

// 柜组基本信息schema
const cabinetSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  initialWeight: z.number().min(0, "初始重量不能为负数"),
  alarmThreshold: z.number().min(0, "报警阈值不能为负数"),
  positionX: z.number(),
  positionY: z.number(),
  positionZ: z.number(),
  description: z.string().optional(),
});

type CabinetForm = z.infer<typeof cabinetSchema>;

export default function Cabinets() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBindingDialogOpen, setIsBindingDialogOpen] = useState(false);
  const [editingCabinet, setEditingCabinet] = useState<CabinetGroup | null>(null);
  const [bindingCabinetId, setBindingCabinetId] = useState<number | null>(null);

  // 绑定配置状态
  const [selectedGatewayId, setSelectedGatewayId] = useState<number | null>(null);
  const [selectedComPortId, setSelectedComPortId] = useState<number | null>(null);
  const [selectedInstrumentId, setSelectedInstrumentId] = useState<number | null>(null);
  const [selectedSensorChannel, setSelectedSensorChannel] = useState<number | null>(null);

  const utils = trpc.useUtils();

  // 查询数据
  const { data: cabinets, isLoading } = trpc.cabinetGroups.list.useQuery();
  const { data: gateways } = trpc.gateways.list.useQuery();
  const { data: instruments } = trpc.instruments.list.useQuery();

  // 根据选择的网关查询COM端口
  const { data: comPorts } = trpc.gatewayComPorts.listByGateway.useQuery(
    { gatewayId: selectedGatewayId || 0 },
    { enabled: !!selectedGatewayId }
  );

  // 根据选择的COM端口查询绑定的仪表
  const { data: comPortInstruments } = trpc.instruments.getByComPort.useQuery(
    { comPortId: selectedComPortId || 0 },
    { enabled: !!selectedComPortId }
  );

  // 查询当前柜组的网关绑定
  const { data: gatewayBinding } = trpc.cabinetGroups.getGatewayBinding.useQuery(
    { cabinetGroupId: bindingCabinetId || 0 },
    { enabled: !!bindingCabinetId }
  );

  // 查询当前柜组的传感器绑定
  const { data: sensorBindings, refetch: refetchSensorBindings } = trpc.cabinetGroups.getSensorBindings.useQuery(
    { cabinetGroupId: bindingCabinetId || 0 },
    { enabled: !!bindingCabinetId }
  );

  // 获取选中仪表的型号信息
  const selectedInstrument = useMemo(() => {
    if (!selectedInstrumentId) return null;
    return comPortInstruments?.find(i => i.id === selectedInstrumentId) || instruments?.find(i => i.id === selectedInstrumentId) || null;
  }, [selectedInstrumentId, comPortInstruments, instruments]);

  // 可用的传感器通道
  const availableChannels = useMemo(() => {
    if (!selectedInstrument) return [];
    const maxChannels = selectedInstrument.modelType === "DY7001" ? 1 : 4;
    return Array.from({ length: maxChannels }, (_, i) => i + 1);
  }, [selectedInstrument]);

  // 柜组CRUD mutations
  const createMutation = trpc.cabinetGroups.create.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组创建成功");
      setIsDialogOpen(false);
      reset();
    },
    onError: (error) => toast.error(`创建失败: ${error.message}`),
  });

  const updateMutation = trpc.cabinetGroups.update.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组更新成功");
      setIsDialogOpen(false);
      setEditingCabinet(null);
      reset();
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  const deleteMutation = trpc.cabinetGroups.delete.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组删除成功");
    },
    onError: (error) => toast.error(`删除失败: ${error.message}`),
  });

  // 绑定mutations
  const setGatewayBindingMutation = trpc.cabinetGroups.setGatewayBinding.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.getGatewayBinding.invalidate();
      toast.success("网关绑定成功");
    },
    onError: (error) => toast.error(`绑定失败: ${error.message}`),
  });

  const addSensorBindingMutation = trpc.cabinetGroups.addSensorBinding.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.getSensorBindings.invalidate();
      refetchSensorBindings();
      toast.success("传感器绑定成功");
      setSelectedInstrumentId(null);
      setSelectedSensorChannel(null);
    },
    onError: (error) => toast.error(`绑定失败: ${error.message}`),
  });

  const removeSensorBindingMutation = trpc.cabinetGroups.removeSensorBinding.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.getSensorBindings.invalidate();
      refetchSensorBindings();
      toast.success("传感器绑定已移除");
    },
    onError: (error) => toast.error(`移除失败: ${error.message}`),
  });

  // 表单
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<CabinetForm>({
    resolver: zodResolver(cabinetSchema),
    defaultValues: { positionX: 0, positionY: 0, positionZ: 0 },
  });

  const onSubmit = (data: any) => {
    const dataInGrams = {
      ...data,
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
      name: cabinet.name,
      initialWeight: cabinet.initialWeight / 1000,
      alarmThreshold: cabinet.alarmThreshold / 1000,
      positionX: cabinet.positionX,
      positionY: cabinet.positionY,
      positionZ: cabinet.positionZ,
      description: cabinet.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除此保险柜组吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAdd = () => {
    setEditingCabinet(null);
    reset({
      name: "",
      initialWeight: 0,
      alarmThreshold: 1,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      description: "",
    });
    setIsDialogOpen(true);
  };

  // 打开绑定配置对话框
  const handleOpenBinding = (cabinetId: number) => {
    setBindingCabinetId(cabinetId);
    setSelectedGatewayId(null);
    setSelectedComPortId(null);
    setSelectedInstrumentId(null);
    setSelectedSensorChannel(null);
    setIsBindingDialogOpen(true);
  };

  // 保存网关绑定
  const handleSaveGatewayBinding = () => {
    if (!bindingCabinetId || !selectedComPortId) {
      toast.error("请选择网关和COM端口");
      return;
    }
    setGatewayBindingMutation.mutate({
      cabinetGroupId: bindingCabinetId,
      gatewayComPortId: selectedComPortId,
    });
  };

  // 添加传感器绑定
  const handleAddSensorBinding = () => {
    if (!bindingCabinetId || !selectedInstrumentId || !selectedSensorChannel) {
      toast.error("请选择仪表和传感器通道");
      return;
    }
    addSensorBindingMutation.mutate({
      cabinetGroupId: bindingCabinetId,
      instrumentId: selectedInstrumentId,
      sensorChannel: selectedSensorChannel,
    });
  };

  // 获取仪表名称
  const getInstrumentName = (instrumentId: number) => {
    return instruments?.find((i) => i.id === instrumentId)?.name || `仪表#${instrumentId}`;
  };

  // 获取仪表型号
  const getInstrumentModel = (instrumentId: number) => {
    return instruments?.find((i) => i.id === instrumentId)?.modelType || "未知";
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
          <p className="text-muted-foreground mt-2">管理保险柜组的基本配置、网关绑定和传感器绑定</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          添加保险柜组
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>保险柜组列表</CardTitle>
          <CardDescription>查看和管理所有保险柜组的配置信息，点击"配置绑定"设置网关和传感器关联</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>名称</TableHead>
                  <TableHead>当前重量</TableHead>
                  <TableHead>初始重量</TableHead>
                  <TableHead>报警阈值</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>位置</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cabinets?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      暂无保险柜组
                    </TableCell>
                  </TableRow>
                ) : (
                  cabinets?.map((cabinet) => (
                    <TableRow key={cabinet.id}>
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
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        ({cabinet.positionX}, {cabinet.positionY}, {cabinet.positionZ})
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleOpenBinding(cabinet.id)}
                            title="配置绑定"
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
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* 基本信息编辑对话框 */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCabinet ? "编辑保险柜组" : "添加保险柜组"}</DialogTitle>
            <DialogDescription>
              {editingCabinet ? "修改保险柜组基本配置" : "创建新的保险柜组，创建后可配置网关和传感器绑定"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
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

              <div className="border-t border-border pt-4">
                <Label className="text-base">3D位置坐标</Label>
                <p className="text-sm text-muted-foreground mb-3">设置柜子组在3D监视界面中的显示位置</p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="positionX">X轴</Label>
                    <Input id="positionX" type="number" placeholder="0" {...register("positionX", { valueAsNumber: true })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="positionY">Y轴</Label>
                    <Input id="positionY" type="number" placeholder="0" {...register("positionY", { valueAsNumber: true })} />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="positionZ">Z轴</Label>
                    <Input id="positionZ" type="number" placeholder="0" {...register("positionZ", { valueAsNumber: true })} />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">描述</Label>
                <Textarea id="description" placeholder="保险柜组的详细描述信息" {...register("description")} />
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

      {/* 绑定配置对话框 */}
      <Dialog open={isBindingDialogOpen} onOpenChange={setIsBindingDialogOpen}>
        <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Link2 className="h-5 w-5" />
              配置硬件绑定
            </DialogTitle>
            <DialogDescription>
              为柜组 <span className="font-semibold text-foreground">{cabinets?.find(c => c.id === bindingCabinetId)?.name}</span> 配置网关COM端口和传感器绑定关系
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            {/* 第一步：选择网关和COM端口 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">1</div>
                <h3 className="text-base font-semibold">选择网关和COM端口</h3>
              </div>

              {gatewayBinding && (
                <div className="bg-muted/50 rounded-lg p-3 text-sm">
                  <span className="text-muted-foreground">当前绑定：</span>
                  <span className="font-medium ml-1">COM端口 #{gatewayBinding.gatewayComPortId}</span>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>选择网关</Label>
                  <Select
                    value={selectedGatewayId?.toString() || ""}
                    onValueChange={(val) => {
                      setSelectedGatewayId(parseInt(val));
                      setSelectedComPortId(null);
                      setSelectedInstrumentId(null);
                      setSelectedSensorChannel(null);
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="选择网关" />
                    </SelectTrigger>
                    <SelectContent>
                      {gateways?.map(gw => (
                        <SelectItem key={gw.id} value={gw.id.toString()}>
                          {gw.name} ({gw.ipAddress})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>选择COM端口</Label>
                  <Select
                    value={selectedComPortId?.toString() || ""}
                    onValueChange={(val) => {
                      setSelectedComPortId(parseInt(val));
                      setSelectedInstrumentId(null);
                      setSelectedSensorChannel(null);
                    }}
                    disabled={!selectedGatewayId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={selectedGatewayId ? "选择COM端口" : "请先选择网关"} />
                    </SelectTrigger>
                    <SelectContent>
                      {comPorts?.map(port => (
                        <SelectItem key={port.id} value={port.id.toString()}>
                          {port.portNumber} (波特率: {port.baudRate})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Button
                size="sm"
                onClick={handleSaveGatewayBinding}
                disabled={!selectedComPortId || setGatewayBindingMutation.isPending}
              >
                {setGatewayBindingMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                保存网关绑定
              </Button>
            </div>

            <Separator />

            {/* 第二步：选择仪表和端子 */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <div className="h-6 w-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center text-xs font-bold">2</div>
                <h3 className="text-base font-semibold">配置传感器绑定</h3>
              </div>

              {/* 已绑定的传感器列表 */}
              {sensorBindings && sensorBindings.length > 0 && (
                <div className="space-y-2">
                  <Label className="text-sm text-muted-foreground">已绑定的传感器：</Label>
                  <div className="space-y-2">
                    {sensorBindings.map(binding => (
                      <div key={binding.id} className="flex items-center justify-between bg-muted/50 rounded-lg px-3 py-2">
                        <div className="flex items-center gap-3">
                          <Link2 className="h-4 w-4 text-primary" />
                          <span className="text-sm font-medium">{getInstrumentName(binding.instrumentId)}</span>
                          <Badge variant="outline" className="text-xs">
                            {getInstrumentModel(binding.instrumentId)}
                          </Badge>
                          <span className="text-sm text-muted-foreground">端子 {binding.sensorChannel}</span>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeSensorBindingMutation.mutate({ id: binding.id })}
                          disabled={removeSensorBindingMutation.isPending}
                        >
                          <Unlink className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* 添加新的传感器绑定 */}
              <div className="border rounded-lg p-4 space-y-4">
                <Label className="text-sm font-medium">添加传感器绑定</Label>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">选择仪表</Label>
                    <Select
                      value={selectedInstrumentId?.toString() || ""}
                      onValueChange={(val) => {
                        setSelectedInstrumentId(parseInt(val));
                        setSelectedSensorChannel(null);
                      }}
                      disabled={!selectedComPortId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedComPortId ? "选择仪表" : "请先选择COM端口"} />
                      </SelectTrigger>
                      <SelectContent>
                        {comPortInstruments?.map(inst => (
                          <SelectItem key={inst.id} value={inst.id.toString()}>
                            {inst.name} ({inst.modelType})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">选择端子通道</Label>
                    <Select
                      value={selectedSensorChannel?.toString() || ""}
                      onValueChange={(val) => setSelectedSensorChannel(parseInt(val))}
                      disabled={!selectedInstrumentId}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder={selectedInstrumentId ? "选择端子" : "请先选择仪表"} />
                      </SelectTrigger>
                      <SelectContent>
                        {availableChannels.map(ch => (
                          <SelectItem key={ch} value={ch.toString()}>
                            端子 {ch}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {selectedInstrument && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded p-2">
                    <span className="font-medium">{selectedInstrument.modelType}</span>
                    {selectedInstrument.modelType === "DY7001" ? " - 单通道仪表，仅有端子1" : " - 四通道仪表，端子1-4可用"}
                  </div>
                )}

                <Button
                  size="sm"
                  onClick={handleAddSensorBinding}
                  disabled={!selectedInstrumentId || !selectedSensorChannel || addSensorBindingMutation.isPending}
                >
                  {addSensorBindingMutation.isPending && <Loader2 className="mr-2 h-3 w-3 animate-spin" />}
                  <Plus className="mr-1 h-3 w-3" />
                  添加绑定
                </Button>
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
