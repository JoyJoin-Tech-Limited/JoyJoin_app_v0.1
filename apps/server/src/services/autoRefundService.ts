import { and, eq } from "drizzle-orm";
import { eventCreditRedemptions, eventPoolRegistrations, payments } from "@shared/schema";
import { db } from "../db";
import { getFeatureFlag } from "../lib/featureFlags";
import { logger } from "../lib/logger";
import { paymentService } from "../paymentService";
import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";
import { refundAttemptsRepo } from "../repositories/refundAttemptsRepo";
import { notificationsRepo } from "../repositories/notificationsRepo";

const MOCK_ORDER_PREFIX = "MOCK_";

export interface AutoRefundSummary {
  poolId: string;
  refundedPayments: number;
  refundedCredits: number;
  failedRefunds: Array<{
    paymentId?: string;
    registrationId?: string;
    reason: string;
  }>;
  skippedRefunds: number;
  reason: string;
}

interface RefundContext {
  reasonMoney: string;
  reasonCredit: string;
  notificationType: string;
  notificationTitleMoney: string;
  notificationTitleCredit: string;
  notificationMessageMoney: string;
  notificationMessageCredit: string;
}

const REFUND_CONTEXTS = {
  pool_cancelled: {
    reasonMoney: "活动取消自动退款",
    reasonCredit: "活动取消自动退回次数",
    notificationType: "pool_cancelled_refund",
    notificationTitleMoney: "活动取消，报名费已退回",
    notificationTitleCredit: "活动取消，次数已退回",
    notificationMessageMoney: "报名费已原路退回，预计 1-3 个工作日到账。",
    notificationMessageCredit: "消耗的活动次数已退回你的次数包。",
  },
  unmatched: {
    reasonMoney: "场次未成行，自动退款",
    reasonCredit: "场次未成行，自动退回次数",
    notificationType: "unmatched_refund",
    notificationTitleMoney: "场次未成行，报名费已退回",
    notificationTitleCredit: "场次未成行，次数已退回",
    notificationMessageMoney: "本场未能成行，报名费已原路退回，预计 1-3 个工作日到账。",
    notificationMessageCredit: "本场未能成行，消耗的活动次数已退回你的次数包。",
  },
  /** Phase 0 安心补位 (2026-08-27, sprint post-reveal-phase0 M2/Amendment 3):
   *  post-reveal cancel dropped a matched group below the minimum size — the
   *  whole session is postponed and stayers are refunded with DISTINCT
   *  collapse copy (not 场次未成行 verbatim), including the copy-only
   *  「已为你优先保留下一场的排桌资格」 line (no actual priority logic this
   *  phase). Reuses Trigger B's unmatched filter: the cancel transaction
   *  flips stayers to 'unmatched', so only they are refunded — never the
   *  exiter (their registration row is already deleted). */
  collapsed: {
    reasonMoney: "同桌人数不足，本次未能成行，自动退款",
    reasonCredit: "同桌人数不足，本次未能成行，自动退回次数",
    notificationType: "collapsed_refund",
    notificationTitleMoney: "这次没能成行，报名费已退回",
    notificationTitleCredit: "这次没能成行，次数已退回",
    notificationMessageMoney:
      "有伙伴临时退出，人数不足。报名费已原路退回，预计 1-3 个工作日到账。已为你优先保留下一场的排桌资格。",
    notificationMessageCredit:
      "有伙伴临时退出，人数不足。消耗的活动次数已退回你的次数包。已为你优先保留下一场的排桌资格。",
  },
} as const satisfies Record<string, RefundContext>;

async function isAutoRefundEnabled(): Promise<boolean> {
  return getFeatureFlag("autoRefundEnabled", true);
}

