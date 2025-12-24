import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users, 
  Clock,
  Target,
  Brain,
  AlertCircle
} from "lucide-react";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  Cell,
} from "recharts";

interface RegistrationFunnelKPIs {
  totalStarted: number;
  totalCompleted: number;
  conversionRate: number;
  avgCompletionTimeMinutes: number;
  completedLast7Days: number;
  completedPrevious7Days: number;
  avgL3Confidence: number;
}

interface L1FieldDropoff {
  field: string;
  fieldLabel: string;
  started: number;
  completed: number;
  dropoffRate: number;
}

interface L2Engagement {
  field: string;
  fieldLabel: string;
  totalEligible: number;
  filled: number;
  engagementRate: number;
}

interface L3ConfidenceTrend {
  date: string;
  avgConfidence: number;
  sampleSize: number;
}

interface FunnelStage {
  stage: string;
  stageLabel: string;
  count: number;
  percentage: number;
}

interface RegistrationFunnelData {
  kpis: RegistrationFunnelKPIs;
  funnelStages: FunnelStage[];
  l1FieldDropoffs: L1FieldDropoff[];
  l2Engagements: L2Engagement[];
  l3ConfidenceTrend: L3ConfidenceTrend[];
  sessionDurationDistribution: { range: string; count: number }[];
}

const FUNNEL_COLORS = [
  "hsl(200, 80%, 50%)",
  "hsl(180, 70%, 45%)",
  "hsl(160, 65%, 45%)",
  "hsl(140, 60%, 45%)",
  "hsl(120, 55%, 45%)",
];

function TrendIndicator({ current, previous }: { current: number; previous: number }) {
  if (previous === 0) {
    return <span className="text-muted-foreground text-xs flex items-center gap-1"><Minus className="h-3 w-3" /> 无数据</span>;
  }
  
  const percentChange = ((current - previous) / previous) * 100;
  
  if (Math.abs(percentChange) < 1) {
    return (
      <span className="text-muted-foreground text-xs flex items-center gap-1">
        <Minus className="h-3 w-3" /> 持平
      </span>
    );
  }
  
  if (percentChange > 0) {
    return (
      <span className="text-green-600 text-xs flex items-center gap-1">
        <TrendingUp className="h-3 w-3" /> +{percentChange.toFixed(1)}%
      </span>
    );
  }
  
  return (
    <span className="text-red-600 text-xs flex items-center gap-1">
      <TrendingDown className="h-3 w-3" /> {percentChange.toFixed(1)}%
    </span>
  );
}

