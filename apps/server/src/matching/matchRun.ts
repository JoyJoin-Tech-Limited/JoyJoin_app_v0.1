/**
 * Pool match-run orchestration: eligibility filtering, cache/flag preload, and
 * hand-off to the greedy core.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import { db } from "../db";
import {
  eventPools,
  eventPoolRegistrations,
  users,
  invitationUses,
  invitations,
  matchHistory,
} from "@shared/schema";
import { and, eq, inArray, sql } from "drizzle-orm";
import { logger } from "../lib/logger";
import { getFeatureFlag } from "../lib/featureFlags";
import {
  buildSemanticProfileCache,
  isAdaptiveWeightsEnabled,
  isSemanticSimilarityEnabled,
} from "../matchingSemantic";
import { getArchetypePairCalibrationMap } from "../archetypeChemistryCalibration";
import { matchingWeightsService, type MatchingWeights } from "../matchingWeightsService";
import {
  aggregateMatchHistorySignals,
  type MatchHistoryLookup,
} from "../services/matchHistoryDerivation";
import { preloadLatestTraitVectors, preloadUserInterests } from "./interestScoring";
import { resolveChemistryArchetype } from "./chemistryScoring";
import {
  meetsHardConstraints,
  resolveDuoEligibilityAfterHardConstraint,
} from "./hardConstraints";
import { runGreedyPoolMatchingCore } from "./poolFormation";
import type { MatchGroup, UserWithProfile } from "./poolMatchingTypes";

/**
 * 主匹配算法：贪婪+优化策略
 * 1. 按匹配分数排序所有可能的配对
 * 2. 贪婪地组建小组，确保每个小组质量
 * 3. 优化：调整边界成员以提升整体分数
 */
