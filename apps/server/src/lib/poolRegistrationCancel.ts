/**
 * Pool registration cancel orchestration — Phase 0 安心补位 (2026-08-27,
 * LOCKED sprint contract `.git/.orchestration/sprints/sprint-contract.post-reveal-phase0.md`).
 *
 * Shared by BOTH cancel entry points (contract AC-12 parity, non-negotiable):
 *   - DELETE /api/pool-registrations/:id        (routes/domains/userEventPools.ts)
 *   - POST  /api/blind-box-events/:eventId/cancel (routes/domains/blindBoxEvents.ts)
 *
 * Branch matrix (reveal boundary = the REGISTRATION's matchStatus, never
 * pool.matchedAt; is_test_pool skips the entire Phase 0 lifecycle — AC-5):
 *
 *   matchStatus='matched' + noRefundAfterReveal  → post_reveal_no_refund
 *   matchStatus!='matched' + preRevealRefundEnabled → pre_reveal_refund
 *   anything else (incl. either flag off)        → legacy (byte-identical
 *                                                  to the pre-Phase-0 handler)
 *
 * Money movement reuses proven machinery only — no new payment rails:
 *   paymentService.createRefund (claimPaymentForRefund atomic claim inside),
 *   paymentFulfillmentRepo.finalizeRefundedPayment (MOCK_ orders),
 *   eventCreditsRepo.reverseRedemptionForRegistration (transactional reversal).
 */

import { and, eq, sql } from "drizzle-orm";
import {
  eventAttendance,
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  invitationUses,
  payments,
} from "@shared/schema";
import { db } from "../db";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";
import { logAdminAudit } from "./adminAuditLogger";
import { paymentService } from "../paymentService";
import { paymentFulfillmentRepo } from "../repositories/paymentFulfillmentRepo";
import { refundAttemptsRepo } from "../repositories/refundAttemptsRepo";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";
import { notificationsRepo } from "../repositories/notificationsRepo";
import { refundCollapsedGroupRegistrations } from "../services/autoRefundService";
import { notifyPostRevealCancel } from "./wecomNotifications/poolLifecycle";

/** Audit vocabulary pinned by contract AC-2 (admin-visible cancellation reason). */
export const POST_REVEAL_CANCEL_AUDIT_REASON = "揭示后取消（不退款）";
/** Notification type for the shrink notice to remaining group members (AC-2). */
export const SEAT_VACATED_NOTICE_TYPE = "seat_vacated_group_notice";

const MOCK_ORDER_PREFIX = "MOCK_";
/** Groups below this size after a cancel collapse (PRD §3 / contract AC-3). */
const MIN_VIABLE_GROUP_SIZE = 4;
/** createRefund's atomic-claim rejection — means a concurrent/duplicate
 *  cancel already claimed the refund (AC-1a: treat as already-refunded). */
const ALREADY_REFUNDED_CLAIM_ERROR = "Can only refund completed payments";
const PRE_REVEAL_REFUND_REASON_MONEY = "揭示前取消，全额退款";
/** Sentinel: the registration row vanished mid-transaction (concurrent cancel). */
const REGISTRATION_DELETE_RACE = "REGISTRATION_DELETE_RACE";

export type CancelPolicyBranch = "legacy" | "pre_reveal_refund" | "post_reveal_no_refund";

export interface CancelRegistrationSuccess {
  ok: true;
  branch: CancelPolicyBranch;
  registrationId: string;
  poolId: string;
  /** Money refund initiated this call (false when already refunded or none). */
  refundedMoney: boolean;
  /** Credit redemption reversed inside the delete transaction. */
  reversedCredit: boolean;
  /** A concurrent/duplicate cancel had already claimed the money refund. */
  alreadyRefunded: boolean;
  /** Post-decrement group member count (post-reveal branch only). */
  remainingCount: number | null;
  /** Group dropped below MIN_VIABLE_GROUP_SIZE → stayer collapse refunds. */
  collapsed: boolean;
}

