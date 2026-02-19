import { useEffect, useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Loader2, AlertTriangle, CheckCircle2, Activity } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CabinetGroup } from "../../../drizzle/schema";

export default function Monitor() {
  const { data: cabinets, isLoading } = trpc.cabinetGroups.list.useQuery(undefined, {
    refetchInterval: 3000, // 每3秒刷新一次
  });
  const [hoveredCabinet, setHoveredCabinet] = useState<number | null>(null);
  const [rotation, setRotation] = useState({ x: 20, y: 0 });
  const containerRef = useRef<HTMLDivElement>(null);

  // 鼠标拖拽旋转3D视图
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    let isDragging = false;
    let startX = 0;
    let startY = 0;
    let currentRotation = { ...rotation };

    const handleMouseDown = (e: MouseEvent) => {
      isDragging = true;
      startX = e.clientX;
      startY = e.clientY;
      currentRotation = { ...rotation };
    };

    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const deltaX = e.clientX - startX;
      const deltaY = e.clientY - startY;
      setRotation({
        x: Math.max(-45, Math.min(45, currentRotation.x - deltaY * 0.3)),
        y: currentRotation.y + deltaX * 0.3,
      });
    };

    const handleMouseUp = () => {
      isDragging = false;
    };

    container.addEventListener("mousedown", handleMouseDown);
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);

    return () => {
      container.removeEventListener("mousedown", handleMouseDown);
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
    };
  }, [rotation]);

  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-8rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "normal":
        return "bg-success/20 border-success";
      case "warning":
        return "bg-warning/20 border-warning";
      case "alarm":
        return "bg-destructive/20 border-destructive";
      default:
        return "bg-muted border-border";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "normal":
        return <CheckCircle2 className="h-4 w-4 text-success" />;
      case "warning":
        return <AlertTriangle className="h-4 w-4 text-warning" />;
      case "alarm":
        return <AlertTriangle className="h-4 w-4 text-destructive" />;
      default:
        return <Activity className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case "normal":
        return "正常";
      case "warning":
        return "警告";
      case "alarm":
        return "报警";
      default:
        return "未知";
    }
  };

  // 计算3D布局位置
  const calculate3DPosition = (cabinet: CabinetGroup) => {
    const baseScale = 0.8;
    const perspective = 1000;
    
    // 应用旋转变换
    const radX = (rotation.x * Math.PI) / 180;
    const radY = (rotation.y * Math.PI) / 180;
    
    const x = cabinet.positionX * baseScale;
    const y = cabinet.positionY * baseScale;
    const z = cabinet.positionZ * baseScale;
    
    // 3D旋转计算
    const rotatedX = x * Math.cos(radY) - z * Math.sin(radY);
    const rotatedZ = x * Math.sin(radY) + z * Math.cos(radY);
    const rotatedY = y * Math.cos(radX) - rotatedZ * Math.sin(radX);
    const finalZ = y * Math.sin(radX) + rotatedZ * Math.cos(radX);
    
    // 透视投影
    const scale = perspective / (perspective + finalZ);
    
    return {
      left: `calc(50% + ${rotatedX * scale}px)`,
      top: `calc(50% + ${rotatedY * scale}px)`,
      transform: `scale(${scale})`,
      zIndex: Math.round(1000 + finalZ),
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">实时监视</h1>
          <p className="text-muted-foreground mt-2">
            拖拽鼠标旋转视图，悬停查看详细信息
          </p>
        </div>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-success" />
            <span className="text-sm text-muted-foreground">正常</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-warning" />
            <span className="text-sm text-muted-foreground">警告</span>
          </div>
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-destructive" />
            <span className="text-sm text-muted-foreground">报警</span>
          </div>
        </div>
      </div>

      {/* 3D可视化区域 */}
      <Card className="overflow-hidden">
        <CardContent className="p-0">
          <div
            ref={containerRef}
            className="relative h-[600px] bg-gradient-to-b from-card to-background cursor-move select-none overflow-hidden"
            style={{
              perspective: "1000px",
            }}
          >
            {/* 网格背景 */}
            <div
              className="absolute inset-0 opacity-10"
              style={{
                backgroundImage: `
                  linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px),
                  linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)
                `,
                backgroundSize: "40px 40px",
                transform: `rotateX(${rotation.x}deg) rotateY(${rotation.y}deg)`,
              }}
            />

            {/* 保险柜组 */}
            {cabinets?.map((cabinet) => {
              const position = calculate3DPosition(cabinet);
              const isHovered = hoveredCabinet === cabinet.id;

              return (
                <div
                  key={cabinet.id}
                  className="absolute transition-all duration-200"
                  style={position}
                  onMouseEnter={() => setHoveredCabinet(cabinet.id)}
                  onMouseLeave={() => setHoveredCabinet(null)}
                >
                  <div
                    className={cn(
                      "relative w-32 h-40 rounded-lg border-2 transition-all duration-200",
                      getStatusColor(cabinet.status),
                      isHovered && "scale-110 shadow-2xl"
                    )}
                  >
                    {/* 柜子外观 */}
                    <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-card/80 to-card/40 backdrop-blur-sm" />
                    
                    {/* 状态指示器 */}
                    <div className="absolute top-2 right-2">
                      {getStatusIcon(cabinet.status)}
                    </div>

                    {/* 柜子信息 */}
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-3 text-center">
                      <div className="text-sm font-semibold text-foreground mb-1">
                        {cabinet.name}
                      </div>
                      <div className="text-2xl font-bold text-primary">
                        {(cabinet.currentWeight / 1000).toFixed(2)}
                      </div>
                      <div className="text-xs text-muted-foreground">kg</div>
                    </div>

                    {/* 悬停详情卡片 */}
                    {isHovered && (
                      <div className="absolute left-full ml-4 top-0 w-64 z-50 pointer-events-none">
                        <Card className="shadow-xl border-2 border-primary/50">
                          <CardHeader className="pb-3">
                            <CardTitle className="text-base flex items-center gap-2">
                              {cabinet.name}
                              <Badge variant={cabinet.status === "alarm" ? "destructive" : "secondary"}>
                                {getStatusText(cabinet.status)}
                              </Badge>
                            </CardTitle>
                            <CardDescription className="text-xs">
                              ID: {cabinet.id}
                            </CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-2 text-sm">
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">当前重量:</span>
                              <span className="font-semibold">{(cabinet.currentWeight / 1000).toFixed(2)} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">初始重量:</span>
                              <span>{(cabinet.initialWeight / 1000).toFixed(2)} kg</span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">变化值:</span>
                              <span className={cn(
                                "font-semibold",
                                cabinet.currentWeight > cabinet.initialWeight ? "text-success" : "text-destructive"
                              )}>
                                {((cabinet.currentWeight - cabinet.initialWeight) / 1000).toFixed(2)} kg
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">报警阈值:</span>
                              <span>{(cabinet.alarmThreshold / 1000).toFixed(2)} kg</span>
                            </div>
                            {cabinet.description && (
                              <div className="pt-2 border-t border-border">
                                <p className="text-xs text-muted-foreground">{cabinet.description}</p>
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}

            {/* 空状态 */}
            {(!cabinets || cabinets.length === 0) && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center">
                  <Activity className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-lg font-medium text-foreground">暂无保险柜组</p>
                  <p className="text-sm text-muted-foreground mt-2">
                    请先在保险柜组管理中添加设备
                  </p>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* 统计信息 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">总数</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{cabinets?.length || 0}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">正常</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-success">
              {cabinets?.filter(c => c.status === "normal").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">警告</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">
              {cabinets?.filter(c => c.status === "warning").length || 0}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">报警</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">
              {cabinets?.filter(c => c.status === "alarm").length || 0}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
