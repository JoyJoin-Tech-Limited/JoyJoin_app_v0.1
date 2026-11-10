/**
 * Pool schedule rules (2026-11-11).
 *
 * The venue promise is a hard one: users are told where to go by 活动前一天
 * (T-24h). If no venue can be found by then the pool is cancelled and refunded
 * (see `venueTbdRetryScheduler`). This module holds the shared numbers and the
 * create/update validation so the promise is achievable from the moment a pool
 * is authored — a deadline inside the promise window would make it impossible.
 *
 * Kept dependency-free so routes can import it without pulling the whole
 * matching/venue-assignment graph (and so there is exactly one rule).
 */

/** Hours before the event at which an unresolved venue becomes a cancellation. */
export const VENUE_TBD_DECISION_HOURS = 24;

/**
 * Registration must close at least this long before the event so the T-24h
 * promise has room to run its final assignment pass.
 */
export const MIN_REGISTRATION_LEAD_HOURS = VENUE_TBD_DECISION_HOURS + 2;

/**
 * Returns a user-facing error message when a pool schedule cannot honour the
 * 24h venue promise, or null when it is fine. Shared by the create and update
 * routes so the two can never drift.
 */
export function validatePoolScheduleForVenuePromise(
  dateTime: Date,
  registrationDeadline: Date,
): string | null {
  if (dateTime <= registrationDeadline) {
    return "活动时间必须晚于报名截止时间";
  }
  const leadHours = (dateTime.getTime() - registrationDeadline.getTime()) / (60 * 60 * 1000);
  if (leadHours < MIN_REGISTRATION_LEAD_HOURS) {
    return `报名截止需早于活动开始至少 ${MIN_REGISTRATION_LEAD_HOURS} 小时，以便在活动前 ${VENUE_TBD_DECISION_HOURS} 小时确定场地`;
  }
  return null;
}
