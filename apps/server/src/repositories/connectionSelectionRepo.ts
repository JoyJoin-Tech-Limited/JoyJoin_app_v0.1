/**
 * Connection selection repository (G0, 2026-11-10 — 24h 互选闭环).
 *
 * Owns every write path for `connections` under the reveal-gated mutual
 * selection model, plus the own-selection aggregate the Connections shell
 * needs. `legacyStorageRepo.upsertConnection` delegates here so there is
 * exactly one implementation of "record that A selected B".
 *
 * State machine (plan §3.4):
 *
 *   pending        one side selected
 *     ├─ second side selects, flag OFF → mutual        (legacy, immediate)
 *     ├─ second side selects, flag ON  → mutual_pending (revealAt = window)
 *     └─ selection withdrawn before reveal → row deleted (or downgraded)
 *   mutual_pending both sides selected, no WeChat snapshot, no revealedAt
 *     ├─ reveal sweep at revealAt → mutual (snapshot both WeChat IDs)
 *     └─ one side withdraws → pending (only the remaining side's selection)
 *   mutual         revealed; identity + WeChat snapshot are already delivered
 *
 * Privacy invariant (plan §3.3): no read path here returns a peer identity for
 * a row that has not been revealed. `getOwnPendingReveal` deliberately returns
 * only the caller's OWN selection count + reveal instant.
 */

import { and, eq, gt, inArray, isNotNull, or, sql } from "drizzle-orm";
import { db } from "../db";
import { connectionSelectionWindows, connections, events, users } from "@shared/schema";
import { logger } from "../lib/logger";
import {
  computeConnectionSelectionWindow,
  connectionSelectionStateAt,
  type ConnectionSelectionWindow,
} from "../lib/connectionSelectionWindow";

/**
 * Drizzle's pooled client and its transaction handle are structurally
 * compatible for the four verbs used here, but their generic
 * parameterisation differs. Other transactional repositories in this
 * workspace annotate `tx` loosely for the same reason.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SelectionExecutor = any;

export type ConnectionRow = typeof connections.$inferSelect;

export type ConnectionTransition = "mutual" | "mutual_pending" | null;

export interface ApplyConnectionSelectionParams {
  /** Canonical `events.id` — callers must resolve it via canonicalEventIdGuard. */
  eventId: string;
  /** The user performing the selection. */
  callerId: string;
  /** The user being selected. */
  peerId: string;
  /**
   * When true the second side stops at `mutual_pending` and waits for the
   * table reveal. When false the legacy immediate `mutual` flip runs
   * byte-identically (snapshot + revealedAt).
   */
  mutualSelectionV2Enabled: boolean;
  /** Table-wide reveal instant (V2 only). Null/absent ⇒ the row stays pending. */
  revealAt?: Date | null;
}

export interface ApplyConnectionSelectionResult {
  row: ConnectionRow;
  transition: ConnectionTransition;
}

function orderPair(callerId: string, peerId: string): [string, string] {
  return callerId < peerId ? [callerId, peerId] : [peerId, callerId];
}

/**
 * Record that `callerId` selected `peerId` for one canonical event.
 *
 * Idempotent: a repeat submission by the same initiator is a no-op, and a row
 * already in `mutual` / `mutual_pending` is returned untouched.
 *
 * Flag OFF is the pre-2026-11-10 behaviour, unchanged: the second side flips
 * the row straight to `mutual`, snapshots both WeChat contact IDs and stamps
 * `revealedAt`.
 *
 * Flag ON never snapshots WeChat IDs and never sets `revealedAt` — identity is
 * released only by `finalizeConnectionReveals` at the window's reveal instant.
 */
