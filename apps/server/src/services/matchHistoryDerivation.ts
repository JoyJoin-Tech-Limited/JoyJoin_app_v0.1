import { logger } from "../lib/logger";
import { refreshArchetypePairCalibrationMap } from "../archetypeChemistryCalibration";
import {
  getGroupDerivationSource,
  syncMatchHistoryPairsForGroup,
} from "../repositories/matchHistoryRepo";

/**
 * Match history derivation (Magnetism Engine Phase 0 / W1).
 *
 * Derives one `match_history` row per unordered member pair from a group's
 * submitted `event_group_outcomes`. This is the only production INSERT path
 * for `match_history` — the scoring path in `poolMatchingService.ts` already
 * reads the table (re-match +5 boost; `wouldMeetAgain === false` -1 sentinel
 * gated behind the `matchNeverMeetSentinel` flag, default OFF).
 *
 * Pair semantics (per docs/systems/MAGNETISM_ENGINE.md §4):
 * - `wouldMeetAgain` is true only if BOTH members submitted true,
 *   false if EITHER submitted false, null otherwise (incomplete).
 * - `connectionQuality` is the rounded mean of the two members'
 *   `atmosphereScore` submissions (null when neither submitted).
 *
 * Everything here is idempotent: re-running for the same group converges to
 * the same rows (see `syncMatchHistoryPairsForGroup`).
 */

export interface GroupOutcomeSignal {
  submittedBy: string;
  wouldMeetAgain: boolean;
  atmosphereScore: number;
}

export interface DerivedMatchHistoryPair {
  user1Id: string;
  user2Id: string;
  wouldMeetAgain: boolean | null;
  connectionQuality: number | null;
}

export type DerivationSkipReason =
  | "group_not_found"
  | "missing_event_id"
  | "no_outcomes"
  | "insufficient_members";

export interface DerivationPlan {
  groupId: string;
  status: "ready" | "skipped";
  reason?: DerivationSkipReason;
  eventId?: string;
  matchedAt?: Date;
  pairs: DerivedMatchHistoryPair[];
}

export interface DerivationResult {
  groupId: string;
  status: "derived" | "skipped";
  reason?: DerivationSkipReason;
  pairCount: number;
  insertedCount: number;
  updatedCount: number;
}

// ── W6 (gm-debrief): match-history integrity ────────────────────────────────
// OD-2 (CHOSEN 2026-09-12): the negative policy is **two_strike**. A single
// negative meeting does NOT permanently block a pair; the -1 hard skip fires
// only after >= 2 negative meetings inside `MATCH_HISTORY_NEGATIVE_WINDOW_DAYS`.
// Rationale: the existing derivation collapses a meeting to the OR of both
// members' submissions (W1 contract), so a "both-submit" policy cannot be
// rebuilt from the aggregate without per-submitter storage — two-strike is the
// computable, humane option and pairs naturally with an expiry window and a
// self-scoped reset route. `wouldMeetAgain` keeps its W1 OR semantics; only
// the hard-skip decision changes.

/** One raw `match_history` read row (one row per pair per event). */
export interface MatchHistoryRawRow {
  user1Id: string;
  user2Id: string;
  wouldMeetAgain: boolean | null;
  matchedAt: Date | null;
}

/**
 * Aggregated per-pair signal consumed by the scoring path. `negativeCount` is
 * the number of NEGATIVE meetings inside the active window; `latestNegativeAt`
 * is the most recent of those (for diagnostics/expiry).
 */
export interface MatchHistorySignal {
  wouldMeetAgain: boolean | null;
  negativeCount: number;
  latestNegativeAt: Date | null;
}

export type MatchHistoryLookup = Map<string, MatchHistorySignal>;

/** Negatives older than this stop counting (expiry, AC-W6.6b). */
export const MATCH_HISTORY_NEGATIVE_WINDOW_DAYS = 180;
/** Number of in-window negative meetings that triggers the hard skip. */
export const MATCH_HISTORY_NEGATIVE_STRIKES = 2;
export type MatchNeverMeetPolicy = "two_strike";
export const MATCH_HISTORY_NEGATIVE_POLICY: MatchNeverMeetPolicy = "two_strike";

/**
 * W6 AC-W6.6c: at most this many intra-group pairs may carry a POSITIVE
 * `wouldMeetAgain` history. The +5 re-match bonus can then never pair a
 * returning clique unopposed at the group level.
 */
export const MATCH_HISTORY_MAX_REPEAT_PAIRS_PER_GROUP = 1;

function pairKeyForHistory(userA: string, userB: string): string {
  return [userA, userB].sort().join("|");
}

/** Deterministic severity tie-break for equal timestamps (false > true > null). */
function meetAgainSeverity(value: boolean | null): number {
  if (value === false) return 2;
  if (value === true) return 1;
  return 0;
}

