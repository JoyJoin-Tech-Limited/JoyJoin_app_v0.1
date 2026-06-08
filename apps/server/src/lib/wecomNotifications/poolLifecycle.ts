import { notifyCriticalMarkdown, notifyOpsMarkdown, buildAdminUrl } from "../wecomNotifier";

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
