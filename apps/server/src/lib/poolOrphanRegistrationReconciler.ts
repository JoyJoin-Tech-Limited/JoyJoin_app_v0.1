import { and, eq, gt, inArray, isNull, or } from "drizzle-orm";
import { db } from "../db";
import { eventPoolRegistrations, eventPools } from "@shared/schema";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";

/**
 * Orphan-registration reconciliation (2026-11-11).
 *
 * Why this exists: a registration can be written into a pool that already left
 * `active` — a payment webhook landing after 排桌 committed or after the
 * deadline sweep cancelled the pool, or a free registration racing a match run.
 * Such a row stays `pending` forever: `scanPoolAndMatch` bails on non-active
 * pools, and the refund triggered by that earlier match run has already
 * completed, so nobody ever picks the late row up. The user has paid and is in
 * no group.
 *
 * This sweep is the single backstop for that class of bug. It flips stranded
 * `pending` registrations to `unmatched` and routes them through the existing
 * refund pipeline (pool-scoped + idempotent), so a late arrival still gets its
 * money back with the same honest copy as any other unmatched registration.
 */

export const POOL_ORPHAN_SWEEP_INTERVAL_MS = 15 * 60 * 1000;
/** Only reconcile recently touched pools; older pending rows are historical. */
export const POOL_ORPHAN_LOOKBACK_MS = 14 * 24 * 60 * 60 * 1000;

export interface PoolOrphanSweepResult {
  scannedPools: number;
  orphanRegistrations: number;
  refundedPools: number;
  failedPools: number;
}

/**
 * Reconcile one pool: flip stranded `pending` registrations to `unmatched` and
 * refund them. Idempotent — a second call finds nothing pending and does no
 * work. Safe to call for any pool; active pools are skipped.
 */
export async function reconcileOrphanRegistrationsForPool(poolId: string): Promise<number> {
  const [pool] = await db
    .select({ id: eventPools.id, status: eventPools.status, title: eventPools.title })
    .from(eventPools)
    .where(eq(eventPools.id, poolId))
    .limit(1);

  // A pool still recruiting has no orphans by definition (pending rows are
  // waiting for the next scan), and `matching` is a transient in-flight state
  // whose rows are about to be committed by saveMatchResults — touching either
  // would corrupt a live run.
  if (!pool || pool.status === "active" || pool.status === "matching") return 0;

  const flipped = await db
    .update(eventPoolRegistrations)
    .set({ matchStatus: "unmatched", updatedAt: new Date() })
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.matchStatus, "pending"),
      ),
    )
    .returning({ id: eventPoolRegistrations.id });

  if (flipped.length === 0) return 0;

  const context = pool.status === "cancelled" ? "pool_cancelled" : "seat_not_allocated";
  logger.warn("[PoolOrphanReconciler] refunding registrations stranded in a closed pool", {
    poolId,
    poolStatus: pool.status,
    orphanRegistrations: flipped.length,
    context,
  });

  try {
    const { refundPoolCancellation, refundUnmatchedRegistrations } = await import(
      "../services/autoRefundService"
    );
    if (context === "pool_cancelled") {
      await refundPoolCancellation(pool.id, pool.title);
    } else {
      await refundUnmatchedRegistrations(pool.id, pool.title);
    }
  } catch (error) {
    // The flip already happened, so the next tick re-claims the same rows and
    // retries the refund; never re-queue the pool by hand.
    logger.error("[PoolOrphanReconciler] refund failed; will retry next tick", {
      poolId,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return flipped.length;
}

/**
 * Find pools that left `active` recently and still hold `pending`
 * registrations, then reconcile each one. Fail-open per pool.
 */
export async function sweepOrphanRegistrations(
  now: Date = new Date(),
): Promise<PoolOrphanSweepResult> {
  const lookback = new Date(now.getTime() - POOL_ORPHAN_LOOKBACK_MS);

  const closedPools = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(
      and(
        inArray(eventPools.status, ["matched", "completed", "cancelled"]),
        gt(eventPools.updatedAt, lookback),
        or(isNull(eventPools.isTestPool), eq(eventPools.isTestPool, false)),
      ),
    );

  if (closedPools.length === 0) {
    return { scannedPools: 0, orphanRegistrations: 0, refundedPools: 0, failedPools: 0 };
  }

  const poolIds = closedPools.map((p: { id: string }) => p.id);

  const stranded = await db
    .select({ poolId: eventPoolRegistrations.poolId })
    .from(eventPoolRegistrations)
    .where(
      and(
        inArray(eventPoolRegistrations.poolId, poolIds),
        eq(eventPoolRegistrations.matchStatus, "pending"),
      ),
    );

  const orphanPoolIds: string[] = [];
  for (const row of stranded) {
    const poolId = (row as { poolId: string }).poolId;
    if (poolId && !orphanPoolIds.includes(poolId)) orphanPoolIds.push(poolId);
  }

  const result: PoolOrphanSweepResult = {
    scannedPools: poolIds.length,
    orphanRegistrations: 0,
    refundedPools: 0,
    failedPools: 0,
  };

  for (const poolId of orphanPoolIds) {
    try {
      const reconciled = await reconcileOrphanRegistrationsForPool(poolId);
      result.orphanRegistrations += reconciled;
      if (reconciled > 0) result.refundedPools += 1;
    } catch (error) {
      result.failedPools += 1;
      logger.warn("[PoolOrphanReconciler] pool reconcile failed", {
        poolId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}

// ── Scheduler ────────────────────────────────────────────────────────

type SchedulerLogger = {
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
};

export interface PoolOrphanSchedulerDependencies {
  logger: SchedulerLogger;
  isEnabled: () => Promise<boolean>;
  sweep: (now: Date) => Promise<PoolOrphanSweepResult>;
  now: () => Date;
  intervalMs: number;
}

export function createPoolOrphanRegistrationScheduler(
  dependencies: PoolOrphanSchedulerDependencies = {
    logger,
    isEnabled: () => getFeatureFlag("poolOrphanRegistrationSweepEnabled", true),
    sweep: (now) => sweepOrphanRegistrations(now),
    now: () => new Date(),
    intervalMs: POOL_ORPHAN_SWEEP_INTERVAL_MS,
  },
) {
  let stopped = false;
  let interval: ReturnType<typeof setInterval> | null = null;

  const clear = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const run = async () => {
    if (stopped) return;
    try {
      if (!(await dependencies.isEnabled())) return;
      const result = await dependencies.sweep(dependencies.now());
      if (result.orphanRegistrations > 0) {
        dependencies.logger.info("[PoolOrphanReconciler] tick reconciled stranded registrations", {
          ...result,
        });
      }
    } catch (error) {
      dependencies.logger.warn("[PoolOrphanReconciler] tick failed; will retry next interval", {
        error: String(error),
      });
    }
  };

  return {
    start() {
      if (interval) return;
      void run();
      interval = setInterval(() => void run(), dependencies.intervalMs);
      if (typeof (interval as { unref?: () => void }).unref === "function") {
        (interval as unknown as { unref: () => void }).unref();
      }
      dependencies.logger.info("[PoolOrphanReconciler] scheduler started", {
        intervalMs: dependencies.intervalMs,
      });
    },
    stop() {
      stopped = true;
      clear();
    },
    /** Test hook: run one tick immediately. */
    runOnce: run,
  };
}

let singleton: ReturnType<typeof createPoolOrphanRegistrationScheduler> | null = null;

export function startPoolOrphanRegistrationScheduler(): void {
  if (singleton) return;
  singleton = createPoolOrphanRegistrationScheduler();
  singleton.start();
}