export async function applyConnectionSelection(
  executor: SelectionExecutor,
  params: ApplyConnectionSelectionParams,
): Promise<ApplyConnectionSelectionResult> {
  const { eventId, callerId, peerId, mutualSelectionV2Enabled, revealAt } = params;
  const [canonA, canonB] = orderPair(callerId, peerId);

  // Atomic insert — if a concurrent request beat us, ON CONFLICT DO NOTHING
  // keeps the original row intact. Under V2 the window's reveal instant is
  // stamped here too, so the caller's own "待揭晓" countdown exists before a
  // second side ever arrives.
  await executor
    .insert(connections)
    .values({
      eventId,
      userAId: canonA,
      userBId: canonB,
      status: "pending",
      initiatorId: callerId,
      ...(mutualSelectionV2Enabled ? { revealAt: revealAt ?? null } : {}),
    })
    .onConflictDoNothing();

  // Re-fetch the authoritative row (whether we just inserted or it existed).
  const [row] = await executor
    .select()
    .from(connections)
    .where(
      and(
        eq(connections.eventId, eventId),
        eq(connections.userAId, canonA),
        eq(connections.userBId, canonB),
      ),
    );

  if (!row) {
    // Should never happen after the atomic insert above, but fail fast if it does.
    throw new Error(
      `[Connections] Row not found after insert for event=${eventId} userA=${canonA} userB=${canonB}`,
    );
  }

  // Already revealed, already waiting for reveal, or this is the initiator
  // re-submitting — nothing to transition.
  const isSecondSide = row.initiatorId !== callerId;
  if (row.status !== "pending" || !isSecondSide) {
    return { row, transition: null };
  }

  if (!mutualSelectionV2Enabled) {
    // ── Legacy path — unchanged from the pre-V2 implementation ──────────────
    // Fetch both users' wechat IDs in parallel for the snapshot.
    const [userARows, userBRows] = await Promise.all([
      executor
        .select({ wechatContactId: users.wechatContactId })
        .from(users)
        .where(eq(users.id, canonA)),
      executor
        .select({ wechatContactId: users.wechatContactId })
        .from(users)
        .where(eq(users.id, canonB)),
    ]);
    const [userARecord] = userARows;
    const [userBRecord] = userBRows;

    const [updated] = await executor
      .update(connections)
      .set({
        status: "mutual",
        userAWechatId: userARecord?.wechatContactId ?? null,
        userBWechatId: userBRecord?.wechatContactId ?? null,
        revealedAt: new Date(),
      })
      .where(and(eq(connections.id, row.id), eq(connections.status, "pending")))
      .returning();

    // If the WHERE condition didn't match (a concurrent update already flipped
    // it), re-return the row we fetched.
    return { row: updated ?? row, transition: updated ? "mutual" : null };
  }

  // ── V2 path — both sides selected; wait for the table reveal ──────────────
  if (!revealAt) {
    // Fail closed: without a reveal instant we must never fall back to an
    // immediate mutual (that would release an identity early). Keep the row
    // pending; the caller's selection is preserved.
    logger.warn("[Connections] V2 mutual selection without a reveal instant — left pending", {
      eventId,
      connectionId: row.id,
    });
    return { row, transition: null };
  }

  const [pending] = await executor
    .update(connections)
    .set({ status: "mutual_pending", revealAt })
    .where(and(eq(connections.id, row.id), eq(connections.status, "pending")))
    .returning();

  return { row: pending ?? row, transition: pending ? "mutual_pending" : null };
}

export interface ReplaceConnectionSelectionParams {
  eventId: string;
  callerId: string;
  /** Distinct peer ids, already validated (0–5, no self, no duplicates). */
  peerIds: string[];
  revealAt: Date;
}

export interface ReplaceConnectionSelectionResult {
  selectedCount: number;
  /** Rows dropped because the caller withdrew their own selection. */
  withdrawn: number;
  /** Withdrawn selections that had already been revealed — kept, never revoked. */
  declinedRevealed: number;
}

export type SelectionWithdrawalDecision =
  | "keep"
  | "protected"
  | "downgrade"
  | "delete"
  | "ignore";

