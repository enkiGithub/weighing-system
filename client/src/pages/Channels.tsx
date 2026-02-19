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
import { Switch } from "@/components/ui/switch";
import { Edit, Loader2, Radio, Zap, ChevronLeft, ChevronRight, Activity } from "lucide-react";
import { toast } from "sonner";

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function Channels() {
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [editingChannel, setEditingChannel] = useState<any>(null);
  const [testingChannelId, setTestingChannelId] = useState<number | null>(null);
  const [filterInstrumentId, setFilterInstrumentId] = useState<string>("all");

  // 分页
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // 编辑表单状态
  const [editLabel, setEditLabel] = useState("");
  const [editEnabled, setEditEnabled] = useState(true);
  const [editScale, setEditScale] = useState(1.0);
  const [editOffset, setEditOffset] = useState(0.0);
  const [editUnit, setEditUnit] = useState("g");
  const [editPrecision, setEditPrecision] = useState(2);
  const [editRemark, setEditRemark] = useState("");

  const utils = trpc.useUtils();

  // 查询数据
  const { data: allChannels, isLoading } = trpc.channels.listAll.useQuery();
  const { data: instruments } = trpc.instruments.list.useQuery();

  // 过滤和分页
  const filteredChannels = useMemo(() => {
    if (!allChannels) return [];
    if (filterInstrumentId === "all") return allChannels;
    return allChannels.filter(ch => ch.instrumentId === parseInt(filterInstrumentId));
  }, [allChannels, filterInstrumentId]);

  const totalItems = filteredChannels.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const paginatedChannels = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredChannels.slice(start, start + pageSize);
  }, [filteredChannels, currentPage, pageSize]);

  // 获取仪表信息
  const getInstrumentInfo = (instrumentId: number) => {
    const inst = instruments?.find(i => i.id === instrumentId);
    if (!inst) return `仪表#${instrumentId}`;
    return `${inst.deviceCode}${inst.name ? ` (${inst.name})` : ""} - ${inst.modelType}`;
  };

  // 更新通道
  const updateMutation = trpc.channels.update.useMutation({
    onSuccess: () => {
      utils.channels.listAll.invalidate();
      toast.success("通道参数更新成功");
      setIsEditDialogOpen(false);
      setEditingChannel(null);
    },
    onError: (error) => toast.error(`更新失败: ${error.message}`),
  });

  // 通信测试
  const testReadMutation = trpc.channels.testRead.useMutation({
    onSuccess: (data) => {
      utils.channels.listAll.invalidate();
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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight text-foreground">通道管理</h1>
        <p className="text-muted-foreground mt-2">
          管理仪表通道参数，包括校准系数、单位、精度等配置。通道在创建仪表时自动生成。
        </p>
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>通道列表</CardTitle>
            <CardDescription>
              查看和配置所有仪表通道的参数。通道在创建仪表时根据型号自动生成（DY7001: 1通道, DY7004: 4通道）。
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <Label className="text-sm text-muted-foreground whitespace-nowrap">筛选仪表:</Label>
            <Select value={filterInstrumentId} onValueChange={(val) => { setFilterInstrumentId(val); setCurrentPage(1); }}>
              <SelectTrigger className="w-[250px]">
                <SelectValue placeholder="全部仪表" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部仪表</SelectItem>
                {instruments?.map(inst => (
                  <SelectItem key={inst.id} value={inst.id.toString()}>
                    {inst.deviceCode}{inst.name ? ` (${inst.name})` : ""} - {inst.modelType}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16">序号</TableHead>
                      <TableHead>通道标签</TableHead>
                      <TableHead>所属仪表</TableHead>
                      <TableHead>通道号</TableHead>
                      <TableHead>启用</TableHead>
                      <TableHead>校准系数</TableHead>
                      <TableHead>偏移量</TableHead>
                      <TableHead>单位</TableHead>
                      <TableHead>精度</TableHead>
                      <TableHead>当前值</TableHead>
                      <TableHead>最后读取</TableHead>
                      <TableHead className="text-right">操作</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedChannels.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={12} className="text-center text-muted-foreground py-8">
                          {filterInstrumentId === "all" ? "暂无通道数据，请先创建仪表" : "该仪表暂无通道"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedChannels.map((channel, index) => (
                        <TableRow key={channel.id}>
                          <TableCell className="text-muted-foreground">
                            {(currentPage - 1) * pageSize + index + 1}
                          </TableCell>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              <Radio className="h-4 w-4 text-primary" />
                              {channel.label}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm">{getInstrumentInfo(channel.instrumentId)}</TableCell>
                          <TableCell>
                            <Badge variant="outline">CH{channel.channelNo}</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={channel.enabled ? "default" : "secondary"}>
                              {channel.enabled ? "启用" : "禁用"}
                            </Badge>
                          </TableCell>
                          <TableCell className="font-mono text-sm">{channel.scale}</TableCell>
                          <TableCell className="font-mono text-sm">{channel.offset}</TableCell>
                          <TableCell>{channel.unit}</TableCell>
                          <TableCell>{channel.precision}</TableCell>
                          <TableCell className="font-mono text-sm">
                            {channel.currentValue !== null ? channel.currentValue.toFixed(channel.precision) : "-"}
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground">
                            {channel.lastReadAt
                              ? new Date(channel.lastReadAt).toLocaleString()
                              : "-"}
                          </TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleTestRead(channel.id)}
                                disabled={testingChannelId === channel.id}
                                title="通信测试"
                              >
                                {testingChannelId === channel.id ? (
                                  <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                  <Zap className="h-4 w-4 text-amber-500" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleEdit(channel)}
                                title="编辑参数"
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>

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
              <Label htmlFor="label">通道标签</Label>
              <Input
                id="label"
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
                <Label htmlFor="scale">校准系数 (Scale)</Label>
                <Input
                  id="scale"
                  type="number"
                  step="0.001"
                  value={editScale}
                  onChange={(e) => setEditScale(parseFloat(e.target.value) || 1.0)}
                />
                <p className="text-xs text-muted-foreground">校准值 = 原始值 × 系数 + 偏移</p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="offset">偏移量 (Offset)</Label>
                <Input
                  id="offset"
                  type="number"
                  step="0.01"
                  value={editOffset}
                  onChange={(e) => setEditOffset(parseFloat(e.target.value) || 0.0)}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="unit">单位</Label>
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
                <Label htmlFor="precision">小数精度</Label>
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
              <Label htmlFor="remark">备注</Label>
              <Textarea
                id="remark"
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
    </div>
  );
}
