import { useState, useMemo } from "react";
import { trpc } from "@/lib/trpc";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2, TrendingUp, TrendingDown, Activity, AlertTriangle } from "lucide-react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import { format, subDays } from "date-fns";

const COLORS = {
  primary: "hsl(var(--primary))",
  success: "hsl(var(--success))",
  warning: "hsl(var(--warning))",
  destructive: "hsl(var(--destructive))",
  chart1: "hsl(var(--chart-1))",
  chart2: "hsl(var(--chart-2))",
  chart3: "hsl(var(--chart-3))",
  chart4: "hsl(var(--chart-4))",
  chart5: "hsl(var(--chart-5))",
};

export default function Analytics() {
  const [selectedCabinetId, setSelectedCabinetId] = useState<number | undefined>(undefined);
  const [timeRange, setTimeRange] = useState<number>(7); // 默认7天

  const { data: cabinets } = trpc.cabinetGroups.list.useQuery();
  const { data: records, isLoading } = trpc.weightRecords.list.useQuery({
    cabinetGroupId: selectedCabinetId,
    limit: 1000,
  });
  const { data: alarms } = trpc.alarms.list.useQuery({
    cabinetGroupId: selectedCabinetId,
    limit: 1000,
  });

  // 过滤时间范围内的数据
  const filteredRecords = useMemo(() => {
    if (!records) return [];
    const startDate = subDays(new Date(), timeRange);
    return records.filter(r => new Date(r.recordedAt) >= startDate);
  }, [records, timeRange]);

  // 重量趋势数据
  const weightTrendData = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return [];
    
    const dataMap = new Map<string, { date: string; weight: number; count: number }>();
    
    filteredRecords.forEach(record => {
      const dateKey = format(new Date(record.recordedAt), "MM-dd");
      const existing = dataMap.get(dateKey);
      
      if (existing) {
        existing.weight += record.currentWeight;
        existing.count += 1;
      } else {
        dataMap.set(dateKey, {
          date: dateKey,
          weight: record.currentWeight,
          count: 1,
        });
      }
    });
    
    return Array.from(dataMap.values())
      .map(item => ({
        date: item.date,
        weight: Number((item.weight / item.count / 1000).toFixed(2)),
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  // 重量变化统计
  const weightChangeStats = useMemo(() => {
    if (!filteredRecords) return [];
    
    const increases = filteredRecords.filter(r => r.changeValue > 0).length;
    const decreases = filteredRecords.filter(r => r.changeValue < 0).length;
    const noChange = filteredRecords.filter(r => r.changeValue === 0).length;
    
    return [
      { name: "重量增加", value: increases, color: COLORS.success },
      { name: "重量减少", value: decreases, color: COLORS.destructive },
      { name: "无变化", value: noChange, color: COLORS.chart3 },
    ].filter(item => item.value > 0);
  }, [filteredRecords]);

  // 报警统计
  const alarmStats = useMemo(() => {
    if (!alarms) return [];
    
    const handled = alarms.filter((a: any) => a.isHandled === 1).length;
    const unhandled = alarms.filter((a: any) => a.isHandled === 0).length;
    
    return [
      { name: "已处理", value: handled, color: COLORS.success },
      { name: "待处理", value: unhandled, color: COLORS.destructive },
    ].filter(item => item.value > 0);
  }, [alarms]);

  // 每日变化次数统计
  const dailyChangeStats = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return [];
    
    const dataMap = new Map<string, number>();
    
    filteredRecords.forEach(record => {
      const dateKey = format(new Date(record.recordedAt), "MM-dd");
      dataMap.set(dateKey, (dataMap.get(dateKey) || 0) + 1);
    });
    
    return Array.from(dataMap.entries())
      .map(([date, count]: [string, number]) => ({ date, count }))
      .sort((a: any, b: any) => a.date.localeCompare(b.date));
  }, [filteredRecords]);

  const getCabinetName = (cabinetId: number) => {
    return cabinets?.find((c) => c.id === cabinetId)?.name || "未知柜组";
  };

  // 计算统计数据
  const totalChanges = filteredRecords?.length || 0;
  const totalAlarms = alarms?.filter((a: any) => {
    if (!timeRange) return true;
    const startDate = subDays(new Date(), timeRange);
    return new Date(a.createdAt) >= startDate;
  }).length || 0;
  
  const avgChange = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return 0;
    const sum = filteredRecords.reduce((acc, r) => acc + Math.abs(r.changeValue), 0);
    return (sum / filteredRecords.length / 1000).toFixed(2);
  }, [filteredRecords]);

  const maxChange = useMemo(() => {
    if (!filteredRecords || filteredRecords.length === 0) return 0;
    const max = Math.max(...filteredRecords.map(r => Math.abs(r.changeValue)));
    return (max / 1000).toFixed(2);
  }, [filteredRecords]);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">数据分析</h1>
          <p className="text-muted-foreground mt-2">可视化展示重量变化趋势和统计分析</p>
        </div>
        <div className="flex gap-3">
          <Select
            value={timeRange.toString()}
            onValueChange={(value) => setTimeRange(parseInt(value))}
          >
            <SelectTrigger className="w-32">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="1">近1天</SelectItem>
              <SelectItem value="7">近7天</SelectItem>
              <SelectItem value="30">近30天</SelectItem>
              <SelectItem value="90">近90天</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={selectedCabinetId?.toString() || "all"}
            onValueChange={(value) => setSelectedCabinetId(value === "all" ? undefined : parseInt(value))}
          >
            <SelectTrigger className="w-48">
              <SelectValue placeholder="筛选柜组" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">全部柜组</SelectItem>
              {cabinets?.map((cabinet) => (
                <SelectItem key={cabinet.id} value={cabinet.id.toString()}>
                  {cabinet.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* 统计卡片 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <Activity className="h-4 w-4" />
              变化次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-foreground">{totalChanges}</div>
            <p className="text-xs text-muted-foreground mt-1">近{timeRange}天</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              平均变化
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-primary">{avgChange} kg</div>
            <p className="text-xs text-muted-foreground mt-1">绝对值平均</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <TrendingDown className="h-4 w-4" />
              最大变化
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-warning">{maxChange} kg</div>
            <p className="text-xs text-muted-foreground mt-1">单次最大变化</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground flex items-center gap-2">
              <AlertTriangle className="h-4 w-4" />
              报警次数
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive">{totalAlarms}</div>
            <p className="text-xs text-muted-foreground mt-1">近{timeRange}天</p>
          </CardContent>
        </Card>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <>
          {/* 重量趋势图 */}
          <Card>
            <CardHeader>
              <CardTitle>重量趋势分析</CardTitle>
              <CardDescription>展示选定时间范围内的平均重量变化趋势</CardDescription>
            </CardHeader>
            <CardContent>
              {weightTrendData.length > 0 ? (
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={weightTrendData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="date"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={12}
                      label={{ value: "重量 (kg)", angle: -90, position: "insideLeft" }}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                    <Legend />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke={COLORS.primary}
                      strokeWidth={2}
                      name="平均重量"
                      dot={{ fill: COLORS.primary }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-[300px] text-muted-foreground">
                  暂无数据
                </div>
              )}
            </CardContent>
          </Card>

          <div className="grid gap-4 md:grid-cols-2">
            {/* 每日变化次数柱状图 */}
            <Card>
              <CardHeader>
                <CardTitle>每日变化次数</CardTitle>
                <CardDescription>统计每天的重量变化记录数量</CardDescription>
              </CardHeader>
              <CardContent>
                {dailyChangeStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <BarChart data={dailyChangeStats}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                      <XAxis
                        dataKey="date"
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={12}
                      />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                      <Bar dataKey="count" fill={COLORS.chart1} name="变化次数" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 重量变化类型分布 */}
            <Card>
              <CardHeader>
                <CardTitle>重量变化分布</CardTitle>
                <CardDescription>增加、减少和无变化的比例统计</CardDescription>
              </CardHeader>
              <CardContent>
                {weightChangeStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie
                        data={weightChangeStats}
                        cx="50%"
                        cy="50%"
                        labelLine={false}
                        label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                      >
                        {weightChangeStats.map((entry, index) => (
                          <Cell key={`cell-${index}`} fill={entry.color} />
                        ))}
                      </Pie>
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--popover))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                        }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="flex items-center justify-center h-[250px] text-muted-foreground">
                    暂无数据
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* 报警处理状态 */}
          {alarmStats.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle>报警处理状态</CardTitle>
                <CardDescription>已处理和待处理报警的比例</CardDescription>
              </CardHeader>
              <CardContent>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={alarmStats}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {alarmStats.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--popover))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "var(--radius)",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
