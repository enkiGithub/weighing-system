import { useState, useCallback, Suspense, useMemo } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Html } from "@react-three/drei";
import * as THREE from "three";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, CheckCircle2, AlertTriangle, AlertOctagon, Activity } from "lucide-react";
import { CabinetGroup3D } from "@/components/three/CabinetGroup3D";
import type { CabinetGroupModelParams } from "@/components/three/CabinetGroup3D";
import { SceneSetup } from "@/components/three/SceneSetup";

// Types matching editor
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

// Monitor Instance Component
function MonitorInstance({
  instance,
  groupData,
  onHover,
  onLeave,
}: {
  instance: LayoutInstance;
  groupData?: { name: string; status: string; currentWeight: number; initialWeight: number; alarmThreshold: number };
  onHover: (inst: LayoutInstance, gd: any) => void;
  onLeave: () => void;
}) {
  const [hovered, setHovered] = useState(false);
  const status = (groupData?.status as "normal" | "warning" | "alarm") || "normal";

  return (
    <group
      position={[instance.transform.position.x, instance.transform.position.y, instance.transform.position.z]}
      rotation={[instance.transform.rotation.x, instance.transform.rotation.y, instance.transform.rotation.z]}
      scale={[instance.transform.scale.x, instance.transform.scale.y, instance.transform.scale.z]}
    >
      <CabinetGroup3D
        model={instance.model}
        status={status}
        selected={false}
        hovered={hovered}
        onPointerOver={(e: any) => {
          e.stopPropagation();
          setHovered(true);
          if (groupData) onHover(instance, groupData);
        }}
        onPointerOut={() => {
          setHovered(false);
          onLeave();
        }}
      />
      {/* Floating label always visible */}
      <Html
        position={[0, instance.model.cabinetHeight + 0.25, 0]}
        center
        distanceFactor={8}
        style={{ pointerEvents: "none" }}
      >
        <div className={`rounded-lg px-3 py-2 text-center whitespace-nowrap backdrop-blur-md border shadow-lg transition-all ${
          hovered ? "scale-110" : ""
        } ${
          status === "alarm"
            ? "bg-red-950/90 border-red-500/50 shadow-red-500/20"
            : status === "warning"
            ? "bg-amber-950/90 border-amber-500/50 shadow-amber-500/20"
            : "bg-slate-900/90 border-cyan-500/30 shadow-cyan-500/10"
        }`}>
          <div className={`text-xs font-semibold ${
            status === "alarm" ? "text-red-400" : status === "warning" ? "text-amber-400" : "text-cyan-400"
          }`}>
            {instance.meta.label || groupData?.name || "未绑定"}
          </div>
          {groupData && (
            <div className={`text-lg font-bold mt-0.5 ${
              status === "alarm" ? "text-red-300" : status === "warning" ? "text-amber-300" : "text-cyan-300"
            }`}>
              {(groupData.currentWeight / 1000).toFixed(2)}
              <span className="text-[10px] font-normal ml-0.5 opacity-70">kg</span>
            </div>
          )}
          {!groupData && instance.cabinetGroupId && (
            <div className="text-[10px] text-slate-500 mt-0.5">数据加载中...</div>
          )}
        </div>
      </Html>

      {/* Alarm pulse effect */}
      {status === "alarm" && (
        <mesh position={[0, instance.model.cabinetHeight / 2, 0]}>
          <sphereGeometry args={[
            Math.max(instance.model.columns * instance.model.cabinetWidth, instance.model.cabinetHeight) * 0.8,
            16, 16
          ]} />
          <meshBasicMaterial color="#ef4444" transparent opacity={0.05} side={THREE.DoubleSide} />
        </mesh>
      )}
    </group>
  );
}

