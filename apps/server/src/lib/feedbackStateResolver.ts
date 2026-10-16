/**
 * Feedback state resolver (2026-10-16 feedback activation, plan D1/D5 —
 * docs/proposals/2026-10-16-event-feedback-activation-plan.md).
 *
 * Single source of truth for the per-viewer event-feedback lifecycle:
 *
 *   locked     — eligible, but the event is not over yet (opens at start +3h)
 *   open       — window open, nothing submitted yet
 *   submitted  — this user already submitted feedback for the event
 *   ineligible — 未成行 / refunded / cancelled / collapsed / never joined
 *   closed     — reserved for a future window close; never emitted today (D2)
 *
 * Shared by the POST /api/events/:eventId/feedback gate (403/409 coded
 * rejections) and GET /api/events/:eventId/feedback-state (the client button
 * state machine), so display and enforcement can never drift apart. The
 * client never derives this from dateTime itself.
 *
 * Id families — all three are canonicalized here (the client passes whatever
 * id it holds):
 *   - event_pools.id      — pool detail pages (the common case), resolved
 *                           through the viewer's registration → assigned group
 *                           → derived events.id (the event_feedback FK target)
 *   - events.id           — legacy events AND pool-derived per-group events
 *   - blind_box_events.id — squad-unboxing redirect ids, resolved via the
 *                           group's blindBoxEventId back-link
 *
 * Time rule (D1): feedback opens at event start + POOL_COMPLETION_BUFFER_MS
 * (3h) — the same buffer poolCompletionSweep completes pools on — so the
 * display state never fights the sweep's hourly tick, and test pools open on
 * the same rule (D10: testers walk the full flow; no is_test_pool exclusion
 * here). dateTime columns are true UTC instants (see lib/eventDateTime.ts),
 * so the comparison is plain epoch arithmetic — no local-time getters.
 *
 * Eligibility (D5):
 *   - pool family      — the viewer's registration has matchStatus ∈
 *                        {matched, completed} (pending/unmatched/refunded/
 *                        cancelled → ineligible) and the pool is not
 *                        cancelled/archived. A collapsed group's exiter has
 *                        no registration row; stayers are flipped to
 *                        'unmatched' — both land on ineligible.
 *   - blind-box/legacy — a non-cancelled event_attendance row, and the event
 *                        itself is not cancelled.
 *   no-show (attendanceStatus='absent') stays eligible this iteration —
 *   attendance-gating is an explicit follow-up (plan §6).
 */

import { and, eq, ne } from "drizzle-orm";
import { db } from "../db";
import {
  blindBoxEvents,
  eventAttendance,
  eventFeedback,
  eventPoolGroups,
  eventPoolRegistrations,
  eventPools,
  events,
} from "@shared/schema";
import type { EventFeedbackState } from "@shared/api";
import { POOL_COMPLETION_BUFFER_MS } from "./poolCompletionSweep";

/** Feedback opens when the event has (very likely) wrapped up: start + 3h. */
export const FEEDBACK_OPEN_OFFSET_MS = POOL_COMPLETION_BUFFER_MS;

/** D5: pool-side eligibility = the user was actually placed at a table. */
export const FEEDBACK_ELIGIBLE_MATCH_STATUSES: readonly string[] = ["matched", "completed"];

/** Pool statuses where the event never happened (or was withdrawn). */
const INELIGIBLE_POOL_STATUSES: readonly string[] = ["cancelled", "archived"];

export interface FeedbackStateResolution {
  state: EventFeedbackState;
  /**
   * Canonical events.id backing this event, when one exists. Null for
   * known-but-never-formed ids (pending registrations, unmatched blind
   * boxes) — those resolve to `ineligible` and have nothing to attach
   * feedback to. Informational for callers; the POST gate keeps using the
   * guard-resolved req.canonicalEventId for writes.
   */
  canonicalEventId: string | null;
}

type FeedbackDb = Pick<typeof db, "select">;

