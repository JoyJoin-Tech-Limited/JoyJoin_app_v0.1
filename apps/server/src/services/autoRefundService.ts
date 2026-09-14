import { and, eq } from "drizzle-orm";
import { eventCreditRedemptions, eventPoolRegistrations, notifications, payments } from "@shared/schema";
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

export type RefundContextKey = "pool_cancelled" | "seat_not_allocated" | "collapsed";

interface RefundContext {
  /** Machine-readable reason code carried on the refund run / notification
   *  record. Distinct per context (AC-W2.4: pool-cancelled vs
   *  seat-not-allocated). */
  code: "POOL_CANCELLED" | "SEAT_NOT_ALLOCATED" | "GROUP_COLLAPSED";
  reasonMoney: string;
  reasonCredit: string;
  notificationType: string;
  notificationTitleMoney: string;
  notificationTitleCredit: string;
  notificationMessageMoney: string;
  notificationMessageCredit: string;
  /** Copy for users whose registration carried NO money/credit transaction
   *  (subscription-covered or free registrations). AC-W2.5: these users are
   *  still told their seat was not allocated — informational, no refund
   *  claim. Omitted → the money variant is used. */
  notificationTitleNeutral?: string;
  notificationMessageNeutral?: string;
}

/**
 * Refund notification copy registry (AC-W2.4 split).
 *
 *   pool_cancelled     — the whole event was cancelled (admin Trigger A):
 *                        the event did not happen.
 *   seat_not_allocated — matching ran and the pool committed at least one
 *                        group, but this user's registration was left
 *                        unmatched (Trigger B). The event DID happen; telling
 *                        this user 場次未成行 is false copy (2026-09-11
 *                        gm-debrief P-3).
 *   collapsed          — a matched group dropped below the minimum size
 *                        post-reveal (Phase 0 安心补位, Amendment 3).
 */
