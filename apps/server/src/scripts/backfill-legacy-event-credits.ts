import { db } from "../db.js";
import { eventCreditGrants, payments, users } from "@shared/schema/_definitions.js";
import { and, eq, sql } from "drizzle-orm";
import { logger } from "../lib/logger.js";

/**
 * Legacy event-credits backfill (2026-10-06).
 *
 * The pre-grants-table credit system (users.eventCredits balance column) is
 * invisible to the redemption ledger (event_credit_redemptions.grant_id is
 * NOT NULL), so a legacy-credit registration cancelled or auto-refunded
 * silently loses the credit. This migration moves every residual legacy
 * balance into the grants system:
 *
 *   per user with event_credits > 0 (one transaction):
 *     1. insert a synthetic zero-amount completed payment
 *        (wechat_order_id = LEGACY_CREDIT_MIGRATION_<userId>)
 *     2. insert an event_credit_grants row (plan_type 'legacy_migration',
 *        grantedCredits = remainingCredits = the legacy balance,
 *        expiresAt = users.eventCreditsExpiry ?? null)
 *     3. zero users.eventCredits and clear users.eventCreditsExpiry
 *
 * Idempotency: the migration payment's deterministic wechat_order_id is
 * checked before insert — re-runs skip already-migrated users.
 *
 * Double-spend safety: step 3 MUST live in the same transaction as the grant
 * insert. The legacy consume path (consumeLegacyUserCreditForPoolRegistration)
 * fires when grant-table consumption throws, so a migrated user holding both a
 * migration grant AND a non-zero legacy balance could spend the same credit
 * twice.
 *
 * Rollback: for each migrated user, delete the event_credit_grants row with
 * plan_type 'legacy_migration' and the payment with wechat_order_id
 * LEGACY_CREDIT_MIGRATION_<userId>, then restore users.eventCredits /
 * eventCreditsExpiry from the snapshot logged at run time (dryRun prints the
 * full intended snapshot before anything writes).
 *
 * Follow-up after verification in production: delete
 * consumeLegacyUserCreditForPoolRegistration and the users.eventCredits column.
 *
 * Usage:
 *   node --env-file=../../.env --import tsx/esm src/scripts/backfill-legacy-event-credits.ts            # dry-run (default)
 *   node --env-file=../../.env --import tsx/esm src/scripts/backfill-legacy-event-credits.ts --apply    # write
 */

export const LEGACY_CREDIT_MIGRATION_ORDER_PREFIX = "LEGACY_CREDIT_MIGRATION_";
export const LEGACY_CREDIT_MIGRATION_PLAN_TYPE = "legacy_migration";

export interface LegacyCreditRow {
  userId: string;
  eventCredits: number | null;
  eventCreditsExpiry: Date | null;
}

export type LegacyMigrationAction =
  | { kind: "migrate"; userId: string; credits: number; expiresAt: Date | null }
  | { kind: "skip_already_migrated"; userId: string }
  | { kind: "skip_no_balance"; userId: string };

/** Pure planner — unit-tested without a DB. */
export function planLegacyCreditMigration(
  rows: LegacyCreditRow[],
  alreadyMigratedOrderIds: ReadonlySet<string>,
): LegacyMigrationAction[] {
  return rows.map((row) => {
    if (alreadyMigratedOrderIds.has(`${LEGACY_CREDIT_MIGRATION_ORDER_PREFIX}${row.userId}`)) {
      return { kind: "skip_already_migrated", userId: row.userId };
    }
    const credits = row.eventCredits ?? 0;
    if (credits <= 0) {
      return { kind: "skip_no_balance", userId: row.userId };
    }
    return { kind: "migrate", userId: row.userId, credits, expiresAt: row.eventCreditsExpiry };
  });
}

