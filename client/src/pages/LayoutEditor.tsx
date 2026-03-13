import { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import {
  Save, Upload, Link2, Unlink,
  Search, FolderOpen, FilePlus, Loader2, Eye,
  ZoomIn, ZoomOut, Maximize2, MousePointer2, Square, Trash2,
  RotateCw, ChevronUp, ChevronDown
} from "lucide-react";
import { usePermissions } from "@/hooks/usePermissions";

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
  rotation?: number; // 0~360 degrees
}

// ===== Color palette for cabinet groups =====
const GROUP_COLORS = [
  "#06b6d4", "#f59e0b", "#10b981", "#ef4444", "#8b5cf6",
  "#ec4899", "#14b8a6", "#f97316", "#6366f1", "#84cc16",
  "#e11d48", "#0ea5e9", "#d946ef", "#22c55e", "#eab308",
  "#3b82f6", "#a855f7", "#f43f5e", "#059669", "#7c3aed",
];

function getGroupColor(groupId: number): string {
  return GROUP_COLORS[groupId % GROUP_COLORS.length];
}

// ===== SVG Layout Renderer =====
function LayoutSVG({
  layoutData,
  selectedCabinetIds,
  onCabinetClick,
  onSelectionRect,
  viewBox,
  groupColorMap,
  cabinetGroupsMap,
  rotation,
}: {
  layoutData: DxfLayoutData;
  selectedCabinetIds: Set<number>;
  onCabinetClick: (id: number, shiftKey: boolean) => void;
  onSelectionRect: (rect: { x1: number; y1: number; x2: number; y2: number }) => void;
  viewBox: { x: number; y: number; w: number; h: number };
  groupColorMap: Map<number, string>;
  cabinetGroupsMap: Map<number, any>;
  rotation: number;
}) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [isPanning, setIsPanning] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [panStart, setPanStart] = useState({ x: 0, y: 0, vx: 0, vy: 0 });
  const [selRect, setSelRect] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const [localViewBox, setLocalViewBox] = useState(viewBox);
  const [tool, setTool] = useState<"select" | "pan">("select");

  useEffect(() => { setLocalViewBox(viewBox); }, [viewBox]);

  const screenToSvg = useCallback((clientX: number, clientY: number) => {
    if (!svgRef.current) return { x: 0, y: 0 };
    // 使用SVG原生坐标变换API，精确处理preserveAspectRatio带来的偏移
    const svg = svgRef.current;
    const pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    const ctm = svg.getScreenCTM();
    if (ctm) {
      const svgPt = pt.matrixTransform(ctm.inverse());
      return { x: svgPt.x, y: svgPt.y };
    }
    // 回退方案：手动计算
    const rect = svg.getBoundingClientRect();
    const x = localViewBox.x + (clientX - rect.left) / rect.width * localViewBox.w;
    const y = localViewBox.y + (clientY - rect.top) / rect.height * localViewBox.h;
    return { x, y };
  }, [localViewBox]);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const factor = e.deltaY > 0 ? 1.1 : 0.9;
    const svgPt = screenToSvg(e.clientX, e.clientY);
    setLocalViewBox(prev => ({
      x: svgPt.x - (svgPt.x - prev.x) * factor,
      y: svgPt.y - (svgPt.y - prev.y) * factor,
      w: prev.w * factor,
      h: prev.h * factor,
    }));
  }, [screenToSvg]);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 1 || (e.button === 0 && tool === "pan")) {
      setIsPanning(true);
      setPanStart({ x: e.clientX, y: e.clientY, vx: localViewBox.x, vy: localViewBox.y });
    } else if (e.button === 0 && tool === "select") {
      const pt = screenToSvg(e.clientX, e.clientY);
      setIsSelecting(true);
      setSelRect({ x1: pt.x, y1: pt.y, x2: pt.x, y2: pt.y });
    }
  }, [tool, localViewBox, screenToSvg]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (isPanning) {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const dx = (e.clientX - panStart.x) / rect.width * localViewBox.w;
      const dy = (e.clientY - panStart.y) / rect.height * localViewBox.h;
      setLocalViewBox(prev => ({ ...prev, x: panStart.vx - dx, y: panStart.vy - dy }));
    } else if (isSelecting && selRect) {
      const pt = screenToSvg(e.clientX, e.clientY);
      setSelRect(prev => prev ? { ...prev, x2: pt.x, y2: pt.y } : null);
    }
  }, [isPanning, isSelecting, panStart, localViewBox, selRect, screenToSvg]);

  const handleMouseUp = useCallback(() => {
    if (isPanning) setIsPanning(false);
    if (isSelecting && selRect) {
      setIsSelecting(false);
      const x1 = Math.min(selRect.x1, selRect.x2);
      const y1 = Math.min(selRect.y1, selRect.y2);
      const x2 = Math.max(selRect.x1, selRect.x2);
      const y2 = Math.max(selRect.y1, selRect.y2);
      if (Math.abs(x2 - x1) > 1 && Math.abs(y2 - y1) > 1) {
        onSelectionRect({ x1, y1, x2, y2 });
      }
      setSelRect(null);
    }
  }, [isPanning, isSelecting, selRect, onSelectionRect]);

  const zoomIn = useCallback(() => {
    setLocalViewBox(prev => {
      const cx = prev.x + prev.w / 2, cy = prev.y + prev.h / 2;
      const nw = prev.w * 0.75, nh = prev.h * 0.75;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  }, []);

  const zoomOut = useCallback(() => {
    setLocalViewBox(prev => {
      const cx = prev.x + prev.w / 2, cy = prev.y + prev.h / 2;
      const nw = prev.w * 1.33, nh = prev.h * 1.33;
      return { x: cx - nw / 2, y: cy - nh / 2, w: nw, h: nh };
    });
  }, []);

  const fitAll = useCallback(() => { setLocalViewBox(viewBox); }, [viewBox]);

  // Render cabinets
  const cabinetElements = useMemo(() => {
    return layoutData.cabinets.map(cab => {
      const isSelected = selectedCabinetIds.has(cab.id);
      const groupId = cab.cabinetGroupId;
      const color = groupId !== null ? (groupColorMap.get(groupId) || getGroupColor(groupId)) : "#475569";
      const fillColor = groupId !== null ? color : (isSelected ? "#0ea5e9" : "#334155");
      const fillOpacity = isSelected ? 0.6 : (groupId !== null ? 0.4 : 0.15);
      const strokeColor = isSelected ? "#22d3ee" : (groupId !== null ? color : "#64748b");
      const strokeWidth = isSelected ? 1.5 : 0.8;
      const pts = cab.corners.map(c => `${c[0]},${c[1]}`).join(" ");

      return (
        <g key={cab.id} onClick={(e) => { e.stopPropagation(); onCabinetClick(cab.id, e.shiftKey || e.ctrlKey); }} style={{ cursor: "pointer" }}>
          <polygon points={pts} fill={fillColor} fillOpacity={fillOpacity} stroke={strokeColor} strokeWidth={strokeWidth} />
          {cab.crossLines.map((cl, i) => (
            <line key={i} x1={cl[0][0]} y1={cl[0][1]} x2={cl[1][0]} y2={cl[1][1]} stroke={strokeColor} strokeWidth={0.4} strokeOpacity={0.5} />
          ))}
        </g>
      );
    });
  }, [layoutData.cabinets, selectedCabinetIds, groupColorMap, onCabinetClick]);

  // Group label overlays - show group name at centroid of bound cabinets
  const groupLabels = useMemo(() => {
    const groupCabs = new Map<number, DxfCabinet[]>();
    for (const cab of layoutData.cabinets) {
      if (cab.cabinetGroupId !== null) {
        if (!groupCabs.has(cab.cabinetGroupId)) groupCabs.set(cab.cabinetGroupId, []);
        groupCabs.get(cab.cabinetGroupId)!.push(cab);
      }
    }

    const labels: React.ReactElement[] = [];
    groupCabs.forEach((cabs, groupId) => {
      const group = cabinetGroupsMap.get(groupId);
      if (!group) return;
      // Calculate centroid
      const cx = cabs.reduce((s, c) => s + c.centerX, 0) / cabs.length;
      const cy = cabs.reduce((s, c) => s + c.centerY, 0) / cabs.length;
      const color = groupColorMap.get(groupId) || getGroupColor(groupId);
      // Calculate font size based on viewBox (responsive to zoom)
      const fontSize = Math.max(localViewBox.w, localViewBox.h) * 0.012;
      const bgPadX = fontSize * 0.4;
      const bgPadY = fontSize * 0.25;
      const textWidth = group.name.length * fontSize * 0.6;

      labels.push(
        <g key={`label-${groupId}`} style={{ pointerEvents: "none" }}>
          <rect
            x={cx - textWidth / 2 - bgPadX}
            y={cy - fontSize / 2 - bgPadY}
            width={textWidth + bgPadX * 2}
            height={fontSize + bgPadY * 2}
            rx={fontSize * 0.2}
            fill={color}
            fillOpacity={0.85}
          />
          <text
            x={cx}
            y={cy}
            textAnchor="middle"
            dominantBaseline="central"
            fill="white"
            fontSize={fontSize}
            fontWeight="bold"
            style={{ textShadow: "0 1px 2px rgba(0,0,0,0.5)" }}
          >
            {group.name}
          </text>
        </g>
      );
    });
    return labels;
  }, [layoutData.cabinets, cabinetGroupsMap, groupColorMap, localViewBox]);

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

  return (
    <div className="relative w-full h-full">
      {/* Toolbar overlay */}
      <div className="absolute top-3 left-3 z-10 flex items-center gap-1 bg-slate-900/90 border border-slate-700/50 rounded-lg p-1 backdrop-blur-sm">
        <Button size="sm" variant={tool === "select" ? "default" : "ghost"} className={`h-7 w-7 p-0 ${tool === "select" ? "bg-cyan-600" : ""}`} onClick={() => setTool("select")} title="框选工具">
          <MousePointer2 className="h-3.5 w-3.5" />
        </Button>
        <Button size="sm" variant={tool === "pan" ? "default" : "ghost"} className={`h-7 w-7 p-0 ${tool === "pan" ? "bg-cyan-600" : ""}`} onClick={() => setTool("pan")} title="平移工具">
          <Square className="h-3.5 w-3.5" />
        </Button>
        <Separator orientation="vertical" className="h-5 bg-slate-700 mx-0.5" />
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={zoomIn} title="放大"><ZoomIn className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={zoomOut} title="缩小"><ZoomOut className="h-3.5 w-3.5" /></Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={fitAll} title="适应全部"><Maximize2 className="h-3.5 w-3.5" /></Button>
      </div>

      {/* Stats overlay */}
      <div className="absolute bottom-3 left-3 z-10 bg-slate-900/90 border border-slate-700/50 rounded-lg px-3 py-1.5 backdrop-blur-sm">
        <span className="text-[10px] text-slate-400">
          柜列: {layoutData.cabinets.length} | 已选: {selectedCabinetIds.size} | 已绑定: {layoutData.cabinets.filter(c => c.cabinetGroupId !== null).length}
        </span>
      </div>

      <svg
        ref={svgRef}
        className="w-full h-full"
        viewBox={`${localViewBox.x} ${localViewBox.y} ${localViewBox.w} ${localViewBox.h}`}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        style={{ cursor: tool === "pan" || isPanning ? "grab" : "crosshair" }}
      >
        {/* Oversized background rect to eliminate color gap */}
        <rect x={localViewBox.x - localViewBox.w} y={localViewBox.y - localViewBox.h} width={localViewBox.w * 3} height={localViewBox.h * 3} fill="#020617" />
        <g transform={`rotate(${rotation} ${viewBox.x + viewBox.w / 2} ${viewBox.y + viewBox.h / 2})`}>
          {bgElements}
          {cabinetElements}
          {groupLabels}
        </g>
        {selRect && (
          <rect
            x={Math.min(selRect.x1, selRect.x2)}
            y={Math.min(selRect.y1, selRect.y2)}
            width={Math.abs(selRect.x2 - selRect.x1)}
            height={Math.abs(selRect.y2 - selRect.y1)}
            fill="#0ea5e9" fillOpacity={0.1} stroke="#22d3ee" strokeWidth={1} strokeDasharray="4 2"
          />
        )}
      </svg>
    </div>
  );
}

// ===== Main Component =====
export default function LayoutEditor() {
  const { canOperate } = usePermissions();
  const canEdit = canOperate('layout_editor');

  // localStorage key for caching editor state
  const CACHE_KEY = 'layout-editor-state';

  // Try to restore from localStorage on initial mount
  const cachedState = useMemo(() => {
    try {
      const raw = localStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        // 如果是“已清空”标记，返回空状态标记（不加载激活布局）
        if (parsed._cleared) {
          return { _cleared: true } as any;
        }
        if (parsed.layoutData?.bounds && parsed.layoutData?.cabinets) {
          return parsed as {
            layoutData: DxfLayoutData;
            currentLayoutId: number | null;
            layoutName: string;
            layoutDesc: string;
          };
        }
      }
    } catch { /* ignore */ }
    return null;
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Layout state - initialize from cache if available
  const [layoutData, setLayoutData] = useState<DxfLayoutData | null>(cachedState?.layoutData || null);
  const [selectedCabinetIds, setSelectedCabinetIds] = useState<Set<number>>(new Set());
  const [currentLayoutId, setCurrentLayoutId] = useState<number | null>(cachedState?.currentLayoutId ?? null);
  const [layoutName, setLayoutName] = useState(cachedState?.layoutName || "新布局");
  const [layoutDesc, setLayoutDesc] = useState(cachedState?.layoutDesc || "");
  const [showLoadDialog, setShowLoadDialog] = useState(false);
  const [showBindDialog, setShowBindDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Queries
  const layoutsQuery = trpc.layoutEditor.vaultLayouts.list.useQuery();
  const cabinetGroupsQuery = trpc.cabinetGroups.list.useQuery();
  const activeLayoutQuery = trpc.monitor.getActiveLayout.useQuery();
  const utils = trpc.useUtils();

  // 缓存编辑状态到localStorage（当layoutData、currentLayoutId、layoutName、layoutDesc变化时）
  useEffect(() => {
    if (layoutData) {
      try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
          layoutData,
          currentLayoutId,
          layoutName,
          layoutDesc,
        }));
      } catch { /* storage full or unavailable, ignore */ }
    }
    // 注意：layoutData为null时不在这里删除缓存，因为“新建”操作会单独写入_cleared标记
  }, [layoutData, currentLayoutId, layoutName, layoutDesc]);

  // 组件挂载时：如果localStorage没有缓存且没有“已清空”标记，则加载已激活的布局作为默认
  useEffect(() => {
    if (!cachedState && !layoutData && activeLayoutQuery.data) {
      const layout = activeLayoutQuery.data as any;
      try {
        const data = JSON.parse(layout.layoutData);
        if (data.bounds && data.cabinets) {
          setLayoutData(data as DxfLayoutData);
          setCurrentLayoutId(layout.id);
          setLayoutName(layout.name);
          setLayoutDesc(layout.description || "");
        }
      } catch {
        // 解析失败则忽略
      }
    }
  }, [activeLayoutQuery.data]);  // eslint-disable-line react-hooks/exhaustive-deps

  // Mutations
  const parseDxf = trpc.layoutEditor.vaultLayouts.parseDxf.useMutation();
  const createLayout = trpc.layoutEditor.vaultLayouts.create.useMutation({
    onSuccess: () => utils.layoutEditor.vaultLayouts.list.invalidate(),
  });
  const updateLayout = trpc.layoutEditor.vaultLayouts.update.useMutation({
    onSuccess: () => utils.layoutEditor.vaultLayouts.list.invalidate(),
  });
  const setActiveLayout = trpc.layoutEditor.vaultLayouts.setActive.useMutation({
    onSuccess: () => utils.layoutEditor.vaultLayouts.list.invalidate(),
  });
  const deleteLayoutMut = trpc.layoutEditor.vaultLayouts.delete.useMutation({
    onSuccess: () => utils.layoutEditor.vaultLayouts.list.invalidate(),
  });

  // Compute viewBox from layout bounds
  const viewBox = useMemo(() => {
    if (!layoutData) return { x: 0, y: 0, w: 1000, h: 1000 };
    const { bounds } = layoutData;
    const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.05;
    return {
      x: bounds.minX - padding,
      y: bounds.minY - padding,
      w: (bounds.maxX - bounds.minX) + padding * 2,
      h: (bounds.maxY - bounds.minY) + padding * 2,
    };
  }, [layoutData]);

  // Group color map - stable color per group
  const groupColorMap = useMemo(() => {
    const map = new Map<number, string>();
    (cabinetGroupsQuery.data || []).forEach((g: any, i: number) => {
      map.set(g.id, GROUP_COLORS[i % GROUP_COLORS.length]);
    });
    return map;
  }, [cabinetGroupsQuery.data]);

  // Cabinet groups map
  const cabinetGroupsMap = useMemo(() => {
    const map = new Map<number, any>();
    (cabinetGroupsQuery.data || []).forEach((g: any) => map.set(g.id, g));
    return map;
  }, [cabinetGroupsQuery.data]);

  // Filtered cabinet groups for bind dialog
  const filteredCabinetGroups = useMemo(() => {
    const groups = cabinetGroupsQuery.data || [];
    return groups.filter((g: any) => {
      if (!searchQuery) return true;
      return g.name.toLowerCase().includes(searchQuery.toLowerCase()) || g.id.toString().includes(searchQuery);
    });
  }, [cabinetGroupsQuery.data, searchQuery]);

  // Binding summary
  const bindingSummary = useMemo(() => {
    if (!layoutData) return new Map<number, number>();
    const map = new Map<number, number>();
    for (const cab of layoutData.cabinets) {
      if (cab.cabinetGroupId !== null) {
        map.set(cab.cabinetGroupId, (map.get(cab.cabinetGroupId) || 0) + 1);
      }
    }
    return map;
  }, [layoutData]);

  // Selected cabinets' group info
  const selectedGroupId = useMemo(() => {
    if (!layoutData || selectedCabinetIds.size === 0) return undefined;
    const groups = new Set<number | null>();
    for (const cab of layoutData.cabinets) {
      if (selectedCabinetIds.has(cab.id)) groups.add(cab.cabinetGroupId);
    }
    if (groups.size === 1) return Array.from(groups)[0];
    return undefined;
  }, [layoutData, selectedCabinetIds]);

  // ===== Handlers =====
  const handleDxfUpload = useCallback(async (file: File) => {
    setIsUploading(true);
    try {
      const buffer = await file.arrayBuffer();
      const base64 = btoa(
        new Uint8Array(buffer).reduce((data, byte) => data + String.fromCharCode(byte), "")
      );
      const result = await parseDxf.mutateAsync({ fileBase64: base64, fileName: file.name });
      if (result.success) {
        setLayoutData(result.data as DxfLayoutData);
        setSelectedCabinetIds(new Set());
        toast.success(`DXF导入成功: ${result.stats.cabinets} 个柜列`);
      }
    } catch (e: any) {
      toast.error(e.message || "DXF导入失败");
    } finally {
      setIsUploading(false);
    }
  }, [parseDxf]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleDxfUpload(file);
      e.target.value = "";
    }
  }, [handleDxfUpload]);

  const handleCabinetClick = useCallback((id: number, multi: boolean) => {
    setSelectedCabinetIds(prev => {
      const next = new Set(multi ? prev : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectionRect = useCallback((rect: { x1: number; y1: number; x2: number; y2: number }) => {
    if (!layoutData) return;
    const rotation = layoutData.rotation || 0;
    const selected = new Set<number>();

    if (rotation === 0) {
      // 无旋转时直接比较
      for (const cab of layoutData.cabinets) {
        if (cab.centerX >= rect.x1 && cab.centerX <= rect.x2 &&
            cab.centerY >= rect.y1 && cab.centerY <= rect.y2) {
          selected.add(cab.id);
        }
      }
    } else {
      // 有旋转时，需要将柜组的原始坐标旋转后再与框选矩形比较
      // 旋转中心是viewBox的中心点
      const { bounds } = layoutData;
      const padding = Math.max(bounds.maxX - bounds.minX, bounds.maxY - bounds.minY) * 0.05;
      const cx = bounds.minX - padding + ((bounds.maxX - bounds.minX) + padding * 2) / 2;
      const cy = bounds.minY - padding + ((bounds.maxY - bounds.minY) + padding * 2) / 2;
      const rad = rotation * Math.PI / 180;
      const cosA = Math.cos(rad);
      const sinA = Math.sin(rad);

      for (const cab of layoutData.cabinets) {
        // 将柜组中心点绕viewBox中心旋转（与SVG transform一致）
        const dx = cab.centerX - cx;
        const dy = cab.centerY - cy;
        const rotX = cx + dx * cosA - dy * sinA;
        const rotY = cy + dx * sinA + dy * cosA;

        if (rotX >= rect.x1 && rotX <= rect.x2 &&
            rotY >= rect.y1 && rotY <= rect.y2) {
          selected.add(cab.id);
        }
      }
    }
    setSelectedCabinetIds(selected);
  }, [layoutData]);

  const handleBind = useCallback(async (groupId: number) => {
    if (!layoutData || selectedCabinetIds.size === 0) return;
    setLayoutData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cabinets: prev.cabinets.map(c =>
          selectedCabinetIds.has(c.id) ? { ...c, cabinetGroupId: groupId } : c
        ),
      };
    });
    const group = cabinetGroupsMap.get(groupId);
    toast.success(`已绑定 ${selectedCabinetIds.size} 个柜列到: ${group?.name || groupId}`);
    setShowBindDialog(false);
    setSelectedCabinetIds(new Set());
  }, [layoutData, selectedCabinetIds, cabinetGroupsMap]);

  const handleUnbind = useCallback(() => {
    if (!layoutData || selectedCabinetIds.size === 0) return;
    setLayoutData(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        cabinets: prev.cabinets.map(c =>
          selectedCabinetIds.has(c.id) ? { ...c, cabinetGroupId: null } : c
        ),
      };
    });
    toast.success(`已解绑 ${selectedCabinetIds.size} 个柜列`);
    setSelectedCabinetIds(new Set());
  }, [layoutData, selectedCabinetIds]);

  const handleSave = useCallback(async () => {
    if (!layoutData) { toast.error("请先导入DXF布局"); return; }
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
      const data = JSON.parse(layout.layoutData);
      if (data.bounds && data.cabinets) {
        setLayoutData(data as DxfLayoutData);
      } else {
        toast.error("该布局不是DXF格式，请重新导入DXF文件");
        return;
      }
      setCurrentLayoutId(layout.id);
      setLayoutName(layout.name);
      setLayoutDesc(layout.description || "");
      setSelectedCabinetIds(new Set());
      setShowLoadDialog(false);
      toast.success(`已加载布局: ${layout.name}`);
    } catch {
      toast.error("布局数据解析失败");
    }
  }, []);

  const handleDeleteLayout = useCallback(async (layoutId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteLayoutMut.mutateAsync({ id: layoutId });
      if (currentLayoutId === layoutId) {
        setLayoutData(null);
        setCurrentLayoutId(null);
        setLayoutName("新布局");
        setLayoutDesc("");
      }
      toast.success("布局已删除");
    } catch (err: any) {
      toast.error(err.message || "删除失败");
    }
  }, [deleteLayoutMut, currentLayoutId]);

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
    setLayoutData(null);
    setCurrentLayoutId(null);
    setLayoutName("新布局");
    setLayoutDesc("");
    setSelectedCabinetIds(new Set());
    // 写入“已清空”标记，防止切换页面回来后加载激活布局
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify({ _cleared: true }));
    } catch { /* ignore */ }
  }, []);

  const selectAll = useCallback(() => {
    if (!layoutData) return;
    setSelectedCabinetIds(new Set(layoutData.cabinets.map(c => c.id)));
  }, [layoutData]);

  const selectUnbound = useCallback(() => {
    if (!layoutData) return;
    setSelectedCabinetIds(new Set(layoutData.cabinets.filter(c => c.cabinetGroupId === null).map(c => c.id)));
  }, [layoutData]);

  const selectByGroup = useCallback((groupId: number) => {
    if (!layoutData) return;
    setSelectedCabinetIds(new Set(layoutData.cabinets.filter(c => c.cabinetGroupId === groupId).map(c => c.id)));
  }, [layoutData]);

  // Helper: parse layout data to get stats for load dialog
  const getLayoutStats = useCallback((layoutDataStr: string) => {
    try {
      const data = JSON.parse(layoutDataStr);
      if (data.bounds && data.cabinets) {
        const totalCabs = data.cabinets.length;
        const boundGroups = new Set(data.cabinets.filter((c: any) => c.cabinetGroupId !== null).map((c: any) => c.cabinetGroupId));
        const boundCabs = data.cabinets.filter((c: any) => c.cabinetGroupId !== null).length;
        return { totalCabs, boundGroups: boundGroups.size, boundCabs, isDxf: true };
      }
      return { totalCabs: 0, boundGroups: 0, boundCabs: 0, isDxf: false };
    } catch {
      return { totalCabs: 0, boundGroups: 0, boundCabs: 0, isDxf: false };
    }
  }, []);

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
                <DialogContent className="bg-slate-900 border-slate-700 max-w-lg">
                  <DialogHeader><DialogTitle>加载已保存的布局</DialogTitle></DialogHeader>
                  <ScrollArea className="max-h-96">
                    <div className="space-y-2">
                      {(layoutsQuery.data || []).map((layout: any) => {
                        const stats = getLayoutStats(layout.layoutData);
                        return (
                          <div
                            key={layout.id}
                            className="p-3 rounded-lg border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-colors group"
                            onClick={() => handleLoad(layout)}
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">{layout.name}</span>
                                {layout.isActive === 1 && (
                                  <Badge variant="outline" className="text-cyan-400 border-cyan-500/50 text-[10px]">激活中</Badge>
                                )}
                              </div>
                              {canEdit && (
                                <Button
                                  size="sm" variant="ghost"
                                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 text-red-400 hover:text-red-300 hover:bg-red-500/10"
                                  onClick={(e) => handleDeleteLayout(layout.id, e)}
                                >
                                  <Trash2 className="h-3 w-3" />
                                </Button>
                              )}
                            </div>
                            {layout.description && (
                              <div className="text-[11px] text-slate-400 mt-1">{layout.description}</div>
                            )}
                            <div className="flex items-center gap-3 mt-1.5 text-[10px] text-slate-500">
                              {stats.isDxf ? (
                                <>
                                  <span>{stats.totalCabs} 个柜列</span>
                                  <span>{stats.boundCabs} 已绑定</span>
                                  <span>{stats.boundGroups} 个柜组</span>
                                </>
                              ) : (
                                <span className="text-amber-500">非DXF格式</span>
                              )}
                              <span className="ml-auto">{new Date(layout.updatedAt).toLocaleString()}</span>
                            </div>
                          </div>
                        );
                      })}
                      {(!layoutsQuery.data || layoutsQuery.data.length === 0) && (
                        <div className="text-center text-slate-400 py-8 text-sm">
                          <FolderOpen className="h-8 w-8 mx-auto mb-2 text-slate-600" />
                          暂无已保存的布局
                        </div>
                      )}
                    </div>
                  </ScrollArea>
                </DialogContent>
              </Dialog>
            </div>
            {canEdit && (
              <>
                <div className="flex gap-1.5">
                  <Button size="sm" className="flex-1 h-7 text-xs bg-cyan-600 hover:bg-cyan-700" onClick={handleSave} disabled={isSaving || !layoutData}>
                    {isSaving ? <Loader2 className="h-3 w-3 mr-1 animate-spin" /> : <Save className="h-3 w-3 mr-1" />}保存
                  </Button>
                  <Button size="sm" variant="outline" className="flex-1 h-7 text-xs" onClick={handleActivate} disabled={!currentLayoutId}>
                    <Eye className="h-3 w-3 mr-1" />激活
                  </Button>
                </div>
                <Separator className="bg-slate-700/50" />
                {/* Rotation control */}
                {layoutData && (
                  <div className="flex items-center gap-2">
                    <RotateCw className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    <span className="text-[10px] text-slate-400 shrink-0">旋转</span>
                    <div className="flex items-center flex-1">
                      <Input
                        type="number"
                        min={0}
                        max={360}
                        step={1}
                        value={layoutData.rotation || 0}
                        onChange={e => {
                          let val = parseInt(e.target.value) || 0;
                          val = ((val % 360) + 360) % 360;
                          setLayoutData(prev => prev ? { ...prev, rotation: val } : prev);
                        }}
                        className="h-7 text-xs bg-slate-800 border-slate-600 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                      />
                      <div className="flex flex-col ml-1">
                        <button
                          className="h-3.5 w-5 flex items-center justify-center rounded-t border border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300"
                          onClick={() => setLayoutData(prev => {
                            if (!prev) return prev;
                            const cur = prev.rotation || 0;
                            return { ...prev, rotation: (cur + 1) % 360 };
                          })}
                        >
                          <ChevronUp className="h-2.5 w-2.5" />
                        </button>
                        <button
                          className="h-3.5 w-5 flex items-center justify-center rounded-b border border-t-0 border-slate-600 bg-slate-800 hover:bg-slate-700 text-slate-300"
                          onClick={() => setLayoutData(prev => {
                            if (!prev) return prev;
                            const cur = prev.rotation || 0;
                            return { ...prev, rotation: ((cur - 1) % 360 + 360) % 360 };
                          })}
                        >
                          <ChevronDown className="h-2.5 w-2.5" />
                        </button>
                      </div>
                    </div>
                    <span className="text-[10px] text-slate-500">°</span>
                  </div>
                )}
                <Separator className="bg-slate-700/50" />
                <input ref={fileInputRef} type="file" accept=".dxf" className="hidden" onChange={handleFileChange} />
                <Button
                  size="sm" variant="outline"
                  className="w-full h-8 text-xs border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isUploading}
                >
                  {isUploading ? <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> : <Upload className="h-3.5 w-3.5 mr-1.5" />}
                  导入DXF文件
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Selection & Binding */}
        <Card className="bg-slate-900/80 border-slate-700/50 flex-1 overflow-hidden">
          <CardHeader className="py-3 px-4">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4 text-cyan-400" />
              选择与绑定
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-3">
            <ScrollArea className="h-[calc(100vh-30rem)]">
              <div className="space-y-2">
                {/* Quick select */}
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">快速选择</p>
                <div className="flex gap-1.5 flex-wrap">
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={selectAll} disabled={!layoutData}>全选</Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={selectUnbound} disabled={!layoutData}>选未绑定</Button>
                  <Button size="sm" variant="outline" className="h-6 text-[10px] px-2" onClick={() => setSelectedCabinetIds(new Set())} disabled={selectedCabinetIds.size === 0}>清除选择</Button>
                </div>

                {/* Selected info */}
                {selectedCabinetIds.size > 0 && (
                  <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/30">
                    <div className="text-xs text-cyan-400 font-medium">已选择 {selectedCabinetIds.size} 个柜列</div>
                    {selectedGroupId !== undefined && selectedGroupId !== null && (
                      <div className="text-[10px] text-slate-400 mt-0.5">
                        当前绑定: {cabinetGroupsMap.get(selectedGroupId)?.name || "未知"}
                      </div>
                    )}
                    {canEdit && (
                      <div className="flex gap-1.5 mt-2">
                        <Dialog open={showBindDialog} onOpenChange={setShowBindDialog}>
                          <DialogTrigger asChild>
                            <Button size="sm" className="flex-1 h-6 text-[10px] bg-cyan-600 hover:bg-cyan-700">
                              <Link2 className="h-3 w-3 mr-1" />绑定柜组
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="bg-slate-900 border-slate-700 max-w-md">
                            <DialogHeader><DialogTitle>选择柜组资产 (绑定 {selectedCabinetIds.size} 个柜列)</DialogTitle></DialogHeader>
                            <div className="relative">
                              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
                              <Input placeholder="搜索名称或ID..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="pl-9 bg-slate-800 border-slate-600" />
                            </div>
                            <ScrollArea className="max-h-64">
                              <div className="space-y-1.5">
                                {filteredCabinetGroups.map((g: any) => (
                                  <button key={g.id} className="w-full text-left p-2.5 rounded-lg border border-slate-700 hover:border-cyan-500/50 cursor-pointer transition-all" onClick={() => handleBind(g.id)}>
                                    <div className="flex items-center justify-between">
                                      <div className="flex items-center gap-2">
                                        <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: groupColorMap.get(g.id) || getGroupColor(g.id) }} />
                                        <span className="text-xs font-medium">{g.name}</span>
                                      </div>
                                      <Badge variant="outline" className={`text-[10px] ${g.status === "normal" ? "text-green-400 border-green-500/30" : g.status === "warning" ? "text-yellow-400 border-yellow-500/30" : "text-red-400 border-red-500/30"}`}>
                                        {g.status === "normal" ? "正常" : g.status === "warning" ? "警告" : "报警"}
                                      </Badge>
                                    </div>
                                    <div className="text-[10px] text-slate-400 mt-0.5">
                                      区域: {g.area} | 已绑定: {bindingSummary.get(g.id) || 0} 个柜列
                                    </div>
                                  </button>
                                ))}
                              </div>
                            </ScrollArea>
                          </DialogContent>
                        </Dialog>
                        <Button size="sm" variant="outline" className="h-6 text-[10px] text-red-400 border-red-500/30 hover:bg-red-500/10" onClick={handleUnbind}>
                          <Unlink className="h-3 w-3 mr-1" />解绑
                        </Button>
                      </div>
                    )}
                  </div>
                )}

                <Separator className="bg-slate-700/50 my-2" />

                {/* Binding summary by group */}
                <p className="text-[10px] text-slate-500 uppercase tracking-wider">绑定概览</p>
                {layoutData && bindingSummary.size > 0 ? (
                  Array.from(bindingSummary.entries()).map(([groupId, count]) => {
                    const group = cabinetGroupsMap.get(groupId);
                    const color = groupColorMap.get(groupId) || getGroupColor(groupId);
                    return (
                      <button
                        key={groupId}
                        className="w-full text-left p-2 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all"
                        onClick={() => selectByGroup(groupId)}
                      >
                        <div className="flex items-center gap-2">
                          <div className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: color }} />
                          <span className="text-xs font-medium truncate">{group?.name || `柜组 ${groupId}`}</span>
                          <Badge variant="outline" className="text-[10px] ml-auto shrink-0">{count} 柜列</Badge>
                        </div>
                      </button>
                    );
                  })
                ) : (
                  <div className="text-center text-slate-500 py-2 text-xs">
                    {layoutData ? "暂无绑定关系" : "请先导入DXF布局"}
                  </div>
                )}

                {layoutData && layoutData.cabinets.filter(c => c.cabinetGroupId === null).length > 0 && (
                  <button
                    className="w-full text-left p-2 rounded-lg border border-slate-700/50 hover:border-slate-600 transition-all"
                    onClick={selectUnbound}
                  >
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-sm shrink-0 bg-slate-600" />
                      <span className="text-xs font-medium text-slate-400">未绑定</span>
                      <Badge variant="outline" className="text-[10px] ml-auto shrink-0 text-slate-500">
                        {layoutData.cabinets.filter(c => c.cabinetGroupId === null).length} 柜列
                      </Badge>
                    </div>
                  </button>
                )}
              </div>
            </ScrollArea>
          </CardContent>
        </Card>
      </div>

      {/* Center - SVG Canvas */}
      <div className="flex-1 flex flex-col gap-3 min-w-0">
        <div className="flex-1 rounded-xl overflow-hidden border border-slate-700/50 bg-[#020617]">
          {layoutData ? (
            <LayoutSVG
              layoutData={layoutData}
              selectedCabinetIds={selectedCabinetIds}
              onCabinetClick={handleCabinetClick}
              onSelectionRect={handleSelectionRect}
              viewBox={viewBox}
              groupColorMap={groupColorMap}
              cabinetGroupsMap={cabinetGroupsMap}
              rotation={layoutData.rotation || 0}
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center text-center">
              <div className="w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center mb-4">
                <Upload className="h-7 w-7 text-slate-500" />
              </div>
              <p className="text-sm text-slate-400">导入DXF文件以开始编辑布局</p>
              <p className="text-xs text-slate-500 mt-1">支持AutoCAD DXF格式，自动识别柜列位置</p>
              <p className="text-xs text-slate-500 mt-4">请使用左侧面板的"导入DXF文件"按钮，或"加载"已保存的布局</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
