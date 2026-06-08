import { notifyOpsMarkdown, notifyCriticalMarkdown, buildAdminUrl } from "../wecomNotifier";

export interface AbuseReportPayload {
  severity: "high" | "medium" | "low";
  reportCategory: string;
  reportedUserDisplayName: string;
  reporterPseudo: string;
  eventContext?: string;
  reportReasonSnippet: string;
  reportId: string;
}

export async function notifyAbuseReport(payload: AbuseReportPayload): Promise<void> {
  const title = `🚩 用户举报 ${payload.severity === "high" ? "🔴" : "🟡"}`;
  const lines: string[] = [
    `**举报类型：** ${payload.reportCategory}`,
    `**被举报用户：** ${payload.reportedUserDisplayName}`,
    `**举报人：** ${payload.reporterPseudo}（已匿名）`,
  ];

  if (payload.eventContext) {
    lines.push(`**关联活动：** ${payload.eventContext}`);
  }

  lines.push(`**举报描述：** ${payload.reportReasonSnippet}`, "");

  if (payload.severity === "high") {
    lines.push("🔴 **高风险举报，请立即审核处理**");
  } else {
    lines.push("🟡 一般举报，请在当日处理");
  }

  lines.push("", `[管理后台审核 →](${buildAdminUrl(`/admin/moderation/${payload.reportId}`)})`);

  if (payload.severity === "high") {
    await notifyCriticalMarkdown(title, lines);
  } else {
    await notifyOpsMarkdown(title, lines);
  }
}

export interface AdminActionPayload {
  adminName: string;
  adminRole: string;
  actionType: "ban" | "override" | "reassign" | "payment_fix" | "refund" | "other";
  actionTypeLabel: string;
  targetUserDisplayName: string;
  targetUserId: string;
  reason: string;
  changeSummary: string;
  auditLogId: string;
}

export async function notifyAdminAction(payload: AdminActionPayload): Promise<void> {
  const isBan = payload.actionType === "ban";
  const title = isBan ? "🔒 用户已封号 🚨" : "🔒 管理后台操作记录";
  const lines: string[] = [
    `**操作人：** ${payload.adminName}（${payload.adminRole}）`,
    `**操作类型：** ${payload.actionTypeLabel}`,
    `**目标用户：** ${payload.targetUserDisplayName}（ID: ${payload.targetUserId}）`,
    `**操作原因：** ${payload.reason}`,
  ];

  if (isBan) {
    lines.push("", "🔴 **封号操作，用户可能联系客服，请注意接应**");
  } else if (payload.actionType === "refund") {
    lines.push("", "↩️ 退款操作（详见退款通知）");
  }

  lines.push("", `**变更概览：** ${payload.changeSummary}`);
  lines.push("", `[查看操作详情 →](${buildAdminUrl(`/admin/audit/${payload.auditLogId}`)})`);

  if (isBan) {
    await notifyCriticalMarkdown(title, lines);
  } else {
    await notifyOpsMarkdown(title, lines);
  }
}
