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
  MAX_CONNECTION_SELECTIONS,
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
 * Raised when the authoritative 0–5 cap would be exceeded at commit time.
 *
 * Distinct from the route-level `TOO_MANY_SELECTIONS` 400 (which is a cheap
 * pre-check): this one means the write raced another write by the same user and
 * lost. Callers may surface the same code — the client copy is identical
 * (`packages/shared/src/copy/errorBaselines.ts`).
 */
export class ConnectionSelectionCapExceededError extends Error {
  readonly code = "TOO_MANY_SELECTIONS" as const;
  readonly maxSelections: number;

  constructor(maxSelections: number = MAX_CONNECTION_SELECTIONS) {
    super(`Connection selection cap of ${maxSelections} exceeded`);
    this.name = "ConnectionSelectionCapExceededError";
    this.maxSelections = maxSelections;
  }
}

/**
 * Transaction-scoped advisory lock keyed by (user, event).
 *
 * Why an advisory lock and not a row lock: the rows this guards are *created*
 * by the write (there is no row to `SELECT … FOR UPDATE` on the first insert),
 * and the invariant spans a set of rows rather than one row. The pair
 * `(callerId, eventId)` is exactly the cap's scope, so two devices submitting
 * for the same user serialize here while different users never contend.
 *
 * `pg_advisory_xact_lock` releases automatically at COMMIT/ROLLBACK, so a
 * thrown cap error cannot leak the lock. It MUST be called inside a
 * transaction — outside one the lock would be released with the implicit
 * single-statement transaction and buy nothing.
 *
 * `hashtextextended` gives a stable 64-bit key from a namespaced string; the
 * namespace prefix keeps these keys disjoint from other advisory users in the
 * process.
 */
