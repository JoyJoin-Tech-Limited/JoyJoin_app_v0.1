/**
 * Smoke test — account-deletion retention (Option B, sprint account-deletion-retention-option-b).
 *
 * Runs against the real dev DB (DATABASE_URL). Seeds a throwaway user with a
 * completed payment, a terminal refund attempt, and a non-financial child row
 * (pool registration); executes the same transaction sequence as the admin
 * delete-data route (pending-refund guard → detach + payload scrub → catalog
 * cascade with `retain: RETAINED_USER_TABLES`); asserts the retained financial
 * rows survive de-identified while everything else is gone; then cleans up.
 *
 * Route wiring itself is locked by the mocked route test
 * (revokeUserSessionsContract.test.ts); this script is the DB-true evidence
 * for the retention semantics. The HS-11 staging drill remains the E2E check.
 *
 * Run: node --env-file=../../.env --import tsx/esm src/scripts/smoke-account-deletion-retention.ts
 */
import { eq, sql } from "drizzle-orm";
import { getTiersForEventType } from "@shared/budgetTiers";
import {
  eventPoolRegistrations,
  eventPools,
  payments,
  refundAttempts,
  users,
} from "@shared/schema";
import { db } from "../db";
import { cascadeDeleteByIds } from "../lib/fkCascadeDelete";
import { RETAINED_USER_TABLES } from "../routes/domains/adminUsers";

let failures = 0;
function check(label: string, ok: boolean, detail = ""): void {
  const mark = ok ? "✅ PASS" : "❌ FAIL";
  if (!ok) failures += 1;
  console.log(`${mark} ${label}${detail ? ` — ${detail}` : ""}`);
}

async function main(): Promise<void> {
  const ts = Date.now();
  console.log(`\n=== Account-deletion retention smoke (run ${ts}) ===\n`);

  // ── Seed ──
  const [smokeUser] = await db
    .insert(users)
    .values({ phoneNumber: `137${String(ts).slice(-8)}`, firstName: "冒烟", lastName: `注销${String(ts).slice(-4)}` })
    .returning({ id: users.id });
  if (!smokeUser) throw new Error("failed to create smoke user");

  const [smokePool] = await db
    .insert(eventPools)
    .values({
      title: `冒烟注销局 ${String(ts).slice(-4)}`,
      eventType: "饭局",
      city: "深圳",
      createdBy: smokeUser.id,
      dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      registrationDeadline: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000),
    })
    .returning({ id: eventPools.id });
  if (!smokePool) throw new Error("failed to create smoke pool");

  const [registration] = await db
    .insert(eventPoolRegistrations)
    .values({ poolId: smokePool.id, userId: smokeUser.id, matchStatus: "pending" })
    .returning({ id: eventPoolRegistrations.id });

  const [payment] = await db
    .insert(payments)
    .values({
      userId: smokeUser.id,
      paymentType: "event",
      relatedId: smokePool.id,
      originalAmount: 100,
      finalAmount: 100,
      status: "completed",
      wechatOrderId: `MOCK_DELETE_${ts}`,
      paidAt: new Date(),
      eventRegistrationPayload: {
        poolId: smokePool.id,
        budgetRange: getTiersForEventType("饭局")[0]?.id ?? null,
        preferredLanguages: ["中文"],
        eventIntent: "交新朋友",
      },
    })
    .returning({ id: payments.id });
  if (!payment) throw new Error("failed to create smoke payment");

  const [refund] = await db
    .insert(refundAttempts)
    .values({ paymentId: payment.id, status: "failed", amount: 100, reason: "smoke fixture (terminal)" })
    .returning({ id: refundAttempts.id });

  // ── Execute the route's transaction sequence ──
  await db.transaction(async (tx: any) => {
    const pendingRefund = (await tx.execute(sql`
      SELECT 1 AS pending
      FROM refund_attempts ra
      JOIN payments p ON p.id = ra.payment_id
      WHERE p.user_id = ${smokeUser.id} AND ra.status = 'pending'
      LIMIT 1
    `)) as { rows?: unknown[] };
    if ((pendingRefund.rows ?? []).length > 0) {
      throw new Error("unexpected pending refund fixture — delete would be blocked");
    }

    await tx.execute(sql`
      UPDATE payments
         SET user_id = NULL, event_registration_payload = NULL
       WHERE user_id = ${smokeUser.id}
    `);

    await cascadeDeleteByIds(tx, "users", "id", [smokeUser.id], {
      retain: RETAINED_USER_TABLES,
    });
  });

  // ── Assertions ──
  const userRows = await db.select({ id: users.id }).from(users).where(eq(users.id, smokeUser.id));
  check("user deleted", userRows.length === 0);

  const paymentRows = await db
    .select({ id: payments.id, userId: payments.userId, payload: payments.eventRegistrationPayload })
    .from(payments)
    .where(eq(payments.id, payment.id));
  check("payment retained", paymentRows.length === 1, `count=${paymentRows.length}`);
  check("payment detached (user_id NULL)", paymentRows[0]?.userId === null);
  check("payload scrubbed", paymentRows[0]?.payload === null);

  const refundRows = await db
    .select({ id: refundAttempts.id })
    .from(refundAttempts)
    .where(eq(refundAttempts.paymentId, payment.id));
  check("refund_attempts retained (child of retained table)", refundRows.length === 1, `count=${refundRows.length}`);

  const registrationRows = await db
    .select({ id: eventPoolRegistrations.id })
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.id, registration!.id));
  check("non-financial child deleted", registrationRows.length === 0);

  // ── Cleanup (FK-safe order) ──
  await db.delete(refundAttempts).where(eq(refundAttempts.paymentId, payment.id)).catch(() => undefined);
  await db.delete(payments).where(eq(payments.id, payment.id)).catch(() => undefined);
  await db
    .delete(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, smokePool.id))
    .catch(() => undefined);
  await db.delete(eventPools).where(eq(eventPools.id, smokePool.id)).catch(() => undefined);
  await db.delete(users).where(eq(users.id, smokeUser.id)).catch(() => undefined);
  console.log("\n🧹 cleanup done");

  console.log(`\n=== Smoke result: ${failures === 0 ? "ALL PASS" : `${failures} FAILURE(S)`} ===`);
  process.exit(failures === 0 ? 0 : 1);
}

main().catch((err) => {
  console.error("❌ Smoke crashed:", err);
  process.exit(1);
});
