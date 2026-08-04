/**
 * 磁场引擎 惊艳开局包 — final validation: "rules on vs off" dual-run comparison
 * for the flag-gated group-composition rules (magnetismGroupRulesEnabled).
 *
 *   R1 无孤立者 — commit gate: every member needs ≥1 intra-group pair score ≥ 60
 *   R2 能量编排 — commit gate: ≥1 member with archetype energy ≥ 75 (pool-exempt)
 *   R3 话题锚点 — commit gate: shared macro category OR topic shared by ≥ ⌈n/2⌉
 *   R4 新奇分散 — expansion ranking nudge: 2nd explore-intent candidate −8
 *
 * Method: each synthetic pool is run through the REAL `runGreedyPoolMatchingCore`
 * three times — rules OFF, rules OFF again (determinism sanity), rules ON — with
 * a FRESH pairScoreCache per run (the cache key embeds semantic/adaptive/v2
 * segments but NOT the rules flag, so caches must not be shared across runs).
 * All other inputs are identical: semantic similarity explicitly off, no
 * customWeights, strictness 50, never-meet sentinel off, weight-profile v2 off.
 *
 * Assertions per pool:
 *   - Formation-rate guardrail (approved 放行线):
 *       groupsOn.length >= ceil(groupsOff.length * 0.85)
 *   - Rule conformance with rules ON: 100% of formed groups pass R1 / R2 / R3
 *     (R2 pool-level exemption and R3 cold-start skip are detected and
 *     documented, not counted as failures). R1 is verified with the exported
 *     `groupSatisfiesStrongTieRule` fed by a FRESH `calculatePairScore` batch
 *     using the same scoring inputs; every recomputed score is cross-checked
 *     for equality against the run's own pair-score cache.
 *   - Zero-behavior-change: the two rules-OFF runs produce byte-identical
 *     group rosters (order-sensitive signature).
 *
 * Mock strategy mirrors magnetismGroupRules.test.ts: db, schema, drizzle-orm,
 * feature flags, post-match side effects, venue/theme services are mocked;
 * chemistry is mocked with a deterministic archetype-pair table (below) so pair
 * scores are reproducible; the greedy core, rule helpers, interest/social/
 * diversity/preference/language scoring and the legacy weight table are REAL.
 *
 * Mocked chemistry design (energizers = energy ≥ 75):
 *   same-archetype 88; energizer↔energizer 56 (anti-clump, so energizers seed
 *   different groups); energizer↔calm 82; calm↔calm per overrides (62–85).
 *   Each user's secondaryArchetype is set equal to their primary so
 *   calculateChemistryScore reduces to the raw table value (0.70+0.15+0.15 = 1.0).
 *
 * Topic backbone: every non-cold-start user carries `hotpot` at heat 25 (饭局
 * baseline topic), so R3(a) has a food macro-anchor in any composition and the
 * interest dimension has a realistic floor (Jaccard 1/5 → 47; +shared personal
 * topic → up to 78). Personal topics span sports/play/culture/life/growth.
 *
 * Pool distributions (fixed factories, fully deterministic):
 *
 *   Pool A "balanced mixer" — 12 users, min 4 / max 6, target 2 groups.
 *     Energizers 3/12 (corgi A01, husky A07, fox A08); explore intent 3/12
 *     (A04, A10, A11); genders 6M/6F; lifeStages 职场老手×4, 职场新人×3,
 *     学生党×2, 自由职业×2, 创业中×1; industries tech×3, design×2, finance×2,
 *     education×2, media, healthcare, startup; every user carries hotpot(25)
 *     + 2 personal topics (rich interests, no cold-start).
 *
 *   Pool B "sparse/edge" — 14 users, min 4 / max 6, target 3 groups.
 *     Energizers only 2/14 (fox B01, husky B02) so R2 has real selectivity;
 *     explore intent 4/14 (B03, B07, B13, B14); cold-start (empty interests,
 *     R3 skip trigger) 2/14 (B11, B12); a mutually-compatible-but-pool-
 *     mismatched pair (B13/B14, niche sports topics, no food anchor, no topic
 *     overlap with anyone else) designed to stay stranded even with rules OFF;
 *     genders 7M/7F; B01–B10 carry the hotpot backbone + 2 personal topics.
 *
 *   Pool C "no-energizer exemption" — 10 users, min 4 / max 6, target 2 groups.
 *     ALL archetypes below the energizer threshold (koala/otter/panda/deer/
 *     owl/sloth) → R2 pool-level exemption must activate with rules ON;
 *     explore intent 2/10 (C03, C07); genders 5M/5F; hotpot backbone + 1
 *     personal topic per user.
 */
