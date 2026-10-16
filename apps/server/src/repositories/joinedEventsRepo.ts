/**
 * Joined Events Repository — N+1-free bulk queries for GET /api/events/joined
 *
 * Returns all events a user has joined (legacy events + pool registrations)
 * in a single unified shape, sorted by dateTime descending.
 *
 * Why a dedicated repository?
 *   - The legacy `storage.getUserJoinedEvents()` has an N+1 on participants
 *     (line 214 of legacyStorageRepo.ts).
 *   - The Events tab only needs id/title/dateTime/location/status/description.
 *   - Pool registrations are also "joined events" and must be included.
 */

import { eq, desc, and, inArray, isNull } from "drizzle-orm";
import { db } from "../db";
import { events, eventAttendance, eventFeedback, eventPools, eventPoolRegistrations, eventPoolGroups } from "@shared/schema";
import type { JoinedEventSummary } from "@shared/api";
import { POOL_COMPLETION_BUFFER_MS } from "../lib/poolCompletionSweep";
import { FEEDBACK_ELIGIBLE_MATCH_STATUSES } from "../lib/feedbackStateResolver";

/**
 * Derive a user-facing status for pool events from the matching + venue lifecycle.
 *
 * Matching flow:
 *   1. User registers → eventPoolRegistrations.matchStatus = 'pending'
 *   2. Matching runs → matchStatus = 'matched', assignedGroupId set
 *   3. Venue assignment runs → eventPoolGroups.venueAssignmentStatus becomes 'assigned'
 *      and venueName/venueAddress are populated
 *   4. Only once the venue is assigned do we disclose it as 'venue_unlocked'.
 *
 * The pool-level `eventPools.status` can override the registration-level state
 * when the pool itself is terminal (`completed` or `cancelled`). This prevents a
 * matched registration from still appearing as "matched" after the event has
 * finished or the pool has been cancelled by the organizer.
 */
export function derivePoolDisplayStatus(
  matchStatus: string | null | undefined,
  venueAssignmentStatus: string | null | undefined,
  venueName: string | null | undefined,
  poolStatus: string | null | undefined,
): JoinedEventSummary["displayStatus"] {
  if (poolStatus === "cancelled") return "cancelled";
  if (poolStatus === "completed") return "attended";

  // Registration-level completion (poolCompletionSweep flips matched →
  // completed at start +3h in the same tx as the pool status; this branch is
  // the belt-and-braces read for any row where only the registration moved).
  if (matchStatus === "completed") return "attended";

  if (matchStatus === "pending") return "pending";
  if (matchStatus === "matched") {
    const venueReady = venueAssignmentStatus === "assigned" || venueAssignmentStatus === "manual_override";
    if (venueReady && venueName) {
      return "venue_unlocked";
    }
    return "matched";
  }
  if (matchStatus === "unmatched") return "cancelled";
  return undefined;
}

/**
 * Derive a user-facing status for legacy events from eventAttendance.status.
 */
export function deriveLegacyDisplayStatus(
  attendanceStatus: string | null | undefined,
  eventStatus: string | null | undefined,
): JoinedEventSummary["displayStatus"] {
  const status = attendanceStatus ?? eventStatus;
  switch (status) {
    case "confirmed":
      return "confirmed";
    case "pending":
      return "registered";
    case "completed":
    case "attended":
      return "attended";
    case "cancelled":
      return "cancelled";
    case "no_show":
      return "no_show";
    case "declined":
      return "declined";
    case "upcoming":
      return "upcoming";
    default:
      return "upcoming";
  }
}

// ── feedbackPending derivation (2026-10-16 feedback activation, plan D8) ────
//
// A joined event carries the 足迹「去评价」pill when the viewer is eligible,
// the event has been over for POOL_COMPLETION_BUFFER_MS (the same +3h rule
// lib/feedbackStateResolver enforces — the resolver stays the authority for
// the detail page and the POST gate; these predicates only drive the pill),
// and no event_feedback row exists yet. Feedback rows key on canonical
// events.id, so pool rows map through their matched group's eventId — never
// the pool id itself (the connectionsContextResolver id-family mismatch,
// plan §2.1). One batched existence query; no N+1.

