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
import { Plus, Edit, Trash2, Loader2, WifiOff, Wifi } from "lucide-react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { toast } from "sonner";
import { format } from "date-fns";
import type { WeighingInstrument } from "../../../drizzle/schema";

const instrumentSchema = z.object({
  name: z.string().min(1, "名称不能为空").max(100, "名称过长"),
  gatewayId: z.number({ message: "请选择网关" }),
  slaveAddress: z.number().int().min(1, "从站地址必须大于0").max(247, "从站地址无效"),
  description: z.string().optional(),
});

type InstrumentForm = z.infer<typeof instrumentSchema>;

export default function Devices() {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingInstrument, setEditingInstrument] = useState<WeighingInstrument | null>(null);
  const utils = trpc.useUtils();

  const { data: instruments, isLoading } = trpc.instruments.list.useQuery();
  const { data: gateways } = trpc.gateways.list.useQuery();

  const createMutation = trpc.instruments.create.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表创建成功");
      setIsDialogOpen(false);
      reset();
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const updateMutation = trpc.instruments.update.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表更新成功");
      setIsDialogOpen(false);
      setEditingInstrument(null);
      reset();
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const deleteMutation = trpc.instruments.delete.useMutation({
    onSuccess: () => {
      utils.instruments.list.invalidate();
      toast.success("仪表删除成功");
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
  } = useForm<InstrumentForm>({
    resolver: zodResolver(instrumentSchema),
  });

  const onSubmit = (data: InstrumentForm) => {
    if (editingInstrument) {
      updateMutation.mutate({ id: editingInstrument.id, ...data });
    } else {
      createMutation.mutate(data);
    }
  };

  const handleEdit = (instrument: WeighingInstrument) => {
    setEditingInstrument(instrument);
    reset({
      name: instrument.name,
      gatewayId: instrument.gatewayId,
      slaveAddress: instrument.slaveAddress,
      description: instrument.description || "",
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("确定要删除此仪表吗？")) {
      deleteMutation.mutate({ id });
    }
  };

  const handleAdd = () => {
    setEditingInstrument(null);
    reset({
      name: "",
      gatewayId: undefined,
      slaveAddress: 1,
      description: "",
    });
    setIsDialogOpen(true);
  };

  const getGatewayName = (gatewayId: number) => {
    return gateways?.find((g) => g.id === gatewayId)?.name || "未知网关";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">设备管理</h1>
          <p className="text-muted-foreground mt-2">管理所有称重仪表设备</p>
        </div>
        <Button onClick={handleAdd}>
          <Plus className="mr-2 h-4 w-4" />
          添加仪表
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>称重仪表列表</CardTitle>
          <CardDescription>查看和管理所有称重传感器仪表的配置信息</CardDescription>
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
                  <TableHead>所属网关</TableHead>
                  <TableHead>从站地址</TableHead>
                  <TableHead>状态</TableHead>
                  <TableHead>最后心跳</TableHead>
                  <TableHead>描述</TableHead>
                  <TableHead className="text-right">操作</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {instruments?.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                      暂无仪表设备
                    </TableCell>
                  </TableRow>
                ) : (
                  instruments?.map((instrument) => (
                    <TableRow key={instrument.id}>
                      <TableCell className="font-medium">{instrument.name}</TableCell>
                      <TableCell>{getGatewayName(instrument.gatewayId)}</TableCell>
                      <TableCell className="font-mono">{instrument.slaveAddress}</TableCell>
                      <TableCell>
                        <Badge
                          variant={instrument.status === "online" ? "default" : "secondary"}
                          className="gap-1"
                        >
                          {instrument.status === "online" ? (
                            <Wifi className="h-3 w-3" />
                          ) : (
                            <WifiOff className="h-3 w-3" />
                          )}
                          {instrument.status === "online" ? "在线" : "离线"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {instrument.lastHeartbeat
                          ? format(new Date(instrument.lastHeartbeat), "yyyy-MM-dd HH:mm:ss")
                          : "-"}
                      </TableCell>
                      <TableCell className="max-w-xs truncate text-sm text-muted-foreground">
                        {instrument.description || "-"}
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(instrument)}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(instrument.id)}
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
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>{editingInstrument ? "编辑仪表" : "添加仪表"}</DialogTitle>
            <DialogDescription>
              {editingInstrument ? "修改称重仪表配置信息" : "创建新的称重仪表"}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="name">名称 *</Label>
                <Input
                  id="name"
                  placeholder="例如：1号称重仪表"
                  {...register("name")}
                />
                {errors.name && (
                  <p className="text-sm text-destructive">{errors.name.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="gatewayId">所属网关 *</Label>
                <Controller
                  name="gatewayId"
                  control={control}
                  render={({ field }) => (
                    <Select
                      value={field.value?.toString()}
                      onValueChange={(value) => field.onChange(parseInt(value))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="选择网关" />
                      </SelectTrigger>
                      <SelectContent>
                        {gateways?.map((gateway) => (
                          <SelectItem key={gateway.id} value={gateway.id.toString()}>
                            {gateway.name} ({gateway.ipAddress}:{gateway.port})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.gatewayId && (
                  <p className="text-sm text-destructive">{errors.gatewayId.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="slaveAddress">从站地址 *</Label>
                <Input
                  id="slaveAddress"
                  type="number"
                  placeholder="1-247"
                  {...register("slaveAddress", { valueAsNumber: true })}
                />
                {errors.slaveAddress && (
                  <p className="text-sm text-destructive">{errors.slaveAddress.message}</p>
                )}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">描述</Label>
                <Textarea
                  id="description"
                  placeholder="仪表的详细描述信息"
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
                  setEditingInstrument(null);
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
                {editingInstrument ? "保存" : "创建"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
