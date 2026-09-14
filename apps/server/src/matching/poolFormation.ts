/**
 * In-memory greedy pool-formation core (磁场引擎 group formation + H4
 * redistribution passes).
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import { logger } from "../lib/logger";
import type {
  GenderBalanceMode,
  GreedyPoolMatchingConfig,
  MatchGroup,
  UserInterestsCache,
  UserWithProfile,
} from "./poolMatchingTypes";
import type { SemanticProfileCache } from "../matchingSemantic";
import type { MatchingWeights } from "../matchingWeightsService";
import type { ChemistryCalibrationMap } from "../archetypeChemistryCalibration";
import { calculatePairScore, pairScoreCacheKey } from "./pairScoring";
import {
  calculateGroupChemistryScore,
  calculateGroupDiversity,
  calculateGroupPairScore,
  generateGroupExplanation,
  getTemperatureLevel,
} from "./groupScoring";
import { pairMeetsDealbreakers } from "./hardConstraints";
import { resolveStrictnessWeights } from "./strictnessWeights";
import {
  MAGNETISM_ENERGIZER_THRESHOLD,
  MAGNETISM_STRONG_TIE_THRESHOLD,
  calculateEnergyBalance,
  userArchetypeEnergy,
} from "./energyComposition";
import {
  adjustScoreForNoveltyDispersion,
  groupHasEnergizer,
  groupHasTopicAnchor,
  groupSatisfiesStrongTieRule,
} from "./magnetismRules";
import {
  COMPOSITION_MIN_E_FLOOR,
  XVAR_DISPERSION_TARGET,
  adjustScoreForCompositionGates,
  adjustScoreForXVarianceDispersion,
  computeEnergizerPoolState,
  computeSparkPoolState,
  evaluateCompositionGates,
  groupSatisfiesEnergizerRule,
  hasCompleteTraitVector,
  recordCompositionGateRejection,
  recordTableViabilityRejection,
  type CompositionGateEvaluation,
  type CompositionGateStats,
} from "./compositionGates";
import {
  countDisclosedGenders,
  groupHasExactGenderBalance,
  groupSatisfiesGenderFloor,
} from "./genderBalance";
import {
  groupSatisfiesRematchNoveltyRule,
  type MatchHistoryLookup,
} from "../services/matchHistoryDerivation";

/**
 * In-memory greedy pool matching (same algorithm as `matchEventPool` after eligibility + caches).
 * Exported for stress benchmarks and tests — **not** an HTTP entrypoint.
 */
