// my path:/Users/felixg/projects/JoyJoin3/client/src/pages/admin/AdminEventPoolsPage.tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Calendar, Users, Eye } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { zhCN } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ====== Form schema：简化版，只保留我们现在用得到的字段 ======
const createPoolSchema = z.object({
  title: z.string().min(1, "活动标题不能为空"),
  description: z.string().optional(),
  eventType: z.enum(["饭局", "酒局", "其他"]),
  city: z.enum(["深圳", "香港"]),
  district: z.string().min(1, "区域不能为空"),
  // 先保留时间配置，等以后真要纯常驻再改 schema
  dateTime: z.string().min(1, "请选择推荐活动时间"),
  registrationDeadline: z.string().min(1, "请选择报名截止时间"),
  minGroupSize: z.number().min(2).max(10).default(4),
  maxGroupSize: z.number().min(2).max(10).default(6),
  targetGroups: z.number().min(1).default(1),
});

interface EventPool {
  id: string;
  title: string;
  description: string | null;
  eventType: string;
  city: string;
  district: string | null;
  dateTime: string;
  registrationDeadline: string;
  status: string;
  totalRegistrations: number;
  successfulMatches: number;
  minGroupSize: number;
  maxGroupSize: number;
  targetGroups: number;
  createdAt: string;
  registrationCount?: number;
  matchedCount?: number;
  pendingCount?: number;
}

// 详情里要用到的报名记录
interface PoolRegistration {
  id: string;
  poolId: string;
  userId: string;
  budgetRange: string | null;
  preferredLanguages: string[] | null;
  socialGoals: string[] | null;
  cuisinePreferences: string[] | null;
  dietaryRestrictions: string[] | null;
  tasteIntensity: string[] | null;
  matchStatus: string;
  assignedGroupId: string | null;
  matchScore: number | null;
  registeredAt: string;
  userName: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userEmail: string | null;
  userGender: string | null;
  userAge: number | null;
  userIndustry: string | null;
  userSeniority: string | null;
  userArchetype: string | null;
}

// 详情里要用到的小组信息（一个小组 ≈ 一桌盲盒活动）
interface PoolGroupMember {
  registrationId: string;
  userId: string;
  userName: string | null;
  userFirstName: string | null;
  userLastName: string | null;
  userGender: string | null;
  userArchetype: string | null;
  userIndustry: string | null;
  matchScore: number | null;
}

interface PoolGroup {
  id: string;
  poolId: string;
  groupNumber: number;
  status: string | null;
  createdAt: string;
  updatedAt?: string;
  members: PoolGroupMember[];
}

// 用来做「后端 status + 业务状态」的 badge
const RAW_STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "招募中", variant: "secondary" },
  cancelled: { label: "已取消", variant: "destructive" },
  archived: { label: "已关闭", variant: "outline" },
};

// 城市 -> 区域下拉选项（要和前端发现页保持一致）
const CITY_DISTRICTS: Record<"深圳" | "香港", string[]> = {
  深圳: [
    "南山区",
    "福田区",
    "罗湖区",
    "宝安区",
    "龙华区",
    "龙岗区",
    "盐田区",
    "光明区",
    "坪山区",
    "大鹏新区",
  ],
  香港: [
    "中环",
    "湾仔",
    "尖沙咀",
    "铜锣湾",
    "观塘",
    "葵涌",
    "沙田",
    "将军澳",
    "荃湾",
    "元朗",
  ],
};

type CityFilter = "all" | "深圳" | "香港";
type WaitingFilter = "all" | "hasWaiting" | "noWaiting";
type EventsFilter = "all" | "hasEvents" | "noEvents";

