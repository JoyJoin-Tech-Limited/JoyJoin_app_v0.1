/**
 * Pool completion sweep (2026-10-06).
 *
 * Closes the "event ended" lifecycle automatically. Before this sweep,
 * event_pools.status='completed' was reachable ONLY via manual admin PATCH —
 * every downstream surface that assumes pools complete (joinedEventsRepo
 * attended derivation, mini-program 已结束 cards, matchStatus='completed'
 * reader branches on matching-status / MatchHistorySection) depended on ops
 * remembering to flip status by hand.
 *
 * Semantics:
 *   - A pool completes at event start + POOL_COMPLETION_BUFFER_MS (3h), from
 *     any pre-completion status (active / matching / matched). 'matching' is
 *     safe: match runs happen at preference_lock_at (T-24h), never after the
 *     event has started.
 *   - Matched registrations of completed pools flip matchStatus='completed',
 *     filling the previously-writer-less reader branches (排桌完成 → 圆满结束).
 *   - Test pools are excluded: single-test walkthroughs can span the buffer.
 *   - Idempotent by construction: the status-scoped WHERE makes reruns no-ops;
 *     both writes share one transaction.
 *   - T+1 recap pushes are unaffected: the subscribe-reminder query keys off
 *     matchedAt IS NOT NULL, not status='matched'.
 *   - Icebreaker access is unaffected: it gates on eventPoolGroups.status,
 *     not eventPools.status.
 *
 * Fail-open (same posture as the other sweeps): a transient error is logged
 * and retried on the next tick; it never stops the scheduler.
 */

import { and, eq, inArray, isNotNull, isNull, lt, ne, or } from "drizzle-orm";

import { db } from "../db";
import { eventPoolRegistrations, eventPools } from "@shared/schema";
import { getFeatureFlag } from "./featureFlags";
import { logger } from "./logger";

export const POOL_COMPLETION_SWEEP_INTERVAL_MS = 60 * 60 * 1000;
/** Events run ~3h; completing at start+3h keeps the T+1 recap window intact. */
export const POOL_COMPLETION_BUFFER_MS = 3 * 60 * 60 * 1000;

export interface PoolCompletionSweepResult {
  completedPools: number;
  completedRegistrations: number;
  poolIds: string[];
}

export async function sweepCompletedPools(now: Date = new Date()): Promise<PoolCompletionSweepResult> {
  const cutoff = new Date(now.getTime() - POOL_COMPLETION_BUFFER_MS);

  const stale = await db
    .select({ id: eventPools.id })
    .from(eventPools)
    .where(
      and(
        inArray(eventPools.status, ["active", "matching", "matched"]),
        isNotNull(eventPools.dateTime),
        lt(eventPools.dateTime, cutoff),
        or(isNull(eventPools.isTestPool), eq(eventPools.isTestPool, false)),
      ),
    );

  if (stale.length === 0) {
    return { completedPools: 0, completedRegistrations: 0, poolIds: [] };
  }

  const poolIds = stale.map((p: { id: string }) => p.id);

  const completedRegistrations = await db.transaction(async (tx: any) => {
    await tx
      .update(eventPools)
      .set({ status: "completed", updatedAt: new Date() })
      .where(inArray(eventPools.id, poolIds));

    const flipped = await tx
      .update(eventPoolRegistrations)
      .set({ matchStatus: "completed", updatedAt: new Date() })
      .where(
        and(
          inArray(eventPoolRegistrations.poolId, poolIds),
          eq(eventPoolRegistrations.matchStatus, "matched"),
        ),
      )
      .returning({ id: eventPoolRegistrations.id });

    return flipped.length;
  });

  logger.info("[PoolCompletionSweep] completed stale pools", {
    completedPools: poolIds.length,
    completedRegistrations,
    poolIds,
  });

  return { completedPools: poolIds.length, completedRegistrations, poolIds };
}

// ── Scheduler ────────────────────────────────────────────────────────

type SchedulerLogger = {
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
};

export interface PoolCompletionSweepDependencies {
  logger: SchedulerLogger;
  isEnabled: () => Promise<boolean>;
  sweep: (now: Date) => Promise<PoolCompletionSweepResult>;
  now: () => Date;
  intervalMs: number;
}

export function createPoolCompletionSweepScheduler(
  dependencies: PoolCompletionSweepDependencies = {
    logger,
    isEnabled: () => getFeatureFlag("poolCompletionSweepEnabled", true),
    sweep: (now) => sweepCompletedPools(now),
    now: () => new Date(),
    intervalMs: POOL_COMPLETION_SWEEP_INTERVAL_MS,
  },
) {
  let stopped = false;
  let interval: NodeJS.Timeout | null = null;

  const clear = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const run = async () => {
    if (stopped) return;
    try {
      if (!(await dependencies.isEnabled())) {
        return;
      }
      const result = await dependencies.sweep(dependencies.now());
      if (result.completedPools > 0) {
        dependencies.logger.info("[PoolCompletionSweep] tick completed pools", {
          completedPools: result.completedPools,
          completedRegistrations: result.completedRegistrations,
        });
      }
    } catch (error) {
      dependencies.logger.warn("[PoolCompletionSweep] tick failed; will retry next interval", {
        error: String(error),
      });
    }
  };

  return {
    start() {
      if (interval) return;
      void run();
      interval = setInterval(() => void run(), dependencies.intervalMs);
      if (typeof interval.unref === "function") interval.unref();
      dependencies.logger.info("[PoolCompletionSweep] scheduler started", {
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

let singleton: ReturnType<typeof createPoolCompletionSweepScheduler> | null = null;

export function startPoolCompletionSweepScheduler(): void {
  if (singleton) return;
  singleton = createPoolCompletionSweepScheduler();
  singleton.start();
}
