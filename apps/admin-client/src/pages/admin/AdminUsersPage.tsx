import { useState, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  UserX,
  UserCheck,
  Calendar,
  Crown,
  AlertCircle,
  RefreshCw,
  Star,
  Filter,
  X,
  CheckCircle2,
  XCircle,
  Clock,
  MapPin,
  Zap,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { calculateAge } from "@/lib/userFieldMappings";
import { format } from "date-fns";
import { useLocation, useSearch } from "wouter";
import { CURRENT_CITY_OPTIONS } from "@shared/constants";

interface ProfileCompleteness {
  score: number;
  starRating: number;
  missingFields: string[];
}

interface User {
  id: string;
  firstName: string;
  lastName: string;
  displayName?: string;
  email: string;
  phoneNumber: string;
  gender?: string;
  birthdate?: string;
  primaryArchetype?: string;
  archetype?: string;
  currentCity?: string;
  educationLevel?: string;
  industryCategory?: string;
  industryCategoryLabel?: string;
  industryNicheLabel?: string;
  hometownRegionCity?: string;
  interestsTop?: string[];
  intent?: string[];
  isAdmin: boolean;
  isBanned: boolean;
  hasCompletedRegistration: boolean;
  hasCompletedPersonalityTest?: boolean;
  hasCompletedInterestsCarousel?: boolean;
  hasSeenProfileReview?: boolean;
  hasSeenGuide?: boolean;
  onboardingCheckpoint?: string | null;
  onboardingCheckpointTimestamp?: string | null;
  createdAt: string;
  profileCompleteness?: ProfileCompleteness;
}

interface OnboardingState {
  nextStep: string;
  profileEssentialComplete: boolean;
  hasCompletedRegistration: boolean;
  hasCompletedPersonalityTest: boolean;
  hasCompletedInterestsCarousel: boolean;
  hasSeenProfileReview: boolean;
  hasSeenGuide: boolean;
}

interface AssessmentSession {
  id: string;
  primaryArchetype?: string;
  phase: string;
  traitScores?: Record<string, number>;
  topArchetypes?: Array<{ archetype: string; score: number }>;
  completedAt?: string;
  isDecisive?: boolean;
  matchDetailsJson?: { primaryArchetype?: string; secondaryArchetype?: string; decisiveReason?: string; score?: number };
}

interface UserInterests {
  totalHeat?: number;
  totalSelections?: number;
  categoryHeat?: Record<string, number>;
  selections?: Array<{ topicId: string; emoji?: string; label: string; category: string; heat: number; level: number }>;
  topPriorities?: Array<{ topicId: string; label: string; heat: number }>;
}

interface JoinedEvent {
  id: string;
  title?: string;
  eventType?: string;
  dateTime?: string;
  attendanceStatus?: string;
}

interface PoolRegistration {
  id: string;
  poolId: string;
  assignedGroupId?: string | null;
  matchStatus?: string;
  matchScore?: number | null;
  registeredAt?: string;
  eventIntent?: string[];
  budgetRange?: string[];
}

interface Connection {
  id: string;
  eventId: string;
  userAId: string;
  userBId: string;
  status: string;
  revealedAt?: string | null;
  createdAt?: string;
}

interface MatchHistoryEntry {
  id: string;
  user1Id: string;
  user2Id: string;
  eventId: string;
  matchedAt?: string | null;
  connectionQuality?: number | null;
  wouldMeetAgain?: boolean | null;
  connectionPointTypes?: string[] | null;
}

interface UserDetail {
  user: User & { profileCompleteness: ProfileCompleteness };
  onboarding: OnboardingState;
  assessmentSession: AssessmentSession | null;
  joinedEvents: JoinedEvent[];
  poolRegistrations: PoolRegistration[];
  connections: Connection[];
  matchHistory: MatchHistoryEntry[];
  interests: UserInterests | null;
  matchingReadiness: { isReady: boolean; blockers: string[] };
}

export default function AdminUsersPage() {
  const searchParams = useSearch();
  const [, setLocation] = useLocation();

  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "subscribed" | "banned" | "stuck">("all");
  const [selectedUser, setSelectedUser] = useState<string | null>(null);
  const [cityFilter, setCityFilter] = useState<string>("");
  const [archetypeFilter, setArchetypeFilter] = useState<string>("");
  const [maxCompleteness, setMaxCompleteness] = useState<string>("");
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(searchParams);
    if (params.get("maxCompleteness")) {
      setMaxCompleteness(params.get("maxCompleteness") || "");
      setShowFilters(true);
    }
  }, [searchParams]);

  const { data: users = [], isLoading, isError, error, refetch } = useQuery<User[]>({
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
    mutationFn: (userId: string) =>
      fetch(`/api/admin/users/${userId}/ban`, { method: "PATCH", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
  });

  const unbanMutation = useMutation({
    mutationFn: (userId: string) =>
      fetch(`/api/admin/users/${userId}/unban`, { method: "PATCH", credentials: "include" }).then(r => r.json()),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setSelectedUser(null);
    },
  });

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star key={i} className={`h-3 w-3 ${i <= rating ? "fill-amber-400 text-amber-400" : "text-muted"}`} />
      ))}
    </div>
  );

  const clearFilters = () => {
    setCityFilter("");
    setArchetypeFilter("");
    setMaxCompleteness("");
    setLocation("/admin/users");
  };

  const hasActiveFilters = cityFilter || archetypeFilter || maxCompleteness;

  const OnboardingStep = ({ done, label }: { done: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm">
      {done
        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );

  const ReadinessCheck = ({ ok, label }: { ok: boolean; label: string }) => (
    <div className="flex items-center gap-2 text-sm py-1">
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
      <span className={ok ? "" : "text-destructive"}>{label}</span>
    </div>
  );

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
          <h1 className="text-3xl font-bold">用户管理</h1>
          <p className="text-muted-foreground mt-1">查看和管理所有用户账户</p>
        </div>
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
                <Select value={cityFilter} onValueChange={setCityFilter}>
                  <SelectTrigger className="w-32" data-testid="select-city-filter">
                    <SelectValue placeholder="全部城市" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">全部城市</SelectItem>
                    {CURRENT_CITY_OPTIONS.map((city) => (
                      <SelectItem key={city} value={city}>{city}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-xs text-muted-foreground">资料完整度</label>
                <Select value={maxCompleteness} onValueChange={setMaxCompleteness}>
                  <SelectTrigger className="w-36" data-testid="select-completeness-filter">
                    <SelectValue placeholder="不限" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">不限</SelectItem>
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

      {/* Onboarding Funnel Mini-Chart */}
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
                { label: "引导完成", count: users.filter((u) => u.hasSeenGuide).length, key: "hasSeenGuide" },
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
                    {user.displayName || `${user.firstName || ''} ${user.lastName || ''}`.trim() || '未命名'}
                    {user.isAdmin && <Crown className="h-4 w-4 text-amber-500" />}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground truncate">{user.email || user.phoneNumber}</p>
                </div>
                <div className="flex flex-col gap-1 items-end">
                  {user.profileCompleteness && renderStars(user.profileCompleteness.starRating)}
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
                    <Badge variant="outline" className="text-xs">{user.archetype}</Badge>
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
                  <span className="text-xs">{format(new Date(user.createdAt), "yyyy/MM/dd")}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Detail Sheet */}
      <Sheet open={!!selectedUser} onOpenChange={() => setSelectedUser(null)}>
        <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
          <SheetHeader className="px-6 pt-6 pb-4 border-b">
            <SheetTitle className="flex items-center gap-2">
              用户详情
              {userDetail?.user.isAdmin && <Crown className="h-5 w-5 text-amber-500" />}
              {userDetail?.user.isBanned && <Badge variant="destructive">已封禁</Badge>}
            </SheetTitle>
            <SheetDescription>
              {userDetail?.user.displayName || '—'} · {userDetail?.user.phoneNumber || userDetail?.user.email || '—'}
            </SheetDescription>
          </SheetHeader>

          {isLoadingDetail ? (
            <div className="flex-1 p-6 space-y-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
              ))}
            </div>
          ) : userDetail ? (
            <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden" aria-label="用户详情标签页">
              <TabsList className="mx-6 mt-4 mb-0 shrink-0 flex flex-wrap h-auto gap-1 justify-start bg-muted/50">
                <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
                <TabsTrigger value="portrait" className="text-xs">用户画像</TabsTrigger>
                <TabsTrigger value="activity" className="text-xs">活动历史</TabsTrigger>
                <TabsTrigger value="connections" className="text-xs">连接关系</TabsTrigger>
                <TabsTrigger value="matches" className="text-xs">匹配历史</TabsTrigger>
                <TabsTrigger value="readiness" className="text-xs">匹配就绪度</TabsTrigger>
              </TabsList>

              <ScrollArea className="flex-1 px-6 pt-4 pb-6">

                {/* Tab 1: Overview */}
                <TabsContent value="overview" className="mt-0 space-y-4">
                  {/* Profile completeness */}
                  <Card className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        {renderStars(userDetail.user.profileCompleteness.starRating)}
                        <span className="font-semibold">{userDetail.user.profileCompleteness.score}% 完整</span>
                      </div>
                      {userDetail.user.profileCompleteness.missingFields.length > 0 && (
                        <span className="text-xs text-muted-foreground">
                          缺少: {userDetail.user.profileCompleteness.missingFields.slice(0, 4).join("、")}
                          {userDetail.user.profileCompleteness.missingFields.length > 4 && "…"}
                        </span>
                      )}
                    </div>
                  </Card>

                  {/* Basic profile */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">基本信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        <div>
                          <p className="text-xs text-muted-foreground">昵称</p>
                          <p className="font-medium">{userDetail.user.displayName || '未设置'}</p>
                        </div>
                        <div>
                          <p className="text-xs text-muted-foreground">手机/邮箱</p>
                          <p className="font-medium truncate">{userDetail.user.phoneNumber || userDetail.user.email || '—'}</p>
                        </div>
                        {userDetail.user.gender && (
                          <div>
                            <p className="text-xs text-muted-foreground">性别</p>
                            <p className="font-medium">{userDetail.user.gender}</p>
                          </div>
                        )}
                        {userDetail.user.currentCity && (
                          <div>
                            <p className="text-xs text-muted-foreground">城市</p>
                            <p className="font-medium flex items-center gap-1">
                              <MapPin className="h-3 w-3" />{userDetail.user.currentCity}
                            </p>
                          </div>
                        )}
                        <div>
                          <p className="text-xs text-muted-foreground">注册时间</p>
                          <p className="font-medium flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {format(new Date(userDetail.user.createdAt), "yyyy年MM月dd日")}
                          </p>
                        </div>
                        {userDetail.user.archetype && (
                          <div>
                            <p className="text-xs text-muted-foreground">社交原型</p>
                            <Badge variant="outline">{userDetail.user.archetype}</Badge>
                          </div>
                        )}
                      </div>
                      <div className="flex gap-2 pt-1">
                        {userDetail.user.isAdmin && <Badge variant="secondary"><Crown className="h-3 w-3 mr-1" />管理员</Badge>}
                        {userDetail.user.isBanned && <Badge variant="destructive">已封禁</Badge>}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Onboarding lifecycle */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        注册进度
                        <Badge variant="outline" className="text-xs font-normal">
                          <Clock className="h-3 w-3 mr-1" />
                          {userDetail.onboarding.nextStep}
                        </Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1.5">
                      <OnboardingStep done={userDetail.onboarding.hasCompletedPersonalityTest} label="人格测试完成" />
                      <OnboardingStep done={userDetail.onboarding.profileEssentialComplete} label="基本资料完成" />
                      <OnboardingStep done={userDetail.onboarding.hasCompletedInterestsCarousel} label="兴趣偏好完成" />
                      <OnboardingStep done={userDetail.onboarding.hasSeenProfileReview} label="资料预览完成" />
                      <OnboardingStep done={userDetail.onboarding.hasSeenGuide} label="发现社区就绪" />
                    </CardContent>
                  </Card>

                  {/* Ban action */}
                  {!userDetail.user.isAdmin && (
                    <Button
                      variant={userDetail.user.isBanned ? "default" : "destructive"}
                      className="w-full"
                      onClick={() => userDetail.user.isBanned ? unbanMutation.mutate(userDetail.user.id) : banMutation.mutate(userDetail.user.id)}
                      disabled={banMutation.isPending || unbanMutation.isPending}
                      data-testid={userDetail.user.isBanned ? "button-unban-user" : "button-ban-user"}
                    >
                      {userDetail.user.isBanned ? <><UserCheck className="h-4 w-4 mr-2" />解除封禁</> : <><UserX className="h-4 w-4 mr-2" />封禁用户</>}
                    </Button>
                  )}
                </TabsContent>

                {/* Tab 2: User Portrait */}
                <TabsContent value="portrait" className="mt-0 space-y-4">
                  {/* Archetype */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">性格原型</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {userDetail.user.archetype ? (
                        <div className="flex items-center gap-2">
                          <Badge className="text-base px-3 py-1">{userDetail.user.archetype}</Badge>
                        </div>
                      ) : (
                        <p className="text-sm text-muted-foreground">未确定原型</p>
                      )}
                      {userDetail.assessmentSession?.matchDetailsJson && (
                        <div className="text-xs text-muted-foreground space-y-1">
                          {userDetail.assessmentSession.matchDetailsJson.secondaryArchetype && (
                            <p>次要原型: <Badge variant="outline" className="text-xs">{userDetail.assessmentSession.matchDetailsJson.secondaryArchetype}</Badge></p>
                          )}
                          {userDetail.assessmentSession.matchDetailsJson.decisiveReason && (
                            <p className="italic">"{userDetail.assessmentSession.matchDetailsJson.decisiveReason}"</p>
                          )}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Trait scores */}
                  {userDetail.assessmentSession?.traitScores && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm">人格特质得分</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="grid grid-cols-3 gap-2">
                          {Object.entries(userDetail.assessmentSession.traitScores).map(([trait, score]) => (
                            <div key={trait} className="text-center p-2 rounded-md bg-muted/50">
                              <p className="text-lg font-bold">{typeof score === 'number' ? score.toFixed(1) : score}</p>
                              <p className="text-xs text-muted-foreground">{trait}</p>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Background */}
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">背景信息</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                        {userDetail.user.birthdate && (
                          <div>
                            <p className="text-xs text-muted-foreground">年龄</p>
                            <p>{calculateAge(userDetail.user.birthdate)} 岁</p>
                          </div>
                        )}
                        {userDetail.user.educationLevel && (
                          <div>
                            <p className="text-xs text-muted-foreground">学历</p>
                            <p>{userDetail.user.educationLevel}</p>
                          </div>
                        )}
                        {(userDetail.user.industryCategoryLabel || userDetail.user.industryCategory) && (
                          <div>
                            <p className="text-xs text-muted-foreground">行业</p>
                            <p>{userDetail.user.industryCategoryLabel || userDetail.user.industryCategory}</p>
                          </div>
                        )}
                        {userDetail.user.industryNicheLabel && (
                          <div>
                            <p className="text-xs text-muted-foreground">细分</p>
                            <p>{userDetail.user.industryNicheLabel}</p>
                          </div>
                        )}
                        {userDetail.user.hometownRegionCity && (
                          <div>
                            <p className="text-xs text-muted-foreground">家乡</p>
                            <p className="flex items-center gap-1"><MapPin className="h-3 w-3" />{userDetail.user.hometownRegionCity}</p>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  {/* Interests */}
                  {userDetail.interests && (
                    <Card>
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm flex items-center justify-between">
                          兴趣数据
                          <span className="text-xs font-normal text-muted-foreground">
                            {userDetail.interests.totalSelections || 0} 个选择 · 热度 {userDetail.interests.totalHeat || 0}
                          </span>
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-3">
                        {userDetail.interests.topPriorities && userDetail.interests.topPriorities.length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">高优先级兴趣</p>
                            <div className="flex flex-wrap gap-1.5">
                              {userDetail.interests.topPriorities.slice(0, 10).map((p) => (
                                <Badge key={p.topicId} variant="secondary" className="text-xs">{p.label}</Badge>
                              ))}
                            </div>
                          </div>
                        )}
                        {userDetail.interests.categoryHeat && Object.keys(userDetail.interests.categoryHeat).length > 0 && (
                          <div>
                            <p className="text-xs text-muted-foreground mb-1.5">分类热度</p>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {Object.entries(userDetail.interests.categoryHeat).map(([cat, heat]) => (
                                <div key={cat} className="flex justify-between px-2 py-1 rounded bg-muted/40">
                                  <span>{cat}</span>
                                  <span className="font-medium">{heat}</span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

                {/* Tab 3: Activity History */}
                <TabsContent value="activity" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        参与活动
                        <Badge variant="outline" className="font-normal">{userDetail.joinedEvents.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {userDetail.joinedEvents.length === 0 ? (
                        <p className="text-sm text-muted-foreground">尚未参与任何活动</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.joinedEvents.map((event) => (
                            <div key={event.id} className="flex justify-between items-center text-sm border-l-2 border-primary pl-3 py-1">
                              <div>
                                <p className="font-medium">{event.title || event.eventType}</p>
                                <p className="text-xs text-muted-foreground">{event.eventType}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-muted-foreground">{event.dateTime ? format(new Date(event.dateTime), "yyyy/MM/dd") : '—'}</p>
                                {event.attendanceStatus && <Badge variant="outline" className="text-xs mt-0.5">{event.attendanceStatus}</Badge>}
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        活动池报名
                        <Badge variant="outline" className="font-normal">{userDetail.poolRegistrations.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {userDetail.poolRegistrations.length === 0 ? (
                        <p className="text-sm text-muted-foreground">暂无活动池报名记录</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.poolRegistrations.map((reg) => (
                            <div key={reg.id} className="text-sm border rounded-md px-3 py-2">
                              <div className="flex justify-between items-start">
                                <div>
                                  <p className="text-xs text-muted-foreground">Pool: {reg.poolId?.slice(0, 8)}…</p>
                                  {reg.assignedGroupId && (
                                    <p className="text-xs text-green-600">已匹配 · 分组 {reg.assignedGroupId.slice(0, 8)}…</p>
                                  )}
                                </div>
                                <div className="text-right space-y-0.5">
                                  <Badge
                                    variant={reg.matchStatus === 'matched' ? 'default' : reg.matchStatus === 'pending' ? 'secondary' : 'outline'}
                                    className="text-xs"
                                  >
                                    {reg.matchStatus || '待处理'}
                                  </Badge>
                                  {reg.matchScore != null && (
                                    <p className="text-xs text-muted-foreground">得分: {reg.matchScore}</p>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                {reg.registeredAt ? format(new Date(reg.registeredAt), "yyyy/MM/dd HH:mm") : '—'}
                              </p>
                            </div>
                          ))}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 4: Connections */}
                <TabsContent value="connections" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        互相连接
                        <Badge variant="outline" className="font-normal">{userDetail.connections.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {userDetail.connections.length === 0 ? (
                        <p className="text-sm text-muted-foreground">暂无连接记录</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.connections.map((conn) => {
                            const otherId = conn.userAId === userDetail.user.id ? conn.userBId : conn.userAId;
                            return (
                              <div key={conn.id} className="text-sm border rounded-md px-3 py-2">
                                <div className="flex justify-between items-center">
                                  <div>
                                    <p className="text-xs text-muted-foreground">对方: {otherId?.slice(0, 12)}…</p>
                                    <p className="text-xs text-muted-foreground">活动: {conn.eventId?.slice(0, 8)}…</p>
                                  </div>
                                  <div className="text-right">
                                    <Badge variant="default" className="text-xs">互相连接</Badge>
                                    {conn.revealedAt && (
                                      <p className="text-xs text-muted-foreground mt-0.5">{format(new Date(conn.revealedAt), "yyyy/MM/dd")}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 5: Match History */}
                <TabsContent value="matches" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center justify-between">
                        匹配记录
                        <Badge variant="outline" className="font-normal">{userDetail.matchHistory.length}</Badge>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      {userDetail.matchHistory.length === 0 ? (
                        <p className="text-sm text-muted-foreground">暂无匹配记录</p>
                      ) : (
                        <div className="space-y-2">
                          {userDetail.matchHistory.map((match) => {
                            const otherId = match.user1Id === userDetail.user.id ? match.user2Id : match.user1Id;
                            return (
                              <div key={match.id} className="text-sm border rounded-md px-3 py-2">
                                <div className="flex justify-between items-start">
                                  <div>
                                    <p className="text-xs text-muted-foreground">对方: {otherId?.slice(0, 12)}…</p>
                                    <p className="text-xs text-muted-foreground">活动: {match.eventId?.slice(0, 8)}…</p>
                                    {match.connectionPointTypes && (
                                      <p className="text-xs text-muted-foreground">契合类型: {Array.isArray(match.connectionPointTypes) ? match.connectionPointTypes.join(', ') : match.connectionPointTypes}</p>
                                    )}
                                  </div>
                                  <div className="text-right space-y-0.5">
                                    {match.connectionQuality != null && (
                                      <Badge variant="outline" className="text-xs">质量 {match.connectionQuality}</Badge>
                                    )}
                                    {match.wouldMeetAgain != null && (
                                      <p className="text-xs text-muted-foreground">再见意愿: {match.wouldMeetAgain ? '是' : '否'}</p>
                                    )}
                                    {match.matchedAt && (
                                      <p className="text-xs text-muted-foreground">{format(new Date(match.matchedAt), "yyyy/MM/dd")}</p>
                                    )}
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                {/* Tab 6: Matching Readiness */}
                <TabsContent value="readiness" className="mt-0 space-y-4">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm flex items-center gap-2">
                        匹配就绪状态
                        {userDetail.matchingReadiness.isReady ? (
                          <Badge className="bg-green-500 hover:bg-green-500">
                            <Zap className="h-3 w-3 mr-1" />已就绪
                          </Badge>
                        ) : (
                          <Badge variant="destructive">未就绪</Badge>
                        )}
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-1">
                      <ReadinessCheck ok={!!userDetail.onboarding.hasCompletedPersonalityTest} label="人格测试完成" />
                      <ReadinessCheck ok={!!userDetail.user.archetype} label="原型已确定" />
                      <ReadinessCheck ok={userDetail.onboarding.profileEssentialComplete} label="基本资料完整 (昵称/性别/城市)" />
                      <ReadinessCheck ok={!!userDetail.onboarding.hasCompletedInterestsCarousel} label="兴趣数据完整" />
                      <ReadinessCheck ok={!userDetail.user.isBanned} label="账号状态正常 (未被封禁)" />
                    </CardContent>
                  </Card>

                  {!userDetail.matchingReadiness.isReady && userDetail.matchingReadiness.blockers.length > 0 && (
                    <Card className="border-destructive/50 bg-destructive/5">
                      <CardHeader className="pb-2">
                        <CardTitle className="text-sm text-destructive">阻断原因</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <ul className="space-y-1 text-sm text-destructive">
                          {userDetail.matchingReadiness.blockers.map((b, i) => (
                            <li key={i} className="flex items-center gap-2">
                              <AlertCircle className="h-4 w-4 shrink-0" />
                              {b}
                            </li>
                          ))}
                        </ul>
                      </CardContent>
                    </Card>
                  )}
                </TabsContent>

              </ScrollArea>
            </Tabs>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}