/**
 * Pure, deterministic aggregation of raw history rows into the pair lookup.
 * Sorts internally (newest first, then severity) so the result is identical
 * regardless of the caller's physical row order — this is the W6 AC-W6.6a
 * determinism guarantee, complementing the SQL `ORDER BY` in the preload
 * query. Scale: O(rows) grouping + O(k log k) per pair; no extra queries.
 */
export function aggregateMatchHistorySignals(
  rows: MatchHistoryRawRow[],
  now: Date = new Date(),
  windowDays: number = MATCH_HISTORY_NEGATIVE_WINDOW_DAYS,
): MatchHistoryLookup {
  const windowMs = windowDays * 24 * 60 * 60 * 1000;
  const byPair = new Map<string, MatchHistoryRawRow[]>();
  for (const row of rows) {
    const key = pairKeyForHistory(row.user1Id, row.user2Id);
    const list = byPair.get(key);
    if (list) {
      list.push(row);
    } else {
      byPair.set(key, [row]);
    }
  }

  const lookup: MatchHistoryLookup = new Map();
  for (const [key, pairRows] of byPair) {
    const ordered = [...pairRows].sort((a, b) => {
      const ta = a.matchedAt ? a.matchedAt.getTime() : 0;
      const tb = b.matchedAt ? b.matchedAt.getTime() : 0;
      if (tb !== ta) return tb - ta;
      return meetAgainSeverity(b.wouldMeetAgain) - meetAgainSeverity(a.wouldMeetAgain);
    });

    let negativeCount = 0;
    let latestNegativeAt: Date | null = null;
    for (const row of ordered) {
      if (row.wouldMeetAgain !== false) continue;
      // Expiry: unknown timestamps are treated as active (conservative).
      if (row.matchedAt && now.getTime() - row.matchedAt.getTime() > windowMs) continue;
      negativeCount++;
      if (row.matchedAt && (!latestNegativeAt || row.matchedAt > latestNegativeAt)) {
        latestNegativeAt = row.matchedAt;
      }
    }

    lookup.set(key, {
      wouldMeetAgain: ordered[0]?.wouldMeetAgain ?? null,
      negativeCount,
      latestNegativeAt,
    });
  }

  return lookup;
}

/**
 * W6 AC-W6.6b: named, testable hard-skip policy. Reads the aggregated signal
 * and decides whether the pair must not be matched again. The caller gates this
 * behind the `matchNeverMeetSentinel` feature flag (read once per run).
 */
export function shouldHardSkipPair(
  signal: Pick<MatchHistorySignal, "negativeCount"> | undefined,
  policy: MatchNeverMeetPolicy = MATCH_HISTORY_NEGATIVE_POLICY,
  threshold: number = MATCH_HISTORY_NEGATIVE_STRIKES,
): boolean {
  if (!signal) return false;
  switch (policy) {
    case "two_strike":
      return signal.negativeCount >= threshold;
    default:
      return false;
  }
}

/**
 * W6 AC-W6.6c: anti-clique novelty rule. Returns false when a group would seat
 * more than `maxRepeatPairs` intra-group pairs that previously signalled a
 * positive re-match. Inert when no lookup is supplied (cold-start / simulation).
 */
export function groupSatisfiesRematchNoveltyRule(
  memberUserIds: string[],
  lookup: MatchHistoryLookup | undefined,
  maxRepeatPairs: number = MATCH_HISTORY_MAX_REPEAT_PAIRS_PER_GROUP,
): boolean {
  if (!lookup) return true;
  let repeatPairs = 0;
  for (let i = 0; i < memberUserIds.length; i++) {
    for (let j = i + 1; j < memberUserIds.length; j++) {
      if (lookup.get(pairKeyForHistory(memberUserIds[i], memberUserIds[j]))?.wouldMeetAgain === true) {
        repeatPairs++;
        if (repeatPairs > maxRepeatPairs) return false;
      }
    }
  }
  return true;
}

/**
 * Pure pair-row builder. Members are de-duplicated and sorted lexicographically
 * so `user1Id|user2Id` matches the scoring path's pair key
 * (`[user1Id, user2Id].sort().join('|')` in `poolMatchingService.ts`).
 * Outcomes from non-members are ignored defensively (the route enforces
 * membership, but membership can change after submission).
 */
