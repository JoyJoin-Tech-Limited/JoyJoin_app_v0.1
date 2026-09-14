/**
 * Monte Carlo group-formation harness — pool generation + read-only in-memory
 * matcher driver. Extracted verbatim from run-group-monte-carlo.ts.
 */
import {
  runGreedyPoolMatchingCore,
  computeSparkPoolState,
  type UserWithProfile,
  type MatchGroup,
  type UserInterestsCache,
  type CompositionSparkPoolState,
  type CompositionGateStats,
} from '../../../apps/server/src/poolMatchingService';
import { mulberry32, streamSeed } from './persona-utils';
import { SessionStore, type SessionArm, type SessionProduct } from './monte-carlo-sessions';
import type { SyntheticRespondent, SyntheticProfile } from './monte-carlo-population';
import {
  DUO_MEMBER_SHARE,
  MAX_GROUP_SIZE,
  MIN_GROUP_SIZE,
  POOL_SIZE_MAX,
  POOL_SIZE_MIN,
} from './monte-carlo-constants';

// ── Pool generation ──────────────────────────────────────────────────

interface PoolMember {
  respondent: SyntheticRespondent;
  profile: SyntheticProfile;
}

interface SyntheticPool {
  index: number;
  /** Replay seed: streamSeed(baseSeed, poolIndex, 'pool') drives this pool. */
  poolSeed: number;
  size: number;
  members: PoolMember[];
  duoPairs: Array<{ inviterId: string; inviteeId: string }>;
}

function generatePools(
  count: number,
  population: SyntheticRespondent[],
  profiles: SyntheticProfile[],
  seed: number
): SyntheticPool[] {
  const pools: SyntheticPool[] = [];
  for (let i = 0; i < count; i++) {
    const poolSeed = streamSeed(seed, i, 'pool');
    const rng = mulberry32(poolSeed);
    const size = POOL_SIZE_MIN + Math.floor(rng() * (POOL_SIZE_MAX - POOL_SIZE_MIN + 1));

    // Draw `size` distinct respondents (partial Fisher–Yates on the index space).
    const indices = population.map((_, idx) => idx);
    for (let k = 0; k < size; k++) {
      const j = k + Math.floor(rng() * (indices.length - k));
      [indices[k], indices[j]] = [indices[j], indices[k]];
    }
    const drawn = indices.slice(0, size);
    const members: PoolMember[] = drawn.map((idx) => ({
      respondent: population[idx],
      profile: profiles[idx],
    }));

    // Duo binding: first 2*duoCount drawn members are paired consecutively.
    const duoCount = Math.max(1, Math.floor((size * DUO_MEMBER_SHARE) / 2));
    const duoPairs: Array<{ inviterId: string; inviteeId: string }> = [];
    for (let d = 0; d < duoCount; d++) {
      duoPairs.push({
        inviterId: members[2 * d].respondent.id,
        inviteeId: members[2 * d + 1].respondent.id,
      });
    }

    pools.push({ index: i, poolSeed, size, members, duoPairs });
  }
  return pools;
}

// ── Matcher driver (read-only, in-memory) ────────────────────────────

interface RunResult {
  groups: MatchGroup[];
  unmatched: PoolMember[];
  /** userId → session product used for this arm (composition measurement input). */
  sessionByUserId: Map<string, SessionProduct>;
  /** Item 5 gate-on runs: the pool-level spark state the matcher computed
   *  (bidirectional exemption) — needed for exemption-aware M9 evaluation. */
  sparkPoolState: CompositionSparkPoolState | null;
}

function toUserWithProfile(member: PoolMember, session: SessionProduct): UserWithProfile {
  const { respondent, profile } = member;
  return {
    userId: respondent.id,
    registrationId: `reg-${respondent.id}`,
    gender: profile.gender,
    birthdate: profile.birthdate,
    industryNiche: profile.industryNiche,
    industryNicheLabel: profile.industryNicheLabel,
    industryCategoryLabel: profile.industryCategoryLabel,
    educationLevel: profile.educationLevel,
    archetype: session.archetype,
    secondaryArchetype: session.secondaryArchetype,
    lifeStage: profile.lifeStage,
    workMode: null,
    hometown: null,
    hometownAffinityOptin: false,
    budgetRange: null,
    barBudgetRange: null,
    preferredLanguages: profile.preferredLanguages,
    eventIntent: profile.eventIntent,
    userIntent: null,
    cuisinePreferences: null,
    dietaryRestrictions: null,
    barThemes: null,
    alcoholComfort: null,
    eventType: '饭局',
    ageMatchPreference: null,
    tableVibePreference: null,
    preferenceStrictness: null,
    genderCompositionPreference: null,
    // Item 5 (AC-5.1b): the harness supplies the SAME reported vectors at the
    // toUserWithProfile boundary that composition measurement reads below —
    // gating and measurement see identical inputs, mirroring production's
    // latest-COMPLETED-session preload. Inert unless composition gates are on
    // (pair scoring never reads traitScores), so gate-off stays byte-identical.
    traitScores: session.reportedTraits,
  };
}

