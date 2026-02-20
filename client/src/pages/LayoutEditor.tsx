import { useState, useCallback, useRef, useEffect, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, TransformControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Slider } from "@/components/ui/slider";
import {
  Save, Plus, Trash2, Copy, Move, RotateCw, Maximize,
  Search, Link2, Unlink, CheckCircle2,
  FolderOpen, FilePlus, Loader2, Eye
} from "lucide-react";
import { CabinetGroup3D, DEFAULT_MODEL } from "@/components/three/CabinetGroup3D";
import type { CabinetGroupModelParams } from "@/components/three/CabinetGroup3D";
import { SceneSetup } from "@/components/three/SceneSetup";
import { nanoid } from "nanoid";
import { usePermissions } from "@/hooks/usePermissions";

// Types
interface LayoutInstance {
  instanceId: string;
  type: "cabinetGroup";
  cabinetGroupId: number | null;
  transform: {
    position: { x: number; y: number; z: number };
    rotation: { x: number; y: number; z: number };
    scale: { x: number; y: number; z: number };
  };
  model: CabinetGroupModelParams;
  meta: { label: string; remark: string };
}

interface LayoutData {
  scene: {
    gridSize: number;
    unit: string;
    cameraDefault: {
      position: { x: number; y: number; z: number };
      target: { x: number; y: number; z: number };
    };
  };
  instances: LayoutInstance[];
}

const defaultLayoutData: LayoutData = {
  scene: {
    gridSize: 20,
    unit: "m",
    cameraDefault: { position: { x: 8, y: 6, z: 8 }, target: { x: 0, y: 0, z: 0 } },
  },
  instances: [],
};

function createNewInstance(preset?: Partial<CabinetGroupModelParams>): LayoutInstance {
  return {
    instanceId: nanoid(8),
    type: "cabinetGroup",
    cabinetGroupId: null,
    transform: {
      position: { x: (Math.random() - 0.5) * 6, y: 0, z: (Math.random() - 0.5) * 6 },
      rotation: { x: 0, y: 0, z: 0 },
      scale: { x: 1, y: 1, z: 1 },
    },
    model: { ...DEFAULT_MODEL, ...preset },
    meta: { label: "", remark: "" },
  };
}