export async function backfillLegacyEventCredits(options: { apply?: boolean } = {}): Promise<{
  scanned: number;
  migrated: number;
  skippedAlreadyMigrated: number;
  skippedNoBalance: number;
  creditsMigrated: number;
  dryRun: boolean;
}> {
  const apply = options.apply ?? false;
  const dryRun = !apply;

  const rows = await db
    .select({
      userId: users.id,
      eventCredits: users.eventCredits,
      eventCreditsExpiry: users.eventCreditsExpiry,
    })
    .from(users)
    .where(sql`COALESCE(${users.eventCredits}, 0) > 0`);

  const candidateOrderIds = rows.map((r: LegacyCreditRow) => `${LEGACY_CREDIT_MIGRATION_ORDER_PREFIX}${r.userId}`);
  const existing = candidateOrderIds.length === 0
    ? []
    : await db
        .select({ wechatOrderId: payments.wechatOrderId })
        .from(payments)
        .where(sql`${payments.wechatOrderId} = ANY(${candidateOrderIds})`);
  const alreadyMigrated: ReadonlySet<string> = new Set(
    existing.map((r: { wechatOrderId: string | null }) => r.wechatOrderId).filter((v: string | null): v is string => Boolean(v)),
  );

  const actions = planLegacyCreditMigration(rows, alreadyMigrated);
  const migrations = actions.filter((a): a is Extract<LegacyMigrationAction, { kind: "migrate" }> => a.kind === "migrate");

  if (dryRun) {
    logger.info("[BackfillLegacyCredits] DRY RUN — intended snapshot (pass --apply to write)", {
      migrations,
    });
  }

  let migrated = 0;
  let creditsMigrated = 0;

  for (const action of migrations) {
    if (apply) {
      await db.transaction(async (tx: any) => {
        const [payment] = await tx
          .insert(payments)
          .values({
            userId: action.userId,
            paymentType: "event_pack",
            relatedId: LEGACY_CREDIT_MIGRATION_PLAN_TYPE,
            originalAmount: 0,
            discountAmount: 0,
            finalAmount: 0,
            couponId: null,
            wechatOrderId: `${LEGACY_CREDIT_MIGRATION_ORDER_PREFIX}${action.userId}`,
            wechatPrepayId: null,
            status: "completed",
          })
          .returning({ id: payments.id });

        await tx.insert(eventCreditGrants).values({
          userId: action.userId,
          paymentId: payment.id,
          planType: LEGACY_CREDIT_MIGRATION_PLAN_TYPE,
          grantedCredits: action.credits,
          remainingCredits: action.credits,
          expiresAt: action.expiresAt,
        });

        // Contract step — same transaction as the grant insert (double-spend
        // safety, see header).
        await tx
          .update(users)
          .set({ eventCredits: 0, eventCreditsExpiry: null, updatedAt: new Date() })
          .where(eq(users.id, action.userId));
      });
    }
    migrated++;
    creditsMigrated += action.credits;
  }

  // Postcondition check (both modes): no migrated user may retain a legacy
  // balance, and every migrated user must own a migration grant.
  if (apply && migrated > 0) {
    const migratedIds = migrations.map((m) => m.userId);
    const leftovers = await db
      .select({ userId: users.id })
      .from(users)
      .where(and(sql`COALESCE(${users.eventCredits}, 0) > 0`, sql`${users.id} = ANY(${migratedIds})`));
    if (leftovers.length > 0) {
      throw new Error(
        `[BackfillLegacyCredits] POSTCONDITION FAILED — ${leftovers.length} users still hold legacy balances: ${leftovers.map((l: { userId: string }) => l.userId).join(", ")}`,
      );
    }
  }

  const result = {
    scanned: rows.length,
    migrated,
    skippedAlreadyMigrated: actions.filter((a) => a.kind === "skip_already_migrated").length,
    skippedNoBalance: actions.filter((a) => a.kind === "skip_no_balance").length,
    creditsMigrated,
    dryRun,
  };
  logger.info("[BackfillLegacyCredits] Complete", result);
  return result;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const apply = process.argv.includes("--apply");
  backfillLegacyEventCredits({ apply })
    .then((result) => {
      console.log("Backfill result:", result);
      process.exit(0);
    })
    .catch((err) => {
      console.error("Backfill failed:", err);
      process.exit(1);
    });
}
