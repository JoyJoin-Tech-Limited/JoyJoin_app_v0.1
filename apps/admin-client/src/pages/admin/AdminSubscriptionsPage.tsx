import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { AlertCircle, Crown, DollarSign, Plus, RefreshCw, TrendingUp, Users } from "lucide-react";
import { differenceInDays, format, isValid } from "date-fns";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/ui/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";

interface Subscription {
  id?: string;
  user_id?: string;
  userId?: string;
  first_name?: string | null;
  firstName?: string | null;
  last_name?: string | null;
  lastName?: string | null;
  email?: string | null;
  phone_number?: string | null;
  phoneNumber?: string | null;
  plan_type?: string | null;
  planType?: string | null;
  start_date?: string | Date | null;
  startDate?: string | Date | null;
  end_date?: string | Date | null;
  endDate?: string | Date | null;
  is_active?: boolean | null;
  isActive?: boolean | null;
  auto_renew?: boolean | null;
  autoRenew?: boolean | null;
  created_at?: string | Date | null;
  createdAt?: string | Date | null;
}

interface AdminUserOption {
  id?: string;
  firstName?: string | null;
  first_name?: string | null;
  lastName?: string | null;
  last_name?: string | null;
  email?: string | null;
  phoneNumber?: string | null;
  phone_number?: string | null;
}

function subscriptionId(subscription: Subscription, index: number) {
  return subscription.id ?? subscription.user_id ?? subscription.userId ?? `subscription-${index}`;
}

function planTypeOf(subscription: Subscription) {
  return subscription.plan_type ?? subscription.planType ?? "monthly";
}

function isActiveFlag(subscription: Subscription) {
  return Boolean(subscription.is_active ?? subscription.isActive);
}

function autoRenewOf(subscription: Subscription) {
  return Boolean(subscription.auto_renew ?? subscription.autoRenew);
}

function startDateOf(subscription: Subscription) {
  return subscription.start_date ?? subscription.startDate ?? null;
}

function endDateOf(subscription: Subscription) {
  return subscription.end_date ?? subscription.endDate ?? null;
}

function toValidDate(value: string | Date | null | undefined) {
  if (!value) return null;
  const date = value instanceof Date ? value : new Date(value);
  return isValid(date) ? date : null;
}

function formatSubscriptionDate(value: string | Date | null | undefined) {
  const date = toValidDate(value);
  return date ? format(date, "yyyy/MM/dd") : "未设置";
}

function daysUntil(value: string | Date | null | undefined) {
  const date = toValidDate(value);
  return date ? differenceInDays(date, new Date()) : null;
}

function daysRemainingLabel(subscription: Subscription) {
  const days = daysUntil(endDateOf(subscription));
  return days === null ? "未设置" : `${days} 天`;
}

function userDisplayName(subscription: Subscription) {
  const name = [
    subscription.first_name ?? subscription.firstName,
    subscription.last_name ?? subscription.lastName,
  ]
    .filter(Boolean)
    .join(" ")
    .trim();

  return name || subscription.email || subscription.phone_number || subscription.phoneNumber || "未命名用户";
}

function userContact(subscription: Subscription) {
  return subscription.email || subscription.phone_number || subscription.phoneNumber || "暂无联系方式";
}

function isCurrentlyActive(subscription: Subscription) {
  const days = daysUntil(endDateOf(subscription));
  return isActiveFlag(subscription) && (days === null || days > 0);
}

function userOptionLabel(user: AdminUserOption) {
  const name = [user.firstName ?? user.first_name, user.lastName ?? user.last_name]
    .filter(Boolean)
    .join(" ")
    .trim();
  const contact = user.email ?? user.phoneNumber ?? user.phone_number ?? "暂无联系方式";
  return `${name || "未命名用户"} - ${contact}`;
}

