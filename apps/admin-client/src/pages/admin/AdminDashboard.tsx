import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, Calendar, DollarSign, UserPlus, TrendingUp, AlertCircle, RefreshCw, Star, MapPin, UserCog, Trophy, Coins, Flame, Bell, AlertTriangle, Clock, UsersRound, Activity } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";
import { useMemo } from "react";
import type { WeakUser, AdminStats } from "./types";

interface TodayEvent {
  id: string;
  title: string;
  dateTime: string;
  location: string;
  status: string;
  maxAttendees: number;
  registeredCount: number;
  checkedInCount: number;
  noShowCount: number;
}

interface OpsAlerts {
  pendingReports: number;
  underfilledPoolsClosingSoon: number;
  refundsPending: number;
  usersStuckInOnboarding: number;
}

interface OpsDashboard {
  todayEvents: TodayEvent[];
  alerts: OpsAlerts;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading, isError, error, refetch } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    retry: 2,
  });

  const { data: ops, isLoading: opsLoading } = useQuery<OpsDashboard>({
    queryKey: ["/api/admin/ops-dashboard"],
    retry: 2,
  });
  
  // Render star rating display
  const renderStars = (rating: number) => {
    return (
      <div className="flex gap-0.5">
        {[1, 2, 3, 4, 5].map((i) => (
          <Star key={i} className={`h-3 w-3 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
        ))}
      </div>
    );
  };

  const statCards = useMemo(() => [
    {
      title: "用户总数",
      value: stats?.totalUsers?.toString() || "0",
      icon: Users,
      description: "注册用户",
    },
    {
      title: "订阅会员",
      value: stats?.subscribedUsers?.toString() || "0",
      icon: CreditCard,
      description: "活跃会员数",
    },
    {
      title: "本月活动",
      value: stats?.eventsThisMonth?.toString() || "0",
      icon: Calendar,
      description: "已发布活动",
    },
    {
      title: "本月收入",
      value: `¥${stats?.monthlyRevenue || 0}`,
      icon: DollarSign,
      description: "订阅 + 单次付费",
    },
    {
      title: "新增用户",
      value: stats?.newUsersThisWeek?.toString() || "0",
      icon: UserPlus,
      description: "本周新用户",
    },
    {
      title: "用户增长",
      value: `${stats?.userGrowth || 0}%`,
      icon: TrendingUp,
      description: "相比上周",
    },
  ], [stats]);

  const sortedPersonalityDistribution = useMemo(() =>
    stats?.personalityDistribution
      ? Object.entries(stats.personalityDistribution).sort((a, b) => b[1] - a[1]).slice(0, 5)
      : [],
  [stats]);

  const sortedArchetypeDistribution = useMemo(() =>
    stats?.archetypeDistribution
      ? Object.entries(stats.archetypeDistribution).sort((a, b) => b[1] - a[1]).slice(0, 6)
      : [],
  [stats]);

  const sortedCityDistribution = useMemo(() =>
    stats?.cityDistribution
      ? Object.entries(stats.cityDistribution).sort((a, b) => b[1] - a[1]).slice(0, 5)
      : [],
  [stats]);

  const sortedLevelDistribution = useMemo(() =>
    stats?.gamificationStats?.levelDistribution
      ? Object.entries(stats.gamificationStats.levelDistribution).sort((a, b) => {
          const levelA = parseInt(a[0].replace('Lv.', ''));
          const levelB = parseInt(b[0].replace('Lv.', ''));
          return levelB - levelA;
        })
      : [],
  [stats]);

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold">加载失败</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error && error.message.includes("401")
                    ? "您没有访问权限，请确认您拥有管理员权限"
                    : "无法加载数据，请检查网络连接或稍后重试"}
                </p>
              </div>
              <Button
                onClick={() => refetch()}
                variant="default"
                data-testid="button-retry-stats"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                重试
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">数据看板</h2>
        <p className="text-muted-foreground">核心业务指标概览</p>
      </div>

      {/* 今日待办 Alerts */}
      {!opsLoading && ops && (
        <Card className="mb-6" data-testid="card-today-alerts">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Bell className="h-4 w-4" />
              今日待办
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {ops.alerts.pendingReports > 0 && (
                <button
                  onClick={() => setLocation("/admin/moderation")}
                  className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-left hover:bg-red-100 transition-colors"
                  data-testid="alert-pending-reports"
                >
                  <div className="flex items-center gap-1.5 text-red-700">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">举报待审核</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-red-700">{ops.alerts.pendingReports} 条</div>
                </button>
              )}
              {ops.alerts.underfilledPoolsClosingSoon > 0 && (
                <button
                  onClick={() => setLocation("/admin/event-pools")}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left hover:bg-amber-100 transition-colors"
                  data-testid="alert-underfilled-pools"
                >
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">即将截止 · 报名不足</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-700">{ops.alerts.underfilledPoolsClosingSoon} 个</div>
                </button>
              )}
              {ops.alerts.refundsPending > 0 && (
                <button
                  onClick={() => setLocation("/admin/finance")}
                  className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-left hover:bg-amber-100 transition-colors"
                  data-testid="alert-refunds-pending"
                >
                  <div className="flex items-center gap-1.5 text-amber-700">
                    <DollarSign className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">退款待处理</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-amber-700">{ops.alerts.refundsPending} 笔</div>
                </button>
              )}
              {ops.alerts.usersStuckInOnboarding > 0 && (
                <button
                  onClick={() => setLocation("/admin/users")}
                  className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-left hover:bg-blue-100 transition-colors"
                  data-testid="alert-stuck-users"
                >
                  <div className="flex items-center gap-1.5 text-blue-700">
                    <UsersRound className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">用户卡壳在 onboarding</span>
                  </div>
                  <div className="mt-1 text-lg font-bold text-blue-700">{ops.alerts.usersStuckInOnboarding} 人</div>
                </button>
              )}
              {Object.values(ops.alerts).every((v) => v === 0) && (
                <div className="col-span-full rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-center" data-testid="alert-all-clear">
                  <div className="flex items-center justify-center gap-1.5 text-green-700">
                    <Activity className="h-3.5 w-3.5" />
                    <span className="text-xs font-medium">一切正常 — 今日无待处理预警</span>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 今日活动 */}
      {!opsLoading && ops && ops.todayEvents.length > 0 && (
        <Card className="mb-6" data-testid="card-today-events">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Calendar className="h-4 w-4" />
              今日活动 ({ops.todayEvents.length} 场)
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {ops.todayEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center justify-between rounded-lg border p-3"
                  data-testid={`today-event-${event.id}`}
                >
                  <div className="space-y-1">
                    <div className="font-medium">{event.title}</div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <MapPin className="h-3 w-3" />
                        {event.location}
                      </span>
                      <Badge variant={event.status === "ongoing" ? "default" : event.status === "completed" ? "secondary" : "outline"} className="text-[10px]">
                        {event.status === "upcoming" ? "待开始" : event.status === "ongoing" ? "进行中" : "已结束"}
                      </Badge>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <div className="text-center">
                      <div className="font-semibold">{event.registeredCount}</div>
                      <div className="text-xs text-muted-foreground">已报名</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-green-600">{event.checkedInCount}</div>
                      <div className="text-xs text-muted-foreground">已签到</div>
                    </div>
                    <div className="text-center">
                      <div className="font-semibold text-red-600">{event.noShowCount}</div>
                      <div className="text-xs text-muted-foreground">未出席</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* 运营健康记分卡 */}
      {stats && (
        <Card className="mb-6" data-testid="card-ops-scorecard">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              🏥 运营健康记分卡
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
              {/* 用户增长健康度 */}
              {(() => {
                const v = stats.userGrowth ?? 0;
                const color = v > 5 ? "text-green-700 bg-green-50" : v >= 0 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
                const dot = v > 5 ? "🟢" : v >= 0 ? "🟡" : "🔴";
                return (
                  <div className={`rounded-lg px-3 py-2 text-center ${color}`} data-testid="scorecard-user-growth">
                    <div className="text-lg">{dot}</div>
                    <div className="text-xs font-medium mt-0.5">用户增长健康度</div>
                    <div className="text-sm font-bold">{v}%</div>
                  </div>
                );
              })()}
              {/* 匹配满意度 */}
              {(() => {
                const v = stats.weeklyMatchingSatisfaction ?? 0;
                const color = v >= 80 ? "text-green-700 bg-green-50" : v >= 70 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
                const dot = v >= 80 ? "🟢" : v >= 70 ? "🟡" : "🔴";
                return (
                  <div className={`rounded-lg px-3 py-2 text-center ${color}`} data-testid="scorecard-matching-satisfaction">
                    <div className="text-lg">{dot}</div>
                    <div className="text-xs font-medium mt-0.5">匹配满意度</div>
                    <div className="text-sm font-bold">{v}%</div>
                  </div>
                );
              })()}
              {/* 低分匹配数 */}
              {(() => {
                const v = stats.lowScoringMatches ?? 0;
                const color = v === 0 ? "text-green-700 bg-green-50" : v <= 3 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
                const dot = v === 0 ? "🟢" : v <= 3 ? "🟡" : "🔴";
                return (
                  <div className={`rounded-lg px-3 py-2 text-center ${color}`} data-testid="scorecard-low-matches">
                    <div className="text-lg">{dot}</div>
                    <div className="text-xs font-medium mt-0.5">低分匹配数</div>
                    <div className="text-sm font-bold">{v} 个</div>
                  </div>
                );
              })()}
              {/* 活跃会员转化率 */}
              {(() => {
                const ratio = stats.totalUsers > 0 ? (stats.subscribedUsers / stats.totalUsers) * 100 : 0;
                const color = ratio > 15 ? "text-green-700 bg-green-50" : ratio >= 5 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
                const dot = ratio > 15 ? "🟢" : ratio >= 5 ? "🟡" : "🔴";
                return (
                  <div className={`rounded-lg px-3 py-2 text-center ${color}`} data-testid="scorecard-conversion-rate">
                    <div className="text-lg">{dot}</div>
                    <div className="text-xs font-medium mt-0.5">活跃会员转化率</div>
                    <div className="text-sm font-bold">{ratio.toFixed(1)}%</div>
                  </div>
                );
              })()}
              {/* 资料完整度 */}
              {(() => {
                const cs = stats.completenessStats;
                const highQualityUsers = cs ? (cs.star4 + cs.star5) : 0;
                const totalWithData = cs ? (cs.star1 + cs.star2 + cs.star3 + cs.star4 + cs.star5) : 0;
                const ratio = totalWithData > 0 ? (highQualityUsers / totalWithData) * 100 : 0;
                const color = ratio > 50 ? "text-green-700 bg-green-50" : ratio >= 30 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
                const dot = ratio > 50 ? "🟢" : ratio >= 30 ? "🟡" : "🔴";
                return (
                  <div className={`rounded-lg px-3 py-2 text-center ${color}`} data-testid="scorecard-profile-richness">
                    <div className="text-lg">{dot}</div>
                    <div className="text-xs font-medium mt-0.5">资料完整度</div>
                    <div className="text-sm font-bold">{ratio.toFixed(0)}%</div>
                  </div>
                );
              })()}
              {/* 本月活动密度 */}
              {(() => {
                const v = stats.eventsThisMonth ?? 0;
                const color = v >= 10 ? "text-green-700 bg-green-50" : v >= 5 ? "text-amber-700 bg-amber-50" : "text-red-700 bg-red-50";
                const dot = v >= 10 ? "🟢" : v >= 5 ? "🟡" : "🔴";
                return (
                  <div className={`rounded-lg px-3 py-2 text-center ${color}`} data-testid="scorecard-event-density">
                    <div className="text-lg">{dot}</div>
                    <div className="text-xs font-medium mt-0.5">本月活动密度</div>
                    <div className="text-sm font-bold">{v} 场</div>
                  </div>
                );
              })()}
            </div>
          </CardContent>
        </Card>
      )}

      {stats?.matchingMetrics && (
        <Card className="mb-6" data-testid="card-semantic-matching-metrics">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              🧠 语义匹配观测
              <Badge variant={stats.matchingMetrics.semanticFeatureEnabled ? "default" : "secondary"}>
                {stats.matchingMetrics.semanticFeatureEnabled ? "已启用" : "未启用"}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">语义相似度均值</div>
                <div className="mt-1 text-2xl font-semibold">
                  {stats.matchingMetrics.semanticSimilarity.average ?? "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  样本 {stats.matchingMetrics.semanticSimilarity.sampleCount} 对
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">平均配对分数变化</div>
                <div className="mt-1 text-2xl font-semibold">
                  {stats.matchingMetrics.semanticPairDelta.average ?? "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  范围 {stats.matchingMetrics.semanticPairDelta.min ?? "—"} ~ {stats.matchingMetrics.semanticPairDelta.max ?? "—"}
                </div>
              </div>
              <div className="rounded-lg border p-3">
                <div className="text-xs text-muted-foreground">语义相似度范围</div>
                <div className="mt-1 text-2xl font-semibold">
                  {stats.matchingMetrics.semanticSimilarity.min ?? "—"} ~ {stats.matchingMetrics.semanticSimilarity.max ?? "—"}
                </div>
                <div className="mt-1 text-xs text-muted-foreground">
                  仅统计新计算的配对样本
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {statCards.map((stat) => (
          <Card key={stat.title} data-testid={`stat-card-${stat.title}`}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">
                {stat.title}
              </CardTitle>
              <stat.icon className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid={`stat-value-${stat.title}`}>
                {stat.value}
              </div>
              <p className="text-xs text-muted-foreground">
                {stat.description}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <Card className={stats?.weeklyMatchingSatisfaction && stats.weeklyMatchingSatisfaction < 70 ? "border-orange-200 bg-orange-50/50" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">本周匹配满意度</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold" data-testid="stat-value-matching-satisfaction">
              {stats?.weeklyMatchingSatisfaction ?? 0}%
            </div>
            <p className="text-xs text-muted-foreground">用户反馈评分</p>
            {stats?.weeklyMatchingSatisfaction && stats.weeklyMatchingSatisfaction < 70 && (
              <p className="text-xs text-orange-600 mt-1">⚠️ 需关注</p>
            )}
          </CardContent>
        </Card>

        <Card className={stats?.lowScoringMatches && stats.lowScoringMatches > 0 ? "border-red-200" : ""}>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">低分匹配预警</CardTitle>
            <AlertCircle className={`h-4 w-4 ${stats?.lowScoringMatches && stats.lowScoringMatches > 0 ? "text-red-500" : "text-muted-foreground"}`} />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-destructive" data-testid="stat-value-low-matches">
              {stats?.lowScoringMatches ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">匹配得分 &lt; 50</p>
            {stats?.lowScoringMatches && stats.lowScoringMatches > 0 && (
              <Button size="sm" variant="ghost" className="mt-2 h-6 text-xs" onClick={() => setLocation("/admin/matching")} data-testid="button-view-low-matches">
                查看详情 →
              </Button>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>性格类型分布</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {stats?.personalityDistribution && Object.keys(stats.personalityDistribution).length > 0 ? (
                sortedPersonalityDistribution.map(([role, count]) => (
                    <div key={role} className="flex items-center justify-between">
                      <span className="text-sm font-medium">{role}</span>
                      <span className="text-sm text-muted-foreground">{count} 人</span>
                    </div>
                  ))
              ) : (
                <div className="flex h-[120px] items-center justify-center text-muted-foreground text-xs">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Profile Richness Section */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">资料丰富度分析</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {/* Star Rating Distribution */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">资料完整度分布</CardTitle>
              <Star className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.completenessStats ? (
                  <>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderStars(5)}
                        <span className="text-xs text-muted-foreground">90%+</span>
                      </div>
                      <span className="text-sm font-medium">{stats.completenessStats.star5}人</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderStars(4)}
                        <span className="text-xs text-muted-foreground">75-89%</span>
                      </div>
                      <span className="text-sm font-medium">{stats.completenessStats.star4}人</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderStars(3)}
                        <span className="text-xs text-muted-foreground">55-74%</span>
                      </div>
                      <span className="text-sm font-medium">{stats.completenessStats.star3}人</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderStars(2)}
                        <span className="text-xs text-muted-foreground">35-54%</span>
                      </div>
                      <span className="text-sm font-medium">{stats.completenessStats.star2}人</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {renderStars(1)}
                        <span className="text-xs text-muted-foreground">&lt;35%</span>
                      </div>
                      <span className="text-sm font-medium">{stats.completenessStats.star1}人</span>
                    </div>
                  </>
                ) : (
                  <div className="flex h-[120px] items-center justify-center text-muted-foreground text-xs">
                    暂无数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* 12 Archetype Distribution */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">12原型分布</CardTitle>
              <UserCog className="h-4 w-4 text-purple-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.archetypeDistribution && Object.keys(stats.archetypeDistribution).length > 0 ? (
                  sortedArchetypeDistribution.map(([archetype, count]) => (
                      <div key={archetype} className="flex items-center justify-between">
                        <span className="text-sm font-medium truncate">{archetype}</span>
                        <span className="text-sm text-muted-foreground">{count}人</span>
                      </div>
                    ))
                ) : (
                  <div className="flex h-[120px] items-center justify-center text-muted-foreground text-xs">
                    暂无原型数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* City Distribution */}
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">城市分布</CardTitle>
              <MapPin className="h-4 w-4 text-blue-400" />
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats?.cityDistribution && Object.keys(stats.cityDistribution).length > 0 ? (
                  sortedCityDistribution.map(([city, count]) => (
                      <div key={city} className="flex items-center justify-between">
                        <span className="text-sm font-medium">{city}</span>
                        <span className="text-sm text-muted-foreground">{count}人</span>
                      </div>
                    ))
                ) : (
                  <div className="flex h-[120px] items-center justify-center text-muted-foreground text-xs">
                    暂无城市数据
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Weak Users Alert */}
      {stats?.completenessStats?.weakUsers && stats.completenessStats.weakUsers.length > 0 && (
        <div className="mt-6">
          <Card className="border-orange-200 bg-orange-50/30 dark:bg-orange-950/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-orange-500" />
                薄弱资料用户预警
              </CardTitle>
              <Button 
                size="sm" 
                variant="outline" 
                className="h-7 text-xs"
                onClick={() => setLocation("/admin/users?maxCompleteness=50")}
                data-testid="button-view-weak-users"
              >
                查看全部
              </Button>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {stats.completenessStats.weakUsers.slice(0, 5).map((user) => (
                  <div key={user.id} className="flex items-center justify-between p-2 bg-background rounded-md">
                    <div className="flex items-center gap-3">
                      <div className="flex flex-col">
                        <span className="text-sm font-medium">{user.displayName}</span>
                        <span className="text-xs text-muted-foreground">
                          缺少: {user.missingFields.slice(0, 3).join("、")}
                          {user.missingFields.length > 3 && "..."}
                        </span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="text-xs">
                        {user.score}%
                      </Badge>
                      {renderStars(user.starRating)}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Gamification Section */}
      <div className="mt-6">
        <h3 className="text-lg font-semibold mb-4">游戏化系统概览</h3>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">平均等级</CardTitle>
              <Trophy className="h-4 w-4 text-purple-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-avg-level">
                Lv.{stats?.gamificationStats?.avgLevel ?? 1}
              </div>
              <p className="text-xs text-muted-foreground">全平台用户</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">悦币流通</CardTitle>
              <Coins className="h-4 w-4 text-yellow-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-coins">
                {stats?.gamificationStats?.totalJoyCoins?.toLocaleString() ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">全平台悦币总量</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">总经验值</CardTitle>
              <TrendingUp className="h-4 w-4 text-green-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-total-xp">
                {stats?.gamificationStats?.totalXP?.toLocaleString() ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">累计XP</p>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">活跃连击</CardTitle>
              <Flame className="h-4 w-4 text-orange-500" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold" data-testid="stat-active-streaks">
                {stats?.gamificationStats?.activeStreakUsers ?? 0}
              </div>
              <p className="text-xs text-muted-foreground">有连击的用户</p>
            </CardContent>
          </Card>
        </div>

        {/* Level Distribution */}
        {stats?.gamificationStats?.levelDistribution && Object.keys(stats.gamificationStats.levelDistribution).length > 0 && (
          <Card className="mt-4">
            <CardHeader>
              <CardTitle className="text-sm font-medium">等级分布</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {sortedLevelDistribution.map(([level, count]) => (
                    <Badge 
                      key={level} 
                      variant="secondary" 
                      className="text-xs"
                      data-testid={`badge-level-${level}`}
                    >
                      {level}: {count}人
                    </Badge>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