import { describe, expect, it, vi } from 'vitest';

const {
  eventPoolsTable,
  eventPoolRegistrationsTable,
  eventPoolGroupsTable,
  eventsTable,
  eventAttendanceTable,
  usersTable,
  userInterestsTable,
  invitationUsesTable,
  invitationsTable,
  couponsTable,
  userCouponsTable,
  matchHistoryTable,
} = vi.hoisted(() => ({
  eventPoolsTable: Symbol('eventPools'),
  eventPoolRegistrationsTable: Symbol('eventPoolRegistrations'),
  eventPoolGroupsTable: Symbol('eventPoolGroups'),
  eventsTable: Symbol('events'),
  eventAttendanceTable: Symbol('eventAttendance'),
  usersTable: Symbol('users'),
  userInterestsTable: Symbol('userInterests'),
  invitationUsesTable: Symbol('invitationUses'),
  invitationsTable: Symbol('invitations'),
  couponsTable: Symbol('coupons'),
  userCouponsTable: Symbol('userCoupons'),
  matchHistoryTable: Symbol('matchHistory'),
}));

vi.mock('@shared/schema', () => ({
  eventPools: eventPoolsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  eventPoolGroups: eventPoolGroupsTable,
  events: eventsTable,
  eventAttendance: eventAttendanceTable,
  users: usersTable,
  userInterests: userInterestsTable,
  invitationUses: invitationUsesTable,
  invitations: invitationsTable,
  coupons: couponsTable,
  userCoupons: userCouponsTable,
  matchHistory: matchHistoryTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: 'inArray', values }),
  sql: () => ({}),
}));

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: () => {
        // Thenable with `.limit()` so both `.where(...)` and
        // `.where(...).limit(1)` chains resolve to empty rows.
        const runWhere: any = () => {
          const p: any = Promise.resolve([]);
          p.limit = () => Promise.resolve([]);
          return p;
        };
        const joinable: any = { where: runWhere };
        joinable.innerJoin = () => joinable;
        return joinable;
      },
    }),
    update: () => ({
      set: () => ({
        where: () => ({
          returning: () => Promise.resolve([]),
          then: (resolve: (v: unknown) => unknown) => Promise.resolve([]).then(resolve),
        }),
      }),
    }),
    query: {
      eventPools: {
        findFirst: () => Promise.resolve(null),
      },
    },
    transaction: vi.fn(),
  },
}));

vi.mock('../wsService', () => ({
  wsService: { broadcastToUser: vi.fn() },
}));
vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn((_key: string, defaultValue: boolean) => Promise.resolve(defaultValue)),
}));
vi.mock('../lib/matchingPostMatchEffects', () => ({
  executePostMatchCommitSideEffects: vi.fn(),
}));
vi.mock('../venueAssignmentService', () => ({
  assignVenuesToGroups: vi.fn().mockResolvedValue({ assignments: new Map(), unassigned: new Map() }),
  saveVenueAssignments: vi.fn(),
}));
vi.mock('../eventThemeGeneratorService', () => ({
  generateAndSaveEventTheme: vi.fn(),
}));
vi.mock('../services/eventThemeTitleGenerator', () => ({
  generateEventThemeTitle: vi.fn().mockResolvedValue({
    eventThemeTitle: null,
    themeTagline: null,
    emoji: null,
    reasoning: null,
  }),
}));