async function refundMoneyPayment(
  payment: { id: string; wechatOrderId: string | null; finalAmount: number },
  reason: string,
): Promise<void> {
  // Mock-mode orders never touched WeChat Pay — finalize directly.
  if (payment.wechatOrderId?.startsWith(MOCK_ORDER_PREFIX)) {
    await paymentFulfillmentRepo.finalizeRefundedPayment({
      wechatOrderId: payment.wechatOrderId,
    });
    await refundAttemptsRepo.create({
      paymentId: payment.id,
      status: "success",
      reason,
      wechatRefundId: `MOCK_RF_${payment.id}`,
      amount: payment.finalAmount,
      initiatedBy: "auto-refund",
    });
    return;
  }

  await paymentService.createRefund(payment.id, reason, "auto-refund");
}

async function notifyUserSafely(
  userId: string,
  ctx: RefundContext,
  isCredit: boolean,
  poolTitle: string,
): Promise<void> {
  // Notification failures must never classify a successful refund as failed
  // (2026-08-05 review P0-3) — log and move on.
  try {
    await notifyUser(userId, ctx, isCredit, poolTitle);
  } catch (error) {
    logger.warn("[AutoRefund] user notification failed", {
      userId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

async function notifyUser(
  userId: string,
  ctx: RefundContext,
  isCredit: boolean,
  poolTitle: string,
): Promise<void> {
  await notificationsRepo.createNotification({
    userId,
    category: "activities",
    type: ctx.notificationType,
    title: isCredit ? ctx.notificationTitleCredit : ctx.notificationTitleMoney,
    message: `${poolTitle}：${isCredit ? ctx.notificationMessageCredit : ctx.notificationMessageMoney}`,
  });
}

/**
 * Refunds paid registrations for a pool (money + consumed credits).
 * Idempotent (atomic claims: payment status transition + redemption delete),
 * failure-isolated (per-payment try/catch), kill-switched via
 * AUTO_REFUND_ENABLED. Query-level failures propagate to the caller — both
 * hooks wrap this in try/catch so the admin route / matching commit are never
 * affected.
 */
async function refundPoolPaidRegistrations(
  poolId: string,
  poolTitle: string,
  context: "pool_cancelled" | "unmatched" | "collapsed",
): Promise<AutoRefundSummary> {
  const summary: AutoRefundSummary = {
    poolId,
    refundedPayments: 0,
    refundedCredits: 0,
    failedRefunds: [],
    skippedRefunds: 0,
    reason: context,
  };

  if (!(await isAutoRefundEnabled())) {
    logger.info("[AutoRefund] disabled by flag — skipping", { poolId, context });
    return summary;
  }

  const ctx = REFUND_CONTEXTS[context];

  // Completed money payments for this pool (event registrations).
  const paymentsForPool = await db
    .select({
      id: payments.id,
      userId: payments.userId,
      wechatOrderId: payments.wechatOrderId,
      finalAmount: payments.finalAmount,
    })
    .from(payments)
    .where(
      and(
        eq(payments.paymentType, "event"),
        eq(payments.relatedId, poolId),
        eq(payments.status, "completed"),
      ),
    );

  // Consumed event-pack credits for this pool.
  const redemptions = await db
    .select({
      id: eventCreditRedemptions.id,
      userId: eventCreditRedemptions.userId,
      registrationId: eventCreditRedemptions.registrationId,
    })
    .from(eventCreditRedemptions)
    .where(eq(eventCreditRedemptions.poolId, poolId));

  // Batch the unmatched filter once (trigger B + collapsed — both refund only
  // registrations whose matchStatus is 'unmatched').
  let unmatchedUserIds: Set<string> | null = null;
  let unmatchedRegistrationIds: Set<string> | null = null;
  if (context === "unmatched" || context === "collapsed") {
    const unmatchedRegs = await db
      .select({ userId: eventPoolRegistrations.userId, id: eventPoolRegistrations.id })
      .from(eventPoolRegistrations)
      .where(
        and(
          eq(eventPoolRegistrations.poolId, poolId),
          eq(eventPoolRegistrations.matchStatus, "unmatched"),
        ),
      );
    unmatchedUserIds = new Set(unmatchedRegs.map((reg: { userId: string }) => reg.userId));
    unmatchedRegistrationIds = new Set(unmatchedRegs.map((reg: { id: string }) => reg.id));
  }

  // Money refunds (per-payment isolation).
  for (const payment of paymentsForPool) {
    if (unmatchedUserIds && !unmatchedUserIds.has(payment.userId)) {
      summary.skippedRefunds += 1;
      continue;
    }
    try {
      await refundMoneyPayment(payment, ctx.reasonMoney);
      summary.refundedPayments += 1;
      await notifyUserSafely(payment.userId, ctx, false, poolTitle);
    } catch (error) {
      summary.failedRefunds.push({
        paymentId: payment.id,
        reason: error instanceof Error ? error.message : String(error),
      });
      logger.error("[AutoRefund] money refund failed", {
        poolId,
        paymentId: payment.id,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Credit reversals (idempotent by registrationId).
  for (const redemption of redemptions) {
    if (unmatchedRegistrationIds && !unmatchedRegistrationIds.has(redemption.registrationId)) {
      summary.skippedRefunds += 1;
      continue;
    }
    try {
      const reversed = await db.transaction((tx: Parameters<typeof eventCreditsRepo.reverseRedemptionForRegistration>[0]) =>
        eventCreditsRepo.reverseRedemptionForRegistration(tx, {
          registrationId: redemption.registrationId,
        }),
      );
      if (!reversed) {
        summary.skippedRefunds += 1;
        continue;
      }
      summary.refundedCredits += 1;
      await notifyUserSafely(redemption.userId, ctx, true, poolTitle);
    } catch (error) {
      summary.failedRefunds.push({
        registrationId: redemption.registrationId,
        reason: error instanceof Error ? error.message : String(error),
      });
      logger.error("[AutoRefund] credit reversal failed", {
        poolId,
        registrationId: redemption.registrationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  logger.info("[AutoRefund] run complete", {
    poolId,
    context,
    refundedPayments: summary.refundedPayments,
    refundedCredits: summary.refundedCredits,
    skippedRefunds: summary.skippedRefunds,
    failedCount: summary.failedRefunds.length,
  });
  return summary;
}

/** Trigger A — admin pool cancellation: refund every paid registration. */
export async function refundPoolCancellation(
  poolId: string,
  poolTitle: string,
): Promise<AutoRefundSummary> {
  const summary = await refundPoolPaidRegistrations(poolId, poolTitle, "pool_cancelled");
  await sendSummary(poolId, summary);
  return summary;
}

/** Trigger B — matching commit left paid users unmatched: refund only those. */
export async function refundUnmatchedRegistrations(
  poolId: string,
  poolTitle: string,
): Promise<AutoRefundSummary> {
  const summary = await refundPoolPaidRegistrations(poolId, poolTitle, "unmatched");
  await sendSummary(poolId, summary);
  return summary;
}

/**
 * Post-reveal group collapse (Phase 0 安心补位, 2026-08-27 — Amendment 3):
 * a matched group dropped below the minimum size after a member cancel. The
 * cancel transaction already flipped the remaining (stayer) registrations to
 * 'unmatched', so this thin wrapper reuses Trigger B's unmatched-filter
 * mechanics — stayers are refunded, the exiter is never refunded (their
 * registration row is already deleted). Carries the DISTINCT collapse copy
 * via REFUND_CONTEXTS.collapsed (M2), not 场次未成行 verbatim.
 */
export async function refundCollapsedGroupRegistrations(
  poolId: string,
  poolTitle: string,
): Promise<AutoRefundSummary> {
  const summary = await refundPoolPaidRegistrations(poolId, poolTitle, "collapsed");
  await sendSummary(poolId, summary);
  return summary;
}

async function sendSummary(poolId: string, summary: AutoRefundSummary): Promise<void> {
  if (
    summary.refundedPayments === 0 &&
    summary.refundedCredits === 0 &&
    summary.failedRefunds.length === 0
  ) {
    return;
  }
  try {
    const { notifyAutoRefundSummary } = await import("../lib/wecomNotifications/poolLifecycle");
    await notifyAutoRefundSummary(poolId, summary);
  } catch (error) {
    logger.error("[AutoRefund] WeCom summary failed", {
      poolId,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}
