import { useMemo, useState } from "react";
import { useMutation, useQueries, useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import {
  AlertTriangle,
  Bell,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin,
  Megaphone,
  RefreshCw,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import AdminQueryError from "@/components/admin/AdminQueryError";
import EmptyState from "@/components/admin/EmptyState";
import { apiRequest } from "@/lib/queryClient";
import { safeFormat } from "@/lib/dateUtils";
import { useToast } from "@/hooks/ui/use-toast";
import {
  ATTENDANCE_STATUS_LABELS,
  attendanceStatusLabel,
  deriveIcebreakerStatus,
  filterPoolsClosingWithin24h,
  findSessionForEvent,
  summarizeAttendees,
  type IcebreakerSessionInfo,
  type WarRoomAttendanceStatus,
  type WarRoomAttendee,
  type WarRoomPool,
} from "./warRoomUtils";

interface TodayEvent {
  id: string;
  /** Blind-box event id for attendance/chase endpoints; null means this event has no sign-in data */
  blindBoxEventId?: string | null;
  title: string;
  dateTime: string;
  location: string | null;
  status: string;
  maxAttendees: number;
  registeredCount: number;
  checkedInCount: number;
  noShowCount: number;
}

interface OpsDashboard {
  todayEvents: TodayEvent[];
  alerts: {
    pendingReports: number;
    underfilledPoolsClosingSoon: number;
    refundsPending: number;
    usersStuckInOnboarding: number;
  };
}

interface UnassignedGroup {
  groupId: string;
  groupNumber: number;
  poolId: string;
  poolTitle: string;
  poolDateTime: string;
  poolCity: string | null;
  poolDistrict: string | null;
  memberCount: number;
  venueAssignmentStatus: string;
  venueAssignmentReason: string | null;
  createdAt: string;
}

interface PendingOverride {
  eventId: string;
  userId: string;
  displayName: string;
  status: WarRoomAttendanceStatus;
}

const OPS_DASHBOARD_KEY = ["/api/admin/ops-dashboard"];
const UNASSIGNED_KEY = ["/api/admin/venue-assignment/unassigned"];
const SESSIONS_KEY = ["/api/admin/icebreaker-sessions"];
const POOLS_KEY = ["/api/admin/event-pools"];

function attendanceSummaryKey(eventId: string) {
  return [`/api/admin/events/${eventId}/attendance-summary`];
}

function resolveAttendanceEventId(event: { id: string; blindBoxEventId?: string | null }): string | null {
  if (event.blindBoxEventId === null) return null;
  return event.blindBoxEventId ?? event.id;
}

function IcebreakerStatusBadge({ session }: { session: IcebreakerSessionInfo | undefined }) {
  const status = deriveIcebreakerStatus(session);
  if (!status || !session) return null;
  if (status === "active") {
    return (
      <Badge variant="default" className="bg-green-600 text-[10px]" data-testid={`icebreaker-active-${session.id}`}>
        破冰进行中 · {session.currentPhase}
      </Badge>
    );
  }
  if (status === "stalled") {
    return (
      <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]" data-testid={`icebreaker-stalled-${session.id}`}>
        破冰疑似停滞 · 当前环节已 {session.phaseDurationMinutes} 分钟
      </Badge>
    );
  }
  return (
    <Badge variant="secondary" className="text-[10px]" data-testid={`icebreaker-not-started-${session.id}`}>
      破冰未开始
    </Badge>
  );
}

export default function AdminWarRoomPage() {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [expandedEventId, setExpandedEventId] = useState<string | null>(null);
  const [pendingOverride, setPendingOverride] = useState<PendingOverride | null>(null);
  const [chaseEvent, setChaseEvent] = useState<TodayEvent | null>(null);

  const opsQuery = useQuery<OpsDashboard>({
    queryKey: OPS_DASHBOARD_KEY,
    refetchInterval: 60_000,
    retry: 2,
  });
  const unassignedQuery = useQuery<UnassignedGroup[]>({
    queryKey: UNASSIGNED_KEY,
    refetchInterval: 60_000,
    retry: 2,
  });
  const sessionsQuery = useQuery<{ sessions: IcebreakerSessionInfo[] }>({
    queryKey: SESSIONS_KEY,
    refetchInterval: 60_000,
    retry: 2,
  });
  const poolsQuery = useQuery<WarRoomPool[]>({
    queryKey: POOLS_KEY,
    retry: 2,
  });

  const todayEvents = useMemo(() => opsQuery.data?.todayEvents ?? [], [opsQuery.data]);

  const attendanceQueries = useQueries({
    queries: todayEvents.map((event) => {
      const attendanceId = resolveAttendanceEventId(event);
      return {
        queryKey: attendanceSummaryKey(attendanceId ?? event.id),
        refetchInterval: 60_000,
        retry: 1,
        enabled: attendanceId !== null,
      };
    }),
  });

  const closingPools = useMemo(
    () => filterPoolsClosingWithin24h(poolsQuery.data),
    [poolsQuery.data],
  );

  const isFetchingAny =
    opsQuery.isFetching || unassignedQuery.isFetching || sessionsQuery.isFetching || poolsQuery.isFetching;

  const handleManualRefresh = () => {
    queryClient.invalidateQueries({ queryKey: OPS_DASHBOARD_KEY });
    queryClient.invalidateQueries({ queryKey: UNASSIGNED_KEY });
    queryClient.invalidateQueries({ queryKey: SESSIONS_KEY });
    queryClient.invalidateQueries({ queryKey: POOLS_KEY });
    todayEvents.forEach((event) => {
      const attendanceId = resolveAttendanceEventId(event);
      if (attendanceId) {
        queryClient.invalidateQueries({ queryKey: attendanceSummaryKey(attendanceId) });
      }
    });
  };

  const overrideMutation = useMutation({
    mutationFn: async (override: PendingOverride) =>
      apiRequest(
        "PATCH",
        `/api/admin/events/${override.eventId}/attendees/${override.userId}/attendance-status`,
        { status: override.status },
      ),
    onSuccess: (_data, override) => {
      toast({ title: "出勤状态已更新", description: `${override.displayName} 已改为「${ATTENDANCE_STATUS_LABELS[override.status]}」` });
      queryClient.invalidateQueries({ queryKey: attendanceSummaryKey(override.eventId) });
      queryClient.invalidateQueries({ queryKey: OPS_DASHBOARD_KEY });
    },
    onError: (error) => {
      toast({
        title: "出勤状态更新失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    },
    onSettled: () => setPendingOverride(null),
  });

  const chaseMutation = useMutation({
    mutationFn: async (eventId: string) => {
      const res = await apiRequest("POST", `/api/admin/blind-box-events/${eventId}/chase-attendees`);
      return (await res.json()) as { ok: boolean; notified?: number };
    },
    onSuccess: (data) => {
      const notified = typeof data?.notified === "number" ? data.notified : null;
      toast({
        title: notified !== null ? `已发送签到提醒（${notified} 人）` : "已发送签到提醒",
        description: "未确认出席的成员将收到提醒通知",
      });
    },
    onError: (error) => {
      toast({
        title: "提醒发送失败",
        description: error instanceof Error ? error.message : "请稍后重试",
        variant: "destructive",
      });
    },
    onSettled: () => setChaseEvent(null),
  });

  const lastUpdatedLabel = opsQuery.dataUpdatedAt
    ? safeFormat(new Date(opsQuery.dataUpdatedAt), "HH:mm", { fallback: "—" })
    : "—";

  if (opsQuery.isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <p className="text-sm text-muted-foreground">加载中...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold">今日战情</h2>
          <p className="text-muted-foreground">今晚活动值班总览 · 18:00–22:00 运营窗口</p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-muted-foreground" data-testid="text-last-updated">
            数据更新于 {lastUpdatedLabel}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={handleManualRefresh}
            data-testid="button-manual-refresh"
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${isFetchingAny ? "animate-spin" : ""}`} />
            手动刷新
          </Button>
        </div>
      </div>

      {/* 待处理 strip */}
      <div className="mb-6 grid gap-4 md:grid-cols-2">
        <Card data-testid="card-venue-tbd">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4" />
              场地待定小组
            </CardTitle>
          </CardHeader>
          <CardContent>
            {unassignedQuery.isError ? (
              <AdminQueryError
                title="场地待定数据加载失败"
                error={unassignedQuery.error}
                onRetry={() => unassignedQuery.refetch()}
                className="py-6"
              />
            ) : (
              <Link href="/admin/venues">
                <button
                  className="w-full rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-left hover:bg-amber-100 transition-colors"
                  data-testid="link-venue-tbd"
                >
                  <div className="text-2xl font-bold text-amber-700">
                    {unassignedQuery.data?.length ?? 0} 个
                  </div>
                  <p className="mt-1 text-xs text-amber-700">
                    已成组但未分配场地，点击前往场地管理处理
                  </p>
                </button>
              </Link>
            )}
          </CardContent>
        </Card>

        <Card data-testid="card-closing-pools">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Clock className="h-4 w-4" />
              24 小时内截止报名的活动池
            </CardTitle>
          </CardHeader>
          <CardContent>
            {poolsQuery.isError ? (
              <AdminQueryError
                title="活动池数据加载失败"
                error={poolsQuery.error}
                onRetry={() => poolsQuery.refetch()}
                className="py-6"
              />
            ) : closingPools.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted-foreground">暂无即将截止的活动池</p>
            ) : (
              <div className="space-y-2">
                {closingPools.map((pool) => (
                  <Link key={pool.id} href="/admin/event-pools">
                    <div
                      className="flex items-center justify-between rounded-lg border px-3 py-2 hover:bg-muted/50 transition-colors"
                      data-testid={`closing-pool-${pool.id}`}
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium">{pool.title}</div>
                        <div className="text-xs text-muted-foreground">
                          {safeFormat(pool.registrationDeadline, "MM-dd HH:mm", { fallback: "—" })} 截止
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {pool.isLowFill && (
                          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]">
                            报名不足
                          </Badge>
                        )}
                        <span className="text-sm font-semibold">
                          {pool.registrationCount} 人
                        </span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* 今晚活动 */}
      <Card data-testid="card-tonight-events">
        <CardHeader className="pb-3">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <Calendar className="h-4 w-4" />
            今晚活动 ({todayEvents.length} 场)
          </CardTitle>
        </CardHeader>
        <CardContent>
          {opsQuery.isError ? (
            <AdminQueryError
              title="今日活动数据加载失败"
              error={opsQuery.error}
              onRetry={() => opsQuery.refetch()}
            />
          ) : todayEvents.length === 0 ? (
            <EmptyState
              title="今晚没有活动"
              description="今天没有排期中的活动，好好休息"
              icon={<Calendar className="h-8 w-8 text-muted-foreground/50 mb-3" />}
            />
          ) : (
            <div className="space-y-3">
              {todayEvents.map((event, index) => {
                const attendanceQuery = attendanceQueries[index];
                const attendees = attendanceQuery?.data as WarRoomAttendee[] | undefined;
                const counts = summarizeAttendees(attendees);
                const attendanceId = resolveAttendanceEventId(event);
                const session = findSessionForEvent(sessionsQuery.data?.sessions, {
                  id: event.blindBoxEventId ?? event.id,
                  title: event.title,
                });
                const isExpanded = expandedEventId === event.id;

                return (
                  <div key={event.id} className="rounded-lg border" data-testid={`war-room-event-${event.id}`}>
                    <div className="flex flex-wrap items-center justify-between gap-3 p-4">
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{event.title}</span>
                          <IcebreakerStatusBadge session={session} />
                        </div>
                        <div className="flex items-center gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {safeFormat(event.dateTime, "HH:mm", { fallback: "—" })}
                          </span>
                          {event.location ? (
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3 w-3" />
                              {event.location}
                            </span>
                          ) : (
                            <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 text-[10px]">
                              <AlertTriangle className="mr-1 h-3 w-3" />
                              地点待定
                            </Badge>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-4 text-sm">
                        <div className="text-center">
                          <div className="font-semibold">{event.registeredCount}</div>
                          <div className="text-xs text-muted-foreground">已报名</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-green-600">{counts.arrived}</div>
                          <div className="text-xs text-muted-foreground">已签到</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-amber-600">{counts.pending}</div>
                          <div className="text-xs text-muted-foreground">未确认</div>
                        </div>
                        <div className="text-center">
                          <div className="font-semibold text-red-600">{counts.absent}</div>
                          <div className="text-xs text-muted-foreground">缺席</div>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        {attendanceId === null ? (
                          <span
                            className="text-xs text-muted-foreground"
                            data-testid={`attendance-unavailable-${event.id}`}
                          >
                            本场活动暂无签到数据
                          </span>
                        ) : (
                          <>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setChaseEvent(event)}
                              disabled={chaseMutation.isPending}
                              data-testid={`button-chase-${event.id}`}
                            >
                              <Megaphone className="mr-1.5 h-3.5 w-3.5" />
                              催促未签到
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setExpandedEventId(isExpanded ? null : event.id)}
                              data-testid={`button-toggle-attendees-${event.id}`}
                            >
                              <Users className="mr-1.5 h-3.5 w-3.5" />
                              出勤管理
                              {isExpanded ? (
                                <ChevronUp className="ml-1 h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="ml-1 h-3.5 w-3.5" />
                              )}
                            </Button>
                          </>
                        )}
                      </div>
                    </div>

                    {isExpanded && attendanceId !== null && (
                      <div className="border-t px-4 py-3">
                        {attendanceQuery?.isError ? (
                          <AdminQueryError
                            title="签到明细加载失败"
                            error={attendanceQuery.error}
                            onRetry={() => attendanceQuery.refetch()}
                            className="py-6"
                          />
                        ) : attendanceQuery?.isLoading ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">签到明细加载中...</p>
                        ) : !attendees || attendees.length === 0 ? (
                          <p className="py-4 text-center text-xs text-muted-foreground">本场暂无匹配成员</p>
                        ) : (
                          <div className="space-y-2">
                            {attendees.map((attendee) => (
                              <div
                                key={attendee.userId}
                                className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                                data-testid={`attendee-row-${attendee.userId}`}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium">{attendee.displayName}</span>
                                  {attendee.archetype && (
                                    <span className="text-xs text-muted-foreground">{attendee.archetype}</span>
                                  )}
                                  <Badge variant="outline" className="text-[10px]">
                                    {attendanceStatusLabel(attendee.status)}
                                  </Badge>
                                </div>
                                <Select
                                  value={attendee.status}
                                  onValueChange={(value) =>
                                    setPendingOverride({
                                      eventId: attendanceId,
                                      userId: attendee.userId,
                                      displayName: attendee.displayName,
                                      status: value as WarRoomAttendanceStatus,
                                    })
                                  }
                                >
                                  <SelectTrigger
                                    className="h-8 w-32"
                                    data-testid={`select-attendance-${attendee.userId}`}
                                  >
                                    <SelectValue placeholder="修改状态" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {(Object.keys(ATTENDANCE_STATUS_LABELS) as WarRoomAttendanceStatus[]).map(
                                      (status) => (
                                        <SelectItem key={status} value={status}>
                                          {ATTENDANCE_STATUS_LABELS[status]}
                                        </SelectItem>
                                      ),
                                    )}
                                  </SelectContent>
                                </Select>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* 催促未签到确认 */}
      <AlertDialog open={!!chaseEvent} onOpenChange={(open) => !open && setChaseEvent(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>催促未签到成员</AlertDialogTitle>
            <AlertDialogDescription>
              {chaseEvent
                ? `将向「${chaseEvent.title}」尚未确认出席的成员发送签到提醒通知。频繁催促可能造成打扰，请确认后再发送。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-chase">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (!chaseEvent) return;
                const chaseId = resolveAttendanceEventId(chaseEvent);
                if (chaseId) chaseMutation.mutate(chaseId);
              }}
              disabled={chaseMutation.isPending}
              data-testid="button-confirm-chase"
            >
              {chaseMutation.isPending ? "发送中..." : "确认发送"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* 出勤状态修改确认 */}
      <AlertDialog open={!!pendingOverride} onOpenChange={(open) => !open && setPendingOverride(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>修改出勤状态</AlertDialogTitle>
            <AlertDialogDescription>
              {pendingOverride
                ? `将把 ${pendingOverride.displayName} 的出勤状态改为「${ATTENDANCE_STATUS_LABELS[pendingOverride.status]}」。该操作会立即同步给现场成员并记入审计日志，请确认无误。`
                : ""}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-cancel-override">取消</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => pendingOverride && overrideMutation.mutate(pendingOverride)}
              disabled={overrideMutation.isPending}
              data-testid="button-confirm-override"
            >
              {overrideMutation.isPending ? "提交中..." : (
                <span className="flex items-center gap-1.5">
                  <CheckCircle2 className="h-4 w-4" />
                  确认修改
                </span>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