/**
 * What a full-replace should do with one existing row whose peer is no longer
 * in the caller's selection. Pure (exported for tests) — the SQL effects live
 * in `replaceConnectionSelection`.
 *
 *   keep      — the peer is still selected; nothing to do
 *   protected — already revealed: a delivered connection is never revoked
 *   downgrade — both had selected; only the peer's side remains afterwards
 *   delete    — the caller's own one-sided claim
 *   ignore    — the peer's one-sided claim, which the caller must neither see
 *               nor cancel
 */
export function decideSelectionWithdrawal(params: {
  keepSelected: boolean;
  rowStatus: string;
  rowInitiatorId: string;
  callerId: string;
}): SelectionWithdrawalDecision {
  if (params.keepSelected) return "keep";
  if (params.rowStatus === "mutual") return "protected";
  if (params.rowStatus === "mutual_pending") return "downgrade";
  if (params.rowStatus === "pending" && params.rowInitiatorId === params.callerId) {
    return "delete";
  }
  return "ignore";
}

/**
 * Full replace of ONE caller's selection for ONE event (idempotent).
 *
 * Peer-side rows are never touched beyond withdrawing the caller's own claim:
 *   - `mutual`         → kept (a delivered connection is never revoked)
 *   - `mutual_pending` → downgraded to `pending` with the peer as initiator,
 *                        because after the withdrawal only the peer's side
 *                        remains. Without this a withdrawn selection would
 *                        still reveal the peer's WeChat at revealAt.
 *   - `pending`        → deleted only when the caller was the initiator; a row
 *                        initiated by the peer is their selection, not ours.
 *                        It is also invisible to the caller (privacy).
 */
export async function replaceConnectionSelection(
  params: ReplaceConnectionSelectionParams,
): Promise<ReplaceConnectionSelectionResult> {
  const { eventId, callerId, peerIds, revealAt } = params;

  return db.transaction(async (tx: SelectionExecutor) => {
    const keep = new Set(peerIds);
    const existing: ConnectionRow[] = await tx
      .select()
      .from(connections)
      .where(
        and(
          eq(connections.eventId, eventId),
          or(eq(connections.userAId, callerId), eq(connections.userBId, callerId)),
        ),
      );

    let withdrawn = 0;
    let declinedRevealed = 0;

    for (const row of existing) {
      const peerId = row.userAId === callerId ? row.userBId : row.userAId;
      const decision = decideSelectionWithdrawal({
        keepSelected: keep.has(peerId),
        rowStatus: row.status,
        rowInitiatorId: row.initiatorId,
        callerId,
      });

      if (decision === "protected") {
        declinedRevealed += 1;
        continue;
      }

      if (decision === "downgrade") {
        const [downgraded] = await tx
          .update(connections)
          .set({ status: "pending", initiatorId: peerId, revealAt: null })
          .where(and(eq(connections.id, row.id), eq(connections.status, "mutual_pending")))
          .returning();
        if (downgraded) withdrawn += 1;
        continue;
      }

      if (decision === "delete") {
        const [deleted] = await tx
          .delete(connections)
          .where(
            and(
              eq(connections.id, row.id),
              eq(connections.status, "pending"),
              eq(connections.initiatorId, callerId),
            ),
          )
          .returning();
        if (deleted) withdrawn += 1;
      }
    }

    for (const peerId of peerIds) {
      await applyConnectionSelection(tx, {
        eventId,
        callerId,
        peerId,
        mutualSelectionV2Enabled: true,
        revealAt,
      });
    }

    return { selectedCount: peerIds.length, withdrawn, declinedRevealed };
  });
}

export interface RevealedConnectionSummary {
  id: string;
  eventId: string;
  userAId: string;
  userBId: string;
}

export interface RevealSweepResult {
  revealed: number;
  connections: RevealedConnectionSummary[];
}

