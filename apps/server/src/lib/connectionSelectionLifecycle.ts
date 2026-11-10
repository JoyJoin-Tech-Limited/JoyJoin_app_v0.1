/**
 * Connection-selection lifecycle invalidation (G0 P0 hardening, 2026-11-10).
 *
 * The 24h 互选 window (`lib/connectionSelectionWindow.ts`) is derived from the
 * event start, so it knows nothing about the many ways an event can stop being
 * a real event:
 *
 *   - the admin cancels the whole pool      (`PATCH /api/admin/event-pools/:id`)
 *   - the auto-refund pipeline refunds      (`services/autoRefundService.ts`)
 *   - a matched member cancels their seat   (`lib/poolRegistrationCancel.ts`)
 *   - a member is marked absent / no-show   (`event_attendance.attendance_status`)
 *   - a group collapses below the minimum   (`REFUND_CONTEXTS.collapsed`)
 *
 * Without this module every one of those leaves a live selection window and a
 * pile of `pending` / `mutual_pending` rows behind, which the reveal sweep at
 * `revealAt` would happily turn into a `mutual` connection to someone who never
 * sat at the table.
 *
 * Two-layer defence (deliberate, see the sprint contract):
 *
 *   1. THIS module — closes the window and voids the non-mutual rows at the
 *      moment the event stops being real. Best-effort: every call site wraps it
 *      in try/catch, because a cleanup failure must never roll back a refund or
 *      a cancellation.
 *   2. The reveal predicate in `repositories/connectionSelectionRepo.ts` — the
 *      fail-closed layer. Even if every hook below silently failed, a pair is
 *      only revealed when BOTH sides still hold an eligible seat.
 *
 * Invariants:
 *   - `mutual` rows are NEVER touched. A delivered connection (identity +
 *     WeChat snapshot already released) cannot be revoked by an ops action.
 *   - Idempotent. The window write is monotone (each instant can only move
 *     EARLIER), and the delete is status-scoped, so a re-run is a no-op.
 *   - Counts only in logs. No user id, no pair, no name.
 *
 * Known gap (documented, not silently skipped):
 *   - `lib/poolRegistrationCancel.ts`'s LEGACY branch (both Phase 0 flags OFF)
 *     is contractually byte-identical to the pre-Phase-0 handler (sprint
 *     contract AC-4), so it does not write `event_attendance.status`. A legacy
 *     cancel that happens AFTER the 互选 window opens therefore leaves the
 *     exiter's attendance row untouched. Two things bound the exposure: a
 *     pool-derived event's registration row IS deleted (so the reveal predicate
 *     already rejects the pair), and the standalone-legacy case only exists for
 *     events with no pool group. Closing it needs either the Phase 0 flags on or
 *     a deliberate AC-4 amendment — not a silent extra write here.
 */

import { and, eq, inArray, or, sql } from "drizzle-orm";

import { db } from "../db";
import { connectionSelectionWindows, connections, eventPoolGroups } from "@shared/schema";
import { logger } from "./logger";

/**
 * Why the selection round is being invalidated. The reason selects the default
 * posture (close the window vs. only void the affected users) and is carried in
 * the log line so ops can attribute a mass void to a real cause.
 */
export type ConnectionSelectionInvalidationReason =
  | "pool_cancelled"
  | "event_cancelled"
  | "group_collapsed"
  | "seat_cancelled"
  | "seat_not_allocated"
  | "no_show";

/**
 * Event-level reasons kill the whole table's selection round, so the window is
 * closed immediately. User-level reasons only remove that one person from the
 * pool of selectable peers; the remaining table keeps selecting.
 */
