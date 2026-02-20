import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, AlertOctagon, Activity, ZoomIn, ZoomOut, Maximize2 } from "lucide-react";

// ===== Types =====
interface DxfCabinet {
  id: number;
  blockName: string;
  centerX: number;
  centerY: number;
  rotation: number;
  corners: [number, number][];
  crossLines: [[number, number], [number, number]][];
  cabinetGroupId: number | null;
}

interface DxfPolyline {
  points: [number, number][];
  closed: boolean;
  layer: string;
}

interface DxfLine {
  x1: number; y1: number; x2: number; y2: number;
  layer: string;
}

interface DxfLayoutData {
  bounds: { minX: number; minY: number; maxX: number; maxY: number };
  lines: DxfLine[];
  polylines: DxfPolyline[];
  cabinets: DxfCabinet[];
}

// ===== Color palette =====
const GROUP_COLORS = [
  "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#e11d48", "#0ea5e9", "#d946ef", "#22c55e", "#eab308",
  "#3b82f6", "#a855f7", "#f43f5e", "#059669", "#7c3aed",
];

function getGroupColor(groupId: number): string {
  return GROUP_COLORS[groupId % GROUP_COLORS.length];
}

// Status color helpers
function getStatusColor(status: string): string {
  if (status === "alarm") return "#ef4444";
  if (status === "warning") return "#f59e0b";
  return "#06b6d4";
}

function getStatusFill(status: string): string {
  if (status === "alarm") return "#7f1d1d";
  if (status === "warning") return "#78350f";
  return "#164e63";
}

