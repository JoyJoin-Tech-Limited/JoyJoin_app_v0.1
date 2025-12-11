import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CreditCard, Calendar, DollarSign, UserPlus, TrendingUp, AlertCircle, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";

interface AdminStats {
  totalUsers: number;
  subscribedUsers: number;
  eventsThisMonth: number;
  monthlyRevenue: number;
  newUsersThisWeek: number;
  userGrowth: number;
  personalityDistribution: Record<string, number>;
}

export default function AdminDashboard() {
  const { data: stats, isLoading, isError, error, refetch } = useQuery<AdminStats>({
    queryKey: ["/api/admin/stats"],
    retry: 2,
  });

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

      <div className="mt-6 grid gap-4 md:grid-cols-2">
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
                <div className="flex h-[200px] items-center justify-center text-muted-foreground">
                  暂无数据
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>用户增长趋势</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex h-[200px] items-center justify-center text-muted-foreground">
              数据图表开发中
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