export async function runGreedyPoolMatchingCore(
  eligibleUsers: UserWithProfile[],
  pool: GreedyPoolMatchingConfig,
  interestsCache: UserInterestsCache,
  pairScoreCache: Map<string, number>,
  semanticProfileCache: SemanticProfileCache | undefined,
  semanticSimilarityEnabled: boolean,
  chemistryCalibrationMap: ChemistryCalibrationMap | undefined,
  invitationPairs: Array<{ inviterId: string; inviteeId: string }>,
  customWeights?: MatchingWeights,
  matchHistoryLookup?: MatchHistoryLookup,
  strictness: number = 50,
  matchNeverMeetSentinelEnabled = false,
  useWeightProfileV2 = false,
  magnetismGroupRulesEnabled = false,
  // 双人成行 (duo registration, 2026-08-07): hard atomic units. Each pair must
  // be placed into the SAME group occupying 2 seats, with MAX 1 duo per group.
  // Trailing optional param — default [] keeps zero-duo pools byte-identical.
  duoPairs: Array<{ inviterId: string; inviteeId: string }> = [],
  // Item 5 (V4 engine upgrade): literature-prior composition gates. Trailing
  // optional params — default false/undefined keeps gate-off byte-identical.
  // The flag is read ONCE per run in matchEventPool via getFeatureFlag and
  // threaded in; the core NEVER reads env directly.
  compositionGatesEnabled = false,
  compositionGateStats?: CompositionGateStats,
  // Item 10 (V4 engine upgrade): derived-chemistry mechanical authority.
  // Trailing optional param — default false keeps flag-off byte-identical.
  // Read ONCE per run in matchEventPool via getFeatureFlag and threaded in.
  derivedChemistryEnabled = false,
  // W2 (gm-debrief): table-viability floor ON (R1 无孤立者 + R2 能量编排).
  // Trailing optional param — default false keeps direct-core call sites
  // (harness, unit tests) byte-identical. Production threads the canonical
  // default from DEFAULT_FLAG_VALUES via matchEventPool.
  tableViabilityFloorEnabled = false,
  // W6 (gm-debrief): anti-clique novelty constraint for returning users. When
  // on, a committed group may contain at most
  // `MATCH_HISTORY_MAX_REPEAT_PAIRS_PER_GROUP` pairs with a positive match
  // history, so the +5 re-match bonus cannot pair repeat-likes unopposed.
  // Trailing optional param — default false keeps direct-core call sites and
  // the gate-off simulation byte-identical (the sim supplies no lookup at all).
  matchHistoryNoveltyEnabled = false,
  // W6-F (gm-debrief follow-up): bounded X-variance dispersion nudge in the
  // group-expansion ranking. Trailing optional param — default false keeps
  // direct-core call sites (unit tests, other services) byte-identical;
  // matchEventPool threads the env-resolved default (ON).
  xVarianceDispersionEnabled = false,
): Promise<MatchGroup[]> {
  // 4. 贪婪分组算法（优先处理邀请关系）
  const groups: MatchGroup[] = [];
  const used = new Set<string>();
  const targetGroupSize = pool.maxGroupSize || 6;
  const minGroupSize = pool.minGroupSize || 4;
  const maxGroupSize = pool.maxGroupSize || 6;

  // ── Gender-balance configuration (Sprint 2026-07-14, D1–D9) ──
  // D1: defaults mirror the schema — mode "soft", bonus 15, floors 0.
  // D4: floors enforced only in `hard` mode; `soft` = bonus only; `none` = off.
  // D5: single-gender pools (genderRestriction set) skip ALL balance logic.
  // D9: no special-casing for test pools — logic applies uniformly.
  const rawGenderBalanceMode = (pool.genderBalanceMode ?? "soft") as GenderBalanceMode;
  const genderBalanceBonusPoints = pool.genderBalanceBonusPoints ?? 15;
  const minFemaleCount = pool.minFemaleCount ?? 0;
  const minMaleCount = pool.minMaleCount ?? 0;
  const genderBalanceMode: GenderBalanceMode =
    pool.genderRestriction || rawGenderBalanceMode === "none" ? "none" : rawGenderBalanceMode;
  const hardFloorActive = genderBalanceMode === "hard" && (minFemaleCount > 0 || minMaleCount > 0);
  const poolIdForLog = (pool as GreedyPoolMatchingConfig & { id?: string | null }).id ?? null;

  if (hardFloorActive) {
    // AC-10(a): hard-mode activation logged once per run.
    logger.info("[Pool Matching] hard gender-balance mode active", {
      poolId: poolIdForLog,
      mode: genderBalanceMode,
      minFemaleCount,
      minMaleCount,
    });
  }

  // ── 双人成行 (duo) atomic units: variant A 整组顺延 (spec §D.3) ───────────
  // Duo = hard atomic unit: both members together or unmatched together.
  // MAX 1 duo per group. Fallback semantics live in guards marked [DUO].
  const duoPartnerOf = new Map<string, string>();
  const duoInternalPairKeys = new Set<string>();
  for (const duo of duoPairs) {
    duoPartnerOf.set(duo.inviterId, duo.inviteeId);
    duoPartnerOf.set(duo.inviteeId, duo.inviterId);
    duoInternalPairKeys.add([duo.inviterId, duo.inviteeId].sort().join('|'));
  }
  const isDuoInternalPair = (userAId: string, userBId: string): boolean =>
    duoInternalPairKeys.has([userAId, userBId].sort().join('|'));
  // Exclusion set for group-quality metrics (duo-internal pair must not
  // inflate avgPairScore). Undefined when the pool has no duos → zero change.
  const duoQualityExclusions = duoInternalPairKeys.size > 0 ? duoInternalPairKeys : undefined;

  if (duoPairs.length > 0) {
    logger.info("[Pool Matching] duo atomic units active", {
      poolId: poolIdForLog,
      duoCount: duoPairs.length,
    });
  }

  const isStrictnessEnabled = process.env.MATCH_COMPASS_STRICTNESS_ENABLED !== "false";
  const effectiveStrictness = isStrictnessEnabled ? strictness : 50;
  const hasExplicitCustomWeights = !!customWeights;
  const formationWeights = resolveStrictnessWeights(effectiveStrictness) ?? customWeights;

  // minPairScore threshold by strictness tier
  let minPairScore = 60;
  if (effectiveStrictness <= 0) minPairScore = 52;
  else if (effectiveStrictness >= 100) minPairScore = 70;

  // allowOverflow: relaxed mode permits soft overflow during redistribution
  const allowOverflow = effectiveStrictness <= 0 && isStrictnessEnabled;

  // 计算所有可能的配对分数，并为邀请关系加权
  const pairScores: { user1: UserWithProfile; user2: UserWithProfile; score: number; isInvited: boolean }[] = [];
  for (let i = 0; i < eligibleUsers.length; i++) {
    for (let j = i + 1; j < eligibleUsers.length; j++) {
      const user1 = eligibleUsers[i] as UserWithProfile;
      const user2 = eligibleUsers[j] as UserWithProfile;

      // Match Compass L1 dealbreaker filter (strictness < 50 only)
      if (isStrictnessEnabled && effectiveStrictness < 50) {
        if (!pairMeetsDealbreakers(user1, user2, effectiveStrictness)) {
          pairScores.push({ user1, user2, score: -1, isInvited: false });
          continue;
        }
      }

      let score = await calculatePairScore(
        user1,
        user2,
        interestsCache,
        pairScoreCache,
        semanticProfileCache,
        semanticSimilarityEnabled,
        chemistryCalibrationMap,
        formationWeights,
        matchHistoryLookup,
        matchNeverMeetSentinelEnabled,
        useWeightProfileV2,
        derivedChemistryEnabled,
      );

      // Check if this pair has an invitation relationship
      const isInvited = invitationPairs.some(pair =>
        (pair.inviterId === user1.userId && pair.inviteeId === user2.userId) ||
        (pair.inviterId === user2.userId && pair.inviteeId === user1.userId)
      );

      // Boost score for invited pairs (soft constraint)
      if (isInvited) {
        score = Math.min(100, score + 20); // Add 20 points bonus
      }

      pairScores.push({
        user1,
        user2,
        score,
        isInvited
      });
    }
  }

  // 按分数降序排序（邀请关系会自动排在前面因为有加分）
  pairScores.sort((a, b) => b.score - a.score);

  // ── 磁场引擎 惊艳开局包 (P1) group-composition rules ──
  // R2 pool-level exemption, computed once per run: when NO eligible user is
  // an energizer, R2 can never pass — skip the rule instead of rejecting
  // every group. Forced false when the flag is off (rule inert).
  const poolHasEnergizer =
    magnetismGroupRulesEnabled &&
    eligibleUsers.some(u => userArchetypeEnergy(u) >= MAGNETISM_ENERGIZER_THRESHOLD);

  // Item 5 composition gates: pool-level spark arithmetic, computed ONCE per
  // run. Bidirectional exemption (deficit AND surplus) — see
  // computeSparkPoolState. Forced null when the flag is off (gates inert).
  const sparkPoolState = compositionGatesEnabled
    ? computeSparkPoolState(
        eligibleUsers,
        pool.targetGroups ?? Math.ceil(eligibleUsers.length / maxGroupSize),
      )
    : null;
  if (sparkPoolState) {
    logger.info("[Pool Matching] composition gates active", {
      poolId: poolIdForLog,
      sparkCount: sparkPoolState.sparkCount,
      expectedGroups: sparkPoolState.expectedGroups,
      deficitExempt: sparkPoolState.deficitExempt,
      surplusExempt: sparkPoolState.surplusExempt,
    });
  }

  // W2 table-viability floor: R1/R2 are active when either the dedicated
  // default-on flag is set OR the item5 composition gates are on (the harness
  // `--composition-gates=on` arm drives W2 through the latter). Pool-level
  // energizer arithmetic is computed ONCE per run; the R1 no-deadlock
  // exemption is resolved after `getR1PairScore` below.
  const tableViabilityActive = tableViabilityFloorEnabled || compositionGatesEnabled;
  const energizerPoolState = tableViabilityActive
    ? computeEnergizerPoolState(
        eligibleUsers,
        pool.targetGroups ?? Math.ceil(eligibleUsers.length / maxGroupSize),
      )
    : null;
  const energizerDeficitExempt = energizerPoolState?.energizerDeficitExempt ?? false;
  if (energizerPoolState) {
    logger.info("[Pool Matching] table-viability floor active", {
      poolId: poolIdForLog,
      energizerCount: energizerPoolState.energizerCount,
      expectedGroups: energizerPoolState.expectedGroups,
      energizerDeficitExempt,
    });
  }

  // W6-F (gm-debrief follow-up): once-per-run observability for the bounded
  // X-variance dispersion nudge (inert whenever members lack complete vectors).
  if (xVarianceDispersionEnabled) {
    logger.info("[Pool Matching] X-variance dispersion nudge active", {
      poolId: poolIdForLog,
      target: XVAR_DISPERSION_TARGET,
    });
  }

  // R1 pair-score lookup: served from the precomputed cache (every eligible
  // pair was scored above). A cache miss should not happen; fall back to
  // calculatePairScore defensively (it re-caches) rather than crashing.
  const getCachedPairScore = (user1: UserWithProfile, user2: UserWithProfile): Promise<number> => {
    const cached = pairScoreCache.get(
      pairScoreCacheKey(user1.userId, user2.userId, semanticSimilarityEnabled, formationWeights, useWeightProfileV2),
    );
    if (cached !== undefined) return Promise.resolve(cached);
    return calculatePairScore(
      user1,
      user2,
      interestsCache,
      pairScoreCache,
      semanticProfileCache,
      semanticSimilarityEnabled,
      chemistryCalibrationMap,
      formationWeights,
      matchHistoryLookup,
      matchNeverMeetSentinelEnabled,
      useWeightProfileV2,
      derivedChemistryEnabled,
    );
  };

  // [DUO] R1 无孤立者 for duo members: the duo-internal pair never counts as a
  // strong tie — each duo member must satisfy R1 against the REST of the group
  // individually. Inert when the pool has no duos.
  const getR1PairScore = duoInternalPairKeys.size === 0
    ? getCachedPairScore
    : async (user1: UserWithProfile, user2: UserWithProfile): Promise<number> =>
        isDuoInternalPair(user1.userId, user2.userId) ? -1 : getCachedPairScore(user1, user2);

  // W2 table-viability floor: R1 pool-level no-deadlock exemption. When NO pair
  // of eligible users reaches the strong-tie threshold, R1 is unsatisfiable for
  // every possible group — enforcing it would strand the entire pool. Computed
  // once (short-circuits on the first strong tie) and only when W2 is active.
  let strongTieDeficitExempt = false;
  if (tableViabilityActive) {
    strongTieDeficitExempt = true;
    outer: for (let i = 0; i < eligibleUsers.length; i++) {
      for (let j = i + 1; j < eligibleUsers.length; j++) {
        if ((await getR1PairScore(eligibleUsers[i] as UserWithProfile, eligibleUsers[j] as UserWithProfile)) >= MAGNETISM_STRONG_TIE_THRESHOLD) {
          strongTieDeficitExempt = false;
          break outer;
        }
      }
    }
  }

  // [DUO] Count distinct duo units already inside a forming group (a unit =
  // both partners present). Used for the MAX 1 duo per group admission cap.
  const countDuoUnits = (members: UserWithProfile[]): number => {
    if (duoPartnerOf.size === 0) return 0;
    const memberIds = new Set(members.map((m) => m.userId));
    let units = 0;
    const seen = new Set<string>();
    for (const id of memberIds) {
      const partnerId = duoPartnerOf.get(id);
      if (partnerId && memberIds.has(partnerId) && !seen.has(id) && !seen.has(partnerId)) {
        units++;
        seen.add(id);
        seen.add(partnerId);
      }
    }
    return units;
  };

  // 贪婪组建小组
  for (const pair of pairScores) {
    if (used.has(pair.user1.userId) || used.has(pair.user2.userId)) continue;

    // 以这对高分用户为核心，找到其他合适的成员
    const groupMembers = [pair.user1, pair.user2];
    used.add(pair.user1.userId);
    used.add(pair.user2.userId);

    // [DUO] Atomic seed: if a seed member belongs to a duo, the partner is
    // force-included in the SAME group. The seed is abandoned (BOTH members
    // stay unmatched together) when the partner cannot fit (capacity), or when
    // the seed pair links members of TWO different duos — MAX 1 duo per group
    // holds from the very first seat.
    let duoSeedFits = true;
    if (duoPartnerOf.size > 0) {
      for (const seedMember of [pair.user1, pair.user2]) {
        const partnerId = duoPartnerOf.get(seedMember.userId);
        if (!partnerId || used.has(partnerId)) continue;
        if (countDuoUnits(groupMembers) >= 1) { // duo cap at seed time
          duoSeedFits = false;
          break;
        }
        const partner = eligibleUsers.find((u) => u.userId === partnerId);
        if (partner && groupMembers.length < maxGroupSize) {
          groupMembers.push(partner);
          used.add(partner.userId);
        } else {
          duoSeedFits = false;
        }
      }
    }
    if (!duoSeedFits) {
      groupMembers.forEach((m) => used.delete(m.userId));
      continue;
    }

    // Item 5 gate (i) seed feasibility: a group containing a member whose
    // reported E is below the stability floor can NEVER pass the commit gate
    // (min-E cannot recover by adding members — non-monotonic, one-way). Such
    // a member is unmatchable under the gate by construction; skipping the
    // doomed seed strands ONLY that member (the gate's mandatory fallback:
    // stay unmatched, never force-place) and saves the groupmates from a
    // guaranteed commit-gate rejection cycle. Cold-start members (no complete
    // vector) are never skipped here — gates skip them instead (AC-5.1b).
    // [DUO] a duo partner below the floor dooms the unit: both partners stay
    // unmatched together (atomic-unit semantics preserved).
    if (compositionGatesEnabled &&
        groupMembers.some((m) => hasCompleteTraitVector(m) && (m.traitScores!.E as number) < COMPOSITION_MIN_E_FLOOR)) {
      groupMembers.forEach((m) => used.delete(m.userId));
      continue;
    }

    // 继续添加成员直到达到目标人数
    while (groupMembers.length < targetGroupSize) {
      let bestCandidate: UserWithProfile | null = null;
      // [DUO] When the best candidate belongs to a duo, its partner is admitted
      // in the same step (atomic unit occupying 2 seats).
      let bestCandidatePartner: UserWithProfile | null = null;
      let bestScore = 0;
      // True pair-score average of bestCandidate (pre-R4 nudge) — the admission
      // gate uses this, never the ranking-adjusted score.
      let bestAvgScore = 0;

      for (const candidate of eligibleUsers as UserWithProfile[]) {
        if (used.has(candidate.userId)) continue;

        // [DUO] Resolve the candidate's duo partner and enforce the admission
        // guards at the same hook point as the capacity check:
        //   - MAX 1 duo per group (group already contains a duo unit)
        //   - atomic capacity: the unit needs 2 seats
        //   - partner must be available (unused)
        let candidatePartner: UserWithProfile | null = null;
        if (duoPartnerOf.size > 0) {
          const partnerId = duoPartnerOf.get(candidate.userId);
          if (partnerId) {
            if (countDuoUnits(groupMembers) >= 1) continue; // duo cap
            if (groupMembers.length + 2 > maxGroupSize) continue; // unit needs 2 seats
            const partner = eligibleUsers.find((u) => u.userId === partnerId);
            if (!partner || used.has(partner.userId)) continue;
            candidatePartner = partner;
          }
        }

        // Item 5 gate (i) admission feasibility (flag-gated): a sub-floor-E
        // member can never be committed (the commit gate would reject the
        // group), so block admission fail-fast instead of churning the group
        // through a guaranteed rejection. Same semantics, zero churn; the
        // member stays unmatched (the gate's mandatory fallback). [DUO] the
        // check covers the partner — a sub-floor-E partner blocks the unit,
        // never splits it. Cold-start members are never blocked (gates skip).
        if (compositionGatesEnabled) {
          const unit = candidatePartner ? [candidate, candidatePartner] : [candidate];
          if (unit.some((m) => hasCompleteTraitVector(m) && (m.traitScores!.E as number) < COMPOSITION_MIN_E_FLOOR)) {
            continue;
          }
        }

        // Match Compass: apply dealbreakers during group expansion too (strictness < 50)
        // [DUO] the partner must independently pass dealbreakers vs the group.
        if (isStrictnessEnabled && effectiveStrictness < 50) {
          let passesDealbreakers = true;
          for (const unitMember of candidatePartner ? [candidate, candidatePartner] : [candidate]) {
            for (const member of groupMembers) {
              if (!pairMeetsDealbreakers(unitMember, member, effectiveStrictness)) {
                passesDealbreakers = false;
                break;
              }
            }
            if (!passesDealbreakers) break;
          }
          if (!passesDealbreakers) continue;
        }

        // 计算候选人与当前小组成员的平均分数 (uses cached pair scores)
        const scoreAgainstGroup = async (user: UserWithProfile): Promise<number> => {
          let totalScore = 0;
          for (const member of groupMembers) {
            totalScore += await calculatePairScore(
              user,
              member,
              interestsCache,
              pairScoreCache,
              semanticProfileCache,
              semanticSimilarityEnabled,
              chemistryCalibrationMap,
              formationWeights,
              matchHistoryLookup,
              matchNeverMeetSentinelEnabled,
              useWeightProfileV2,
              derivedChemistryEnabled,
            );
          }
          return totalScore / groupMembers.length;
        };

        // [DUO] Unit-to-group score = mean of BOTH duo members' averages
        // (mean of both directions); solo candidates keep the legacy average.
        const candidateAvg = await scoreAgainstGroup(candidate);
        const avgScore = candidatePartner
          ? (candidateAvg + (await scoreAgainstGroup(candidatePartner))) / 2
          : candidateAvg;

        // R4 新奇分散 (flag-gated): an explore-intent candidate is nudged down
        // in the ranking when the forming group already has an explorer. The
        // adjustment affects ONLY the argmax — cached pair scores are never
        // mutated and the admission gate below still uses the true avgScore
        // (nudge, not ban).
        let rankingScore = magnetismGroupRulesEnabled
          ? adjustScoreForNoveltyDispersion(candidate, groupMembers, avgScore)
          : avgScore;
        // Item 5 composition-gate steering (flag-gated): same argmax-only
        // nudge pattern as R4 — spreads sparks across groups, steers sub-floor
        // E/A and X-variance-breaking admissions. [DUO] the duo partner's
        // traits count toward the unit's effects (never splits a duo).
        if (compositionGatesEnabled && sparkPoolState) {
          rankingScore = adjustScoreForCompositionGates(candidate, candidatePartner, groupMembers, rankingScore, sparkPoolState);
        }
        // W6-F (gm-debrief follow-up): bounded X-variance dispersion nudge —
        // restores the trait-X cohesion diluted by AC-W6.4's interest
        // re-weighting. Ranking-only (argmax), same pattern as R4 above.
        if (xVarianceDispersionEnabled) {
          rankingScore = adjustScoreForXVarianceDispersion(candidate, candidatePartner, groupMembers, rankingScore);
        }

        if (rankingScore > bestScore) {
          bestScore = rankingScore;
          bestAvgScore = avgScore;
          bestCandidate = candidate;
          bestCandidatePartner = candidatePartner;
        }
      }

      if (bestCandidate && bestAvgScore >= minPairScore) { // 最低质量门槛（Match Compass可调节）
        groupMembers.push(bestCandidate);
        used.add(bestCandidate.userId);
        // [DUO] Atomic admission: partner joins in the same step — a duo can
        // never be split across groups by the greedy loop.
        if (bestCandidatePartner) {
          groupMembers.push(bestCandidatePartner);
          used.add(bestCandidatePartner.userId);
        }
      } else {
        break; // 没有合适的候选人
      }
    }

    // D3/D4: commit-time gender floor check (hard mode only) — authoritative.
    // Floors are per-group and non-monotonic (a partial [M,M] group violates
    // minFemaleCount=2 at size 2 yet becomes valid at size 4), so the check
    // runs only on the FINAL composition, never mid-loop.
    const genderFloorSatisfied =
      !hardFloorActive || groupSatisfiesGenderFloor(groupMembers, minFemaleCount, minMaleCount);
    if (!genderFloorSatisfied) {
      // AC-10(c): floor rejections at debug level to avoid log spam at scale.
      logger.debug("[Pool Matching] group rejected by gender floor at commit gate", {
        poolId: poolIdForLog,
        memberCount: groupMembers.length,
        ...countDisclosedGenders(groupMembers),
        minFemaleCount,
        minMaleCount,
      });
    }

    // 磁场引擎 惊艳开局包 (P1) commit gates — R1 无孤立者 / R2 能量编排 / R3 话题锚点.
    // Evaluated only for groups that would otherwise commit (size + gender floor
    // pass); rejections fall through to the existing release path below.
    let magnetismRulesSatisfied = true;
    if (magnetismGroupRulesEnabled && groupMembers.length >= minGroupSize && genderFloorSatisfied) {
      // [DUO] R1 uses getR1PairScore so the duo-internal pair never counts as
      // a strong tie — each duo member individually needs a non-duo strong tie.
      const strongTieSatisfied = await groupSatisfiesStrongTieRule(groupMembers, getR1PairScore);
      // R2 is skipped entirely when the pool has no energizer (see above).
      const energizerSatisfied = !poolHasEnergizer || groupHasEnergizer(groupMembers);
      const topicAnchorSatisfied = groupHasTopicAnchor(groupMembers, interestsCache);
      magnetismRulesSatisfied = strongTieSatisfied && energizerSatisfied && topicAnchorSatisfied;
      if (!magnetismRulesSatisfied) {
        logger.info("[Pool Matching] group rejected by magnetism group rules", {
          poolId: poolIdForLog,
          memberCount: groupMembers.length,
          strongTieSatisfied,
          energizerSatisfied,
          topicAnchorSatisfied,
        });
      }
    }

    // Item 5 composition gates — commit-gate backstop (reject BEFORE commit;
    // rejections fall through to the existing release path below, so rejected
    // members recombine into later candidate groups and [DUO] partners are
    // always released together — a gate can never split an atomic unit).
    let compositionGatesSatisfied = true;
    if (compositionGatesEnabled && sparkPoolState && groupMembers.length >= minGroupSize && genderFloorSatisfied) {
      const gateResult = evaluateCompositionGates(groupMembers, sparkPoolState);
      compositionGatesSatisfied = gateResult.satisfied;
      if (!gateResult.satisfied) {
        recordCompositionGateRejection(compositionGateStats, "commitRejections", gateResult);
        logger.info("[Pool Matching] group rejected by composition gates", {
          poolId: poolIdForLog,
          memberCount: groupMembers.length,
          minEFloorSatisfied: gateResult.minEFloorSatisfied,
          meanAFloorSatisfied: gateResult.meanAFloorSatisfied,
          sparkRuleSatisfied: gateResult.sparkRuleSatisfied,
          xVarianceCapSatisfied: gateResult.xVarianceCapSatisfied,
        });
      }
    }

    // W2 table-viability floor — commit-gate backstop (R1 无孤立者 + R2 能量编排).
    // Reject BEFORE commit; rejections fall through to the existing release path
    // below so rejected members recombine and [DUO] partners release together.
    // Evaluated only for groups that would otherwise commit (size + gender floor).
    let tableViabilitySatisfied = true;
    if (tableViabilityActive && groupMembers.length >= minGroupSize && genderFloorSatisfied) {
      const noIsolateSatisfied = strongTieDeficitExempt ||
        (await groupSatisfiesStrongTieRule(groupMembers, getR1PairScore));
      const energizerSatisfied = groupSatisfiesEnergizerRule(groupMembers, energizerDeficitExempt);
      tableViabilitySatisfied = noIsolateSatisfied && energizerSatisfied;
      if (!tableViabilitySatisfied) {
        recordTableViabilityRejection(compositionGateStats, "commitRejections", noIsolateSatisfied, energizerSatisfied);
        logger.info("[Pool Matching] group rejected by table-viability floor", {
          poolId: poolIdForLog,
          memberCount: groupMembers.length,
          noIsolateSatisfied,
          energizerSatisfied,
        });
      }
    }

    // W6 (AC-W6.6c) anti-clique novelty: a group cannot seat more than the
    // allowed number of repeat-likes. Inert when the flag is off or no lookup
    // was supplied (cold-start / simulation).
    let rematchNoveltySatisfied = true;
    if (matchHistoryNoveltyEnabled && groupMembers.length >= minGroupSize && genderFloorSatisfied) {
      rematchNoveltySatisfied = groupSatisfiesRematchNoveltyRule(
        groupMembers.map((m) => m.userId),
        matchHistoryLookup,
      );
      if (!rematchNoveltySatisfied) {
        logger.info("[Pool Matching] group rejected by match-history novelty rule", {
          poolId: poolIdForLog,
          memberCount: groupMembers.length,
        });
      }
    }

    // 只保留达到最小人数且满足性别下限的小组
    if (groupMembers.length >= minGroupSize && genderFloorSatisfied && magnetismRulesSatisfied && compositionGatesSatisfied && tableViabilitySatisfied && rematchNoveltySatisfied) {
      const avgPairScore = await calculateGroupPairScore(
        groupMembers,
        interestsCache,
        pairScoreCache,
        semanticProfileCache,
        semanticSimilarityEnabled,
        chemistryCalibrationMap,
        formationWeights,
        matchHistoryLookup,
        matchNeverMeetSentinelEnabled,
        useWeightProfileV2,
        // [DUO] duo-internal pair excluded from group quality metrics
        duoQualityExclusions,
        derivedChemistryEnabled,
      );
      // E: Compute true chemistry-only average (distinct from avgPairScore)
      const avgChemistryScore = calculateGroupChemistryScore(groupMembers, chemistryCalibrationMap, duoQualityExclusions, derivedChemistryEnabled);
      const diversity = calculateGroupDiversity(groupMembers, genderBalanceMode, genderBalanceBonusPoints);
      const communicationBalance = calculateEnergyBalance(groupMembers);
      const overall = Math.round((avgPairScore * 0.6) + (diversity * 0.25) + (communicationBalance * 0.15));
      const temperatureLevel = getTemperatureLevel(overall);

      const group: MatchGroup = {
        members: groupMembers,
        avgPairScore: avgPairScore,
        avgChemistryScore: avgChemistryScore,
        diversityScore: diversity,
        communicationBalance: communicationBalance,
        overallScore: overall,
        temperatureLevel: temperatureLevel,
        explanation: ""
      };

      group.explanation = generateGroupExplanation(group);
      groups.push(group);
    } else {
      // 释放这些成员，允许他们加入其他组
      groupMembers.forEach(m => used.delete(m.userId));
    }

    // 达到目标组数就停止
    if (groups.length >= (pool.targetGroups || 1)) {
      break;
    }
  }

  // 磁场引擎 惊艳开局包 (P1): R1/R2/R3 are commit gates in the greedy loop,
  // but the H4 redistribution pass below also changes final group composition
  // (absorption adds members, Phase 2 forms whole groups). Those paths must
  // respect the same rules — otherwise an absorbed or remainder member could
  // be stranded with no strong tie. Inert when both flags are off (returns
  // true), so default redistribution behavior is unchanged.
  const magnetismRulesSatisfiedFor = async (members: UserWithProfile[]): Promise<boolean> => {
    if (
      !magnetismGroupRulesEnabled &&
      !compositionGatesEnabled &&
      !tableViabilityFloorEnabled &&
      !matchHistoryNoveltyEnabled
    ) {
      return true;
    }
    let strongTieSatisfied = true;
    let energizerSatisfied = true;
    let topicAnchorSatisfied = true;
    if (magnetismGroupRulesEnabled) {
      // [DUO] R1 excludes duo-internal ties (same wrapper as the commit gate).
      strongTieSatisfied = await groupSatisfiesStrongTieRule(members, getR1PairScore);
      energizerSatisfied = !poolHasEnergizer || groupHasEnergizer(members);
      topicAnchorSatisfied = groupHasTopicAnchor(members, interestsCache);
    }
    // AC-5.2: NONE of the four Item-5 composition gates is monotonic under
    // member addition (min-E/mean-A can DROP, X-variance and spark-count can
    // BREAK), so they MUST be re-evaluated here — H4 absorption and Phase-2
    // whole-group formation both change final group composition. The old
    // "R2 is monotonic under absorption" assumption covers only the
    // archetype-level R2 energizer rule, not these trait-level gates.
    let compositionSatisfied = true;
    let compositionResult: CompositionGateEvaluation | null = null;
    if (compositionGatesEnabled && sparkPoolState) {
      compositionResult = evaluateCompositionGates(members, sparkPoolState);
      compositionSatisfied = compositionResult.satisfied;
      if (!compositionSatisfied) {
        recordCompositionGateRejection(compositionGateStats, "redistributionRejections", compositionResult);
      }
    }
    // W2 table-viability floor (AC-W2.2 / AC-W2.3): R1/R2 must hold on EVERY
    // redistribution candidate — Phase 1 absorption, Phase 2 whole-remainder
    // formation, and Phase 3 overflow absorption all route through here. The
    // pool-level exemptions are fixed once per run (no deadlock), but the
    // per-group predicates are re-evaluated for the changed composition.
    let tableViabilitySatisfied = true;
    let noIsolateSatisfied = true;
    let tableEnergizerSatisfied = true;
    if (tableViabilityActive) {
      noIsolateSatisfied = strongTieDeficitExempt ||
        (await groupSatisfiesStrongTieRule(members, getR1PairScore));
      tableEnergizerSatisfied = groupSatisfiesEnergizerRule(members, energizerDeficitExempt);
      tableViabilitySatisfied = noIsolateSatisfied && tableEnergizerSatisfied;
      if (!tableViabilitySatisfied) {
        recordTableViabilityRejection(compositionGateStats, "redistributionRejections", noIsolateSatisfied, tableEnergizerSatisfied);
      }
    }
    // W6 (AC-W6.6c) anti-clique novelty must also be re-evaluated on every
    // redistribution candidate (absorption changes the repeat-pair count).
    let rematchNoveltySatisfied = true;
    if (matchHistoryNoveltyEnabled) {
      rematchNoveltySatisfied = groupSatisfiesRematchNoveltyRule(
        members.map((m) => m.userId),
        matchHistoryLookup,
      );
    }
    if (!strongTieSatisfied || !energizerSatisfied || !topicAnchorSatisfied || !compositionSatisfied || !tableViabilitySatisfied || !rematchNoveltySatisfied) {
      logger.info("[Pool Matching] redistribution candidate rejected by group composition rules", {
        poolId: poolIdForLog,
        memberCount: members.length,
        strongTieSatisfied,
        energizerSatisfied,
        topicAnchorSatisfied,
        compositionSatisfied,
        tableViabilitySatisfied,
        noIsolateSatisfied,
        tableEnergizerSatisfied,
        rematchNoveltySatisfied,
        ...(compositionResult && !compositionResult.satisfied
          ? {
              minEFloorSatisfied: compositionResult.minEFloorSatisfied,
              meanAFloorSatisfied: compositionResult.meanAFloorSatisfied,
              sparkRuleSatisfied: compositionResult.sparkRuleSatisfied,
              xVarianceCapSatisfied: compositionResult.xVarianceCapSatisfied,
            }
          : {}),
      });
    }
    return strongTieSatisfied && energizerSatisfied && topicAnchorSatisfied && compositionSatisfied && tableViabilitySatisfied && rematchNoveltySatisfied;
  };

  // H4: Redistribution pass for stranded users (behind adaptive-weights or Match Compass relaxed flag)
  // Only run when adaptive weights are explicitly enabled or allowOverflow is true — this is an experimental
  // quality-of-life improvement that needs real-world calibration.
  // Match Compass formation weights (strictness != 50) do NOT trigger redistribution,
  // because strict mode should not force-form low-quality groups.
  // W2 (AC-W2.3): when the table-viability floor is active, the odd-roster
  // absorption pass ALWAYS runs — decoupled from the adaptive-weights /
  // allowOverflow gate. This is what keeps the floor's unmatched-rate delta
  // within budget: gate-rejected 1–3 stranded members are absorbed into an
  // existing group up to maxGroupSize+1 (R1/R2 re-evaluated) before they are
  // finally left unmatched.
  //
  // Phase 2 (whole-remainder formation) stays gated to the LEGACY redistribution
  // trigger: it forms ONE group from the entire stranded set with no
  // maxGroupSize cap, so running it under W2 could commit an 8–9-seat table
  // that violates the size contract (simulate:groups pool#37/#352/#364). W2's
  // contract is bounded absorption, not whole-remainder re-formation.
  const legacyRedistributionEnabled = hasExplicitCustomWeights || allowOverflow;
  // W2 (AC-W2.3) overflow bound: when the table-viability floor drives this
  // pass, absorption is capped at maxGroupSize+1 EVEN under Match-Compass
  // relaxed `allowOverflow` (strictness ≤ 0). Without this, the `!allowOverflow`
  // skip guards below are inert and a single group can absorb every stranded
  // member without bound — violating the documented AC-W2.3 contract (bounded
  // odd-roster absorption of 1–3 stranded users). Legacy (non-W2)
  // redistribution keeps its historical unbounded-overflow behavior for
  // allowOverflow / customWeights pools. M9/M10 are measured at strictness 50
  // (allowOverflow=false), so this branch is inert for both Monte-Carlo arms.
  const w2BoundedOverflow = tableViabilityActive && allowOverflow;
  if (legacyRedistributionEnabled || tableViabilityActive) {
    const strandedUsers = eligibleUsers.filter(u => !used.has(u.userId));

    if (strandedUsers.length > 0) {
      logger.info(`[Pool Matching] Redistribution pass: ${strandedUsers.length} stranded users`);

      // Phase 1: Try to place each stranded user into the best existing group
      // that has room (below maxGroupSize).
      for (const stranded of strandedUsers) {
        // [DUO] FALLBACK (variant A): duo members are never absorbed solo —
        // placing one without the partner would split the atomic unit. Both
        // stay unmatched together (顺延 pipeline).
        if (duoPartnerOf.has(stranded.userId)) continue;
        let bestGroup: MatchGroup | null = null;
        let bestScore = -1;

        for (const group of groups) {
          if (group.members.length >= maxGroupSize && !allowOverflow) continue;
          // W2 bounded overflow: stop growing a group once it reaches maxGroupSize+1.
          if (w2BoundedOverflow && group.members.length >= maxGroupSize + 1) continue;

          let totalScore = 0;
          for (const member of group.members) {
            totalScore += await calculatePairScore(
              stranded,
              member,
              interestsCache,
              pairScoreCache,
              semanticProfileCache,
              semanticSimilarityEnabled,
              chemistryCalibrationMap,
              formationWeights,
              matchHistoryLookup,
              matchNeverMeetSentinelEnabled,
              useWeightProfileV2,
              derivedChemistryEnabled,
            );
          }
          const avgScore = totalScore / group.members.length;

          if (avgScore > bestScore) {
            bestScore = avgScore;
            bestGroup = group;
          }
        }

        if (bestGroup && bestScore >= 50) {
          // D6 Phase-1 defensive floor check: under commit-time floors gender
          // counts only grow, so this can only fail if a group was committed in
          // violation (should never happen) — defense-in-depth.
          if (hardFloorActive && !groupSatisfiesGenderFloor([...bestGroup.members, stranded], minFemaleCount, minMaleCount)) {
            logger.debug("[Pool Matching] H4 phase-1 absorption blocked by gender floor", {
              poolId: poolIdForLog,
              strandedUserId: stranded.userId,
              groupSize: bestGroup.members.length,
              minFemaleCount,
              minMaleCount,
            });
            continue;
          }
          // 磁场引擎 (P1): absorption must not break the commit rules — an
          // absorbed member still needs a strong tie (R1) and the group must
          // keep its topic anchor (R3). (Only the archetype-level R2 is
          // monotonic under absorption; the Item-5 trait-level composition
          // gates are NOT — they are re-evaluated inside
          // magnetismRulesSatisfiedFor, AC-5.2.)
          if (!(await magnetismRulesSatisfiedFor([...bestGroup.members, stranded]))) {
            continue;
          }
          bestGroup.members.push(stranded);
          used.add(stranded.userId);
          // Recalculate group stats
          bestGroup.avgPairScore = await calculateGroupPairScore(
            bestGroup.members,
            interestsCache,
            pairScoreCache,
            semanticProfileCache,
            semanticSimilarityEnabled,
            chemistryCalibrationMap,
            formationWeights,
            matchHistoryLookup,
            matchNeverMeetSentinelEnabled,
            useWeightProfileV2,
            duoQualityExclusions,
            derivedChemistryEnabled,
          );
          bestGroup.avgChemistryScore = calculateGroupChemistryScore(bestGroup.members, chemistryCalibrationMap, duoQualityExclusions, derivedChemistryEnabled);
          bestGroup.diversityScore = calculateGroupDiversity(bestGroup.members, genderBalanceMode, genderBalanceBonusPoints);
          bestGroup.communicationBalance = calculateEnergyBalance(bestGroup.members);
          bestGroup.overallScore = Math.round(
            (bestGroup.avgPairScore * 0.6) +
            (bestGroup.diversityScore * 0.25) +
            (bestGroup.communicationBalance * 0.15)
          );
          bestGroup.temperatureLevel = getTemperatureLevel(bestGroup.overallScore);
          bestGroup.explanation = generateGroupExplanation(bestGroup);
        }
      }

      // Phase 2: If there are still stranded users, try to form a new group
      // from the remainders (only if enough to meet minGroupSize). Legacy
      // redistribution only — see the W2 note above (no maxGroupSize cap).
      let stillStranded = eligibleUsers.filter(u => !used.has(u.userId));
      // [DUO] MAX 1 duo per group also caps remainder groups: a remainder set
      // containing 2+ duo units is not formed (all stay unmatched, 顺延).
      const phase2DuoCapSatisfied = countDuoUnits(stillStranded) <= 1;
      if (!phase2DuoCapSatisfied) {
        logger.info("[Pool Matching] H4 phase-2 remainder group blocked by duo cap", {
          poolId: poolIdForLog,
          memberCount: stillStranded.length,
          duoUnits: countDuoUnits(stillStranded),
        });
      }
      // W2 (AC-W2.3) whole-remainder bound: Phase 2 forms ONE group from the
      // ENTIRE remainder, so under the table-viability floor it must not
      // produce a table larger than maxGroupSize+1. When `legacyRedistribution
      // Enabled` is true only because `allowOverflow` relaxed Match Compass
      // (customWeights absent), W2 is default-on in production — without this
      // bound an all-stranded pool (initial greedy committed nothing) would
      // form an unbounded 8–9-seat table via Phase 2, the exact contract
      // violation this pass must prevent. Remainders within the bound still
      // form normally; larger remainders stay unmatched.
      const phase2WithinW2Bound = !tableViabilityActive || stillStranded.length <= maxGroupSize + 1;
      if (legacyRedistributionEnabled && stillStranded.length >= minGroupSize && phase2DuoCapSatisfied && phase2WithinW2Bound) {
        // D6 Phase-2 floor check: a remainder group that cannot satisfy the
        // hard-mode floor is NOT formed — members stay unmatched (per D2).
        const phase2FloorSatisfied =
          !hardFloorActive || groupSatisfiesGenderFloor(stillStranded, minFemaleCount, minMaleCount);
        if (!phase2FloorSatisfied) {
          // Floor-blocked: skip BOTH the push and the used-marking below so
          // Phase-3 absorption can still place these members into existing
          // floor-satisfying groups (Verifier implementation note).
          logger.debug("[Pool Matching] H4 phase-2 remainder group blocked by gender floor", {
            poolId: poolIdForLog,
            memberCount: stillStranded.length,
            ...countDisclosedGenders(stillStranded),
            minFemaleCount,
            minMaleCount,
          });
        } else if (await magnetismRulesSatisfiedFor(stillStranded)) {
          const avgPairScore = await calculateGroupPairScore(
            stillStranded,
            interestsCache,
            pairScoreCache,
            semanticProfileCache,
            semanticSimilarityEnabled,
            chemistryCalibrationMap,
            formationWeights,
            matchHistoryLookup,
            matchNeverMeetSentinelEnabled,
            useWeightProfileV2,
            duoQualityExclusions,
            derivedChemistryEnabled,
          );
          const avgChemistryScore = calculateGroupChemistryScore(stillStranded, chemistryCalibrationMap, duoQualityExclusions, derivedChemistryEnabled);
          const diversity = calculateGroupDiversity(stillStranded, genderBalanceMode, genderBalanceBonusPoints);
          const communicationBalance = calculateEnergyBalance(stillStranded);
          const overall = Math.round((avgPairScore * 0.6) + (diversity * 0.25) + (communicationBalance * 0.15));
          const temperatureLevel = getTemperatureLevel(overall);

          const newGroup: MatchGroup = {
            members: stillStranded,
            avgPairScore,
            avgChemistryScore,
            diversityScore: diversity,
            communicationBalance,
            overallScore: overall,
            temperatureLevel,
            explanation: "",
          };
          newGroup.explanation = generateGroupExplanation(newGroup);
          groups.push(newGroup);
          stillStranded.forEach(u => used.add(u.userId));
          logger.info(`[Pool Matching] Formed remainder group with ${stillStranded.length} users`);
        } else {
          // 磁场引擎 (P1): remainder group did not pass commit rules — members
          // stay unmatched here so Phase-3 absorption can still place them into
          // compliant existing groups (Rule-gated under the flag only).
          logger.info("[Pool Matching] H4 phase-2 remainder group rejected by magnetism group rules", {
            poolId: poolIdForLog,
            memberCount: stillStranded.length,
          });
        }
      }

      // Phase 3: Absorption — if stranded users remain after Phase 1+2,
      // allow any existing group to exceed maxGroupSize by 1 (soft overflow)
      // so long as the candidate scores ≥ 50 with the group. Each group may
      // absorb at most one extra member because the skip condition becomes
      // active once length > maxGroupSize. This is gated by adaptive weights
      // or Match Compass relaxed mode for safe calibration.
      // W2 (AC-W2.3): under the table-viability floor `w2BoundedOverflow` also
      // stops a group at maxGroupSize+1 even when allowOverflow relaxes the
      // legacy skip — see the bound note at `legacyRedistributionEnabled`.
      stillStranded = eligibleUsers.filter(u => !used.has(u.userId));
      if (stillStranded.length > 0 && stillStranded.length < minGroupSize) {
        for (const stranded of stillStranded) {
          // [DUO] FALLBACK (variant A): same no-solo-absorption rule as Phase 1.
          if (duoPartnerOf.has(stranded.userId)) continue;
          let bestGroup: MatchGroup | null = null;
          let bestScore = -1;

          for (const group of groups) {
            if (group.members.length > maxGroupSize && !allowOverflow) continue;
            // W2 bounded overflow: same maxGroupSize+1 cap as Phase 1.
            if (w2BoundedOverflow && group.members.length >= maxGroupSize + 1) continue;

            let totalScore = 0;
            for (const member of group.members) {
              totalScore += await calculatePairScore(
                stranded,
                member,
                interestsCache,
                pairScoreCache,
                semanticProfileCache,
                semanticSimilarityEnabled,
                chemistryCalibrationMap,
                formationWeights,
                matchHistoryLookup,
                matchNeverMeetSentinelEnabled,
                useWeightProfileV2,
                derivedChemistryEnabled,
              );
            }
            const avgScore = totalScore / group.members.length;

            if (avgScore > bestScore) {
              bestScore = avgScore;
              bestGroup = group;
            }
          }

          if (bestGroup && bestScore >= 50) {
            // D6 Phase-3 defensive floor check (same rationale as Phase 1 —
            // vacuous under commit-time floors, kept as defense-in-depth).
            if (hardFloorActive && !groupSatisfiesGenderFloor([...bestGroup.members, stranded], minFemaleCount, minMaleCount)) {
              logger.debug("[Pool Matching] H4 phase-3 absorption blocked by gender floor", {
                poolId: poolIdForLog,
                strandedUserId: stranded.userId,
                groupSize: bestGroup.members.length,
                minFemaleCount,
                minMaleCount,
              });
              continue;
            }
            // 磁场引擎 (P1): same rule gate as Phase-1 absorption — including
            // the non-monotonic Item-5 composition gates (AC-5.2).
            if (!(await magnetismRulesSatisfiedFor([...bestGroup.members, stranded]))) {
              continue;
            }
            bestGroup.members.push(stranded);
            used.add(stranded.userId);
            bestGroup.avgPairScore = await calculateGroupPairScore(
              bestGroup.members,
              interestsCache,
              pairScoreCache,
              semanticProfileCache,
              semanticSimilarityEnabled,
              chemistryCalibrationMap,
              formationWeights,
              matchHistoryLookup,
              matchNeverMeetSentinelEnabled,
              useWeightProfileV2,
              duoQualityExclusions,
              derivedChemistryEnabled,
            );
            bestGroup.avgChemistryScore = calculateGroupChemistryScore(bestGroup.members, chemistryCalibrationMap, duoQualityExclusions, derivedChemistryEnabled);
            bestGroup.diversityScore = calculateGroupDiversity(bestGroup.members, genderBalanceMode, genderBalanceBonusPoints);
            bestGroup.communicationBalance = calculateEnergyBalance(bestGroup.members);
            bestGroup.overallScore = Math.round(
              (bestGroup.avgPairScore * 0.6) +
              (bestGroup.diversityScore * 0.25) +
              (bestGroup.communicationBalance * 0.15)
            );
            bestGroup.temperatureLevel = getTemperatureLevel(bestGroup.overallScore);
            bestGroup.explanation = generateGroupExplanation(bestGroup);
          }
        }
      }

      stillStranded = eligibleUsers.filter(u => !used.has(u.userId));
      if (stillStranded.length > 0) {
        logger.info(`[Pool Matching] ${stillStranded.length} users remain unmatched after redistribution`);
      }
    }
  }

  // AC-10(b): post-match gender-balance summary — single info line per run,
  // computed from the formed groups without extra DB reads (OBS-02).
  if (genderBalanceMode !== "none") {
    logger.info("[Pool Matching] gender-balance summary", {
      poolId: poolIdForLog,
      mode: genderBalanceMode,
      groupsFormed: groups.length,
      groupsSatisfyingExactBalance: groups.filter((g) => groupHasExactGenderBalance(g.members)).length,
      groupsSatisfyingFloor: hardFloorActive
        ? groups.filter((g) => groupSatisfiesGenderFloor(g.members, minFemaleCount, minMaleCount)).length
        : groups.length,
    });
  }

  return groups;
}
