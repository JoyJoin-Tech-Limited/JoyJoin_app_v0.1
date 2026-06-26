import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useToast } from "@/hooks/ui/use-toast";
import {
  Search,
  UserX,
  UserCheck,
  Trash2,
  Crown,
  AlertCircle,
  RefreshCw,
  Filter,
  X,
  Download,
} from "lucide-react";
import { exportAdminUsersCsv } from "@/lib/adminUserCsvExport";
import { AdminUserStarRating } from "@/components/admin/AdminUserStarRating";
import { AdminUserDetailSheet } from "./AdminUserDetailSheet";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { getCanonicalDisplayName } from "@/lib/userFieldMappings";
import { fmtDate } from "@/lib/dateUtils";
import { useLocation, useSearch } from "wouter";
import { CURRENT_CITY_OPTIONS } from "@shared/constants";
import type { AdminUser, UserDetail } from "./types";
import { getArchetypeBadgeStyle, getStuckStatus } from "./adminUserBadges";

// fix the filter white screen
const ALL_FILTER_VALUE = "__all__";

export default function AdminUsersPage() {
  const searchParams = useSearch();
  const [, setLocation] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "subscribed" | "banned" | "stuck">("all");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [archetypeFilter, setArchetypeFilter] = useState<string>("");
  const [maxCompleteness, setMaxCompleteness] = useState<string>("");
  const { toast } = useToast();
  const [showFilters, setShowFilters] = useState(false);
  const [showBanDialog, setShowBanDialog] = useState(false);
  const [banReason, setBanReason] = useState("");
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("maxCompleteness")) {
      setMaxCompleteness(params.get("maxCompleteness") || "");
      setShowFilters(true);
    }
  }, [searchParams]);

  const { data: users = [], isLoading, isError, error, refetch } = useQuery<AdminUser[]>({
    queryKey: ["/api/admin/users", { search: searchQuery, filter: filterStatus === "all" ? undefined : filterStatus, city: cityFilter, archetype: archetypeFilter, maxCompleteness }],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (searchQuery) params.append("search", searchQuery);
      if (filterStatus !== "all") params.append("filter", filterStatus);
      if (cityFilter) params.append("city", cityFilter);
      if (archetypeFilter) params.append("archetype", archetypeFilter);
      if (maxCompleteness) params.append("maxCompleteness", maxCompleteness);
      const response = await fetch(`/api/admin/users?${params}`, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      return data.users || [];
    },
    retry: 2,
  });

  const { data: userDetail, isLoading: isLoadingDetail } = useQuery<UserDetail>({
    queryKey: ["/api/admin/users", selectedUser, "detail"],
    queryFn: async () => {
      const response = await fetch(`/api/admin/users/${selectedUser}/detail`, { credentials: "include" });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    enabled: !!selectedUser,
  });

  const banMutation = useMutation({
    mutationFn: async ({ userId, reason }: { userId: string; reason: string }) => {
      try {
        const res = await fetch(`/api/admin/users/${userId}/ban`, {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ reason }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
          throw new Error(err.message || `Failed to ban user: ${res.status}`);
        }
        return res.json();
      } catch (err) {
        throw err;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowBanDialog(false);
      setBanReason("");
      setSelectedUser(null);
    },
    onError: (error: any) => {
      toast({
        title: "封禁失败",
        description: error.message || "无法封禁用户，请重试",
        variant: "destructive",
      });
    },
  });

  const unbanMutation = useMutation({
    mutationFn: async (userId: string) => {
      const res = await apiRequest("PATCH", `/api/admin/users/${userId}/unban`);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/admin/users/${userId}/data`, {
        method: "DELETE",
        credentials: "include",
      }).then(async (res) => {
        if (!res.ok) {
          const err = await res.json().catch(() => ({ message: `HTTP ${res.status}` }));
          throw new Error(err.message || `Failed to delete user data: ${res.status}`);
        }
        return res.json();
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setShowDeleteDialog(false);
      setSelectedUser(null);
      toast({
        title: "用户数据已删除",
        description: "该用户的所有数据已从数据库清除",
      });
    },
    onError: (error: any) => {
      toast({
        title: "删除失败",
        description: error.message || "无法删除用户数据，请重试",
        variant: "destructive",
      });
    },
  });

  const clearFilters = () => {
    setCityFilter("");
    setArchetypeFilter("");
    setMaxCompleteness("");
    setLocation("/admin/users");
  };

  const hasActiveFilters = cityFilter || archetypeFilter || maxCompleteness;

  if (isError) {
    return (
      <div className="flex h-full items-center justify-center p-8">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="space-y-4 text-center">
              <AlertCircle className="mx-auto h-12 w-12 text-destructive" />
              <div>
                <h3 className="text-lg font-semibold">加载失败</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {error instanceof Error && error.message.includes("401")
                    ? "您没有访问权限"
                    : "无法加载用户数据，请稍后重试"}
                </p>
              </div>
              <Button onClick={() => refetch()} variant="default" data-testid="button-retry-users">
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
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">用户管理</h1>
          <p className="text-muted-foreground mt-1">查看和管理所有用户账户</p>
        </div>
        <Button variant="outline" size="sm" onClick={() => exportAdminUsersCsv(users)}>
          <Download className="h-4 w-4 mr-2" />
          导出 CSV
        </Button>
      </div>

      <div className="flex flex-col gap-4">
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="搜索用户（姓名、邮箱、手机号）"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              data-testid="input-search-users"
            />
          </div>
          <div className="flex gap-2">
            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="default"
              onClick={() => setShowFilters(!showFilters)}
              data-testid="button-toggle-filters"
            >
              <Filter className="h-4 w-4 mr-2" />
              筛选
              {hasActiveFilters && <Badge variant="default" className="ml-2 h-5 w-5 p-0 flex items-center justify-center text-xs">!</Badge>}
            </Button>
            <Tabs value={filterStatus} onValueChange={(v) => setFilterStatus(v as any)}>
              <TabsList>
                <TabsTrigger value="all" data-testid="filter-all">全部</TabsTrigger>
                <TabsTrigger value="subscribed" data-testid="filter-subscribed">会员</TabsTrigger>
                <TabsTrigger value="banned" data-testid="filter-banned">已封禁</TabsTrigger>
                <TabsTrigger value="stuck" data-testid="filter-stuck">卡壳用户</TabsTrigger>
              </TabsList>
            </Tabs>
          </div>
        </div>

        {showFilters && (
          <Card className="p-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">城市</label>
                <Select
                  value={cityFilter || ALL_FILTER_VALUE}
                  onValueChange={(value) => setCityFilter(value === ALL_FILTER_VALUE ? "" : value)}
                >
                  <SelectTrigger className="w-32" data-testid="select-city-filter">
                    <SelectValue placeholder="全部城市" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>全部城市</SelectItem>
                    {CURRENT_CITY_OPTIONS.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">资料完整度</label>
                <Select
                  value={maxCompleteness || ALL_FILTER_VALUE}
                  onValueChange={(value) => setMaxCompleteness(value === ALL_FILTER_VALUE ? "" : value)}
                >
                  <SelectTrigger className="w-36" data-testid="select-completeness-filter">
                    <SelectValue placeholder="不限" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_FILTER_VALUE}>不限</SelectItem>
                    <SelectItem value="35">薄弱 (&lt;35%)</SelectItem>
                    <SelectItem value="50">待提升 (&lt;50%)</SelectItem>
                    <SelectItem value="75">一般 (&lt;75%)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {hasActiveFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} data-testid="button-clear-filters">
                  <X className="h-4 w-4 mr-1" />
                  清除筛选
                </Button>
              )}
            </div>
          </Card>
        )}
      </div>

      {!isLoading && users.length > 0 && (
        <Card className="mb-4" data-testid="card-onboarding-funnel">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">Onboarding 漏斗</CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const total = users.length;
              const steps = [
                { label: "注册开始", count: total, key: null },
                { label: "完成注册", count: users.filter((u) => u.hasCompletedRegistration).length, key: "hasCompletedRegistration" },
                { label: "性格测试", count: users.filter((u) => u.hasCompletedPersonalityTest).length, key: "hasCompletedPersonalityTest" },
                { label: "兴趣选择", count: users.filter((u) => u.hasCompletedInterestsCarousel).length, key: "hasCompletedInterestsCarousel" },
                { label: "资料回顾", count: users.filter((u) => u.hasSeenProfileReview).length, key: "hasSeenProfileReview" },
              ];
              const maxCount = Math.max(...steps.map((s) => s.count), 1);
              return (
                <div className="space-y-2">
                  {steps.map((step, i) => {
                    const widthPercent = Math.round((step.count / maxCount) * 100);
                    const dropoff = i > 0 ? steps[i - 1].count - step.count : 0;
                    return (
                      <div key={step.label} className="flex items-center gap-3">
                        <div className="w-20 text-xs text-muted-foreground text-right shrink-0">{step.label}</div>
                        <div className="flex-1 h-6 bg-muted rounded overflow-hidden relative">
                          <div
                            className="h-full bg-primary/80 rounded transition-all"
                            style={{ width: `${widthPercent}%` }}
                          />
                          <span className="absolute inset-0 flex items-center px-2 text-xs font-medium mix-blend-difference text-white">
                            {step.count}
                            {dropoff > 0 && i > 0 && (
                              <span className="ml-1.5 text-[10px] opacity-70">↓{dropoff}</span>
                            )}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
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
      ) : users.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            {searchQuery ? "未找到匹配的用户" : "暂无用户"}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {users.map((user) => (
            <Card
              key={user.id}
              className="cursor-pointer hover-elevate active-elevate-2 transition-all"
              onClick={() => setSelectedUser(user.id)}
              data-testid={`card-user-${user.id}`}
            >
              <CardHeader className="flex flex-row items-start justify-between gap-2 space-y-0 pb-3">
                <div className="flex-1 min-w-0">
                  <CardTitle className="text-lg flex items-center gap-2">
                    {getCanonicalDisplayName(user)}
                    {user.isAdmin && <Crown className="h-4 w-4 text-amber-500" />}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{user.email || user.phoneNumber}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {user.profileCompleteness && <AdminUserStarRating rating={user.profileCompleteness.starRating} />}
                  {(() => {
                    const stuck = getStuckStatus(user);
                    return stuck.isStuck ? <Badge variant={stuck.variant} className="text-xs">{stuck.label}</Badge> : null;
                  })()}
                  {user.isBanned && <Badge variant="destructive">已封禁</Badge>}
                </div>
              </CardHeader>
              <CardContent className="space-y-2 text-sm">
                {user.currentCity && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">城市</span>
                    <span className="font-medium">{user.currentCity}</span>
                  </div>
                )}
                {user.gender && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">性别</span>
                    <span className="font-medium">{user.gender}</span>
                  </div>
                )}
                {user.archetype && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">原型</span>
                    {(() => {
                      const style = getArchetypeBadgeStyle(user.primaryArchetype || user.archetype);
                      return (
                        <Badge
                          variant="outline"
                          className="text-xs"
                          style={style ? {
                            backgroundColor: style.backgroundColor,
                            color: style.color,
                            borderColor: style.borderColor,
                          } : undefined}
                        >
                          {user.archetype}
                        </Badge>
                      );
                    })()}
                  </div>
                )}
                {user.profileCompleteness && (
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">资料完整度</span>
                    <Badge
                      variant={user.profileCompleteness.score < 50 ? "destructive" : user.profileCompleteness.score < 75 ? "secondary" : "default"}
                      className="text-xs"
                    >
                      {user.profileCompleteness.score}%
                    </Badge>
                  </div>
                )}
                <div className="flex justify-between pt-2 border-t">
                  <span className="text-muted-foreground">注册时间</span>
                  <span className="text-xs">{fmtDate(user.createdAt)}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AdminUserDetailSheet
        selectedUser={selectedUser}
        onClose={() => setSelectedUser(null)}
        userDetail={userDetail}
        isLoadingDetail={isLoadingDetail}
        onBan={() => setShowBanDialog(true)}
        onUnban={() => {
          if (userDetail) unbanMutation.mutate(userDetail.user.id);
        }}
        onDelete={() => setShowDeleteDialog(true)}
        banPending={banMutation.isPending}
        unbanPending={unbanMutation.isPending}
        deletePending={deleteMutation.isPending}
      />

      <AlertDialog open={showBanDialog} onOpenChange={setShowBanDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <UserX className="h-5 w-5 text-destructive" />
              确认封禁用户
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {userDetail && (
                <>
                  <p>
                    你即将封禁用户 <strong>{userDetail.user.displayName || userDetail.user.wechatNickname || userDetail.user.phoneNumber}</strong>。
                    此操作将立即生效，该用户将无法登录、参加活动或接收匹配。
                  </p>
                  <div className="space-y-2">
                    <label className="text-sm font-medium">
                      封禁原因 <span className="text-destructive">*</span>
                    </label>
                    <Input
                      placeholder="请填写封禁原因（至少5个字符）"
                      value={banReason}
                      onChange={(e) => setBanReason(e.target.value)}
                      data-testid="input-ban-reason"
                    />
                    <p className="text-xs text-muted-foreground">
                      封禁原因将记录在审计日志中，供后续查阅。
                    </p>
                  </div>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setBanReason("")}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userDetail && banReason.trim().length >= 5) {
                  banMutation.mutate({ userId: userDetail.user.id, reason: banReason.trim() });
                }
              }}
              disabled={banMutation.isPending || banReason.trim().length < 5}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              data-testid="button-confirm-ban"
            >
              {banMutation.isPending ? "封禁中..." : "确认封禁"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Trash2 className="h-5 w-5 text-black" />
              确认删除用户数据
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-3">
              {userDetail && (
                <>
                  <p>
                    你即将永久删除用户 <strong>{userDetail.user.displayName || userDetail.user.wechatNickname || userDetail.user.phoneNumber}</strong> 的<strong>所有数据</strong>。
                  </p>
                  <p className="text-destructive font-medium">
                    此操作不可撤销！以下数据将被永久清除：
                  </p>
                  <ul className="text-sm list-disc pl-4 space-y-1">
                    <li>个人资料、职业信息、兴趣偏好</li>
                    <li>人格测试结果与性格原型</li>
                    <li>活动报名、参与记录、匹配历史</li>
                    <li>支付记录、订阅、优惠券</li>
                    <li>通知消息、聊天记录、连接关系</li>
                    <li>经验值、Joy币、等级数据</li>
                  </ul>
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={() => setShowDeleteDialog(false)}>取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (userDetail) {
                  deleteMutation.mutate(userDetail.user.id);
                }
              }}
              disabled={deleteMutation.isPending}
              className="bg-black text-white hover:bg-black/80"
              data-testid="button-confirm-delete-user-data"
            >
              {deleteMutation.isPending ? "删除中..." : "确认永久删除"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
