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
  DialogFooter,
} from "@/components/ui/dialog";
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

import { Users, Eye, MapPin, Copy, Check, Pencil, Zap } from "lucide-react";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import { useAuth } from "@/hooks/auth/useAuth";
import EventPoolCreateDialog from "./EventPoolCreateDialog";
import EventPoolMetrics from "./EventPoolMetrics";
import EventPoolFilters from "./EventPoolFilters";
import EventPoolDetailDialog from "./EventPoolDetailDialog";
import AdminQueryError from "@/components/admin/AdminQueryError";
import type {
  CityFilter,
  WaitingFilter,
  EventsFilter,
  SortOption,
  AdminEventPool,
  AdminPoolRegistration,
  PoolGroup,
  PairScoreEntry,
  VenueCandidateResponse,
} from "./types";
import { fmtDateTimeLocal, safeFormat } from "@/lib/dateUtils";
import { zhCN } from "date-fns/locale";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
    isTestPool: z.boolean().default(false),
    // Gender-balance controls (Sprint 2026-07-14 gender ratio enforcement).
    // Ranges mirror the server's updateEventPoolSchema (SEC-02).
    genderBalanceMode: z.enum(["none", "soft", "hard"]).default("soft"),
    genderBalanceBonusPoints: z.number().int().min(0).max(100).default(15),
    minFemaleCount: z.number().int().min(0).max(20).default(0),
    minMaleCount: z.number().int().min(0).max(20).default(0),
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

const formatPoolDateTime = (dateTimeStr: string) =>
  safeFormat(dateTimeStr, "yyyy年MM月dd日 HH:mm", { locale: zhCN, fallback: dateTimeStr });

/** Parse the real server error message out of an apiRequest error. */
function getServerErrorMessage(error: unknown, fallback: string): string {
  const message = error instanceof Error ? error.message : "";
  if (!message) return fallback;
  const jsonMatch = message.match(/\{.*\}/s);
  if (jsonMatch) {
    try {
      const parsed = JSON.parse(jsonMatch[0]);
      return parsed.error || parsed.message || fallback;
    } catch {
      return message;
    }
  }
  return message;
}

interface TriggerMatchResponse {
  message?: string;
  groupCount?: number;
  totalMatched?: number;
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
  // 手动分配场地
  const [assignGroup, setAssignGroup] = useState<PoolGroup | null>(null);
  const [selectedVenueSlot, setSelectedVenueSlot] = useState<string | null>(null);
  // 触发匹配确认
  const [matchConfirmPool, setMatchConfirmPool] = useState<AdminEventPool | null>(null);

  const { toast } = useToast();
  const { user } = useAuth();
  const canMutate = user?.adminRole !== "viewer";

