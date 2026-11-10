/**
 * Event table roster (G0, 2026-11-10 — 互选表内权威).
 *
 * The connection-selection write paths (POST /api/events/:eventId/feedback with
 * a non-empty selection, and PUT /api/events/:eventId/connection-selection) may
 * only accept peers the viewer actually sat with. Before this module the server
 * accepted ANY user id, so a crafted payload could create a `connections` row
 * (and later release a WeChat snapshot) for a stranger.
 *
 * Roster sources are the SAME ones `GET /api/events/:eventId/participants`
 * already reads, keyed by the canonical `events.id` the write paths hold:
 *
 *   1. pool_group        — the viewer's registration → `assigned_group_id` →
 *                          `event_pool_groups.eventId`. One `events` row is
 *                          created PER GROUP at match time
 *                          (`matching/matchPersistence.ts`), so this is exactly
 *                          the viewer's table. Strongest source; preferred.
 *   2. event_attendance  — legacy / blind-box-derived events: every
 *                          non-cancelled attendance row for the event.
 *
 * The roster is a SET for validation only — it never carries names, avatars or
 * any other profile field, and no caller may project it to a client.
 *
 * TODO(table-grouping): `event_attendance` has no table/group column, so for a
 * legacy event whose `events` row covers more than one physical table the
 * fallback can only prove SAME-EVENT membership, not same-table membership.
 * `EventTableRoster.tableScoped` exposes that honestly. Closing it needs either
 * (a) a `table_id`/`group_id` column on `event_attendance`, or (b) always
 * routing selection through the pool-group path. Until then the fallback is
 * deliberately conservative in the only direction available: same event, never
 * an arbitrary user.
 */

import { and, eq, inArray, ne } from "drizzle-orm";
import { db } from "../db";
import { eventAttendance, eventPoolGroups, eventPoolRegistrations } from "@shared/schema";
import { logger } from "../lib/logger";

/**
 * Mirrors `FEEDBACK_ELIGIBLE_MATCH_STATUSES` (lib/feedbackStateResolver.ts):
 * a seat counts as "sat at the table" under the same rule that gates feedback,
 * so a viewer who may submit feedback can always select their real tablemates.
 */
export const TABLE_ROSTER_MATCH_STATUSES: readonly string[] = ["matched", "completed"];

export type EventTableRosterSource = "pool_group" | "event_attendance";

export interface EventTableRoster {
  /** Distinct user ids seated with the viewer (may include the viewer). */
  userIds: string[];
  source: EventTableRosterSource;
  /**
   * True when the roster is provably ONE table. False for the attendance
   * fallback, where the schema cannot distinguish tables within an event
   * (see the module TODO).
   */
  tableScoped: boolean;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RosterExecutor = Pick<typeof db, "select"> | any;

const EMPTY_ROSTER: EventTableRoster = {
  userIds: [],
  source: "event_attendance",
  tableScoped: false,
};

/**
 * Resolve the viewer's table roster for one canonical event.
 *
 * Never throws on an unknown/empty event: an empty roster is returned, and the
 * caller's pure `findInvalidTablemates()` then rejects every selected peer —
 * fail closed, exactly what "do not silently accept arbitrary users" requires.
 */
export async function getEventTableRoster(
  canonicalEventId: string,
  viewerId: string,
  options: { executor?: RosterExecutor } = {},
): Promise<EventTableRoster> {
  if (!canonicalEventId || !viewerId) return EMPTY_ROSTER;
  const executor: RosterExecutor = options.executor ?? db;

  // ── 1. Pool group (table-scoped) ───────────────────────────────────────────
  const [ownGroup] = await executor
    .select({ groupId: eventPoolGroups.id })
    .from(eventPoolRegistrations)
    .innerJoin(
      eventPoolGroups,
      eq(eventPoolRegistrations.assignedGroupId, eventPoolGroups.id),
    )
    .where(
      and(
        eq(eventPoolRegistrations.userId, viewerId),
        eq(eventPoolGroups.eventId, canonicalEventId),
      ),
    )
    .limit(1);

  if (ownGroup?.groupId) {
    const members = await executor
      .select({ userId: eventPoolRegistrations.userId })
      .from(eventPoolRegistrations)
      .where(
        and(
          eq(eventPoolRegistrations.assignedGroupId, ownGroup.groupId),
          inArray(eventPoolRegistrations.matchStatus, TABLE_ROSTER_MATCH_STATUSES),
        ),
      );
    return {
      userIds: uniqueUserIds(members.map((row: { userId: string }) => row.userId)),
      source: "pool_group",
      tableScoped: true,
    };
  }

  // ── 2. Attendance fallback (same event, table grouping unavailable) ────────
  const attendees = await executor
    .select({ userId: eventAttendance.userId })
    .from(eventAttendance)
    .where(
      and(
        eq(eventAttendance.eventId, canonicalEventId),
        ne(eventAttendance.status, "cancelled"),
      ),
    );

  return {
    userIds: uniqueUserIds(attendees.map((row: { userId: string }) => row.userId)),
    source: "event_attendance",
    tableScoped: false,
  };
}

function uniqueUserIds(ids: Array<string | null | undefined>): string[] {
  const seen = new Set<string>();
  for (const id of ids) {
    if (typeof id === "string" && id.length > 0) seen.add(id);
  }
  return [...seen];
}

/**
 * Peers that are NOT on the roster. Pure + exported so the write-path gate is
 * testable without a database, and so both routes share one definition of
 * "tablemate".
 */
export function findInvalidTablemates(
  peerIds: readonly string[],
  roster: Pick<EventTableRoster, "userIds">,
): string[] {
  const allowed = new Set(roster.userIds);
  return peerIds.filter((peerId) => !allowed.has(peerId));
}

/**
 * Convenience gate for the two write paths. Returns the rejected peers (empty
 * array = valid) and logs a counts-only warn — never the peer ids, never a name.
 */
export async function validateTablemateSelection(params: {
  canonicalEventId: string;
  viewerId: string;
  peerIds: readonly string[];
  /** Route name for the log line (no user text). */
  route: string;
  executor?: RosterExecutor;
}): Promise<{ invalidPeerIds: string[]; roster: EventTableRoster }> {
  const roster = await getEventTableRoster(params.canonicalEventId, params.viewerId, {
    executor: params.executor,
  });
  const invalidPeerIds = findInvalidTablemates(params.peerIds, roster);
  if (invalidPeerIds.length > 0) {
    logger.warn("[Connections] Rejected selection of non-tablemates", {
      route: params.route,
      eventId: params.canonicalEventId,
      viewerId: params.viewerId,
      selected_count: params.peerIds.length,
      invalid_count: invalidPeerIds.length,
      roster_source: roster.source,
      roster_table_scoped: roster.tableScoped,
      roster_size: roster.userIds.length,
    });
  }
  return { invalidPeerIds, roster };
}