/**
 * Drive the REAL matcher core for one pool. Read-only usage:
 *   - complete interests cache → calculateInterestScoreAsync never hits the DB
 *   - chemistryCalibrationMap undefined → static hand-authored matrix
 *   - semanticSimilarityEnabled false → 6D scoring (production default)
 *   - magnetismGroupRulesEnabled false → gate-off baseline (Item 5 measures
 *     against THIS; the R1–R3 commit gates stay inert)
 *   - strictness 50 → Match Compass default (no dealbreakers, no weight shift)
 */
async function runMatchForPool(
  pool: SyntheticPool,
  sessions: SessionStore,
  armFor: (member: PoolMember) => SessionArm,
  compositionGatesEnabled = false,
  gateStats?: CompositionGateStats,
  derivedChemistryEnabled = false,
  // W6-F (gm-debrief follow-up): bounded X-variance dispersion nudge. Mirrors
  // production's env kill switch (default ON); pass
  // MATCH_X_VARIANCE_DISPERSION_ENABLED=false to reproduce the pre-W6-F picture.
  xVarianceDispersionEnabled = process.env.MATCH_X_VARIANCE_DISPERSION_ENABLED !== 'false'
): Promise<RunResult> {
  const sessionByUserId = new Map<string, SessionProduct>();
  const users = pool.members.map((member) => {
    const session = sessions.get(member.respondent, armFor(member));
    sessionByUserId.set(member.respondent.id, session);
    return toUserWithProfile(member, session);
  });
  const interestsCache: UserInterestsCache = new Map(
    pool.members.map((member) => [member.respondent.id, member.profile.interests])
  );

  const targetGroups = Math.ceil(pool.size / MAX_GROUP_SIZE);
  const groups = await runGreedyPoolMatchingCore(
    users,
    {
      minGroupSize: MIN_GROUP_SIZE,
      maxGroupSize: MAX_GROUP_SIZE,
      // Enough capacity to seat the whole pool: ceil(size / maxGroupSize).
      targetGroups,
    },
    interestsCache,
    new Map(),
    undefined,
    false,
    undefined,
    [],
    undefined,
    undefined,
    50,
    false,
    false,
    false,
    pool.duoPairs,
    compositionGatesEnabled,
    gateStats,
    // Item 10: derived-chemistry mechanical authority (default false — the
    // authored matrix path is byte-identical when this arm is not requested).
    derivedChemistryEnabled,
    // W2 table-viability floor stays OFF in the direct-core harness (the
    // gates-on arm activates it through compositionGatesEnabled instead).
    false,
    // W6 anti-clique novelty: inert here (no match-history lookup supplied).
    false,
    // W6-F: bounded X-variance dispersion nudge (production default ON).
    xVarianceDispersionEnabled
  );

  const matchedIds = new Set<string>();
  for (const group of groups) {
    for (const member of group.members) matchedIds.add(member.userId);
  }
  const unmatched = pool.members.filter((m) => !matchedIds.has(m.respondent.id));

  // Recompute the pool-level spark state with the REAL helper over the SAME
  // eligible set the matcher saw (no hard constraints filter harness members),
  // so M9 evaluation uses the identical bidirectional exemption the core used.
  const sparkPoolState = compositionGatesEnabled
    ? computeSparkPoolState(users, targetGroups)
    : null;

  return { groups, unmatched, sessionByUserId, sparkPoolState };
}

export type {
  PoolMember,
  SyntheticPool,
  RunResult,
};

export {
  generatePools,
  toUserWithProfile,
  runMatchForPool,
};