export interface CancelRegistrationFailure {
  ok: false;
  status: number;
  message: string;
  /** Machine-readable code for retryable failures (Amendment 1). */
  code?: "REFUND_FAILED_RETRYABLE";
}

export type CancelRegistrationResult = CancelRegistrationSuccess | CancelRegistrationFailure;

interface LoadedRegistration {
  id: string;
  poolId: string;
  userId: string;
  matchStatus: string | null;
  assignedGroupId: string | null;
}

function isDeleteRace(error: unknown): boolean {
  return error instanceof Error && error.message === REGISTRATION_DELETE_RACE;
}

/**
 * Server-computed cancel policy for the registrations summary DTO (AC-9).
 * Encoding decision (documented in the contract scope): the field is present
 * ONLY when either Phase 0 flag is on and the pool is not a test pool —
 * flags-off responses omit it so legacy clients are byte-unaffected.
 *   - pre-reveal (matchStatus != 'matched') + preRevealRefundEnabled → 'refundable'
 *   - everything else                                            → 'non_refundable'
 */
export function computeRegistrationCancelPolicy(params: {
  matchStatus: string | null | undefined;
  isTestPool: boolean | null | undefined;
  preRevealRefundEnabled: boolean;
  noRefundAfterReveal: boolean;
}): "refundable" | "non_refundable" | undefined {
  const { matchStatus, isTestPool, preRevealRefundEnabled, noRefundAfterReveal } = params;
  if (isTestPool) return undefined;
  if (!preRevealRefundEnabled && !noRefundAfterReveal) return undefined;
  if (matchStatus !== "matched" && preRevealRefundEnabled) return "refundable";
  return "non_refundable";
}

/**
 * Cancel one pool registration owned by `userId`, applying the Phase 0
 * policy branch selected by the two feature flags + the registration's
 * matchStatus. The id+userId ownership guard is preserved on every delete.
 */
export async function cancelPoolRegistrationWithPolicy(params: {
  registrationId: string;
  userId: string;
  /** Log line prefix convention of the calling route ("[MyPoolRegistrationsCancel]" / "[BlindBoxCancel]"). */
  logPrefix: string;
}): Promise<CancelRegistrationResult> {
  const { registrationId, userId, logPrefix } = params;

  const [registration] = await db
    .select({
      id: eventPoolRegistrations.id,
      poolId: eventPoolRegistrations.poolId,
      userId: eventPoolRegistrations.userId,
      matchStatus: eventPoolRegistrations.matchStatus,
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
    })
    .from(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.id, registrationId),
        eq(eventPoolRegistrations.userId, userId),
      ),
    )
    .limit(1);

  if (!registration) {
    logger.warn(`${logPrefix} no registration found to delete`, { userId, registrationId });
    return {
      ok: false,
      status: 404,
      message: "没有找到可以取消的报名记录，可能已经取消过了",
    };
  }

  const [pool] = await db
    .select({
      id: eventPools.id,
      title: eventPools.title,
      isTestPool: eventPools.isTestPool,
    })
    .from(eventPools)
    .where(eq(eventPools.id, registration.poolId))
    .limit(1);

  const [preRevealRefundEnabled, noRefundAfterReveal] = await Promise.all([
    getFeatureFlag("preRevealRefundEnabled"),
    getFeatureFlag("noRefundAfterReveal"),
  ]);

  const isPostReveal = registration.matchStatus === "matched";
  const branch: CancelPolicyBranch =
    pool?.isTestPool === true
      ? "legacy" // AC-5 — test pools skip the entire Phase 0 lifecycle
      : isPostReveal
        ? noRefundAfterReveal
          ? "post_reveal_no_refund"
          : "legacy"
        : preRevealRefundEnabled
          ? "pre_reveal_refund"
          : "legacy";

  logger.info(`${logPrefix} policy branch resolved`, {
    userId,
    registrationId,
    poolId: registration.poolId,
    matchStatus: registration.matchStatus,
    isTestPool: pool?.isTestPool === true,
    preRevealRefundEnabled,
    noRefundAfterReveal,
    branch,
  });

  if (branch === "pre_reveal_refund") {
    return cancelPreRevealWithRefund({ registration, poolTitle: pool?.title ?? "", userId, logPrefix });
  }
  if (branch === "post_reveal_no_refund") {
    return cancelPostRevealNoRefund({ registration, poolTitle: pool?.title ?? "", userId, logPrefix });
  }
  return cancelLegacy({ registration, userId, logPrefix });
}