export default function Monitor() {
  const [hoveredInfo, setHoveredInfo] = useState<{
    instance: LayoutInstance;
    groupData: any;
  } | null>(null);

  // Queries with auto-refresh
  const activeLayoutQuery = trpc.layoutEditor.vaultLayouts.getActive.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const cabinetGroupsQuery = trpc.cabinetGroups.list.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Parse layout data
  const layoutData = useMemo<LayoutData | null>(() => {
    if (!activeLayoutQuery.data?.layoutData) return null;
    try {
      const data = JSON.parse(activeLayoutQuery.data.layoutData) as LayoutData;
      if (!data.scene) return null;
      if (!data.instances) data.instances = [];
      return data;
    } catch {
      return null;
    }
  }, [activeLayoutQuery.data]);

  // Cabinet groups map
  const cabinetGroupsMap = useMemo(() => {
    const map = new Map<number, any>();
    (cabinetGroupsQuery.data || []).forEach((g: any) => {
      map.set(g.id, g);
    });
    return map;
  }, [cabinetGroupsQuery.data]);

  // Statistics
  const stats = useMemo(() => {
    if (!layoutData) return { total: 0, normal: 0, warning: 0, alarm: 0 };
    let normal = 0, warning = 0, alarm = 0;
    layoutData.instances.forEach(inst => {
      if (!inst.cabinetGroupId) return;
      const g = cabinetGroupsMap.get(inst.cabinetGroupId);
      if (!g) return;
      if (g.status === "alarm") alarm++;
      else if (g.status === "warning") warning++;
      else normal++;
    });
    return {
      total: layoutData.instances.filter(i => i.cabinetGroupId).length,
      normal, warning, alarm,
    };
  }, [layoutData, cabinetGroupsMap]);

  const handleHover = useCallback((inst: LayoutInstance, groupData: any) => {
    setHoveredInfo({ instance: inst, groupData });
  }, []);

  const handleLeave = useCallback(() => {
    setHoveredInfo(null);
  }, []);

  if (activeLayoutQuery.isLoading) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
          <p className="text-sm text-slate-400">加载布局数据...</p>
        </div>
      </div>
    );
  }

  if (!layoutData || layoutData.instances.length === 0) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-3">
          <Activity className="h-12 w-12 text-slate-500 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-300">暂无激活布局</h2>
          <p className="text-sm text-slate-500">请在布局编辑器中创建并激活一个保管库布局</p>
        </div>
      </div>
    );
  }

  const cam = layoutData.scene.cameraDefault;

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">实时监视</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeLayoutQuery.data?.name && `布局: ${activeLayoutQuery.data.name} · `}
            拖拽鼠标旋转视图，悬停柜组查看详细信息
          </p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <CheckCircle2 className="h-4 w-4 text-cyan-400" />
            <span className="text-xs text-slate-300">正常</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertTriangle className="h-4 w-4 text-amber-400" />
            <span className="text-xs text-slate-300">警告</span>
          </div>
          <div className="flex items-center gap-1.5">
            <AlertOctagon className="h-4 w-4 text-red-400" />
            <span className="text-xs text-slate-300">报警</span>
          </div>
        </div>
      </div>

      {/* 3D Scene */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-950 relative">
        <Canvas
          shadows
          camera={{
            position: [cam.position.x, cam.position.y, cam.position.z],
            fov: 50,
            near: 0.1,
            far: 100,
          }}
          gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping, toneMappingExposure: 1.2 }}
        >
          <Suspense fallback={null}>
            <SceneSetup gridSize={layoutData.scene.gridSize} showGizmo={false} />
            <OrbitControls
              makeDefault
              enableDamping
              dampingFactor={0.1}
              minDistance={2}
              maxDistance={30}
              maxPolarAngle={Math.PI / 2.1}
            />
            {layoutData.instances.map((inst) => {
              const groupData = inst.cabinetGroupId ? cabinetGroupsMap.get(inst.cabinetGroupId) : undefined;
              return (
                <MonitorInstance
                  key={inst.instanceId}
                  instance={inst}
                  groupData={groupData}
                  onHover={handleHover}
                  onLeave={handleLeave}
                />
              );
            })}
          </Suspense>
        </Canvas>

        {/* Hover detail panel */}
        {hoveredInfo && hoveredInfo.groupData && (
          <div className="absolute top-4 right-4 w-64 pointer-events-none z-10">
            <Card className="bg-slate-900/95 border-slate-700/50 backdrop-blur-md shadow-xl">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">{hoveredInfo.groupData.name}</span>
                  <Badge variant="outline" className={`text-[10px] ${
                    hoveredInfo.groupData.status === "normal" ? "text-cyan-400 border-cyan-500/50" :
                    hoveredInfo.groupData.status === "warning" ? "text-amber-400 border-amber-500/50" :
                    "text-red-400 border-red-500/50"
                  }`}>
                    {hoveredInfo.groupData.status === "normal" ? "正常" : hoveredInfo.groupData.status === "warning" ? "警告" : "报警"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">当前重量</div>
                    <div className="text-sm font-bold text-cyan-400">{(hoveredInfo.groupData.currentWeight / 1000).toFixed(2)} kg</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">初始重量</div>
                    <div className="text-sm font-bold text-slate-300">{(hoveredInfo.groupData.initialWeight / 1000).toFixed(2)} kg</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">变化量</div>
                    <div className={`text-sm font-bold ${
                      hoveredInfo.groupData.currentWeight - hoveredInfo.groupData.initialWeight > 0 ? "text-green-400" :
                      hoveredInfo.groupData.currentWeight - hoveredInfo.groupData.initialWeight < 0 ? "text-red-400" :
                      "text-slate-400"
                    }`}>
                      {((hoveredInfo.groupData.currentWeight - hoveredInfo.groupData.initialWeight) / 1000).toFixed(2)} kg
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">报警阈值</div>
                    <div className="text-sm font-bold text-amber-400">{(hoveredInfo.groupData.alarmThreshold / 1000).toFixed(2)} kg</div>
                  </div>
                </div>
                {hoveredInfo.instance.meta.remark && (
                  <div className="text-[10px] text-slate-500 border-t border-slate-700 pt-2">
                    备注: {hoveredInfo.instance.meta.remark}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>

      {/* Bottom Stats */}
      <div className="grid grid-cols-4 gap-3 shrink-0">
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/10 flex items-center justify-center">
              <Activity className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">监控总数</div>
              <div className="text-xl font-bold text-slate-200">{stats.total}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-green-500/10 flex items-center justify-center">
              <CheckCircle2 className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">正常</div>
              <div className="text-xl font-bold text-green-400">{stats.normal}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">警告</div>
              <div className="text-xl font-bold text-amber-400">{stats.warning}</div>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-slate-900/80 border-slate-700/50">
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-red-500/10 flex items-center justify-center">
              <AlertOctagon className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <div className="text-[10px] text-slate-500 uppercase">报警</div>
              <div className="text-xl font-bold text-red-400">{stats.alarm}</div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