// Deterministic chemistry fixture. Energizers (energy ≥ 75): corgi 95,
// husky 85, fox 80, tiger 78. Calm: koala 70, otter 65, panda 60, deer 58,
// owl 55, sloth 50. Values avoid exactly 50 (that raw value triggers a
// chemistry debug log line in calculateChemistryScore).
const { archetypeEnergyMock, chemistryFor } = vi.hoisted(() => {
  const ENERGY: Record<string, number> = {
    corgi: 95, husky: 85, fox: 80, tiger: 78,
    koala: 70, otter: 65, panda: 60, deer: 58, owl: 55, sloth: 50,
  };
  const ENERGIZERS = new Set(['corgi', 'husky', 'fox', 'tiger']);
  const OVERRIDES: Record<string, number> = {
    'fox|tiger': 62,
    'koala|panda': 85, 'koala|otter': 82, 'koala|owl': 78, 'koala|deer': 75, 'koala|sloth': 70,
    'panda|otter': 80, 'panda|owl': 76, 'panda|deer': 72, 'panda|sloth': 68,
    'otter|owl': 74, 'otter|deer': 72, 'otter|sloth': 66,
    'owl|deer': 70, 'owl|sloth': 64, 'deer|sloth': 62,
  };
  const chemistryFor = (a: string, b: string): number => {
    if (a === b) return 88;
    const key = [a, b].sort().join('|');
    if (key in OVERRIDES) return OVERRIDES[key];
    const aE = ENERGIZERS.has(a);
    const bE = ENERGIZERS.has(b);
    if (aE && bE) return 56; // energizer↔energizer: anti-clump by design
    if (aE || bE) return 82; // energizer↔calm: strong
    return 71;               // calm↔calm default
  };
  return { archetypeEnergyMock: ENERGY, chemistryFor };
});

vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: {},
  ARCHETYPE_ENERGY: archetypeEnergyMock,
}));

vi.mock('../archetypeChemistryCalibration', () => ({
  getArchetypePairCalibrationMap: vi.fn().mockResolvedValue(new Map()),
  getCalibratedChemistryScore: vi.fn().mockImplementation((a: string, b: string) => chemistryFor(a, b)),
}));

const {
  runGreedyPoolMatchingCore,
  calculatePairScore,
  groupSatisfiesStrongTieRule,
  groupHasEnergizer,
  groupHasTopicAnchor,
  userArchetypeEnergy,
  MAGNETISM_ENERGIZER_THRESHOLD,
  MAGNETISM_STRONG_TIE_THRESHOLD,
} = await import('../poolMatchingService');
import type {
  GreedyPoolMatchingConfig,
  MatchGroup,
  UserInterestsCache,
  UserWithProfile,
} from '../poolMatchingService';

// =============================================================================
// Synthetic pool factories
// =============================================================================

/** Approved formation-rate 放行线: rules-ON may form no fewer than 85% of rules-OFF groups. */
const FORMATION_GUARDRAIL = 0.85;

interface PoolUserSpec {
  id: string;
  archetype: keyof typeof archetypeEnergyMock;
  gender: '男性' | '女性';
  lifeStage: string;
  education: string;
  industry: string;
  intent: string[] | null;
  /** [topicId, heat] pairs; empty array = cold-start user (R3 skip trigger). */
  topics: Array<[string, number]>;
}

function makeUser(spec: PoolUserSpec): UserWithProfile {
  return {
    userId: spec.id,
    registrationId: `reg-${spec.id}`,
    gender: spec.gender,
    birthdate: '1995-01-01',
    industryNiche: spec.industry,
    industryNicheLabel: spec.industry,
    industryCategoryLabel: spec.industry,
    educationLevel: spec.education,
    archetype: spec.archetype,
    // secondary = primary so chemistry reduces to the raw mocked table value.
    secondaryArchetype: spec.archetype,
    lifeStage: spec.lifeStage,
    workMode: 'employed',
    hometown: null,
    hometownAffinityOptin: false,
    budgetRange: null,
    barBudgetRange: null,
    preferredLanguages: ['中文'],
    eventIntent: spec.intent,
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
  };
}

