// my path:/Users/felixg/projects/JoyJoin3/client/src/pages/admin/AdminEventPoolsPage.tsx
import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
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
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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

import { Users, Eye, MapPin, Clock, Store, Copy, Check, Pencil, UserPlus, ChevronDown } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import EventPoolCreateDialog from "./EventPoolCreateDialog";
import EventPoolMetrics from "./EventPoolMetrics";
import EventPoolFilters from "./EventPoolFilters";
import type {
  CityFilter,
  WaitingFilter,
  EventsFilter,
  SortOption,
  AdminEventPool,
  AdminPoolRegistration,
  PoolGroup,
  PoolGroupMember,
  PairScoreEntry,
} from "./types";
import { fmtDateTime, fmtDateTimeLocal, safeFormat } from "@/lib/dateUtils";
import { CITY_DISTRICTS } from "@/lib/cityDistricts";
import { zhCN } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";

// ====== Form schema：简化版，只保留我们现在用得到的字段 ======

const createPoolSchema = z
  .object({
    title: z.string().min(1, "活动标题不能为空"),
    description: z.string().optional(),
    eventType: z.enum(["饭局", "酒局", "其他"]),
    city: z.enum(["深圳", "香港"]),
    district: z.string().min(1, "区域不能为空"),
    dateTime: z.string().min(1, "请选择推荐活动时间"),
    registrationDeadline: z.string().min(1, "请选择报名截止时间"),
    minGroupSize: z.number().min(2).max(10).default(4),
    maxGroupSize: z.number().min(2).max(10).default(6),
    targetGroups: z.number().min(1).default(1),
  })
  .refine(
    (data) => {
      if (!data.dateTime || !data.registrationDeadline) return true;
      return new Date(data.dateTime) > new Date(data.registrationDeadline);
    },
    {
      message: "活动时间必须晚于报名截止时间",
      path: ["dateTime"],
    }
  );

// 用来做「后端 status + 业务状态」的 badge
const RAW_STATUS_LABEL: Record<
  string,
  { label: string; variant: "default" | "secondary" | "destructive" | "outline" }
> = {
  active: { label: "招募中", variant: "secondary" },
  cancelled: { label: "已取消", variant: "destructive" },
  archived: { label: "已关闭", variant: "outline" },
};

// Capacity fill thresholds for visual indicator
const FILL_THRESHOLD_GREEN = 80;   // >= 80% fill is healthy (green)
const FILL_THRESHOLD_AMBER = 50;   // >= 50% fill is moderate (amber), < 50% is low (red)

// Match score color thresholds
const MATCH_SCORE_GREEN = 80;
const MATCH_SCORE_AMBER = 60;

const REASON_LABELS: Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }> = {
  budget_mismatch: { label: "预算不匹配", variant: "destructive" },
  capacity_insufficient: { label: "容量不足", variant: "destructive" },
  no_available_slots: { label: "无可用时段", variant: "outline" },
  slot_fully_booked_at_save: { label: "时段已满", variant: "outline" },
  no_suitable_venue: { label: "无合适场地", variant: "outline" },
};

function ReasonBadge({ reason }: { reason: string }) {
  const config = REASON_LABELS[reason] || { label: reason, variant: "outline" as const };
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}