  // 活动池列表
  const {
    data: pools = [],
    isLoading,
    isError: isPoolsError,
    error: poolsError,
    refetch: refetchPools,
  } = useQuery<AdminEventPool[]>({
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
      isTestPool: false,
      genderBalanceMode: "soft" as const,
      genderBalanceBonusPoints: 15,
      minFemaleCount: 0,
      minMaleCount: 0,
    },
  });

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

  const {
    data: pairScores = [],
    isError: isPairScoresError,
    error: pairScoresError,
    refetch: refetchPairScores,
  } = useQuery<PairScoreEntry[]>({
    queryKey: ["/api/admin/event-pools", selectedPool?.id, "pair-scores"],
    enabled: !!selectedPool,
    queryFn: async () => {
      const res = await apiRequest(
        "GET",
        `/api/admin/event-pools/${selectedPool!.id}/pair-scores`,
      );
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const { data: venueCandidates, isLoading: isLoadingCandidates } = useQuery<VenueCandidateResponse | null>({
    queryKey: ["/api/admin/venue-assignment/groups", assignGroup?.id, "candidates"],
    enabled: !!assignGroup,
    queryFn: async () => {
      if (!assignGroup) return null;
      const res = await apiRequest(
        "GET",
        `/api/admin/venue-assignment/groups/${assignGroup.id}/candidates`,
      );
      return (await res.json()) as VenueCandidateResponse;
    },
  });

  const assignVenueMutation = useMutation({
    mutationFn: async ({
      groupId,
      venueId,
      timeSlotId,
      bookingDate,
    }: {
      groupId: string;
      venueId: string;
      timeSlotId: string;
      bookingDate: string;
    }) => {
      return apiRequest("POST", `/api/admin/venue-assignment/groups/${groupId}/assign`, {
        venueId,
        timeSlotId,
        bookingDate,
      });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools", selectedPool?.id, "groups"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venue-assignment/groups", variables.groupId, "candidates"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venue-assignment/unassigned"] });
      setAssignGroup(null);
      setSelectedVenueSlot(null);
      toast({ title: "分配成功", description: "场地已手动分配给该小组。" });
    },
    onError: (error: any) => {
      console.error("Error assigning venue:", error);
      toast({
        title: "分配失败",
        description: getServerErrorMessage(error, "无法分配场地，请重试"),
        variant: "destructive",
      });
    },
  });

  const triggerMatchMutation = useMutation({
    mutationFn: async (poolId: string) => {
      const res = await apiRequest("POST", `/api/admin/event-pools/${poolId}/match`, {});
      return (await res.json()) as TriggerMatchResponse;
    },
    onSuccess: (data, poolId) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/event-pools"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/venue-assignment/unassigned"] });
      setMatchConfirmPool(null);
      const groupCount = data?.groupCount;
      const totalMatched = data?.totalMatched;
      toast({
        title: "匹配完成",
        description:
          typeof groupCount === "number"
            ? `成功成局 ${groupCount} 组，共匹配 ${totalMatched ?? 0} 人`
            : data?.message || "匹配流程已完成",
      });
    },
    onError: (error: any) => {
      console.error("Error triggering match:", error);
      toast({
        title: "触发匹配失败",
        description: getServerErrorMessage(error, "无法触发匹配，请稍后重试"),
        variant: "destructive",
      });
    },
  });

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
      toast({
        title: "创建失败",
        description: getServerErrorMessage(error, "无法创建活动池，请重试"),
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
      toast({
        title: "更新失败",
        description: getServerErrorMessage(error, "无法更新活动池，请重试"),
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

  // Coerce a form value to a finite integer. 0 is a valid gender-floor value, so
  // `|| fallback` (which would clobber 0) is deliberately avoided here.
  const toBoundedInt = (value: unknown, fallback: number) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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
      isTestPool: Boolean(data.isTestPool),
      genderBalanceMode: data.genderBalanceMode ?? "soft",
      genderBalanceBonusPoints: toBoundedInt(data.genderBalanceBonusPoints, 15),
      minFemaleCount: toBoundedInt(data.minFemaleCount, 0),
      minMaleCount: toBoundedInt(data.minMaleCount, 0),
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
    onError: (error: any) => {
      console.error("Error adding member to group:", error);
      toast({
        title: "添加失败",
        description: getServerErrorMessage(error, "无法添加用户到小组，请重试"),
        variant: "destructive",
      });
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
      isTestPool: Boolean(pool.isTestPool),
      genderBalanceMode: (pool.genderBalanceMode ?? "soft") as any,
      genderBalanceBonusPoints: pool.genderBalanceBonusPoints ?? 15,
      minFemaleCount: pool.minFemaleCount ?? 0,
      minMaleCount: pool.minMaleCount ?? 0,
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
      isTestPool: Boolean(pool.isTestPool),
      genderBalanceMode: (pool.genderBalanceMode ?? "soft") as any,
      genderBalanceBonusPoints: pool.genderBalanceBonusPoints ?? 15,
      minFemaleCount: pool.minFemaleCount ?? 0,
      minMaleCount: pool.minMaleCount ?? 0,
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
        {canMutate && (
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
        )}
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
      {isPoolsError ? (
        <AdminQueryError
          title="活动池列表加载失败"
          error={poolsError}
          onRetry={() => refetchPools()}
        />
      ) : (
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
                        {formatPoolDateTime(pool.dateTime)}
                      </div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">报名截止</div>
                      <div className="font-medium">
                        {formatPoolDateTime(pool.registrationDeadline)}
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
                    {canMutate && (
                      <>
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
                      </>
                    )}
                    {canMutate && (
                    <span
                      title={
                        totalReg === 0
                          ? "该活动池暂无报名用户，无法触发匹配"
                          : undefined
                      }
                    >
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setMatchConfirmPool(pool)}
                        disabled={totalReg === 0 || triggerMatchMutation.isPending}
                        data-testid={`button-trigger-match-${pool.id}`}
                      >
                        <Zap className="h-4 w-4 mr-1" />
                        触发匹配
                      </Button>
                    </span>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>
      )}

      {/* 详情弹窗：池内报名 + 已分组小组 */}
      <EventPoolDetailDialog
        pool={selectedPool}
        open={showDetailsDialog}
        onOpenChange={setShowDetailsDialog}
        registrations={registrations}
        isLoadingRegistrations={isLoadingRegistrations}
        groups={groups}
        isLoadingGroups={isLoadingGroups}
        pairScores={pairScores}
        pairScoresError={isPairScoresError ? pairScoresError : null}
        onRetryPairScores={() => refetchPairScores()}
        addMemberGroupId={addMemberGroupId}
        onAddMemberOpenChange={setAddMemberGroupId}
        onAddMember={(group, registrationId) => {
          if (!selectedPool) return;
          addMemberMutation.mutate({
            poolId: selectedPool.id,
            groupId: group.id,
            registrationId,
          });
        }}
        onAssignVenue={(group) => {
          setAssignGroup(group);
          setSelectedVenueSlot(null);
        }}
        assignVenuePending={assignVenueMutation.isPending}
        canMutate={canMutate}
      />

      {/* Venue Assignment Dialog */}
      <Dialog open={!!assignGroup} onOpenChange={(open) => {
        if (!open) {
          setAssignGroup(null);
          setSelectedVenueSlot(null);
        }
      }}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle>手动分配场地</DialogTitle>
          </DialogHeader>
          <div className="flex-1 overflow-hidden flex flex-col min-h-0">
            {assignGroup && (
              <div className="text-sm text-muted-foreground mb-2">
                第{assignGroup.groupNumber}组 · {assignGroup.members.length}人
                {venueCandidates?.eventDateTime && (
                  <span className="ml-2">· {formatPoolDateTime(venueCandidates.eventDateTime)}</span>
                )}
              </div>
            )}
            <ScrollArea className="flex-1 pr-2">
              {isLoadingCandidates ? (
                <div className="text-sm text-muted-foreground py-8 text-center">加载候选场地中...</div>
              ) : !venueCandidates || venueCandidates.candidates.length === 0 ? (
                <div className="text-sm text-muted-foreground py-8 text-center">
                  暂无可用场地。请检查场地库存、时段容量与城市/区域配置。
                </div>
              ) : (
                <RadioGroup
                  value={selectedVenueSlot ?? undefined}
                  onValueChange={(value) => setSelectedVenueSlot(value)}
                  className="space-y-3"
                >
                  {venueCandidates.candidates.map(({ venue, bookingDate, slots }) => (
                    <div key={venue.id} className="border rounded-md p-3">
                      <div className="flex items-start justify-between gap-2 mb-2">
                        <div>
                          <div className="font-medium">
                            {venue.brandName || venue.name}
                            <span className="text-xs text-muted-foreground ml-2 font-normal">
                              {venue.venueType === "bar" ? "酒吧" : venue.venueType === "homebar" ? "Homebar" : venue.venueType === "cafe" ? "咖啡" : "餐厅"}
                            </span>
                          </div>
                          <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                            <MapPin className="h-3 w-3" />
                            {venue.address}
                          </div>
                        </div>
                        <div className="text-xs text-right text-muted-foreground">
                          <div>容量 {venue.seatingCapacity ?? venue.capacity ?? "-"}</div>
                          {venue.cuisines && venue.cuisines.length > 0 && (
                            <div>{venue.cuisines.slice(0, 3).join(" · ")}</div>
                          )}
                        </div>
                      </div>
                      <div className="space-y-2">
                        {slots.map((slot) => {
                          const value = `${venue.id}:${slot.id}:${bookingDate}`;
                          return (
                            <label
                              key={slot.id}
                              className="flex items-start gap-2 rounded-md border p-2 cursor-pointer hover:bg-muted/50"
                            >
                              <RadioGroupItem value={value} id={value} className="mt-0.5" />
                              <div className="flex-1 text-sm">
                                <div className="flex items-center justify-between">
                                  <span>{slot.startTime} - {slot.endTime}</span>
                                  <Badge variant="outline" className="text-xs">
                                    剩余 {slot.remainingCapacity}
                                  </Badge>
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  预订日期 {bookingDate}
                                </div>
                              </div>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  ))}
                </RadioGroup>
              )}
            </ScrollArea>
          </div>
          <DialogFooter className="mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setAssignGroup(null);
                setSelectedVenueSlot(null);
              }}
              disabled={assignVenueMutation.isPending}
            >
              取消
            </Button>
            <Button
              disabled={!canMutate || !selectedVenueSlot || assignVenueMutation.isPending}
              onClick={() => {
                if (!assignGroup || !selectedVenueSlot) return;
                const [venueId, timeSlotId, bookingDate] = selectedVenueSlot.split(":");
                if (!venueId || !timeSlotId || !bookingDate) return;
                assignVenueMutation.mutate({
                  groupId: assignGroup.id,
                  venueId,
                  timeSlotId,
                  bookingDate,
                });
              }}
            >
              {assignVenueMutation.isPending ? "分配中..." : "确认分配"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* 触发匹配确认 */}
      <AlertDialog
        open={!!matchConfirmPool}
        onOpenChange={(open) => {
          if (!open) setMatchConfirmPool(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>确认触发匹配</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <p>
                  确定要为活动池「{matchConfirmPool?.title}」触发匹配吗？
                </p>
                {matchConfirmPool && (
                  <p>
                    当前报名 {matchConfirmPool.registrationCount ?? matchConfirmPool.totalRegistrations ?? 0} 人，
                    其中待匹配 {matchConfirmPool.pendingCount ?? 0} 人；
                    按 {matchConfirmPool.minGroupSize}-{matchConfirmPool.maxGroupSize} 人/组估算，
                    预计可成约{" "}
                    {Math.floor(
                      (matchConfirmPool.pendingCount ?? 0) /
                        Math.max(1, matchConfirmPool.minGroupSize || 4),
                    )}{" "}
                    组。
                  </p>
                )}
                <p>匹配结果会直接写入分组，此操作不可撤销。</p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-trigger-match">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (matchConfirmPool) {
                  triggerMatchMutation.mutate(matchConfirmPool.id);
                }
              }}
              disabled={triggerMatchMutation.isPending}
              data-testid="button-confirm-trigger-match"
            >
              {triggerMatchMutation.isPending ? "匹配中..." : "确认触发匹配"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
