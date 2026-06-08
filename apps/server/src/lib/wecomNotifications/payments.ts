import { notifyFinanceMarkdown, notifyOpsMarkdown, sanitizeUserPayload, buildAdminUrl } from "../wecomNotifier";

interface PaymentUserInfo {
  id?: string;
  displayName?: string | null;
  gender?: string | null;
  birthdate?: string | Date | null;
  primaryArchetype?: string | null;
}

export interface RegistrationPaymentPayload {
  user: PaymentUserInfo;
  poolTitle: string;
  poolDateTime: string;
  poolCity: string;
  poolDistrict?: string;
  poolId: string;
  finalAmount: number;
  originalAmount: number;
  discountAmount: number;
  couponCode?: string | null;
  couponValue?: number;
  isFirstPayment: boolean;
  paymentCount: number;
  paymentId: string;
}

export async function notifyRegistrationPayment(payload: RegistrationPaymentPayload): Promise<void> {
  const info = sanitizeUserPayload(payload.user as any);

  const lines: string[] = [
    `**用户：** ${info.displayName}（${info.age !== null ? `${info.age}岁` : ""} · ${info.gender} · ${info.archetype}）`,
    `**活动：** ${payload.poolTitle} | ${payload.poolDateTime}`,
    `**地点：** ${payload.poolCity}${payload.poolDistrict ? ` · ${payload.poolDistrict}` : ""}`,
    `**支付金额：** ¥${(payload.finalAmount / 100).toFixed(2)}${payload.discountAmount > 0 ? `（原价 ¥${(payload.originalAmount / 100).toFixed(2)}，优惠 ¥${(payload.discountAmount / 100).toFixed(2)}）` : ""}`,
  ];

  if (payload.couponCode) {
    lines.push(`**优惠券：** ${payload.couponCode}（-¥${((payload.couponValue || payload.discountAmount) / 100).toFixed(2)}）`);
  }

  lines.push(
    `**付费历史：** 第 ${payload.paymentCount} 次付费${payload.isFirstPayment ? " 🎉" : ""}`,
    `**支付单号：** \`${payload.paymentId}\``,
    "",
    `[查看活动池 →](${buildAdminUrl(`/admin/pools/${payload.poolId}`)}) · [查看用户 →](${buildAdminUrl(`/admin/users/${info.userId}`)})`,
  );

  if (payload.discountAmount > 5000) {
    lines.push("", "⚠️ **大额优惠（>¥50），建议核实**");
  }

  await notifyFinanceMarkdown("💳 活动报名付费成功", lines);
}

export interface FirstPaymentPayload {
  user: PaymentUserInfo;
  paymentType: string;
  finalAmount: number;
  daysSinceSignup: number;
}

export async function notifyFirstPayment(payload: FirstPaymentPayload): Promise<void> {
  const info = sanitizeUserPayload(payload.user as any);
  const conversionLabel =
    payload.daysSinceSignup <= 1
      ? "🔥 注册当天就付费，高意愿用户"
      : payload.daysSinceSignup > 30
        ? "⏳ 观望超过一个月才转化，建议分析卡点"
      : "";

  const lines: string[] = [
    `**用户：** ${info.displayName} · ${info.archetype}`,
    `**付费类型：** ${payload.paymentType === "event" ? "活动报名" : payload.paymentType}`,
    `**金额：** ¥${(payload.finalAmount / 100).toFixed(2)}`,
    `**注册后第 ${payload.daysSinceSignup} 天首次付费**`,
  ];

  if (conversionLabel) {
    lines.push("", `**解读：** ${conversionLabel}`);
  }

  lines.push("", "无需操作，FYI", "", `[查看用户 →](${buildAdminUrl(`/admin/users/${info.userId}`)})`);

  await notifyFinanceMarkdown("🌟 新付费用户转化", lines);
}

export interface RefundProcessedPayload {
  adminName: string;
  userDisplayName: string;
  userId: string;
  amount: number;
  paymentType: string;
  reason: string;
  originalPaymentDate: string;
  paymentId: string;
  previousRefundCount: number;
}

export async function notifyRefundProcessed(payload: RefundProcessedPayload): Promise<void> {
  const lines: string[] = [
    `**用户：** ${payload.userDisplayName}`,
    `**支付类型：** ${payload.paymentType}`,
    `**退款金额：** ¥${(payload.amount / 100).toFixed(2)}`,
    `**退款原因：** ${payload.reason}`,
    `**处理人：** ${payload.adminName}`,
    `**原支付日期：** ${payload.originalPaymentDate}`,
    `**支付单号：** \`${payload.paymentId}\``,
  ];

  if (payload.previousRefundCount > 0) {
    lines.push("", `⚠️ **该用户 30 天内有 ${payload.previousRefundCount} 次退款记录，建议关注退款频率**`);
  }

  lines.push("", `[查看退款记录 →](${buildAdminUrl(`/admin/refunds/${payload.paymentId}`)})`);

  await notifyFinanceMarkdown("↩️ 退款已处理", lines);
}

export interface FailedPaymentPayload {
  userDisplayName: string;
  userId: string;
  paymentType: string;
  finalAmount: number;
  relatedEntity?: string;
  failureReason: string;
  retryCount: number;
}

export async function notifyFailedPayment(payload: FailedPaymentPayload): Promise<void> {
  const reasonLabels: Record<string, string> = {
    INSUFFICIENT_BALANCE: "余额不足",
    USER_CANCELLED: "用户取消支付",
    TIMEOUT: "支付超时",
    PAYMENT_LIMIT: "支付限额",
  };

  await notifyFinanceMarkdown("❌ 支付失败（重试已耗尽）", [
    `**用户：** ${payload.userDisplayName}`,
    `**支付类型：** ${payload.paymentType}`,
    `**金额：** ¥${(payload.finalAmount / 100).toFixed(2)}`,
    payload.relatedEntity ? `**关联活动：** ${payload.relatedEntity}` : "",
    `**失败原因：** ${reasonLabels[payload.failureReason] || payload.failureReason}`,
    `**已重试次数：** ${payload.retryCount} 次`,
    "",
    "**建议操作：**",
    "1. 在后台核实用户支付状态",
    "2. 如需联系用户，请通过管理后台操作（不直接在 WeCom 中联系）",
    "",
    `[查看用户支付记录 →](${buildAdminUrl(`/admin/users/${payload.userId}/payments`)})`,
  ]);
}