export default function AdminEventPoolsPage() {
  // ====== 过滤状态 ======
  const [cityFilter, setCityFilter] = useState<CityFilter>("all");
  const [waitingFilter, setWaitingFilter] = useState<WaitingFilter>("all");
  const [eventsFilter, setEventsFilter] = useState<EventsFilter>("all");
  const [sortBy, setSortBy] = useState<SortOption>("newest");

  // 创建 / 编辑 / 详情弹窗
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingPoolId, setEditingPoolId] = useState<string | null>(null);
  const [selectedPool, setSelectedPool] = useState<AdminEventPool | null>(null);
  const [showDetailsDialog, setShowDetailsDialog] = useState(false);
  const [copiedPoolId, setCopiedPoolId] = useState<string | null>(null);
  // 手动添加用户弹出层
  const [addMemberGroupId, setAddMemberGroupId] = useState<string | null>(null);

  const { toast } = useToast();

  // 活动池列表
  const { data: pools = [], isLoading } = useQuery<AdminEventPool[]>({
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
  const currentDistrict = form.watch("district");
  const currentDateTime = form.watch("dateTime");
  const currentCityDistricts = CITY_DISTRICTS[currentCity] ?? [];

  // 选中池子的报名情况
  const {
    data: registrations = [],
    isLoading: isLoadingRegistrations,
  } = useQuery<AdminPoolRegistration[]>({
    queryKey: ["/api/admin/event-pools", selectedPool?.id, "registrations"],
    enabled: !!selectedPool,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/event-pools/${selectedPool!.id}/registrations`,
      );
      const data = await res.json();
      // 兼容后端可能返回 { registrations: [...] } 或直接返回数组
      if (Array.isArray(data)) return data as AdminPoolRegistration[];
      if (data && Array.isArray(data.registrations)) {
        return data.registrations as AdminPoolRegistration[];
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
        const data = await res.json();
        // 兼容数组或 { groups: [...] }
        if (Array.isArray(data)) return data as PoolGroup[];
        if (data && Array.isArray(data.groups)) {
          return data.groups as PoolGroup[];
        }
        return [];
      },
    });

  const { data: pairScores = [] } = useQuery<PairScoreEntry[]>({
    queryKey: ["/api/admin/event-pools", selectedPool?.id, "pair-scores"],
    enabled: !!selectedPool,
    queryFn: async () => {
      try {
        return await apiRequest(
          "GET",
          `/api/admin/event-pools/${selectedPool!.id}/pair-scores`,
        ).then(async (res) => {
          const data = await res.json();
          return Array.isArray(data) ? data : [];
        });
      } catch {
        return [];
      }
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
      setEditingPoolId(null);
      form.reset();
      toast({
        title: "创建成功",
        description: "活动池已创建，等待用户报名",
      });
    },
    onError: (error: any) => {
      console.error("Error creating event pool:", error);
      let description = "无法创建活动池，请重试";
      if (error?.message) {
        // apiRequest throws: "401: {\"message\":\"...\",\"error\":\"...\"}"
        const jsonMatch = error.message.match(/\{.*\}/s);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            // Prefer detailed error over generic message
            description = parsed.error || parsed.message || description;
          } catch {
            description = error.message;
          }
        } else {
          description = error.message;
        }
      }
      toast({
        title: "创建失败",
        description,
        variant: "destructive",
      });
    },
  });

  const updatePoolMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) =>
      apiRequest("PATCH", `/api/admin/event-pools/${id}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/event-pools"] });
      setShowCreateDialog(false);
      setEditingPoolId(null);
      form.reset();
      toast({
        title: "更新成功",
        description: "活动池信息已更新",
      });
    },
    onError: (error: any) => {
      console.error("Error updating event pool:", error);
      let description = "无法更新活动池，请重试";
      if (error?.message) {
        const jsonMatch = error.message.match(/\{.*\}/s);
        if (jsonMatch) {
          try {
            const parsed = JSON.parse(jsonMatch[0]);
            description = parsed.error || parsed.message || description;
          } catch {
            description = error.message;
          }
        } else {
          description = error.message;
        }
      }
      toast({
        title: "更新失败",
        description,
        variant: "destructive",
      });
    },
  });
  // solve the problem of invalid update payload 
  const toIsoDateTime = (value?: string) => {
    if (!value) return value;
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toISOString();
  };

  const onSubmit = (data: any) => {
    // consist the formate of the month date year formate
    const payload = {
      ...data,
      dateTime: toIsoDateTime(data.dateTime),
      registrationDeadline: toIsoDateTime(data.registrationDeadline),
      minGroupSize: Number(data.minGroupSize) || 4,
      maxGroupSize: Number(data.maxGroupSize) || 6,
      targetGroups: Number(data.targetGroups) || 1,
    };
    
    if (editingPoolId) {
      updatePoolMutation.mutate({ id: editingPoolId, data: payload });
    } else {
      createPoolMutation.mutate(payload);
    }
  };

  // 手动添加用户到小组
  const addMemberMutation = useMutation({
    mutationFn: ({ poolId, groupId, registrationId }: { poolId: string; groupId: string; registrationId: string }) =>
      apiRequest("POST", `/api/admin/event-pools/${poolId}/groups/${groupId}/add-member`, { registrationId }),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools", variables.poolId, "registrations"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools", variables.poolId, "groups"] });
      setAddMemberGroupId(null);
      toast({ title: "添加成功", description: "用户已加入小组" });
    },
    onError: () => {
      toast({ title: "该功能即将上线", description: "手动添加用户功能暂未开放，敬请期待", variant: "destructive" });
    },
  });

  const handleViewDetails = (pool: AdminEventPool) => {
    setSelectedPool(pool);
    setShowDetailsDialog(true);
  };

  const handleEditPool = (pool: AdminEventPool) => {
    form.reset({
      title: pool.title,
      description: pool.description || "",
      eventType: pool.eventType as any,
      city: pool.city as any,
      district: pool.district || "",
      dateTime: fmtDateTimeLocal(pool.dateTime),
      registrationDeadline: fmtDateTimeLocal(pool.registrationDeadline),
      minGroupSize: pool.minGroupSize,
      maxGroupSize: pool.maxGroupSize,
      targetGroups: pool.targetGroups,
    });
    setEditingPoolId(pool.id);
    setShowCreateDialog(true);
  };

  const handleCloseDialog = (open: boolean) => {
    if (!open) {
      setEditingPoolId(null);
      form.reset();
    }
    setShowCreateDialog(open);
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

  const filteredPools = poolsWithFlags
    .filter((pool) => {
      if (cityFilter !== "all" && pool.city !== cityFilter) return false;
      if (waitingFilter === "hasWaiting" && !pool._hasWaiting) return false;
      if (waitingFilter === "noWaiting" && pool._hasWaiting) return false;
      if (eventsFilter === "hasEvents" && !pool._hasEvents) return false;
      if (eventsFilter === "noEvents" && pool._hasEvents) return false;
      return true;
    })
    .sort((a, b) => {
      const time = (d: string | undefined) => {
        const t = d ? new Date(d).getTime() : 0;
        return Number.isNaN(t) ? 0 : t;
      };
      switch (sortBy) {
        case "newest":
          return time(b.createdAt) - time(a.createdAt);
        case "oldest":
          return time(a.createdAt) - time(b.createdAt);
        case "title":
          return (a.title || "").localeCompare(b.title || "");
        case "mostRegistrations":
          return (b.registrationCount ?? 0) - (a.registrationCount ?? 0);
        case "mostMatched":
          return (b.matchedCount ?? 0) - (a.matchedCount ?? 0);
        default:
          return 0;
      }
    });

  const formatDateTime = (dateTimeStr: string) =>
    safeFormat(dateTimeStr, "yyyy年MM月dd日 HH:mm", { locale: zhCN, fallback: dateTimeStr });

  const handleCopyPool = (pool: AdminEventPool) => {
    // 快速复制：将池子信息填充到表单
    form.reset({
      title: `${pool.title} (副本)`,
      description: pool.description || "",
      eventType: pool.eventType as any,
      city: pool.city as any,
      district: pool.district || "",
      dateTime: pool.dateTime,
      registrationDeadline: pool.registrationDeadline,
      minGroupSize: pool.minGroupSize,
      maxGroupSize: pool.maxGroupSize,
      targetGroups: pool.targetGroups,
    });
    setShowCreateDialog(true);
    setCopiedPoolId(pool.id);
    
    toast({
      title: "已复制池配置",
      description: "编辑后点击创建即可生成新池",
    });
    
    setTimeout(() => setCopiedPoolId(null), 2000);
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
        <EventPoolCreateDialog
        open={showCreateDialog}
        onOpenChange={handleCloseDialog}
        editingPoolId={editingPoolId}
        setEditingPoolId={setEditingPoolId}
        form={form}
        onSubmit={onSubmit}
        createPoolMutation={createPoolMutation}
        updatePoolMutation={updatePoolMutation}
      />
      </div>

      {/* 顶部指标：总数 / 招募中 / 有等待 / 有成局 */}
      <EventPoolMetrics
        totalPools={totalPools}
        activePools={activePools}
        poolsWithWaiting={poolsWithWaiting}
        poolsWithEvents={poolsWithEvents}
      />

      <EventPoolFilters
        cityFilter={cityFilter}
        setCityFilter={setCityFilter}
        waitingFilter={waitingFilter}
        setWaitingFilter={setWaitingFilter}
        eventsFilter={eventsFilter}
        setEventsFilter={setEventsFilter}
        sortBy={sortBy}
        setSortBy={setSortBy}
      />

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
                      查看详情
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditPool(pool)}
                      data-testid={`button-edit-${pool.id}`}
                    >
                      <Pencil className="h-4 w-4 mr-1" />
                      编辑
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleCopyPool(pool)}
                      data-testid={`button-copy-${pool.id}`}
                    >
                      {copiedPoolId === pool.id ? (
                        <>
                          <Check className="h-4 w-4 mr-1" />
                          已复制
                        </>
                      ) : (
                        <>
                          <Copy className="h-4 w-4 mr-1" />
                          复制
                        </>
                      )}
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
                          <div className="flex items-center gap-2">
                            {reg.matchScore !== null && reg.matchScore !== undefined && (
                              <Badge
                                variant="outline"
                                className={`text-xs ${reg.matchScore >= MATCH_SCORE_GREEN ? 'text-green-700 border-green-300' : reg.matchScore >= MATCH_SCORE_AMBER ? 'text-amber-700 border-amber-300' : 'text-red-700 border-red-300'}`}
                              >
                                匹配分: {reg.matchScore}
                              </Badge>
                            )}
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
                    {safeGroups.map((group, groupIdx) => {
                      const maxSize = selectedPool?.maxGroupSize ?? 6;
                      const fillPercent = maxSize > 0 ? Math.min(100, (group.members.length / maxSize) * 100) : 0;
                      const vacantSeats = Math.max(0, maxSize - group.members.length);
                      // Pending registrations not yet in any group
                      const pendingUnassigned = safeRegistrations.filter(
                        r => (r.matchStatus === "pending" || r.matchStatus === "等待匹配") && !r.assignedGroupId
                      );
                      return (
                        <div
                          key={group.id}
                          className="rounded-md border px-3 py-2 text-xs"
                        >
                          <div className="flex items-center justify-between mb-1">
                            <div className="font-medium">
                              第 {group.groupNumber} 组 · 共{" "}
                              {group.members.length} 人
                            </div>
                            <div className="flex items-center gap-2">
                              {group.status && (
                                <Badge variant="outline">{group.status}</Badge>
                              )}
                              {/* 手动添加用户按钮 */}
                              <Popover
                                open={addMemberGroupId === group.id}
                                onOpenChange={(open) => setAddMemberGroupId(open ? group.id : null)}
                              >
                                <PopoverTrigger asChild>
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 text-xs gap-1"
                                    data-testid={`button-add-member-${groupIdx}`}
                                  >
                                    <UserPlus className="h-3 w-3" />
                                    手动添加用户
                                    <ChevronDown className="h-3 w-3" />
                                  </Button>
                                </PopoverTrigger>
                                <PopoverContent className="w-72 p-2" align="end">
                                  <div className="text-xs font-medium mb-2 text-muted-foreground">
                                    从等待中用户选择加入此组
                                  </div>
                                  {pendingUnassigned.length === 0 ? (
                                    <div className="text-xs text-muted-foreground py-2 text-center">
                                      暂无等待匹配的用户
                                    </div>
                                  ) : (
                                    <div className="space-y-1 max-h-48 overflow-y-auto">
                                      {pendingUnassigned.map((reg) => (
                                        <Button
                                          key={reg.id}
                                          variant="ghost"
                                          className="w-full justify-between h-auto px-2 py-1.5 font-normal"
                                          onClick={() => {
                                            addMemberMutation.mutate({
                                              poolId: selectedPool!.id,
                                              groupId: group.id,
                                              registrationId: reg.id,
                                            });
                                          }}
                                        >
                                          <span className="font-medium truncate text-left">
                                            {reg.userName || `${reg.userFirstName ?? ""} ${reg.userLastName ?? ""}`.trim() || "匿名用户"}
                                          </span>
                                          <div className="flex items-center gap-1 shrink-0">
                                            {reg.userArchetype && (
                                              <Badge variant="outline" className="text-[10px] h-4">{reg.userArchetype}</Badge>
                                            )}
                                            {reg.matchScore !== null && reg.matchScore !== undefined && (
                                              <Badge
                                                variant="outline"
                                                className={`text-[10px] h-4 ${reg.matchScore >= MATCH_SCORE_GREEN ? 'text-green-700' : reg.matchScore >= MATCH_SCORE_AMBER ? 'text-amber-700' : 'text-red-700'}`}
                                              >
                                                {reg.matchScore}
                                              </Badge>
                                            )}
                                          </div>
                                        </Button>
                                      ))}
                                    </div>
                                  )}
                                </PopoverContent>
                              </Popover>
                            </div>
                          </div>

                          {/* 容量填充条 */}
                          <div className="mb-2">
                            <div className="w-full bg-muted rounded-full h-2">
                              <div
                                className={`h-2 rounded-full ${fillPercent >= FILL_THRESHOLD_GREEN ? 'bg-green-500' : fillPercent >= FILL_THRESHOLD_AMBER ? 'bg-amber-500' : 'bg-red-500'}`}
                                style={{ width: `${fillPercent}%` }}
                              />
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {group.members.length}/{maxSize} 人
                              {vacantSeats > 0 && <span className="text-amber-600 ml-1">({vacantSeats} 空位)</span>}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-2">
                            {group.members.map((m) => (
                              <span
                                key={m.registrationId}
                                className="rounded bg-muted px-2 py-1 flex items-center gap-1"
                              >
                                {m.userName ||
                                  `${m.userFirstName ?? ""} ${
                                    m.userLastName ?? ""
                                  }`.trim() ||
                                  "匿名用户"}
                                {m.userArchetype
                                  ? ` · ${m.userArchetype}`
                                  : ""}
                                {m.matchScore !== null && m.matchScore !== undefined && (
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] h-4 ml-1 ${m.matchScore >= MATCH_SCORE_GREEN ? 'text-green-700 border-green-300' : m.matchScore >= MATCH_SCORE_AMBER ? 'text-amber-700 border-amber-300' : 'text-red-700 border-red-300'}`}
                                  >
                                    {m.matchScore}
                                  </Badge>
                                )}
                              </span>
                            ))}
                          </div>
                          
                          {/* Venue Assignment Display */}
                          {group.venueName ? (
                            <div className="mt-2 pt-2 border-t">
                              <div className="flex items-center gap-2">
                                <Store className="h-3 w-3 text-muted-foreground" />
                                <span className="font-medium text-green-600">
                                  已分配: {group.venueName}
                                </span>
                              </div>
                              {group.venueAddress && (
                                <div className="flex items-center gap-2 mt-1 text-muted-foreground">
                                  <MapPin className="h-3 w-3" />
                                  <span className="text-xs">{group.venueAddress}</span>
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-2 pt-2 border-t">
                              <div className="flex items-center gap-2 flex-wrap">
                                <Badge variant="secondary" className="text-xs">
                                  未分配场地
                                </Badge>
                                {group.venueAssignmentReason && (
                                  <ReasonBadge reason={group.venueAssignmentReason} />
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Pair Scores Matrix */}
              {pairScores.length > 0 && (
                <div className="space-y-3">
                  <h3 className="font-semibold">匹配质量矩阵</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border rounded-md">
                      <thead>
                        <tr className="bg-muted">
                          <th className="px-3 py-2 text-left font-medium">组号</th>
                          <th className="px-3 py-2 text-center font-medium">人数</th>
                          <th className="px-3 py-2 text-center font-medium">化学分</th>
                          <th className="px-3 py-2 text-center font-medium">多样性</th>
                          <th className="px-3 py-2 text-center font-medium">沟通平衡</th>
                          <th className="px-3 py-2 text-center font-medium">性别平衡</th>
                          <th className="px-3 py-2 text-center font-medium">总分</th>
                          <th className="px-3 py-2 text-center font-medium">温度</th>
                        </tr>
                      </thead>
                      <tbody>
                        {pairScores.map((score) => (
                          <tr key={score.groupId} className="border-t">
                            <td className="px-3 py-2 font-medium">第{score.groupNumber}组</td>
                            <td className="px-3 py-2 text-center">{score.memberCount}</td>
                            <td className="px-3 py-2 text-center">
                              {score.avgChemistryScore != null ? (
                                <Badge variant="outline" className={score.avgChemistryScore >= 80 ? 'text-green-700 border-green-300' : score.avgChemistryScore >= 60 ? 'text-amber-700 border-amber-300' : 'text-red-700 border-red-300'}>
                                  {score.avgChemistryScore}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {score.diversityScore != null ? score.diversityScore : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {score.communicationBalance != null ? score.communicationBalance : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {score.genderBalanceScore != null ? score.genderBalanceScore : '-'}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {score.overallScore != null ? (
                                <Badge variant="outline" className={score.overallScore >= 80 ? 'text-green-700 border-green-300' : score.overallScore >= 60 ? 'text-amber-700 border-amber-300' : 'text-red-700 border-red-300'}>
                                  {score.overallScore}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                            <td className="px-3 py-2 text-center">
                              {score.temperatureLevel ? (
                                <Badge variant="secondary" className="text-xs">
                                  {score.temperatureLevel === 'fire' ? '🔥 热烈' : score.temperatureLevel === 'warm' ? '☀️ 温暖' : score.temperatureLevel === 'mild' ? '🌤️ 温和' : '❄️ 冷静'}
                                </Badge>
                              ) : (
                                <span className="text-muted-foreground">-</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

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