/** Every user gets an explicit cache entry so the scoring path never hits the (mocked) db. */
function buildInterests(specs: PoolUserSpec[]): UserInterestsCache {
  const cache: UserInterestsCache = new Map();
  for (const spec of specs) {
    cache.set(spec.id, {
      topics: spec.topics.map(([topic]) => topic),
      heatMap: Object.fromEntries(spec.topics),
    });
  }
  return cache;
}

// Pool A — balanced mixer (see header for the distribution table).
const POOL_A: PoolUserSpec[] = [
  { id: 'A01', archetype: 'corgi', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'tech', intent: ['fun'], topics: [['hotpot', 25], ['hiking', 10], ['travel', 10]] },
  { id: 'A02', archetype: 'koala', gender: '女性', lifeStage: '职场新人', education: '硕士', industry: 'design', intent: ['fun'], topics: [['hotpot', 25], ['hiking', 10], ['photography', 10]] },
  { id: 'A03', archetype: 'panda', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'finance', intent: ['networking'], topics: [['hotpot', 25], ['camping', 10], ['reading', 10]] },
  { id: 'A04', archetype: 'owl', gender: '女性', lifeStage: '自由职业', education: '本科', industry: 'media', intent: ['explore'], topics: [['hotpot', 25], ['hiking', 10], ['exhibition', 10]] },
  { id: 'A05', archetype: 'otter', gender: '男性', lifeStage: '职场新人', education: '大专', industry: 'tech', intent: ['fun'], topics: [['hotpot', 25], ['fitness', 10], ['gaming', 10]] },
  { id: 'A06', archetype: 'deer', gender: '女性', lifeStage: '学生党', education: '本科', industry: 'education', intent: ['networking'], topics: [['hotpot', 25], ['camping', 10], ['music', 10]] },
  { id: 'A07', archetype: 'husky', gender: '女性', lifeStage: '创业中', education: '硕士', industry: 'startup', intent: ['networking'], topics: [['hotpot', 25], ['script_kill', 10], ['career', 10]] },
  { id: 'A08', archetype: 'fox', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'tech', intent: ['fun'], topics: [['hotpot', 25], ['board_games', 10], ['tech', 10]] },
  { id: 'A09', archetype: 'koala', gender: '女性', lifeStage: '职场新人', education: '本科', industry: 'healthcare', intent: ['fun'], topics: [['hotpot', 25], ['ktv', 10], ['cinema', 10]] },
  { id: 'A10', archetype: 'panda', gender: '男性', lifeStage: '自由职业', education: '硕士', industry: 'design', intent: ['explore'], topics: [['hotpot', 25], ['escape_room', 10], ['flea_market', 10]] },
  { id: 'A11', archetype: 'owl', gender: '女性', lifeStage: '学生党', education: '大专', industry: 'education', intent: ['explore'], topics: [['hotpot', 25], ['werewolf', 10], ['standup', 10]] },
  { id: 'A12', archetype: 'sloth', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'finance', intent: ['networking'], topics: [['hotpot', 25], ['live_house', 10], ['podcasts', 10]] },
];
const POOL_A_CONFIG: GreedyPoolMatchingConfig = { minGroupSize: 4, maxGroupSize: 6, targetGroups: 2 };