/**
 * Flip every due `mutual_pending` row to `mutual`, snapshotting both WeChat
 * contact IDs in the same statement.
 *
 * One set-based UPDATE for the whole sweep:
 *   - the `status = 'mutual_pending'` predicate is the idempotency guard — a
 *     duplicate or concurrent sweep re-evaluates the predicate against the
 *     row's committed version and finds nothing to do, so a pair can never be
 *     revealed twice and can never be re-snapshotted with a later WeChat ID;
 *   - `revealed_at IS NULL` is a belt-and-braces guard for rows left behind by
 *     a half-applied manual fix;
 *   - scalar subqueries keep the snapshot atomic without a second round-trip
 *     and still flip the row when a user record has been deleted (NULL
 *     snapshot instead of a skipped row).
 *
 * The executor is injectable so the sweep can be tested without a database.
 */
export async function finalizeConnectionReveals(
  options: {
    now?: Date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executor?: { execute: (statement: any) => Promise<{ rows: any[] }> };
  } = {},
): Promise<RevealSweepResult> {
  const now = options.now ?? new Date();
  const executor = options.executor ?? db;

  const result = await executor.execute(sql`
    UPDATE connections
    SET
      status = 'mutual',
      user_a_wechat_id = (SELECT wechat_contact_id FROM users WHERE id = connections.user_a_id),
      user_b_wechat_id = (SELECT wechat_contact_id FROM users WHERE id = connections.user_b_id),
      revealed_at = ${now}
    WHERE status = 'mutual_pending'
      AND revealed_at IS NULL
      AND reveal_at IS NOT NULL
      AND reveal_at <= ${now}
    RETURNING id, event_id, user_a_id, user_b_id
  `);

  const rows = (result?.rows ?? []) as Array<{
    id: string;
    event_id: string;
    user_a_id: string;
    user_b_id: string;
  }>;

  return {
    revealed: rows.length,
    connections: rows.map((row) => ({
      id: row.id,
      eventId: row.event_id,
      userAId: row.user_a_id,
      userBId: row.user_b_id,
    })),
  };
}

/** How long a non-mutual selection row is kept after its reveal window closed. */
export const CONNECTION_SELECTION_RETENTION_DAYS = 30;

/** Per-sweep delete bound — keeps the tick cheap and the lock short. */
export const CONNECTION_SELECTION_CLEANUP_BATCH_LIMIT = 500;
const MAX_CLEANUP_BATCH = 5_000;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

export interface ConnectionSelectionCleanupResult {
  deleted: number;
  /** The cutoff actually applied (`now - 30 days`). */
  cutoff: Date;
}

/**
 * Hard-delete non-mutual selection rows whose reveal window closed more than
 * 30 days ago.
 *
 * Why hard delete: this is the stronger privacy statement in the plan (§3.3).
 * A row that never became `mutual` is a one-sided (or never-revealed) claim;
 * keeping it forever — even soft-deleted — preserves a "who picked whom" graph
 * that the product promised to discard. Once the reveal window is 30 days old
 * the row has no user-visible meaning, so it is erased.
 *
 * Invariants:
 *   - `mutual` rows are NEVER deleted: that pair was delivered, both sides keep
 *     the connection (and the WeChat snapshot) indefinitely;
 *   - only rows with a real reveal instant qualify, so every legacy flag-off
 *     `pending` row (`reveal_at IS NULL`) is untouched;
 *   - idempotent + bounded: one DELETE with a `LIMIT`ed id subquery, so a
 *     duplicate or overlapping sweep simply finds fewer/no rows. The batch cap
 *     keeps the statement short (no long table lock, no memory spike) and the
 *     scheduler drains the backlog over successive ticks.
 *
 * The executor is injectable so the statement can be asserted without a DB.
 */