export interface ResolveFeedbackStateOptions {
  /** Injectable clock for tests; defaults to the real wall clock. */
  now?: Date;
  /** Injectable db handle for tests; defaults to the live pool. */
  database?: FeedbackDb;
}

interface PoolStateRow {
  id: string;
  status: string | null;
  dateTime: Date | null;
}

/**
 * Resolve the feedback lifecycle state for one viewer + one event id.
 *
 * Returns null when the id belongs to none of the three families (callers
 * map that to 404). Everything else — including "known id, but the viewer
 * has no eligible seat" — resolves to a state so clients can hide the
 * feedback surface deliberately instead of erroring.
 */
export async function resolveFeedbackState(
  rawEventId: string,
  userId: string,
  options: ResolveFeedbackStateOptions = {},
): Promise<FeedbackStateResolution | null> {
  const database = options.database ?? db;
  const now = options.now ?? new Date();

  // Family 3 first: event_pools.id is the hot path (event-detail pages pass
  // pool ids). Ids are per-table gen_random_uuid() — cross-family collisions
  // are not a realistic concern, so probe order is purely about cost.
  const [pool] = await database
    .select({ id: eventPools.id, status: eventPools.status, dateTime: eventPools.dateTime })
    .from(eventPools)
    .where(eq(eventPools.id, rawEventId))
    .limit(1);
  if (pool) {
    return resolvePoolFeedbackState(database, pool, userId, now);
  }

  // Family 1: direct events.id. Pool-derived group events (`<pool> - 第N组`)
  // redirect into the pool rule set via their group back-link; standalone
  // legacy events use the attendance rule.
  const [event] = await database
    .select({ id: events.id, dateTime: events.dateTime, status: events.status })
    .from(events)
    .where(eq(events.id, rawEventId))
    .limit(1);
  if (event) {
    const [group] = await database
      .select({ poolId: eventPoolGroups.poolId })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.eventId, event.id))
      .limit(1);
    if (group) {
      const [groupPool] = await database
        .select({ id: eventPools.id, status: eventPools.status, dateTime: eventPools.dateTime })
        .from(eventPools)
        .where(eq(eventPools.id, group.poolId))
        .limit(1);
      if (!groupPool) {
        return { state: "ineligible", canonicalEventId: event.id };
      }
      // The viewer passed the derived events.id directly — that IS the
      // canonical id; skip the assignedGroupId re-resolution.
      return resolvePoolFeedbackState(database, groupPool, userId, now, event.id);
    }
    if (event.status === "cancelled") {
      return { state: "ineligible", canonicalEventId: event.id };
    }
    const attendance = await findActiveAttendance(database, userId, event.id);
    if (!attendance) {
      return { state: "ineligible", canonicalEventId: event.id };
    }
    return resolveSubmittedOrWindow(database, event.id, event.dateTime, userId, now);
  }

  // Family 2: blind_box_events.id. Group-linked blind boxes inherit the pool
  // rules; the canonical id is the linked group's derived events.id (same
  // mapping resolveCanonicalEventId uses, so gate and guard never disagree).
  const [blindBoxGroup] = await database
    .select({ poolId: eventPoolGroups.poolId, eventId: eventPoolGroups.eventId })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.blindBoxEventId, rawEventId))
    .limit(1);
  if (blindBoxGroup) {
    if (!blindBoxGroup.eventId) {
      return { state: "ineligible", canonicalEventId: null };
    }
    const [groupPool] = await database
      .select({ id: eventPools.id, status: eventPools.status, dateTime: eventPools.dateTime })
      .from(eventPools)
      .where(eq(eventPools.id, blindBoxGroup.poolId))
      .limit(1);
    if (!groupPool) {
      return { state: "ineligible", canonicalEventId: blindBoxGroup.eventId };
    }
    return resolvePoolFeedbackState(database, groupPool, userId, now, blindBoxGroup.eventId);
  }

  // A standalone blind-box event (no matched group) never formed a table
  // (未成行) and has no canonical event to attach feedback to → ineligible.
  const [blindBox] = await database
    .select({ id: blindBoxEvents.id })
    .from(blindBoxEvents)
    .where(eq(blindBoxEvents.id, rawEventId))
    .limit(1);
  if (blindBox) {
    return { state: "ineligible", canonicalEventId: null };
  }

  return null;
}

