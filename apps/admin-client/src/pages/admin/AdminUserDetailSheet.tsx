import { useState } from "react";
import { useMutation } from "@tanstack/react-query";
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import {
  Crown,
  Calendar,
  MapPin,
  Clock,
  CheckCircle2,
  XCircle,
  Zap,
  AlertCircle,
  UserX,
  UserCheck,
  Trash2,
  Ban,
} from "lucide-react";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/ui/use-toast";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
import { AdminUserStarRating } from "@/components/admin/AdminUserStarRating";
import {
  calculateAge,
  getGenderDisplay,
  getLifeStageDisplay,
  getRelationshipDisplay,
  getDietaryRestrictionDisplay,
  getLanguagePreferenceDisplay,
  getIntentDisplay,
  getEducationDisplay,
} from "@/lib/userFieldMappings";
import { fmtDate, fmtDateTimeShort } from "@/lib/dateUtils";
import { TRAIT_DISPLAY_CONFIG } from "@shared/personality/traitDisplayConfig";
import { getArchetypeBadgeStyle, getStuckStatus } from "./adminUserBadges";
import { AdminUserInterestCard } from "./AdminUserInterestCard";
import AdminQueryError from "@/components/admin/AdminQueryError";
import { personLabel } from "./personLabel";
import {
  cancelPolicyLabel,
  matchStatusLabel,
  poolStatusLabel,
  shortId,
} from "./adminUserStatusDisplay";
import {
  commercialDisplay,
  entitlementDisplay,
  groupMatchHistoryByEvent,
  joinedEventAttendanceDisplay,
  listCountLabel,
  resolveArchetypeDisplay,
  splitActivityEvents,
} from "./adminUserDetailModel";
import type { UserDetail, UserPoolRegistration } from "./types";

interface AdminUserDetailSheetProps {
  selectedUser: string | null;
  onClose: () => void;
  userDetail: UserDetail | undefined;
  isLoadingDetail: boolean;
  /** Failed `/detail` fetch. Rendered as a retryable surface, never an empty body. */
  detailError?: unknown;
  onRetryDetail?: () => void;
  onBan: () => void;
  onUnban: () => void;
  onDelete: () => void;
  banPending: boolean;
  unbanPending: boolean;
  deletePending: boolean;
  canMutate?: boolean;
}

function OnboardingStep({ done, label }: { done: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {done
        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        : <XCircle className="h-4 w-4 text-muted-foreground shrink-0" />}
      <span className={done ? "text-foreground" : "text-muted-foreground"}>{label}</span>
    </div>
  );
}

const NEXT_STEP_LABELS: Record<string, string> = {
  onboarding: "新手引导",
  setup: "基础设置",
  "personality-test": "性格测试",
  "essential-data": "基础资料",
  extended: "扩展资料",
  "extended-data": "扩展资料",
  review: "资料确认",
  "profile-review": "资料确认",
  discover: "已完成",
  complete: "已完成",
};

function getNextStepLabel(nextStep: string | null | undefined): { label: string; isKnown: boolean } {
  if (!nextStep) return { label: "—", isKnown: true };
  const mapped = NEXT_STEP_LABELS[nextStep];
  return mapped ? { label: mapped, isKnown: true } : { label: nextStep, isKnown: false };
}

function ReadinessCheck({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm py-1">
      {ok
        ? <CheckCircle2 className="h-4 w-4 text-green-500 shrink-0" />
        : <XCircle className="h-4 w-4 text-destructive shrink-0" />}
      <span className={ok ? "" : "text-destructive"}>{label}</span>
    </div>
  );
}

const INACTIVE_MATCH_STATUSES = new Set(["cancelled", "refunded"]);

function isRegistrationCancellable(reg: UserPoolRegistration): boolean {
  if (reg.cancelPolicy) return true;
  return !INACTIVE_MATCH_STATUSES.has(reg.matchStatus ?? "");
}