export async function purgeClosedConnectionSelections(
  options: {
    now?: Date;
    limit?: number;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executor?: { execute: (statement: any) => Promise<{ rows?: any[] } | undefined> };
  } = {},
): Promise<ConnectionSelectionCleanupResult> {
  const now = options.now ?? new Date();
  const cutoff = new Date(now.getTime() - CONNECTION_SELECTION_RETENTION_DAYS * MS_PER_DAY);
  const limit = Math.max(
    1,
    Math.min(options.limit ?? CONNECTION_SELECTION_CLEANUP_BATCH_LIMIT, MAX_CLEANUP_BATCH),
  );
  const executor = options.executor ?? db;

  const result = await executor.execute(sql`
    DELETE FROM connections
    WHERE id IN (
      SELECT id FROM connections
      WHERE status <> 'mutual'
        AND reveal_at IS NOT NULL
        AND reveal_at <= ${cutoff}
      ORDER BY reveal_at ASC
      LIMIT ${limit}
    )
    RETURNING id
  `);

  const rows = (result?.rows ?? []) as Array<{ id: string }>;
  if (rows.length > 0) {
    // Counts only — a purged pair must not survive in the log.
    logger.info("[Connections] Purged expired non-mutual selection rows", {
      deleted: rows.length,
      cutoff: cutoff.toISOString(),
      batch_limit: limit,
    });
  }

  return { deleted: rows.length, cutoff };
}

export interface OwnPendingReveal {
  count: number;
  revealAt: Date | null;
}

/**
 * The caller's OWN selection state awaiting reveal — never a peer's.
 *
 * Counts rows the caller selected (they initiated, or both sides selected) in
 * statuses `pending` / `mutual_pending` whose reveal instant is still in the
 * future. Rows the peer initiated are excluded entirely: their very existence
 * must not be observable before reveal (plan §3.3). Expired rows drop out
 * automatically, so the card cannot linger after the window.
 */
export async function getOwnPendingReveal(
  userId: string,
  now: Date = new Date(),
): Promise<OwnPendingReveal | null> {
  const [row] = await db
    .select({
      count: sql<number>`count(*)::int`,
      revealAt: sql<Date | null>`min(${connections.revealAt})`,
    })
    .from(connections)
    .where(
      and(
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        inArray(connections.status, ["pending", "mutual_pending"]),
        or(
          eq(connections.initiatorId, userId),
          eq(connections.status, "mutual_pending"),
        ),
        isNotNull(connections.revealAt),
        gt(connections.revealAt, now),
      ),
    );

  const count = Number(row?.count ?? 0);
  if (count <= 0) return null;

  const revealAt = row?.revealAt ? new Date(row.revealAt) : null;
  return { count, revealAt };
}

/**
 * How many distinct peers the caller selected for one event — the "已选 N/5"
 * readout. The caller's own data only; peer-initiated rows never count.
 * A `mutual` row implies both sides selected, so it counts too.
 */
export async function countOwnSelections(
  eventId: string,
  userId: string,
): Promise<number> {
  const [row] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(connections)
    .where(
      and(
        eq(connections.eventId, eventId),
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        or(
          eq(connections.initiatorId, userId),
          inArray(connections.status, ["mutual", "mutual_pending"]),
        ),
      ),
    );

  return Number(row?.count ?? 0);
}

/**
 * Peer ids the caller has already selected for one event. Used to union a new
 * payload with persisted selections before enforcing the cap: a PUT followed
 * by a feedback POST may legitimately repeat the same peers, and summing row
 * counts would falsely reject the request.
 */
export async function getOwnSelectedPeerIds(
  eventId: string,
  userId: string,
): Promise<string[]> {
  const rows = await db
    .select({
      userAId: connections.userAId,
      userBId: connections.userBId,
    })
    .from(connections)
    .where(
      and(
        eq(connections.eventId, eventId),
        or(eq(connections.userAId, userId), eq(connections.userBId, userId)),
        or(
          eq(connections.initiatorId, userId),
          inArray(connections.status, ["mutual", "mutual_pending"]),
        ),
      ),
    );

  return rows.map((row: { userAId: string; userBId: string }) =>
    row.userAId === userId ? row.userBId : row.userAId,
  );
}

export type ConnectionSelectionWindowSource = "override" | "derived";