function toEpochMs(dateTime: Date | string | null | undefined): number | null {
  if (!dateTime) return null;
  const ms = dateTime instanceof Date ? dateTime.getTime() : new Date(dateTime).getTime();
  return Number.isFinite(ms) ? ms : null;
}

/** Pool-row eligibility + window for the 去评价 pill (D5: matched/completed). */
export function isPoolFeedbackPending(params: {
  matchStatus: string | null;
  poolStatus: string | null;
  dateTime: Date | string | null;
  hasCanonicalEventId: boolean;
  hasSubmittedFeedback: boolean;
  nowMs: number;
}): boolean {
  if (!params.hasCanonicalEventId || params.hasSubmittedFeedback) return false;
  if (!params.matchStatus || !FEEDBACK_ELIGIBLE_MATCH_STATUSES.includes(params.matchStatus)) return false;
  if (params.poolStatus === "cancelled" || params.poolStatus === "archived") return false;
  const startMs = toEpochMs(params.dateTime);
  if (startMs === null) return false;
  return startMs + POOL_COMPLETION_BUFFER_MS <= params.nowMs;
}

/** Legacy-row eligibility + window (D5: non-cancelled attendance + event). */
export function isLegacyFeedbackPending(params: {
  attendanceStatus: string | null;
  eventStatus: string | null;
  dateTime: Date | string | null;
  hasSubmittedFeedback: boolean;
  nowMs: number;
}): boolean {
  if (params.hasSubmittedFeedback) return false;
  if (params.attendanceStatus === "cancelled" || params.eventStatus === "cancelled") return false;
  const startMs = toEpochMs(params.dateTime);
  if (startMs === null) return false;
  return startMs + POOL_COMPLETION_BUFFER_MS <= params.nowMs;
}

/**
 * Batch-load the canonical event ids this user already submitted feedback
 * for, restricted to the candidate set — one round-trip, no N+1.
 */
async function loadSubmittedFeedbackEventIds(
  userId: string,
  candidateEventIds: string[],
): Promise<Set<string>> {
  if (candidateEventIds.length === 0) return new Set();
  const rows = await db
    .select({ eventId: eventFeedback.eventId })
    .from(eventFeedback)
    .where(
      and(
        eq(eventFeedback.userId, userId),
        inArray(eventFeedback.eventId, candidateEventIds),
      ),
    );
  return new Set(rows.map((row: { eventId: string }) => row.eventId));
}

/**
 * Fetch all events a user has joined (legacy + pool) as JoinedEventSummary[].
 * N+1-free: exactly 2 DB round-trips in parallel.
 */