const CLOSE_WINDOW_BY_REASON: Record<ConnectionSelectionInvalidationReason, boolean> = {
  pool_cancelled: true,
  event_cancelled: true,
  group_collapsed: true,
  seat_cancelled: false,
  seat_not_allocated: false,
  no_show: false,
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type InvalidationExecutor = any;

export interface InvalidateConnectionSelectionsParams {
  /**
   * Canonical `events.id` (the FK target of `connections.event_id`). Pass this
   * when the caller already holds it (attendance / group paths).
   */
  canonicalEventId?: string | null;
  /**
   * `event_pools.id`. Every per-group `events` row of the pool is invalidated.
   * Pass this when the caller only holds the pool (admin cancel, refunds).
   */
  poolId?: string | null;
  /**
   * When set, only rows involving one of these users are voided. Used by the
   * per-seat reasons; omit for event-level reasons (a cancelled event voids
   * every non-mutual row on every one of its tables).
   */
  voidedUserIds?: readonly string[];
  reason: ConnectionSelectionInvalidationReason;
  /** Override the reason-derived posture. `true` closes the window. */
  closeWindow?: boolean;
  /** Injectable clock so tests are deterministic. */
  now?: Date;
  /** Injectable db handle (a transaction handle works too). */
  executor?: InvalidationExecutor;
}

export interface InvalidateConnectionSelectionsResult {
  /** Every canonical `events.id` that was actually touched. */
  eventIds: string[];
  /** Overridden windows written/advanced (idempotent replays count too). */
  windowsClosed: number;
  /** Non-mutual selection rows deleted. */
  voided: number;
  /** True when the caller supplied an id that resolved to no event at all. */
  unresolved: boolean;
}

const EMPTY_RESULT: InvalidateConnectionSelectionsResult = {
  eventIds: [],
  windowsClosed: 0,
  voided: 0,
  unresolved: false,
};

/**
 * Resolve every canonical `events.id` covered by the caller's id(s).
 *
 * `canonicalEventId` is used as-is (it is already the FK target). `poolId` fans
 * out through `event_pool_groups.event_id`, which is exactly the mapping the
 * matching service writes at commit time.
 */
async function resolveInvalidationEventIds(
  executor: InvalidationExecutor,
  params: Pick<InvalidateConnectionSelectionsParams, "canonicalEventId" | "poolId">,
): Promise<string[]> {
  const eventIds = new Set<string>();

  if (params.canonicalEventId) {
    eventIds.add(params.canonicalEventId);
  }

  if (params.poolId) {
    const groups = await executor
      .select({ eventId: eventPoolGroups.eventId })
      .from(eventPoolGroups)
      .where(eq(eventPoolGroups.poolId, params.poolId));
    for (const group of groups as Array<{ eventId: string | null }>) {
      if (group?.eventId) eventIds.add(group.eventId);
    }
  }

  return [...eventIds];
}

/**
 * Close one table's selection window immediately.
 *
 * Expressed as an upsert against `connection_selection_windows` (the ops
 * override table the resolver already reads first) rather than a new column:
 * `getConnectionSelectionWindow()` then reports `state: 'closed'` for the event
 * without any code change, which is what makes PUT /connection-selection and a
 * non-empty POST /feedback start returning 409 SELECTION_WINDOW_CLOSED.
 *
 * Monotone: every instant can only move earlier. An invalidation that runs
 * after a normal reveal therefore cannot reopen or extend anything, which is
 * what makes the call safe to repeat from every hook that observes the same
 * cancellation.
 */
async function closeSelectionWindow(
  executor: InvalidationExecutor,
  eventId: string,
  now: Date,
): Promise<void> {
  await executor
    .insert(connectionSelectionWindows)
    .values({
      eventId,
      opensAt: now,
      closesAt: now,
      revealAt: now,
    })
    .onConflictDoUpdate({
      target: connectionSelectionWindows.eventId,
      set: {
        opensAt: sql`LEAST(${connectionSelectionWindows.opensAt}, ${now})`,
        closesAt: sql`LEAST(${connectionSelectionWindows.closesAt}, ${now})`,
        revealAt: sql`LEAST(${connectionSelectionWindows.revealAt}, ${now})`,
      },
    });
}

/**
 * Void (hard-delete) every non-mutual selection row for the given events.
 *
 * Why delete rather than a new status: a selection that can never be honoured
 * has no user-visible meaning, and the retention sweep
 * (`purgeClosedConnectionSelections`) already treats non-mutual rows as
 * disposable after 30 days. A new `voided` status would keep the "who picked
 * whom" graph alive for 30 extra days, which is the opposite of the privacy
 * posture (plan §3.3).
 *
 * `status = 'mutual'` is excluded in the predicate — a revealed pair is never
 * revoked, even when the event is later cancelled.
 */
async function voidNonMutualSelections(
  executor: InvalidationExecutor,
  eventIds: readonly string[],
  voidedUserIds: readonly string[] | undefined,
): Promise<number> {
  const predicates = [
    inArray(connections.eventId, [...eventIds]),
    inArray(connections.status, ["pending", "mutual_pending"]),
  ];

  if (voidedUserIds && voidedUserIds.length > 0) {
    predicates.push(
      or(
        inArray(connections.userAId, [...voidedUserIds]),
        inArray(connections.userBId, [...voidedUserIds]),
      ) as never,
    );
  }

  const deleted = await executor
    .delete(connections)
    .where(and(...predicates))
    .returning({ id: connections.id, status: connections.status });

  const rows = (Array.isArray(deleted) ? deleted : []) as Array<{ id: string }>;
  return rows.length;
}

/**
 * Invalidate the connection-selection round(s) for one event or one pool.
 *
 * Accepts a transaction handle via `executor` so a cancellation path that
 * already owns a transaction can keep the void inside it. Callers that mutate a
 * different aggregate (refund pipeline, admin PATCH) call it without an
 * executor and tolerate failure: the reveal predicate is the fail-closed layer.
 */
export async function invalidateConnectionSelections(
  params: InvalidateConnectionSelectionsParams,
): Promise<InvalidateConnectionSelectionsResult> {
  const now = params.now ?? new Date();
  const executor: InvalidationExecutor = params.executor ?? db;
  const closeWindow = params.closeWindow ?? CLOSE_WINDOW_BY_REASON[params.reason];

  const requested = Boolean(params.canonicalEventId) || Boolean(params.poolId);
  const eventIds = await resolveInvalidationEventIds(executor, params);

  if (eventIds.length === 0) {
    if (requested) {
      // A pool with no committed group has no `events` row, so there is nothing
      // a selection could be attached to. Not an error — log at debug volume so
      // a genuinely broken mapping is still distinguishable from this case.
      logger.info("[Connections] selection invalidation found no event to touch", {
        reason: params.reason,
        hasPoolId: Boolean(params.poolId),
        hasCanonicalEventId: Boolean(params.canonicalEventId),
      });
      return { ...EMPTY_RESULT, unresolved: true };
    }
    return EMPTY_RESULT;
  }

  let windowsClosed = 0;
  if (closeWindow) {
    for (const eventId of eventIds) {
      await closeSelectionWindow(executor, eventId, now);
      windowsClosed += 1;
    }
  }

  const voided = await voidNonMutualSelections(executor, eventIds, params.voidedUserIds);

  // Counts only — never a user id, never a pair.
  logger.info("[Connections] selection round invalidated", {
    reason: params.reason,
    events: eventIds.length,
    windows_closed: windowsClosed,
    voided,
    scoped_users: params.voidedUserIds?.length ?? 0,
  });

  return { eventIds, windowsClosed, voided, unresolved: false };
}

/**
 * No-show hook (P0 hardening, 2026-11-10).
 *
 * The attendance routes are keyed by `blind_box_events.id`, not by the canonical
 * `events.id` the `connections` table FKs to, so this wrapper resolves the id
 * first and logs the exact missing hook when it cannot:
 *
 *   `no_show` → the user is not sitting at the table, so no selection involving
 *   them may survive to the reveal. The window stays open for the rest of the
 *   table (one person's absence does not cancel the round).
 *
 * Returns `null` when the id resolved to no event — the caller should treat that
 * as "nothing to void here", never as success. The reveal eligibility predicate
 * (which reads `event_attendance.attendance_status = 'absent'` directly) remains
 * the fail-closed layer, so even an unresolved id cannot leak a connection.
 */
export async function voidNoShowConnectionSelections(params: {
  blindBoxEventId: string;
  userIds: readonly string[];
  /** Route/log prefix, e.g. "[AttendanceStatus]". */
  logPrefix: string;
  now?: Date;
  executor?: InvalidationExecutor;
}): Promise<InvalidateConnectionSelectionsResult | null> {
  if (params.userIds.length === 0) return null;

  const { resolveCanonicalEventId } = await import("./resolveCanonicalEventId");
  const canonicalEventId = await resolveCanonicalEventId(
    params.blindBoxEventId,
    params.userIds[0],
  );

  if (!canonicalEventId) {
    logger.warn(`${params.logPrefix} no-show had no canonical event — connection selection not voided`, {
      blindBoxEventId: params.blindBoxEventId,
      impacted_users: params.userIds.length,
    });
    return null;
  }

  const result = await voidConnectionSelectionsForUsers({
    canonicalEventId,
    userIds: params.userIds,
    reason: "no_show",
    now: params.now,
    executor: params.executor,
  });

  if (result === null) {
    logger.warn(`${params.logPrefix} no-show void found no selection rows`, {
      blindBoxEventId: params.blindBoxEventId,
      canonicalEventId,
      impacted_users: params.userIds.length,
    });
  }

  return result;
}

/**
 * Per-seat convenience wrapper for the cancellation / no-show hooks. Equivalent
 * to `invalidateConnectionSelections` with `voidedUserIds` set and the window
 * left open, but reads better at the call site and makes the "expire, do not
 * notify" intent explicit.
 *
 * Returns `null` when there was nothing to attach to (no event resolved), so a
 * caller can log the exact missing hook instead of pretending it worked.
 */
export async function voidConnectionSelectionsForUsers(params: {
  canonicalEventId?: string | null;
  poolId?: string | null;
  userIds: readonly string[];
  reason: Extract<
    ConnectionSelectionInvalidationReason,
    "seat_cancelled" | "seat_not_allocated" | "no_show"
  >;
  now?: Date;
  executor?: InvalidationExecutor;
}): Promise<InvalidateConnectionSelectionsResult | null> {
  if (params.userIds.length === 0) return null;

  const result = await invalidateConnectionSelections({
    canonicalEventId: params.canonicalEventId,
    poolId: params.poolId,
    voidedUserIds: params.userIds,
    reason: params.reason,
    closeWindow: false,
    now: params.now,
    executor: params.executor,
  });

  return result.unresolved || result.eventIds.length === 0 ? null : result;
}