/**
 * Shape guard for an ops-override row. Every instant must be a real `Date`
 * (Drizzle returns `Date` for `timestamptz`; anything else means a malformed
 * or partially-written row). Keeping this a type guard lets the caller fall
 * back to the derived window instead of throwing.
 */
function isValidWindowRow(row: {
  opensAt: unknown;
  closesAt: unknown;
  revealAt: unknown;
}): row is { opensAt: Date; closesAt: Date; revealAt: Date } {
  return (
    row.opensAt instanceof Date &&
    Number.isFinite(row.opensAt.getTime()) &&
    row.closesAt instanceof Date &&
    Number.isFinite(row.closesAt.getTime()) &&
    row.revealAt instanceof Date &&
    Number.isFinite(row.revealAt.getTime())
  );
}
export interface ResolvedConnectionSelectionWindow {
  window: ConnectionSelectionWindow;
  /**
   * `override` — an ops row in `connection_selection_windows` supplies the
   * instants. `derived` — no row exists, so the plan's anchors are used.
   * Read-only: this never persists a derived window (a lazy write would race
   * two concurrent readers and turn a pure derivation into row churn).
   */
  source: ConnectionSelectionWindowSource;
}

/**
 * Resolve the effective window for one canonical event.
 *
 * Returns `null` when the event is unknown or its `date_time` is missing /
 * unparseable and no override row exists — callers must surface a coded error
 * rather than invent a window (plan §3.2).
 */
export async function getConnectionSelectionWindow(
  eventId: string,
  now: Date = new Date(),
): Promise<ResolvedConnectionSelectionWindow | null> {
  const [override] = await db
    .select({
      opensAt: connectionSelectionWindows.opensAt,
      closesAt: connectionSelectionWindows.closesAt,
      revealAt: connectionSelectionWindows.revealAt,
    })
    .from(connectionSelectionWindows)
    .where(eq(connectionSelectionWindows.eventId, eventId))
    .limit(1);

  if (override) {
    // Guard the shape, not just existence: a partial/malformed row must fall
    // back to the derived window instead of throwing on the feedback path.
    if (isValidWindowRow(override)) {
      return {
        source: "override",
        window: {
          opensAt: override.opensAt,
          closesAt: override.closesAt,
          revealAt: override.revealAt,
          state: connectionSelectionStateAt(override.opensAt, override.closesAt, now),
        },
      };
    }
    logger.warn("[Connections] ignoring malformed connection_selection_windows row", { eventId });
  }

  const [event] = await db
    .select({ dateTime: events.dateTime })
    .from(events)
    .where(eq(events.id, eventId))
    .limit(1);

  const window = computeConnectionSelectionWindow(event?.dateTime ?? null, now);
  if (!window) return null;

  return { source: "derived", window };
}

/**
 * Privacy projection for the Connections shell (G0, 2026-11-10).
 *
 * Flag ON  — the peer-facing pending-request list is dropped entirely (its
 *            length alone reveals how many people picked the viewer) and
 *            replaced by the caller's OWN `{ count, revealAt }`.
 * Flag OFF — the legacy list is returned untouched and `pendingReveal` is
 *            null, so the payload is byte-identical to pre-V2.
 *
 * Pure + exported so the privacy rule is testable without a database.
 */
export function projectConnectionPrivacy(params: {
  mutualSelectionV2Enabled: boolean;
  pendingRequests: unknown[];
  ownPendingReveal: OwnPendingReveal | null;
}): {
  pendingRequests: unknown[];
  pendingReveal: { count: number; revealAt: string | null } | null;
} {
  if (!params.mutualSelectionV2Enabled) {
    return { pendingRequests: params.pendingRequests, pendingReveal: null };
  }

  return {
    pendingRequests: [],
    pendingReveal: {
      count: params.ownPendingReveal?.count ?? 0,
      revealAt: params.ownPendingReveal?.revealAt
        ? params.ownPendingReveal.revealAt.toISOString()
        : null,
    },
  };
}
