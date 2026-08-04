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