// Pool B — sparse/edge (see header). B11/B12 are cold-start (empty interests);
// B13/B14 are a niche pair designed to stay stranded even with rules OFF.
const POOL_B: PoolUserSpec[] = [
  { id: 'B01', archetype: 'fox', gender: '女性', lifeStage: '创业中', education: '硕士', industry: 'startup', intent: ['networking'], topics: [['hotpot', 25], ['career', 10], ['startup', 10]] },
  { id: 'B02', archetype: 'husky', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'tech', intent: ['fun'], topics: [['hotpot', 25], ['gaming', 10], ['tech', 10]] },
  { id: 'B03', archetype: 'koala', gender: '女性', lifeStage: '职场新人', education: '本科', industry: 'design', intent: ['explore'], topics: [['hotpot', 25], ['hiking', 10], ['photography', 10]] },
  { id: 'B04', archetype: 'panda', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'finance', intent: ['fun'], topics: [['hotpot', 25], ['board_games', 10], ['wine', 10]] },
  { id: 'B05', archetype: 'owl', gender: '女性', lifeStage: '自由职业', education: '大专', industry: 'media', intent: ['fun'], topics: [['hotpot', 25], ['ktv', 10], ['cinema', 10]] },
  { id: 'B06', archetype: 'otter', gender: '男性', lifeStage: '学生党', education: '本科', industry: 'education', intent: ['fun'], topics: [['hotpot', 25], ['escape_room', 10], ['music', 10]] },
  { id: 'B07', archetype: 'deer', gender: '女性', lifeStage: '职场新人', education: '硕士', industry: 'healthcare', intent: ['explore'], topics: [['hotpot', 25], ['fitness', 10], ['reading', 10]] },
  { id: 'B08', archetype: 'sloth', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'tech', intent: ['networking'], topics: [['hotpot', 25], ['podcasts', 10], ['career', 10]] },
  { id: 'B09', archetype: 'koala', gender: '女性', lifeStage: '自由职业', education: '本科', industry: 'design', intent: ['fun'], topics: [['hotpot', 25], ['citywalk', 10], ['vintage', 10]] },
  { id: 'B10', archetype: 'panda', gender: '男性', lifeStage: '职场新人', education: '大专', industry: 'media', intent: ['fun'], topics: [['hotpot', 25], ['werewolf', 10], ['live_house', 10]] },
  { id: 'B11', archetype: 'otter', gender: '女性', lifeStage: '职场新人', education: '本科', industry: 'design', intent: ['fun'], topics: [] },
  { id: 'B12', archetype: 'owl', gender: '男性', lifeStage: '学生党', education: '大专', industry: 'education', intent: ['fun'], topics: [] },
  { id: 'B13', archetype: 'deer', gender: '女性', lifeStage: '自由职业', education: '硕士', industry: 'outdoor', intent: ['explore'], topics: [['sailing', 25], ['climbing', 10], ['extreme_sports', 10]] },
  { id: 'B14', archetype: 'sloth', gender: '男性', lifeStage: '自由职业', education: '本科', industry: 'outdoor', intent: ['explore'], topics: [['sailing', 25], ['climbing', 10], ['camping', 10]] },
];
const POOL_B_CONFIG: GreedyPoolMatchingConfig = { minGroupSize: 4, maxGroupSize: 6, targetGroups: 3 };

// Pool C — no-energizer exemption (see header). Every archetype is below the
// energizer threshold, so the R2 pool-level exemption must activate.
const POOL_C: PoolUserSpec[] = [
  { id: 'C01', archetype: 'koala', gender: '女性', lifeStage: '职场新人', education: '本科', industry: 'design', intent: ['fun'], topics: [['hotpot', 25], ['hiking', 10]] },
  { id: 'C02', archetype: 'panda', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'tech', intent: ['fun'], topics: [['hotpot', 25], ['gaming', 10]] },
  { id: 'C03', archetype: 'otter', gender: '女性', lifeStage: '自由职业', education: '硕士', industry: 'media', intent: ['explore'], topics: [['hotpot', 25], ['travel', 10]] },
  { id: 'C04', archetype: 'owl', gender: '男性', lifeStage: '学生党', education: '大专', industry: 'education', intent: ['fun'], topics: [['hotpot', 25], ['cinema', 10]] },
  { id: 'C05', archetype: 'deer', gender: '女性', lifeStage: '职场新人', education: '本科', industry: 'healthcare', intent: ['networking'], topics: [['hotpot', 25], ['reading', 10]] },
  { id: 'C06', archetype: 'sloth', gender: '男性', lifeStage: '职场老手', education: '本科', industry: 'finance', intent: ['fun'], topics: [['hotpot', 25], ['podcasts', 10]] },
  { id: 'C07', archetype: 'koala', gender: '女性', lifeStage: '创业中', education: '硕士', industry: 'startup', intent: ['explore'], topics: [['hotpot', 25], ['career', 10]] },
  { id: 'C08', archetype: 'panda', gender: '男性', lifeStage: '职场新人', education: '本科', industry: 'design', intent: ['fun'], topics: [['hotpot', 25], ['board_games', 10]] },
  { id: 'C09', archetype: 'otter', gender: '女性', lifeStage: '职场老手', education: '本科', industry: 'tech', intent: ['networking'], topics: [['hotpot', 25], ['tech', 10]] },
  { id: 'C10', archetype: 'owl', gender: '男性', lifeStage: '自由职业', education: '大专', industry: 'media', intent: ['fun'], topics: [['hotpot', 25], ['live_house', 10]] },
];
const POOL_C_CONFIG: GreedyPoolMatchingConfig = { minGroupSize: 4, maxGroupSize: 6, targetGroups: 2 };