// 3D Scene Instance Component
function SceneInstance({
  instance,
  isSelected,
  transformMode,
  onSelect,
  onTransformChange,
  cabinetGroupName,
  status,
}: {
  instance: LayoutInstance;
  isSelected: boolean;
  transformMode: "translate" | "rotate" | "scale";
  onSelect: () => void;
  onTransformChange: (pos: THREE.Vector3, rot: THREE.Euler, scl: THREE.Vector3) => void;
  cabinetGroupName?: string;
  status?: "normal" | "warning" | "alarm";
}) {
  const groupRef = useRef<THREE.Group>(null);
  const transformRef = useRef<any>(null);
  const [hovered, setHovered] = useState(false);

  // Real-time constraint: clamp Y>=0 during drag, force only Y-axis rotation
  useEffect(() => {
    if (transformRef.current) {
      const controls = transformRef.current;
      const cb = () => {
        if (!groupRef.current) return;
        const obj = groupRef.current;

        // Clamp Y position to >= 0 in real-time (prevents visual floor penetration)
        if (obj.position.y < 0) {
          obj.position.y = 0;
        }

        // Force only Y-axis rotation: zero out X and Z rotation in real-time
        if (obj.rotation.x !== 0 || obj.rotation.z !== 0) {
          obj.rotation.x = 0;
          obj.rotation.z = 0;
        }

        onTransformChange(
          obj.position.clone(),
          obj.rotation.clone(),
          obj.scale.clone()
        );
      };
      controls.addEventListener("objectChange", cb);
      return () => controls.removeEventListener("objectChange", cb);
    }
  }, [isSelected, onTransformChange]);

  // Configure TransformControls: restrict rotation to Y-axis only
  useEffect(() => {
    if (transformRef.current && transformMode === "rotate") {
      const controls = transformRef.current;
      // showX/showZ = false hides the X and Z rotation rings
      controls.showX = false;
      controls.showZ = false;
      controls.showY = true;
    } else if (transformRef.current) {
      const controls = transformRef.current;
      controls.showX = true;
      controls.showZ = true;
      controls.showY = true;
    }
  }, [transformMode, isSelected]);

  const displayLabel = instance.meta.label || cabinetGroupName || `柜组 ${instance.instanceId.slice(0, 4)}`;

  return (
    <>
      <group
        ref={groupRef}
        position={[instance.transform.position.x, Math.max(0, instance.transform.position.y), instance.transform.position.z]}
        rotation={[0, instance.transform.rotation.y, 0]}
        scale={[instance.transform.scale.x, instance.transform.scale.y, instance.transform.scale.z]}
      >
        <CabinetGroup3D
          model={instance.model}
          status={status || "normal"}
          selected={isSelected}
          hovered={hovered}
          label={displayLabel}
          onClick={(e: any) => { e.stopPropagation(); onSelect(); }}
          onPointerOver={(e: any) => { e.stopPropagation(); setHovered(true); }}
          onPointerOut={() => setHovered(false)}
        />
        {/* Floating label */}
        <Html
          position={[0, instance.model.cabinetHeight + 0.3, 0]}
          center
          distanceFactor={8}
          style={{ pointerEvents: "none" }}
        >
          <div className="bg-slate-900/90 border border-cyan-500/30 rounded-md px-2 py-1 text-center whitespace-nowrap backdrop-blur-sm">
            <div className="text-cyan-400 text-xs font-medium">{displayLabel}</div>
            {instance.cabinetGroupId && (
              <div className="text-slate-400 text-[10px]">ID: {instance.cabinetGroupId}</div>
            )}
          </div>
        </Html>
      </group>
      {isSelected && groupRef.current && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current}
          mode={transformMode}
          size={0.8}
        />
      )}
    </>
  );
}

// Orbit controls that disable when transform is active
function SceneControls({ transformActive }: { transformActive: boolean }) {
  return (
    <OrbitControls
      makeDefault
      enabled={!transformActive}
      enableDamping
      dampingFactor={0.1}
      minDistance={2}
      maxDistance={30}
      maxPolarAngle={Math.PI / 2.1}
    />
  );
}