export async function lockConnectionSelectionScope(
  executor: SelectionExecutor,
  params: { eventId: string; userId: string },
): Promise<void> {
  const key = `connection_selection:${params.userId}:${params.eventId}`;
  await executor.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${key}, 0))`);
}

/**
 * Peers this user already holds for the event, read through an injectable
 * executor so the cap check can run INSIDE the same transaction (and therefore
 * under the advisory lock) as the write.
 */
async function selectOwnSelectedPeerIds(
  executor: SelectionExecutor,
  eventId: string,
  userId: string,
): Promise<string[]> {
  const rows = await executor
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
 *
 * Concurrency (P0 hardening, 2026-11-10): the whole replace runs under a
 * transaction-scoped advisory lock keyed by (caller, event), so two concurrent
 * PUTs (or a PUT racing a POST /feedback batch) serialize instead of each
 * computing its withdrawal/insert set from the same stale snapshot — the
 * "silently lost last write" failure mode. The cap is re-asserted inside the
 * lock as well; the route-level check stays as cheap feedback.
 */
export async function replaceConnectionSelection(
  params: ReplaceConnectionSelectionParams,
): Promise<ReplaceConnectionSelectionResult> {
  const { eventId, callerId, peerIds, revealAt } = params;

  return db.transaction(async (tx: SelectionExecutor) => {
    await lockConnectionSelectionScope(tx, { eventId, userId: callerId });

    if (peerIds.length > MAX_CONNECTION_SELECTIONS) {
      // The route already rejects this before touching the repo, so reaching
      // here means a concurrent caller or a direct repo caller — fail closed.
      throw new ConnectionSelectionCapExceededError(MAX_CONNECTION_SELECTIONS);
    }

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

export interface ApplyConnectionSelectionsBatchParams {
  /** Canonical `events.id`. */
  eventId: string;
  /** The user submitting the selections. */
  callerId: string;
  /** Distinct peer ids, already normalized (no self, no duplicates). */
  peerIds: readonly string[];
  /** Mirrors the flag read on the route (legacy flips straight to `mutual`). */
  mutualSelectionV2Enabled: boolean;
  /** Table-wide reveal instant (V2 only). */
  revealAt?: Date | null;
}

export interface ApplyConnectionSelectionsBatchResult {
  /** Peers whose row was written (or already existed). */
  acceptedPeerIds: string[];
  /**
   * Peers dropped because the user+event cap would have been exceeded at
   * commit time. Non-empty only on a genuine race — the route's union check
   * already rejected the deterministic case.
   */
  rejectedPeerIds: string[];
  transitions: ConnectionTransition[];
}

/**
 * Authoritative cap-enforcing batch writer for the `POST /feedback` path.
 *
 * The route-level union check (`getOwnSelectedPeerIds` + payload) is a cheap
 * pre-check that can still be beaten by a concurrent request from the same
 * user (two devices, a retry storm, a PUT racing a POST). This function is the
 * authority: it takes the (user, event) advisory lock, re-reads the caller's
 * persisted selections INSIDE the transaction, and accepts peers in payload
 * order only while the union stays ≤ 5.
 *
 * Rejecting instead of throwing keeps the feedback write (which already
 * committed) coherent: the caller's response carries the real, post-write
 * selection summary, so nothing is silently lost from the client's view.
 * The rejection is logged as `selection_cap_race_rejected` for ops.
 */
export async function applyConnectionSelectionsForEvent(
  params: ApplyConnectionSelectionsBatchParams,
): Promise<ApplyConnectionSelectionsBatchResult> {
  const { eventId, callerId, peerIds, mutualSelectionV2Enabled, revealAt } = params;

  return db.transaction(async (tx: SelectionExecutor) => {
    await lockConnectionSelectionScope(tx, { eventId, userId: callerId });

    const held = new Set(await selectOwnSelectedPeerIds(tx, eventId, callerId));
    const acceptedPeerIds: string[] = [];
    const rejectedPeerIds: string[] = [];

    for (const peerId of peerIds) {
      if (!held.has(peerId) && held.size >= MAX_CONNECTION_SELECTIONS) {
        rejectedPeerIds.push(peerId);
        continue;
      }
      held.add(peerId);
      acceptedPeerIds.push(peerId);
    }

    const transitions: ConnectionTransition[] = [];
    for (const peerId of acceptedPeerIds) {
      const result = await applyConnectionSelection(tx, {
        eventId,
        callerId,
        peerId,
        mutualSelectionV2Enabled,
        revealAt: revealAt ?? null,
      });
      transitions.push(result.transition);
    }

    if (rejectedPeerIds.length > 0) {
      // Counts only — the peer ids are never logged.
      logger.warn("[Connections] selection cap race rejected peers", {
        eventId,
        submitted: peerIds.length,
        accepted: acceptedPeerIds.length,
        rejected: rejectedPeerIds.length,
      });
    }

    return { acceptedPeerIds, rejectedPeerIds, transitions };
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
 * Reveal eligibility predicate — the fail-closed layer of the G0 P0 hardening.
 *
 * A `mutual_pending` pair may only become `mutual` while BOTH sides still hold
 * an eligible seat. Without this, every path that quietly removes a person from
 * a table (refund, seat cancel, no-show, collapsed group, admin cancel) would
 * still let the reveal sweep release their WeChat id to a tablemate.
 *
 * Two shapes, mirroring `repositories/eventTableRosterRepo.ts`:
 *
 *   pool-derived event (a `event_pool_groups` row points at this `events` id)
 *     → both users need a registration in THIS group whose matchStatus is
 *       still `matched` / `completed`, and the owning pool must not be
 *       cancelled/archived. Unmatched/refunded/cancelled/collapsed stayers all
 *       fail this, which is exactly the D5 eligibility rule the feedback gate
 *       uses.
 *
 *   legacy event (no group row)
 *     → neither user may hold a `cancelled` attendance row or an
 *       `attendance_status = 'absent'` (no-show) row for the event. Absence of
 *       any attendance row is NOT treated as ineligible: rows are created only
 *       on explicit confirm, so "no row" cannot be distinguished from "event
 *       predates row creation" (`docs/agent-context/gathering-room.md`).
 *
 * The predicate is a plain boolean expression over `connections`, so it embeds
 * verbatim in both the UPDATE and the expire-DELETE.
 */
const connectionPairRevealEligibleSql = sql`(
  (
    EXISTS (
      SELECT 1 FROM event_pool_groups g
      WHERE g.event_id = connections.event_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM event_pool_groups g
      JOIN event_pools p ON p.id = g.pool_id
      WHERE g.event_id = connections.event_id
        AND p.status IN ('cancelled', 'archived')
    )
    AND EXISTS (
      SELECT 1
      FROM event_pool_registrations r
      JOIN event_pool_groups g ON g.id = r.assigned_group_id
      WHERE g.event_id = connections.event_id
        AND r.user_id = connections.user_a_id
        AND r.match_status IN ('matched', 'completed')
    )
    AND EXISTS (
      SELECT 1
      FROM event_pool_registrations r
      JOIN event_pool_groups g ON g.id = r.assigned_group_id
      WHERE g.event_id = connections.event_id
        AND r.user_id = connections.user_b_id
        AND r.match_status IN ('matched', 'completed')
    )
  )
  OR
  (
    NOT EXISTS (
      SELECT 1 FROM event_pool_groups g
      WHERE g.event_id = connections.event_id
    )
    AND NOT EXISTS (
      SELECT 1
      FROM event_attendance a
      WHERE a.event_id = connections.event_id
        AND a.user_id IN (connections.user_a_id, connections.user_b_id)
        AND (a.status = 'cancelled' OR a.attendance_status = 'absent')
    )
  )
)`;

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
 *   - `connectionPairRevealEligibleSql` is the eligibility gate (P0 hardening):
 *     a due pair whose peer was refunded / cancelled / marked absent is skipped,
 *     so a cancelled tablemate can never be revealed;
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
      AND ${connectionPairRevealEligibleSql}
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

export interface ExpiredRevealSelectionsResult {
  /** Due `mutual_pending` rows deleted because a side was no longer eligible. */
  expired: number;
}

/**
 * Expire (hard-delete) due `mutual_pending` rows that can no longer be
 * honoured because a side is no longer seated.
 *
 * This is the "one-sided invalid selection should expire, not notify" half of
 * the reveal contract:
 *
 *   - the eligible sweep (`finalizeConnectionReveals`) SKIPS these rows, so
 *     neither side is ever notified about a pair that cannot happen;
 *   - leaving them in `mutual_pending` would keep the caller's own 待揭晓
 *     counter alive until the 30-day retention purge, which is a lie. Deleting
 *     them here is the honest answer and matches the retention module's
 *     privacy posture (a never-honourable claim is erased, never archived).
 *
 * Idempotent: scoped by status + due instant + the same eligibility predicate,
 * so a duplicate tick finds nothing. `mutual` rows are untouched.
 */
export async function expireIneligibleRevealSelections(
  options: {
    now?: Date;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    executor?: { execute: (statement: any) => Promise<{ rows?: any[] } | undefined> };
  } = {},
): Promise<ExpiredRevealSelectionsResult> {
  const now = options.now ?? new Date();
  const executor = options.executor ?? db;

  const result = await executor.execute(sql`
    DELETE FROM connections
    WHERE status = 'mutual_pending'
      AND reveal_at IS NOT NULL
      AND reveal_at <= ${now}
      AND NOT ${connectionPairRevealEligibleSql}
    RETURNING id
  `);

  const rows = (result?.rows ?? []) as Array<{ id: string }>;
  if (rows.length > 0) {
    // Counts only — a pair must not survive in the log.
    logger.info("[Connections] expired ineligible reveal selections", {
      expired: rows.length,
      through: now.toISOString(),
    });
  }

  return { expired: rows.length };
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
  return selectOwnSelectedPeerIds(db, eventId, userId);
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