// =============================================================================
// Dual-run harness
// =============================================================================

interface DualRunResult {
  off: MatchGroup[];
  offRepeat: MatchGroup[];
  on: MatchGroup[];
  offCache: Map<string, number>;
  onCache: Map<string, number>;
}

/**
 * Runs the greedy core three times with identical inputs; each call gets a
 * FRESH pair-score cache (the cache key has no rules-flag segment, so sharing
 * a cache across runs would let scores computed under one flag state serve
 * the other). Returned caches are the mutated run-owned maps, used below to
 * cross-check the fresh R1 recompute against the scores the rules actually saw.
 */
async function runDual(
  users: UserWithProfile[],
  interests: UserInterestsCache,
  pool: GreedyPoolMatchingConfig,
): Promise<DualRunResult> {
  const runOnce = async (rulesOn: boolean) => {
    const cache = new Map<string, number>();
    const groups = await runGreedyPoolMatchingCore(
      users,
      pool,
      interests,
      cache,
      undefined, // semanticProfileCache
      false,     // semanticSimilarityEnabled — explicitly OFF
      undefined, // chemistryCalibrationMap
      [],        // invitationPairs
      undefined, // customWeights
      undefined, // matchHistoryLookup
      50,        // strictness (neutral)
      false,     // matchNeverMeetSentinelEnabled
      false,     // useWeightProfileV2
      rulesOn,   // magnetismGroupRulesEnabled
    );
    return { groups, cache };
  };
  const off = await runOnce(false);
  const offRepeat = await runOnce(false);
  const on = await runOnce(true);
  return {
    off: off.groups,
    offRepeat: offRepeat.groups,
    on: on.groups,
    offCache: off.cache,
    onCache: on.cache,
  };
}

/** Order-sensitive roster signature — used for the byte-identical determinism check. */
const rosterSignature = (groups: MatchGroup[]): string[] =>
  groups.map(g => g.members.map(m => m.userId).join('+'));

/** Order-insensitive signature — used only for on/off roster-delta reporting. */
const canonicalSignature = (groups: MatchGroup[]): string[] =>
  groups.map(g => g.members.map(m => m.userId).sort().join('+')).sort();

/** Legacy-mode cache key for a scored pair (semantic off, no customWeights, v2 off). */
const legacyPairKey = (a: string, b: string): string => `legacy|${[a, b].sort().join('|')}`;

type R2Verdict = 'pass' | 'fail' | 'pool-exempt';
type R3Verdict = 'pass' | 'fail' | 'skipped-cold-start';

interface GroupConformance {
  key: string;
  size: number;
  r1Pass: boolean;
  /** Minimum across members of each member's strongest intra-group tie. */
  minStrongestTie: number;
  r2: R2Verdict;
  r3: R3Verdict;
}

/**
 * Verifies one rules-ON group against R1/R2/R3.
 * R1 uses the exported `groupSatisfiesStrongTieRule` fed by a FRESH
 * `calculatePairScore` batch (same scoring inputs as the run); every
 * recomputed pair score is asserted equal to the run's own cached raw score,
 * so the verification provably looks at the same numbers the commit gate saw.
 */
