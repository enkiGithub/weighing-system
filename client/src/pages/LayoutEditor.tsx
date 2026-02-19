import { useState, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Loader2, Plus, Trash2, Save, RotateCw, Move3d } from "lucide-react";
import { toast } from "sonner";

interface CabinetGroupLayout {
  id?: number;
  cabinetGroupId: number;
  positionX: number;
  positionY: number;
  positionZ: number;
  rotationX: number;
  rotationY: number;
  rotationZ: number;
  scaleX: number;
  scaleY: number;
  scaleZ: number;
}

export default function LayoutEditor() {
  const utils = trpc.useUtils();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedLayout, setSelectedLayout] = useState<number | null>(null);
  const [layoutName, setLayoutName] = useState("");
  const [layoutDescription, setLayoutDescription] = useState("");
  const [selectedCabinetGroup, setSelectedCabinetGroup] = useState<number | null>(null);
  const [selectedGroupLayout, setSelectedGroupLayout] = useState<CabinetGroupLayout | null>(null);
  const [groupLayouts, setGroupLayouts] = useState<CabinetGroupLayout[]>([]);
  const [transformMode, setTransformMode] = useState<"position" | "rotation" | "scale">("position");

  // 查询数据
  const { data: vaultLayouts, isLoading: layoutsLoading } = trpc.layoutEditor.vaultLayouts.list.useQuery();
  const { data: cabinetGroups } = trpc.cabinetGroups.list.useQuery();
  const { data: currentLayout } = trpc.layoutEditor.vaultLayouts.getById.useQuery(
    { id: selectedLayout! },
    { enabled: !!selectedLayout }
  );
  const { data: groupLayoutsData } = trpc.layoutEditor.cabinetGroupLayouts.listByVaultLayout.useQuery(
    { vaultLayoutId: selectedLayout! },
    { enabled: !!selectedLayout }
  );

  // 变更操作
  const createLayoutMutation = trpc.layoutEditor.vaultLayouts.create.useMutation({
    onSuccess: () => {
      utils.layoutEditor.vaultLayouts.list.invalidate();
      toast.success("布局创建成功");
      setLayoutName("");
      setLayoutDescription("");
    },
    onError: (error) => {
      toast.error(`创建失败: ${error.message}`);
    },
  });

  const updateLayoutMutation = trpc.layoutEditor.vaultLayouts.update.useMutation({
    onSuccess: () => {
      utils.layoutEditor.vaultLayouts.list.invalidate();
      utils.layoutEditor.vaultLayouts.getById.invalidate();
      toast.success("布局更新成功");
    },
    onError: (error) => {
      toast.error(`更新失败: ${error.message}`);
    },
  });

  const batchUpdateMutation = trpc.layoutEditor.cabinetGroupLayouts.batchUpdate.useMutation({
    onSuccess: () => {
      utils.layoutEditor.cabinetGroupLayouts.listByVaultLayout.invalidate();
      toast.success("布局保存成功");
    },
    onError: (error) => {
      toast.error(`保存失败: ${error.message}`);
    },
  });

  const deleteLayoutMutation = trpc.layoutEditor.vaultLayouts.delete.useMutation({
    onSuccess: () => {
      utils.layoutEditor.vaultLayouts.list.invalidate();
      setSelectedLayout(null);
      setGroupLayouts([]);
      toast.success("布局删除成功");
    },
    onError: (error) => {
      toast.error(`删除失败: ${error.message}`);
    },
  });

  // 加载布局数据
  useEffect(() => {
    if (groupLayoutsData) {
      setGroupLayouts(groupLayoutsData);
    }
  }, [groupLayoutsData]);

  // 创建新布局
  const handleCreateLayout = () => {
    if (!layoutName.trim()) {
      toast.error("请输入布局名称");
      return;
    }
    createLayoutMutation.mutate({
      name: layoutName,
      description: layoutDescription,
      layoutData: JSON.stringify([]),
    });
  };

  // 添加柜组到布局
  const handleAddCabinetGroup = () => {
    if (!selectedCabinetGroup || !selectedLayout) {
      toast.error("请选择柜组");
      return;
    }

    const newLayout: CabinetGroupLayout = {
      cabinetGroupId: selectedCabinetGroup,
      positionX: 0,
      positionY: 0,
      positionZ: 0,
      rotationX: 0,
      rotationY: 0,
      rotationZ: 0,
      scaleX: 100,
      scaleY: 100,
      scaleZ: 100,
    };

    setGroupLayouts([...groupLayouts, newLayout]);
    setSelectedCabinetGroup(null);
  };

  // 移除柜组
  const handleRemoveGroupLayout = (index: number) => {
    setGroupLayouts(groupLayouts.filter((_, i) => i !== index));
    setSelectedGroupLayout(null);
  };

  // 更新变换参数
  const handleUpdateTransform = (field: string, value: number) => {
    if (!selectedGroupLayout) return;

    const updated = { ...selectedGroupLayout, [field]: value };
    setSelectedGroupLayout(updated);

    // 同时更新列表中的数据
    const index = groupLayouts.findIndex(
      (g) => g.cabinetGroupId === selectedGroupLayout.cabinetGroupId
    );
    if (index >= 0) {
      const newLayouts = [...groupLayouts];
      newLayouts[index] = updated;
      setGroupLayouts(newLayouts);
    }
  };

  // 保存布局
  const handleSaveLayout = () => {
    if (!selectedLayout) return;

    batchUpdateMutation.mutate({
      vaultLayoutId: selectedLayout,
      layouts: groupLayouts,
    });
  };

  // 删除布局
  const handleDeleteLayout = () => {
    if (!selectedLayout) return;
    if (confirm("确定要删除此布局吗？")) {
      deleteLayoutMutation.mutate({ id: selectedLayout });
    }
  };

  // 绘制3D预览
  useEffect(() => {
    if (!canvasRef.current) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // 清空画布
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // 绘制网格
    ctx.strokeStyle = "#1e293b";
    ctx.lineWidth = 1;
    for (let i = 0; i < canvas.width; i += 50) {
      ctx.beginPath();
      ctx.moveTo(i, 0);
      ctx.lineTo(i, canvas.height);
      ctx.stroke();
    }
    for (let i = 0; i < canvas.height; i += 50) {
      ctx.beginPath();
      ctx.moveTo(0, i);
      ctx.lineTo(canvas.width, i);
      ctx.stroke();
    }

    // 绘制柜组
    groupLayouts.forEach((layout, index) => {
      const isSelected = selectedGroupLayout?.cabinetGroupId === layout.cabinetGroupId;
      const x = canvas.width / 2 + layout.positionX;
      const y = canvas.height / 2 + layout.positionY;
      const size = 40 * (layout.scaleX / 100);

      // 绘制柜组矩形
      ctx.fillStyle = isSelected ? "#3b82f6" : "#64748b";
      ctx.fillRect(x - size / 2, y - size / 2, size, size);

      // 绘制边框
      ctx.strokeStyle = isSelected ? "#60a5fa" : "#475569";
      ctx.lineWidth = isSelected ? 3 : 1;
      ctx.strokeRect(x - size / 2, y - size / 2, size, size);

      // 绘制标签
      ctx.fillStyle = "#ffffff";
      ctx.font = "12px sans-serif";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.fillText(`G${layout.cabinetGroupId}`, x, y);
    });
  }, [groupLayouts, selectedGroupLayout, canvasRef]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">保管库布局编辑器</h1>
          <p className="text-muted-foreground mt-2">设计和管理保管库的整体布局配置</p>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* 左侧：布局列表 */}
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle>布局列表</CardTitle>
            <CardDescription>创建或选择布局</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {layoutsLoading ? (
              <div className="flex justify-center py-4">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
              </div>
            ) : (
              <>
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {vaultLayouts?.map((layout) => (
                    <button
                      key={layout.id}
                      onClick={() => setSelectedLayout(layout.id)}
                      className={`w-full text-left p-3 rounded-lg border transition-colors ${
                        selectedLayout === layout.id
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      <div className="font-medium text-sm">{layout.name}</div>
                      <div className="text-xs text-muted-foreground">{layout.description}</div>
                    </button>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-3">
                  <div>
                    <Label className="text-sm">布局名称</Label>
                    <Input
                      placeholder="输入布局名称"
                      value={layoutName}
                      onChange={(e) => setLayoutName(e.target.value)}
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <Label className="text-sm">描述</Label>
                    <Textarea
                      placeholder="输入布局描述"
                      value={layoutDescription}
                      onChange={(e) => setLayoutDescription(e.target.value)}
                      className="mt-1 h-20"
                    />
                  </div>
                  <Button
                    onClick={handleCreateLayout}
                    disabled={createLayoutMutation.isPending}
                    className="w-full"
                  >
                    <Plus className="h-4 w-4 mr-2" />
                    创建新布局
                  </Button>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 中间和右侧：编辑区域 */}
        {selectedLayout ? (
          <>
            {/* 中间：3D预览和柜组列表 */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">布局预览</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <canvas
                  ref={canvasRef}
                  width={300}
                  height={300}
                  className="w-full border border-border rounded-lg bg-slate-950 cursor-crosshair"
                  onClick={(e) => {
                    const rect = canvasRef.current?.getBoundingClientRect();
                    if (!rect) return;
                    const x = e.clientX - rect.left - 150;
                    const y = e.clientY - rect.top - 150;

                    // 查找点击的柜组
                    const clicked = groupLayouts.find((layout) => {
                      const size = 40 * (layout.scaleX / 100);
                      return (
                        Math.abs(x - layout.positionX) < size / 2 &&
                        Math.abs(y - layout.positionY) < size / 2
                      );
                    });

                    if (clicked) {
                      setSelectedGroupLayout(clicked);
                    }
                  }}
                />

                <div className="space-y-2 max-h-48 overflow-y-auto">
                  <Label className="text-sm font-medium">柜组列表</Label>
                  {groupLayouts.map((layout, index) => (
                    <div
                      key={index}
                      onClick={() => setSelectedGroupLayout(layout)}
                      className={`p-2 rounded-lg border cursor-pointer transition-colors ${
                        selectedGroupLayout?.cabinetGroupId === layout.cabinetGroupId
                          ? "bg-primary/10 border-primary"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">柜组 {layout.cabinetGroupId}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleRemoveGroupLayout(index);
                          }}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4">
                  <Label className="text-sm">添加柜组</Label>
                  <div className="flex gap-2 mt-2">
                    <Select value={selectedCabinetGroup?.toString() || ""} onValueChange={(v) => setSelectedCabinetGroup(Number(v))}>
                      <SelectTrigger className="flex-1">
                        <SelectValue placeholder="选择柜组" />
                      </SelectTrigger>
                      <SelectContent>
                        {cabinetGroups?.map((group) => (
                          <SelectItem key={group.id} value={group.id.toString()}>
                            {group.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Button onClick={handleAddCabinetGroup} size="sm">
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 右侧：变换控制 */}
            <Card className="lg:col-span-1">
              <CardHeader>
                <CardTitle className="text-lg">变换控制</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {selectedGroupLayout ? (
                  <>
                    <Tabs value={transformMode} onValueChange={(v) => setTransformMode(v as any)}>
                      <TabsList className="grid w-full grid-cols-3">
                        <TabsTrigger value="position" className="flex gap-1">
                          <Move3d className="h-4 w-4" />
                          <span className="hidden sm:inline">位置</span>
                        </TabsTrigger>
                        <TabsTrigger value="rotation" className="flex gap-1">
                          <RotateCw className="h-4 w-4" />
                          <span className="hidden sm:inline">旋转</span>
                        </TabsTrigger>
                        <TabsTrigger value="scale">缩放</TabsTrigger>
                      </TabsList>

                      <TabsContent value="position" className="space-y-3 mt-4">
                        <div>
                          <Label className="text-sm">X 位置: {selectedGroupLayout.positionX}</Label>
                          <input
                            type="range"
                            min="-500"
                            max="500"
                            value={selectedGroupLayout.positionX}
                            onChange={(e) => handleUpdateTransform("positionX", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Y 位置: {selectedGroupLayout.positionY}</Label>
                          <input
                            type="range"
                            min="-500"
                            max="500"
                            value={selectedGroupLayout.positionY}
                            onChange={(e) => handleUpdateTransform("positionY", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Z 位置: {selectedGroupLayout.positionZ}</Label>
                          <input
                            type="range"
                            min="-500"
                            max="500"
                            value={selectedGroupLayout.positionZ}
                            onChange={(e) => handleUpdateTransform("positionZ", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="rotation" className="space-y-3 mt-4">
                        <div>
                          <Label className="text-sm">X 旋转: {(selectedGroupLayout.rotationX / 100).toFixed(1)}°</Label>
                          <input
                            type="range"
                            min="0"
                            max="36000"
                            value={selectedGroupLayout.rotationX}
                            onChange={(e) => handleUpdateTransform("rotationX", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Y 旋转: {(selectedGroupLayout.rotationY / 100).toFixed(1)}°</Label>
                          <input
                            type="range"
                            min="0"
                            max="36000"
                            value={selectedGroupLayout.rotationY}
                            onChange={(e) => handleUpdateTransform("rotationY", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Z 旋转: {(selectedGroupLayout.rotationZ / 100).toFixed(1)}°</Label>
                          <input
                            type="range"
                            min="0"
                            max="36000"
                            value={selectedGroupLayout.rotationZ}
                            onChange={(e) => handleUpdateTransform("rotationZ", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </TabsContent>

                      <TabsContent value="scale" className="space-y-3 mt-4">
                        <div>
                          <Label className="text-sm">X 缩放: {selectedGroupLayout.scaleX}%</Label>
                          <input
                            type="range"
                            min="10"
                            max="200"
                            value={selectedGroupLayout.scaleX}
                            onChange={(e) => handleUpdateTransform("scaleX", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Y 缩放: {selectedGroupLayout.scaleY}%</Label>
                          <input
                            type="range"
                            min="10"
                            max="200"
                            value={selectedGroupLayout.scaleY}
                            onChange={(e) => handleUpdateTransform("scaleY", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                        <div>
                          <Label className="text-sm">Z 缩放: {selectedGroupLayout.scaleZ}%</Label>
                          <input
                            type="range"
                            min="10"
                            max="200"
                            value={selectedGroupLayout.scaleZ}
                            onChange={(e) => handleUpdateTransform("scaleZ", Number(e.target.value))}
                            className="w-full"
                          />
                        </div>
                      </TabsContent>
                    </Tabs>

                    <div className="border-t pt-4 space-y-2">
                      <Button
                        onClick={handleSaveLayout}
                        disabled={batchUpdateMutation.isPending}
                        className="w-full"
                      >
                        <Save className="h-4 w-4 mr-2" />
                        保存布局
                      </Button>
                      <Button
                        onClick={handleDeleteLayout}
                        variant="destructive"
                        className="w-full"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        删除布局
                      </Button>
                    </div>
                  </>
                ) : (
                  <div className="text-center text-muted-foreground py-8">
                    选择或添加柜组以编辑
                  </div>
                )}
              </CardContent>
            </Card>
          </>
        ) : (
          <Card className="lg:col-span-2">
            <CardContent className="flex items-center justify-center py-12">
              <div className="text-center text-muted-foreground">
                <p className="text-lg font-medium">选择或创建布局开始编辑</p>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