export async function getUserJoinedEventsSummary(userId: string): Promise<JoinedEventSummary[]> {
  // 1. Legacy events via eventAttendance (1 round-trip)
  //    Exclude events that were derived from a pool match (`<pool> - 第N组`).
  //    Those are a second, unservable representation of the same matched pool —
  //    the pool branch below already covers them with a working event-detail id,
  //    and the legacy `events.id` has no serving detail endpoint.
  const legacyRows = await db
    .select({
      id: events.id,
      title: events.title,
      dateTime: events.dateTime,
      location: events.location,
      area: events.area,
      status: events.status,
      description: events.description,
      attendanceStatus: eventAttendance.status,
    })
    .from(eventAttendance)
    .innerJoin(events, eq(eventAttendance.eventId, events.id))
    .leftJoin(eventPoolGroups, eq(eventPoolGroups.eventId, events.id))
    .where(and(eq(eventAttendance.userId, userId), isNull(eventPoolGroups.id)))
    .orderBy(desc(events.dateTime));

  // 2. Pool events via eventPoolRegistrations (1 round-trip)
  const poolRows = await db
    .select({
      id: eventPools.id,
      registrationId: eventPoolRegistrations.id,
      title: eventPools.title,
      dateTime: eventPools.dateTime,
      location: eventPools.city,
      status: eventPools.status,
      description: eventPools.description,
      eventType: eventPools.eventType,
      city: eventPools.city,
      district: eventPools.district,
      registrationDeadline: eventPools.registrationDeadline,
      price: eventPools.price,
      matchedAt: eventPools.matchedAt,
      matchStatus: eventPoolRegistrations.matchStatus,
      assignedGroupId: eventPoolRegistrations.assignedGroupId,
      venueName: eventPoolGroups.venueName,
      venueAddress: eventPoolGroups.venueAddress,
      finalDateTime: eventPoolGroups.finalDateTime,
      venueAssignmentStatus: eventPoolGroups.venueAssignmentStatus,
      memberCount: eventPoolGroups.memberCount,
      // Canonical events.id of the matched group — the event_feedback FK
      // target. Needed to derive feedbackPending without the
      // connectionsContextResolver id-family mismatch (plan §2.1).
      canonicalEventId: eventPoolGroups.eventId,
    })
    .from(eventPoolRegistrations)
    .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
    .leftJoin(eventPoolGroups, eq(eventPoolRegistrations.assignedGroupId, eventPoolGroups.id))
    .where(
      and(
        eq(eventPoolRegistrations.userId, userId),
        // 'completed' included (2026-10-16): poolCompletionSweep flips
        // matched → completed at event start +3h; without it a finished
        // pool vanished from the footprint instead of landing in 已完成,
        // and the 去评价 pill (feedbackPending) could never attach.
        inArray(eventPoolRegistrations.matchStatus, ["pending", "matched", "completed"])
      )
    )
    .orderBy(desc(eventPools.dateTime));

  // 3. feedbackPending derivation — batch existence check over the eligible
  //    candidates (1 extra round-trip). Candidate = eligible + window passed,
  //    ignoring submission; the flag additionally requires no feedback row.
  const nowMs = Date.now();
  const isLegacyCandidate = (row: (typeof legacyRows)[number]): boolean =>
    isLegacyFeedbackPending({
      attendanceStatus: row.attendanceStatus,
      eventStatus: row.status,
      dateTime: row.dateTime,
      hasSubmittedFeedback: false,
      nowMs,
    });
  const isPoolCandidate = (row: (typeof poolRows)[number]): boolean =>
    isPoolFeedbackPending({
      matchStatus: row.matchStatus,
      poolStatus: row.status,
      dateTime: row.dateTime,
      hasCanonicalEventId: !!row.canonicalEventId,
      hasSubmittedFeedback: false,
      nowMs,
    });
  const candidateEventIds: string[] = [
    ...legacyRows.filter(isLegacyCandidate).map((row: typeof legacyRows[number]) => row.id),
    ...poolRows.filter(isPoolCandidate).map((row: typeof poolRows[number]) => row.canonicalEventId as string),
  ];
  const submittedEventIds = await loadSubmittedFeedbackEventIds(userId, candidateEventIds);

  // 4. Merge into unified shape
  const legacyEvents: JoinedEventSummary[] = legacyRows.map((row: typeof legacyRows[number]) => ({
    id: row.id,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
    location: row.location ?? undefined,
    district: row.area ?? undefined,
    status: row.attendanceStatus ?? row.status ?? undefined,
    description: row.description ?? undefined,
    displayStatus: deriveLegacyDisplayStatus(row.attendanceStatus, row.status),
    feedbackPending:
      isLegacyCandidate(row) && !submittedEventIds.has(row.id) ? true : undefined,
  }));

  const poolEvents: JoinedEventSummary[] = poolRows.map((row: typeof poolRows[number]) => ({
    id: row.id,
    registrationId: row.registrationId,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
    location: row.location ?? undefined,
    status: row.matchStatus ?? row.status ?? undefined,
    description: row.description ?? undefined,
    eventType: row.eventType ?? undefined,
    city: row.city ?? undefined,
    district: row.district ?? undefined,
    venueName: row.venueName ?? undefined,
    venueAddress: row.venueAddress ?? undefined,
    registrationDeadline: row.registrationDeadline?.toISOString?.() ?? undefined,
    price: row.price ?? undefined,
    matchedAt: row.matchedAt?.toISOString?.() ?? undefined,
    groupId: row.assignedGroupId ?? undefined,
    finalDateTime: row.finalDateTime?.toISOString?.() ?? undefined,
    venueAssignmentStatus: row.venueAssignmentStatus ?? undefined,
    groupSize: row.memberCount ?? undefined,
    displayStatus: derivePoolDisplayStatus(
      row.matchStatus,
      row.venueAssignmentStatus,
      row.venueName,
      row.status,
    ),
    feedbackPending:
      isPoolCandidate(row) && !submittedEventIds.has(row.canonicalEventId as string)
        ? true
        : undefined,
  }));

  // 5. Merge and sort by dateTime descending
  const allEvents = [...legacyEvents, ...poolEvents];
  allEvents.sort((a, b) => {
    const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
    const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
    return dateB - dateA;
  });

  return allEvents;
}

