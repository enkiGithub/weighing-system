"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, CheckCircle2, AlertTriangle, AlertOctagon, Activity, ZoomIn, ZoomOut, Maximize2, Bell } from "lucide-react";
import { AlarmPanel } from "@/components/AlarmPanel";
import { AlarmSound } from "@/components/AlarmSound";

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
  rotation?: number;
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

// Status color helpers - return null for normal to use group color
function getStatusColor(status: string): string | null {
  if (status === "alarm") return "#ef4444";
  if (status === "warning") return "#f59e0b";
  return null; // normal: use group color
}

function getStatusFill(status: string): string | null {
  if (status === "alarm") return "#7f1d1d";
  if (status === "warning") return "#78350f";
  return null; // normal: use group color with opacity
}

// Darken a hex color for fill background
function darkenColor(hex: string, factor: number = 0.3): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `#${Math.round(r * factor).toString(16).padStart(2, '0')}${Math.round(g * factor).toString(16).padStart(2, '0')}${Math.round(b * factor).toString(16).padStart(2, '0')}`;
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

  // Reset viewBox when layout changes
  useEffect(() => {
    setViewBox(initialViewBox);
  }, [initialViewBox]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const zoomFactor = e.deltaY > 0 ? 1.1 : 0.9;
    setViewBox(prev => ({
      ...prev,
      w: prev.w * zoomFactor,
      h: prev.h * zoomFactor,
    }));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    setIsPanning(true);
    setPanStart({ x: e.clientX, y: e.clientY, vx: viewBox.x, vy: viewBox.y });
  }, [viewBox]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !svgRef.current) return;

    const dx = (e.clientX - panStart.x) * (viewBox.w / svgRef.current.clientWidth);
    const dy = (e.clientY - panStart.y) * (viewBox.h / svgRef.current.clientHeight);

    setViewBox(prev => ({
      ...prev,
      x: panStart.vx - dx,
      y: panStart.vy - dy,
    }));
  }, [isPanning, panStart, viewBox]);

  const handleMouseUp = useCallback(() => {
    setIsPanning(false);
  }, []);

  // Background elements (lines, polylines)
  const bgElements = useMemo(() => {
    return (
      <>
        {layoutData.lines.map((line, i) => (
          <line
            key={`line-${i}`}
            x1={line.x1}
            y1={line.y1}
            x2={line.x2}
            y2={line.y2}
            stroke="#475569"
            strokeWidth="2"
          />
        ))}
        {layoutData.polylines.map((poly, i) => (
          <polyline
            key={`poly-${i}`}
            points={poly.points.map(p => `${p[0]},${p[1]}`).join(" ")}
            fill="none"
            stroke="#475569"
            strokeWidth="2"
          />
        ))}
      </>
    );
  }, [layoutData]);

  // Cabinet elements (rectangles with status colors)
  const cabinetElements = useMemo(() => {
    return layoutData.cabinets.map((cab) => {
      const groupId = cab.cabinetGroupId;
      const group = groupId ? cabinetGroupsMap.get(groupId) : null;
      const statusColor = group ? getStatusColor(group.status) : null;
      const statusFill = group ? getStatusFill(group.status) : null;
      const baseColor = groupColorMap.get(groupId || 0) || "#94a3b8";
      const fillColor = statusFill || darkenColor(baseColor);
      const strokeColor = statusColor || baseColor;

      return (
        <g key={`cabinet-${cab.id}`}>
          {/* Cabinet rectangle */}
          <polygon
            points={cab.corners.map(c => `${c[0]},${c[1]}`).join(" ")}
            fill={fillColor}
            stroke={strokeColor}
            strokeWidth="3"
            opacity="0.7"
            onMouseEnter={(e) => {
              const rect = svgRef.current?.getBoundingClientRect();
              if (rect) {
                onCabinetHover(cab.id, e.clientX - rect.left, e.clientY - rect.top);
              }
            }}
            onMouseLeave={onCabinetLeave}
            style={{ cursor: "pointer" }}
          />

          {/* Cross lines */}
          {cab.crossLines.map((line, i) => (
            <line
              key={`cross-${cab.id}-${i}`}
              x1={line[0][0]}
              y1={line[0][1]}
              x2={line[1][0]}
              y2={line[1][1]}
              stroke={strokeColor}
              strokeWidth="1"
              opacity="0.5"
            />
          ))}
        </g>
      );
    });
  }, [layoutData.cabinets, cabinetGroupsMap, groupColorMap, onCabinetHover, onCabinetLeave]);

  // Group labels
  const groupLabels = useMemo(() => {
    const labelMap = new Map<number, { x: number; y: number; label: string }>();

    layoutData.cabinets.forEach(cab => {
      if (cab.cabinetGroupId !== null) {
        const group = cabinetGroupsMap.get(cab.cabinetGroupId);
        if (group) {
          labelMap.set(cab.cabinetGroupId, {
            x: cab.centerX,
            y: cab.centerY,
            label: group.name,
          });
        }
      }
    });

    return Array.from(labelMap.values()).map((label, i) => (
      <text
        key={`label-${i}`}
        x={label.x}
        y={label.y}
        textAnchor="middle"
        dominantBaseline="middle"
        fill="#e2e8f0"
        fontSize="14"
        fontWeight="600"
        pointerEvents="none"
      >
        {label.label}
      </text>
    ));
  }, [layoutData.cabinets, cabinetGroupsMap]);

  return (
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
      {/* Use oversized rect to eliminate color gap between SVG and container */}
      <rect x={viewBox.x - viewBox.w} y={viewBox.y - viewBox.h} width={viewBox.w * 3} height={viewBox.h * 3} fill="#020617" />
      <g transform={`rotate(${layoutData.rotation || 0} ${viewBox.x + viewBox.w / 2} ${viewBox.y + viewBox.h / 2})`}>
        {bgElements}
        {cabinetElements}
        {groupLabels}
      </g>
    </svg>
  );
}