// ===== Monitor SVG Renderer =====
function MonitorSVG({
  layoutData,
  cabinetGroupsMap,
  groupColorMap,
  onCabinetHover,
  onCabinetLeave,
}: {
  layoutData: DxfLayoutData;
  cabinetGroupsMap: Map<number, any>;
  groupColorMap: Map<number, string>;
  onCabinetHover: (cabId: number, screenX: number, screenY: number) => void;
  onCabinetLeave: () => void;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0 });

  // Compute initial viewBox from bounds
  const initialViewBox = useMemo(() => {
    const { bounds } = layoutData;
    const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.05;
    return {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      w: (bounds.maxX - bounds.minX) + padding * 2,
      h: (bounds.maxY - bounds.minY) + padding * 2,
    };
  }, [layoutData]);

  const [viewBox, setViewBox] = useState(initialViewBox);
  useEffect(() => { setViewBox(initialViewBox); }, [initialViewBox]);

  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    const rect = svgRef.current.getBoundingClientRect();
    const x = viewBox.x + (clientX - rect.left) / rect.width * viewBox.w;
    const y = viewBox.y + (clientY - rect.top) / rect.height * viewBox.h;
    return { x, y };
  }, [viewBox]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const svgPt = screenToSvg(e.clientX, e.clientY);
    setViewBox(prev => ({
      x: svgPt.x - (svgPt.x - prev.x) * factor,
      y: svgPt.y - (svgPt.y - prev.y) * factor,
      w: prev.w * factor,
      h: prev.h * factor,
    }));
  }, [screenToSvg]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0 || e.button === 1) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y });
    }
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning && svgRef.current) {
      const rect = svgRef.current.getBoundingClientRect();
      const dx = (e.clientX - panStart.x) / rect.width * viewBox.w;
      const dy = (e.clientY - panStart.y) / rect.height * viewBox.h;
      setViewBox(prev => ({ ...prev, x: panStart.vx - dx, y: panStart.vy - dy }));
    }
  }, [isPanning, panStart, viewBox]);

  const handleMouseUp = useCallback(() => { setIsPanning(false); }, []);

  const zoomIn = useCallback(() => {
    setViewBox(prev => {
      const cx = prev.x + prev.w / 2, cy = prev.y + prev.h / 2;
      const nw = prev.w * 0.75, nh = prev.h * 0.75;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setViewBox(prev => {
      const cx = prev.x + prev.w / 2, cy = prev.y + prev.h / 2;
      const nw = prev.w * 1.33, nh = prev.h * 1.33;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  }, []);

  const fitAll = useCallback(() => { setViewBox(initialViewBox); }, [initialViewBox]);

  // Background geometry
  const bgElements = useMemo(() => (
    <>
      {layoutData.polylines.map((pl, i) => {
        const pts = pl.points.map(p => `${p[0]},${p[1]}`).join(" ");
        return pl.closed ? (
          <polygon key={`pl-${i}`} points={pts} fill="none" stroke="#94a3b8" strokeWidth={0.5} strokeOpacity={0.4} />
        ) : (
          <polyline key={`pl-${i}`} points={pts} fill="none" stroke="#94a3b8" strokeWidth={0.5} strokeOpacity={0.4} />
        );
      })}
      {layoutData.lines.map((l, i) => (
        <line key={`ln-${i}`} x1={l.x1} y1={l.y1} x2={l.x2} y2={l.y2} stroke="#94a3b8" strokeWidth={0.5} strokeOpacity={0.4} />
      ))}
    </>
  ), [layoutData.polylines, layoutData.lines]);

  // Cabinet elements with status coloring
  const cabinetElements = useMemo(() => {
    return layoutData.cabinets.map(cab => {
      const groupId = cab.cabinetGroupId;
      const groupData = groupId !== null ? cabinetGroupsMap.get(groupId) : undefined;
      const status = groupData?.status || "normal";
      const isBound = groupId !== null;

      let fillColor: string;
      let fillOpacity: number;
      let strokeColor: string;

      if (isBound && groupData) {
        fillColor = getStatusFill(status);
        fillOpacity = 0.7;
        strokeColor = getStatusColor(status);
      } else if (isBound) {
        const color = groupColorMap.get(groupId!) || getGroupColor(groupId!);
        fillColor = color;
        fillOpacity = 0.3;
        strokeColor = color;
      } else {
        fillColor = "#334155";
        fillOpacity = 0.15;
        strokeColor = "#64748b";
      }

      const pts = cab.corners.map(c => `${c[0]},${c[1]}`).join(" ");

      return (
        <g
          key={cab.id}
          onMouseEnter={(e) => {
            if (isBound) onCabinetHover(cab.id, e.clientX, e.clientY);
          }}
          onMouseMove={(e) => {
            if (isBound) onCabinetHover(cab.id, e.clientX, e.clientY);
          }}
          onMouseLeave={onCabinetLeave}
          style={{ cursor: isBound ? "pointer" : "default" }}
        >
          <polygon
            points={pts}
            fill={fillColor}
            fillOpacity={fillOpacity}
            stroke={strokeColor}
            strokeWidth={0.8}
          />
          {cab.crossLines.map((cl, i) => (
            <line
              key={i}
              x1={cl[0][0]} y1={cl[0][1]}
              x2={cl[1][0]} y2={cl[1][1]}
              stroke={strokeColor}
              strokeWidth={0.3}
              strokeOpacity={0.4}
            />
          ))}
          {/* Alarm pulse animation */}
          {status === "alarm" && (
            <polygon
              points={pts}
              fill="none"
              stroke="#ef4444"
              strokeWidth={1.5}
              strokeOpacity={0.6}
            >
              <animate attributeName="stroke-opacity" values="0.6;0.1;0.6" dur="1.5s" repeatCount="indefinite" />
            </polygon>
          )}
        </g>
      );
    });
  }, [layoutData.cabinets, cabinetGroupsMap, groupColorMap, onCabinetHover, onCabinetLeave]);

  return (
    <div className="relative w-full h-full">
      {/* Toolbar */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-slate-900/90 border border-slate-700/50 rounded-lg p-1 backdrop-blur-sm">
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={zoomIn} title="放大">
          <ZoomIn className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={zoomOut} title="缩小">
          <ZoomOut className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fitAll} title="适应全部">
          <Maximize2 className="h-3.5 w-3.5" />
        </Button>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: isPanning ? "grabbing" : "grab" }}
      >
        <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="#0f172a" />
        {bgElements}
        {cabinetElements}
      </svg>
    </div>
  );
}

// ===== Main Monitor Component =====
export default function Monitor() {
  const [hoveredInfo, setHoveredInfo] = useState<{
    cabinetId: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // Queries with auto-refresh (使用monitor专用API)
  const activeLayoutQuery = trpc.monitor.getActiveLayout.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const cabinetGroupsQuery = trpc.monitor.getCabinetGroups.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // Parse layout data (new DXF format)
  const layoutData = useMemo<DxfLayoutData | null>(() => {
    if (!activeLayoutQuery.data?.layoutData) return null;
    try {
      const data = JSON.parse(activeLayoutQuery.data.layoutData);
      // Check for DXF format (has bounds and cabinets)
      if (data.bounds && data.cabinets) return data as DxfLayoutData;
      return null;
    } catch {
      return null;
    }
  }, [activeLayoutQuery.data]);

  // Cabinet groups map
  const cabinetGroupsMap = useMemo(() => {
    const map = new Map<number, any>();
    (cabinetGroupsQuery.data || []).forEach((g: any) => map.set(g.id, g));
    return map;
  }, [cabinetGroupsQuery.data]);

  // Group color map
  const groupColorMap = useMemo(() => {
    const map = new Map<number, string>();
    (cabinetGroupsQuery.data || []).forEach((g: any, i: number) => {
      map.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]);
    });
    return map;
  }, [cabinetGroupsQuery.data]);

  // Cabinet to group mapping for hover
  const cabinetToGroup = useMemo(() => {
    if (!layoutData) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const cab of layoutData.cabinets) {
      if (cab.cabinetGroupId !== null) {
        map.set(cab.id, cab.cabinetGroupId);
      }
    }
    return map;
  }, [layoutData]);

  // Hovered group data
  const hoveredGroupData = useMemo(() => {
    if (!hoveredInfo) return null;
    const groupId = cabinetToGroup.get(hoveredInfo.cabinetId);
    if (groupId === undefined) return null;
    return cabinetGroupsMap.get(groupId) || null;
  }, [hoveredInfo, cabinetToGroup, cabinetGroupsMap]);

  // Statistics
  const stats = useMemo(() => {
    if (!layoutData) return { total: 0, normal: 0, warning: 0, alarm: 0, boundGroups: new Set<number>() };
    const boundGroups = new Set<number>();
    for (const cab of layoutData.cabinets) {
      if (cab.cabinetGroupId !== null) boundGroups.add(cab.cabinetGroupId);
    }
    let normal = 0, warning = 0, alarm = 0;
    boundGroups.forEach(gid => {
      const g = cabinetGroupsMap.get(gid);
      if (!g) return;
      if (g.status === "alarm") alarm++;
      else if (g.status === "warning") warning++;
      else normal++;
    });
    return { total: boundGroups.size, normal, warning, alarm, boundGroups };
  }, [layoutData, cabinetGroupsMap]);

  const handleCabinetHover = useCallback((cabId: number, screenX: number, screenY: number) => {
    setHoveredInfo({ cabinetId: cabId, screenX, screenY });
  }, []);

  const handleCabinetLeave = useCallback(() => {
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

  if (!layoutData) {
    return (
      <div className="flex items-center justify-center h-[calc(100vh-4rem)]">
        <div className="text-center space-y-3">
          <Activity className="h-12 w-12 text-slate-500 mx-auto" />
          <h2 className="text-xl font-semibold text-slate-300">暂无激活布局</h2>
          <p className="text-sm text-slate-500">请在布局编辑器中导入DXF文件并激活布局</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-2rem)] flex flex-col gap-3">
      {/* Header */}
      <div className="flex items-center justify-between shrink-0">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">实时监视</h1>
          <p className="text-sm text-slate-400 mt-0.5">
            {activeLayoutQuery.data?.name && `布局: ${activeLayoutQuery.data.name} · `}
            拖拽平移视图，滚轮缩放，悬停柜列查看柜组详情
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

      {/* 2D SVG Scene */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 bg-slate-950 relative">
        <MonitorSVG
          layoutData={layoutData}
          cabinetGroupsMap={cabinetGroupsMap}
          groupColorMap={groupColorMap}
          onCabinetHover={handleCabinetHover}
          onCabinetLeave={handleCabinetLeave}
        />

        {/* Hover tooltip */}
        {hoveredInfo && hoveredGroupData && (
          <div
            className="fixed z-50 pointer-events-none"
            style={{
              left: hoveredInfo.screenX + 16,
              top: hoveredInfo.screenY - 10,
            }}
          >
            <Card className="bg-slate-900/95 border-slate-700/50 backdrop-blur-md shadow-xl w-64">
              <CardContent className="p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm font-semibold text-slate-200">{hoveredGroupData.name}</span>
                  <Badge variant="outline" className={`text-[10px] ${
                    hoveredGroupData.status === "normal" ? "text-cyan-400 border-cyan-500/50" :
                    hoveredGroupData.status === "warning" ? "text-amber-400 border-amber-500/50" :
                    "text-red-400 border-red-500/50"
                  }`}>
                    {hoveredGroupData.status === "normal" ? "正常" : hoveredGroupData.status === "warning" ? "警告" : "报警"}
                  </Badge>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">当前重量</div>
                    <div className="text-sm font-bold text-cyan-400">{(hoveredGroupData.currentWeight / 1000).toFixed(2)} kg</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">初始重量</div>
                    <div className="text-sm font-bold text-slate-300">{(hoveredGroupData.initialWeight / 1000).toFixed(2)} kg</div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">变化量</div>
                    <div className={`text-sm font-bold ${
                      hoveredGroupData.currentWeight - hoveredGroupData.initialWeight > 0 ? "text-green-400" :
                      hoveredGroupData.currentWeight - hoveredGroupData.initialWeight < 0 ? "text-red-400" :
                      "text-slate-400"
                    }`}>
                      {((hoveredGroupData.currentWeight - hoveredGroupData.initialWeight) / 1000).toFixed(2)} kg
                    </div>
                  </div>
                  <div className="bg-slate-800/50 rounded-lg p-2">
                    <div className="text-[10px] text-slate-500">报警阈值</div>
                    <div className="text-sm font-bold text-amber-400">{(hoveredGroupData.alarmThreshold / 1000).toFixed(2)} kg</div>
                  </div>
                </div>
                <div className="text-[10px] text-slate-500 border-t border-slate-700 pt-2">
                  柜组ID: {hoveredGroupData.id} | 柜列数: {layoutData.cabinets.filter(c => c.cabinetGroupId === hoveredGroupData.id).length}
                </div>
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
              <div className="text-[10px] text-slate-500 uppercase">监控柜组</div>
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
