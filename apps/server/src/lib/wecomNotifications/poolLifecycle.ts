import { notifyCriticalMarkdown, notifyOpsMarkdown, buildAdminUrl } from "../wecomNotifier";
import type { AutoRefundSummary } from "../../services/autoRefundService";

export interface PoolCancelledPayload {
  poolTitle: string;
  poolDate: string;
  poolCity: string;
  poolDistrict?: string;
  poolId: string;
  registeredUserCount: number;
  matchedGroupCount: number;
  revenueImpact: number;
  cancellationReason: string;
  adminName: string;
  autoRefund: boolean;
  usersNotified: boolean;
}

export async function notifyPoolCancelled(payload: PoolCancelledPayload): Promise<void> {
  const lines: string[] = [
    `**活动：** ${payload.poolTitle} | ${payload.poolDate}`,
    `**影响：** ${payload.registeredUserCount} 人 · ${payload.matchedGroupCount} 组`,
    `**收入影响：** ¥${(payload.revenueImpact / 100).toFixed(2)}`,
    `**原因：** ${payload.cancellationReason}`,
    `**操作人：** ${payload.adminName}`,
    `**退款处理：** ${payload.autoRefund ? "✅ 已自动发起退款" : "❗️ 需要手动处理退款"}`,
    `**用户通知：** ${payload.usersNotified ? "✅ 已通知" : "⚠️ 尚未通知用户"}`,
    "",
    "**建议操作：**",
  ];

  if (!payload.usersNotified) {
    lines.push("1. ✔️ 通知所有受影响用户");
  }
  if (!payload.autoRefund) {
    lines.push("2. ✔️ 处理退款");
  }

  lines.push("", `[查看活动详情 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)})`);

  await notifyCriticalMarkdown("⛔ 活动池已取消 🚨", lines);
}

/** Auto-refund run summary (2026-08-05 auto-refund pipeline). */
export async function notifyAutoRefundSummary(
  poolId: string,
  summary: AutoRefundSummary,
): Promise<void> {
  const reasonLabels: Record<string, string> = {
    pool_cancelled: "活动取消",
    unmatched: "场次未成行（未匹配）",
    collapsed: "同桌人数不足，场次顺延",
  };
  const lines: string[] = [
    `**原因：** ${reasonLabels[summary.reason] ?? summary.reason}`,
    `**已退报名费：** ${summary.refundedPayments} 笔`,
    `**已退活动次数：** ${summary.refundedCredits} 笔`,
    `**跳过：** ${summary.skippedRefunds} 笔`,
  ];

  if (summary.failedRefunds.length > 0) {
    lines.push(
      "",
      `⚠️ **退款失败 ${summary.failedRefunds.length} 笔，需人工处理：**`,
      ...summary.failedRefunds.slice(0, 10).map(
        (failure) =>
          `- ${failure.paymentId ? `支付 ${failure.paymentId}` : `报名 ${failure.registrationId}`}：${failure.reason}`,
      ),
    );
    if (summary.failedRefunds.length > 10) {
      lines.push(`- …等共 ${summary.failedRefunds.length} 笔`);
    }
  }

  lines.push("", `[查看活动详情 →](${buildAdminUrl(`/admin/pools/${poolId}`)})`);

  if (summary.failedRefunds.length > 0) {
    await notifyCriticalMarkdown("💸 自动退款完成（含失败项）", lines);
  } else {
    await notifyOpsMarkdown("💸 自动退款完成", lines);
  }
}

export interface PostRevealCancelPayload {
  poolId: string;
  poolTitle: string;
  /** Post-decrement member count of the affected group (null when the
   *  cancelled registration had no assigned group). */
  remainingCount: number | null;
  /** True when the cancel dropped the group below the minimum size and the
   *  stayer collapse-refund path was triggered. */
  collapsed: boolean;
}

/**
 * Phase 0 安心补位 (2026-08-27, sprint post-reveal-phase0 AC-8): ops alert for
 * a post-reveal cancel (揭示后取消（不退款）). Follows the notifyVenueUnassigned
 * pattern — invoked by the cancel flow AFTER the transaction commits; callers
 * wrap in try/catch so alert failure never affects the cancel.
 */
export async function notifyPostRevealCancel(payload: PostRevealCancelPayload): Promise<void> {
  const lines: string[] = [
    `**活动池：** ${payload.poolTitle || payload.poolId}`,
    `**poolId：** ${payload.poolId}`,
    `**剩余人数：** ${payload.remainingCount === null ? "未知（未排桌报名）" : `${payload.remainingCount} 人`}`,
    `**桌状态：** ${payload.collapsed ? "⚠️ 人数不足，已顺延并自动退款" : "正常（≥4 人）"}`,
    "**退款：** 无（揭示后取消不退款）",
    "",
    `[查看活动详情 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)})`,
  ];

  await notifyOpsMarkdown("🪑 揭示后成员取消（不退款）", lines);
}

export interface LowRegistrationPayload {
  poolTitle: string;
  poolDate: string;
  poolCity: string;
  poolDistrict?: string;
  poolId: string;
  currentRegistrations: number;
  targetRegistrations: number;
  percentFilled: number;
  daysUntilDeadline: number;
}

export async function notifyLowRegistration(payload: LowRegistrationPayload): Promise<void> {
  const isCritical = payload.percentFilled < 30;

  const lines: string[] = [
    `**活动：** ${payload.poolTitle} | ${payload.poolDate}`,
    `**当前报名：** ${payload.currentRegistrations} 人 / 目标 ${payload.targetRegistrations} 人（${payload.percentFilled.toFixed(0)}%）`,
    `**距离截止：** ${payload.daysUntilDeadline} 天`,
    "",
    isCritical
      ? "🔴 **严重不足（< 30%），建议评估是否提前取消或加大推广力度**"
      : "🟡 **报名不足（< 50%），建议考虑以下操作：**",
    "",
    "**建议行动：**",
    "1. 查看活动推广数据，确认曝光是否充足",
    "2. 考虑调整活动时间/地点/价格",
    "3. 如确认无法成团，尽早通知已报名用户",
    "",
    `[查看活动池 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)})`,
  ];

  if (isCritical) {
    await notifyCriticalMarkdown("📊 报名严重不足", lines);
  } else {
    await notifyOpsMarkdown("📊 报名不足预警", lines);
  }
}