async function verifyOnGroup(
  group: MatchGroup,
  poolHasEnergizer: boolean,
  interests: UserInterestsCache,
  runCache: Map<string, number>,
): Promise<GroupConformance> {
  const recomputeCache = new Map<string, number>();
  const score = (a: UserWithProfile, b: UserWithProfile): Promise<number> =>
    calculatePairScore(
      a,
      b,
      interests,
      recomputeCache,
      undefined, // semanticProfileCache
      false,     // semanticSimilarityEnabled
      undefined, // chemistryCalibrationMap
      undefined, // customWeights
      undefined, // matchHistoryLookup
      false,     // matchNeverMeetSentinelEnabled
      false,     // useWeightProfileV2
    );

  const members = group.members;
  const pairScores = new Map<string, number>();
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      const fresh = await score(members[i], members[j]);
      pairScores.set(legacyPairKey(members[i].userId, members[j].userId), fresh);
      // Cross-check: fresh recompute must equal the run's own cached raw score.
      expect(runCache.get(legacyPairKey(members[i].userId, members[j].userId))).toBe(fresh);
    }
  }

  const r1Pass = await groupSatisfiesStrongTieRule(members, score);
  let minStrongestTie = 100;
  for (const member of members) {
    let strongest = -1;
    for (const other of members) {
      if (other.userId === member.userId) continue;
      strongest = Math.max(strongest, pairScores.get(legacyPairKey(member.userId, other.userId))!);
    }
    minStrongestTie = Math.min(minStrongestTie, strongest);
  }

  const r2: R2Verdict = !poolHasEnergizer
    ? 'pool-exempt'
    : groupHasEnergizer(members)
      ? 'pass'
      : 'fail';

  const hasColdStartMember = members.some(
    m => (interests.get(m.userId)?.topics.length ?? 0) === 0,
  );
  const r3: R3Verdict = hasColdStartMember
    ? 'skipped-cold-start'
    : groupHasTopicAnchor(members, interests)
      ? 'pass'
      : 'fail';

  return {
    key: members.map(m => m.userId).sort().join('+'),
    size: members.length,
    r1Pass,
    minStrongestTie,
    r2,
    r3,
  };
}

interface PoolReport {
  name: string;
  userCount: number;
  energizerCount: number;
  exploreCount: number;
  coldStartCount: number;
  offCount: number;
  onCount: number;
  guardrailFloor: number;
  rostersIdentical: boolean;
  conformances: GroupConformance[];
}

function printReport(report: PoolReport): void {
  const ratio = report.offCount === 0 ? 'n/a' : (report.onCount / report.offCount).toFixed(2);
  console.log(
    `\n[磁场双跑] ${report.name} — ${report.userCount} users `
    + `(energizer ${report.energizerCount}, explore ${report.exploreCount}, cold-start ${report.coldStartCount})`,
  );
  console.log(
    `  groups OFF=${report.offCount}  ON=${report.onCount}  ratio=${ratio}  `
    + `guardrail ON≥${report.guardrailFloor} → ${report.onCount >= report.guardrailFloor ? 'PASS' : 'FAIL'}`,
  );
  console.log(`  roster delta (OFF vs ON): ${report.rostersIdentical ? 'identical' : 'DIVERGED (rules reshaped composition)'}`);
  for (const c of report.conformances) {
    const r2Label = c.r2 === 'pool-exempt' ? 'R2 exempt(pool)' : `R2 ${c.r2}`;
    const r3Label = c.r3 === 'skipped-cold-start' ? 'R3 skip(cold-start)' : `R3 ${c.r3}`;
    console.log(
      `  ON group [${c.key}] size=${c.size} `
      + `R1 ${c.r1Pass ? 'pass' : 'FAIL'}(min strongest tie ${c.minStrongestTie}≥${MAGNETISM_STRONG_TIE_THRESHOLD}) `
      + `${r2Label}  ${r3Label}`,
    );
  }
}

