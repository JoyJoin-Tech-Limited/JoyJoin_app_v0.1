import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Store, MapPin, UserPlus, ChevronDown, MapPinned } from "lucide-react";
import AdminQueryError from "@/components/admin/AdminQueryError";
import { safeFormat } from "@/lib/dateUtils";
import { zhCN } from "date-fns/locale";
import type {
  AdminEventPool,
  AdminPoolRegistration,
  PoolGroup,
  PairScoreEntry,
} from "./types";

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

const TEMPERATURE_LABELS: Record<string, string> = {
  fire: "热烈",
  warm: "温暖",
  mild: "温和",
};

const formatPoolDateTime = (dateTimeStr: string) =>
  safeFormat(dateTimeStr, "yyyy年MM月dd日 HH:mm", { locale: zhCN, fallback: dateTimeStr });

function ReasonBadge({ reason }: { reason: string }) {
  const config = REASON_LABELS[reason] || { label: reason, variant: "outline" as const };
  return <Badge variant={config.variant} className="text-xs">{config.label}</Badge>;
}

interface EventPoolDetailDialogProps {
  pool: AdminEventPool | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  registrations: AdminPoolRegistration[];
  isLoadingRegistrations: boolean;
  groups: PoolGroup[];
  isLoadingGroups: boolean;
  pairScores: PairScoreEntry[];
  pairScoresError: unknown;
  onRetryPairScores: () => void;
  addMemberGroupId: string | null;
  onAddMemberOpenChange: (groupId: string | null) => void;
  onAddMember: (group: PoolGroup, registrationId: string) => void;
  onAssignVenue: (group: PoolGroup) => void;
  assignVenuePending: boolean;
  canMutate?: boolean;
}

export default function EventPoolDetailDialog({
  pool,
  open,
  onOpenChange,
  registrations,
  isLoadingRegistrations,
  groups,
  isLoadingGroups,
  pairScores,
  pairScoresError,
  onRetryPairScores,
  addMemberGroupId,
  onAddMemberOpenChange,
  onAddMember,
  onAssignVenue,
  assignVenuePending,
  canMutate = true,
}: EventPoolDetailDialogProps) {
  const safeRegistrations = Array.isArray(registrations) ? registrations : [];
  const safeGroups = Array.isArray(groups) ? groups : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{pool?.title} — 池内情况</DialogTitle>
        </DialogHeader>

        {!pool ? (
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
                  {pool.city}
                  {pool.district ? ` · ${pool.district}` : ""}
                </div>
              </div>
              <div>
                <div className="text-muted-foreground">创建时间</div>
                <div>
                  {pool.createdAt && formatPoolDateTime(pool.createdAt)}
                </div>
              </div>
            </div>

            {/* 报名情况 */}
            <div className="border-t pt-4 space-y-3">
              <h3 className="font-semibold">池中报名用户</h3>
              <div className="text-xs text-muted-foreground">
                总报名：{pool.registrationCount ?? 0}，已匹配：
                {pool.matchedCount ?? 0}，待匹配：
                {pool.pendingCount ?? 0}
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
                        报名时间：{formatPoolDateTime(reg.registeredAt)}
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
                    const maxSize = pool?.maxGroupSize ?? 6;
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
                            {canMutate && (
                            <Popover
                              open={addMemberGroupId === group.id}
                              onOpenChange={(openState) => onAddMemberOpenChange(openState ? group.id : null)}
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
                                        onClick={() => onAddMember(group, reg.id)}
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
                            )}
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
                              {canMutate && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="h-7 text-xs"
                                  onClick={() => onAssignVenue(group)}
                                  disabled={assignVenuePending}
                                  data-testid={`button-assign-venue-${groupIdx}`}
                                >
                                  <MapPinned className="h-3 w-3 mr-1" />
                                  分配场地
                                </Button>
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
            {pairScoresError ? (
              <div className="space-y-3">
                <h3 className="font-semibold">匹配质量矩阵</h3>
                <AdminQueryError
                  title="匹配质量数据加载失败"
                  error={pairScoresError}
                  onRetry={onRetryPairScores}
                />
              </div>
            ) : pairScores.length > 0 ? (
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
                                {TEMPERATURE_LABELS[score.temperatureLevel] ?? "冷静"}
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
            ) : null}

            <div className="border-t pt-4 text-[11px] text-muted-foreground">
              提示：这里只负责展示这个池子里有哪些人、已经开了哪些组。
              真正的桌子详情和状态管理在「盲盒活动管理」页面完成，避免功能重叠。
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