export async function matchEventPool(poolId: string): Promise<MatchGroup[]> {
  // 1. 获取活动池配置
  const pool = await db.query.eventPools.findFirst({
    where: eq(eventPools.id, poolId)
  });
  
  if (!pool) {
    throw new Error("活动池不存在");
  }
  
  // 2. 获取所有报名者 + 用户资料
  const registrations = (await db
    .select({
      registrationId: eventPoolRegistrations.id,
      userId: eventPoolRegistrations.userId,
      budgetRange: eventPoolRegistrations.budgetRange,
      preferredLanguages: eventPoolRegistrations.preferredLanguages,
      eventIntent: eventPoolRegistrations.eventIntent,
      userIntent: users.intent,
      cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
      dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
      gender: users.gender,
      birthdate: users.birthdate,
      // ✅ UPDATED: Use 3-tier industry classification
      industryNiche: users.industryNiche,
      industryNicheLabel: users.industryNicheLabel,
      industryCategoryLabel: users.industryCategoryLabel,
      educationLevel: users.educationLevel,
      // AC-W6.5: leave this nullable (no `'koala'` third arg) so
      // `resolveChemistryArchetype` sees null and applies the explicit neutral
      // score — otherwise the neutral branch and the once-per-run
      // unknown-archetype log below are unreachable in the live read path.
      archetype: sql<string | null>`coalesce(${users.primaryArchetype}, ${users.archetype})`,
      secondaryArchetype: users.secondaryArchetype,
      lifeStage: users.lifeStage,  // canonical life stage for matching
      workMode: users.workMode,    // DEPRECATED: one-release fallback only
      hometown: users.hometownRegionCity,
      hometownAffinityOptin: users.hometownAffinityOptin,
      eventType: eventPools.eventType,
      barBudgetRange: eventPoolRegistrations.barBudgetRange,
      barThemes: eventPoolRegistrations.barThemes,
      alcoholComfort: eventPoolRegistrations.alcoholComfort,
      ageMatchPreference: users.ageMatchPreference,
      tableVibePreference: users.tableVibePreference,
      preferenceStrictness: eventPoolRegistrations.preferenceStrictness,
      genderCompositionPreference: eventPoolRegistrations.genderCompositionPreference,
    })
    .from(eventPoolRegistrations)
    .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
    .innerJoin(eventPools, eq(eventPoolRegistrations.poolId, eventPools.id))
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.matchStatus, "pending")
      )
    )) as UserWithProfile[];
  
  // 3.4 W8 (AC-W8.6): resolve duo bindings from the PRE-filter registration set
  // so a partner rejected by a hard constraint still strands the other
  // (整组顺延), never leaving a half-duo to match solo. Legacy invitation
  // (+20 soft boost) bindings are resolved from the same set and scoped back to
  // the eligible users afterwards.
  const registrationById = new Map(registrations.map((reg) => [reg.registrationId, reg]));
  const registrationByUserId = new Map(registrations.map((reg) => [reg.userId, reg]));
  const allRegistrationIds = registrations.map((reg) => reg.registrationId);
  const allInviteUses = allRegistrationIds.length > 0
    ? await db.select().from(invitationUses)
        .where(inArray(invitationUses.poolRegistrationId, allRegistrationIds))
    : [];
  // D: Fix — invitationUses.invitationId is a FK to invitations.id (not invitations.code)
  const allInvitationIds = allInviteUses
    .map((u: any) => u.invitationId)
    .filter(Boolean) as string[];
  const allRelatedInvitations = allInvitationIds.length > 0
    ? await db.select().from(invitations)
        .where(inArray(invitations.id, allInvitationIds))
    : [];
  const allInvitationById = new Map(allRelatedInvitations.map((inv: any) => [inv.id, inv]));

  const duoPairsAll: Array<{ inviterId: string; inviteeId: string }> = [];
  const legacyInvitationPairsAll: Array<{ inviterId: string; inviteeId: string }> = [];
  for (const inviteUse of allInviteUses) {
    if (!(inviteUse as any).invitationId) continue;
    const invitation = allInvitationById.get((inviteUse as any).invitationId);
    if (!invitation) continue;
    const inviter = registrationByUserId.get((invitation as any).inviterId);
    const invitee = registrationById.get((inviteUse as any).poolRegistrationId);
    // Both users must be registered in THIS pool — a duo never binds a user
    // outside the pool.
    if (!inviter || !invitee || inviter.userId === invitee.userId) continue;
    const pair = { inviterId: inviter.userId, inviteeId: invitee.userId };
    const isDuoScoped =
      (invitation as any).invitationType === "duo" &&
      (invitation as any).poolId === poolId;
    if (isDuoScoped) {
      duoPairsAll.push(pair);
    } else {
      legacyInvitationPairsAll.push(pair);
    }
  }

  // 3. 硬约束过滤 — then enforce duo atomicity across the filter boundary.
  const hardConstraintEligible = registrations.filter((reg) =>
    meetsHardConstraints(reg, pool, reg.preferenceStrictness ?? 50)
  );
  const duoEligibility = resolveDuoEligibilityAfterHardConstraint({
    eligibleUsers: hardConstraintEligible,
    duoPairs: duoPairsAll,
  });
  const eligibleUsers = duoEligibility.eligibleUsers;
  if (duoEligibility.strandedUserIds.length > 0) {
    logger.info("[Pool Matching] duo members stranded by hard constraints (整组顺延)", {
      poolId,
      strandedCount: duoEligibility.strandedUserIds.length,
      strandedUserIds: duoEligibility.strandedUserIds,
    });
  }
  
  // Match Compass: compute effective strictness for this pool
  const isStrictnessEnabled = process.env.MATCH_COMPASS_STRICTNESS_ENABLED !== "false";
  let effectiveStrictness = 50;
  if (isStrictnessEnabled && eligibleUsers.length > 0) {
    const strictnessValues = eligibleUsers.map((u) => u.preferenceStrictness ?? 50);
    effectiveStrictness = Math.round(
      strictnessValues.reduce((a, b) => a + b, 0) / strictnessValues.length
    );
  }
  
  if (eligibleUsers.length < (pool.minGroupSize || 4)) {
    throw new Error(`报名人数不足，至少需要${pool.minGroupSize}人`);
  }

  const eligibleUserIds = eligibleUsers.map(user => user.userId);
  const semanticSimilarityEnabled = isSemanticSimilarityEnabled();

  // 3.5 Preload user_interests for all eligible users in one batch query (C: runtime hardening)
  const interestsCache = await preloadUserInterests(eligibleUserIds);
  const semanticProfileCache = semanticSimilarityEnabled
    ? buildSemanticProfileCache(eligibleUsers, interestsCache)
    : undefined;
  // Chemistry calibration read path is gated: Phase 0 only accumulates stats
  // (writer is live via match_history derivation); calibrated deltas activate
  // in Phase 3 after shadow evidence + operator sign-off.
  const chemistryCalibrationEnabled = await getFeatureFlag("matchChemistryCalibrationEnabled", false);
  const chemistryCalibrationMap = chemistryCalibrationEnabled
    ? await getArchetypePairCalibrationMap()
    : undefined;

  // In-memory pair score cache for this run
  const pairScoreCache = new Map<string, number>();

  // Preload matchHistory for eligible users (anti-repetition + re-match boost).
  // W6 AC-W6.6a: deterministic ORDER BY on the read so the aggregation is stable
  // independent of physical row order; `aggregateMatchHistorySignals` is itself
  // order-independent (defence in depth) and folds multiple meetings per pair
  // into the two-strike signal (AC-W6.6b).
  const matchHistoryLookup: MatchHistoryLookup = new Map();
  if (eligibleUserIds.length >= 2) {
    const historyRows = await db
      .select({
        user1Id: matchHistory.user1Id,
        user2Id: matchHistory.user2Id,
        wouldMeetAgain: matchHistory.wouldMeetAgain,
        matchedAt: matchHistory.matchedAt,
      })
      .from(matchHistory)
      .where(
        and(
          inArray(matchHistory.user1Id, eligibleUserIds),
          inArray(matchHistory.user2Id, eligibleUserIds),
        ),
      )
      .orderBy(
        matchHistory.user1Id,
        matchHistory.user2Id,
        matchHistory.matchedAt,
        matchHistory.id,
      );
    for (const [key, signal] of aggregateMatchHistorySignals(historyRows, new Date())) {
      matchHistoryLookup.set(key, signal);
    }
  }

  // Magnetism Engine Phase 0 / W2: read the never-meet sentinel flag ONCE per
  // run (calculatePairScore is a hot path — no per-pair flag lookups) and
  // thread it through. Default OFF: the -1 hard-skip is policy-pending; the
  // +5 re-match boost is unconditional.
  const matchNeverMeetSentinelEnabled = await getFeatureFlag("matchNeverMeetSentinel", false);

  // Magnetism Engine 惊艳开局包 / P2: weight profile v2 — read ONCE per run and
  // threaded through (calculatePairScore is a hot path — no per-pair flag
  // lookups). Default OFF: v1 tables remain the scoring default until test-pool
  // dual-run validation. Strictness/adaptive overrides are unaffected.
  const useWeightProfileV2 = await getFeatureFlag("magnetismWeightProfileV2Enabled", false);

  // Magnetism Engine 惊艳开局包 / P1: group-composition rules (R1 无孤立者 /
  // R2 能量编排 / R3 话题锚点 / R4 新奇分散) — read ONCE per run and threaded
  // into the greedy core like the flags above. Default OFF.
  const magnetismGroupRulesEnabled = await getFeatureFlag("magnetismGroupRulesEnabled", false);

  // Item 5 (V4 engine upgrade): literature-prior composition gates — read
  // ONCE per run and threaded like the flags above. Default OFF (ships dark).
  // When on, batch-preload REPORTED ACOEXP vectors from each eligible user's
  // latest COMPLETED assessment session (mirrors preloadUserInterests) and
  // attach them at the UserWithProfile boundary (AC-5.1b). Cold-start members
  // keep traitScores = null and skip gates (i)/(ii)/(iv).
  const compositionGatesEnabled = await getFeatureFlag("compositionGatesEnabled", false);

  // W2 (gm-debrief): table-viability floor (R1 无孤立者 + R2 能量编排) — read
  // ONCE per run and threaded like the flags above. Canonical default ON
  // (DEFAULT_FLAG_VALUES); the inline fallback stays false so direct-core call
  // sites and flag-mocking unit tests remain gate-off unless they opt in.
  // Trait vectors are preloaded when EITHER the item5 gates or the W2 floor is
  // active — W2's energizer prefers the item5 spark definition when vectors
  // exist and falls back to ARCHETYPE_ENERGY otherwise.
  const tableViabilityFloorEnabled = await getFeatureFlag("tableViabilityFloorEnabled", false);

  // W6-F (gm-debrief follow-up): bounded X-variance dispersion nudge. Env kill
  // switch, default ON (mirrors the MATCH_COMPASS_STRICTNESS_ENABLED pattern) —
  // corrects the gate-off X-variance drift introduced by AC-W6.4's interest
  // re-weighting. Trait vectors are preloaded when it is active so the nudge
  // has inputs even if the item5/W2 gates are both disabled.
  const xVarianceDispersionEnabled = process.env.MATCH_X_VARIANCE_DISPERSION_ENABLED !== "false";

  if (compositionGatesEnabled || tableViabilityFloorEnabled || xVarianceDispersionEnabled) {
    const traitVectorCache = await preloadLatestTraitVectors(eligibleUserIds);
    for (const user of eligibleUsers) {
      user.traitScores = traitVectorCache.get(user.userId) ?? null;
    }
    logger.info("[Pool Matching] composition gates / table-viability floor enabled", {
      poolId,
      eligibleCount: eligibleUsers.length,
      traitedCount: traitVectorCache.size,
      compositionGatesEnabled,
      tableViabilityFloorEnabled,
      xVarianceDispersionEnabled,
    });
  }

  // Item 10 (V4 engine upgrade): derived-chemistry mechanical authority — read
  // ONCE per run and threaded like the flags above. Default OFF (ships dark:
  // the ρ ≥ 0.7 validation gate failed — see
  // docs/reports/2026-09-10-derived-chemistry-validation.md). When on, pair
  // chemistry is computed from trait-vector geometry, which can shift pair
  // scores and therefore group formation (AC-10.5 quantifies this).
  const derivedChemistryEnabled = await getFeatureFlag("derivedChemistryEnabled", false);
  if (derivedChemistryEnabled) {
    logger.info("[Pool Matching] derived chemistry enabled", {
      poolId,
      eligibleCount: eligibleUsers.length,
    });
  }

  // W6 (gm-debrief): anti-clique novelty constraint (AC-W6.6c) — read ONCE per
  // run and threaded like the flags above. Default OFF (ships dark; the gate-off
  // simulation supplies no match history, so it is inert there regardless).
  const matchHistoryNoveltyEnabled = await getFeatureFlag("matchHistoryNoveltyEnabled", false);

  // W6 AC-W6.5 observability: log unknown-archetype handling ONCE per run
  // (replaces the old per-pair [ChemistryDebug] spam). Unknown members are
  // scored with the explicit neutral chemistry instead of a koala substitute.
  const unknownArchetypeUsers = eligibleUsers.filter(
    (user) => resolveChemistryArchetype(user.archetype) === null,
  );
  if (unknownArchetypeUsers.length > 0) {
    logger.info("[Pool Matching] unknown archetypes treated as neutral chemistry", {
      poolId,
      eligibleCount: eligibleUsers.length,
      unknownCount: unknownArchetypeUsers.length,
      sampleUserIds: unknownArchetypeUsers.slice(0, 5).map((user) => user.userId),
    });
  }
  
  // 3.6 邀请关系 (invitation relationships) — W8 (AC-W8.6): the raw bindings
  // were resolved from the pre-filter set in step 3.4 (so duo atomicity holds
  // across the hard-constraint boundary); scope them to the eligible set here.
  // duoPairs come from `resolveDuoEligibilityAfterHardConstraint` (both partners
  // eligible by construction); legacy pairs are filtered to eligible users.
  const eligibleUserIdSet = new Set(eligibleUsers.map((u) => u.userId));
  const duoPairs = duoEligibility.duoPairs;
  const invitationPairs = legacyInvitationPairsAll.filter(
    (pair) => eligibleUserIdSet.has(pair.inviterId) && eligibleUserIdSet.has(pair.inviteeId),
  );

  // H3: Fetch adaptive weights when Thompson Sampling is enabled.
  // Weights are fetched once per matching run (not per pair) and cached
  // for the duration via matchingWeightsService's internal 60s TTL.
  const adaptiveWeightsEnabled = isAdaptiveWeightsEnabled();
  let customWeights: MatchingWeights | undefined;
  if (adaptiveWeightsEnabled) {
    try {
      customWeights = await matchingWeightsService.getActiveWeights();
      logger.info(`[Pool Matching] Using adaptive weights:`, customWeights);
    } catch (error) {
      logger.error(`[Pool Matching] Failed to fetch adaptive weights, falling back to defaults:`, { error: error instanceof Error ? error.message : String(error) });
      customWeights = undefined;
    }
  }

  return runGreedyPoolMatchingCore(
    eligibleUsers,
    pool,
    interestsCache,
    pairScoreCache,
    semanticProfileCache,
    semanticSimilarityEnabled,
    chemistryCalibrationMap,
    invitationPairs,
    customWeights,
    matchHistoryLookup,
    effectiveStrictness,
    matchNeverMeetSentinelEnabled,
    useWeightProfileV2,
    magnetismGroupRulesEnabled,
    duoPairs,
    compositionGatesEnabled,
    undefined,
    derivedChemistryEnabled,
    tableViabilityFloorEnabled,
    matchHistoryNoveltyEnabled,
    xVarianceDispersionEnabled,
  );
}
