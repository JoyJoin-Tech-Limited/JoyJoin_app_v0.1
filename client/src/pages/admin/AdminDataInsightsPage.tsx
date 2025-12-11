import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { 
  TrendingUp, 
  TrendingDown, 
  Minus,
  Users, 
  DollarSign, 
  Target, 
  Clock,
  Star,
  AlertTriangle,
  CheckCircle
} from "lucide-react";
import {
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";

interface InsightsData {
  engagementMetrics: {
    totalUsers: number;
    activeUsers: number;
    totalEvents: number;
    avgEventsPerUser: number;
    newUsers7Days: number;
    newUsersPrevious7Days: number;
  };
  userGrowth: { date: string; count: number }[];
  eventTrends: { date: string; count: number }[];
  personalityDistribution: { archetype: string; count: number }[];
  matchingEfficiency: {
    successRate: number;
    avgMatchTime: number;
    attemptsPerUser: number;
  };
  retention: {
    weeklyRetention: { week: number; retentionRate: number }[];
    userSegments: {
      new: number;
      active: number;
      dormant: number;
      churned: number;
    };
    superUsers: {
      count: number;
      topArchetypes: { archetype: string; count: number }[];
    };
  };
  eventQuality: {
    completionRate: number;
    avgRating: number;
    complaintRate: number;
    lowRatedEvents: { event_id: string; title: string; avg_rating: number; date: string }[];
  };
  monetization: {
    conversionRate: number;
    revenueBreakdown: {
      subscription: number;
      singleEvent: number;
    };
    arpu: number;
    conversionFunnel: {
      registered: number;
      browsedEvents: number;
      signedUp: number;
      paid: number;
    };
    monthlyRevenue: number;
  };
}

const COLORS = {
  new: "hsl(145, 60%, 45%)",
  active: "hsl(200, 80%, 50%)",
  dormant: "hsl(35, 85%, 60%)",
  churned: "hsl(0, 70%, 60%)",
};

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

function StarRating({ rating }: { rating: number }) {
  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  return (
    <div className="flex items-center gap-1">
      {[...Array(5)].map((_, i) => (
        <Star
          key={i}
          className={`h-4 w-4 ${
            i < fullStars
              ? "fill-yellow-400 text-yellow-400"
              : i === fullStars && hasHalfStar
              ? "fill-yellow-200 text-yellow-400"
              : "text-muted-foreground"
          }`}
        />
      ))}
      <span className="ml-1 text-sm font-medium">{rating.toFixed(1)}</span>
    </div>
  );
}

export default function AdminDataInsightsPage() {
  const { data: insights, isLoading, error } = useQuery<InsightsData>({
    queryKey: ["/api/admin/insights"],
  });

  if (error) {
    return (
      <div className="p-8">
        <div className="text-center py-12">
          <AlertTriangle className="h-12 w-12 text-destructive mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">加载失败</h3>
          <p className="text-muted-foreground">无法加载数据洞察，请稍后重试</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div>
        <h1 className="text-3xl font-bold" data-testid="heading-insights">运营决策指挥中心</h1>
        <p className="text-muted-foreground mt-1">实时监控平台核心运营指标</p>
      </div>

      {/* Top KPI Cards */}
      <div className="grid gap-6 md:grid-cols-3">
        {/* 1. User Scale Card */}
        <Card data-testid="card-kpi-user-scale">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">用户规模</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mb-4" />
            ) : (
              <>
                <div className="text-2xl font-bold mb-1" data-testid="text-total-users">
                  {insights?.engagementMetrics.totalUsers.toLocaleString() || 0}
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">新增用户（7天）</span>
                    <span className="font-medium" data-testid="text-new-users-7d">
                      +{insights?.engagementMetrics.newUsers7Days || 0}
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">活跃用户（30天）</span>
                    <span className="font-medium" data-testid="text-active-users-30d">
                      {insights?.engagementMetrics.activeUsers || 0}
                    </span>
                  </div>
                  {insights && (
                    <div className="pt-1">
                      <TrendIndicator
                        current={insights.engagementMetrics.newUsers7Days}
                        previous={insights.engagementMetrics.newUsersPrevious7Days}
                      />
                    </div>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 2. Business Health Card */}
        <Card data-testid="card-kpi-business-health">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">商业健康</CardTitle>
            <DollarSign className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mb-4" />
            ) : (
              <>
                <div className="text-2xl font-bold mb-1" data-testid="text-monthly-revenue">
                  ¥{(insights?.monetization.monthlyRevenue || 0).toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground mb-3">本月收入</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">付费转化率</span>
                    <span className="font-medium" data-testid="text-conversion-rate">
                      {insights?.monetization.conversionRate.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">ARPU</span>
                    <span className="font-medium" data-testid="text-arpu">
                      ¥{(insights?.monetization.arpu || 0).toFixed(0)}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* 3. Matching Efficiency Card */}
        <Card data-testid="card-kpi-matching-efficiency">
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">匹配效率</CardTitle>
            <Target className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-24 mb-4" />
            ) : (
              <>
                <div className="text-2xl font-bold mb-1" data-testid="text-match-success-rate">
                  {insights?.matchingEfficiency.successRate.toFixed(1) || 0}%
                </div>
                <p className="text-xs text-muted-foreground mb-3">匹配成功率</p>
                <div className="space-y-2 text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">平均匹配耗时</span>
                    <span className="font-medium flex items-center gap-1" data-testid="text-avg-match-time">
                      <Clock className="h-3 w-3" />
                      {insights?.matchingEfficiency.avgMatchTime.toFixed(1) || 0}h
                    </span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">人均报名次数</span>
                    <span className="font-medium" data-testid="text-attempts-per-user">
                      {insights?.matchingEfficiency.attemptsPerUser.toFixed(1) || 0}
                    </span>
                  </div>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Middle Analysis Cards */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* User Segmentation Pie Chart */}
        <Card data-testid="card-user-segmentation">
          <CardHeader>
            <CardTitle>用户分层</CardTitle>
            <CardDescription>按活跃度划分的用户群体</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : insights?.retention.userSegments ? (
              <div className="space-y-4">
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: "新用户", value: insights.retention.userSegments.new, color: COLORS.new },
                        { name: "活跃", value: insights.retention.userSegments.active, color: COLORS.active },
                        { name: "沉默", value: insights.retention.userSegments.dormant, color: COLORS.dormant },
                        { name: "流失", value: insights.retention.userSegments.churned, color: COLORS.churned },
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                      outerRadius={80}
                      fill="#8884d8"
                      dataKey="value"
                    >
                      {[
                        COLORS.new,
                        COLORS.active,
                        COLORS.dormant,
                        COLORS.churned,
                      ].map((color, index) => (
                        <Cell key={`cell-${index}`} fill={color} />
                      ))}
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2" data-testid="segment-new">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.new }} />
                    <span>新用户: {insights.retention.userSegments.new}</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="segment-active">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.active }} />
                    <span>活跃: {insights.retention.userSegments.active}</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="segment-dormant">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.dormant }} />
                    <span>沉默: {insights.retention.userSegments.dormant}</span>
                  </div>
                  <div className="flex items-center gap-2" data-testid="segment-churned">
                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS.churned }} />
                    <span>流失: {insights.retention.userSegments.churned}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* Event Quality Dashboard */}
        <Card data-testid="card-event-quality">
          <CardHeader>
            <CardTitle>活动质量仪表盘</CardTitle>
            <CardDescription>评估活动完成度与用户满意度</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : (
              <div className="space-y-6">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">活动完成率</span>
                    <span className="text-lg font-bold" data-testid="text-completion-rate">
                      {insights?.eventQuality.completionRate.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-green-500 transition-all"
                      style={{ width: `${insights?.eventQuality.completionRate || 0}%` }}
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">平均评分</span>
                    <div data-testid="rating-average">
                      <StarRating rating={insights?.eventQuality.avgRating || 0} />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">投诉率</span>
                    <span
                      className={`text-lg font-bold ${
                        (insights?.eventQuality.complaintRate || 0) > 5 ? "text-red-600" : "text-green-600"
                      }`}
                      data-testid="text-complaint-rate"
                    >
                      {insights?.eventQuality.complaintRate.toFixed(1) || 0}%
                    </span>
                  </div>
                  <div className="h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={`h-full transition-all ${
                        (insights?.eventQuality.complaintRate || 0) > 5 ? "bg-red-500" : "bg-green-500"
                      }`}
                      style={{ width: `${Math.min(insights?.eventQuality.complaintRate || 0, 100)}%` }}
                    />
                  </div>
                </div>

                {insights && insights.retention.superUsers.count > 0 && (
                  <div className="pt-4 border-t">
                    <div className="flex items-center gap-2 mb-2">
                      <CheckCircle className="h-4 w-4 text-green-600" />
                      <span className="text-sm font-medium">超级用户: {insights.retention.superUsers.count}</span>
                    </div>
                    {insights.retention.superUsers.topArchetypes.length > 0 && (
                      <div className="text-xs text-muted-foreground">
                        主要角色: {insights.retention.superUsers.topArchetypes.map(a => a.archetype).join(", ")}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Bottom Deep Analysis */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* User Retention Curve */}
        <Card className="md:col-span-2" data-testid="card-retention-curve">
          <CardHeader>
            <CardTitle>用户留存曲线</CardTitle>
            <CardDescription>按周统计的用户留存率</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : insights?.retention.weeklyRetention ? (
              <ResponsiveContainer width="100%" height={300}>
                <LineChart data={insights.retention.weeklyRetention}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis
                    dataKey="week"
                    label={{ value: "周", position: "insideBottom", offset: -5 }}
                  />
                  <YAxis
                    label={{ value: "留存率 (%)", angle: -90, position: "insideLeft" }}
                  />
                  <Tooltip
                    formatter={(value: number) => `${value.toFixed(1)}%`}
                    labelFormatter={(label) => `第${label}周`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="retentionRate"
                    stroke="hsl(200, 80%, 50%)"
                    strokeWidth={2}
                    name="留存率"
                    dot={{ r: 4 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>

        {/* Conversion Funnel */}
        <Card data-testid="card-conversion-funnel">
          <CardHeader>
            <CardTitle>收入转化漏斗</CardTitle>
            <CardDescription>用户从注册到付费的转化路径</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-64 w-full" />
            ) : insights?.monetization.conversionFunnel ? (
              <div className="space-y-3">
                {[
                  { label: "注册", value: insights.monetization.conversionFunnel.registered, color: "bg-blue-500" },
                  { label: "浏览活动", value: insights.monetization.conversionFunnel.browsedEvents, color: "bg-cyan-500" },
                  { label: "报名活动", value: insights.monetization.conversionFunnel.signedUp, color: "bg-green-500" },
                  { label: "付费", value: insights.monetization.conversionFunnel.paid, color: "bg-purple-500" },
                ].map((stage, idx) => {
                  const percentage =
                    insights.monetization.conversionFunnel.registered > 0
                      ? (stage.value / insights.monetization.conversionFunnel.registered) * 100
                      : 0;
                  return (
                    <div key={idx} className="space-y-1" data-testid={`funnel-stage-${idx}`}>
                      <div className="flex items-center justify-between text-sm">
                        <span className="font-medium">{stage.label}</span>
                        <span className="text-muted-foreground">
                          {stage.value} ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                      <div className="h-8 bg-muted rounded overflow-hidden">
                        <div
                          className={`h-full ${stage.color} transition-all flex items-center justify-center text-white text-xs font-medium`}
                          style={{ width: `${percentage}%` }}
                        >
                          {percentage > 20 && `${percentage.toFixed(0)}%`}
                        </div>
                      </div>
                    </div>
                  );
                })}
                <div className="pt-3 border-t text-sm">
                  <div className="flex items-center justify-between">
                    <span className="text-muted-foreground">订阅收入</span>
                    <span className="font-medium">
                      ¥{insights.monetization.revenueBreakdown.subscription.toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center justify-between mt-1">
                    <span className="text-muted-foreground">单次活动收入</span>
                    <span className="font-medium">
                      ¥{insights.monetization.revenueBreakdown.singleEvent.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 text-muted-foreground">暂无数据</div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Personality Distribution Bar Chart */}
      <Card data-testid="card-personality-distribution">
        <CardHeader>
          <CardTitle>社交角色分布</CardTitle>
          <CardDescription>各社交角色在用户中的分布情况</CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <Skeleton className="h-64 w-full" />
          ) : insights?.personalityDistribution && insights.personalityDistribution.length > 0 ? (
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={insights.personalityDistribution}
                layout="horizontal"
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="archetype" type="category" width={80} />
                <Tooltip />
                <Legend />
                <Bar dataKey="count" fill="hsl(280, 45%, 55%)" name="用户数" />
              </BarChart>
            </ResponsiveContainer>
          ) : (
            <div className="text-center py-8 text-muted-foreground">暂无数据</div>
          )}
        </CardContent>
      </Card>

      {/* Low Rated Events Alert (if any) */}
      {insights?.eventQuality.lowRatedEvents && insights.eventQuality.lowRatedEvents.length > 0 && (
        <Card className="border-yellow-200 bg-yellow-50" data-testid="card-low-rated-events">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-yellow-600" />
              低评分活动预警
            </CardTitle>
            <CardDescription>以下活动评分低于3.0，需要关注</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {insights.eventQuality.lowRatedEvents.map((event, idx) => (
                <div
                  key={event.event_id}
                  className="flex items-center justify-between p-3 bg-white rounded-md"
                  data-testid={`low-rated-event-${idx}`}
                >
                  <div>
                    <div className="font-medium">{event.title}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(event.date).toLocaleDateString("zh-CN")}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <StarRating rating={event.avg_rating} />
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