export default function AdminEventPoolsPage() {
  // ====== 过滤状态 ======
  const [cityFilter, setCityFilter] = useState<CityFilter>("all");
  const [waitingFilter, setWaitingFilter] = useState<WaitingFilter>("all");
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>("all");

  // 创建 / 详情弹窗
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [selectedPool, setSelectedPool] = useState<EventPool | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);

  const { toast } = useToast();

  // 活动池列表
  const { data: pools = [], isLoading } = useQuery<EventPool[]>({
    queryKey: ["/api/admin/event-pools"],
  });

  // 创建表单
  const form = useForm({
    resolver: zodResolver(createPoolSchema),
    defaultValues: {
      title: "",
      description: "",
      eventType: "饭局" as const,
      city: "深圳" as const,
      district: "",
      dateTime: "",
      registrationDeadline: "",
      minGroupSize: 4,
      maxGroupSize: 6,
      targetGroups: 1,
    },
  });

  const currentCity = form.watch("city") as "深圳" | "香港";
  const currentCityDistricts = CITY_DISTRICTS[currentCity] ?? [];

  // 选中池子的报名情况
  const {
    data: registrations = [],
    isLoading: isLoadingRegistrations,
  } = useQuery<PoolRegistration[]>({
    queryKey: ["/api/admin/event-pools", selectedPool?.id, "registrations"],
    enabled: !!selectedPool,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/event-pools/${selectedPool!.id}/registrations`,
      );
      // 兼容后端可能返回 { registrations: [...] } 或直接返回数组
      if (Array.isArray(res)) return res as PoolRegistration[];
      if (res && Array.isArray((res as any).registrations)) {
        return (res as any).registrations as PoolRegistration[];
      }
      return [];
    },
  });

  // 选中池子的分组 / 已成局桌子
  const { data: groups = [], isLoading: isLoadingGroups } =
    useQuery<PoolGroup[]>({
      queryKey: ["/api/admin/event-pools", selectedPool?.id, "groups"],
      enabled: !!selectedPool,
      queryFn: async () => {
        const res = await apiRequest(
          "GET",
          `/api/admin/event-pools/${selectedPool!.id}/groups`,
        );
        // 兼容数组或 { groups: [...] }
        if (Array.isArray(res)) return res as PoolGroup[];
        if (res && Array.isArray((res as any).groups)) {
          return (res as any).groups as PoolGroup[];
        }
        return [];
      },
    });

  const safeRegistrations = Array.isArray(registrations)
    ? registrations
    : [];
  const safeGroups = Array.isArray(groups) ? groups : [];

  const createPoolMutation = useMutation({
    mutationFn: (data: any) =>
      apiRequest("POST", "/api/admin/event-pools", data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools"] });
      setShowCreateDialog(false);
      form.reset();
      toast({
        title: "创建成功",
        description: "活动池已创建，等待用户报名",
      });
    },
    onError: (error: any) => {
      console.error("Error creating event pool:", error);
      toast({
        title: "创建失败",
        description: error?.message || "无法创建活动池，请重试",
        variant: "destructive",
      });
    },
  });

  const onSubmit = (data: any) => {
    const payload = {
      ...data,
      // 确保数字字段真的是 number
      minGroupSize: Number(data.minGroupSize) || 4,
      maxGroupSize: Number(data.maxGroupSize) || 6,
      targetGroups: Number(data.targetGroups) || 1,
    };
    createPoolMutation.mutate(payload);
  };

  const handleViewDetails = (pool: EventPool) => {
    setSelectedPool(pool);
    setShowDetailsDialog(true);
  };

  // ====== 派生数据：根据报名情况算业务状态 ======
  const poolsWithFlags = pools.map((pool) => {
    const pending = pool.pendingCount ?? 0;
    const matched = pool.matchedCount ?? 0;
    const successfulMatches = pool.successfulMatches ?? 0;

    const hasWaiting = pending > 0;
    const hasEvents = matched > 0 || successfulMatches > 0;

    return {
      ...pool,
      _hasWaiting: hasWaiting,
      _hasEvents: hasEvents,
    };
  });

  const totalPools = poolsWithFlags.length;
  const activePools = poolsWithFlags.filter((p) => p.status === "active").length;
  const poolsWithWaiting = poolsWithFlags.filter((p) => p._hasWaiting).length;
  const poolsWithEvents = poolsWithFlags.filter((p) => p._hasEvents).length;

  const filteredPools = poolsWithFlags.filter((pool) => {
    if (cityFilter !== "all" && pool.city !== cityFilter) return false;

    if (waitingFilter === "hasWaiting" && !pool._hasWaiting) return false;
    if (waitingFilter === "noWaiting" && pool._hasWaiting) return false;

    if (eventsFilter === "hasEvents" && !pool._hasEvents) return false;
    if (eventsFilter === "noEvents" && pool._hasEvents) return false;

    return true;
  });

  const formatDateTime = (dateTimeStr: string) => {
    try {
      const date = new Date(dateTimeStr);
      return format(date, "yyyy年MM月dd日 HH:mm", { locale: zhCN });
    } catch {
      return dateTimeStr;
    }
  };

  // 根据池子状态 + 有无人 / 有无活动，生成对人友好的标签
  const getBusinessStatus = (pool: {
    status: string;
    _hasWaiting: boolean;
    _hasEvents: boolean;
  }) => {
    if (pool.status !== "active") {
      const raw = RAW_STATUS_LABEL[pool.status];
      if (raw) return raw;
      return { label: pool.status, variant: "outline" as const };
    }

    if (pool._hasEvents) {
      return { label: "有成局", variant: "default" as const };
    }

    if (pool._hasWaiting) {
      return { label: "有人等待", variant: "secondary" as const };
    }

    return { label: "暂时无人报名", variant: "outline" as const };
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="space-y-6">
          <div className="grid gap-4 md:grid-cols-4">
            {[1, 2, 3, 4].map((i) => (
              <Card key={i}>
                <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium">
                    加载中...
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">--</div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ====== 渲染 ======
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between gap-1">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">活动池管理</h1>
          <p className="text-muted-foreground text-sm">
            按城市 / 区 / 活动类型划分的「常驻池」，用于集中招募用户，方便后续从池子里“捞人”成局。
          </p>
        </div>
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button data-testid="button-create-pool">
              <Calendar className="mr-2 h-4 w-4" />
              创建活动池
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>创建新活动池</DialogTitle>
            </DialogHeader>
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-4"
              >
                {/* 基本信息 */}
                <FormField
                  control={form.control}
                  name="title"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>活动标题 *</FormLabel>
                      <FormControl>
                        <Input
                          placeholder="例如：深圳·南山 饭局常驻池"
                          {...field}
                          data-testid="input-title"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>活动池介绍</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="向运营/自己解释一下这个池子的定位（可选）"
                          {...field}
                          data-testid="textarea-description"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="eventType"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>活动类型 *</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-event-type">
                              <SelectValue placeholder="选择类型" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="饭局">饭局</SelectItem>
                            <SelectItem value="酒局">酒局</SelectItem>
                            <SelectItem value="其他">其他</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="city"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>城市 *</FormLabel>
                        <Select
                          onValueChange={(value) => {
                            field.onChange(value);
                            // 城市切换时重置区，避免「城市=香港 区=南山」这种组合
                            form.setValue("district", "");
                          }}
                          defaultValue={field.value}
                        >
                          <FormControl>
                            <SelectTrigger data-testid="select-city">
                              <SelectValue placeholder="选择城市" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="深圳">深圳</SelectItem>
                            <SelectItem value="香港">香港</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="district"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>区域 *</FormLabel>
                      <Select
                        value={field.value}
                        onValueChange={field.onChange}
                      >
                        <FormControl>
                          <SelectTrigger data-testid="select-district">
                            <SelectValue placeholder="选择区域" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {currentCityDistricts.map((d) => (
                            <SelectItem key={d} value={d}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="dateTime"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>推荐活动时间 *</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            data-testid="input-datetime"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="registrationDeadline"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>报名截止时间 *</FormLabel>
                        <FormControl>
                          <Input
                            type="datetime-local"
                            {...field}
                            data-testid="input-deadline"
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* 组局配置 */}
                <div className="border-t pt-4 mt-4">
                  <h3 className="font-semibold mb-3">组局配置</h3>
                  <div className="grid grid-cols-3 gap-4">
                    <FormField
                      control={form.control}
                      name="minGroupSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>最小人数 *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={2}
                              max={10}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value || "4"))
                              }
                              data-testid="input-min-size"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="maxGroupSize"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>最大人数 *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={2}
                              max={10}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value || "6"))
                              }
                              data-testid="input-max-size"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />

                    <FormField
                      control={form.control}
                      name="targetGroups"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>目标组数 *</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(e) =>
                                field.onChange(parseInt(e.target.value || "1"))
                              }
                              data-testid="input-target-groups"
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </div>
                </div>

                <DialogFooter>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowCreateDialog(false)}
                  >
                    取消
                  </Button>
                  <Button
                    type="submit"
                    disabled={createPoolMutation.isPending}
                    data-testid="button-submit-pool"
                  >
                    {createPoolMutation.isPending ? "创建中..." : "创建活动池"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* 顶部指标：总数 / 招募中 / 有等待 / 有成局 */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card data-testid="metric-total">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">总活动池数</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalPools}</div>
          </CardContent>
        </Card>

        <Card data-testid="metric-active">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">招募中池子</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{activePools}</div>
          </CardContent>
        </Card>

        <Card data-testid="metric-waiting">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              有人等待报名的池
            </CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{poolsWithWaiting}</div>
          </CardContent>
        </Card>

        <Card data-testid="metric-with-events">
          <CardHeader className="flex flex-row items-center justify-between gap-1 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">
              已有成局/小组的池
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{poolsWithEvents}</div>
          </CardContent>
        </Card>
      </div>

      {/* 筛选区域：城市 / 是否有人在等 / 是否有成局 */}
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium">筛选条件</CardTitle>
          <CardDescription className="text-xs">
            通过城市 + 是否有等待报名 + 是否已有成局来筛活动池。
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap gap-3">
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">城市</span>
            <Select
              value={cityFilter}
              onValueChange={(v) => setCityFilter(v as CityFilter)}
            >
              <SelectTrigger className="h-8 w-[120px] text-xs">
                <SelectValue placeholder="全部城市" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部城市</SelectItem>
                <SelectItem value="深圳">深圳</SelectItem>
                <SelectItem value="香港">香港</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              池子里是否有人在等
            </span>
            <Select
              value={waitingFilter}
              onValueChange={(v) => setWaitingFilter(v as WaitingFilter)}
            >
              <SelectTrigger className="h-8 w-[150px] text-xs">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="hasWaiting">只看有人等待</SelectItem>
                <SelectItem value="noWaiting">只看没人等待</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              池子里是否已有成局
            </span>
            <Select
              value={eventsFilter}
              onValueChange={(v) => setEventsFilter(v as EventsFilter)}
            >
              <SelectTrigger className="h-8 w-[160px] text-xs">
                <SelectValue placeholder="全部" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">全部</SelectItem>
                <SelectItem value="hasEvents">只看有成局</SelectItem>
                <SelectItem value="noEvents">只看还没成局</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {/* 活动池列表 */}
      <div className="grid gap-4">
        {filteredPools.length === 0 ? (
          <Card>
            <CardContent className="py-10 text-center text-muted-foreground text-sm">
              暂无符合条件的活动池
            </CardContent>
          </Card>
        ) : (
          filteredPools.map((pool) => {
            const statusBadge = getBusinessStatus(pool);
            const totalReg =
              pool.registrationCount ?? pool.totalRegistrations ?? 0;
            const matched = pool.matchedCount ?? pool.successfulMatches ?? 0;
            const pending = pool.pendingCount ?? 0;

            return (
              <Card key={pool.id} data-testid={`pool-card-${pool.id}`}>
                <CardHeader>
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <CardTitle className="flex items-center gap-2">
                        {pool.title}
                        <Badge variant={statusBadge.variant}>
                          {statusBadge.label}
                        </Badge>
                      </CardTitle>
                      <CardDescription className="mt-2 text-xs">
                        {pool.description || "无描述"}
                      </CardDescription>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">活动类型</div>
                      <div className="font-medium">{pool.eventType}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">地点</div>
                      <div className="font-medium">
                        {pool.city}
                        {pool.district ? ` · ${pool.district}` : ""}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">推荐时间</div>
                      <div className="font-medium">
                        {formatDateTime(pool.dateTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">报名截止</div>
                      <div className="font-medium">
                        {formatDateTime(pool.registrationDeadline)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Users className="h-4 w-4" />
                      <span>总报名: {totalReg}</span>
                    </div>
                    <div className="text-muted-foreground">
                      已匹配/已成局: {matched}，待匹配: {pending}
                    </div>
                    <div className="text-muted-foreground">
                      目标: {pool.targetGroups} 组（
                      {pool.minGroupSize}-{pool.maxGroupSize} 人/组）
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleViewDetails(pool)}
                      data-testid={`button-view-${pool.id}`}
                    >
                      <Eye className="h-4 w-4 mr-1" />
                      查看详情 / 池内用户
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* 详情弹窗：池内报名 + 已分组小组 */}
      <Dialog open={showDetailsDialog} onOpenChange={setShowDetailsDialog}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedPool?.title} — 池内情况</DialogTitle>
          </DialogHeader>

          {!selectedPool ? (
            <div className="py-8 text-center text-sm text-muted-foreground">
              未选择活动池
            </div>
          ) : (
            <div className="space-y-6 text-sm">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-muted-foreground">城市 / 区域</div>
                  <div className="font-medium">
                    {selectedPool.city}
                    {selectedPool.district ? ` · ${selectedPool.district}` : ""}
                  </div>
                </div>
                <div>
                  <div className="text-muted-foreground">创建时间</div>
                  <div>
                    {selectedPool.createdAt &&
                      formatDateTime(selectedPool.createdAt)}
                  </div>
                </div>
              </div>

              {/* 报名情况 */}
              <div className="border-t pt-4 space-y-3">
                <h3 className="font-semibold">池中报名用户</h3>
                <div className="text-xs text-muted-foreground">
                  总报名：{selectedPool.registrationCount ?? 0}，已匹配：
                  {selectedPool.matchedCount ?? 0}，待匹配：
                  {selectedPool.pendingCount ?? 0}
                </div>

                {isLoadingRegistrations ? (
                  <div className="py-4 text-xs text-muted-foreground">
                    正在加载报名列表...
                  </div>
                ) : safeRegistrations.length === 0 ? (
                  <div className="py-4 text-xs text-muted-foreground">
                    当前池子里还没有任何报名用户。
                  </div>
                ) : (
                  <div className="space-y-2">
                    {safeRegistrations.map((reg) => (
                      <div
                        key={reg.id}
                        className="rounded-md border px-3 py-2 flex flex-col gap-1"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className="font-medium">
                            {reg.userName ||
                              `${reg.userFirstName ?? ""} ${
                                reg.userLastName ?? ""
                              }`.trim() ||
                              "匿名用户"}
                          </div>
                          <Badge
                            variant={
                              reg.matchStatus === "pending"
                                ? "secondary"
                                : reg.matchStatus === "matched"
                                ? "default"
                                : "outline"
                            }
                          >
                            {reg.matchStatus === "pending"
                              ? "等待匹配"
                              : reg.matchStatus === "matched"
                              ? "已分配小组"
                              : reg.matchStatus}
                          </Badge>
                        </div>
                        <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                          {reg.userGender && <span>性别：{reg.userGender}</span>}
                          {reg.userAge && <span>年龄：{reg.userAge}</span>}
                          {reg.userIndustry && (
                            <span>行业：{reg.userIndustry}</span>
                          )}
                          {reg.userSeniority && (
                            <span>职级：{reg.userSeniority}</span>
                          )}
                          {reg.userArchetype && (
                            <span>人设：{reg.userArchetype}</span>
                          )}
                          {reg.budgetRange && (
                            <span>预算：{reg.budgetRange}</span>
                          )}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          报名时间：{formatDateTime(reg.registeredAt)}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 小组 / 成局情况 */}
              <div className="border-t pt-4 space-y-3">
                <h3 className="font-semibold">已有小组 / 盲盒活动</h3>
                <p className="text-xs text-muted-foreground">
                  每个小组基本对应一桌盲盒活动，详细的活动信息会在「盲盒活动管理」页面查看。
                </p>

                {isLoadingGroups ? (
                  <div className="py-4 text-xs text-muted-foreground">
                    正在加载小组信息...
                  </div>
                ) : safeGroups.length === 0 ? (
                  <div className="py-4 text-xs text-muted-foreground">
                    目前这个池子还没有任何成组记录。
                  </div>
                ) : (
                  <div className="space-y-3">
                    {safeGroups.map((group) => (
                      <div
                        key={group.id}
                        className="rounded-md border px-3 py-2 text-xs"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <div className="font-medium">
                            第 {group.groupNumber} 组 · 共{" "}
                            {group.members.length} 人
                          </div>
                          {group.status && (
                            <Badge variant="outline">{group.status}</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {group.members.map((m) => (
                            <span
                              key={m.registrationId}
                              className="rounded bg-muted px-2 py-1"
                            >
                              {m.userName ||
                                `${m.userFirstName ?? ""} ${
                                  m.userLastName ?? ""
                                }`.trim() ||
                                "匿名用户"}
                              {m.userArchetype
                                ? ` · ${m.userArchetype}`
                                : ""}
                            </span>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="border-t pt-4 text-[11px] text-muted-foreground">
                提示：这里只负责展示这个池子里有哪些人、已经开了哪些组。
                真正的桌子详情和状态管理在「盲盒活动管理」页面完成，避免功能重叠。
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}