async function runPoolScenario(
  name: string,
  specs: PoolUserSpec[],
  config: GreedyPoolMatchingConfig,
  minOffGroups: number,
): Promise<PoolReport> {
  const users = specs.map(makeUser);
  const interests = buildInterests(specs);
  const dual = await runDual(users, interests, config);

  // Zero-behavior-change: two rules-OFF runs → byte-identical rosters.
  expect(rosterSignature(dual.offRepeat)).toEqual(rosterSignature(dual.off));

  // Pool validity: the synthetic pool must actually form groups with rules OFF,
  // otherwise the formation guardrail is vacuous.
  expect(dual.off.length).toBeGreaterThanOrEqual(minOffGroups);

  // Formation-rate guardrail (approved 放行线 ≥ 0.85).
  const guardrailFloor = Math.ceil(dual.off.length * FORMATION_GUARDRAIL);
  expect(dual.on.length).toBeGreaterThanOrEqual(guardrailFloor);

  // ON groups must be disjoint and respect size bounds.
  const assigned = new Set<string>();
  for (const g of dual.on) {
    expect(g.members.length).toBeGreaterThanOrEqual(config.minGroupSize!);
    expect(g.members.length).toBeLessThanOrEqual(config.maxGroupSize!);
    for (const m of g.members) {
      expect(assigned.has(m.userId)).toBe(false);
      assigned.add(m.userId);
    }
  }

  // Rule conformance with rules ON: 100% of formed groups.
  const poolHasEnergizer = users.some(u => userArchetypeEnergy(u) >= MAGNETISM_ENERGIZER_THRESHOLD);
  const conformances: GroupConformance[] = [];
  for (const g of dual.on) {
    const c = await verifyOnGroup(g, poolHasEnergizer, interests, dual.onCache);
    expect(c.r1Pass).toBe(true);
    expect(c.r2).not.toBe('fail');
    expect(c.r3).not.toBe('fail');
    conformances.push(c);
  }

  const report: PoolReport = {
    name,
    userCount: users.length,
    energizerCount: users.filter(u => userArchetypeEnergy(u) >= MAGNETISM_ENERGIZER_THRESHOLD).length,
    exploreCount: users.filter(u => (u.eventIntent ?? []).includes('explore')).length,
    coldStartCount: specs.filter(s => s.topics.length === 0).length,
    offCount: dual.off.length,
    onCount: dual.on.length,
    guardrailFloor,
    rostersIdentical:
      canonicalSignature(dual.on).join('|') === canonicalSignature(dual.off).join('|'),
    conformances,
  };
  printReport(report);
  return report;
}

// =============================================================================
// Scenarios
// =============================================================================

describe('磁场引擎 dual-run validation — rules OFF vs ON', () => {
  it('Pool A (balanced mixer, 12 users): guardrail + 100% rule conformance', async () => {
    const report = await runPoolScenario('Pool A balanced-mixer', POOL_A, POOL_A_CONFIG, 2);
    // Pool has energizers → R2 must be actively enforced (no exemption).
    expect(report.conformances.every(c => c.r2 === 'pass')).toBe(true);
    // No cold-start members → R3 must be a real pass on every ON group.
    expect(report.conformances.every(c => c.r3 === 'pass')).toBe(true);
  });

  it('Pool B (sparse/edge, 14 users): cold-start skip documented, guardrail holds', async () => {
    const report = await runPoolScenario('Pool B sparse-edge', POOL_B, POOL_B_CONFIG, 2);
    expect(report.conformances.every(c => c.r2 === 'pass')).toBe(true);
    // Every ON group either passes R3 outright or contains a cold-start member
    // (documented skip). Both outcomes are acceptable; at least one real pass
    // must exist so the skip path cannot silently mask a broken anchor rule.
    expect(report.conformances.some(c => c.r3 === 'pass')).toBe(true);
  });

  it('Pool C (no-energizer, 10 users): R2 pool-level exemption documented', async () => {
    const report = await runPoolScenario('Pool C no-energizer-exemption', POOL_C, POOL_C_CONFIG, 2);
    // No eligible user is an energizer → every ON group must show the exemption.
    expect(report.energizerCount).toBe(0);
    expect(report.conformances.length).toBeGreaterThan(0);
    expect(report.conformances.every(c => c.r2 === 'pool-exempt')).toBe(true);
    expect(report.conformances.every(c => c.r3 === 'pass')).toBe(true);
  });
});
