/**
 * Venue-TBD retry scheduler (W8 AC-W8.5).
 *
 * Periodically re-runs venue assignment for pools whose groups are still
 * unassigned. Sends an escalating ops alert when assignment remains unresolved:
 * a `warning` after `VENUE_TBD_ESCALATION_THRESHOLD` consecutive unresolved
 * retries, and a `critical` alert once the T-2h decision deadline promised to
 * users has been breached.
 *
 * Fail-open (same posture as the icebreaker TTL sweep): a transient error is
 * logged and retried on the next tick; it never stops the scheduler.
 */

import { logger } from "./logger";
import {
  retryVenueTbdAssignments,
  type VenueTbdRetryResult,
} from "./venueTbdRetry";
import { notifyVenueTbdEscalation } from "./wecomNotifications/matching";

export const VENUE_TBD_RETRY_INTERVAL_MS = 30 * 60 * 1000;
/** Unresolved retries before a `warning` escalation is sent. */
export const VENUE_TBD_ESCALATION_THRESHOLD = 2;
/** The decision deadline promised to users in the venue_tbd notification. */
export const VENUE_TBD_DECISION_HOURS = 2;

type SchedulerLogger = {
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
};

export interface VenueTbdRetryDependencies {
  logger: SchedulerLogger;
  retryVenueTbdAssignments: () => Promise<VenueTbdRetryResult>;
  notifyEscalation: typeof notifyVenueTbdEscalation;
  now: () => number;
}

function reasonBreakdownToString(reasonBreakdown: Record<string, number>): string {
  return Object.entries(reasonBreakdown)
    .map(([reason, count]) => `${reason}: ${count}组`)
    .join("; ");
}

/** Pure escalation decision, extracted for unit testing. */
export function resolveVenueTbdEscalationSeverity(params: {
  consecutiveUnresolved: number;
  hoursUntilEvent: number | null;
}): "warning" | "critical" | null {
  if (params.hoursUntilEvent !== null && params.hoursUntilEvent <= VENUE_TBD_DECISION_HOURS) {
    return "critical";
  }
  if (params.consecutiveUnresolved >= VENUE_TBD_ESCALATION_THRESHOLD) {
    return "warning";
  }
  return null;
}

export function createVenueTbdRetryScheduler(
  dependencies: VenueTbdRetryDependencies = {
    logger,
    retryVenueTbdAssignments,
    notifyEscalation: notifyVenueTbdEscalation,
    now: () => Date.now(),
  },
) {
  let stopped = false;
  let interval: NodeJS.Timeout | null = null;
  let consecutiveUnresolved = 0;

  const clear = () => {
    if (interval) {
      clearInterval(interval);
      interval = null;
    }
  };

  const run = async () => {
    if (stopped) return;
    try {
      const result = await dependencies.retryVenueTbdAssignments();
      if (result.totalStillUnassigned > 0) {
        consecutiveUnresolved += 1;
      } else {
        if (consecutiveUnresolved > 0) {
          dependencies.logger.info("[VenueTbdRetry] all TBD venues resolved", {
            component: "venue_tbd_retry",
            previousConsecutiveUnresolved: consecutiveUnresolved,
            retriedPools: result.retriedPools,
          });
        }
        consecutiveUnresolved = 0;
        return;
      }

      const nowMs = dependencies.now();
      for (const pool of result.pools) {
        if (pool.stillUnassigned <= 0) continue;
        const hoursUntilEvent = Math.max(
          0,
          Math.round((new Date(pool.poolDateTimeIso).getTime() - nowMs) / (60 * 60 * 1000)),
        );
        const severity = resolveVenueTbdEscalationSeverity({
          consecutiveUnresolved,
          hoursUntilEvent,
        });
        if (!severity) continue;

        dependencies.logger.warn("[VenueTbdRetry] venue still unassigned — escalating", {
          component: "venue_tbd_retry",
          poolId: pool.poolId,
          unassignedGroups: pool.stillUnassigned,
          totalGroups: pool.totalGroups,
          hoursUntilEvent,
          consecutiveUnresolved,
          severity,
        });

        void dependencies
          .notifyEscalation({
            poolId: pool.poolId,
            poolTitle: pool.poolTitle,
            poolDate: new Date(pool.poolDateTimeIso).toLocaleString("zh-CN"),
            unassignedGroups: pool.stillUnassigned,
            totalGroups: pool.totalGroups,
            reasonBreakdown: reasonBreakdownToString(pool.reasonBreakdown),
            hoursUntilEvent,
            severity,
          })
          .catch((error: unknown) => {
            dependencies.logger.warn("[VenueTbdRetry] escalation alert failed", {
              component: "venue_tbd_retry",
              poolId: pool.poolId,
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }
    } catch (error) {
      dependencies.logger.error("[VenueTbdRetry] retry pass failed; will retry next tick", {
        component: "venue_tbd_retry",
        failOpen: true,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  };

  return {
    start() {
      stopped = false;
      interval = setInterval(() => {
        void run();
      }, VENUE_TBD_RETRY_INTERVAL_MS);
      interval.unref?.();
      return interval;
    },
    stop() {
      stopped = true;
      consecutiveUnresolved = 0;
      clear();
    },
    run,
    isStopped() {
      return stopped;
    },
    getConsecutiveUnresolved() {
      return consecutiveUnresolved;
    },
  };
}

export function startVenueTbdRetryScheduler(): NodeJS.Timeout {
  return createVenueTbdRetryScheduler().start();
}