export default function AdminSubscriptionsPage() {
  const [filterStatus, setFilterStatus] = useState<"all" | "active">("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [planType, setPlanType] = useState("monthly");
  const [durationMonths, setDurationMonths] = useState("1");
  const { toast } = useToast();

  const {
    data: subscriptions = [],
    isLoading,
    isError,
    error,
    refetch,
  } = useQuery<Subscription[]>({
    queryKey: ["/api/admin/subscriptions", filterStatus],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filterStatus !== "all") {
        params.set("filter", filterStatus);
      }

      const query = params.toString();
      const response = await apiRequest(
        "GET",
        `/api/admin/subscriptions${query ? `?${query}` : ""}`,
      );
      const data = await response.json();
      const rows = Array.isArray(data) ? data : data?.subscriptions;
      return Array.isArray(rows) ? rows : [];
    },
  });

  const { data: rawUsers = [] } = useQuery<AdminUserOption[]>({
    queryKey: ["/api/admin/users"],
  });
  const users = Array.isArray(rawUsers) ? rawUsers : [];

  const createMutation = useMutation({
    mutationFn: async (data: unknown) => {
      const response = await apiRequest("POST", "/api/admin/subscriptions", data);
      return await response.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/subscriptions"] });
      setShowCreateDialog(false);
      setSelectedUserId("");
      setPlanType("monthly");
      setDurationMonths("1");
      toast({
        title: "订阅创建成功",
        description: "用户订阅已成功创建",
      });
    },
    onError: (mutationError: Error) => {
      toast({
        title: "创建失败",
        description: mutationError.message || "无法创建订阅，请重试",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubscription = () => {
    const parsedDuration = Number.parseInt(durationMonths, 10);
    if (!selectedUserId || !planType || !Number.isFinite(parsedDuration) || parsedDuration < 1) {
      toast({
        title: "信息不完整",
        description: "请选择用户、套餐，并填写有效订阅时长",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      userId: selectedUserId,
      planType,
      durationMonths: parsedDuration,
    });
  };

  const getStatusBadge = (subscription: Subscription) => {
    const daysUntilExpiry = daysUntil(endDateOf(subscription));

    if (!isActiveFlag(subscription)) {
      return <Badge variant="secondary">已停用</Badge>;
    }
    if (daysUntilExpiry !== null && daysUntilExpiry < 0) {
      return <Badge variant="destructive">已过期</Badge>;
    }
    if (daysUntilExpiry !== null && daysUntilExpiry <= 7) {
      return <Badge className="bg-amber-500">即将过期</Badge>;
    }
    return <Badge className="bg-green-500">活跃</Badge>;
  };

  const getPlanLabel = (currentPlanType: string) => {
    const labels: Record<string, string> = {
      monthly: "悦聚月卡 (¥98)",
      quarterly: "悦聚季卡 (¥294)",
    };
    return labels[currentPlanType] || currentPlanType;
  };

  const totalRevenue = subscriptions.reduce((sum, subscription) => {
    const currentPlanType = planTypeOf(subscription);
    const revenue =
      currentPlanType === "monthly" ? 98 : currentPlanType === "quarterly" ? 294 : 0;
    return sum + revenue;
  }, 0);

  const activeCount = subscriptions.filter(isCurrentlyActive).length;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">订阅管理</h1>
          <p className="text-muted-foreground mt-1">管理用户会员订阅和权益</p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)} data-testid="button-create-subscription">
          <Plus className="h-4 w-4 mr-2" />
          创建订阅
        </Button>
      </div>

      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">活跃订阅</CardTitle>
            <Crown className="h-4 w-4 text-amber-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activeCount}</div>
            <p className="text-xs text-muted-foreground">当前活跃会员数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总订阅数</CardTitle>
            <Users className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{subscriptions.length}</div>
            <p className="text-xs text-muted-foreground">历史订阅总数</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">订阅收入</CardTitle>
            <DollarSign className="h-4 w-4 text-green-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">¥{totalRevenue.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">累计订阅收入</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">转化率</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-500" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">--%</div>
            <p className="text-xs text-muted-foreground">待统计</p>
          </CardContent>
        </Card>
      </div>

      <Tabs value={filterStatus} onValueChange={(value) => setFilterStatus(value as "all" | "active")}>
        <TabsList>
          <TabsTrigger value="active" data-testid="filter-active">
            活跃订阅
          </TabsTrigger>
          <TabsTrigger value="all" data-testid="filter-all">
            全部订阅
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {isError ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <AlertCircle className="mx-auto h-10 w-10 text-destructive" />
            <div>
              <p className="font-medium">订阅数据加载失败</p>
              <p className="mx-auto max-w-2xl break-words text-sm text-muted-foreground">
                {error instanceof Error ? error.message : "请稍后重试"}
              </p>
            </div>
            <Button
              variant="outline"
              onClick={() => refetch()}
              data-testid="button-retry-subscriptions"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              重试
            </Button>
          </CardContent>
        </Card>
      ) : isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((index) => (
            <Card key={index} className="animate-pulse">
              <CardHeader className="space-y-2">
                <div className="h-4 bg-muted rounded w-3/4" />
                <div className="h-3 bg-muted rounded w-1/2" />
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div className="h-3 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-5/6" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      ) : subscriptions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">暂无订阅记录</CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((subscription, index) => {
            const id = subscriptionId(subscription, index);

            return (
              <Card key={id} data-testid={`card-subscription-${id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                  <div className="flex-1 min-w-0">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {userDisplayName(subscription)}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground truncate">
                      {userContact(subscription)}
                    </p>
                  </div>
                  {getStatusBadge(subscription)}
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">套餐类型</span>
                    <Badge variant="outline">{getPlanLabel(planTypeOf(subscription))}</Badge>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">开始日期</span>
                    <span className="font-medium">
                      {formatSubscriptionDate(startDateOf(subscription))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">结束日期</span>
                    <span className="font-medium">
                      {formatSubscriptionDate(endDateOf(subscription))}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">剩余天数</span>
                    <span className="font-medium">{daysRemainingLabel(subscription)}</span>
                  </div>
                  {autoRenewOf(subscription) && (
                    <div className="pt-2 border-t">
                      <Badge variant="secondary">自动续费</Badge>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>创建新订阅</DialogTitle>
            <DialogDescription>为用户创建会员订阅</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="user">选择用户</Label>
              <Select value={selectedUserId} onValueChange={setSelectedUserId}>
                <SelectTrigger data-testid="select-user">
                  <SelectValue placeholder="选择用户" />
                </SelectTrigger>
                <SelectContent>
                  {users
                    .filter((user) => user?.id)
                    .map((user) => (
                      <SelectItem key={user.id} value={user.id!}>
                        {userOptionLabel(user)}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="plan">套餐类型</Label>
              <Select value={planType} onValueChange={setPlanType}>
                <SelectTrigger data-testid="select-plan">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="monthly">悦聚月卡 (¥98/月)</SelectItem>
                  <SelectItem value="quarterly">悦聚季卡 (¥294/3月)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="duration">订阅时长（月）</Label>
              <Input
                id="duration"
                type="number"
                min="1"
                max="12"
                value={durationMonths}
                onChange={(event) => setDurationMonths(event.target.value)}
                data-testid="input-duration"
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowCreateDialog(false)}
              data-testid="button-cancel"
            >
              取消
            </Button>
            <Button
              onClick={handleCreateSubscription}
              disabled={createMutation.isPending}
              data-testid="button-submit-subscription"
            >
              {createMutation.isPending ? "创建中..." : "创建订阅"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