export default function LayoutEditor() {
  const { canOperate } = usePermissions();
  const canEdit = canOperate('layout_editor');
  const [layoutData, setLayoutData] = useState<LayoutData>(defaultLayoutData);
  const [selectedInstanceId, setSelectedInstanceId] = useState<string | null>(null);
  const [transformMode, setTransformMode] = useState<"translate" | "rotate" | "scale">("translate");
  const [currentLayoutId, setCurrentLayoutId] = useState<number | null>(null);
  const [layoutName, setLayoutName] = useState("新布局");
  const [layoutDesc, setLayoutDesc] = useState("");
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showBindDialog, setShowBindDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [customColumns, setCustomColumns] = useState(2);
  const [customShelves, setCustomShelves] = useState(6);

  // Queries
  const layoutsQuery = trpc.layoutEditor.vaultLayouts.list.useQuery();
  const cabinetGroupsQuery = trpc.cabinetGroups.list.useQuery();
  const utils = trpc.useUtils();

  // Mutations
  const createLayout = trpc.layoutEditor.vaultLayouts.create.useMutation({
    onSuccess: () => utils.layoutEditor.vaultLayouts.list.invalidate(),
  });
  const updateLayout = trpc.layoutEditor.vaultLayouts.update.useMutation({
    onSuccess: () => utils.layoutEditor.vaultLayouts.list.invalidate(),
  });
  const setActiveLayout = trpc.layoutEditor.vaultLayouts.setActive.useMutation({
    onSuccess: () => utils.layoutEditor.vaultLayouts.list.invalidate(),
  });

  const selectedInstance = layoutData.instances.find(i => i.instanceId === selectedInstanceId);

  const boundGroupIds = useMemo(() => {
    return new Set(
      layoutData.instances
        .filter(i => i.cabinetGroupId !== null)
        .map(i => i.cabinetGroupId!)
    );
  }, [layoutData.instances]);

  const cabinetGroupsMap = useMemo(() => {
    const map = new Map<number, { name: string; status: string; currentWeight: number; initialWeight: number }>();
    (cabinetGroupsQuery.data || []).forEach((g: any) => {
      map.set(g.id, { name: g.name, status: g.status, currentWeight: g.currentWeight, initialWeight: g.initialWeight });
    });
    return map;
  }, [cabinetGroupsQuery.data]);

  const filteredCabinetGroups = useMemo(() => {
    const groups = cabinetGroupsQuery.data || [];
    return groups.filter((g: any) => {
      const matchSearch = !searchQuery ||
        g.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        g.id.toString().includes(searchQuery);
      return matchSearch;
    });
  }, [cabinetGroupsQuery.data, searchQuery]);

  // Handlers
  const addInstance = useCallback((preset?: Partial<CabinetGroupModelParams>) => {
    const inst = createNewInstance(preset);
    setLayoutData(prev => ({ ...prev, instances: [...prev.instances, inst] }));
    setSelectedInstanceId(inst.instanceId);
    toast.success("已添加柜组实例");
  }, []);

  const duplicateInstance = useCallback(() => {
    if (!selectedInstance) return;
    const newInst: LayoutInstance = {
      ...JSON.parse(JSON.stringify(selectedInstance)),
      instanceId: nanoid(8),
      cabinetGroupId: null,
      meta: { ...selectedInstance.meta, label: selectedInstance.meta.label + " (副本)" },
    };
    newInst.transform.position.x += 1.5;
    setLayoutData(prev => ({ ...prev, instances: [...prev.instances, newInst] }));
    setSelectedInstanceId(newInst.instanceId);
    toast.success("已复制柜组实例");
  }, [selectedInstance]);

  const deleteInstance = useCallback(() => {
    if (!selectedInstanceId) return;
    setLayoutData(prev => ({ ...prev, instances: prev.instances.filter(i => i.instanceId !== selectedInstanceId) }));
    setSelectedInstanceId(null);
    toast.success("已删除柜组实例");
  }, [selectedInstanceId]);

  const updateInstanceTransform = useCallback((instanceId: string, pos: THREE.Vector3, rot: THREE.Euler, scl: THREE.Vector3) => {
    const clampedY = Math.max(0, +pos.y.toFixed(3));
    setLayoutData(prev => ({
      ...prev,
      instances: prev.instances.map(i =>
        i.instanceId === instanceId
          ? {
            ...i,
            transform: {
              position: { x: +pos.x.toFixed(3), y: clampedY, z: +pos.z.toFixed(3) },
              rotation: { x: 0, y: +rot.y.toFixed(3), z: 0 },
              scale: { x: +scl.x.toFixed(3), y: +scl.y.toFixed(3), z: +scl.z.toFixed(3) },
            },
          }
          : i
      ),
    }));
  }, []);

  const updateInstanceModel = useCallback((key: keyof CabinetGroupModelParams, value: number) => {
    if (!selectedInstanceId) return;
    setLayoutData(prev => ({
      ...prev,
      instances: prev.instances.map(i =>
        i.instanceId === selectedInstanceId ? { ...i, model: { ...i.model, [key]: value } } : i
      ),
    }));
  }, [selectedInstanceId]);

  const updateInstanceMeta = useCallback((key: "label" | "remark", value: string) => {
    if (!selectedInstanceId) return;
    setLayoutData(prev => ({
      ...prev,
      instances: prev.instances.map(i =>
        i.instanceId === selectedInstanceId ? { ...i, meta: { ...i.meta, [key]: value } } : i
      ),
    }));
  }, [selectedInstanceId]);

  const bindCabinetGroup = useCallback((groupId: number) => {
    if (!selectedInstanceId) return;
    if (boundGroupIds.has(groupId) &&
      layoutData.instances.find(i => i.cabinetGroupId === groupId)?.instanceId !== selectedInstanceId) {
      toast.error("该柜组资产已被绑定到其他实例");
      return;
    }
    const group = cabinetGroupsMap.get(groupId);
    setLayoutData(prev => ({
      ...prev,
      instances: prev.instances.map(i =>
        i.instanceId === selectedInstanceId
          ? { ...i, cabinetGroupId: groupId, meta: { ...i.meta, label: group?.name || i.meta.label } }
          : i
      ),
    }));
    setShowBindDialog(false);
    toast.success(`已绑定柜组资产: ${group?.name || groupId}`);
  }, [selectedInstanceId, boundGroupIds, cabinetGroupsMap, layoutData.instances]);

  const unbindCabinetGroup = useCallback(() => {
    if (!selectedInstanceId) return;
    setLayoutData(prev => ({
      ...prev,
      instances: prev.instances.map(i =>
        i.instanceId === selectedInstanceId ? { ...i, cabinetGroupId: null } : i
      ),
    }));
    toast.success("已解除绑定");
  }, [selectedInstanceId]);

  const handleSave = useCallback(async () => {
    setIsSaving(true);
    try {
      const dataStr = JSON.stringify(layoutData);
      if (currentLayoutId) {
        await updateLayout.mutateAsync({ id: currentLayoutId, name: layoutName, description: layoutDesc, layoutData: dataStr });
        toast.success("布局已保存");
      } else {
        const result = await createLayout.mutateAsync({ name: layoutName, description: layoutDesc, layoutData: dataStr });
        setCurrentLayoutId(result.id);
        toast.success("布局已创建");
      }
    } catch (e: any) {
      toast.error(e.message || "保存失败");
    } finally {
      setIsSaving(false);
    }
  }, [layoutData, currentLayoutId, layoutName, layoutDesc, createLayout, updateLayout]);

  const handleLoad = useCallback((layout: any) => {
    try {
      const data = JSON.parse(layout.layoutData) as LayoutData;
      // Ensure data has required structure
      if (!data.scene) data.scene = defaultLayoutData.scene;
      if (!data.instances) data.instances = [];
      setLayoutData(data);
      setCurrentLayoutId(layout.id);
      setLayoutName(layout.name);
      setLayoutDesc(layout.description || "");
      setSelectedInstanceId(null);
      setShowLoadDialog(false);
      toast.success(`已加载布局: ${layout.name}`);
    } catch {
      toast.error("布局数据解析失败");
    }
  }, []);

  const handleActivate = useCallback(async () => {
    if (!currentLayoutId) { toast.error("请先保存布局"); return; }
    try {
      await setActiveLayout.mutateAsync({ id: currentLayoutId });
      toast.success("已设为激活布局，实时监视页面将加载此布局");
    } catch (e: any) {
      toast.error(e.message || "激活失败");
    }
  }, [currentLayoutId, setActiveLayout]);

  const handleNewLayout = useCallback(() => {
    setLayoutData(defaultLayoutData);
    setCurrentLayoutId(null);
    setLayoutName("新布局");
    setLayoutDesc("");
    setSelectedInstanceId(null);
  }, []);

  const updatePositionField = useCallback((axis: "x" | "y" | "z", value: number) => {
    if (!selectedInstanceId) return;
    const clampedValue = axis === "y" ? Math.max(0, value) : value;
    setLayoutData(prev => ({
      ...prev,
      instances: prev.instances.map(i =>
        i.instanceId === selectedInstanceId
          ? { ...i, transform: { ...i.transform, position: { ...i.transform.position, [axis]: clampedValue } } }
          : i
      ),
    }));
  }, [selectedInstanceId]);

  const updateRotationY = useCallback((value: number) => {
    if (!selectedInstanceId) return;
    setLayoutData(prev => ({
      ...prev,
      instances: prev.instances.map(i =>
        i.instanceId === selectedInstanceId
          ? { ...i, transform: { ...i.transform, rotation: { x: 0, y: value, z: 0 } } }
          : i
      ),
    }));
  }, [selectedInstanceId]);

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === "g" || e.key === "G") setTransformMode("translate");
      if (e.key === "r" || e.key === "R") setTransformMode("rotate");
      if (e.key === "s" || e.key === "S") setTransformMode("scale");
      if (e.key === "Delete" || e.key === "Backspace") deleteInstance();
      if (e.key === "Escape") setSelectedInstanceId(null);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [deleteInstance]);

  return (
    <div className="h-[calc(100vh-2rem)] flex gap-3">
      {/* Left Panel */}
      <div className="w-64 flex flex-col gap-3 shrink-0">
        {/* Layout Management */}
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <FolderOpen className="h-4 w-4 text-cyan-400" />
              布局管理
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3 space-y-2">
            <Input value={layoutName} onChange={e => setLayoutName(e.target.value)} placeholder="布局名称" className="h-8 text-xs bg-slate-800 border-slate-600" />
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handleNewLayout}>
                <FilePlus className="h-3 w-3 mr-1" />新建
              </Button>
              <Dialog open={showLoadDialog} onOpenChange={setShowLoadDialog}>
                <DialogTrigger asChild>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs">
                    <FolderOpen className="h-3 w-3 mr-1" />加载
                  </Button>
                </DialogTrigger>
                <DialogContent className="bg-slate-900 border-slate-700">
                  <DialogHeader><DialogTitle>加载布局</DialogTitle></DialogHeader>
                  <ScrollArea className="max-h-80">
                    <div className="space-y-2">
                      {(layoutsQuery.data || []).map((layout: any) => (
                        <div key={layout.id} className="p-3 rounded-lg border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-colors" onClick={() => handleLoad(layout)}>
                          <div className="flex items-center justify-between">
                            <span className="text-sm font-medium">{layout.name}</span>
                            {layout.isActive === 1 && <Badge variant="outline" className="text-cyan-400 border-cyan-500/50 text-[10px]">激活</Badge>}
                          </div>
                          <div className="text-xs text-slate-400 mt-1">更新于: {new Date(layout.updatedAt).toLocaleString()}</div>
                        </div>
                      ))}
                      {(!layoutsQuery.data || layoutsQuery.data.length === 0) && <div className="text-center text-slate-400 py-4 text-sm">暂无布局</div>}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
            {canEdit && (
              <div className="flex gap-1.5">
                <Button size="sm" className="flex-1 h-7 text-xs bg-cyan-600 hover:bg-cyan-700" onClick={handleSave} disabled={isSaving}>
                  {isSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}保存
                </Button>
                <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handleActivate} disabled={!currentLayoutId}>
                  <Eye className="h-3 w-3 mr-1" />激活
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Component Library */}
        <Card className="bg-slate-900/80 border-slate-700/50 flex-1 overflow-hidden">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="h-4 w-4 text-cyan-400" />组件库
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="h-[calc(100vh-28rem)]">
              <div className="space-y-2">
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">自定义柜组</p>
                <div className="p-3 rounded-lg border border-slate-700/50 bg-slate-800/30 space-y-3">
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <Label className="text-[10px] text-slate-400">列数</Label>
                      <Input type="number" min={1} max={20} value={customColumns} onChange={e => setCustomColumns(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} className="h-7 text-xs bg-slate-800 border-slate-600 text-center mt-1" />
                    </div>
                    <div>
                      <Label className="text-[10px] text-slate-400">层数</Label>
                      <Input type="number" min={1} max={20} value={customShelves} onChange={e => setCustomShelves(Math.max(1, Math.min(20, parseInt(e.target.value) || 1)))} className="h-7 text-xs bg-slate-800 border-slate-600 text-center mt-1" />
                    </div>
                  </div>
                  <div className="text-[10px] text-slate-500 text-center">
                    预览: {customColumns}列 × {customShelves}层
                  </div>
                  {canEdit && (
                    <Button size="sm" className="w-full h-8 text-xs bg-cyan-600 hover:bg-cyan-700" onClick={() => addInstance({ columns: customColumns, shelves: customShelves })}>
                      <Plus className="h-3.5 w-3.5 mr-1" />添加到场景
                    </Button>
                  )}
                </div>

                <Separator className="bg-slate-700/50 my-3" />
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">场景实例 ({layoutData.instances.length})</p>
                {layoutData.instances.map((inst) => {
                  const groupInfo = inst.cabinetGroupId ? cabinetGroupsMap.get(inst.cabinetGroupId) : null;
                  return (
                    <button key={inst.instanceId} className={`w-full text-left p-2.5 rounded-lg border transition-all ${selectedInstanceId === inst.instanceId ? "border-cyan-500 bg-cyan-500/10" : "border-slate-700/50 hover:border-slate-600"}`} onClick={() => setSelectedInstanceId(inst.instanceId)}>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-medium truncate">{inst.meta.label || `柜组 ${inst.instanceId.slice(0, 4)}`}</span>
                        {inst.cabinetGroupId ? <Link2 className="h-3 w-3 text-green-400 shrink-0" /> : <Unlink className="h-3 w-3 text-slate-500 shrink-0" />}
                      </div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        {inst.model.columns}列 × {inst.model.shelves}层
                        {groupInfo && <span className="text-green-400 ml-1">· 已绑定</span>}
                      </div>
                    </button>
                  );
                })}
                {layoutData.instances.length === 0 && <div className="text-center text-slate-500 py-3 text-xs">输入行列数后点击"添加到场景"</div>}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Center - 3D Canvas */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        {/* Toolbar */}
        <Card className="bg-slate-900/80 border-slate-700/50 shrink-0">
          <div className="flex items-center gap-2 px-4 py-2">
            <div className="flex items-center gap-1 border border-slate-700 rounded-lg p-0.5">
              {([
                { mode: "translate" as const, icon: Move, label: "平移 (G)" },
                { mode: "rotate" as const, icon: RotateCw, label: "旋转 (R)" },
                { mode: "scale" as const, icon: Maximize, label: "缩放 (S)" },
              ]).map(({ mode, icon: Icon, label }) => (
                <Button key={mode} size="sm" variant={transformMode === mode ? "default" : "ghost"} className={`h-7 px-2 text-xs ${transformMode === mode ? "bg-cyan-600" : ""}`} onClick={() => setTransformMode(mode)} title={label}>
                  <Icon className="h-3.5 w-3.5" />
                </Button>
              ))}
            </div>
            <Separator orientation="vertical" className="h-6 bg-slate-700" />
            {canEdit && (
              <>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs" onClick={duplicateInstance} disabled={!selectedInstance}>
                  <Copy className="h-3.5 w-3.5 mr-1" />复制
                </Button>
                <Button size="sm" variant="ghost" className="h-7 px-2 text-xs text-red-400 hover:text-red-300" onClick={deleteInstance} disabled={!selectedInstance}>
                  <Trash2 className="h-3.5 w-3.5 mr-1" />删除
                </Button>
              </>
            )}
            <div className="flex-1" />
            <div className="text-xs text-slate-400">
              实例: {layoutData.instances.length} | 已绑定: {layoutData.instances.filter(i => i.cabinetGroupId).length}
            </div>
          </div>
        </Card>

        {/* 3D Canvas */}
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-950">
          <Canvas
            shadows
            camera={{ position: [8, 6, 8], fov: 50, near: 0.1, far: 100 }}
            onPointerMissed={() => setSelectedInstanceId(null)}
            gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
          >
            <Suspense fallback={null}>
              <SceneSetup gridSize={layoutData.scene.gridSize} />
              <SceneControls transformActive={selectedInstanceId !== null} />
              {layoutData.instances.map((inst) => {
                const groupInfo = inst.cabinetGroupId ? cabinetGroupsMap.get(inst.cabinetGroupId) : null;
                return (
                  <SceneInstance
                    key={inst.instanceId}
                    instance={inst}
                    isSelected={selectedInstanceId === inst.instanceId}
                    transformMode={transformMode}
                    onSelect={() => setSelectedInstanceId(inst.instanceId)}
                    onTransformChange={(pos, rot, scl) => updateInstanceTransform(inst.instanceId, pos, rot, scl)}
                    cabinetGroupName={groupInfo?.name}
                    status={(groupInfo?.status as any) || "normal"}
                  />
                );
              })}
            </Suspense>
          </Canvas>
        </div>
      </div>

      {/* Right Panel - Properties */}
      <div className="w-72 flex flex-col gap-3 shrink-0">
        {selectedInstance ? (
          <ScrollArea className="flex-1">
            <div className="space-y-3 pr-2">
              {/* Transform */}
              <Card className="bg-slate-900/80 border-slate-700/50">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Move className="h-4 w-4 text-cyan-400" />变换属性</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  <div>
                    <Label className="text-[10px] text-slate-400 uppercase">位置 (X / Y / Z)</Label>
                    <div className="grid grid-cols-3 gap-1.5 mt-1">
                      {(["x", "y", "z"] as const).map(axis => (
                        <Input key={`pos-${axis}`} type="number" step={0.1} min={axis === "y" ? 0 : undefined} value={selectedInstance.transform.position[axis]} onChange={e => updatePositionField(axis, parseFloat(e.target.value) || 0)} className="h-7 text-xs bg-slate-800 border-slate-600 text-center" />
                      ))}
                    </div>
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400 uppercase">旋转角度 (仅Y轴)</Label>
                    <Slider value={[selectedInstance.transform.rotation.y * (180 / Math.PI)]} onValueChange={([v]) => updateRotationY(v * (Math.PI / 180))} min={-180} max={180} step={5} className="mt-1" />
                    <div className="text-[10px] text-slate-500 text-center mt-0.5">{(selectedInstance.transform.rotation.y * (180 / Math.PI)).toFixed(0)}°</div>
                  </div>
                </CardContent>
              </Card>

              {/* Model Parameters */}
              <Card className="bg-slate-900/80 border-slate-700/50">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Maximize className="h-4 w-4 text-cyan-400" />模型参数</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-3">
                  <div>
                    <Label className="text-[10px] text-slate-400">列数: {selectedInstance.model.columns}</Label>
                    <Slider value={[selectedInstance.model.columns]} onValueChange={([v]) => updateInstanceModel("columns", v)} min={1} max={10} step={1} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400">层数: {selectedInstance.model.shelves}</Label>
                    <Slider value={[selectedInstance.model.shelves]} onValueChange={([v]) => updateInstanceModel("shelves", v)} min={2} max={12} step={1} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400">柜宽: {selectedInstance.model.cabinetWidth.toFixed(2)}m</Label>
                    <Slider value={[selectedInstance.model.cabinetWidth * 100]} onValueChange={([v]) => updateInstanceModel("cabinetWidth", v / 100)} min={30} max={120} step={5} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400">柜高: {selectedInstance.model.cabinetHeight.toFixed(2)}m</Label>
                    <Slider value={[selectedInstance.model.cabinetHeight * 100]} onValueChange={([v]) => updateInstanceModel("cabinetHeight", v / 100)} min={100} max={300} step={10} className="mt-1" />
                  </div>
                  <div>
                    <Label className="text-[10px] text-slate-400">柜深: {selectedInstance.model.cabinetDepth.toFixed(2)}m</Label>
                    <Slider value={[selectedInstance.model.cabinetDepth * 100]} onValueChange={([v]) => updateInstanceModel("cabinetDepth", v / 100)} min={20} max={100} step={5} className="mt-1" />
                  </div>
                </CardContent>
              </Card>

              {/* Binding */}
              <Card className="bg-slate-900/80 border-slate-700/50">
                <CardHeader className="py-3 px-4">
                  <CardTitle className="text-sm flex items-center gap-2"><Link2 className="h-4 w-4 text-cyan-400" />资产绑定</CardTitle>
                </CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  {selectedInstance.cabinetGroupId ? (
                    <div className="space-y-2">
                      <div className="p-2.5 rounded-lg bg-green-500/10 border border-green-500/30">
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400 shrink-0" />
                          <div className="min-w-0">
                            <div className="text-xs font-medium text-green-400 truncate">{cabinetGroupsMap.get(selectedInstance.cabinetGroupId)?.name || "未知"}</div>
                            <div className="text-[10px] text-slate-400">ID: {selectedInstance.cabinetGroupId}</div>
                          </div>
                        </div>
                      </div>
                      <Button size="sm" variant="outline" className="w-full h-7 text-xs text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={unbindCabinetGroup}>
                        <Unlink className="h-3 w-3 mr-1" />解除绑定
                      </Button>
                    </div>
                  ) : (
                    <Dialog open={showBindDialog} onOpenChange={setShowBindDialog}>
                      <DialogTrigger asChild>
                        <Button size="sm" variant="outline" className="w-full h-7 text-xs border-cyan-500/30 text-cyan-400 hover:bg-cyan-500/10">
                          <Link2 className="h-3 w-3 mr-1" />绑定柜组资产
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
                        <DialogHeader><DialogTitle>选择柜组资产</DialogTitle></DialogHeader>
                        <div className="relative">
                          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                          <Input placeholder="搜索名称或ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-slate-800 border-slate-600" />
                        </div>
                        <ScrollArea className="max-h-64">
                          <div className="space-y-1.5">
                            {filteredCabinetGroups.map((g: any) => {
                              const isBound = boundGroupIds.has(g.id) && layoutData.instances.find(i => i.cabinetGroupId === g.id)?.instanceId !== selectedInstanceId;
                              return (
                                <button key={g.id} className={`w-full text-left p-2.5 rounded-lg border transition-all ${isBound ? "border-slate-700/30 opacity-50 cursor-not-allowed" : "border-slate-700 hover:border-cyan-500/50 cursor-pointer"}`} onClick={() => !isBound && bindCabinetGroup(g.id)} disabled={isBound}>
                                  <div className="flex items-center justify-between">
                                    <span className="text-xs font-medium">{g.name}</span>
                                    <div className="flex items-center gap-1.5">
                                      {isBound && <Badge variant="outline" className="text-[10px] text-slate-500">已绑定</Badge>}
                                      <Badge variant="outline" className={`text-[10px] ${g.status === "normal" ? "text-green-400 border-green-500/30" : g.status === "warning" ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30"}`}>
                                        {g.status === "normal" ? "正常" : g.status === "warning" ? "警告" : "报警"}
                                      </Badge>
                                    </div>
                                  </div>
                                  <div className="text-[10px] text-slate-400 mt-0.5">
                                    ID: {g.id} | 重量: {(g.currentWeight / 1000).toFixed(1)}kg | 阈值: {(g.alarmThreshold / 1000).toFixed(1)}kg
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </ScrollArea>
                      </DialogContent>
                    </Dialog>
                  )}
                </CardContent>
              </Card>

              {/* Meta */}
              <Card className="bg-slate-900/80 border-slate-700/50">
                <CardHeader className="py-3 px-4"><CardTitle className="text-sm">标签与备注</CardTitle></CardHeader>
                <CardContent className="px-4 pb-3 space-y-2">
                  <Input value={selectedInstance.meta.label} onChange={e => updateInstanceMeta("label", e.target.value)} placeholder="显示标签" className="h-7 text-xs bg-slate-800 border-slate-600" />
                  <Input value={selectedInstance.meta.remark} onChange={e => updateInstanceMeta("remark", e.target.value)} placeholder="备注" className="h-7 text-xs bg-slate-800 border-slate-600" />
                </CardContent>
              </Card>
            </div>
          </ScrollArea>
        ) : (
          <Card className="bg-slate-900/80 border-slate-700/50 flex-1">
            <CardContent className="flex flex-col items-center justify-center h-full text-center p-6">
              <div className="w-12 h-12 rounded-full bg-slate-800 flex items-center justify-center mb-3">
                <Move className="h-5 w-5 text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">选择一个柜组实例</p>
              <p className="text-xs text-slate-500 mt-1">点击3D场景中的柜组或从左侧列表选择</p>
              <p className="text-xs text-slate-500 mt-3">快捷键: G=平移 R=旋转 S=缩放 Del=删除</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
