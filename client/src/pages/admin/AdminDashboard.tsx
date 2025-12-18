import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Users, CreditCard, Calendar, DollarSign, UserPlus, TrendingUp, AlertCircle, RefreshCw, Star, MapPin, UserCog } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "wouter";

interface WeakUser {
  id: string;
  displayName: string;
  score: number;
  starRating: number;
  missingFields: string[];
}

interface AdminStats {
  totalUsers: number;
  subscribedUsers: number;
  eventsThisMonth: number;
  monthlyRevenue: number;
  newUsersThisWeek: number;
  userGrowth: number;
  personalityDistribution: Record<string, number>;
  archetypeDistribution?: Record<string, number>;
  completenessStats?: {
    star1: number;
    star2: number;
    star3: number;
    star4: number;
    star5: number;
    weakUsers: WeakUser[];
  };
  cityDistribution?: Record<string, number>;
  weeklyMatchingSatisfaction?: number;
  lowScoringMatches?: number;
}

export default function AdminDashboard() {
  const [, setLocation] = useLocation();
  const { data: stats, isLoading, isError, error, refetch } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
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

  const statCards = [
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
  ];

  return (
    <div className="p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold">数据看板</h2>
        <p className="text-muted-foreground">核心业务指标概览</p>
      </div>

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
            <div className="text-2xl font-bold text-red-600" data-testid="stat-value-low-matches">
              {stats?.lowScoringMatches ?? 0}
            </div>
            <p className="text-xs text-muted-foreground">匹配得分 &lt; 50</p>
            {stats?.lowScoringMatches && stats.lowScoringMatches > 0 && (
              <Button size="sm" variant="ghost" className="mt-2 h-6 text-xs" data-testid="button-view-low-matches">
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
                Object.entries(stats.personalityDistribution)
                  .sort((a, b) => b[1] - a[1])
                  .slice(0, 5)
                  .map(([role, count]) => (
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
                  Object.entries(stats.archetypeDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 6)
                    .map(([archetype, count]) => (
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
                  Object.entries(stats.cityDistribution)
                    .sort((a, b) => b[1] - a[1])
                    .slice(0, 5)
                    .map(([city, count]) => (
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
    </div>
  );
}
