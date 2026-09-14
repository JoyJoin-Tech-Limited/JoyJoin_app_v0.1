import { notifyOpsMarkdown, notifyCriticalMarkdown, buildAdminUrl } from "../wecomNotifier";

export interface PoolMatchedPayload {
  poolTitle: string;
  poolDate: string;
  totalRegistrations: number;
  matchedCount: number;
  unmatchedCount: number;
  groupsFormed: number;
  avgOverallScore: number;
  avgChemistryScore: number;
  genderBalanceSummary: string;
  matchDurationMin: number;
  poolId: string;
}

export async function notifyPoolMatched(payload: PoolMatchedPayload): Promise<void> {
  const lines: string[] = [
    `**活动：** ${payload.poolTitle} | ${payload.poolDate}`,
    `**报名：** ${payload.totalRegistrations} 人 → ${payload.groupsFormed} 组`,
    `**匹配情况：** ✅ ${payload.matchedCount} 人已匹配${payload.unmatchedCount > 0 ? ` · ❌ ${payload.unmatchedCount} 人未匹配` : ""}`,
    "",
    "**匹配质量：**",
    `- 综合评分：${payload.avgOverallScore.toFixed(1)}/10`,
    `- 化学评分：${payload.avgChemistryScore.toFixed(1)}/10`,
    `- 性别比例：${payload.genderBalanceSummary}`,
    `- 匹配耗时：${payload.matchDurationMin} 分钟`,
  ];

  if (payload.unmatchedCount > 0) {
    lines.push("", `⚠️ **需关注：** ${payload.unmatchedCount} 人未匹配成功，建议联系了解原因或推荐其他活动`);
  }
  if (payload.avgOverallScore < 6.0) {
    lines.push(`⚠️ **匹配质量偏低（${payload.avgOverallScore.toFixed(1)}分），建议人工检查分组合理性**`);
  }

  lines.push("", `[查看匹配详情 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)})`);

  await notifyOpsMarkdown("🔗 匹配完成", lines);
}

export interface VenueAssignmentResultPayload {
  poolTitle: string;
  poolDate: string;
  poolId: string;
  venuesAssigned: number;
  venuesUnassigned: number;
  totalGroups: number;
  topVenueName?: string;
  uniqueVenueCount?: number;
  unassignedReasonBreakdown?: string;
}

export async function notifyVenueAssignmentResult(payload: VenueAssignmentResultPayload): Promise<void> {
  const lines: string[] = [
    `**活动：** ${payload.poolTitle} | ${payload.poolDate}`,
    `**分配结果：** ✅ ${payload.venuesAssigned} 组已分配${payload.venuesUnassigned > 0 ? ` · ❌ ${payload.venuesUnassigned} 组未分配` : ""}`,
  ];

  if (payload.venuesAssigned > 0) {
    lines.push("", `**已分配场地：** ${payload.topVenueName || "—"}${payload.uniqueVenueCount ? ` 等 ${payload.uniqueVenueCount} 个场地` : ""}`);
  }
  if (payload.venuesUnassigned > 0 && payload.unassignedReasonBreakdown) {
    lines.push("", `**未分配原因：** ${payload.unassignedReasonBreakdown}`);
  }

  lines.push("", payload.venuesUnassigned > 0
    ? "⚠️ **已在关键告警中通知，请优先处理未分配场地**"
    : "✅ 所有组均已分配场地，无需人工介入");

  lines.push("", `[查看活动池 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)})`);

  await notifyOpsMarkdown("🏠 场地分配完成", lines);
}

export interface VenueTbdEscalationPayload {
  poolId: string;
  poolTitle: string;
  poolDate: string;
  /** Groups still without a venue after the retry pass. */
  unassignedGroups: number;
  totalGroups: number;
  /** Reason-code breakdown from the latest retry. */
  reasonBreakdown: string;
  /** Whole hours until the event start (can be <= 2 at the T-2h deadline). */
  hoursUntilEvent: number;
  /** 'warning' = repeated retry failure; 'critical' = T-2h deadline breached. */
  severity: "warning" | "critical";
}

/**
 * W8 (AC-W8.5): escalating alert when venue assignment is still unresolved.
 * `warning` on repeated retry attempts, `critical` once the T-2h decision
 * deadline the user was promised has been breached.
 */
export async function notifyVenueTbdEscalation(payload: VenueTbdEscalationPayload): Promise<void> {
  const lines: string[] = [
    `**活动：** ${payload.poolTitle} | ${payload.poolDate}`,
    `**未分配场地：** ❌ ${payload.unassignedGroups}/${payload.totalGroups} 组`,
    `**距离活动开始：** 约 ${payload.hoursUntilEvent} 小时`,
  ];
  if (payload.reasonBreakdown) {
    lines.push(`**未分配原因：** ${payload.reasonBreakdown}`);
  }
  lines.push(
    "",
    payload.severity === "critical"
      ? "🚨 **已超过承诺用户的 T-2h 决策时限**，请立即人工分配场地。"
      : "⚠️ **多次自动重试仍未分配完成**，请人工介入选址。",
    "",
    `[查看活动池 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)})`,
  );

  const title = payload.severity === "critical" ? "🚨 场地-已超 T-2h 决策时限" : "⚠️ 场地-重试仍未分配";
  if (payload.severity === "critical") {
    await notifyCriticalMarkdown(title, lines);
  } else {
    await notifyOpsMarkdown(title, lines);
  }
}

export interface StuckMatchingPoolPayload {
  poolId: string;
  poolTitle: string;
  /** Minutes the pool sat in `matching` before the watchdog recovered it. */
  stuckForMinutes: number;
  /** ISO timestamp of the last status write (when the run began / stalled). */
  stuckSince: string;
}

/**
 * W8 (AC-W8.4): a matching run died between the `active → matching` CAS and its
 * commit (process crash, DB drop). The watchdog resets the pool to `active` so
 * it can be retried, and pages ops. Carries ids/title only — no PII.
 */
export async function notifyStuckMatchingPool(payload: StuckMatchingPoolPayload): Promise<void> {
  await notifyCriticalMarkdown("⚠️ 匹配卡住已自动回滚", [
    `**活动：** ${payload.poolTitle}`,
    `**活动池 ID：** ${payload.poolId}`,
    `**卡住时长：** ${payload.stuckForMinutes} 分钟`,
    `**开始时间：** ${payload.stuckSince}`,
    "",
    "系统已将该活动池状态回滚为 `active`，等待下一次匹配触发。请检查匹配服务日志与数据库连接。",
    "",
    `[查看活动池 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)})`,
  ]);
}
