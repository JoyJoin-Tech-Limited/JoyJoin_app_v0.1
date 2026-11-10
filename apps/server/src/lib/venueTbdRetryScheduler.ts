/**
 * Venue-TBD retry scheduler (W8 AC-W8.5, hard deadline 2026-11-11).
 *
 * Periodically re-runs venue assignment for pools whose groups are still
 * unassigned, and sends an escalating ops alert when assignment remains
 * unresolved for several retries in a row.
 *
 * The T-24h rule is a promise, not an alert: once the event is less than a day
 * away and a group still has no venue, the pool is cancelled and every paid
 * registration is refunded (`cancelPoolForUnresolvedVenue`). Users therefore
 * only ever see 场地已定 or 已取消并退款 — no "venue pending" limbo on the eve
 * of the event.
 *
 * Fail-open (same posture as the icebreaker TTL sweep): a transient error is
 * logged and retried on the next tick; it never stops the scheduler.
 */

import { logger } from "./logger";
import { VENUE_TBD_DECISION_HOURS } from "./poolScheduleRules";
import {
  cancelPoolForUnresolvedVenue,
  retryVenueTbdAssignments,
  type VenueTbdCancellationResult,
  type VenueTbdRetryResult,
} from "./venueTbdRetry";
import { notifyVenueTbdEscalation } from "./wecomNotifications/matching";

export { VENUE_TBD_DECISION_HOURS } from "./poolScheduleRules";

export const VENUE_TBD_RETRY_INTERVAL_MS = 30 * 60 * 1000;
/** Unresolved retries before a `warning` escalation is sent. */
export const VENUE_TBD_ESCALATION_THRESHOLD = 2;

type SchedulerLogger = {
  info(message: string, ctx?: Record<string, unknown>): void;
  warn(message: string, ctx?: Record<string, unknown>): void;
  error(message: string, ctx?: Record<string, unknown>): void;
};

export interface VenueTbdRetryDependencies {
  logger: SchedulerLogger;
  retryVenueTbdAssignments: () => Promise<VenueTbdRetryResult>;
  notifyEscalation: typeof notifyVenueTbdEscalation;
  cancelPool: (poolId: string) => Promise<VenueTbdCancellationResult>;
  now: () => number;
}

function reasonBreakdownToString(reasonBreakdown: Record<string, number>): string {
  return Object.entries(reasonBreakdown)
    .map(([reason, count]) => `${reason}: ${count}组`)
    .join("; ");
}

/** Pure deadline decision, extracted for unit testing. */
export function resolveVenueTbdAction(params: {
  consecutiveUnresolved: number;
  hoursUntilEvent: number | null;
}): "cancel" | "warning" | null {
  if (params.hoursUntilEvent !== null && params.hoursUntilEvent <= VENUE_TBD_DECISION_HOURS) {
    return "cancel";
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
    cancelPool: cancelPoolForUnresolvedVenue,
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
        const action = resolveVenueTbdAction({
          consecutiveUnresolved,
          hoursUntilEvent,
        });
        if (!action) continue;

        // The 24h promise wins over the ops alert: cancelling + refunding is
        // the answer, so an unresolved-venue warning at this point would just
        // be noise for a problem the user has already been spared.
        if (action === "cancel") {
          dependencies.logger.warn("[VenueTbdRetry] venue deadline reached — cancelling pool", {
            component: "venue_tbd_retry",
            poolId: pool.poolId,
            unassignedGroups: pool.stillUnassigned,
            totalGroups: pool.totalGroups,
            hoursUntilEvent,
          });
          try {
            const cancellation = await dependencies.cancelPool(pool.poolId);
            dependencies.logger.info("[VenueTbdRetry] deadline cancellation finished", {
              component: "venue_tbd_retry",
              poolId: pool.poolId,
              cancelled: cancellation.cancelled,
              refunded: cancellation.refunded,
              reason: cancellation.reason,
            });
          } catch (error) {
            dependencies.logger.error("[VenueTbdRetry] deadline cancellation failed; will retry", {
              component: "venue_tbd_retry",
              poolId: pool.poolId,
              error: error instanceof Error ? error.message : String(error),
            });
          }
          continue;
        }

        dependencies.logger.warn("[VenueTbdRetry] venue still unassigned — escalating", {
          component: "venue_tbd_retry",
          poolId: pool.poolId,
          unassignedGroups: pool.stillUnassigned,
          totalGroups: pool.totalGroups,
          hoursUntilEvent,
          consecutiveUnresolved,
          severity: action,
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
            severity: action,
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