/**
 * Lightweight event slice for the Connections shell context resolver.
 *
 * Only id/title/dateTime are returned, and results are capped to reduce payload
 * size for users with long event histories. Upcoming events are naturally at the
 * top of a descending-by-dateTime list, so the cap still covers the nearest
 * upcoming event and the most recent past events for feedback-pending logic.
 */
export interface ConnectionsContextEvent {
  id: string;
  title?: string;
  dateTime?: string;
}

const CONNECTIONS_CONTEXT_EVENT_LIMIT = 50;

export async function getConnectionsContextEvents(userId: string): Promise<ConnectionsContextEvent[]> {
  const now = new Date();

  const [legacyRows, poolRows] = await Promise.all([
    db
      .select({
        id: events.id,
        title: events.title,
        dateTime: events.dateTime,
      })
      .from(eventAttendance)
      .innerJoin(events, eq(eventAttendance.eventId, events.id))
      .where(eq(eventAttendance.userId, userId))
      .orderBy(desc(events.dateTime))
      .limit(CONNECTIONS_CONTEXT_EVENT_LIMIT),

    db
      .select({
        id: eventPools.id,
        title: eventPools.title,
        dateTime: eventPools.dateTime,
      })
      .from(eventPoolRegistrations)
      .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
      .where(
        and(
          eq(eventPoolRegistrations.userId, userId),
          inArray(eventPoolRegistrations.matchStatus, ["pending", "matched"])
        )
      )
      .orderBy(desc(eventPools.dateTime))
      .limit(CONNECTIONS_CONTEXT_EVENT_LIMIT),
  ]);

  const legacyEvents: ConnectionsContextEvent[] = legacyRows.map((row: typeof legacyRows[number]) => ({
    id: row.id,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
  }));

  const poolEvents: ConnectionsContextEvent[] = poolRows.map((row: typeof poolRows[number]) => ({
    id: row.id,
    title: row.title ?? undefined,
    dateTime: row.dateTime?.toISOString?.() ?? String(row.dateTime),
  }));

  const allEvents = [...legacyEvents, ...poolEvents];
  allEvents.sort((a, b) => {
    const dateA = a.dateTime ? new Date(a.dateTime).getTime() : 0;
    const dateB = b.dateTime ? new Date(b.dateTime).getTime() : 0;
    return dateB - dateA;
  });

  return allEvents.slice(0, CONNECTIONS_CONTEXT_EVENT_LIMIT);
}