export function buildPairRowsForGroup(
  memberUserIds: string[],
  outcomes: GroupOutcomeSignal[],
): DerivedMatchHistoryPair[] {
  const sortedMemberIds = [...new Set(memberUserIds)].sort();
  const outcomeByUserId = new Map(outcomes.map((outcome) => [outcome.submittedBy, outcome]));

  const pairs: DerivedMatchHistoryPair[] = [];
  for (let i = 0; i < sortedMemberIds.length; i++) {
    for (let j = i + 1; j < sortedMemberIds.length; j++) {
      const outcomeA = outcomeByUserId.get(sortedMemberIds[i]);
      const outcomeB = outcomeByUserId.get(sortedMemberIds[j]);

      let wouldMeetAgain: boolean | null;
      if (outcomeA?.wouldMeetAgain === false || outcomeB?.wouldMeetAgain === false) {
        wouldMeetAgain = false;
      } else if (outcomeA?.wouldMeetAgain === true && outcomeB?.wouldMeetAgain === true) {
        wouldMeetAgain = true;
      } else {
        wouldMeetAgain = null;
      }

      const atmosphereScores = [outcomeA?.atmosphereScore, outcomeB?.atmosphereScore]
        .filter((score): score is number => typeof score === "number");
      const connectionQuality = atmosphereScores.length > 0
        ? Math.round(
            atmosphereScores.reduce((total, score) => total + score, 0) / atmosphereScores.length,
          )
        : null;

      pairs.push({
        user1Id: sortedMemberIds[i],
        user2Id: sortedMemberIds[j],
        wouldMeetAgain,
        connectionQuality,
      });
    }
  }

  return pairs;
}

/**
 * Load the group's derivation source and compute the pair rows without
 * writing anything. Shared by `derivePairRowsForGroup` and the backfill
 * script's `--dry-run` mode.
 */
export async function planPairRowsForGroup(groupId: string): Promise<DerivationPlan> {
  const source = await getGroupDerivationSource(groupId);

  if (!source) {
    return { groupId, status: "skipped", reason: "group_not_found", pairs: [] };
  }

  // match_history.eventId is NOT NULL — a group without its generated event
  // row cannot be linked, so there is nothing safe to write yet.
  if (!source.group.eventId) {
    return { groupId, status: "skipped", reason: "missing_event_id", pairs: [] };
  }

  if (source.outcomes.length === 0) {
    return { groupId, status: "skipped", reason: "no_outcomes", pairs: [] };
  }

  const pairs = buildPairRowsForGroup(source.memberUserIds, source.outcomes);
  if (pairs.length === 0) {
    return { groupId, status: "skipped", reason: "insufficient_members", pairs: [] };
  }

  return {
    groupId,
    status: "ready",
    eventId: source.group.eventId,
    matchedAt: source.group.createdAt ?? new Date(),
    pairs,
  };
}

/**
 * Derive and persist the pair rows for one group. Safe to re-run.
 */
export async function derivePairRowsForGroup(groupId: string): Promise<DerivationResult> {
  const plan = await planPairRowsForGroup(groupId);

  if (plan.status !== "ready") {
    if (plan.reason !== "no_outcomes") {
      logger.warn("[MatchHistory] Skipping pair derivation for group", {
        groupId,
        reason: plan.reason,
      });
    }
    return {
      groupId,
      status: "skipped",
      reason: plan.reason,
      pairCount: 0,
      insertedCount: 0,
      updatedCount: 0,
    };
  }

  const { insertedCount, updatedCount } = await syncMatchHistoryPairsForGroup({
    groupId,
    eventId: plan.eventId!,
    rows: plan.pairs.map((pair) => ({
      ...pair,
      eventId: plan.eventId!,
      matchedAt: plan.matchedAt!,
    })),
  });

  logger.info("[MatchHistory] Derived pair rows for group", {
    groupId,
    pairCount: plan.pairs.length,
    insertedCount,
    updatedCount,
  });

  return {
    groupId,
    status: "derived",
    pairCount: plan.pairs.length,
    insertedCount,
    updatedCount,
  };
}

/**
 * Real-time entry point called after a successful group-outcome submission.
 *
 * W3: after the pair rows are written, the archetype-pair feedback aggregator
 * (`refreshArchetypePairCalibrationMap`) re-aggregates the full match_history
 * table and upserts `archetype_pair_feedback_stats`. This only ACCUMULATES the
 * stats table — calibrated chemistry scores are not wired into scoring by this
 * change (that activation is Phase 3). The aggregation is a full-table
 * recompute (its intended call shape); at outcome-submission volume (a few per
 * group per event) that is cheap, and its own in-flight guard dedupes
 * concurrent refreshes.
 *
 * The stats refresh is failure-isolated from derivation: a calibration error
 * is logged, never rethrown — the derivation result stands on its own.
 */
export async function deriveMatchHistoryAndRefreshCalibration(
  groupId: string,
): Promise<DerivationResult> {
  const result = await derivePairRowsForGroup(groupId);

  if (result.status === "derived") {
    try {
      await refreshArchetypePairCalibrationMap();
    } catch (error) {
      logger.error("[MatchHistory] Archetype-pair feedback stats refresh failed", {
        groupId,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  return result;
}
