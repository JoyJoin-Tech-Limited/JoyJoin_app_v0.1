import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Crown, Calendar, TrendingUp, DollarSign, Users, Plus } from "lucide-react";
import { queryClient } from "@/lib/queryClient";
import { format, differenceInDays } from "date-fns";
import { useToast } from "@/hooks/use-toast";

interface Subscription {
  id: string;
  user_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone_number: string;
  plan_type: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
  auto_renew: boolean;
  created_at: string;
}

export default function AdminSubscriptionsPage() {
  const [filterStatus, setFilterStatus] = useState<"all" | "active">("active");
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedUserId, setSelectedUserId] = useState("");
  const [planType, setPlanType] = useState("monthly");
  const [durationMonths, setDurationMonths] = useState("1");
  const { toast } = useToast();

  const { data: subscriptions = [], isLoading } = useQuery<Subscription[]>({
    queryKey: ["/api/admin/subscriptions", { filter: filterStatus === "all" ? undefined : filterStatus }],
  });

  const { data: users = [] } = useQuery<any[]>({
    queryKey: ["/api/admin/users"],
  });

  const createMutation = useMutation({
    mutationFn: (data: any) =>
      fetch("/api/admin/subscriptions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(data),
      }).then((r) => r.json()),
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
    onError: () => {
      toast({
        title: "创建失败",
        description: "无法创建订阅，请重试",
        variant: "destructive",
      });
    },
  });

  const handleCreateSubscription = () => {
    if (!selectedUserId || !planType || !durationMonths) {
      toast({
        title: "信息不完整",
        description: "请填写所有必填字段",
        variant: "destructive",
      });
      return;
    }

    createMutation.mutate({
      userId: selectedUserId,
      planType,
      durationMonths: parseInt(durationMonths),
    });
  };

  const getStatusBadge = (subscription: Subscription) => {
    const daysUntilExpiry = differenceInDays(new Date(subscription.end_date), new Date());
    
    if (!subscription.is_active) {
      return <Badge variant="secondary">已停用</Badge>;
    }
    if (daysUntilExpiry < 0) {
      return <Badge variant="destructive">已过期</Badge>;
    }
    if (daysUntilExpiry <= 7) {
      return <Badge className="bg-amber-500">即将过期</Badge>;
    }
    return <Badge className="bg-green-500">活跃</Badge>;
  };

  const getPlanLabel = (planType: string) => {
    const labels: Record<string, string> = {
      monthly: "月度会员 (¥98)",
      quarterly: "季度会员 (¥294)",
    };
    return labels[planType] || planType;
  };

  const totalRevenue = subscriptions.reduce((sum, sub) => {
    const revenue = sub.plan_type === "monthly" ? 98 : sub.plan_type === "quarterly" ? 294 : 0;
    return sum + revenue;
  }, 0);

  const activeCount = subscriptions.filter((sub) => sub.is_active && differenceInDays(new Date(sub.end_date), new Date()) > 0).length;

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

      <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
        <TabsList>
          <TabsTrigger value="active" data-testid="filter-active">活跃订阅</TabsTrigger>
          <TabsTrigger value="all" data-testid="filter-all">全部订阅</TabsTrigger>
        </TabsList>
      </Tabs>

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
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
          <CardContent className="py-12 text-center text-muted-foreground">
            暂无订阅记录
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {subscriptions.map((subscription) => (
            <Card key={subscription.id} data-testid={`card-subscription-${subscription.id}`}>
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {subscription.first_name} {subscription.last_name}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{subscription.email}</p>
                </div>
                {getStatusBadge(subscription)}
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">套餐类型</span>
                  <Badge variant="outline">{getPlanLabel(subscription.plan_type)}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">开始日期</span>
                  <span className="font-medium">{format(new Date(subscription.start_date), "yyyy/MM/dd")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">结束日期</span>
                  <span className="font-medium">{format(new Date(subscription.end_date), "yyyy/MM/dd")}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">剩余天数</span>
                  <span className="font-medium">
                    {differenceInDays(new Date(subscription.end_date), new Date())} 天
                  </span>
                </div>
                {subscription.auto_renew && (
                  <div className="pt-2 border-t">
                    <Badge variant="secondary">自动续费</Badge>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
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
                  {users.map((user) => (
                    <SelectItem key={user.id} value={user.id}>
                      {user.firstName} {user.lastName} - {user.email}
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
                  <SelectItem value="monthly">月度会员 (¥98/月)</SelectItem>
                  <SelectItem value="quarterly">季度会员 (¥294/3月)</SelectItem>
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
                onChange={(e) => setDurationMonths(e.target.value)}
                data-testid="input-duration"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)} data-testid="button-cancel">
              取消
            </Button>
            <Button onClick={handleCreateSubscription} disabled={createMutation.isPending} data-testid="button-submit-subscription">
              {createMutation.isPending ? "创建中..." : "创建订阅"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