function DropoffHeatmap({ data }: { data: L1FieldDropoff[] }) {
  const getColor = (dropoffRate: number) => {
    if (dropoffRate > 50) return "bg-red-500";
    if (dropoffRate > 30) return "bg-orange-500";
    if (dropoffRate > 15) return "bg-yellow-500";
    return "bg-green-500";
  };

  return (
    <div className="space-y-2">
      {data.map((item) => (
        <div key={item.field} className="flex items-center gap-3" data-testid={`dropoff-${item.field}`}>
          <div className="w-20 text-sm text-muted-foreground truncate">{item.fieldLabel}</div>
          <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
            <div 
              className={`h-full ${getColor(item.dropoffRate)} transition-all`}
              style={{ width: `${100 - item.dropoffRate}%` }}
            />
            <span className="absolute inset-0 flex items-center justify-center text-xs font-medium">
              {(100 - item.dropoffRate).toFixed(0)}% 完成
            </span>
          </div>
          <div className="w-16 text-right text-sm">
            <span className={item.dropoffRate > 30 ? "text-red-600 font-medium" : "text-muted-foreground"}>
              -{item.dropoffRate.toFixed(1)}%
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function RegistrationFunnelDashboard() {
  const { data: funnelData, isLoading, error } = useQuery<RegistrationFunnelData>({
    queryKey: ["/api/admin/insights/registration-funnel"],
  });

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground">无法加载注册漏斗数据，请稍后重试</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* KPI Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        {/* Conversion Rate */}
        <Card data-testid="card-kpi-conversion">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">注册转化率</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-conversion-rate">
                  {funnelData?.kpis.conversionRate.toFixed(1)}%
                </div>
                <p className="text-xs text-muted-foreground">
                  {funnelData?.kpis.totalCompleted} / {funnelData?.kpis.totalStarted} 用户
                </p>
                {funnelData && (
                  <div className="pt-2">
                    <TrendIndicator
                      current={funnelData.kpis.completedLast7Days}
                      previous={funnelData.kpis.completedPrevious7Days}
                    />
                  </div>
                )}
              </>
            )}
          </CardContent>
        </Card>

        {/* Average Time */}
        <Card data-testid="card-kpi-time">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">平均完成时长</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-avg-time">
                  {funnelData?.kpis.avgCompletionTimeMinutes.toFixed(1)} 分钟
                </div>
                <p className="text-xs text-muted-foreground">中位数时长</p>
              </>
            )}
          </CardContent>
        </Card>

        {/* 7-Day Completions */}
        <Card data-testid="card-kpi-7day">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">近7天完成</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-7day-completions">
                  +{funnelData?.kpis.completedLast7Days}
                </div>
                <div className="pt-2">
                  <TrendIndicator
                    current={funnelData?.kpis.completedLast7Days || 0}
                    previous={funnelData?.kpis.completedPrevious7Days || 0}
                  />
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* L3 Confidence */}
        <Card data-testid="card-kpi-l3">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">L3 推断置信度</CardTitle>
            <Brain className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-20" />
            ) : (
              <>
                <div className="text-2xl font-bold" data-testid="text-l3-confidence">
                  {((funnelData?.kpis.avgL3Confidence || 0) * 100).toFixed(0)}%
                </div>
                <p className="text-xs text-muted-foreground">AI推断准确率</p>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Main Charts Row */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* Registration Funnel */}
        <Card data-testid="card-funnel">
          <CardHeader>
            <CardTitle>注册漏斗</CardTitle>
            <CardDescription>用户从开始到完成注册的转化路径</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : funnelData?.funnelStages ? (
              <div className="space-y-3">
                {funnelData.funnelStages.map((stage, idx) => (
                  <div key={stage.stage} className="space-y-1" data-testid={`funnel-${stage.stage}`}>
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{stage.stageLabel}</span>
                      <span className="text-muted-foreground">
                        {stage.count} ({stage.percentage.toFixed(1)}%)
                      </span>
                    </div>
                    <div className="h-8 bg-muted rounded overflow-hidden">
                      <div
                        className="h-full transition-all flex items-center justify-center text-white text-xs font-medium"
                        style={{ 
                          width: `${stage.percentage}%`,
                          backgroundColor: FUNNEL_COLORS[idx] || FUNNEL_COLORS[4]
                        }}
                      >
                        {stage.percentage > 15 && `${stage.percentage.toFixed(0)}%`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* L1 Field Dropoff Heatmap */}
        <Card data-testid="card-l1-dropoff">
          <CardHeader>
            <CardTitle>L1 字段流失热力图</CardTitle>
            <CardDescription>各必填字段的完成率，红色表示流失严重</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : funnelData?.l1FieldDropoffs ? (
              <DropoffHeatmap data={funnelData.l1FieldDropoffs} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Second Row Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* L2 Engagement Bar Chart */}
        <Card data-testid="card-l2-engagement">
          <CardHeader>
            <CardTitle>L2 可选字段参与度</CardTitle>
            <CardDescription>用户主动填写各可选信息的比例</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : funnelData?.l2Engagements ? (
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={funnelData.l2Engagements}
                  layout="vertical"
                  margin={{ top: 5, right: 30, left: 60, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={[0, 100]} unit="%" />
                  <YAxis dataKey="fieldLabel" type="category" width={60} tick={{ fontSize: 12 }} />
                  <Tooltip 
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    labelFormatter={(label) => `${label}`}
                  />
                  <Bar dataKey="engagementRate" name="参与率">
                    {funnelData.l2Engagements.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.engagementRate > 50 ? "hsl(145, 60%, 45%)" : entry.engagementRate > 25 ? "hsl(45, 80%, 50%)" : "hsl(0, 60%, 50%)"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* L3 Confidence Trend */}
        <Card data-testid="card-l3-trend">
          <CardHeader>
            <CardTitle>L3 推断置信度趋势</CardTitle>
            <CardDescription>近30天AI推断准确率变化</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : funnelData?.l3ConfidenceTrend ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart
                  data={funnelData.l3ConfidenceTrend.slice(-14)} // 只显示最近14天
                  margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tick={{ fontSize: 10 }}
                    tickFormatter={(value) => value.slice(5)} // 只显示 MM-DD
                  />
                  <YAxis 
                    domain={[0, 1]} 
                    tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                  />
                  <Tooltip 
                    formatter={(value: number) => `${(value * 100).toFixed(1)}%`}
                    labelFormatter={(label) => `日期: ${label}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="avgConfidence"
                    stroke="hsl(280, 45%, 55%)"
                    strokeWidth={2}
                    name="置信度"
                    dot={{ r: 3 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Session Duration Distribution */}
      <Card data-testid="card-duration-distribution">
        <CardHeader>
          <CardTitle>会话时长分布</CardTitle>
          <CardDescription>用户完成注册所需时间的分布</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-48 w-full" />
          ) : funnelData?.sessionDurationDistribution ? (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart
                data={funnelData.sessionDurationDistribution}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="range" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="hsl(200, 80%, 50%)" name="用户数" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">暂无数据</div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
