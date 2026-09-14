/**
 * Pool matching stuck-state watchdog (W8 AC-W8.4).
 *
 * `saveMatchResults` atomically flips a pool `active → matching` as its
 * execution guard. If the process dies (or the DB drops) between that CAS and
 * the commit/error-path reset, the pool is left permanently `matching`: no
 * future scan will see it (`scanAllActivePools` filters `status='active'`) and
 * users are stuck on 排桌中 forever.
 *
 * This watchdog finds pools that have sat in `matching` longer than
 * `POOL_MATCHING_STUCK_THRESHOLD_MS` and resets them to `active` (fail-forward:
 * the next registration/scheduled scan retries matching). Each recovery emits a
 * structured error log plus a WeCom ops alert carrying ids only.
 *
 * The reset is a guarded CAS (`status='matching'`), so it is safe to run from
 * multiple instances — only one wins per pool.
 */

import { and, eq, inArray, lt } from "drizzle-orm";
import { eventPools } from "@shared/schema";
import { db } from "../db";
import { logger } from "./logger";
import { notifyStuckMatchingPool } from "./wecomNotifications/matching";

export const POOL_MATCHING_WATCHDOG_INTERVAL_MS = 5 * 60 * 1000;
export const POOL_MATCHING_STUCK_THRESHOLD_MS = 15 * 60 * 1000;

export interface StuckMatchingPool {
  id: string;
  title: string;
  /** The `updatedAt` observed while still stuck (pre-reset timestamp). */
  updatedAt: Date;
}

/** Pools in `matching` whose last status write is older than the threshold. */
export async function findStuckMatchingPools(
  nowMs: number = Date.now(),
): Promise<StuckMatchingPool[]> {
  const cutoff = new Date(nowMs - POOL_MATCHING_STUCK_THRESHOLD_MS);
  const rows = await db
    .select({
      id: eventPools.id,
      title: eventPools.title,
      updatedAt: eventPools.updatedAt,
    })
    .from(eventPools)
    .where(and(eq(eventPools.status, "matching"), lt(eventPools.updatedAt, cutoff)));
  return rows.map((row: { id: string; title: string; updatedAt: Date }) => ({
    id: row.id,
    title: row.title,
    updatedAt: row.updatedAt,
  }));
}

/**
 * Reset every stuck pool to `active`. Returns the pools actually reset this
 * call (guarded CAS — a concurrent recovery elsewhere yields an empty result).
 * Side effects (log + WeCom alert) are fire-and-forget after the DB write so a
 * notification failure can never block recovery.
 */
export async function resetStuckMatchingPools(
  nowMs: number = Date.now(),
): Promise<StuckMatchingPool[]> {
  const stuck = await findStuckMatchingPools(nowMs);
  if (stuck.length === 0) return [];

  const now = new Date(nowMs);

  // Single batched CAS: one `UPDATE ... WHERE id IN (...) AND status='matching'`
  // for every stuck pool (previously one statement per pool inside a loop —
  // an N+1 scan). The guarded `WHERE` keeps the multi-instance safety contract
  // identical: only rows still `matching` at commit time are returned, so a
  // concurrent recovery elsewhere yields a smaller (or empty) recovered set.
  const recovered = await db
    .update(eventPools)
    .set({ status: "active", updatedAt: now })
    .where(
      and(
        inArray(
          eventPools.id,
          stuck.map((pool) => pool.id),
        ),
        eq(eventPools.status, "matching"),
      ),
    )
    .returning({ id: eventPools.id });

  const recoveredIds = new Set(recovered.map((row: { id: string }) => row.id));
  const reset = stuck.filter((pool) => recoveredIds.has(pool.id));

  // Side effects (log + WeCom alert) remain fire-and-forget after the DB write
  // so a notification failure can never block recovery.
  for (const pool of reset) {
    const stuckForMinutes = Math.max(
      0,
      Math.round((nowMs - new Date(pool.updatedAt).getTime()) / 60_000),
    );

    logger.error("[Pool Matching Watchdog] reset stuck pool to active", {
      component: "pool_matching_watchdog",
      poolId: pool.id,
      poolTitle: pool.title,
      stuckForMinutes,
      stuckSince: new Date(pool.updatedAt).toISOString(),
      action: "reset_to_active",
    });

    void notifyStuckMatchingPool({
      poolId: pool.id,
      poolTitle: pool.title,
      stuckForMinutes,
      stuckSince: new Date(pool.updatedAt).toISOString(),
    }).catch((error) => {
      logger.warn("[Pool Matching Watchdog] stuck-pool ops alert failed", {
        component: "pool_matching_watchdog",
        poolId: pool.id,
        error: error instanceof Error ? error.message : String(error),
      });
    });
  }

  return reset;
}

interface WatchdogLogger {
  info(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
}

export interface PoolMatchingWatchdogDependencies {
  logger: WatchdogLogger;
  resetStuckMatchingPools: (nowMs?: number) => Promise<StuckMatchingPool[]>;
}

export function createPoolMatchingWatchdogScheduler(
  dependencies: PoolMatchingWatchdogDependencies = {
    logger,
    resetStuckMatchingPools,
  },
) {
  let stopped = false;
  let interval: NodeJS.Timeout | null = null;
  let consecutiveFailures = 0;

  const clear = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const run = async () => {
    if (stopped) return;
    try {
      const reset = await dependencies.resetStuckMatchingPools();
      if (reset.length > 0) {
        dependencies.logger.error("[Pool Matching Watchdog] recovered stuck matching pools", {
          component: "pool_matching_watchdog",
          recoveredCount: reset.length,
          poolIds: reset.map((pool) => pool.id),
        });
      }
      consecutiveFailures = 0;
    } catch (error) {
      // Fail-open (same posture as the icebreaker TTL sweep): a transient DB
      // error must not stop the watchdog for the life of the process.
      consecutiveFailures += 1;
      dependencies.logger.error("[Pool Matching Watchdog] sweep failed; will retry next tick", {
        component: "pool_matching_watchdog",
        failOpen: true,
        consecutiveFailures,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    start() {
      stopped = false;
      interval = setInterval(() => {
        void run();
      }, POOL_MATCHING_WATCHDOG_INTERVAL_MS);
      interval.unref?.();
      return interval;
    },
    stop() {
      stopped = true;
      consecutiveFailures = 0;
      clear();
    },
    run,
    isStopped() {
      return stopped;
    },
    getConsecutiveFailures() {
      return consecutiveFailures;
    },
  };
}

export function startPoolMatchingWatchdog(): NodeJS.Timeout {
  return createPoolMatchingWatchdogScheduler().start();
}
