import { useEffect, useMemo, useState } from "react";
import { Controller, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { z } from "zod";
import {
  CalendarClock,
  AlertTriangle,
  Clock3,
  Edit3,
  MapPin,
  Plus,
  Send,
  Sparkles,
  UserRound,
  XCircle,
} from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/ui/use-toast";
import { apiRequest, queryClient } from "@/lib/queryClient";
import {
  type FlashEncounterLocation,
  type FlashNpc,
  type FlashSchedulePlan,
  type FlashScheduleResponse,
  type FlashShift,
  formatFlashScheduleStatus,
  formatFlashShiftStatus,
  formatFlashTime,
  getNpcIds,
  toShenzhenIso,
} from "@/lib/flashAdmin";
import { FlashEmptyState, FlashErrorState, FlashListSkeleton } from "./FlashQueryState";

const shiftSchema = z
  .object({
    npcId: z.string().min(1, "请选择 NPC"),
    locationId: z.string().min(1, "请选择街头盲盒地点"),
    startTime: z.string().regex(/^\d{2}:\d{2}$/, "请输入开始时间"),
    endTime: z.string().regex(/^\d{2}:\d{2}$/, "请输入结束时间"),
  })
  .superRefine((value, context) => {
    const [startHour, startMinute] = value.startTime.split(":").map(Number);
    const [endHour, endMinute] = value.endTime.split(":").map(Number);
    const start = startHour * 60 + startMinute;
    const end = endHour * 60 + endMinute;
    const duration = end - start;

    if (start < 9 * 60 || end > 21 * 60) {
      context.addIssue({ code: "custom", path: ["endTime"], message: "班次需安排在 09:00–21:00" });
    }
    if (duration < 180 || duration > 300) {
      context.addIssue({ code: "custom", path: ["endTime"], message: "单个班次需为 3–5 小时" });
    }
  });

type ShiftFormValues = z.infer<typeof shiftSchema>;

type ConfirmAction =
  | { kind: "generate"; date: string }
  | { kind: "regenerate"; plan: FlashSchedulePlan }
  | { kind: "publish"; plan: FlashSchedulePlan }
  | { kind: "cancel"; plan: FlashSchedulePlan; shift: FlashShift }
  | null;

type RegenerationPreview = FlashScheduleResponse & { generationSeed: string; previewDigest: string };
type EmergencyAdjustmentPreview = FlashScheduleResponse & { previewDigest: string };

interface EmergencyAdjustmentShiftWrite {
  id: string;
  npcId: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  source: "manual";
}

interface FlashShiftWrite {
  id?: string;
  npcId: string;
  locationId: string;
  startsAt: string;
  endsAt: string;
  status: FlashShift["status"];
  source: FlashShift["source"];
}

function normalizeSchedule(data?: Partial<FlashScheduleResponse> | null): FlashScheduleResponse {
  return {
    plan: data?.plan ?? null,
    shifts: Array.isArray(data?.shifts) ? data.shifts : [],
  };
}

function scheduleStatusVariant(status?: string) {
  if (status === "published") return "default" as const;
  if (status === "draft") return "secondary" as const;
  return "outline" as const;
}

function shiftStatusVariant(status?: string) {
  if (status === "published") return "default" as const;
  if (status === "cancelled") return "destructive" as const;
  return "secondary" as const;
}

function scheduleSourceLabel(source?: string) {
  if (source === "fallback") return "沿用后重排";
  if (source === "manual") return "人工调整";
  return "次日随机草案";
}

function toShiftWrite(shift: FlashShift): FlashShiftWrite {
  return {
    id: shift.id,
    npcId: shift.npcId,
    locationId: shift.locationId,
    startsAt: shift.startsAt,
    endsAt: shift.endsAt,
    status: shift.status,
    source: shift.source,
  };
}

function getMutationDescription(error: unknown): string {
  if (error instanceof Error && error.message.startsWith("409:")) {
    return "排班已被其他管理员修改，请刷新后再试。";
  }
  return error instanceof Error ? error.message : "操作没成功，请再试一次。";
}

export function FlashScheduleTab({
  canWrite,
  today,
  tomorrow,
  npcs,
  locations,
}: {
  canWrite: boolean;
  today: string;
  tomorrow: string;
  npcs: FlashNpc[];
  locations: FlashEncounterLocation[];
}) {
  const { toast } = useToast();
  const [confirmAction, setConfirmAction] = useState<ConfirmAction>(null);
  const [editing, setEditing] = useState<{ plan: FlashSchedulePlan; shift: FlashShift | null } | null>(null);
  const [regenerationPreview, setRegenerationPreview] = useState<RegenerationPreview | null>(null);
  const [regenerationReason, setRegenerationReason] = useState("");
  const [emergencyPlan, setEmergencyPlan] = useState<FlashScheduleResponse | null>(null);
  const [emergencyPreview, setEmergencyPreview] = useState<EmergencyAdjustmentPreview | null>(null);
  const [emergencyReason, setEmergencyReason] = useState("");

  const todayQuery = useQuery<FlashScheduleResponse>({
    queryKey: [`/api/admin/alang/schedules?date=${today}`],
  });
  const tomorrowQuery = useQuery<FlashScheduleResponse>({
    queryKey: [`/api/admin/alang/schedules?date=${tomorrow}`],
  });

  const invalidateSchedules = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: [`/api/admin/alang/schedules?date=${today}`] }),
      queryClient.invalidateQueries({ queryKey: [`/api/admin/alang/schedules?date=${tomorrow}`] }),
      queryClient.invalidateQueries({ queryKey: ["/api/admin/alang/overview"] }),
    ]);

  const generateMutation = useMutation({
    mutationFn: async (date: string) => {
      const response = await apiRequest("POST", "/api/admin/alang/schedules/generate", { date });
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await invalidateSchedules();
      toast({ title: "次日草案已生成", description: "请检查时段与地点，确认后再发布。" });
    },
    onError: (error) =>
      toast({ title: "草案没生成", description: getMutationDescription(error), variant: "destructive" }),
  });

  const publishMutation = useMutation({
    mutationFn: async (plan: FlashSchedulePlan) => {
      const response = await apiRequest("POST", `/api/admin/alang/schedules/${plan.id}/publish`, {
        expectedVersion: plan.version,
      });
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await invalidateSchedules();
      toast({ title: "排班已发布", description: "用户只会看到当前在线的 NPC。" });
    },
    onError: (error) =>
      toast({ title: "发布没成功", description: getMutationDescription(error), variant: "destructive" }),
  });

  const previewRegenerationMutation = useMutation({
    mutationFn: async (plan: FlashSchedulePlan) => {
      const response = await apiRequest("POST", `/api/admin/alang/schedules/${plan.id}/regeneration-preview`, {
        expectedVersion: plan.version,
      });
      return response.json() as Promise<RegenerationPreview>;
    },
    onSuccess: (preview) => {
      setRegenerationPreview(preview);
      setRegenerationReason("");
    },
    onError: (error) =>
      toast({ title: "新排班没有生成", description: getMutationDescription(error), variant: "destructive" }),
  });

  const replacePublishedMutation = useMutation({
    mutationFn: async ({ preview, reason }: { preview: RegenerationPreview; reason: string }) => {
      if (!preview.plan) throw new Error("缺少待替换的排班");
      const response = await apiRequest("POST", `/api/admin/alang/schedules/${preview.plan.id}/regenerate`, {
        expectedVersion: preview.plan.version,
        generationSeed: preview.generationSeed,
        previewDigest: preview.previewDigest,
        reason,
      });
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      setRegenerationPreview(null);
      setRegenerationReason("");
      await invalidateSchedules();
      toast({ title: "明日排班已重新生成", description: "新班次已一次性替换并立即生效。" });
    },
    onError: (error) =>
      toast({ title: "排班没有替换", description: getMutationDescription(error), variant: "destructive" }),
  });

  const previewEmergencyMutation = useMutation({
    mutationFn: async ({ plan, shifts }: { plan: FlashSchedulePlan; shifts: EmergencyAdjustmentShiftWrite[] }) => {
      const response = await apiRequest("POST", `/api/admin/alang/schedules/${plan.id}/emergency-adjustment-preview`, {
        expectedVersion: plan.version,
        shifts,
      });
      return response.json() as Promise<EmergencyAdjustmentPreview>;
    },
    onSuccess: setEmergencyPreview,
    onError: (error) => toast({ title: "今日调整未通过校验", description: getMutationDescription(error), variant: "destructive" }),
  });

  const applyEmergencyMutation = useMutation({
    mutationFn: async ({ preview, reason }: { preview: EmergencyAdjustmentPreview; reason: string }) => {
      if (!preview.plan) throw new Error("缺少今日排班");
      const response = await apiRequest("POST", `/api/admin/alang/schedules/${preview.plan.id}/emergency-adjust`, {
        expectedVersion: preview.plan.version,
        previewDigest: preview.previewDigest,
        reason,
        shifts: preview.shifts.map((shift) => ({
          id: shift.id,
          npcId: shift.npcId,
          locationId: shift.locationId,
          startsAt: shift.startsAt,
          endsAt: shift.endsAt,
          source: "manual",
        })),
      });
      return response.json();
    },
    onSuccess: async () => {
      setEmergencyPlan(null);
      setEmergencyPreview(null);
      setEmergencyReason("");
      await invalidateSchedules();
      toast({ title: "今日排班已紧急调整", description: "原班次身份保持不变，新地点与时间已立即生效。" });
    },
    onError: (error) => toast({ title: "今日排班调整失败", description: getMutationDescription(error), variant: "destructive" }),
  });

  const updatePlanMutation = useMutation({
    mutationFn: async ({ planId, expectedVersion, status, shifts }: { planId: string; expectedVersion: number; status: string; shifts: FlashShiftWrite[] }) => {
      const response = await apiRequest("PUT", `/api/admin/alang/schedules/${planId}`, { expectedVersion, status, shifts });
      return response.json().catch(() => null);
    },
    onSuccess: async () => {
      await invalidateSchedules();
      setEditing(null);
      toast({ title: "排班草案已保存", description: "修改会留在草案中，发布后才会生效。" });
    },
    onError: (error) =>
      toast({ title: "排班没保存", description: getMutationDescription(error), variant: "destructive" }),
  });

  const executeConfirmedAction = async () => {
    const action = confirmAction;
    setConfirmAction(null);
    if (!action) return;

    if (action.kind === "generate") {
      generateMutation.mutate(action.date);
      return;
    }
    if (action.kind === "publish") {
      publishMutation.mutate(action.plan);
      return;
    }
    if (action.kind === "regenerate") {
      previewRegenerationMutation.mutate(action.plan);
      return;
    }

    const schedule = action.plan.serviceDate === today
      ? normalizeSchedule(todayQuery.data)
      : normalizeSchedule(tomorrowQuery.data);
    updatePlanMutation.mutate({
      planId: action.plan.id,
      expectedVersion: action.plan.version,
      status: action.plan.status,
      shifts: schedule.shifts.map((shift) =>
        shift.id === action.shift.id ? { ...toShiftWrite(shift), status: "cancelled" } : toShiftWrite(shift),
      ),
    });
  };

  const scheduleCards = [
    { label: "今天", date: today, query: todayQuery },
    { label: "明天", date: tomorrow, query: tomorrowQuery },
  ];

  return (
    <div className="space-y-4">
      <Alert className="border-primary/20 bg-primary/5">
        <CalendarClock className="h-4 w-4" aria-hidden="true" />
        <AlertTitle>排班只决定“什么时候可能遇见”</AlertTitle>
        <AlertDescription>
          每位 NPC 在固定星期内随机出现 1–2 个班次；班次 3–5 小时，时间落在 09:00–21:00，用户不会提前看到未来安排。
        </AlertDescription>
      </Alert>

      <div className="grid gap-4 xl:grid-cols-2">
        {scheduleCards.map(({ label, date, query }) => {
          if (query.isLoading) return <FlashListSkeleton key={date} />;
          if (query.isError) {
            return (
              <FlashErrorState
                key={date}
                message={query.error instanceof Error ? query.error.message : undefined}
                onRetry={() => query.refetch()}
              />
            );
          }

          const schedule = normalizeSchedule(query.data);
          const editable = canWrite && schedule.plan?.status === "draft";
          const activeShifts = schedule.shifts.filter((shift) => shift.status !== "cancelled");

          return (
            <Card key={date} className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30 pb-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <CardTitle className="text-lg">{label} · {date}</CardTitle>
                      <Badge variant={scheduleStatusVariant(schedule.plan?.status)}>
                        {formatFlashScheduleStatus(schedule.plan?.status)}
                      </Badge>
                    </div>
                    <CardDescription className="mt-1">
                      {schedule.plan ? `${scheduleSourceLabel(schedule.plan.source)} · ${activeShifts.length} 个有效班次` : "允许当天没有 NPC 出现"}
                    </CardDescription>
                  </div>

                  {canWrite && label === "今天" && schedule.plan?.status === "published" && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setEmergencyPlan(schedule);
                        setEmergencyPreview(null);
                        setEmergencyReason("");
                      }}
                      data-testid="button-emergency-adjust-today-schedule"
                    >
                      <AlertTriangle className="mr-2 h-4 w-4" aria-hidden="true" />
                      紧急调整今日
                    </Button>
                  )}

                  {canWrite && label === "明天" && (
                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => schedule.plan?.status === "published"
                          ? setConfirmAction({ kind: "regenerate", plan: schedule.plan! })
                          : setConfirmAction({ kind: "generate", date })}
                        disabled={generateMutation.isPending || previewRegenerationMutation.isPending || publishMutation.isPending}
                        data-testid="button-flash-generate-draft"
                      >
                        <Sparkles className="mr-2 h-4 w-4" aria-hidden="true" />
                        {schedule.plan?.status === "published" ? "重新生成" : schedule.plan ? "重新生成草案" : "生成草案"}
                      </Button>
                      {schedule.plan?.status === "draft" && (
                        <Button
                          size="sm"
                          onClick={() => setConfirmAction({ kind: "publish", plan: schedule.plan! })}
                          disabled={activeShifts.length === 0 || publishMutation.isPending}
                          data-testid="button-flash-publish-schedule"
                        >
                          <Send className="mr-2 h-4 w-4" aria-hidden="true" />
                          发布
                        </Button>
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>

              <CardContent className="space-y-3 p-4">
                {!schedule.plan || schedule.shifts.length === 0 ? (
                  <FlashEmptyState
                    title={`${label}没有 NPC 排班`}
                    description={label === "明天" && canWrite ? "可以生成一份次日随机草案。" : "这也是正常安排，无需补班。"}
                    icon={CalendarClock}
                  />
                ) : (
                  activeShifts.map((shift) => (
                    <div
                      key={shift.id}
                      className="rounded-xl border bg-background p-4 transition-colors hover:border-primary/30"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-semibold">{shift.npc?.name || npcs.find((npc) => npc.id === shift.npcId)?.name || "未知 NPC"}</span>
                            <Badge variant={shiftStatusVariant(shift.status)}>{formatFlashShiftStatus(shift.status)}</Badge>
                          </div>
                          <div className="grid gap-1.5 text-sm text-muted-foreground">
                            <span className="flex items-center gap-2">
                              <Clock3 className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {formatFlashTime(shift.startsAt)}–{formatFlashTime(shift.endsAt)}
                            </span>
                            <span className="flex items-center gap-2">
                              <MapPin className="h-4 w-4 shrink-0" aria-hidden="true" />
                              {shift.location?.district || locations.find((item) => item.id === shift.locationId)?.district || "未设置区域"}
                              <span aria-hidden="true">·</span>
                              {shift.location?.name || locations.find((item) => item.id === shift.locationId)?.name || "未设置地点"}
                            </span>
                          </div>
                        </div>
                        {editable && shift.status !== "cancelled" && (
                          <div className="flex shrink-0 gap-2">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => setEditing({ plan: schedule.plan!, shift })}
                              data-testid={`button-edit-shift-${shift.id}`}
                            >
                              <Edit3 className="mr-2 h-4 w-4" aria-hidden="true" />
                              调整
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="text-destructive hover:text-destructive"
                              onClick={() => setConfirmAction({ kind: "cancel", plan: schedule.plan!, shift })}
                              data-testid={`button-cancel-shift-${shift.id}`}
                            >
                              <XCircle className="mr-2 h-4 w-4" aria-hidden="true" />
                              取消班次
                            </Button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}

                {editable && (
                  <Button
                    variant="outline"
                    className="w-full border-dashed"
                    onClick={() => setEditing({ plan: schedule.plan!, shift: null })}
                    data-testid="button-add-flash-shift"
                  >
                    <Plus className="mr-2 h-4 w-4" aria-hidden="true" />
                    新增人工班次
                  </Button>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>

      <ShiftEditorDialog
        state={editing}
        onClose={() => setEditing(null)}
        npcs={npcs}
        locations={locations}
        schedules={{ [today]: normalizeSchedule(todayQuery.data), [tomorrow]: normalizeSchedule(tomorrowQuery.data) }}
        saving={updatePlanMutation.isPending}
        onSave={(plan, shift, values) => {
          const schedule = plan.serviceDate === today
            ? normalizeSchedule(todayQuery.data)
            : normalizeSchedule(tomorrowQuery.data);
          const nextShift: FlashShiftWrite = {
            id: shift?.id,
            npcId: values.npcId,
            locationId: values.locationId,
            startsAt: toShenzhenIso(plan.serviceDate, values.startTime),
            endsAt: toShenzhenIso(plan.serviceDate, values.endTime),
            status: "draft",
            source: "manual",
          };
          const shifts = shift
            ? schedule.shifts.map((item) => (item.id === shift.id ? nextShift : toShiftWrite(item)))
            : [...schedule.shifts.map(toShiftWrite), nextShift];
          updatePlanMutation.mutate({ planId: plan.id, expectedVersion: plan.version, status: plan.status, shifts });
        }}
      />

      <EmergencyScheduleDialog
        schedule={emergencyPlan}
        preview={emergencyPreview}
        locations={locations}
        reason={emergencyReason}
        onReasonChange={setEmergencyReason}
        onClose={() => {
          if (applyEmergencyMutation.isPending) return;
          setEmergencyPlan(null);
          setEmergencyPreview(null);
        }}
        onPreview={(plan, shifts) => previewEmergencyMutation.mutate({ plan, shifts })}
        onApply={() => emergencyPreview && applyEmergencyMutation.mutate({
          preview: emergencyPreview,
          reason: emergencyReason.trim(),
        })}
        previewing={previewEmergencyMutation.isPending}
        applying={applyEmergencyMutation.isPending}
      />

      <Dialog
        open={!!regenerationPreview}
        onOpenChange={(open) => {
          if (!open && !replacePublishedMutation.isPending) setRegenerationPreview(null);
        }}
      >
        <DialogContent className="flex max-h-[90vh] flex-col overflow-hidden sm:max-w-4xl">
          <DialogHeader>
            <DialogTitle>预览新的明日排班</DialogTitle>
            <DialogDescription>
              这里还没有替换线上排班。确认后，新班次会一次性生效，原班次会保留为已取消记录。
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 flex-1 gap-4 overflow-y-auto pr-1 md:grid-cols-2 md:overflow-hidden">
            {[
              { title: "当前已发布", shifts: normalizeSchedule(tomorrowQuery.data).shifts.filter((shift) => shift.status === "published") },
              { title: "新生成预览", shifts: regenerationPreview?.shifts ?? [] },
            ].map((column) => (
              <section key={column.title} className="min-h-0 space-y-3 md:flex md:flex-col">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold">{column.title}</h3>
                  <Badge variant={column.title === "新生成预览" ? "default" : "outline"}>{column.shifts.length} 个班次</Badge>
                </div>
                <div className="space-y-3 md:min-h-0 md:flex-1 md:overflow-y-auto md:pr-1">
                  {column.shifts.map((shift) => (
                    <div key={shift.id} className="rounded-xl border bg-muted/20 p-4">
                      <div className="font-semibold">
                        {shift.npc?.name || npcs.find((npc) => npc.id === shift.npcId)?.name || "未知 NPC"}
                      </div>
                      <div className="mt-2 grid gap-1 text-sm text-muted-foreground">
                        <span>{formatFlashTime(shift.startsAt)}–{formatFlashTime(shift.endsAt)}</span>
                        <span>
                          {shift.location?.district || locations.find((item) => item.id === shift.locationId)?.district || "未设置区域"}
                          ·
                          {shift.location?.name || locations.find((item) => item.id === shift.locationId)?.name || "未设置地点"}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ))}
          </div>

          <div className="shrink-0 space-y-2 border-t pt-4">
            <Label htmlFor="flash-regeneration-reason">重新生成原因</Label>
            <Textarea
              id="flash-regeneration-reason"
              value={regenerationReason}
              onChange={(event) => setRegenerationReason(event.target.value)}
              maxLength={200}
              placeholder="例如：NPC 分布不符合明日运营安排"
              data-testid="input-flash-regeneration-reason"
            />
            <p className="text-xs text-muted-foreground">原因会写入管理员审计日志，至少填写 4 个字。</p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => regenerationPreview?.plan && previewRegenerationMutation.mutate(regenerationPreview.plan)}
              loading={previewRegenerationMutation.isPending}
              disabled={replacePublishedMutation.isPending}
              data-testid="button-preview-another-flash-schedule"
            >
              再生成一版
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => regenerationPreview && replacePublishedMutation.mutate({
                preview: regenerationPreview,
                reason: regenerationReason.trim(),
              })}
              loading={replacePublishedMutation.isPending}
              disabled={regenerationReason.trim().length < 4 || previewRegenerationMutation.isPending}
              data-testid="button-replace-published-flash-schedule"
            >
              确认替换已发布排班
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!confirmAction} onOpenChange={(open) => !open && setConfirmAction(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmAction?.kind === "publish"
                ? "确认发布这份排班？"
                : confirmAction?.kind === "cancel"
                  ? "确认取消这个班次？"
                  : confirmAction?.kind === "regenerate"
                    ? "重新生成已发布的明日排班？"
                    : "确认生成新的次日草案？"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmAction?.kind === "publish"
                ? "发布后班次会按时间自动上线，到点即结束；请先确认时间、NPC 与地点。"
                : confirmAction?.kind === "cancel"
                  ? "取消后该 NPC 不会在这个班次上线，已经解锁的对话仍可继续完成。"
                  : confirmAction?.kind === "regenerate"
                    ? "系统会先生成一份新排班供你预览。只有再次确认后，才会替换当前已发布班次。"
                    : "新的随机草案会替换当前未发布草案；已发布排班不会被改动。"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>先不操作</AlertDialogCancel>
            <AlertDialogAction
              onClick={executeConfirmedAction}
              className={confirmAction?.kind === "cancel" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : undefined}
              data-testid="button-confirm-flash-schedule-action"
            >
              {confirmAction?.kind === "regenerate" ? "生成预览" : "确认"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmergencyScheduleDialog({
  schedule,
  preview,
  locations,
  reason,
  onReasonChange,
  onClose,
  onPreview,
  onApply,
  previewing,
  applying,
}: {
  schedule: FlashScheduleResponse | null;
  preview: EmergencyAdjustmentPreview | null;
  locations: FlashEncounterLocation[];
  reason: string;
  onReasonChange: (value: string) => void;
  onClose: () => void;
  onPreview: (plan: FlashSchedulePlan, shifts: EmergencyAdjustmentShiftWrite[]) => void;
  onApply: () => void;
  previewing: boolean;
  applying: boolean;
}) {
  const [locationId, setLocationId] = useState("");
  const activeShifts = schedule?.shifts.filter((shift) => shift.status === "published") ?? [];
  const sharedLocations = locations.filter((location) => (
    location.isActive && location.approvalStatus === "approved" && location.city === "深圳"
  ));

  useEffect(() => {
    if (!schedule) return;
    const cocoPark = sharedLocations.find((location) => /coco\s*park|购物公园/i.test(`${location.name} ${location.address}`));
    setLocationId(cocoPark?.id ?? "");
  }, [schedule]);

  const buildCoverageShifts = (): EmergencyAdjustmentShiftWrite[] => {
    if (!schedule?.plan) return [];
    const grouped = new Map<string, FlashShift[]>();
    for (const shift of activeShifts) grouped.set(shift.npcId, [...(grouped.get(shift.npcId) ?? []), shift]);
    const ordered: FlashShift[] = [];
    const groups = [...grouped.values()];
    for (const group of groups) if (group[0]) ordered.push(group[0]);
    for (const group of groups) for (const shift of group.slice(1)) ordered.push(shift);
    const slots = [["12:00", "15:00"], ["13:30", "16:30"], ["16:30", "19:30"], ["18:00", "21:00"]];
    return ordered.map((shift, index) => {
      const [start, end] = slots[index] ?? ["18:00", "21:00"];
      return {
        id: shift.id,
        npcId: shift.npcId,
        locationId,
        startsAt: toShenzhenIso(schedule.plan!.serviceDate, start),
        endsAt: toShenzhenIso(schedule.plan!.serviceDate, end),
        source: "manual",
      };
    });
  };

  return (
    <Dialog open={!!schedule} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle>紧急调整今日已发布排班</DialogTitle>
          <DialogDescription>
            仅修改 {schedule?.plan?.serviceDate}。班次 ID 与用户进度保持不变，不影响后续自动排班。
          </DialogDescription>
        </DialogHeader>

        {!preview ? (
          <div className="space-y-4">
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>这是线上即时变更</AlertTitle>
              <AlertDescription>系统会把全部今日班次集中到同一审核地点，并调整为 12:00–21:00 连续覆盖；不会改写 NPC 的常规地点关联。</AlertDescription>
            </Alert>
            <div className="space-y-2">
              <Label htmlFor="emergency-shared-location">统一地点</Label>
              <Select value={locationId} onValueChange={setLocationId}>
                <SelectTrigger id="emergency-shared-location" data-testid="select-emergency-shared-location">
                  <SelectValue placeholder="选择已审核的深圳公共地点" />
                </SelectTrigger>
                <SelectContent>
                  {sharedLocations.map((location) => (
                    <SelectItem key={location.id} value={location.id}>{location.district} · {location.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {buildCoverageShifts().map((shift) => (
                <div key={shift.id} className="rounded-xl border p-3 text-sm">
                  <div className="font-medium">{activeShifts.find((item) => item.id === shift.id)?.npc?.name ?? "NPC"}</div>
                  <div className="mt-1 text-muted-foreground">{formatFlashTime(shift.startsAt)}–{formatFlashTime(shift.endsAt)}</div>
                </div>
              ))}
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button
                type="button"
                onClick={() => schedule?.plan && onPreview(schedule.plan, buildCoverageShifts())}
                disabled={!locationId}
                loading={previewing}
                data-testid="button-preview-emergency-schedule"
              >
                校验并预览
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2">
              {preview.shifts.map((shift) => (
                <div key={shift.id} className="rounded-xl border border-primary/20 bg-primary/5 p-3 text-sm">
                  <div className="font-medium">{shift.npc?.name ?? "NPC"}</div>
                  <div className="mt-1 text-muted-foreground">{formatFlashTime(shift.startsAt)}–{formatFlashTime(shift.endsAt)}</div>
                  <div className="text-muted-foreground">{shift.location?.district} · {shift.location?.name}</div>
                </div>
              ))}
            </div>
            <div className="space-y-2">
              <Label htmlFor="emergency-adjustment-reason">紧急调整原因</Label>
              <Textarea
                id="emergency-adjustment-reason"
                value={reason}
                onChange={(event) => onReasonChange(event.target.value)}
                maxLength={200}
                placeholder="例如：今日运营临时集中至 COCO Park"
              />
              <p className="text-xs text-muted-foreground">原因会写入管理员审计日志，至少填写 4 个字。</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onClose()}>取消</Button>
              <Button
                type="button"
                variant="destructive"
                onClick={onApply}
                disabled={reason.trim().length < 4}
                loading={applying}
                data-testid="button-apply-emergency-schedule"
              >
                确认立即生效
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

function ShiftEditorDialog({
  state,
  onClose,
  npcs,
  locations,
  schedules,
  saving,
  onSave,
}: {
  state: { plan: FlashSchedulePlan; shift: FlashShift | null } | null;
  onClose: () => void;
  npcs: FlashNpc[];
  locations: FlashEncounterLocation[];
  schedules: Record<string, FlashScheduleResponse>;
  saving: boolean;
  onSave: (plan: FlashSchedulePlan, shift: FlashShift | null, values: ShiftFormValues) => void;
}) {
  const { register, handleSubmit, control, watch, reset, formState: { errors } } = useForm<ShiftFormValues>({
    resolver: zodResolver(shiftSchema),
    defaultValues: { npcId: "", locationId: "", startTime: "09:00", endTime: "10:30" },
  });

  const selectedNpcId = watch("npcId");
  const availableLocations = useMemo(
    () => locations.filter((location) => {
      if (!location.isActive || location.approvalStatus !== "approved") return false;
      const ids = getNpcIds(location);
      return ids.length === 0 || !selectedNpcId || ids.includes(selectedNpcId);
    }),
    [locations, selectedNpcId],
  );

  const open = !!state;

  useEffect(() => {
    if (!state) return;
    reset({
      npcId: state.shift?.npcId ?? "",
      locationId: state.shift?.locationId ?? "",
      startTime: state.shift ? formatFlashTime(state.shift.startsAt) : "09:00",
      endTime: state.shift ? formatFlashTime(state.shift.endsAt) : "12:00",
    });
  }, [state, reset]);

  const handleOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) onClose();
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{state?.shift ? "调整班次" : "新增人工班次"}</DialogTitle>
          <DialogDescription>
            单个班次 3–5 小时，只能落在 09:00–21:00。跨 NPC 的间隔与冲突会由服务端再次校验。
          </DialogDescription>
        </DialogHeader>

        {state && (
          <form
            className="space-y-4"
            onSubmit={handleSubmit((values) => onSave(state.plan, state.shift, values))}
          >
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="flash-shift-npc">NPC</Label>
                <Controller
                  name="npcId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="flash-shift-npc" data-testid="select-flash-shift-npc">
                        <SelectValue placeholder="选择 NPC" />
                      </SelectTrigger>
                      <SelectContent>
                        {npcs.filter((npc) => npc.isActive).map((npc) => (
                          <SelectItem key={npc.id} value={npc.id}>{npc.name} · {npc.species}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.npcId && <p className="text-xs text-destructive">{errors.npcId.message}</p>}
              </div>

              <div className="space-y-2">
                <Label htmlFor="flash-shift-location">街头盲盒地点</Label>
                <Controller
                  name="locationId"
                  control={control}
                  render={({ field }) => (
                    <Select value={field.value} onValueChange={field.onChange}>
                      <SelectTrigger id="flash-shift-location" data-testid="select-flash-shift-location">
                        <SelectValue placeholder="选择已审核地点" />
                      </SelectTrigger>
                      <SelectContent>
                        {availableLocations.map((location) => (
                          <SelectItem key={location.id} value={location.id}>
                            {location.district} · {location.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                />
                {errors.locationId && <p className="text-xs text-destructive">{errors.locationId.message}</p>}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="flash-shift-start">开始时间</Label>
                <Input id="flash-shift-start" type="time" min="09:00" max="18:00" {...register("startTime")} />
                {errors.startTime && <p className="text-xs text-destructive">{errors.startTime.message}</p>}
              </div>
              <div className="space-y-2">
                <Label htmlFor="flash-shift-end">结束时间</Label>
                <Input id="flash-shift-end" type="time" min="12:00" max="21:00" {...register("endTime")} />
                {errors.endTime && <p className="text-xs text-destructive">{errors.endTime.message}</p>}
              </div>
            </div>

            <Alert>
              <UserRound className="h-4 w-4" aria-hidden="true" />
              <AlertTitle>{state.plan.serviceDate} · 深圳</AlertTitle>
              <AlertDescription>
                当前草案共有 {schedules[state.plan.serviceDate]?.shifts.length ?? 0} 个班次，保存时会整份校验。
              </AlertDescription>
            </Alert>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={onClose}>取消</Button>
              <Button type="submit" loading={saving} data-testid="button-save-flash-shift">保存班次</Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
