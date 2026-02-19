import { useState } from "react";
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
import { Plus, Edit, Trash2, Loader2, AlertTriangle, CheckCircle2 } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import type { CabinetGroup } from "../../../drizzle/schema";

const cabinetSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  instrumentId: z.number({ message: "请选择仪表" }),
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
  const [editingCabinet, setEditingCabinet] = useState<CabinetGroup | null>(null);
  const utils = trpc.useUtils();

  const { data: cabinets, isLoading } = trpc.cabinetGroups.list.useQuery();
  const { data: instruments } = trpc.instruments.list.useQuery();

  const createMutation = trpc.cabinetGroups.create.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组创建成功");
      setIsDialogOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const updateMutation = trpc.cabinetGroups.update.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组更新成功");
      setIsDialogOpen(false);
      setEditingCabinet(null);
      reset();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteMutation = trpc.cabinetGroups.delete.useMutation({
    onSuccess: () => {
      utils.cabinetGroups.list.invalidate();
      toast.success("保险柜组删除成功");
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  const {
    register,
    handleSubmit,
    reset,
    control,
    formState: { errors },
  } = useForm<CabinetForm>({
    resolver: zodResolver(cabinetSchema),
    defaultValues: {
      positionX: 0,
      positionY: 0,
      positionZ: 0,
    },
  });

  const onSubmit = (data: CabinetForm): void => {
    // 转换为克（数据库存储单位）
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
      instrumentId: cabinet.instrumentId,
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
      instrumentId: undefined,
      initialWeight: 0,
      alarmThreshold: 1,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      description: "",
    });
    setIsDialogOpen(true);
  };

  const getInstrumentName = (instrumentId: number) => {
    return instruments?.find((i) => i.id === instrumentId)?.name || "未知仪表";
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "normal":
        return (
          <Badge variant="default" className="gap-1 bg-success text-success-foreground">
            <CheckCircle2 className="h-3 w-3" />
            正常
          </Badge>
        );
      case "warning":
        return (
          <Badge variant="default" className="gap-1 bg-warning text-warning-foreground">
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
          <p className="text-muted-foreground mt-2">管理所有保险柜组的配置和监控</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          添加保险柜组
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>保险柜组列表</CardTitle>
          <CardDescription>查看和管理所有保险柜组的配置信息</CardDescription>
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
                  <TableHead>关联仪表</TableHead>
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
                    <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                      暂无保险柜组
                    </TableCell>
                  </TableRow>
                ) : (
                  cabinets?.map((cabinet) => (
                    <TableRow key={cabinet.id}>
                      <TableCell className="font-medium">{cabinet.name}</TableCell>
                      <TableCell>{getInstrumentName(cabinet.instrumentId)}</TableCell>
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
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(cabinet)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(cabinet.id)}
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingCabinet ? "编辑保险柜组" : "添加保险柜组"}</DialogTitle>
            <DialogDescription>
              {editingCabinet ? "修改保险柜组配置信息" : "创建新的保险柜组"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit as any)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：1号保险柜组"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              
              <div className="grid gap-2">
                <Label htmlFor="instrumentId">关联仪表 *</Label>
                <Controller
                  name="instrumentId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择称重仪表" />
                      </SelectTrigger>
                      <SelectContent>
                        {instruments?.map((instrument) => (
                          <SelectItem key={instrument.id} value={instrument.id.toString()}>
                            {instrument.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.instrumentId && (
                  <p className="text-sm text-destructive">{errors.instrumentId.message}</p>
                )}
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="initialWeight">初始重量 (kg) *</Label>
                  <Input
                    id="initialWeight"
                    type="number"
                    step="0.01"
                    placeholder="0.00"
                    {...register("initialWeight", { valueAsNumber: true })}
                  />
                  {errors.initialWeight && (
                    <p className="text-sm text-destructive">{errors.initialWeight.message}</p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="alarmThreshold">报警阈值 (kg) *</Label>
                  <Input
                    id="alarmThreshold"
                    type="number"
                    step="0.01"
                    placeholder="1.00"
                    {...register("alarmThreshold", { valueAsNumber: true })}
                  />
                  {errors.alarmThreshold && (
                    <p className="text-sm text-destructive">{errors.alarmThreshold.message}</p>
                  )}
                </div>
              </div>

              <div className="border-t border-border pt-4">
                <Label className="text-base">3D位置坐标</Label>
                <p className="text-sm text-muted-foreground mb-3">
                  设置柜子组在3D监视界面中的显示位置
                </p>
                <div className="grid grid-cols-3 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="positionX">X轴</Label>
                    <Input
                      id="positionX"
                      type="number"
                      placeholder="0"
                      {...register("positionX", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="positionY">Y轴</Label>
                    <Input
                      id="positionY"
                      type="number"
                      placeholder="0"
                      {...register("positionY", { valueAsNumber: true })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="positionZ">Z轴</Label>
                    <Input
                      id="positionZ"
                      type="number"
                      placeholder="0"
                      {...register("positionZ", { valueAsNumber: true })}
                    />
                  </div>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="保险柜组的详细描述信息"
                  {...register("description")}
                />
              </div>
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setIsDialogOpen(false);
                  setEditingCabinet(null);
                  reset();
                }}
              >
                取消
              </Button>
              <Button
                type="submit"
                disabled={createMutation.isPending || updateMutation.isPending}
              >
                {(createMutation.isPending || updateMutation.isPending) && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {editingCabinet ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
