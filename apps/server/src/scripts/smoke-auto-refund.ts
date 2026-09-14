/**
 * Smoke test — auto-refund pipeline (sprint auto-refund-pipeline-20260805).
 *
 * Runs against the real dev DB (DATABASE_URL). Creates throwaway data,
 * exercises `refundPoolCancellation` (Trigger A) + `refundUnmatchedRegistrations`
 * (Trigger B) end-to-end through the real repo layer, asserts DB state, then
 * cleans up everything it created.
 *
 * WeChat Pay is intentionally not touched: money refunds use MOCK_ orders
 * (the real mock-mode path finalizes without the WeChat API).
 *
 * Run: node --env-file=../../.env --import tsx/esm src/scripts/smoke-auto-refund.ts
 */
import { and, eq, inArray } from "drizzle-orm";
import {
  eventCreditGrants,
  eventCreditRedemptions,
  eventPoolRegistrations,
  eventPools,
  notifications,
  payments,
  refundAttempts,
  users,
} from "@shared/schema";
import { db } from "../db";
import { logAdminAudit } from "../lib/adminAuditLogger";
import { eventCreditsRepo } from "../repositories/eventCreditsRepo";
import { notificationsRepo } from "../repositories/notificationsRepo";
import {
  refundPoolCancellation,
  refundUnmatchedRegistrations,
} from "../services/autoRefundService";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  const mark = ok ? "✅ PASS" : "❌ FAIL";
  if (!ok) failures += 1;
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const ts = Date.now();
  const phone = `139${String(ts).slice(-8)}`;

  console.log(`\n=== Auto-refund smoke (run ${ts}) ===\n`);

  // ── Seed ──
  console.log("[step] seed…");
  const [smokeUser] = await db
    .insert(users)
    .values({ phoneNumber: phone, firstName: "冒烟", lastName: `测试${String(ts).slice(-4)}` })
    .returning({ id: users.id });
  if (!smokeUser) throw new Error("failed to create smoke user");

  console.log("[step] seed…");
  const [smokePool] = await db
    .insert(eventPools)
    .values({
      title: `冒烟测试饭局 ${String(ts).slice(-4)}`,
      eventType: "饭局",
      city: "深圳",
      createdBy: smokeUser.id,
      dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: eventPools.id });
  if (!smokePool) throw new Error("failed to create smoke pool");

  console.log("[step] seed…");
  const [regA] = await db
    .insert(eventPoolRegistrations)
    .values({ poolId: smokePool.id, userId: smokeUser.id, matchStatus: "pending" })
    .returning({ id: eventPoolRegistrations.id });

  // Trigger B needs its own user — (pool_id, user_id) is unique.
  console.log("[step] seed…");
  const [smokeUserB] = await db
    .insert(users)
    .values({ phoneNumber: `138${String(ts).slice(-8)}`, firstName: "冒烟", lastName: `未匹配${String(ts).slice(-4)}` })
    .returning({ id: users.id });
  if (!smokeUserB) throw new Error("failed to create second smoke user");

  console.log("[step] seed…");
  const [regB] = await db
    .insert(eventPoolRegistrations)
    .values({ poolId: smokePool.id, userId: smokeUserB.id, matchStatus: "unmatched" })
    .returning({ id: eventPoolRegistrations.id });
  if (!regA || !regB) throw new Error("failed to create registrations");

  // AC-W2.5: a FREE unmatched registration (no payment row, no credit
  // redemption) — it must still receive the seat-not-allocated notice.
  console.log("[step] seed…");
  const [smokeUserC] = await db
    .insert(users)
    .values({ phoneNumber: `137${String(ts).slice(-8)}`, firstName: "冒烟", lastName: `免费${String(ts).slice(-4)}` })
    .returning({ id: users.id });
  if (!smokeUserC) throw new Error("failed to create free smoke user");
  const [regC] = await db
    .insert(eventPoolRegistrations)
    .values({ poolId: smokePool.id, userId: smokeUserC.id, matchStatus: "unmatched" })
    .returning({ id: eventPoolRegistrations.id });
  if (!regC) throw new Error("failed to create free registration");

  console.log("[step] seed…");
  // Money payment A (mock order — finalized without WeChat) for registration A's pool.
  const [payA] = await db
    .insert(payments)
    .values({
      userId: smokeUser.id,
      paymentType: "event",
      relatedId: smokePool.id,
      originalAmount: 3000,
      discountAmount: 0,
      finalAmount: 3000,
      wechatOrderId: `MOCK_SMOKE_A_${ts}`,
      status: "completed",
    })
    .returning({ id: payments.id });

  console.log("[step] seed…");
  // Money payment C for the unmatched registration (Trigger B).
  const [payC] = await db
    .insert(payments)
    .values({
      userId: smokeUserB.id,
      paymentType: "event",
      relatedId: smokePool.id,
      originalAmount: 3000,
      discountAmount: 0,
      finalAmount: 3000,
      wechatOrderId: `MOCK_SMOKE_C_${ts}`,
      status: "completed",
    })
    .returning({ id: payments.id });

  console.log("[step] seed…");
  // Credit grant via a completed event-pack purchase.
  const [packPay] = await db
    .insert(payments)
    .values({
      userId: smokeUser.id,
      paymentType: "event_pack",
      relatedId: "pack_3",
      originalAmount: 21100,
      discountAmount: 0,
      finalAmount: 21100,
      wechatOrderId: `MOCK_SMOKE_PACK_${ts}`,
      status: "completed",
    })
    .returning({ id: payments.id });
  if (!payA || !payC || !packPay) throw new Error("failed to create payments");

  console.log("[step] seed…");
  await db.transaction(async (tx: Parameters<typeof eventCreditsRepo.grantCreditsForPayment>[0]) => {
    await eventCreditsRepo.grantCreditsForPayment(tx, {
      paymentId: packPay.id,
      userId: smokeUser.id,
      planType: "pack_3",
    });
    await eventCreditsRepo.consumeCreditForPoolRegistration(tx, {
      userId: smokeUser.id,
      poolId: smokePool.id,
      registrationId: regA.id,
    });
  });

  const [grantBefore] = await db
    .select({ id: eventCreditGrants.id, remainingCredits: eventCreditGrants.remainingCredits })
    .from(eventCreditGrants)
    .where(eq(eventCreditGrants.paymentId, packPay.id))
    .limit(1);
  if (!grantBefore) throw new Error("failed to create credit grant");
  check("seed: grant remaining = 2 after 1 consumption", grantBefore.remainingCredits === 2, `remaining=${grantBefore.remainingCredits}`);

  const [redemptionBefore] = await db
    .select({ id: eventCreditRedemptions.id })
    .from(eventCreditRedemptions)
    .where(eq(eventCreditRedemptions.registrationId, regA.id))
    .limit(1);
  check("seed: redemption row exists", Boolean(redemptionBefore));

  // ── Trigger B first — unmatched after matching (pool still open) ──
  const summaryB = await refundUnmatchedRegistrations(smokePool.id, "冒烟测试饭局");
  check("B: unmatched money refunded (payC only)", summaryB.refundedPayments === 1, `refundedPayments=${summaryB.refundedPayments}`);
  check("B: unmatched credits untouched", summaryB.refundedCredits === 0, `refundedCredits=${summaryB.refundedCredits}`);
  check("B: zero failures", summaryB.failedRefunds.length === 0, JSON.stringify(summaryB.failedRefunds));

  const [payCAfter] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(eq(payments.id, payC.id))
    .limit(1);
  check("B: payment C status → refunded", payCAfter?.status === "refunded", `status=${payCAfter?.status}`);

  const [notifB] = await db
    .select({ type: notifications.type })
    .from(notifications)
    .where(and(eq(notifications.userId, smokeUserB.id), eq(notifications.type, "seat_not_allocated_refund")))
    .limit(1);
  check("B: seat-not-allocated notification created", Boolean(notifB));

  // AC-W2.5: the free/unmatched user gets the informational notice even though
  // there is no payment/credit row for them.
  const freeNotifs = await db
    .select({ id: notifications.id, title: notifications.title })
    .from(notifications)
    .where(and(eq(notifications.userId, smokeUserC.id), eq(notifications.type, "seat_not_allocated_refund")));
  check("B: free unmatched user notified exactly once", freeNotifs.length === 1, `count=${freeNotifs.length}`);
  check("B: free copy is not 场次未成行", !(freeNotifs[0]?.title ?? "").includes("场次未成行"));

  // ── Trigger A — pool cancellation (payC already refunded → skipped) ──
  const summaryA = await refundPoolCancellation(smokePool.id, "冒烟测试饭局");
  check("A: remaining money refunded (payA only)", summaryA.refundedPayments === 1, `refundedPayments=${summaryA.refundedPayments}`);
  check("A: credit restored count", summaryA.refundedCredits === 1, `refundedCredits=${summaryA.refundedCredits}`);
  check("A: zero failures", summaryA.failedRefunds.length === 0, JSON.stringify(summaryA.failedRefunds));

  const [payAAfter] = await db
    .select({ status: payments.status })
    .from(payments)
    .where(eq(payments.id, payA.id))
    .limit(1);
  check("A: payment A status → refunded", payAAfter?.status === "refunded", `status=${payAAfter?.status}`);

  const [attemptA] = await db
    .select({ status: refundAttempts.status, initiatedBy: refundAttempts.initiatedBy })
    .from(refundAttempts)
    .where(eq(refundAttempts.paymentId, payA.id))
    .limit(1);
  check(
    "A: refundAttempts row recorded",
    attemptA?.status === "success" && attemptA.initiatedBy === "auto-refund",
    JSON.stringify(attemptA),
  );

  const [notifA] = await db
    .select({ type: notifications.type, title: notifications.title })
    .from(notifications)
    .where(and(eq(notifications.userId, smokeUser.id), eq(notifications.type, "pool_cancelled_refund")))
    .limit(1);
  check("A: user notification created", notifA?.title === "活动取消，报名费已退回", JSON.stringify(notifA));

  const [grantAfter] = await db
    .select({ remainingCredits: eventCreditGrants.remainingCredits })
    .from(eventCreditGrants)
    .where(eq(eventCreditGrants.id, grantBefore.id))
    .limit(1);
  check("A: grant credit restored (+1 → 3)", grantAfter?.remainingCredits === 3, `remaining=${grantAfter?.remainingCredits}`);

  const [redemptionAfter] = await db
    .select({ id: eventCreditRedemptions.id })
    .from(eventCreditRedemptions)
    .where(eq(eventCreditRedemptions.registrationId, regA.id))
    .limit(1);
  check("A: redemption row removed", !redemptionAfter);

  // ── Cross-trigger idempotency — both re-runs are no-ops ──
  const summaryA2 = await refundPoolCancellation(smokePool.id, "冒烟测试饭局");
  check(
    "A: re-run is a no-op",
    summaryA2.refundedPayments === 0 && summaryA2.refundedCredits === 0 && summaryA2.failedRefunds.length === 0,
    JSON.stringify(summaryA2),
  );
  const summaryB2 = await refundUnmatchedRegistrations(smokePool.id, "冒烟测试饭局");
  check(
    "B: re-run is a no-op",
    summaryB2.refundedPayments === 0 && summaryB2.refundedCredits === 0 && summaryB2.failedRefunds.length === 0,
    JSON.stringify(summaryB2),
  );

  // AC-W2.5 idempotency: the free user's informational notice is NOT duplicated.
  const freeNotifsAfter = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, smokeUserC.id), eq(notifications.type, "seat_not_allocated_refund")));
  check("B: free notice still exactly once after re-run", freeNotifsAfter.length === 1, `count=${freeNotifsAfter.length}`);
  const notifsBAfter = await db
    .select({ id: notifications.id })
    .from(notifications)
    .where(and(eq(notifications.userId, smokeUserB.id), eq(notifications.type, "seat_not_allocated_refund")));
  check("B: paid notice still exactly once after re-run", notifsBAfter.length === 1, `count=${notifsBAfter.length}`);

  // ── Sensitive-mutation audit ──
  // The smoke run executes real refund mutations against the dev DB; emit the
  // same structured `[AdminAudit]` marker the production refund paths use so
  // the operation is traceable. stdout is synchronous; DB persistence is
  // best-effort (the audit logger swallows persistence failures).
  logAdminAudit({
    action: "PAYMENT_REFUND_INITIATED",
    adminId: "smoke:auto-refund",
    targetEntityType: "event_pool",
    targetEntityId: smokePool.id,
    context: {
      source: "smoke-auto-refund",
      triggerA: {
        refundedPayments: summaryA.refundedPayments,
        refundedCredits: summaryA.refundedCredits,
        failedRefunds: summaryA.failedRefunds.length,
      },
      triggerB: {
        refundedPayments: summaryB.refundedPayments,
        refundedCredits: summaryB.refundedCredits,
        failedRefunds: summaryB.failedRefunds.length,
      },
    },
  });

  // ── Cleanup (FK-safe order) ──
  const paymentIds = [payA.id, payC.id, packPay.id];
  await db
    .delete(refundAttempts)
    .where(inArray(refundAttempts.paymentId, paymentIds))
    .catch(() => undefined);
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, smokeUser.id), eq(notifications.category, "activities")))
    .catch(() => undefined);
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, smokeUserB.id), eq(notifications.category, "activities")))
    .catch(() => undefined);
  await db
    .delete(notifications)
    .where(and(eq(notifications.userId, smokeUserC.id), eq(notifications.category, "activities")))
    .catch(() => undefined);
  await db.delete(eventCreditRedemptions).where(eq(eventCreditRedemptions.userId, smokeUser.id)).catch(() => undefined);
  await db.delete(eventCreditGrants).where(eq(eventCreditGrants.userId, smokeUser.id)).catch(() => undefined);
  await db.delete(payments).where(eq(payments.userId, smokeUser.id)).catch(() => undefined);
  await db.delete(payments).where(eq(payments.userId, smokeUserB.id)).catch(() => undefined);
  await db.delete(eventPoolRegistrations).where(eq(eventPoolRegistrations.poolId, smokePool.id)).catch(() => undefined);
  await db.delete(eventPools).where(eq(eventPools.id, smokePool.id)).catch(() => undefined);
  await db.delete(users).where(eq(users.id, smokeUser.id)).catch(() => undefined);
  await db.delete(users).where(eq(users.id, smokeUserB.id)).catch(() => undefined);
  await db.delete(users).where(eq(users.id, smokeUserC.id)).catch(() => undefined);
  console.log("\n🧹 cleanup done");

  console.log(`\n=== Smoke result: ${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Smoke crashed:", err);
  process.exit(1);
});