export function AdminUserDetailSheet({
  selectedUser,
  onClose,
  userDetail,
  isLoadingDetail,
  detailError,
  onRetryDetail,
  onBan,
  onUnban,
  onDelete,
  banPending,
  unbanPending,
  deletePending,
  canMutate = true,
}: AdminUserDetailSheetProps) {
  const { toast } = useToast();
  const [cancelTarget, setCancelTarget] = useState<UserPoolRegistration | null>(null);
  const [cancelReason, setCancelReason] = useState("");

  // Pure derivations — computed once per render so the JSX cannot show two
  // different counts for the same list.
  const activitySplit = userDetail
    ? splitActivityEvents(userDetail.joinedEvents, userDetail.poolRegistrations)
    : null;
  const standaloneEvents = activitySplit?.standaloneEvents ?? [];
  const matchedPoolEventCount = activitySplit?.eventByPoolId.size ?? 0;
  const tablemateGroups = userDetail
    ? groupMatchHistoryByEvent(userDetail.matchHistory, userDetail.user.id)
    : [];
  const entitlement = entitlementDisplay(userDetail?.entitlement);
  const commercial = commercialDisplay(userDetail?.commercial);

  const cancelMutation = useMutation({
    mutationFn: async ({ id, reason }: { id: string; reason: string }) => {
      const res = await apiRequest("POST", `/api/admin/pool-registrations/${id}/cancel`, { reason });
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/users"] });
      setCancelTarget(null);
      setCancelReason("");
      toast({
        title: "已代客取消报名",
        description: "该活动池报名已取消，退款/顺延按当前政策自动处理",
      });
    },
    onError: (error: Error) => {
      toast({
        title: "取消失败",
        description: error.message.replace(/^\d{3}:\s*/, "") || "无法取消该报名，请重试",
        variant: "destructive",
      });
    },
  });

  const openCancelDialog = (reg: UserPoolRegistration) => {
    setCancelReason("");
    setCancelTarget(reg);
  };

  const confirmCancel = () => {
    if (!cancelTarget) return;
    const reason = cancelReason.trim();
    if (reason.length < 5) {
      toast({
        title: "请填写取消原因",
        description: "原因至少 5 个字符，将记录到审计日志",
        variant: "destructive",
      });
      return;
    }
    cancelMutation.mutate({ id: cancelTarget.id, reason });
  };

  return (
    <Sheet open={!!selectedUser} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            用户详情
            {userDetail?.user.isAdmin && <Crown className="h-5 w-5 text-amber-500" />}
            {userDetail?.user.isTestBot && (
              <Badge variant="outline" className="text-xs font-normal">测试机器人</Badge>
            )}
            {userDetail?.user.isBanned && <Badge variant="destructive">已封禁</Badge>}
          </SheetTitle>
          <SheetDescription>
            {userDetail ? personLabel(userDetail.user) : "—"} · {userDetail?.user.phoneNumber || userDetail?.user.email || '—'}
          </SheetDescription>
        </SheetHeader>

        {isLoadingDetail ? (
          <div className="flex-1 p-6 space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <div key={i} className="h-4 bg-muted rounded animate-pulse" style={{ width: `${60 + i * 10}%` }} />
            ))}
          </div>
        ) : detailError ? (
          <div className="flex-1 p-6">
            <AdminQueryError
              title="用户详情加载失败"
              error={detailError}
              onRetry={onRetryDetail}
            />
          </div>
        ) : userDetail ? (
          <Tabs defaultValue="overview" className="flex-1 flex flex-col overflow-hidden" aria-label="用户详情标签页">
            <TabsList className="mx-6 mt-4 mb-0 shrink-0 flex flex-wrap h-auto gap-1 justify-start bg-muted/50">
              <TabsTrigger value="overview" className="text-xs">概览</TabsTrigger>
              <TabsTrigger value="portrait" className="text-xs">用户画像</TabsTrigger>
              <TabsTrigger value="activity" className="text-xs">活动历史</TabsTrigger>
              <TabsTrigger value="connections" className="text-xs">连接关系</TabsTrigger>
              <TabsTrigger value="tablemates" className="text-xs">同桌历史</TabsTrigger>
            </TabsList>

            <ScrollArea className="flex-1 px-6 pt-4 pb-6">
              <TabsContent value="overview" className="mt-0 space-y-4">
                <Card className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-muted-foreground">资料完整度</span>
                      <FieldInfoTooltip
                        title="资料完整度"
                        description="基于用户填写的必填字段计算得出。5星 = 100%完整，缺失字段越少评分越高。完整度影响匹配质量和用户体验。"
                      />
                    </div>
                    <div className="flex items-center gap-3">
                      <AdminUserStarRating rating={userDetail.user.profileCompleteness.starRating} />
                      <span className="font-semibold">{userDetail.user.profileCompleteness.score}% 完整</span>
                    </div>
                    {userDetail.user.profileCompleteness.missingFields.length > 0 && (
                      <span className="text-xs text-muted-foreground">
                        缺少 {userDetail.user.profileCompleteness.missingFields.length} 项：
                        {userDetail.user.profileCompleteness.missingFields.slice(0, 4).join("、")}
                        {userDetail.user.profileCompleteness.missingFields.length > 4 && " 等"}
                      </span>
                    )}
                  </div>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">基本信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      <div>
                        <p className="text-xs text-muted-foreground">昵称</p>
                        <p className="font-medium">{userDetail.user.displayName || userDetail.user.wechatNickname || '未设置'}</p>
                      </div>
                      <div>
                        <p className="text-xs text-muted-foreground">手机/邮箱</p>
                        <p className="font-medium truncate">{userDetail.user.phoneNumber || userDetail.user.email || '—'}</p>
                      </div>
                      {userDetail.user.gender && (
                        <div>
                          <p className="text-xs text-muted-foreground">性别</p>
                          <p className="font-medium">{getGenderDisplay(userDetail.user.gender)}</p>
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
                          {fmtDate(userDetail.user.createdAt)}
                        </p>
                      </div>
                      {(() => {
                        // Chinese name first: `primaryArchetype` is a machine id
                        // and `archetype` is a legacy Chinese name — neither is a
                        // thing to show an operator raw.
                        const archetype = resolveArchetypeDisplay(
                          userDetail.user.primaryArchetype || userDetail.user.archetype,
                        );
                        if (!archetype) return null;
                        const style = getArchetypeBadgeStyle(archetype.styleKey);
                        return (
                          <div>
                            <p className="text-xs text-muted-foreground">社交原型</p>
                            <div className="flex flex-wrap items-baseline gap-1.5">
                              <Badge variant="outline" style={style ? {
                                backgroundColor: style.backgroundColor,
                                color: style.color,
                                borderColor: style.borderColor,
                              } : undefined}>
                                {archetype.name}
                              </Badge>
                              {archetype.id && (
                                <span className="text-[10px] text-muted-foreground">{archetype.id}</span>
                              )}
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                    <div className="flex gap-2 pt-1">
                      {userDetail.user.isAdmin && <Badge variant="secondary"><Crown className="h-3 w-3 mr-1" />管理员</Badge>}
                      {(() => {
                        const stuck = getStuckStatus(userDetail.user);
                        return stuck.isStuck ? <Badge variant={stuck.variant} className="text-xs">{stuck.label}</Badge> : null;
                      })()}
                      {userDetail.user.isBanned && <Badge variant="destructive">已封禁</Badge>}
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        注册进度
                        <FieldInfoTooltip
                          title="注册进度"
                          description="显示用户当前所处的 onboarding 阶段。nextStep 是服务端计算出的下一步引导目标。已完成的步骤越多，用户参与匹配的 readiness 越高。"
                        />
                      </span>
                      <Badge variant="outline" className="text-xs font-normal">
                        <Clock className="h-3 w-3 mr-1" />
                        {(() => {
                          const { label, isKnown } = getNextStepLabel(userDetail.onboarding.nextStep);
                          return isKnown ? label : <span className="text-muted-foreground">{label}</span>;
                        })()}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1.5">
                    <OnboardingStep done={userDetail.onboarding.hasCompletedPersonalityTest} label="人格测试完成" />
                    <OnboardingStep done={userDetail.onboarding.profileEssentialComplete} label="基本资料完成" />
                    <OnboardingStep done={userDetail.onboarding.hasCompletedInterestsCarousel} label="兴趣偏好完成" />
                    <OnboardingStep done={userDetail.onboarding.hasSeenProfileReview} label="资料预览完成" />
                  </CardContent>
                </Card>

                {/* 匹配就绪度 lives here (it used to be a sixth tab): readiness is a
                    property of this user, not a history surface. */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        匹配就绪度
                        <FieldInfoTooltip
                          title="匹配就绪度"
                          description="服务端在详情接口中计算的就绪状态：人格测试、原型、基本资料、兴趣数据、账号状态。任一项不满足即无法进入排桌。"
                        />
                      </span>
                      {userDetail.matchingReadiness.isReady ? (
                        <Badge className="bg-green-500 hover:bg-green-500">
                          <Zap className="h-3 w-3 mr-1" />已就绪
                        </Badge>
                      ) : (
                        <Badge variant="destructive">未就绪</Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-0.5">
                    <ReadinessCheck ok={!!userDetail.onboarding.hasCompletedPersonalityTest} label="人格测试完成" />
                    <ReadinessCheck ok={!!(userDetail.user.archetype || userDetail.user.primaryArchetype)} label="原型已确定" />
                    <ReadinessCheck ok={userDetail.onboarding.profileEssentialComplete} label="基本资料完整 (昵称/性别/城市)" />
                    <ReadinessCheck ok={!!userDetail.onboarding.hasCompletedInterestsCarousel} label="兴趣数据完整" />
                    <ReadinessCheck ok={!userDetail.user.isBanned} label="账号状态正常 (未被封禁)" />
                    {!userDetail.matchingReadiness.isReady && userDetail.matchingReadiness.blockers.length > 0 && (
                      <p className="flex items-start gap-2 pt-2 mt-1 border-t text-sm text-destructive">
                        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                        <span>阻断：{userDetail.matchingReadiness.blockers.join("、")}</span>
                      </p>
                    )}
                  </CardContent>
                </Card>

                {/* 权益快照 — read from the same resolver as the registration
                    gate. `users.event_credits` is never consulted here. */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        权益快照
                        <FieldInfoTooltip
                          title="权益快照"
                          description="与报名校验使用同一个服务端判定顺序：订阅中 → 局包 → 无权益。测试环境单独标记，不校验真实权益。"
                        />
                      </span>
                      <Badge
                        variant={
                          entitlement.tone === "active"
                            ? "default"
                            : entitlement.tone === "credits"
                              ? "secondary"
                              : "outline"
                        }
                        className="text-xs font-normal"
                      >
                        {entitlement.modeLabel}
                      </Badge>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-1">
                    <p className="text-sm font-medium">{entitlement.detail}</p>
                    <p className="text-xs text-muted-foreground">
                      判定顺序：订阅 → 局包 → 无权益；订阅期间不占用局包次数。
                    </p>
                  </CardContent>
                </Card>

                {/* 消费与出席 — money and attendance in one snapshot. */}
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        消费与出席
                        <FieldInfoTooltip
                          title="消费与出席"
                          description="实付金额与付费订单来自已完成的支付记录；出席按签到记录统计（已签到 / 迟到），分母为已排桌报名场次。"
                        />
                      </span>
                      {commercial && (
                        <Badge
                          variant={userDetail.commercial?.isRepeat ? "default" : "outline"}
                          className="text-xs font-normal"
                        >
                          {commercial.repeat}
                        </Badge>
                      )}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {commercial ? (
                      <div className="space-y-2 text-sm">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                          <div>
                            <p className="text-xs text-muted-foreground">累计实付</p>
                            <p className="font-medium tabular-nums">{commercial.totalPaid}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">付费订单</p>
                            <p className="font-medium tabular-nums">{commercial.paidOrders}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">已出席</p>
                            <p className="font-medium tabular-nums">{commercial.attended}</p>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground">最近出席</p>
                            <p className="font-medium">{commercial.recentAttended}</p>
                          </div>
                          <div className="col-span-2">
                            <p className="text-xs text-muted-foreground">出席率（已出席 / 已排桌）</p>
                            <p className="font-medium tabular-nums">
                              {commercial.attendanceRate ??
                                commercial.attendanceRateNote ??
                                "尚无已排桌场次，无法计算"}
                            </p>
                          </div>
                        </div>
                        <p className="text-xs text-muted-foreground">
                          只统计签到成功的场次；未签到与待确认不计入出席。
                        </p>
                      </div>
                    ) : (
                      <p className="text-sm text-muted-foreground">详情接口未返回消费与出席快照</p>
                    )}
                  </CardContent>
                </Card>

                {!userDetail.user.isAdmin && canMutate && (
                  <div className="flex gap-2">
                    <Button
                      variant={userDetail.user.isBanned ? "default" : "destructive"}
                      className="flex-1"
                      onClick={() => userDetail.user.isBanned ? onUnban() : onBan()}
                      disabled={banPending || unbanPending}
                      data-testid={userDetail.user.isBanned ? "button-unban-user" : "button-ban-user"}
                    >
                      {userDetail.user.isBanned ? <><UserCheck className="h-4 w-4 mr-2" />解除封禁</> : <><UserX className="h-4 w-4 mr-2" />封禁用户</>}
                    </Button>
                    <Button
                      variant="default"
                      className="flex-1 bg-black hover:bg-black/80 text-white"
                      onClick={onDelete}
                      disabled={deletePending}
                      data-testid="button-delete-user-data"
                    >
                      <Trash2 className="h-4 w-4 mr-2" />
                      删除用户数据
                    </Button>
                  </div>
                )}
              </TabsContent>

              <TabsContent value="portrait" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center gap-1.5">
                      性格原型
                      <FieldInfoTooltip
                        title="性格原型"
                        description="用户通过 JoyJoin 人格测试（ACOEXP 6维度模型）获得的12原型分类结果。原型影响匹配算法中的化学反应分数和社交破冰环节的话题推荐。"
                      />
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    {(() => {
                      const archetype = resolveArchetypeDisplay(
                        userDetail.user.primaryArchetype || userDetail.user.archetype,
                      );
                      if (!archetype) {
                        return <p className="text-sm text-muted-foreground">未确定原型</p>;
                      }
                      const style = getArchetypeBadgeStyle(archetype.styleKey);
                      return (
                        <div className="flex flex-wrap items-baseline gap-2">
                          <Badge className="text-base px-3 py-1" style={style ? {
                            backgroundColor: style.backgroundColor,
                            color: style.color,
                            borderColor: style.borderColor,
                          } : undefined}>
                            {archetype.name}
                          </Badge>
                          {archetype.id && (
                            <span className="text-xs text-muted-foreground">{archetype.id}</span>
                          )}
                        </div>
                      );
                    })()}
                    {userDetail.assessmentSession?.matchDetailsJson && (() => {
                      const secondary = resolveArchetypeDisplay(
                        userDetail.assessmentSession.matchDetailsJson.secondaryArchetype,
                      );
                      if (!secondary) return null;
                      // The stored `decisiveReason` is machine prose ("Gap 34% with
                      // high confidence"). There is no honest Chinese restatement
                      // from a percentage gap, so it is not rendered at all.
                      return (
                        <p className="text-xs text-muted-foreground">
                          次要原型:{" "}
                          <Badge variant="outline" className="text-xs">{secondary.name}</Badge>
                          {secondary.id && <span className="ml-1.5 text-[10px]">{secondary.id}</span>}
                        </p>
                      );
                    })()}
                  </CardContent>
                </Card>

                {userDetail.assessmentSession?.traitScores && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">人格特质得分</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid grid-cols-3 gap-2">
                        {Object.entries(userDetail.assessmentSession.traitScores).map(([trait, score]) => {
                          const traitConfig = TRAIT_DISPLAY_CONFIG[trait];
                          return (
                            <div key={trait} className="text-center p-2 rounded-md bg-muted/50">
                              <p className="text-lg font-bold">{typeof score === 'number' ? score.toFixed(1) : score}</p>
                              <p className="text-xs font-medium">{traitConfig?.chineseName ?? trait}</p>
                              {traitConfig && (
                                <p className="text-[10px] text-muted-foreground">{trait}</p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </CardContent>
                  </Card>
                )}

                {userDetail.user.intent && userDetail.user.intent.length > 0 && (
                  <Card>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm">社交意向</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex flex-wrap gap-1.5">
                        {userDetail.user.intent.map((i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {getIntentDisplay(i)}
                          </Badge>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                )}

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm">背景信息</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-2 text-sm">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2">
                      {userDetail.user.birthdate && (
                        <div>
                          <p className="text-xs text-muted-foreground">年龄</p>
                          <p className="font-medium">{calculateAge(userDetail.user.birthdate)} 岁</p>
                        </div>
                      )}
                      {userDetail.user.educationLevel && (
                        <div>
                          <p className="text-xs text-muted-foreground">学历</p>
                          <p className="font-medium">{getEducationDisplay(userDetail.user.educationLevel)}</p>
                        </div>
                      )}
                      {userDetail.user.lifeStage && (
                        <div>
                          <p className="text-xs text-muted-foreground">人生阶段</p>
                          <p className="font-medium">{getLifeStageDisplay(userDetail.user.lifeStage)}</p>
                        </div>
                      )}
                      {userDetail.user.relationshipStatus && (
                        <div>
                          <p className="text-xs text-muted-foreground">感情状态</p>
                          <p className="font-medium">{getRelationshipDisplay(userDetail.user.relationshipStatus)}</p>
                        </div>
                      )}
                      {(userDetail.user.industryCategoryLabel || userDetail.user.industryCategory) && (
                        <div>
                          <p className="text-xs text-muted-foreground">行业</p>
                          <p className="font-medium">{userDetail.user.industryCategoryLabel || userDetail.user.industryCategory}</p>
                        </div>
                      )}
                      {userDetail.user.industrySegmentLabel && (
                        <div>
                          <p className="text-xs text-muted-foreground">行业细分</p>
                          <p className="font-medium">{userDetail.user.industrySegmentLabel}</p>
                        </div>
                      )}
                      {userDetail.user.industryNicheLabel && (
                        <div>
                          <p className="text-xs text-muted-foreground">细分行业</p>
                          <p className="font-medium">{userDetail.user.industryNicheLabel}</p>
                        </div>
                      )}
                      {userDetail.user.industryRawInput && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">职业原始输入</p>
                          <p className="font-medium">{userDetail.user.industryRawInput}</p>
                        </div>
                      )}
                      {userDetail.user.bio && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground">个人签名</p>
                          <p className="font-medium whitespace-pre-wrap">{userDetail.user.bio}</p>
                        </div>
                      )}
                      {userDetail.user.wechatContactId && (
                        <div>
                          <p className="text-xs text-muted-foreground">微信号</p>
                          <p className="font-medium">{userDetail.user.wechatContactId}</p>
                        </div>
                      )}
                      {userDetail.user.preferredLanguages && userDetail.user.preferredLanguages.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">语言偏好</p>
                          <div className="flex flex-wrap gap-1.5">
                            {userDetail.user.preferredLanguages.map((lang) => (
                              <Badge key={lang} variant="secondary" className="text-xs">
                                {getLanguagePreferenceDisplay(lang)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {userDetail.user.dietaryRestrictions && userDetail.user.dietaryRestrictions.length > 0 && (
                        <div className="col-span-2">
                          <p className="text-xs text-muted-foreground mb-1">忌口偏好</p>
                          <div className="flex flex-wrap gap-1.5">
                            {userDetail.user.dietaryRestrictions.map((d) => (
                              <Badge key={d} variant="secondary" className="text-xs">
                                {getDietaryRestrictionDisplay(d)}
                              </Badge>
                            ))}
                          </div>
                        </div>
                      )}
                      {userDetail.user.hometownRegionCity && (
                        <div>
                          <p className="text-xs text-muted-foreground">家乡</p>
                          <p className="font-medium flex items-center gap-1"><MapPin className="h-3 w-3" />{userDetail.user.hometownRegionCity}</p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>

                {/* Always rendered: 「尚未填写兴趣」 is a real, operationally
                    relevant state, not a reason to hide the card. */}
                <AdminUserInterestCard interests={userDetail.interests} />
              </TabsContent>

              <TabsContent value="activity" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between gap-2">
                      <span>参与活动</span>
                      <span className="flex items-baseline gap-2">
                        {activitySplit && activitySplit.cancelledCount > 0 && (
                          <span className="text-xs font-normal text-muted-foreground">
                            另有 {activitySplit.cancelledCount} 场已取消未计入
                          </span>
                        )}
                        <Badge variant="outline" className="font-normal">{standaloneEvents.length}</Badge>
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {standaloneEvents.length === 0 ? (
                      <p className="text-sm text-muted-foreground">
                        {matchedPoolEventCount > 0
                          ? "已排桌场次见下方活动池报名，此处不重复"
                          : userDetail.joinedEvents.length > 0
                            ? "活动均已取消，不计入参与"
                            : "尚未参与任何活动"}
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {standaloneEvents.map((event) => {
                          const attendance = joinedEventAttendanceDisplay(event);
                          return (
                            <div key={event.id} className="flex justify-between items-start gap-3 text-sm border-l-2 border-primary pl-3 py-1">
                              <div className="min-w-0">
                                <p className="font-medium truncate">{event.title || "未命名活动"}</p>
                                <p className="text-xs text-muted-foreground">
                                  {[event.eventType, event.attendeeCount != null ? `${event.attendeeCount} 人出席` : null]
                                    .filter((part) => part != null && part !== "")
                                    .join(" · ") || "—"}
                                </p>
                              </div>
                              <div className="text-right shrink-0">
                                <p className="text-xs text-muted-foreground">{fmtDate(event.dateTime)}</p>
                                {attendance && (
                                  <Badge variant="outline" className="text-xs mt-0.5">
                                    {attendance}
                                  </Badge>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>活动池报名</span>
                      <Badge variant="outline" className="font-normal">
                        {listCountLabel(userDetail.poolRegistrations.length)}
                      </Badge>
                    </CardTitle>
                    {userDetail.poolRegistrations.length > 0 && (
                      <p className="text-xs text-muted-foreground pt-1">
                        同桌整体分是这一桌的评分，同组每位成员数值相同。
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {userDetail.poolRegistrations.length === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无活动池报名记录</p>
                    ) : (
                      <div className="space-y-2">
                        {userDetail.poolRegistrations.map((reg) => {
                          const poolEvent = activitySplit?.eventByPoolId.get(reg.poolId);
                          const attendance = poolEvent ? joinedEventAttendanceDisplay(poolEvent) : null;
                          const statusLabel = poolStatusLabel(reg.poolStatus);
                          return (
                            <div key={reg.id} className="text-sm border rounded-md px-3 py-2">
                              <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium truncate">
                                    {reg.poolTitle || `场次 ${shortId(reg.poolId)}`}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {[
                                      reg.poolEventType,
                                      statusLabel || null,
                                      reg.poolDateTime ? fmtDate(reg.poolDateTime) : null,
                                      [reg.poolCity, reg.poolDistrict].filter(Boolean).join(" "),
                                    ]
                                      .filter(Boolean)
                                      .join(" · ") || "场次信息缺失"}
                                  </p>
                                  {reg.assignedGroupId && (
                                    <p className="text-xs text-green-600">
                                      已排桌 · {reg.groupNumber != null ? `第 ${reg.groupNumber} 组` : `分组 ${shortId(reg.assignedGroupId)}`}
                                    </p>
                                  )}
                                  {poolEvent && (
                                    <p className="text-xs text-muted-foreground">
                                      {[
                                        attendance,
                                        poolEvent.attendeeCount != null ? `${poolEvent.attendeeCount} 人出席` : null,
                                      ]
                                        .filter(Boolean)
                                        .join(" · ") || "签到状态未记录"}
                                    </p>
                                  )}
                                </div>
                                <div className="text-right space-y-0.5 shrink-0">
                                  <Badge
                                    variant={reg.matchStatus === 'matched' ? 'default' : reg.matchStatus === 'pending' ? 'secondary' : 'outline'}
                                    className="text-xs"
                                  >
                                    {matchStatusLabel(reg.matchStatus)}
                                  </Badge>
                                  {reg.matchScore != null && (
                                    <p className="text-xs text-muted-foreground">同桌整体分 {reg.matchScore}/100</p>
                                  )}
                                </div>
                              </div>
                              <p className="text-xs text-muted-foreground mt-1">
                                报名于 {fmtDateTimeShort(reg.registeredAt)}
                              </p>
                              {canMutate && isRegistrationCancellable(reg) && (
                                <div className="mt-2 flex justify-end">
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-destructive border-destructive/40 hover:bg-destructive/10"
                                    onClick={() => openCancelDialog(reg)}
                                    data-testid={`button-cancel-registration-${reg.id}`}
                                  >
                                    <Ban className="h-3 w-3 mr-1" />
                                    代客取消
                                  </Button>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

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
                              <div className="flex justify-between items-start gap-3">
                                <div className="min-w-0">
                                  <p className="font-medium flex items-center gap-1.5">
                                    <span className="truncate">{conn.partnerName || `用户 ${shortId(otherId, 8)}`}</span>
                                    {conn.partnerArchetype && (
                                      <Badge variant="outline" className="text-[10px] font-normal shrink-0">
                                        {conn.partnerArchetype}
                                      </Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {conn.eventTitle || `活动 ${shortId(conn.eventId)}`}
                                    {conn.eventDateTime ? ` · ${fmtDate(conn.eventDateTime)}` : ""}
                                  </p>
                                </div>
                                <div className="text-right shrink-0">
                                  <Badge variant="default" className="text-xs">互相连接</Badge>
                                  {conn.revealedAt && (
                                    <p className="text-xs text-muted-foreground mt-0.5">揭晓于 {fmtDate(conn.revealedAt)}</p>
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

              <TabsContent value="tablemates" className="mt-0 space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-sm flex items-center justify-between">
                      <span>同桌历史</span>
                      <span className="text-xs font-normal text-muted-foreground">
                        {listCountLabel(userDetail.matchHistory.length)} 配对 · {tablemateGroups.length} 桌
                      </span>
                    </CardTitle>
                    {userDetail.matchHistory.length > 0 && (
                      <p className="text-xs text-muted-foreground pt-1">
                        一桌一张卡；「愿意再聚」按配对统计（双方都选愿意才算），不是同桌整体结果。
                      </p>
                    )}
                  </CardHeader>
                  <CardContent>
                    {tablemateGroups.length === 0 ? (
                      <p className="text-sm text-muted-foreground">暂无同桌记录</p>
                    ) : (
                      <div className="space-y-2">
                        {tablemateGroups.map((table) => (
                          <div key={table.eventId} className="text-sm border rounded-md px-3 py-2 space-y-2">
                            <div className="flex justify-between items-start gap-3">
                              <div className="min-w-0">
                                <p className="font-medium truncate">
                                  {table.eventTitle || `活动 ${shortId(table.eventId)}`}
                                </p>
                                <p className="text-xs text-muted-foreground">
                                  {fmtDate(table.eventDateTime || table.matchedAt)}
                                </p>
                              </div>
                              <div className="text-right shrink-0 space-y-0.5">
                                <Badge variant="outline" className="text-xs">
                                  同桌 {table.tableSize} 人
                                </Badge>
                                <p className="text-xs text-muted-foreground">
                                  {table.answeredPairs === 0
                                    ? "尚无再聚反馈"
                                    : `愿意再聚 ${table.willingPairs}/${table.answeredPairs}`}
                                </p>
                              </div>
                            </div>
                            <div className="flex flex-wrap gap-1.5 pt-1 border-t">
                              {table.partners.map((partner) => (
                                <span
                                  key={partner.key}
                                  className="inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs"
                                >
                                  <span className="truncate max-w-[10rem]">{partner.name}</span>
                                  {partner.archetype && (
                                    <span className="text-muted-foreground">{partner.archetype.name}</span>
                                  )}
                                </span>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

            </ScrollArea>
          </Tabs>
        ) : null}

        <AlertDialog open={!!cancelTarget} onOpenChange={(open) => !open && setCancelTarget(null)}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>代客取消活动池报名</AlertDialogTitle>
              <AlertDialogDescription asChild>
                <div className="space-y-2">
                  <p>
                    将为该用户取消活动池报名（{cancelTarget?.poolTitle || `场次 ${shortId(cancelTarget?.poolId)}`}）。
                    该操作将记录审计日志。
                  </p>
                  {cancelTarget?.cancelPolicy && (
                    <p className="text-amber-600 dark:text-amber-500">
                      当前取消政策：{cancelPolicyLabel(cancelTarget.cancelPolicy)}
                    </p>
                  )}
                </div>
              </AlertDialogDescription>
            </AlertDialogHeader>
            <div className="space-y-2 py-2">
              <label htmlFor="admin-cancel-reason" className="text-sm font-medium">
                取消原因（至少 5 个字符）
              </label>
              <Textarea
                id="admin-cancel-reason"
                placeholder="例如：用户来电申请取消本期报名"
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                data-testid="input-cancel-reason"
              />
            </div>
            <AlertDialogFooter>
              <AlertDialogCancel data-testid="button-cancel-dialog-close">返回</AlertDialogCancel>
              <AlertDialogAction
                onClick={(e) => {
                  e.preventDefault();
                  confirmCancel();
                }}
                disabled={cancelMutation.isPending}
                data-testid="button-confirm-cancel-registration"
              >
                {cancelMutation.isPending ? "取消中..." : "确认代客取消"}
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </SheetContent>
    </Sheet>
  );
}

export default AdminUserDetailSheet;