// ── Legacy branch (AC-4: byte-identical to the pre-Phase-0 handler) ─────────

async function cancelLegacy(params: {
  registration: LoadedRegistration;
  userId: string;
  logPrefix: string;
}): Promise<CancelRegistrationResult> {
  const { registration, userId, logPrefix } = params;

  // 0) FK hygiene (mirrors the primary legacy handler — also covers duo
  //    invitation_uses rows on the blind-box path).
  await db
    .delete(invitationUses)
    .where(eq(invitationUses.poolRegistrationId, registration.id));

  // 1) Delete the registration row (id+userId scoped).
  const deletedRegistrations = await db
    .delete(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.id, registration.id),
        eq(eventPoolRegistrations.userId, userId),
      ),
    )
    .returning();

  if (deletedRegistrations.length === 0) {
    logger.warn(`${logPrefix} no registration found to delete`, { userId, registrationId: registration.id });
    return {
      ok: false,
      status: 404,
      message: "没有找到可以取消的报名记录，可能已经取消过了",
    };
  }

  // 2) Decrement the pool counter.
  const affectedPoolId = deletedRegistrations[0]?.poolId;
  if (affectedPoolId) {
    await db
      .update(eventPools)
      .set({
        totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
        updatedAt: new Date(),
      })
      .where(eq(eventPools.id, affectedPoolId));
  }

  logger.info(`${logPrefix} legacy cancel complete`, {
    userId,
    registrationId: registration.id,
    poolId: affectedPoolId,
  });

  return {
    ok: true,
    branch: "legacy",
    registrationId: registration.id,
    poolId: registration.poolId,
    refundedMoney: false,
    reversedCredit: false,
    alreadyRefunded: false,
    remainingCount: null,
    collapsed: false,
  };
}

// ── Pre-reveal branch (AC-1: real, full, idempotent refund) ─────────────────

