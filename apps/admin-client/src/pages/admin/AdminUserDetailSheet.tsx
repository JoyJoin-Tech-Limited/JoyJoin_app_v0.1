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
} from "lucide-react";
import FieldInfoTooltip from "@/components/discover/FieldInfoTooltip";
import { AdminUserStarRating } from "@/components/admin/AdminUserStarRating";
import {
  calculateAge,
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
import type { UserDetail } from "./types";

interface AdminUserDetailSheetProps {
  selectedUser: string | null;
  onClose: () => void;
  userDetail: UserDetail | undefined;
  isLoadingDetail: boolean;
  onBan: () => void;
  onUnban: () => void;
  onDelete: () => void;
  banPending: boolean;
  unbanPending: boolean;
  deletePending: boolean;
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

export function AdminUserDetailSheet({
  selectedUser,
  onClose,
  userDetail,
  isLoadingDetail,
  onBan,
  onUnban,
  onDelete,
  banPending,
  unbanPending,
  deletePending,
}: AdminUserDetailSheetProps) {
  return (
    <Sheet open={!!selectedUser} onOpenChange={onClose}>
      <SheetContent className="w-full sm:max-w-2xl overflow-hidden flex flex-col p-0">
        <SheetHeader className="px-6 pt-6 pb-4 border-b">
          <SheetTitle className="flex items-center gap-2">
            用户详情
            {userDetail?.user.isAdmin && <Crown className="h-5 w-5 text-amber-500" />}
            {userDetail?.user.isBanned && <Badge variant="destructive">已封禁</Badge>}
          </SheetTitle>
          <SheetDescription>
            {(userDetail?.user.displayName || userDetail?.user.wechatNickname) || '—'} · {userDetail?.user.phoneNumber || userDetail?.user.email || '—'}
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
                        缺少: {userDetail.user.profileCompleteness.missingFields.slice(0, 4).join("、")}
                        {userDetail.user.profileCompleteness.missingFields.length > 4 && "…"}
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
                          {fmtDate(userDetail.user.createdAt)}
                        </p>
                      </div>
                      {userDetail.user.archetype && (
                        <div>
                          <p className="text-xs text-muted-foreground">社交原型</p>
                          {(() => {
                            const style = getArchetypeBadgeStyle(userDetail.user.primaryArchetype || userDetail.user.archetype);
                            return (
                              <Badge variant="outline" style={style ? {
                                backgroundColor: style.backgroundColor,
                                color: style.color,
                                borderColor: style.borderColor,
                              } : undefined}>
                                {userDetail.user.archetype}
                              </Badge>
                            );
                          })()}
                        </div>
                      )}
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
                        {userDetail.onboarding.nextStep}
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

                {!userDetail.user.isAdmin && (
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
                    {userDetail.user.archetype ? (
                      <div className="flex items-center gap-2">
                        {(() => {
                          const style = getArchetypeBadgeStyle(userDetail.user.primaryArchetype || userDetail.user.archetype);
                          return (
                            <Badge className="text-base px-3 py-1" style={style ? {
                              backgroundColor: style.backgroundColor,
                              color: style.color,
                              borderColor: style.borderColor,
                            } : undefined}>
                              {userDetail.user.archetype}
                            </Badge>
                          );
                        })()}
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
                              <p className="text-xs text-muted-foreground">{trait}</p>
                              {traitConfig && (
                                <p className="text-[10px] text-muted-foreground">{traitConfig.chineseName}</p>
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
                          <p className="text-xs text-muted-foreground">行业 niche</p>
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
                              <p className="text-xs text-muted-foreground">{fmtDate(event.dateTime)}</p>
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
                              {fmtDateTimeShort(reg.registeredAt)}
                            </p>
                          </div>
                        ))}
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
                              <div className="flex justify-between items-center">
                                <div>
                                  <p className="text-xs text-muted-foreground">对方: {otherId?.slice(0, 12)}…</p>
                                  <p className="text-xs text-muted-foreground">活动: {conn.eventId?.slice(0, 8)}…</p>
                                </div>
                                <div className="text-right">
                                  <Badge variant="default" className="text-xs">互相连接</Badge>
                                  {conn.revealedAt && (
                                    <p className="text-xs text-muted-foreground mt-0.5">{fmtDate(conn.revealedAt)}</p>
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
                                  <p className="text-xs text-muted-foreground">
                                    对方: {match.partnerName || otherId?.slice(0, 12)}…
                                    {match.partnerArchetype && (
                                      <Badge variant="outline" className="ml-1 text-[10px] font-normal">{match.partnerArchetype}</Badge>
                                    )}
                                  </p>
                                  <p className="text-xs text-muted-foreground">活动: {match.eventTitle || match.eventId?.slice(0, 8)}…</p>
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
                                    <p className="text-xs text-muted-foreground">{fmtDate(match.matchedAt)}</p>
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
                    <ReadinessCheck ok={!!(userDetail.user.archetype || userDetail.user.primaryArchetype)} label="原型已确定" />
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
  );
}

export default AdminUserDetailSheet;