/**
 * Pool-family rule set (D5 + D1): pool not cancelled/archived, registration
 * in an eligible match status, then submitted/window on the canonical event.
 * `canonicalEventIdOverride` covers callers that already hold the derived
 * events.id (direct events.id / blind-box group links).
 */
async function resolvePoolFeedbackState(
  database: FeedbackDb,
  pool: PoolStateRow,
  userId: string,
  now: Date,
  canonicalEventIdOverride?: string,
): Promise<FeedbackStateResolution> {
  if (pool.status && INELIGIBLE_POOL_STATUSES.includes(pool.status)) {
    return { state: "ineligible", canonicalEventId: canonicalEventIdOverride ?? null };
  }

  const [registration] = await database
    .select({
      matchStatus: eventPoolRegistrations.matchStatus,
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
    })
    .from(eventPoolRegistrations)
    .where(
      and(
        eq(eventPoolRegistrations.poolId, pool.id),
        eq(eventPoolRegistrations.userId, userId),
      ),
    )
    .limit(1);
  if (!registration || !registration.matchStatus || !FEEDBACK_ELIGIBLE_MATCH_STATUSES.includes(registration.matchStatus)) {
    return { state: "ineligible", canonicalEventId: canonicalEventIdOverride ?? null };
  }

  let canonicalEventId = canonicalEventIdOverride ?? null;
  if (!canonicalEventId) {
    if (!registration.assignedGroupId) {
      // Eligible status but no group projection — fail-closed ineligible;
      // there is no derived event to attach feedback to.
      return { state: "ineligible", canonicalEventId: null };
    }
    const [group] = await database
      .select({ eventId: eventPoolGroups.eventId })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.id, registration.assignedGroupId))
      .limit(1);
    canonicalEventId = group?.eventId ?? null;
    if (!canonicalEventId) {
      return { state: "ineligible", canonicalEventId: null };
    }
  }

  return resolveSubmittedOrWindow(database, canonicalEventId, pool.dateTime, userId, now);
}

/**
 * Non-cancelled attendance row for legacy-events eligibility (D5). Only the
 * events.id key is reachable: standalone blind-box ids are deliberately
 * ineligible (see family-2 comment) because the canonical guard cannot map
 * them to an event_feedback target, so there is nothing to attach feedback to.
 */
async function findActiveAttendance(
  database: FeedbackDb,
  userId: string,
  eventId: string,
): Promise<{ id: string } | undefined> {
  const [attendance] = await database
    .select({ id: eventAttendance.id })
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, eventId),
        eq(eventAttendance.userId, userId),
        ne(eventAttendance.status, "cancelled"),
      ),
    )
    .limit(1);
  return attendance;
}

/**
 * Submitted check, then the time window. Submitted wins over `locked` on
 * purpose: submissions made before this gate existed (pre-2026-10-16) can
 * predate the +3h open, and the honest answer for a re-submit is
 * ALREADY_SUBMITTED, not NOT_OPEN.
 */
async function resolveSubmittedOrWindow(
  database: FeedbackDb,
  canonicalEventId: string,
  eventDateTime: Date | null,
  userId: string,
  now: Date,
): Promise<FeedbackStateResolution> {
  const [existing] = await database
    .select({ id: eventFeedback.id })
    .from(eventFeedback)
    .where(and(eq(eventFeedback.userId, userId), eq(eventFeedback.eventId, canonicalEventId)))
    .limit(1);
  if (existing) {
    return { state: "submitted", canonicalEventId };
  }
  if (!eventDateTime) {
    // No start time to reason about — fail-closed to locked (never open).
    return { state: "locked", canonicalEventId };
  }
  const opensAtMs = eventDateTime.getTime() + FEEDBACK_OPEN_OFFSET_MS;
  return { state: now.getTime() >= opensAtMs ? "open" : "locked", canonicalEventId };
}