// ===== Main Monitor Component =====
export default function Monitor() {
  const [hoveredInfo, setHoveredInfo] = useState<{
    cabinetId: number;
    screenX: number;
    screenY: number;
  } | null>(null);

  // 报警面板状态
  const [showAlarmPanel, setShowAlarmPanel] = useState(false);
  const [alarmSoundEnabled, setAlarmSoundEnabled] = useState(true);

  // Queries with auto-refresh (使用monitor专用API)
  const activeLayoutQuery = trpc.monitor.getActiveLayout.useQuery(undefined, {
    refetchInterval: 10000,
  });
  const cabinetGroupsQuery = trpc.monitor.getCabinetGroups.useQuery(undefined, {
    refetchInterval: 5000,
  });

  // 查询未处理报警数量
  const unhandledAlarmsQuery = trpc.alarms.getUnhandled.useQuery(undefined, {
    refetchInterval: 3000,
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAlarmPanel(!showAlarmPanel)}
            className="relative"
          >
            <Bell className="h-4 w-4 mr-2" />
            报警
            {(unhandledAlarmsQuery.data || 0) > 0 && (
              <Badge variant="destructive" className="absolute -top-2 -right-2 h-5 w-5 p-0 flex items-center justify-center text-xs">
                {unhandledAlarmsQuery.data}
              </Badge>
            )}
          </Button>
        </div>
      </div>

      {/* 2D SVG Scene */}
      <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 bg-[#020617] relative">
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

      {/* 报警面板 */}
      <AlarmPanel
        isOpen={showAlarmPanel}
        onClose={() => setShowAlarmPanel(false)}
        onAlarmSoundToggle={setAlarmSoundEnabled}
        alarmSoundEnabled={alarmSoundEnabled}
      />

      {/* 报警声音提示 */}
      <AlarmSound
        enabled={alarmSoundEnabled}
        alarmCount={unhandledAlarmsQuery.data || 0}
      />
    </div>
  );
}