export const REFUND_CONTEXTS = {
  pool_cancelled: {
    code: "POOL_CANCELLED",
    reasonMoney: "活动取消自动退款",
    reasonCredit: "活动取消自动退回次数",
    notificationType: "pool_cancelled_refund",
    notificationTitleMoney: "活动取消，报名费已退回",
    notificationTitleCredit: "活动取消，次数已退回",
    notificationMessageMoney: "报名费已原路退回，预计 1-3 个工作日到账。",
    notificationMessageCredit: "消耗的活动次数已退回你的次数包。",
    // No neutral variant: pool_cancelled refunds EVERY paid registration and
    // its unmatched-filter path (the only `neutral=true` caller) never runs for
    // this context, so a neutral copy string here would be dead config.
  },
  /** AC-W2.4: replaces the old `unmatched` context, whose 場次未成行 copy
   *  falsely claimed the event did not happen whenever the pool still formed
   *  groups. Wording is honest whether or not groups committed: it states only
   *  that a seat was not allocated. */
  seat_not_allocated: {
    code: "SEAT_NOT_ALLOCATED",
    reasonMoney: "座位未排上，自动退款",
    reasonCredit: "座位未排上，自动退回次数",
    notificationType: "seat_not_allocated_refund",
    notificationTitleMoney: "本次座位未排上，报名费已退回",
    notificationTitleCredit: "本次座位未排上，次数已退回",
    notificationMessageMoney: "本轮排桌未能为你安排到合适的座位。报名费已原路退回，预计 1-3 个工作日到账。",
    notificationMessageCredit: "本轮排桌未能为你安排到合适的座位。消耗的活动次数已退回你的次数包。",
    notificationTitleNeutral: "本次座位未排上",
    notificationMessageNeutral: "本轮排桌未能为你安排到合适的座位，你无需额外操作，欢迎报名下一场。",
  },
  /** Phase 0 安心补位 (2026-08-27, sprint post-reveal-phase0 M2/Amendment 3):
   *  post-reveal cancel dropped a matched group below the minimum size — the
   *  whole session is postponed and stayers are refunded with DISTINCT
   *  collapse copy (not 場次未成行 verbatim), including the copy-only
   *  「已为你优先保留下一场的排桌资格」 line (no actual priority logic this
   *  phase). Reuses Trigger B's unmatched filter: the cancel transaction
   *  flips stayers to 'unmatched', so only they are refunded — never the
   *  exiter (their registration row is already deleted). */
  collapsed: {
    code: "GROUP_COLLAPSED",
    reasonMoney: "同桌人数不足，本次未能成行，自动退款",
    reasonCredit: "同桌人数不足，本次未能成行，自动退回次数",
    notificationType: "collapsed_refund",
    notificationTitleMoney: "这次没能成行，报名费已退回",
    notificationTitleCredit: "这次没能成行，次数已退回",
    notificationMessageMoney:
      "有伙伴临时退出，人数不足。报名费已原路退回，预计 1-3 个工作日到账。已为你优先保留下一场的排桌资格。",
    notificationMessageCredit:
      "有伙伴临时退出，人数不足。消耗的活动次数已退回你的次数包。已为你优先保留下一场的排桌资格。",
    notificationTitleNeutral: "这次没能成行",
    notificationMessageNeutral:
      "有伙伴临时退出，人数不足。已为你优先保留下一场的排桌资格。",
  },
} as const satisfies Record<RefundContextKey, RefundContext>;

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
  poolId: string,
  neutral = false,
): Promise<void> {
  // Notification failures must never classify a successful refund as failed
  // (2026-08-05 review P0-3) — log and move on.
  try {
    await notifyUser(userId, ctx, isCredit, poolTitle, poolId, neutral);
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
  poolId: string,
  neutral = false,
): Promise<void> {
  const useNeutral = neutral && ctx.notificationTitleNeutral !== undefined;
  const title = useNeutral
    ? ctx.notificationTitleNeutral!
    : isCredit
      ? ctx.notificationTitleCredit
      : ctx.notificationTitleMoney;
  const body = useNeutral
    ? ctx.notificationMessageNeutral!
    : isCredit
      ? ctx.notificationMessageCredit
      : ctx.notificationMessageMoney;
  await notificationsRepo.createNotification({
    userId,
    category: "activities",
    type: ctx.notificationType,
    title,
    message: `${poolTitle}：${body}`,
    // Scopes the AC-W2.5 idempotency guard to (user, type, pool): a user
    // unmatched in two different pools still gets one notice per pool.
    relatedResourceId: poolId,
  });
}

/**
 * AC-W2.5 idempotency guard: has this user already received this refund notice
 * for this pool? Re-runs of the refund pipeline are otherwise no-ops (money +
 * credit claims are atomic), but the all-payment-paths notice below has no
 * natural claim to key on, so it is guarded by (userId, type, poolId).
 */
async function hasExistingRefundNotification(
  userId: string,
  type: string,
  poolId: string,
): Promise<boolean> {
  const [row] = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(
      and(
        eq(notifications.userId, userId),
        eq(notifications.type, type),
        eq(notifications.relatedResourceId, poolId),
      ),
    )
    .limit(1);
  return Boolean(row);
}

/**
 * Failure-isolated wrapper for the AC-W2.5 guard read. The guard runs AFTER
 * money has already moved (both refund claims are atomic and complete before
 * the all-paths notice pass), so a transient read error here must never abort
 * the remaining notifications or break `refundPoolPaidRegistrations`'s
 * "never throws" call-site contract (matchingPostMatchEffects.ts:297 treats a
 * throw as a run-level failure). On error we cannot prove the user was already
 * notified → treat as not-yet-notified and still send exactly one notice. The
 * worst case is a duplicate notice; the alternative is a stranded user.
 */
async function hasExistingRefundNotificationSafe(
  userId: string,
  type: string,
  poolId: string,
): Promise<boolean> {
  try {
    return await hasExistingRefundNotification(userId, type, poolId);
  } catch (error) {
    logger.warn("[AutoRefund] notification existence guard read failed — proceeding as not-yet-notified", {
      userId,
      type,
      poolId,
      error: error instanceof Error ? error.message : String(error),
    });
    return false;
  }
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
  context: RefundContextKey,
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
  let unmatchedRegs: Array<{ userId: string; id: string }> | null = null;
  if (context === "seat_not_allocated" || context === "collapsed") {
    const regs = await db
      .select({ userId: eventPoolRegistrations.userId, id: eventPoolRegistrations.id })
      .from(eventPoolRegistrations)
      .where(
        and(
          eq(eventPoolRegistrations.poolId, poolId),
          eq(eventPoolRegistrations.matchStatus, "unmatched"),
        ),
      );
    unmatchedRegs = regs;
    unmatchedUserIds = new Set(regs.map((reg: { userId: string }) => reg.userId));
    unmatchedRegistrationIds = new Set(regs.map((reg: { id: string }) => reg.id));
  }

  // AC-W2.5: in-run notification dedup — a user refunded via money AND credits
  // (or already covered by the all-paths notice below) is told exactly once.
  const notifiedUserIds = new Set<string>();
  // Users whose money refund and/or credit reversal FAILED. They must never
  // receive the neutral "你无需额外操作" notice — their refund is still
  // pending/failed, and that copy would be false reassurance. Ops is alerted
  // via the WeCom summary (sendSummary) instead.
  const failedUserIds = new Set<string>();
  // Honest observability: only counts notifications actually attempted this run
  // (re-runs are no-ops, so this is 0 on a replay even though every unmatched
  // user is reassessed).
  let notificationsAttempted = 0;

  // Money refunds (per-payment isolation).
  for (const payment of paymentsForPool) {
    if (unmatchedUserIds && !unmatchedUserIds.has(payment.userId)) {
      summary.skippedRefunds += 1;
      continue;
    }
    try {
      await refundMoneyPayment(payment, ctx.reasonMoney);
      summary.refundedPayments += 1;
      if (!notifiedUserIds.has(payment.userId)) {
        notifiedUserIds.add(payment.userId);
        notificationsAttempted += 1;
        await notifyUserSafely(payment.userId, ctx, false, poolTitle, poolId);
      }
    } catch (error) {
      failedUserIds.add(payment.userId);
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
      if (!notifiedUserIds.has(redemption.userId)) {
        notifiedUserIds.add(redemption.userId);
        notificationsAttempted += 1;
        await notifyUserSafely(redemption.userId, ctx, true, poolTitle, poolId);
      }
    } catch (error) {
      failedUserIds.add(redemption.userId);
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

  // AC-W2.5: notify EVERY unmatched user, on every payment path. The money and
  // credit loops above only reach paid / credit-covered registrations —
  // subscription-covered and free registrations produce no payment row and no
  // redemption, so without this pass they were silently stranded with false
  // copy (gm-debrief P-3). The (user, type, pool) existence guard keeps re-runs
  // no-ops, so each user is notified exactly once.
  if (unmatchedRegs) {
    for (const reg of unmatchedRegs) {
      if (notifiedUserIds.has(reg.userId)) continue;
      // Failed refund: the neutral "你无需额外操作" copy is false reassurance.
      // Skip it (the WeCom summary carries the failure); the user is left
      // un-notified rather than mis-led, and a later retry can still reach them.
      if (failedUserIds.has(reg.userId)) continue;
      if (await hasExistingRefundNotificationSafe(reg.userId, ctx.notificationType, poolId)) {
        notifiedUserIds.add(reg.userId);
        continue;
      }
      notifiedUserIds.add(reg.userId);
      notificationsAttempted += 1;
      await notifyUserSafely(reg.userId, ctx, false, poolTitle, poolId, true);
    }
  }

  logger.info("[AutoRefund] run complete", {
    poolId,
    context,
    code: ctx.code,
    refundedPayments: summary.refundedPayments,
    refundedCredits: summary.refundedCredits,
    notificationsAttempted,
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

/**
 * Trigger B — matching commit left users unmatched (seat not allocated).
 * Refunds only the unmatched registrations, and (AC-W2.5) notifies every
 * unmatched user on every payment path exactly once. Deliberately does NOT say
 * 场次未成行: the pool may still have formed groups (REFUND_CONTEXTS
 * .seat_not_allocated, AC-W2.4). A pool that truly formed nothing is left to
 * the 场次未成行 admin/ops cancellation path.
 */
export async function refundUnmatchedRegistrations(
  poolId: string,
  poolTitle: string,
): Promise<AutoRefundSummary> {
  const summary = await refundPoolPaidRegistrations(poolId, poolTitle, "seat_not_allocated");
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
