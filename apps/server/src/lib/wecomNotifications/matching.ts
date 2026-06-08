import { notifyOpsMarkdown, buildAdminUrl } from "../wecomNotifier";

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
