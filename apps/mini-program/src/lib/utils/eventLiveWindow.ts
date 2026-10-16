/**
 * Pool 进入破冰 window (2026-10-16 fix).
 *
 * The event-detail page used to gate the icebreaker CTA on
 * `status ∈ {started, active, ongoing}`. That set is unreachable for pool
 * events: the server writes `active` (招募中) → `matching` (排桌中) →
 * `matched` (已成局) → `completed`, never `started`/`ongoing`, and a
 * `eventPoolGroups.id` only exists AFTER matching — i.e. exactly when the
 * status has already left the live set. The only pool that ever showed the CTA
 * was a test pool parked on `active` with a single-test group.
 *
 * Pools therefore use a *time* window instead (blind-box events keep their
 * status gate — the server does write started/ongoing for them):
 *
 *   [start − 1h, start + 3h]
 *
 * - 1h lead-in: people arrive ~30min early and the host still has to run the
 *   tier selection before anyone can 进入破冰.
 * - 3h tail: mirrors `POOL_COMPLETION_BUFFER_MS` (server, poolCompletionSweep)
 *   — the same +3h boundary that opens feedback, so 进入破冰 hands the bar over
 *   to 去评价 instead of the two coexisting. (Rejoining a session later than
 *   +3h is intentionally out of this surface's scope.)
 *
 * Statuses `cancelled`/`archived` never open the window even if the clock says
 * so; a missing or unparseable dateTime fails closed (no CTA rather than a
 * dead one).
 */

/** Mirror of the server's `POOL_COMPLETION_BUFFER_MS` (3h) — keep in sync. */
export const POOL_ICEBREAKER_TAIL_MS = 3 * 60 * 60 * 1000

/** How early before the event start the CTA becomes available. */
export const POOL_ICEBREAKER_LEAD_IN_MS = 60 * 60 * 1000

/** Pool statuses that keep the CTA hidden regardless of the clock. */
const POOL_ICEBREAKER_BLOCKED_STATUSES = new Set(['cancelled', 'archived'])

export function isWithinPoolIcebreakerWindow(
  event: { status?: string | null; dateTime?: string | null },
  now: number = Date.now(),
): boolean {
  if (!event.status || POOL_ICEBREAKER_BLOCKED_STATUSES.has(event.status)) return false
  if (!event.dateTime) return false

  const startMs = new Date(event.dateTime).getTime()
  if (Number.isNaN(startMs)) return false

  return now >= startMs - POOL_ICEBREAKER_LEAD_IN_MS && now <= startMs + POOL_ICEBREAKER_TAIL_MS
}
