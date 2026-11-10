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
 * `EventTableRoster.tableScoped` exposes that honestly.
 *
 * P0 hardening (2026-11-10) — multi-table fail-closed: the honest answer is no
 * longer good enough when the event really does have several tables. If the
 * viewer's own group cannot be resolved (no registration → group link, a stale
 * `assigned_group_id`, a group without an `event_id`) AND the event has more
 * than one `event_pool_groups` row, the roster returns EMPTY with
 * `scope: 'multi_table_unresolved'`. `findInvalidTablemates()` then rejects
 * every peer, so a same-event stranger at another table can never be selected.
 * Single-table events keep the same-event fallback (there is no other table to
 * confuse them with).
 *
 * Closing the remaining gap fully needs (a) a `table_id`/`group_id` column on
 * `event_attendance`, or (b) always routing selection through the pool-group
 * path.
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

/**
 * How much the roster actually proves:
 *   table                  — one resolved `event_pool_groups` row (strongest)
 *   event                  — same-event attendance fallback on a single-table
 *                            event (no other table to confuse)
 *   multi_table_unresolved — the event has >1 table and the viewer's group is
 *                            unknown → empty roster, every peer rejected
 */
export type EventTableRosterScope = "table" | "event" | "multi_table_unresolved";

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
  /** Explicit scope classification (P0 hardening) — see `EventTableRosterScope`. */
  scope: EventTableRosterScope;
  /** `event_pool_groups` rows covering this event (0 when unknown). */
  tableCount: number;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type RosterExecutor = Pick<typeof db, "select"> | any;

const EMPTY_ROSTER: EventTableRoster = {
  userIds: [],
  source: "event_attendance",
  tableScoped: false,
  scope: "event",
  tableCount: 0,
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
      scope: "table",
      tableCount: 1,
    };
  }

  // ── 2. How many tables does this event cover? ─────────────────────────────
  const tables = await executor
    .select({ id: eventPoolGroups.id })
    .from(eventPoolGroups)
    .where(eq(eventPoolGroups.eventId, canonicalEventId));
  const tableCount = Array.isArray(tables) ? tables.length : 0;

  if (tableCount > 1) {
    // The event is a multi-table night and we cannot prove which table the
    // viewer sat at. Fail CLOSED: an empty roster makes the caller reject every
    // peer (coded INVALID_TABLEMATE_SELECTION) instead of allowing a
    // cross-table selection that the reveal would later honour.
    logger.warn("[Connections] multi-table event with unresolved viewer table — rejecting roster", {
      eventId: canonicalEventId,
      viewerId,
      table_count: tableCount,
    });
    return {
      userIds: [],
      source: "event_attendance",
      tableScoped: false,
      scope: "multi_table_unresolved",
      tableCount,
    };
  }

  // ── 3. Attendance fallback (single table — same event == same table) ───────
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
    scope: "event",
    tableCount,
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
 *
 * `reason` distinguishes the two rejection causes so a route can keep the same
 * client-facing code (`INVALID_TABLEMATE_SELECTION`) while ops can tell an
 * ordinary out-of-table payload from the fail-closed multi-table case:
 *   not_tablemate          — the peer is not on the resolved roster
 *   multi_table_unresolved — the roster could not be scoped at all (fail closed)
 */
export type TablemateSelectionRejectionReason =
  | "none"
  | "not_tablemate"
  | "multi_table_unresolved";

export async function validateTablemateSelection(params: {
  canonicalEventId: string;
  viewerId: string;
  peerIds: readonly string[];
  /** Route name for the log line (no user text). */
  route: string;
  executor?: RosterExecutor;
}): Promise<{
  invalidPeerIds: string[];
  roster: EventTableRoster;
  reason: TablemateSelectionRejectionReason;
}> {
  const roster = await getEventTableRoster(params.canonicalEventId, params.viewerId, {
    executor: params.executor,
  });
  const invalidPeerIds = findInvalidTablemates(params.peerIds, roster);
  const reason: TablemateSelectionRejectionReason =
    invalidPeerIds.length === 0
      ? "none"
      : roster.scope === "multi_table_unresolved"
        ? "multi_table_unresolved"
        : "not_tablemate";

  if (invalidPeerIds.length > 0) {
    logger.warn("[Connections] Rejected selection of non-tablemates", {
      route: params.route,
      eventId: params.canonicalEventId,
      viewerId: params.viewerId,
      selected_count: params.peerIds.length,
      invalid_count: invalidPeerIds.length,
      roster_source: roster.source,
      roster_table_scoped: roster.tableScoped,
      roster_scope: roster.scope,
      roster_table_count: roster.tableCount,
      roster_size: roster.userIds.length,
      rejection_reason: reason,
    });
  }
  return { invalidPeerIds, roster, reason };
}