async function cancelPreRevealWithRefund(params: {
  registration: LoadedRegistration;
  poolTitle: string;
  userId: string;
  logPrefix: string;
}): Promise<CancelRegistrationResult> {
  const { registration, userId, logPrefix } = params;

  // (a) Money path — Amendment 1 fixed ordering: atomic claim → refund
  // attempt (incl. the WeChat network call) → registration delete. The claim
  // + attempt live inside paymentService.createRefund; on WeChat failure it
  // self-releases the claim and records a failed attempt before re-throwing,
  // so our only obligation is: DO NOT delete, propagate a retryable error.
  const [payment] = await db
    .select({
      id: payments.id,
      wechatOrderId: payments.wechatOrderId,
      finalAmount: payments.finalAmount,
    })
    .from(payments)
    .where(
      and(
        eq(payments.paymentType, "event"),
        eq(payments.relatedId, registration.poolId),
        eq(payments.userId, userId),
        eq(payments.status, "completed"),
      ),
    )
    .limit(1);

  let refundedMoney = false;
  let alreadyRefunded = false;

  if (payment) {
    try {
      if (payment.wechatOrderId?.startsWith(MOCK_ORDER_PREFIX)) {
        // Mock-mode orders never touched WeChat Pay — finalize directly
        // (mirrors autoRefundService.refundMoneyPayment).
        const finalized = await paymentFulfillmentRepo.finalizeRefundedPayment({
          wechatOrderId: payment.wechatOrderId,
        });
        await refundAttemptsRepo.create({
          paymentId: payment.id,
          status: "success",
          reason: PRE_REVEAL_REFUND_REASON_MONEY,
          wechatRefundId: `MOCK_RF_${payment.id}`,
          amount: payment.finalAmount,
          initiatedBy: "user-cancel",
        });
        refundedMoney = !finalized.alreadyRefunded;
        alreadyRefunded = finalized.alreadyRefunded;
      } else {
        await paymentService.createRefund(payment.id, PRE_REVEAL_REFUND_REASON_MONEY, "user-cancel");
        refundedMoney = true;
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      if (message.includes(ALREADY_REFUNDED_CLAIM_ERROR)) {
        // AC-1a: a concurrent/duplicate cancel already claimed the refund —
        // treat as already-refunded, proceed to delete without a second refund.
        alreadyRefunded = true;
        logger.info(`${logPrefix} payment refund already claimed — treating as already refunded`, {
          registrationId: registration.id,
          paymentId: payment.id,
        });
      } else {
        // Amendment 1: refund call failed — abort WITHOUT deleting so the
        // user can retry; createRefund already released the claim + recorded
        // the failed attempt.
        logger.error(`${logPrefix} pre-reveal refund failed — aborting cancel, registration kept`, {
          registrationId: registration.id,
          paymentId: payment.id,
          error: message,
        });
        return {
          ok: false,
          status: 502,
          message: "退款失败，报名记录已保留，请稍后重试",
          code: "REFUND_FAILED_RETRYABLE",
        };
      }
    }
  }

  // (b) Credit reversal + registration delete in ONE transaction — the
  // reversal is strictly BEFORE the delete (F6: the redemption row FK
  // references the registration; deleting first 500s credit-paid cancels).
  let reversedCredit = false;
  try {
    reversedCredit = await db.transaction(
      async (tx: Parameters<typeof eventCreditsRepo.reverseRedemptionForRegistration>[0]) => {
        await tx
          .delete(invitationUses)
          .where(eq(invitationUses.poolRegistrationId, registration.id));

        const reversed = await eventCreditsRepo.reverseRedemptionForRegistration(tx, {
          registrationId: registration.id,
        });

        const deleted = await tx
          .delete(eventPoolRegistrations)
          .where(
            and(
              eq(eventPoolRegistrations.id, registration.id),
              eq(eventPoolRegistrations.userId, userId),
            ),
          )
          .returning();

        if (deleted.length === 0) {
          // Lost a race with a concurrent cancel — roll back the reversal.
          throw new Error(REGISTRATION_DELETE_RACE);
        }

        await tx
          .update(eventPools)
          .set({
            totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(eventPools.id, registration.poolId));

        return reversed;
      },
    );
  } catch (error) {
    if (isDeleteRace(error)) {
      logger.warn(`${logPrefix} registration vanished mid-cancel (concurrent cancel)`, {
        userId,
        registrationId: registration.id,
      });
      return {
        ok: false,
        status: 404,
        message: "没有找到可以取消的报名记录，可能已经取消过了",
      };
    }
    throw error;
  }

  logger.info(`${logPrefix} pre-reveal cancel with refund complete`, {
    userId,
    registrationId: registration.id,
    poolId: registration.poolId,
    refundedMoney,
    alreadyRefunded,
    reversedCredit,
  });

  return {
    ok: true,
    branch: "pre_reveal_refund",
    registrationId: registration.id,
    poolId: registration.poolId,
    refundedMoney,
    reversedCredit,
    alreadyRefunded,
    remainingCount: null,
    collapsed: false,
  };
}

// ── Post-reveal branch (AC-2/AC-3: no refund + honest group state) ──────────

async function cancelPostRevealNoRefund(params: {
  registration: LoadedRegistration;
  poolTitle: string;
  userId: string;
  logPrefix: string;
}): Promise<CancelRegistrationResult> {
  const { registration, poolTitle, userId, logPrefix } = params;
  const groupId = registration.assignedGroupId ?? null;

  let remainingCount: number | null = null;
  let collapsed = false;

  try {
    await db.transaction(async (tx: any) => {
      await tx
        .delete(invitationUses)
        .where(eq(invitationUses.poolRegistrationId, registration.id));

      const deleted = await tx
        .delete(eventPoolRegistrations)
        .where(
          and(
            eq(eventPoolRegistrations.id, registration.id),
            eq(eventPoolRegistrations.userId, userId),
          ),
        )
        .returning();

      if (deleted.length === 0) {
        throw new Error(REGISTRATION_DELETE_RACE);
      }

      await tx
        .update(eventPools)
        .set({
          totalRegistrations: sql`${eventPools.totalRegistrations} - 1`,
          updatedAt: new Date(),
        })
        .where(eq(eventPools.id, registration.poolId));

      if (groupId) {
        // Amendment 2 (AC-3 race guard): the collapse decision uses the
        // POST-decrement count obtained atomically via UPDATE … RETURNING
        // inside the same transaction — two concurrent cancels cannot both
        // read a pre-decrement count and both skip collapse.
        const [groupAfter] = await tx
          .update(eventPoolGroups)
          .set({
            memberCount: sql`${eventPoolGroups.memberCount} - 1`,
            updatedAt: new Date(),
          })
          .where(eq(eventPoolGroups.id, groupId))
          .returning({
            memberCount: eventPoolGroups.memberCount,
            eventId: eventPoolGroups.eventId,
          });

        remainingCount =
          typeof groupAfter?.memberCount === "number" ? groupAfter.memberCount : null;

        // M5 / Amendment 4: set event_attendance.status='cancelled' (the
        // pinned column — attendanceStatus is the separate check-in state
        // machine and is NOT touched). Update-if-exists; never upsert.
        if (groupAfter?.eventId) {
          const cancelledAttendance = await tx
            .update(eventAttendance)
            .set({ status: "cancelled" })
            .where(
              and(
                eq(eventAttendance.eventId, groupAfter.eventId),
                eq(eventAttendance.userId, userId),
              ),
            )
            .returning({ id: eventAttendance.id });

          if (cancelledAttendance.length === 0) {
            logger.warn(`${logPrefix} no event_attendance row to cancel — skipping (never upsert)`, {
              userId,
              registrationId: registration.id,
              eventId: groupAfter.eventId,
            });
          }
        } else {
          logger.warn(`${logPrefix} group has no linked event — attendance cancel skipped`, {
            userId,
            registrationId: registration.id,
            groupId,
          });
        }

        if (remainingCount !== null && remainingCount < MIN_VIABLE_GROUP_SIZE) {
          collapsed = true;
          // Flip stayers to 'unmatched' INSIDE the same transaction so the
          // collapse refund wrapper (Trigger B unmatched-filter mechanics)
          // only ever touches stayers — the exiter's row is already deleted,
          // so the exiter is never refunded (AC-3).
          await tx
            .update(eventPoolRegistrations)
            .set({ matchStatus: "unmatched", updatedAt: new Date() })
            .where(
              and(
                eq(eventPoolRegistrations.assignedGroupId, groupId),
                eq(eventPoolRegistrations.matchStatus, "matched"),
              ),
            );
        }
      }
    });
  } catch (error) {
    if (isDeleteRace(error)) {
      logger.warn(`${logPrefix} registration vanished mid-cancel (concurrent cancel)`, {
        userId,
        registrationId: registration.id,
      });
      return {
        ok: false,
        status: 404,
        message: "没有找到可以取消的报名记录，可能已经取消过了",
      };
    }
    throw error;
  }

  // ── Post-commit side effects. Each is decoupled from the cancel commit:
  // failure is logged, never rolled back, never blocks the response (AC-7/8).

  // Audit (AC-2): forfeiture record with the pinned 「揭示后取消（不退款）」
  // vocabulary — admin-visible as the cancellation reason.
  logAdminAudit({
    action: "POST_REVEAL_CANCEL_NO_REFUND",
    adminId: userId,
    adminRole: "user",
    targetEntityType: "event_pool_registration",
    targetEntityId: registration.id,
    context: {
      reason: POST_REVEAL_CANCEL_AUDIT_REASON,
      poolId: registration.poolId,
      groupId,
      remainingCount,
      collapsed,
    },
  });

  // WeCom ops alert (AC-8) — outside the transaction, failure never affects
  // the cancel (notifyVenueUnassigned pattern).
  try {
    await notifyPostRevealCancel({
      poolId: registration.poolId,
      poolTitle,
      remainingCount,
      collapsed,
    });
  } catch (error) {
    logger.error(`${logPrefix} WeCom post-reveal cancel alert failed`, {
      registrationId: registration.id,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  if (collapsed) {
    // AC-3: stayers flow through the collapse refund path (distinct M2 copy
    // via REFUND_CONTEXTS.collapsed — 「已为你优先保留下一场的排桌资格」).
    try {
      await refundCollapsedGroupRegistrations(registration.poolId, poolTitle);
    } catch (error) {
      logger.error(`${logPrefix} collapse refund run failed`, {
        registrationId: registration.id,
        poolId: registration.poolId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  } else if (groupId && remainingCount !== null) {
    // AC-2: shrink notice to every remaining member with the ACTUAL
    // headcount. The exiter's identity never appears in any payload.
    await notifyRemainingMembersOfVacatedSeat({
      groupId,
      remainingCount,
      registrationId: registration.id,
      logPrefix,
    });
  }

  logger.info(`${logPrefix} post-reveal cancel (no refund) complete`, {
    userId,
    registrationId: registration.id,
    poolId: registration.poolId,
    groupId,
    remainingCount,
    collapsed,
  });

  return {
    ok: true,
    branch: "post_reveal_no_refund",
    registrationId: registration.id,
    poolId: registration.poolId,
    refundedMoney: false,
    reversedCredit: false,
    alreadyRefunded: false,
    remainingCount,
    collapsed,
  };
}

/**
 * Shrink notice fan-out (AC-2/AC-7): one batch query for the remaining group
 * members, then per-user createNotification — no N+1 re-query of
 * group/pool/registration per member. Per-notification failure is logged and
 * swallowed (notifyUserSafely pattern): notification failure NEVER blocks or
 * rolls back the cancel.
 */
async function notifyRemainingMembersOfVacatedSeat(params: {
  groupId: string;
  remainingCount: number;
  registrationId: string;
  logPrefix: string;
}): Promise<void> {
  const { groupId, remainingCount, registrationId, logPrefix } = params;

  let stayers: Array<{ userId: string }> = [];
  try {
    stayers = await db
      .select({ userId: eventPoolRegistrations.userId })
      .from(eventPoolRegistrations)
      .where(
        and(
          eq(eventPoolRegistrations.assignedGroupId, groupId),
          eq(eventPoolRegistrations.matchStatus, "matched"),
        ),
      );
  } catch (error) {
    logger.error(`${logPrefix} failed to load remaining group members for vacated-seat notice`, {
      groupId,
      registrationId,
      error: error instanceof Error ? error.message : String(error),
    });
    return;
  }

  for (const stayer of stayers) {
    try {
      await notificationsRepo.createNotification({
        userId: stayer.userId,
        category: "activities",
        type: SEAT_VACATED_NOTICE_TYPE,
        title: "今晚的局有变动",
        message: `有位伙伴临时有事来不了，今晚是温馨的 ${remainingCount} 人局。`,
      });
    } catch (error) {
      logger.error(`${logPrefix} seat-vacated notification failed`, {
        userId: stayer.userId,
        groupId,
        registrationId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }
}
