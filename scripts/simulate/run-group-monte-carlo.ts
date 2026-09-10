#!/usr/bin/env node
/**
 * Monte Carlo Group-Formation Harness (V4 Personality Engine — Plan Item 9)
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.item9-monte-carlo-groups.md`
 * Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 9.
 *
 * What it does:
 *   1. Generates a synthetic respondent population with KNOWN ground-truth
 *      ACOEXP trait vectors, reusing Item 6's documented 2-component mixture
 *      (60% centroid-mixture σ=10 / 40% general N(50,15), truncated [5,95]).
 *   2. Runs each respondent through the adaptive engine TWICE: flags-off
 *      (baseline) and flags-on (`enableConsistencyFolding` +
 *      `enableTraitShrinkage`). The matcher never sees raw engine state —
 *      production wiring stores the resulting archetype + reported trait
 *      vector, so this harness feeds the matcher exactly those arm-specific
 *      products (archetype = engine top-1; with shrinkage on the engine's
 *      currentMatches already derive from the shrunken vector at the
 *      processAnswer match boundary; reported = shrinkTraitsTowardNeutral).
 *   3. Draws ≥500 synthetic pools (sizes 12–60, duo-bound pairs included) and
 *      runs each through `runGreedyPoolMatchingCore` — the REAL matcher core,
 *      read-only, driven fully in-memory (complete interests cache → zero DB
 *      access; static chemistry matrix; semantic dimension off; magnetism
 *      R1–R3 group rules OFF — this is the gate-off baseline instrument).
 *   4. Measures formed-group composition per pool: (a) min-E per group
 *      (stability floor violations), (b) mean-A, (c) spark-count distribution
 *      (high-X/P members per group: 0 / 1 / 2+), (d) X-variance, (e)
 *      clone-group rate (max intra-group 6D trait distance below a locked
 *      minimum), (f) unmatched rate + unmatched-member trait profiles.
 *   5. A/B arms: flags-off vs flags-on composition delta (preview evidence
 *      for Item 5's M9/M10 gates — thresholds PROVISIONAL, measurement-only).
 *      Optional third arm `--composition-gates=on` (Item 5, LOCKED M9/M10):
 *      same pools, flags-off reported vectors supplied at the
 *      toUserWithProfile boundary (AC-5.1b — measurement and gating see
 *      identical inputs), compositionGatesEnabled threaded into the REAL
 *      matcher core. Reports per-gate pass shares (exemption-aware), raw
 *      violation shares, per-gate rejection counts, M9 (≥95% all-gates pass)
 *      and M10 (unmatched delta ≤ +2pp vs the gate-off baseline); hard-fails
 *      M9/M10 only under `--mode=gated`. Gate-on outputs default to
 *      `-gates-on`-suffixed paths so the locked baseline artifacts are never
 *      clobbered; default (gate-off) runs stay byte-identical (AC-5.5).
 *   6. M11 arm (LOCKED target ≥50% reduction; measured + verdicted in all
 *      modes, HARD-failing only in --mode=gated — contract verification
 *      method #1 requires baseline exit 0): 20% of pool members replaced by
 *      low-confidence adversarial respondents (random-clicker from
 *      persona-utils — Item 7 machinery; the ONLY adversarial arm whose
 *      session confidence lands in the shrinkage bite-zone conf < 0.65 —
 *      midpoint-hugger/acquiescence sit at ~0.92–0.95 where the locked
 *      AC-7.4 ceiling keeps w ≈ 1); per-trait group-mean delta vs the
 *      no-injection reference measured with shrinkage off vs on. NOTE: the
 *      shipped Item-3 mechanic (K=75, tuned for AC-3.3 no-harm) clamps
 *      w ≥ 0.879, capping first-order per-trait stabilization at ≈12.1% —
 *      the report prints this mechanical ceiling alongside the measured
 *      reduction so the ≥50% target-vs-mechanic tension is visible.
 *   7. Writes a dated report to docs/reports/ + a machine-readable JSON
 *      artifact to scripts/simulate/data/group-monte-carlo-latest.json.
 *
 * Assertion classes (Reliability pillar, contract AC-9.3):
 *   HARD (exit 1, failing pool index + seed printed for replay):
 *     INV-1 every committed group size ∈ [minGroupSize, maxGroupSize]
 *     INV-2 no member appears in two groups of the same run
 *     INV-3 duo partners are co-located or both unmatched; ≤1 duo per group
 *     INV-4 no NaN/undefined composition metric
 *   HARD ONLY IN --mode=gated (locked target; measured + verdicted everywhere):
 *     INV-5 M11 shrinkage stabilization ≥ 50% reduction (LOCKED, AC-9.4).
 *     Baseline mode reports the verdict without failing so the instrument
 *     can run while the ≥50% target and the K=75 no-harm mechanic are
 *     reconciled by the plan owners (see the mechanical-ceiling note above).
 *   MEASUREMENT-ONLY (reported, not gated — thresholds lock in Item 5):
 *     min-E floor violation rate, mean-A floor violation rate, spark-count
 *     distribution, X-variance cap violation rate, clone-group rate,
 *     unmatched rate + flags-on unmatched-rate delta (M10 preview).
 *   `--mode=gated` promotes INV-5 to a hard failure (the only LOCKED
 *   composition target so far); M9/M10-style rates stay measurement-only
 *   until Item 5 locks their thresholds.
 *
 * Determinism: identical `--seed` reproduces every number (all randomness
 * flows through mulberry32 streams tagged by purpose; the matcher is
 * deterministic given identical input order; V8 Array.prototype.sort is
 * stable per ES2019).
 *
 * Usage:
 *   npm run simulate:groups
 *   tsx --tsconfig apps/server/tsconfig.json scripts/simulate/run-group-monte-carlo.ts
 *   tsx --tsconfig apps/server/tsconfig.json scripts/simulate/run-group-monte-carlo.ts --pools=500 --seed=20260910
 *   tsx --tsconfig apps/server/tsconfig.json scripts/simulate/run-group-monte-carlo.ts --only-pool=17   # replay one pool
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  isUniversalClosingQuestionId,
  shouldTerminate,
  EngineState,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { findBestMatchingArchetypesV2 } from '../../packages/shared/src/personality/matcherV2';
import { archetypePrototypes } from '../../packages/shared/src/personality/prototypes';
import {
  TraitKey,
  DEFAULT_ASSESSMENT_CONFIG,
  AssessmentConfig,
} from '../../packages/shared/src/personality/types';
import { shrinkTraitsTowardNeutral, SHRINKAGE_EXCESS_SCALE, SHRINKAGE_ERROR_FLOOR } from '../../packages/shared/src/personality/traitShrinkage';
import { FITTED_CONFIDENCE_CALIBRATION } from '../../packages/shared/src/personality/confidenceCalibration';
import {
  M11_INJECTION_RATES,
  M11_SMOKE_RATE,
  M11_SMOKE_ALARM_MAX_DELTA,
  M11_CEILING_FRACTION,
  evaluateM11DurableContract,
  type M11DurableEvaluation,
} from './lib/m11-durable-contract';
import { INTEREST_TAXONOMY } from '../../packages/shared/src/interests';
import {
  mulberry32,
  streamSeed,
  selectAnswerByTraits,
  selectAnswerAdversarial,
  AdversarialType,
} from './lib/persona-utils';

import { runGreedyPoolMatchingCore } from '../../apps/server/src/poolMatchingService';
import {
  computeSparkPoolState,
  evaluateCompositionGates,
  isCompositionSpark,
  createCompositionGateStats,
  COMPOSITION_MIN_E_FLOOR,
  COMPOSITION_MEAN_A_FLOOR,
  COMPOSITION_SPARK_TRAIT_THRESHOLD,
  COMPOSITION_X_VARIANCE_CAP,
  type CompositionGateStats,
  type CompositionSparkPoolState,
} from '../../apps/server/src/poolMatchingService';
import type {
  UserWithProfile,
  MatchGroup,
  UserInterestsCache,
} from '../../apps/server/src/poolMatchingService';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Constants ────────────────────────────────────────────────────────

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

/** Item 6 population mixture (locked 2026-09-09, see run-recovery-harness.ts). */
const CENTROID_MIXTURE_WEIGHT = 0.6;
const CENTROID_TRAIT_SD = 10;
const GENERAL_TRAIT_MEAN = 50;
const GENERAL_TRAIT_SD = 15;
const TRAIT_MIN = 5;
const TRAIT_MAX = 95;

/** Pool generation. */
const POOL_SIZE_MIN = 12;
const POOL_SIZE_MAX = 60;
const MIN_GROUP_SIZE = 4;
const MAX_GROUP_SIZE = 6;
/** Share of pool members bound into duo atomic units (双人成行 penetration). */
const DUO_MEMBER_SHARE = 0.15;

/**
 * PROVISIONAL composition thresholds (measurement-only; Item 5 locks the
 * final values against this baseline). Each names the literature prior it
 * operationalises — see plan Item 5 (Bell 2007; Barrick et al. 1998).
 */
/** (i) Stability floor: a group violates when its minimum reported E falls below. */
const PROV_STABILITY_FLOOR_MIN_E = 25;
/** (ii) Viability floor: a group violates when its mean reported A falls below. */
const PROV_MEAN_A_FLOOR = 45;
/** (iii) Spark definition: member with reported X ≥ threshold OR P ≥ threshold. */
const PROV_SPARK_TRAIT_THRESHOLD = 70;
/** (iv) X-variance cap: group var(X) above is a violation (std ≈ 20 mirrors harmonyScore's natural-stdDev ≤ 20). */
const PROV_X_VARIANCE_CAP = 400;
/** (v) Clone group: max pairwise 6D Euclidean distance below this = clone. */
const PROV_CLONE_MIN_MAX_DISTANCE = 15;

/** M11 (LOCKED, AC-9.4): ≥50% reduction in mean per-trait group-mean delta. */
const M11_REDUCTION_TARGET = 0.5;
/** Below this deltaOff the injection moved nothing and the reduction is vacuous. */
const M11_MIN_DELTA_OFF = 0.5;
/**
 * Mechanical stabilization ceiling of the shipped Item-3 mechanic: with
 * K = SHRINKAGE_EXCESS_SCALE the worst-confidence weight is
 * w_min = 1 − (err(0.578⁻) − SHRINKAGE_ERROR_FLOOR) / K where the calibration
 * clamps below-domain confidence to err = 17.57, so w_min ≈ 0.879 and any
 * first-order per-trait group-mean delta can shrink by at most ≈12.1%.
 * Printed alongside the M11 verdict so the ≥50% target-vs-mechanic tension
 * is explicit in the artifact.
 */
const M11_CALIBRATION_WORST_ERR = 17.57;
const M11_MIN_WEIGHT_SHIPPED = 1 - (M11_CALIBRATION_WORST_ERR - SHRINKAGE_ERROR_FLOOR) / SHRINKAGE_EXCESS_SCALE;
const M11_FIRST_ORDER_CEILING = 1 - M11_MIN_WEIGHT_SHIPPED;

// ── CLI ──────────────────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ?? 'true';
    }
  }
  const mode = options.mode || 'baseline';
  if (!['baseline', 'gated'].includes(mode)) {
    console.error(`❌ Unknown mode: ${mode} (expected baseline|gated)`);
    process.exit(1);
  }
  return {
    pools: parseInt(options.pools || '500', 10),
    m11Pools: parseInt(options['m11-pools'] || '200', 10),
    population: parseInt(options.population || '6000', 10),
    seed: parseInt(options.seed || '20260910', 10),
    onlyPool: options['only-pool'] !== undefined ? parseInt(options['only-pool'], 10) : null,
    outFile: options.out || '',
    jsonOutFile: options['json-out'] || '',
    mode,
    compositionGates: options['composition-gates'] === 'on',
    // Item 10 / AC-10.5: opt-in derived-chemistry arm (default off → baseline
    // report + JSON stay byte-identical).
    derivedChemistry: options['derived-chemistry'] === 'on',
  };
}

// ── Seeded RNG helpers (mirrors run-recovery-harness.ts exactly) ─────

/** Standard normal via Box-Muller on the seeded stream. */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Sample Normal(mean, sd) truncated to [TRAIT_MIN, TRAIT_MAX] via rejection (fallback: clamp). */
function sampleTrait(rng: () => number, mean: number, sd: number): number {
  for (let i = 0; i < 100; i++) {
    const v = mean + gaussian(rng) * sd;
    if (v >= TRAIT_MIN && v <= TRAIT_MAX) return v;
  }
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, mean));
}

// ── Synthetic Population (Item 6 mixture) ────────────────────────────

interface SyntheticRespondent {
  id: string;
  index: number;
  source: 'centroid_mixture' | 'general';
  sourceCentroid: string | null;
  trueTraits: Record<TraitKey, number>;
  trueArchetype: string;
}

function generatePopulation(n: number, seed: number): SyntheticRespondent[] {
  const rng = mulberry32(streamSeed(seed, 0, 'population'));
  const centroidIds = Object.keys(archetypePrototypes);
  const respondents: SyntheticRespondent[] = [];

  for (let i = 0; i < n; i++) {
    const isCentroidArm = rng() < CENTROID_MIXTURE_WEIGHT;
    const trueTraits = {} as Record<TraitKey, number>;
    let sourceCentroid: string | null = null;

    if (isCentroidArm) {
      sourceCentroid = centroidIds[Math.floor(rng() * centroidIds.length)];
      const centroid = archetypePrototypes[sourceCentroid].traitProfile;
      for (const trait of ALL_TRAITS) {
        trueTraits[trait] = sampleTrait(rng, centroid[trait], CENTROID_TRAIT_SD);
      }
    } else {
      for (const trait of ALL_TRAITS) {
        trueTraits[trait] = sampleTrait(rng, GENERAL_TRAIT_MEAN, GENERAL_TRAIT_SD);
      }
    }

    const trueMatch = findBestMatchingArchetypesV2(trueTraits);
    respondents.push({
      id: `P${String(i + 1).padStart(5, '0')}`,
      index: i,
      source: isCentroidArm ? 'centroid_mixture' : 'general',
      sourceCentroid,
      trueTraits,
      trueArchetype: trueMatch[0]?.archetype ?? '',
    });
  }

  return respondents;
}

// ── Fixed profile fields (identical across flag arms) ────────────────

interface SyntheticProfile {
  gender: string;
  birthdate: string;
  industryNiche: string;
  industryNicheLabel: string;
  industryCategoryLabel: string;
  educationLevel: string;
  lifeStage: string;
  preferredLanguages: string[];
  eventIntent: string[];
  interests: { topics: string[]; heatMap: Record<string, number> };
}

const INDUSTRIES: Array<[string, string, string]> = [
  ['saas', 'SaaS', '互联网'],
  ['ecommerce', '电商', '互联网'],
  ['finance', '金融', '金融'],
  ['consulting', '咨询', '专业服务'],
  ['healthcare', '医疗', '医疗健康'],
  ['education', '教育', '教育培训'],
  ['media', '媒体', '文化传媒'],
  ['manufacturing', '制造', '先进制造'],
];
const EDUCATION: Array<[string, number]> = [['大专', 0.1], ['本科', 0.6], ['硕士', 0.25], ['博士', 0.05]];
const LIFE_STAGES: Array<[string, number]> = [['学生党', 0.1], ['职场新人', 0.25], ['职场老手', 0.45], ['创业中', 0.1], ['自由职业', 0.1]];
const INTENTS = ['networking', 'friends', 'explore', 'romance'];

function pickWeighted<T>(rng: () => number, table: Array<[T, number]>): T {
  let roll = rng();
  for (const [value, weight] of table) {
    if (roll < weight) return value;
    roll -= weight;
  }
  return table[table.length - 1][0];
}

const ACTIVE_TOPICS = INTEREST_TAXONOMY.filter((t) => t.active !== false).map((t) => t.id);

function generateProfile(respondentIndex: number, seed: number): SyntheticProfile {
  const rng = mulberry32(streamSeed(seed, respondentIndex, 'profile'));

  const genderRoll = rng();
  const gender = genderRoll < 0.475 ? '男性' : genderRoll < 0.95 ? '女性' : '不透露';
  const birthYear = 1988 + Math.floor(rng() * 17); // age ~21–37 in 2026
  const birthdate = `${birthYear}-${String(1 + Math.floor(rng() * 12)).padStart(2, '0')}-15`;

  const [industryNiche, industryNicheLabel, industryCategoryLabel] =
    INDUSTRIES[Math.floor(rng() * INDUSTRIES.length)];

  const intentCount = rng() < 0.7 ? 1 : 2;
  const eventIntent: string[] = [];
  while (eventIntent.length < intentCount) {
    const candidate = INTENTS[Math.floor(rng() * INTENTS.length)];
    if (!eventIntent.includes(candidate)) eventIntent.push(candidate);
  }

  const topicCount = 3 + Math.floor(rng() * 3); // 3–5 topics
  const topics: string[] = [];
  const heatMap: Record<string, number> = {};
  while (topics.length < topicCount) {
    const topic = ACTIVE_TOPICS[Math.floor(rng() * ACTIVE_TOPICS.length)];
    if (!topics.includes(topic)) {
      topics.push(topic);
      heatMap[topic] = rng() < 0.3 ? 25 : 10;
    }
  }

  return {
    gender,
    birthdate,
    industryNiche,
    industryNicheLabel,
    industryCategoryLabel,
    educationLevel: pickWeighted(rng, EDUCATION),
    lifeStage: pickWeighted(rng, LIFE_STAGES),
    preferredLanguages: rng() < 0.85 ? ['中文'] : ['中文', 'English'],
    eventIntent,
    interests: { topics, heatMap },
  };
}

// ── Engine sessions (arm-specific matcher inputs) ────────────────────

type SessionArm = 'off' | 'on' | 'adv-off' | 'adv-on';

interface SessionProduct {
  /** Archetype the matcher would read from the stored profile. */
  archetype: string;
  secondaryArchetype: string | null;
  /** Raw engine trait estimates (pre-shrinkage). */
  rawTraits: Record<TraitKey, number>;
  /** RAW per-trait engine confidences (pre-shrinkage) — M11 ceiling input. */
  traitConfidences: Record<TraitKey, number>;
  /** REPORTED vector downstream consumers see (shrunken when flag on). */
  reportedTraits: Record<TraitKey, number>;
  meanConfidence: number;
}

function sessionConfig(arm: SessionArm): AssessmentConfig {
  const shrinkageOn = arm === 'on' || arm === 'adv-on';
  const consistencyOn = arm === 'on'; // flags-on arm = consistency + shrinkage (contract AC-9.4)
  return {
    ...DEFAULT_ASSESSMENT_CONFIG,
    useV2Matcher: true,
    enableConsistencyFolding: consistencyOn,
    enableTraitShrinkage: shrinkageOn,
  };
}

/**
 * Adversarial policy for M11 injection: ALWAYS random-clicker. Rationale
 * (documented in traitShrinkage.ts): it is the only Item 7 adversarial arm
 * whose session confidence lands in the shrinkage bite-zone (conf < 0.65,
 * calibrated err rising to 17.57). midpoint-hugger (0.925) and
 * acquiescence-biased (0.949) are consistent-but-biased: the locked AC-7.4
 * ceiling keeps their w ≈ 1, so injecting them would measure nothing.
 */
function adversarialTypeFor(_respondentIndex: number): AdversarialType {
  return 'random-clicker';
}

/**
 * One natural-termination engine session. Mirrors run-recovery-harness.ts
 * runNaturalSession: breaks at the first universal closing question; with
 * consistency folding on, pair second members pending at adaptive termination
 * are served in the closing phase (they feed the engine exactly as production).
 */
function runSession(
  respondent: SyntheticRespondent,
  arm: SessionArm,
  rng: () => number
): SessionProduct {
  let state: EngineState = initializeEngineState(sessionConfig(arm));
  const adversarial = arm === 'adv-off' || arm === 'adv-on';
  const advType = adversarial ? adversarialTypeFor(respondent.index) : null;

  let adaptiveCount = 0;
  while (adaptiveCount < 25) {
    const question = selectNextQuestion(state);
    if (!question || isUniversalClosingQuestionId(question.id)) break;
    const postTermination = shouldTerminate(state);
    const answer = adversarial
      ? selectAnswerAdversarial(question, advType!, respondent.trueTraits, rng)
      : selectAnswerByTraits(question, respondent.trueTraits, 'clean', rng);
    state = processAnswer(state, question, answer);
    if (!postTermination) adaptiveCount++;
  }

  const rawTraits = {} as Record<TraitKey, number>;
  const confidences = {} as Record<TraitKey, number>;
  let confSum = 0;
  for (const trait of ALL_TRAITS) {
    const tc = state.traitConfidences[trait];
    rawTraits[trait] = tc?.score ?? 50;
    confidences[trait] = tc?.confidence ?? 0;
    confSum += confidences[trait];
  }

  const shrinkageOn = arm === 'on' || arm === 'adv-on';
  return {
    archetype: state.currentMatches[0]?.archetype ?? respondent.trueArchetype ?? 'koala',
    secondaryArchetype: state.currentMatches[1]?.archetype ?? null,
    rawTraits,
    traitConfidences: confidences,
    reportedTraits: shrinkageOn ? shrinkTraitsTowardNeutral(rawTraits, confidences) : rawTraits,
    meanConfidence: confSum / ALL_TRAITS.length,
  };
}

/** Memoized per-(respondent, arm) sessions — deterministic via per-stream seeds. */
class SessionStore {
  private cache = new Map<string, SessionProduct>();
  constructor(private seed: number) {}

  get(respondent: SyntheticRespondent, arm: SessionArm): SessionProduct {
    const key = `${respondent.index}:${arm}`;
    let session = this.cache.get(key);
    if (!session) {
      // Paired design for the M11 adversarial arms ONLY: adv-off/adv-on share
      // one RNG stream, so their answer sequences (and question selections) are
      // identical and the ONLY difference is the match-boundary transform —
      // otherwise independent streams confound the reported-vector change with
      // answer randomness. The flags-off/on A/B keeps its per-arm streams so the
      // Item 9 baseline is byte-preserved.
      const pairTag = arm === 'adv-off' || arm === 'adv-on' ? 'session:adv' : `session:${arm}`;
      session = runSession(respondent, arm, mulberry32(streamSeed(this.seed, respondent.index, pairTag)));
      this.cache.set(key, session);
    }
    return session;
  }

  get size(): number {
    return this.cache.size;
  }
}

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
  derivedChemistryEnabled = false
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
    derivedChemistryEnabled
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

// ── Structural invariants (HARD assertions) ──────────────────────────

interface InvariantFailure {
  kind: string;
  poolIndex: number;
  poolSeed: number;
  arm: string;
  detail: string;
}

function checkRunInvariants(
  pool: SyntheticPool,
  arm: string,
  result: RunResult
): InvariantFailure[] {
  const failures: InvariantFailure[] = [];
  const seen = new Set<string>();
  const duoPartnerOf = new Map<string, string>();
  for (const duo of pool.duoPairs) {
    duoPartnerOf.set(duo.inviterId, duo.inviteeId);
    duoPartnerOf.set(duo.inviteeId, duo.inviterId);
  }

  for (const group of result.groups) {
    // INV-1: size bounds
    if (group.members.length < MIN_GROUP_SIZE || group.members.length > MAX_GROUP_SIZE) {
      failures.push({
        kind: 'INV-1',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `group size ${group.members.length} outside [${MIN_GROUP_SIZE}, ${MAX_GROUP_SIZE}]`,
      });
    }
    // INV-2: uniqueness
    for (const member of group.members) {
      if (seen.has(member.userId)) {
        failures.push({
          kind: 'INV-2',
          poolIndex: pool.index,
          poolSeed: pool.poolSeed,
          arm,
          detail: `member ${member.userId} appears in two groups`,
        });
      }
      seen.add(member.userId);
    }
    // INV-3a: ≤1 duo unit per group
    let duoUnits = 0;
    const counted = new Set<string>();
    const memberIds = new Set(group.members.map((m) => m.userId));
    for (const id of memberIds) {
      const partner = duoPartnerOf.get(id);
      if (partner && memberIds.has(partner) && !counted.has(id) && !counted.has(partner)) {
        duoUnits++;
        counted.add(id);
        counted.add(partner);
      }
    }
    if (duoUnits > 1) {
      failures.push({
        kind: 'INV-3',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `group contains ${duoUnits} duo units (max 1)`,
      });
    }
    // INV-4: no NaN metrics
    for (const [name, value] of Object.entries({
      avgPairScore: group.avgPairScore,
      avgChemistryScore: group.avgChemistryScore,
      diversityScore: group.diversityScore,
      communicationBalance: group.communicationBalance,
      overallScore: group.overallScore,
    })) {
      if (typeof value !== 'number' || Number.isNaN(value)) {
        failures.push({
          kind: 'INV-4',
          poolIndex: pool.index,
          poolSeed: pool.poolSeed,
          arm,
          detail: `group metric ${name} is ${value}`,
        });
      }
    }
  }

  // INV-3b: duo partners co-located or both unmatched (atomicity)
  const unmatchedIds = new Set(result.unmatched.map((m) => m.respondent.id));
  for (const duo of pool.duoPairs) {
    const aIn = seen.has(duo.inviterId);
    const bIn = seen.has(duo.inviteeId);
    if (aIn !== bIn) {
      failures.push({
        kind: 'INV-3',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `duo ${duo.inviterId}/${duo.inviteeId} split (one matched, one not)`,
      });
    }
    if (!aIn && !(unmatchedIds.has(duo.inviterId) && unmatchedIds.has(duo.inviteeId))) {
      failures.push({
        kind: 'INV-3',
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        arm,
        detail: `duo ${duo.inviterId}/${duo.inviteeId} neither matched nor both unmatched`,
      });
    }
  }

  return failures;
}

// ── Composition measurements ─────────────────────────────────────────

interface GroupComposition {
  minE: number;
  meanA: number;
  sparkCount: number;
  xVariance: number;
  maxIntraDistance: number;
  size: number;
}

function measureGroup(group: MatchGroup, sessionByUserId: Map<string, SessionProduct>): GroupComposition {
  const vectors = group.members.map((m) => sessionByUserId.get(m.userId)!.reportedTraits);
  const minE = Math.min(...vectors.map((v) => v.E));
  const meanA = vectors.reduce((s, v) => s + v.A, 0) / vectors.length;
  const sparkCount = vectors.filter(
    (v) => v.X >= PROV_SPARK_TRAIT_THRESHOLD || v.P >= PROV_SPARK_TRAIT_THRESHOLD
  ).length;
  const meanX = vectors.reduce((s, v) => s + v.X, 0) / vectors.length;
  const xVariance = vectors.reduce((s, v) => s + (v.X - meanX) ** 2, 0) / vectors.length;

  let maxIntraDistance = 0;
  for (let i = 0; i < vectors.length; i++) {
    for (let j = i + 1; j < vectors.length; j++) {
      let sumSq = 0;
      for (const t of ALL_TRAITS) {
        sumSq += (vectors[i][t] - vectors[j][t]) ** 2;
      }
      maxIntraDistance = Math.max(maxIntraDistance, Math.sqrt(sumSq));
    }
  }

  return { minE, meanA, sparkCount, xVariance, maxIntraDistance, size: group.members.length };
}

interface PoolMeasurement {
  poolIndex: number;
  poolSeed: number;
  poolSize: number;
  groupCount: number;
  matchedCount: number;
  unmatchedRate: number;
  groups: GroupComposition[];
  /** Mean reported traits of unmatched vs matched members (profile report). */
  unmatchedTraitMeans: Record<TraitKey, number> | null;
  matchedTraitMeans: Record<TraitKey, number> | null;
}

function measurePoolRun(pool: SyntheticPool, result: RunResult): PoolMeasurement {
  const groups = result.groups.map((g) => measureGroup(g, result.sessionByUserId));
  const matchedCount = pool.size - result.unmatched.length;

  const traitMeans = (members: PoolMember[]): Record<TraitKey, number> | null => {
    if (members.length === 0) return null;
    const means = {} as Record<TraitKey, number>;
    for (const t of ALL_TRAITS) {
      means[t] =
        members.reduce((s, m) => s + result.sessionByUserId.get(m.respondent.id)!.reportedTraits[t], 0) /
        members.length;
    }
    return means;
  };

  return {
    poolIndex: pool.index,
    poolSeed: pool.poolSeed,
    poolSize: pool.size,
    groupCount: groups.length,
    matchedCount,
    unmatchedRate: result.unmatched.length / pool.size,
    groups,
    unmatchedTraitMeans: traitMeans(result.unmatched),
    matchedTraitMeans: traitMeans(
      pool.members.filter((m) => !result.unmatched.includes(m))
    ),
  };
}

// ── Aggregation ──────────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.length === 0 ? 0 : xs.reduce((a, b) => a + b, 0) / xs.length;
}

function percentile(xs: number[], p: number): number {
  if (xs.length === 0) return 0;
  const sorted = [...xs].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

interface DistSummary {
  n: number;
  mean: number;
  p10: number;
  p50: number;
  p90: number;
}

function dist(xs: number[]): DistSummary {
  return { n: xs.length, mean: mean(xs), p10: percentile(xs, 10), p50: percentile(xs, 50), p90: percentile(xs, 90) };
}

function round3(x: number): number {
  return Math.round(x * 1000) / 1000;
}
function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

interface ArmAggregate {
  arm: string;
  poolCount: number;
  groupCount: number;
  minE: DistSummary;
  meanA: DistSummary;
  xVariance: DistSummary;
  maxIntraDistance: DistSummary;
  sparkDistribution: { zero: number; one: number; twoPlus: number };
  /** Measurement-only violation rates (provisional thresholds). */
  stabilityFloorViolationRate: number;
  meanAFloorViolationRate: number;
  xVarianceCapViolationRate: number;
  cloneGroupRate: number;
  unmatchedRate: DistSummary;
  /** Mean per-trait delta (unmatched − matched), pooled across pools. */
  unmatchedTraitDeltas: Record<TraitKey, number> | null;
}

function aggregateArm(arm: string, runs: PoolMeasurement[]): ArmAggregate {
  const allGroups = runs.flatMap((r) => r.groups);
  const sparkZero = allGroups.filter((g) => g.sparkCount === 0).length;
  const sparkOne = allGroups.filter((g) => g.sparkCount === 1).length;
  const sparkTwoPlus = allGroups.filter((g) => g.sparkCount >= 2).length;

  let unmatchedTraitDeltas: Record<TraitKey, number> | null = null;
  const deltaRuns = runs.filter((r) => r.unmatchedTraitMeans && r.matchedTraitMeans);
  if (deltaRuns.length > 0) {
    unmatchedTraitDeltas = {} as Record<TraitKey, number>;
    for (const t of ALL_TRAITS) {
      unmatchedTraitDeltas[t] = round3(
        mean(deltaRuns.map((r) => r.unmatchedTraitMeans![t] - r.matchedTraitMeans![t]))
      );
    }
  }

  const n = allGroups.length;
  return {
    arm,
    poolCount: runs.length,
    groupCount: n,
    minE: dist(allGroups.map((g) => g.minE)),
    meanA: dist(allGroups.map((g) => g.meanA)),
    xVariance: dist(allGroups.map((g) => g.xVariance)),
    maxIntraDistance: dist(allGroups.map((g) => g.maxIntraDistance)),
    sparkDistribution: {
      zero: n === 0 ? 0 : sparkZero / n,
      one: n === 0 ? 0 : sparkOne / n,
      twoPlus: n === 0 ? 0 : sparkTwoPlus / n,
    },
    stabilityFloorViolationRate: n === 0 ? 0 : allGroups.filter((g) => g.minE < PROV_STABILITY_FLOOR_MIN_E).length / n,
    meanAFloorViolationRate: n === 0 ? 0 : allGroups.filter((g) => g.meanA < PROV_MEAN_A_FLOOR).length / n,
    xVarianceCapViolationRate: n === 0 ? 0 : allGroups.filter((g) => g.xVariance > PROV_X_VARIANCE_CAP).length / n,
    cloneGroupRate: n === 0 ? 0 : allGroups.filter((g) => g.maxIntraDistance < PROV_CLONE_MIN_MAX_DISTANCE).length / n,
    unmatchedRate: dist(runs.map((r) => r.unmatchedRate)),
    unmatchedTraitDeltas,
  };
}

// ── Item 10 / AC-10.5: derived-chemistry arm ─────────────────────────
// Same pools, flags-off reported vectors, but the matcher computes pair
// chemistry from the mechanically derived matrix instead of the hand-authored
// one. Measures whether group formation shifts materially vs the gate-off
// baseline (chemistry is 28% of the pair score, so a rank change can move
// members between groups).

/** user → group index for a run (unmatched members are absent). */
function groupAssignment(result: RunResult): Map<string, number> {
  const map = new Map<string, number>();
  result.groups.forEach((group, index) => {
    for (const member of group.members) map.set(member.userId, index);
  });
  return map;
}

/**
 * Pairwise co-membership agreement between two runs of the same pool over all
 * member pairs (unmatched treated as its own non-group). 1 = identical
 * grouping of every pair; lower = more re-assignment.
 */
function coMembershipAgreement(ref: RunResult, der: RunResult): number {
  const refAssign = groupAssignment(ref);
  const derAssign = groupAssignment(der);
  const ids = Array.from(new Set([...refAssign.keys(), ...derAssign.keys()]));
  let agree = 0;
  let total = 0;
  for (let i = 0; i < ids.length; i++) {
    for (let j = i + 1; j < ids.length; j++) {
      const sameRef = refAssign.get(ids[i]) !== undefined && refAssign.get(ids[i]) === refAssign.get(ids[j]);
      const sameDer = derAssign.get(ids[i]) !== undefined && derAssign.get(ids[i]) === derAssign.get(ids[j]);
      if (sameRef === sameDer) agree++;
      total++;
    }
  }
  return total === 0 ? 1 : agree / total;
}

interface DerivedArmAggregate {
  arm: string;
  poolCount: number;
  groupCount: number;
  /** Composition metrics (same instrument as the baseline arm). */
  composition: ArmAggregate;
  /** Mean group chemistry-only score (the dimension the flag moves). */
  meanChemistryScore: number;
  /** Mean group average pair score (chemistry feeds this at 70/15/15 weights). */
  meanPairScore: number;
  /** Same means for the flags-off baseline, for the comparison table. */
  offMeanChemistryScore: number;
  offMeanPairScore: number;
  /** Mean pairwise co-membership agreement vs the flags-off arm. */
  coMembershipAgreement: number;
  /** Share of pools where at least one member changed group/unmatched status. */
  poolsWithMembershipChange: number;
}

function aggregateDerivedArm(
  runs: PoolMeasurement[],
  offResults: Map<number, RunResult>,
  derivedResults: Map<number, RunResult>,
): DerivedArmAggregate {
  const allGroups = runs.flatMap((r) => r.groups);
  let chemistrySum = 0;
  let pairSum = 0;
  let groupTotal = 0;
  let offChemistrySum = 0;
  let offPairSum = 0;
  let offGroupTotal = 0;
  for (const run of runs) {
    const result = derivedResults.get(run.poolIndex)!;
    for (const group of result.groups) {
      chemistrySum += group.avgChemistryScore;
      pairSum += group.avgPairScore;
      groupTotal++;
    }
    const off = offResults.get(run.poolIndex)!;
    for (const group of off.groups) {
      offChemistrySum += group.avgChemistryScore;
      offPairSum += group.avgPairScore;
      offGroupTotal++;
    }
  }

  let agreementSum = 0;
  let changedPools = 0;
  for (const run of runs) {
    const off = offResults.get(run.poolIndex)!;
    const der = derivedResults.get(run.poolIndex)!;
    const agreement = coMembershipAgreement(off, der);
    agreementSum += agreement;
    if (agreement < 1) changedPools++;
  }

  return {
    arm: 'derived-chemistry-on',
    poolCount: runs.length,
    groupCount: allGroups.length,
    composition: aggregateArm('derived-chemistry-on', runs),
    meanChemistryScore: groupTotal === 0 ? 0 : chemistrySum / groupTotal,
    meanPairScore: groupTotal === 0 ? 0 : pairSum / groupTotal,
    offMeanChemistryScore: offGroupTotal === 0 ? 0 : offChemistrySum / offGroupTotal,
    offMeanPairScore: offGroupTotal === 0 ? 0 : offPairSum / offGroupTotal,
    coMembershipAgreement: runs.length === 0 ? 1 : agreementSum / runs.length,
    poolsWithMembershipChange: runs.length === 0 ? 0 : changedPools / runs.length,
  };
}

// ── Item 5 gate-on arm aggregation (M9/M10) ──────────────────────────
// M9 (LOCKED by sprint-contract.item5-composition-rules): ≥95% of committed
//   groups pass all four gates, evaluated with the REAL predicate
//   (evaluateCompositionGates) under the SAME bidirectional pool exemption
//   the matcher computed.
// M10 (LOCKED): unmatched-rate delta vs the gate-off baseline ≤ +2pp.

interface GateArmAggregate {
  arm: string;
  poolCount: number;
  groupCount: number;
  /** M9: exemption-aware share of committed groups passing ALL four gates. */
  allGatesPassRate: number;
  /** Per-gate pass shares over groups where the gate was EVALUATED (cold-start skips and exempt directions excluded). */
  perGate: {
    minE: { pass: number; evaluated: number };
    meanA: { pass: number; evaluated: number };
    sparkMin: { pass: number; evaluated: number };
    sparkMax: { pass: number; evaluated: number };
    xVariance: { pass: number; evaluated: number };
  };
  /** Raw (pre-exemption) composition picture under gates-on, vs the SHIPPED gate constants. */
  sparkDistribution: { zero: number; one: number; twoPlus: number };
  rawViolationRates: { minE: number; meanA: number; xVariance: number; sparkNotExactlyOne: number };
  unmatchedRate: DistSummary;
  /** Mean reported-trait delta (unmatched − matched) — WHO the gates strand. */
  unmatchedTraitDeltas: Record<TraitKey, number> | null;
  exemptPools: { deficit: number; surplus: number; neither: number };
  commitRejections: CompositionGateStats['commitRejections'];
  redistributionRejections: CompositionGateStats['redistributionRejections'];
}

function aggregateGateArm(
  runs: PoolMeasurement[],
  results: Map<number, RunResult>,
  stats: CompositionGateStats
): GateArmAggregate {
  const allGroups = runs.flatMap((r) => r.groups);
  const n = allGroups.length;

  const perGate = {
    minE: { pass: 0, evaluated: 0 },
    meanA: { pass: 0, evaluated: 0 },
    sparkMin: { pass: 0, evaluated: 0 },
    sparkMax: { pass: 0, evaluated: 0 },
    xVariance: { pass: 0, evaluated: 0 },
  };
  let allPass = 0;
  const exemptPools = { deficit: 0, surplus: 0, neither: 0 };

  for (const run of runs) {
    const result = results.get(run.poolIndex)!;
    const poolState = result.sparkPoolState!;
    if (poolState.deficitExempt) exemptPools.deficit++;
    else if (poolState.surplusExempt) exemptPools.surplus++;
    else exemptPools.neither++;

    for (const group of result.groups) {
      // Evaluate with the REAL predicate on the SAME member objects the
      // matcher gated on (traitScores attached at the toUserWithProfile
      // boundary — measurement and gating see identical inputs, AC-5.1b).
      const gateResult = evaluateCompositionGates(group.members, poolState);
      if (gateResult.satisfied) allPass++;
      if (gateResult.evaluated.minE) {
        perGate.minE.evaluated++;
        if (gateResult.minEFloorSatisfied) perGate.minE.pass++;
      }
      if (gateResult.evaluated.meanA) {
        perGate.meanA.evaluated++;
        if (gateResult.meanAFloorSatisfied) perGate.meanA.pass++;
      }
      const sparkCount = group.members.filter(isCompositionSpark).length;
      if (gateResult.evaluated.sparkMin) {
        perGate.sparkMin.evaluated++;
        if (sparkCount >= 1) perGate.sparkMin.pass++;
      }
      if (gateResult.evaluated.sparkMax) {
        perGate.sparkMax.evaluated++;
        if (sparkCount <= 1) perGate.sparkMax.pass++;
      }
      if (gateResult.evaluated.xVariance) {
        perGate.xVariance.evaluated++;
        if (gateResult.xVarianceCapSatisfied) perGate.xVariance.pass++;
      }
    }
  }

  return {
    arm: 'composition-gates-on',
    poolCount: runs.length,
    groupCount: n,
    allGatesPassRate: n === 0 ? 0 : allPass / n,
    perGate,
    sparkDistribution: {
      zero: n === 0 ? 0 : allGroups.filter((g) => g.sparkCount === 0).length / n,
      one: n === 0 ? 0 : allGroups.filter((g) => g.sparkCount === 1).length / n,
      twoPlus: n === 0 ? 0 : allGroups.filter((g) => g.sparkCount >= 2).length / n,
    },
    rawViolationRates: {
      minE: n === 0 ? 0 : allGroups.filter((g) => g.minE < COMPOSITION_MIN_E_FLOOR).length / n,
      meanA: n === 0 ? 0 : allGroups.filter((g) => g.meanA < COMPOSITION_MEAN_A_FLOOR).length / n,
      xVariance: n === 0 ? 0 : allGroups.filter((g) => g.xVariance > COMPOSITION_X_VARIANCE_CAP).length / n,
      sparkNotExactlyOne: n === 0 ? 0 : allGroups.filter((g) => g.sparkCount !== 1).length / n,
    },
    unmatchedRate: dist(runs.map((r) => r.unmatchedRate)),
    unmatchedTraitDeltas: (() => {
      const deltaRuns = runs.filter((r) => r.unmatchedTraitMeans && r.matchedTraitMeans);
      if (deltaRuns.length === 0) return null;
      const deltas = {} as Record<TraitKey, number>;
      for (const t of ALL_TRAITS) {
        deltas[t] = round3(mean(deltaRuns.map((r) => r.unmatchedTraitMeans![t] - r.matchedTraitMeans![t])));
      }
      return deltas;
    })(),
    exemptPools,
    commitRejections: stats.commitRejections,
    redistributionRejections: stats.redistributionRejections,
  };
}

// ── M11: shrinkage group-level payoff ────────────────────────────────

/**
 * Deterministic group alignment between a reference run and an injection run
 * of the SAME pool: greedy max member-overlap (Jaccard), ties broken by group
 * order (groups are produced in deterministic order by the matcher).
 */
function alignGroups(refGroups: MatchGroup[], injGroups: MatchGroup[]): Array<[number, number]> {
  const refIds = refGroups.map((g) => new Set(g.members.map((m) => m.userId)));
  const injIds = injGroups.map((g) => new Set(g.members.map((m) => m.userId)));
  const usedInj = new Set<number>();
  const pairs: Array<[number, number]> = [];

  for (let r = 0; r < refIds.length; r++) {
    let bestJ = -1;
    let bestScore = 0;
    for (let j = 0; j < injIds.length; j++) {
      if (usedInj.has(j)) continue;
      let intersection = 0;
      for (const id of refIds[r]) if (injIds[j].has(id)) intersection++;
      const union = refIds[r].size + injIds[j].size - intersection;
      const jaccard = union === 0 ? 0 : intersection / union;
      if (jaccard > bestScore) {
        bestScore = jaccard;
        bestJ = j;
      }
    }
    if (bestJ >= 0 && bestScore > 0) {
      usedInj.add(bestJ);
      pairs.push([r, bestJ]);
    }
  }
  return pairs;
}

function groupTraitMeans(group: MatchGroup, sessionByUserId: Map<string, SessionProduct>): Record<TraitKey, number> {
  const means = {} as Record<TraitKey, number>;
  for (const t of ALL_TRAITS) {
    means[t] =
      group.members.reduce((s, m) => s + sessionByUserId.get(m.userId)!.reportedTraits[t], 0) /
      group.members.length;
  }
  return means;
}

/**
 * Churn-free report-channel perturbation magnitude: mean per-trait
 * |reported − reference| over the INJECTED members only, where the reference
 * is their clean (off-arm) session. This is the per-member contribution to
 * group-mean movement (each member's contribution to their group's mean is
 * this magnitude / group size, so the aggregate preserves the ordering); it
 * excludes group-membership churn, so it isolates the channel shrinkage
 * operates on — the "group-level stabilization" part of the M11 durable
 * contract.
 */
function injectedPerturbation(
  ref: RunResult,
  injectedRespondents: SyntheticRespondent[],
  sessions: SessionStore,
  arm: 'adv-off' | 'adv-on'
): number {
  let total = 0;
  let n = 0;
  for (const respondent of injectedRespondents) {
    const refSession = ref.sessionByUserId.get(respondent.id);
    if (!refSession) continue;
    const adv = sessions.get(respondent, arm);
    for (const t of ALL_TRAITS) {
      total += Math.abs(adv.reportedTraits[t] - refSession.reportedTraits[t]);
      n++;
    }
  }
  return n > 0 ? total / n : 0;
}

/**
 * Every injected member's per-trait deviation from the no-information value
 * (reported − 50) for one arm. The durable contract's stabilization is the
 * variance reduction of this quantity from shrink-off to shrink-on.
 */
function injectedNeutralValues(
  injectedRespondents: SyntheticRespondent[],
  sessions: SessionStore,
  arm: 'adv-off' | 'adv-on'
): number[] {
  const values: number[] = [];
  for (const respondent of injectedRespondents) {
    const adv = sessions.get(respondent, arm);
    for (const t of ALL_TRAITS) values.push(adv.reportedTraits[t] - 50);
  }
  return values;
}

function variance(xs: number[]): number {
  if (xs.length === 0) return 0;
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) * (x - m)));
}

/** Mean per-trait |Δ group mean| between aligned groups of two runs of the same pool. */
function compositionDelta(ref: RunResult, inj: RunResult): { delta: number; alignedPairs: number } {
  const pairs = alignGroups(ref.groups, inj.groups);
  if (pairs.length === 0) return { delta: 0, alignedPairs: 0 };
  let total = 0;
  for (const [r, j] of pairs) {
    const refMeans = groupTraitMeans(ref.groups[r], ref.sessionByUserId);
    const injMeans = groupTraitMeans(inj.groups[j], inj.sessionByUserId);
    for (const t of ALL_TRAITS) {
      total += Math.abs(injMeans[t] - refMeans[t]);
    }
  }
  return { delta: total / (pairs.length * ALL_TRAITS.length), alignedPairs: pairs.length };
}

interface M11PoolResult {
  poolIndex: number;
  poolSeed: number;
  injectedCount: number;
  deltaOff: number;
  deltaOn: number;
  alignedPairsOff: number;
  alignedPairsOn: number;
  /** Churn-free |reported − clean ref| over injected members (context). */
  fixedDeltaOff: number;
  fixedDeltaOn: number;
}

/**
 * One injection-rate row of the M11 sweep (5/10/20/40%).
 * `meanDeltaOff/On` are the end-to-end (re-matched, Jaccard-aligned) deltas —
 * the absolute movement the smoke alarm bounds. `reduction` is the realized
 * no-information variance reduction `1 − Var(reportedOn−50)/Var(reportedOff−50)`
 * over injected members (the durable contract's stabilization measure);
 * `fixedDeltaOff/On` retain the clean-reference magnitudes for context.
 */
interface M11SweepRateResult {
  rate: number;
  meanDeltaOff: number;
  meanDeltaOn: number;
  endToEndReduction: number | null;
  fixedDeltaOff: number;
  fixedDeltaOn: number;
  /** Population-prior stabilization |reported−TRUE| reduction over injected members. */
  reduction: number | null;
  pools: M11PoolResult[];
}

// ── Statistics formatting ────────────────────────────────────────────

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function f2(x: number): string {
  return x.toFixed(2);
}
function f3(x: number): string {
  return x.toFixed(3);
}
function fmtDist(d: DistSummary): string {
  return `${f2(d.mean)} (p10 ${f2(d.p10)} / p50 ${f2(d.p50)} / p90 ${f2(d.p90)})`;
}

// ── Report ───────────────────────────────────────────────────────────

function buildReport(params: {
  dateStr: string;
  seed: number;
  poolCount: number;
  m11PoolCount: number;
  populationSize: number;
  respondents: SyntheticRespondent[];
  baseline: ArmAggregate;
  flagsOn: ArmAggregate;
  m11: {
    pools: M11PoolResult[];
    meanDeltaOff: number;
    meanDeltaOn: number;
    reduction: number | null;
    pass: boolean | null;
    sweep: M11SweepRateResult[];
    durable: M11DurableEvaluation;
  };
  gateArm: {
    agg: GateArmAggregate;
    m9Pass: boolean;
    m9Target: number;
    m10DeltaPp: number;
    m10Pass: boolean;
    m10MaxDeltaPp: number;
    /** Baseline (gate-off) share of groups above the SHIPPED X-variance cap — the exact bite of gate (iv). */
    baselineXVarAtShippedCap: number;
  } | null;
  /** Item 10 AC-10.5: populated only with --derived-chemistry=on. */
  derivedArm: DerivedArmAggregate | null;
  invariantFailures: InvariantFailure[];
  runtimeSec: number;
  sessionCount: number;
  onlyPool: number | null;
}): string {
  const { baseline, flagsOn, m11 } = params;
  const L: string[] = [];
  L.push(`# Monte Carlo Group-Formation Harness — ${params.dateStr}`);
  L.push('');
  L.push('> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 9.');
  L.push('> Contract: `.git/.orchestration/sprints/sprint-contract.item9-monte-carlo-groups.md`.');
  L.push('> Fully deterministic: identical `--seed` reproduces every number in this report.');
  L.push('> **Instrument-first:** this is the gate-off BASELINE measuring instrument for');
  L.push('> Item 5\'s M9/M10 gates and Item 3\'s M11 — `poolMatchingService` is used');
  L.push('> read-only; no matcher or engine source was modified.');
  L.push('');
  L.push('## Run parameters');
  L.push('');
  L.push(`- Seed: \`${params.seed}\``);
  L.push(`- Pools: ${params.poolCount} (sizes ${POOL_SIZE_MIN}–${POOL_SIZE_MAX}), M11 pools: ${params.m11PoolCount}`);
  L.push(`- Population: ${params.populationSize} synthetic respondents (pools sample without replacement within pool; members recur across pools — documented Monte Carlo relaxation)`);
  L.push(`- Engine sessions computed: ${params.sessionCount} (memoized per respondent × arm)`);
  L.push(`- Runtime: ${params.runtimeSec.toFixed(1)}s`);
  if (params.onlyPool !== null) {
    L.push(`- **Replay mode:** only pool #${params.onlyPool} measured.`);
  }
  L.push('');
  L.push('## How the matcher was driven (feasibility wiring)');
  L.push('');
  L.push('- `runGreedyPoolMatchingCore` (the real in-memory matcher core used by `matchEventPool`) is called directly with: config `{minGroupSize: 4, maxGroupSize: 6, targetGroups: ceil(size/6)}`, a COMPLETE interests cache (every member present → `calculateInterestScoreAsync` never falls through to the DB), `chemistryCalibrationMap: undefined` (static hand-authored matrix — production default while the calibration flag is off), `semanticSimilarityEnabled: false` (6D production default), `strictness: 50` (Match Compass neutral), `magnetismGroupRulesEnabled: false` (**gate-off baseline** — R1–R3 commit gates inert; Item 5 measures its gates against this picture).');
  L.push('- The matcher reads stored `archetype` strings, never raw engine state. Arm wiring therefore runs each respondent through the adaptive engine per arm and feeds the matcher the stored-profile products: flags-off → raw estimates, archetype = engine top-1 on raw vector; flags-on (`enableConsistencyFolding` + `enableTraitShrinkage`) → engine matches on the shrunken vector at the processAnswer match boundary, reported vector = `shrinkTraitsTowardNeutral(traits, confidences)`. Composition metrics below are computed on the REPORTED vectors — exactly what downstream consumers see.');
  L.push('- Duo bonds use the production `duoPairs` parameter ([DUO] atomic-unit guards: atomic seed/admission, MAX 1 duo per group, R1 duo-internal exclusion, 整组顺延 fallback).');
  L.push('');
  L.push('## Population & pool generation');
  L.push('');
  L.push(`1. **Centroid mixture (${pct(CENTROID_MIXTURE_WEIGHT)}):** pick one of the 12 archetype centroids uniformly; each trait ~ Normal(centroid_t, σ=${CENTROID_TRAIT_SD}), truncated to [${TRAIT_MIN}, ${TRAIT_MAX}].`);
  L.push(`2. **General population (${pct(1 - CENTROID_MIXTURE_WEIGHT)}):** each trait ~ Normal(μ=${GENERAL_TRAIT_MEAN}, σ=${GENERAL_TRAIT_SD}), truncated to [${TRAIT_MIN}, ${TRAIT_MAX}].`);
  const centroidCount = params.respondents.filter((r) => r.source === 'centroid_mixture').length;
  L.push(`Realized split: ${centroidCount} centroid-mixture / ${params.populationSize - centroidCount} general.`);
  L.push(`- Pool size: uniform ${POOL_SIZE_MIN}–${POOL_SIZE_MAX}. Duo binding: ${pct(DUO_MEMBER_SHARE)} of members (≥1 duo per pool), exercising the [DUO] guards.`);
  L.push('- Fixed per-respondent profile fields (gender, age 21–37, 8 industries, education, life stage, languages, intents, 3–5 interest topics with heat 10/25) are drawn once and are IDENTICAL across flag arms — only the trait/archetype arm products vary.');
  L.push('');
  L.push('## Assertion classes');
  L.push('');
  L.push('**HARD (exit 1; failing pool index + seed printed for replay):**');
  L.push('- INV-1 every committed group size ∈ [4, 6]');
  L.push('- INV-2 no member in two groups of the same run');
  L.push('- INV-3 duo partners co-located or both unmatched; ≤1 duo unit per group');
  L.push('- INV-4 no NaN/undefined matcher metric');
  L.push(`- INV-5 M11 shrinkage stabilization ≥ ${pct(M11_REDUCTION_TARGET)} reduction (LOCKED, AC-9.4) — **hard only in \`--mode=gated\`**; baseline mode reports the verdict + replay seeds without failing (contract verification method #1: baseline exits 0) so the instrument can run while the ≥50% target and the K=${SHRINKAGE_EXCESS_SCALE} no-harm mechanic are reconciled`);
  L.push('');
  L.push('**MEASUREMENT-ONLY (reported, not gated — thresholds lock in Item 5):**');
  L.push(`- (i) stability floor: group min-E < ${PROV_STABILITY_FLOOR_MIN_E} (PROVISIONAL, Bell 2007 bad-apple prior)`);
  L.push(`- (ii) viability floor: group mean-A < ${PROV_MEAN_A_FLOOR} (PROVISIONAL, Barrick et al. 1998)`);
  L.push(`- (iii) spark distribution: member with X ≥ ${PROV_SPARK_TRAIT_THRESHOLD} or P ≥ ${PROV_SPARK_TRAIT_THRESHOLD} (Item 5 target: exactly one)`);
  L.push(`- (iv) X-variance cap: var(X) > ${PROV_X_VARIANCE_CAP} (PROVISIONAL; std 20 mirrors harmonyScore natural-stdDev ≤ 20)`);
  L.push(`- (v) clone group: max intra-group 6D distance < ${PROV_CLONE_MIN_MAX_DISTANCE} (PROVISIONAL locked minimum)`);
  L.push('- (vi) unmatched rate + flags-on delta (M10 preview: ≤ +2pp once locked)');
  L.push('');

  // ── Baseline composition table ──
  L.push('## Baseline composition (flags OFF — today\'s gate-off picture)');
  L.push('');
  L.push(`${baseline.groupCount} committed groups across ${baseline.poolCount} pools.`);
  L.push('');
  L.push('| Measurement | Distribution (mean, p10/p50/p90) | Violation rate (PROVISIONAL) |');
  L.push('|---|---|---|');
  L.push(`| (i) min-E per group | ${fmtDist(baseline.minE)} | ${pct(baseline.stabilityFloorViolationRate)} below ${PROV_STABILITY_FLOOR_MIN_E} |`);
  L.push(`| (ii) mean-A per group | ${fmtDist(baseline.meanA)} | ${pct(baseline.meanAFloorViolationRate)} below ${PROV_MEAN_A_FLOOR} |`);
  L.push(`| (iv) X-variance per group | ${fmtDist(baseline.xVariance)} | ${pct(baseline.xVarianceCapViolationRate)} above ${PROV_X_VARIANCE_CAP} |`);
  L.push(`| (v) max intra-group distance | ${fmtDist(baseline.maxIntraDistance)} | ${pct(baseline.cloneGroupRate)} clone groups (< ${PROV_CLONE_MIN_MAX_DISTANCE}) |`);
  L.push(`| (vi) unmatched rate per pool | ${fmtDist(baseline.unmatchedRate)} | — |`);
  L.push('');
  L.push('**(iii) Spark-count distribution (high-X/P members per committed group):**');
  L.push('');
  L.push('| Sparks per group | Share of groups |');
  L.push('|---|---|');
  L.push(`| 0 | ${pct(baseline.sparkDistribution.zero)} |`);
  L.push(`| 1 (Item 5 target) | ${pct(baseline.sparkDistribution.one)} |`);
  L.push(`| 2+ | ${pct(baseline.sparkDistribution.twoPlus)} |`);
  L.push('');
  if (baseline.unmatchedTraitDeltas) {
    L.push('**Unmatched-member trait profile (mean reported-trait delta: unmatched − matched, per pool):**');
    L.push('');
    L.push('| Trait | Δ (unmatched − matched) |');
    L.push('|---|---|');
    for (const t of ALL_TRAITS) {
      L.push(`| ${t} | ${baseline.unmatchedTraitDeltas[t] >= 0 ? '+' : ''}${f2(baseline.unmatchedTraitDeltas[t])} |`);
    }
    L.push('');
  }

  // ── Flags-on delta ──
  L.push('## Flags-ON vs flags-OFF (enableConsistencyFolding + enableTraitShrinkage)');
  L.push('');
  L.push('| Metric | flags OFF | flags ON | Δ |');
  L.push('|---|---|---|---|');
  L.push(`| Committed groups | ${baseline.groupCount} | ${flagsOn.groupCount} | ${flagsOn.groupCount - baseline.groupCount >= 0 ? '+' : ''}${flagsOn.groupCount - baseline.groupCount} |`);
  L.push(`| min-E mean | ${f2(baseline.minE.mean)} | ${f2(flagsOn.minE.mean)} | ${flagsOn.minE.mean - baseline.minE.mean >= 0 ? '+' : ''}${f2(flagsOn.minE.mean - baseline.minE.mean)} |`);
  L.push(`| stability-floor violation | ${pct(baseline.stabilityFloorViolationRate)} | ${pct(flagsOn.stabilityFloorViolationRate)} | ${((flagsOn.stabilityFloorViolationRate - baseline.stabilityFloorViolationRate) * 100).toFixed(1)}pp |`);
  L.push(`| mean-A mean | ${f2(baseline.meanA.mean)} | ${f2(flagsOn.meanA.mean)} | ${flagsOn.meanA.mean - baseline.meanA.mean >= 0 ? '+' : ''}${f2(flagsOn.meanA.mean - baseline.meanA.mean)} |`);
  L.push(`| mean-A floor violation | ${pct(baseline.meanAFloorViolationRate)} | ${pct(flagsOn.meanAFloorViolationRate)} | ${((flagsOn.meanAFloorViolationRate - baseline.meanAFloorViolationRate) * 100).toFixed(1)}pp |`);
  L.push(`| spark 0 / 1 / 2+ | ${pct(baseline.sparkDistribution.zero)} / ${pct(baseline.sparkDistribution.one)} / ${pct(baseline.sparkDistribution.twoPlus)} | ${pct(flagsOn.sparkDistribution.zero)} / ${pct(flagsOn.sparkDistribution.one)} / ${pct(flagsOn.sparkDistribution.twoPlus)} | — |`);
  L.push(`| X-variance mean | ${f2(baseline.xVariance.mean)} | ${f2(flagsOn.xVariance.mean)} | ${flagsOn.xVariance.mean - baseline.xVariance.mean >= 0 ? '+' : ''}${f2(flagsOn.xVariance.mean - baseline.xVariance.mean)} |`);
  L.push(`| X-variance cap violation | ${pct(baseline.xVarianceCapViolationRate)} | ${pct(flagsOn.xVarianceCapViolationRate)} | ${((flagsOn.xVarianceCapViolationRate - baseline.xVarianceCapViolationRate) * 100).toFixed(1)}pp |`);
  L.push(`| clone-group rate | ${pct(baseline.cloneGroupRate)} | ${pct(flagsOn.cloneGroupRate)} | ${((flagsOn.cloneGroupRate - baseline.cloneGroupRate) * 100).toFixed(1)}pp |`);
  const unmatchedDeltaPp = (flagsOn.unmatchedRate.mean - baseline.unmatchedRate.mean) * 100;
  L.push(`| unmatched rate (mean) | ${pct(baseline.unmatchedRate.mean)} | ${pct(flagsOn.unmatchedRate.mean)} | ${unmatchedDeltaPp >= 0 ? '+' : ''}${unmatchedDeltaPp.toFixed(1)}pp (M10 preview: ≤ +2pp once locked) |`);
  L.push('');

  // ── M11 ──
  L.push('## M11 — shrinkage group-level payoff (durable contract, P3-reformulated)');
  L.push('');
  L.push(`Injection model: a share of each M11 pool's members replaced by low-confidence respondents answering via the random-clicker policy (Item 7 machinery, same true traits). Reference = the same pool with zero injection under the SAME flag state. Delta = mean per-trait |Δ group mean| over deterministic Jaccard-aligned groups. Injection-rate SWEEP: ${m11.sweep.map((s) => pct(s.rate)).join(' / ')}.`);
  L.push('');
  const d = m11.durable;
  L.push(`**Durable contract (calibration-anchored; supersedes the retired ≥${pct(M11_REDUCTION_TARGET)} relative target).**`);
  L.push('');
  L.push(`- (a) **Per-session bounded error:** worst post-shrink/prior expected-error ratio over the Item 12 curve = ${f3(d.boundedError.maxRatio)} at conf ${f3(d.boundedError.maxRatioConfidence)} (prior error ${f2(d.boundedError.priorError)} pts) → ${d.boundedErrorPass ? '✅ PASS' : '❌ FAIL'} (shrinkage never worse than the no-information baseline).`);
  L.push(`- (b) **Ceiling-normalized stabilization:** realized no-information variance reduction ${pct(d.achieved)} vs calibration-implied ceiling ${pct(d.ceiling)} (mean 1−w² over the injected confidences) = ${pct(d.ceilingFractionAchieved)} of ceiling → ${d.groupStabilizationPass ? '✅ PASS' : '❌ FAIL'} (bar ≥ ${pct(M11_CEILING_FRACTION)} of ceiling).`);
  L.push(`- **Absolute smoke alarm:** ${pct(M11_SMOKE_RATE)}-injection Δoff = ${f3(m11.meanDeltaOff)} ≤ ${M11_SMOKE_ALARM_MAX_DELTA} pts → ${d.smokeAlarmPass ? '✅ PASS' : '❌ FAIL'}.`);
  L.push(`- **Sweep envelope:** reduction ≥ 0 at every rate → ${d.envelopePass ? '✅ PASS' : '❌ FAIL'}.`);
  L.push('');
  L.push(`**M11 durable contract: ${d.pass ? '✅ PASS' : '❌ FAIL'}** (bounded error ${d.boundedErrorPass ? '✅' : '❌'} · group stabilization ${d.groupStabilizationPass ? '✅' : '❌'} · smoke alarm ${d.smokeAlarmPass ? '✅' : '❌'} · envelope ${d.envelopePass ? '✅' : '❌'}).`);
  L.push('');
  L.push('| Rate | Δoff (end-to-end) | Δon (end-to-end) | Ref Δoff | Ref Δon | Stabilization (prior) | Δoff ≤ 5 pts? |');
  L.push('|---|---|---|---|---|---|---|');
  for (const s of m11.sweep) {
    const red = s.reduction === null ? 'n/a' : pct(s.reduction);
    L.push(
      `| ${pct(s.rate)} | ${f3(s.meanDeltaOff)} | ${f3(s.meanDeltaOn)} | ${f3(s.fixedDeltaOff)} | ${f3(s.fixedDeltaOn)} | ${red} | ${s.meanDeltaOff <= M11_SMOKE_ALARM_MAX_DELTA ? '✅' : '❌'} |`
    );
  }
  L.push('');
  L.push('_End-to-end deltas include group-membership churn (noisy at low rates); the stabilization column is the churn-free fixed-composition measure the durable contract consumes._');
  L.push('');
  L.push(`_Legacy reference (retired target, retained for history):_ 20%-injection reduction ${m11.reduction === null ? 'n/a' : pct(m11.reduction)} vs the old ≥ ${pct(M11_REDUCTION_TARGET)} bar — the conflict that motivated the reformulation. Mechanical first-order ceiling of the shipped K=${SHRINKAGE_EXCESS_SCALE} at worst-case confidence: ≈ ${pct(M11_FIRST_ORDER_CEILING)} (w_min ≈ ${f3(M11_MIN_WEIGHT_SHIPPED)}; floor ${SHRINKAGE_ERROR_FLOOR.toFixed(2)}).`);
  L.push('');

  // ── Item 5 gate-on section (only emitted for --composition-gates=on) ──
  if (params.gateArm) {
    const g = params.gateArm.agg;
    const gatePassPct = (x: { pass: number; evaluated: number }) =>
      x.evaluated === 0 ? 'n/a (0 evaluated)' : pct(x.pass / x.evaluated);
    L.push('## Item 5 composition gates ON (flags-off reported vectors)');
    L.push('');
    L.push(`Gate constants (shipped): min-E floor ${COMPOSITION_MIN_E_FLOOR} (Barrick et al. 1998), mean-A floor ${COMPOSITION_MEAN_A_FLOOR} (Bell 2007), spark = X ≥ ${COMPOSITION_SPARK_TRAIT_THRESHOLD} ∨ P ≥ ${COMPOSITION_SPARK_TRAIT_THRESHOLD} (LOCKED Item 9 definition), X-variance cap ${COMPOSITION_X_VARIANCE_CAP}.`);
    L.push('');
    L.push(`Pool-level spark exemption (bidirectional): deficit-exempt pools ${g.exemptPools.deficit} / surplus-exempt pools ${g.exemptPools.surplus} / fully enforced ${g.exemptPools.neither} (of ${g.poolCount}).`);
    L.push('');
    L.push('| Gate | Pass share (exemption-aware, over evaluated groups) | Evaluated |');
    L.push('|---|---|---|');
    L.push(`| (i) min-E ≥ ${COMPOSITION_MIN_E_FLOOR} | ${gatePassPct(g.perGate.minE)} | ${g.perGate.minE.evaluated} |`);
    L.push(`| (ii) mean-A ≥ ${COMPOSITION_MEAN_A_FLOOR} | ${gatePassPct(g.perGate.meanA)} | ${g.perGate.meanA.evaluated} |`);
    L.push(`| (iii-a) ≥1 spark | ${gatePassPct(g.perGate.sparkMin)} | ${g.perGate.sparkMin.evaluated} |`);
    L.push(`| (iii-b) ≤1 spark | ${gatePassPct(g.perGate.sparkMax)} | ${g.perGate.sparkMax.evaluated} |`);
    L.push(`| (iv) var(X) ≤ ${COMPOSITION_X_VARIANCE_CAP} | ${gatePassPct(g.perGate.xVariance)} | ${g.perGate.xVariance.evaluated} |`);
    L.push('');
    L.push('**Raw (pre-exemption) composition picture under gates-ON:**');
    L.push('');
    L.push('| Measurement | Baseline (gates OFF) | Gates ON |');
    L.push('|---|---|---|');
    L.push(`| spark 0 / 1 / 2+ | ${pct(baseline.sparkDistribution.zero)} / ${pct(baseline.sparkDistribution.one)} / ${pct(baseline.sparkDistribution.twoPlus)} | ${pct(g.sparkDistribution.zero)} / ${pct(g.sparkDistribution.one)} / ${pct(g.sparkDistribution.twoPlus)} |`);
    L.push(`| min-E < ${COMPOSITION_MIN_E_FLOOR} | ${pct(baseline.stabilityFloorViolationRate)} | ${pct(g.rawViolationRates.minE)} |`);
    L.push(`| mean-A < ${COMPOSITION_MEAN_A_FLOOR} | ${pct(baseline.meanAFloorViolationRate)} | ${pct(g.rawViolationRates.meanA)} |`);
    L.push(`| var(X) > ${COMPOSITION_X_VARIANCE_CAP} (shipped cap) | ${pct(params.gateArm.baselineXVarAtShippedCap)} | ${pct(g.rawViolationRates.xVariance)} |`);
    L.push(`| unmatched rate (mean) | ${pct(baseline.unmatchedRate.mean)} | ${pct(g.unmatchedRate.mean)} |`);
    L.push('');
    if (g.unmatchedTraitDeltas) {
      L.push('**Gate-on stranded-member trait profile (mean reported-trait delta: unmatched − matched, per pool):**');
      L.push('');
      L.push('| Trait | Δ (unmatched − matched) |');
      L.push('|---|---|');
      for (const t of ALL_TRAITS) {
        L.push(`| ${t} | ${g.unmatchedTraitDeltas[t] >= 0 ? '+' : ''}${f2(g.unmatchedTraitDeltas[t])} |`);
      }
      L.push('');
    }
    L.push('**Per-gate rejection counts (matcher stats collector):**');
    L.push('');
    L.push('| Gate | Commit-gate rejections | Redistribution rejections |');
    L.push('|---|---|---|');
    L.push(`| (i) min-E floor | ${g.commitRejections.minEFloor} | ${g.redistributionRejections.minEFloor} |`);
    L.push(`| (ii) mean-A floor | ${g.commitRejections.meanAFloor} | ${g.redistributionRejections.meanAFloor} |`);
    L.push(`| (iii) spark rule | ${g.commitRejections.sparkRule} | ${g.redistributionRejections.sparkRule} |`);
    L.push(`| (iv) X-variance cap | ${g.commitRejections.xVarianceCap} | ${g.redistributionRejections.xVarianceCap} |`);
    L.push(`| **total groups rejected** | ${g.commitRejections.total} | ${g.redistributionRejections.total} |`);
    L.push('');
    L.push(`**M9 (LOCKED ≥ ${pct(params.gateArm.m9Target)} all-gates pass, exemption-aware): ${params.gateArm.m9Pass ? '✅ PASS' : '❌ FAIL'}** — ${pct(g.allGatesPassRate)} of ${g.groupCount} committed groups.`);
    L.push(`**M10 (LOCKED ≤ +${params.gateArm.m10MaxDeltaPp}pp unmatched): ${params.gateArm.m10Pass ? '✅ PASS' : '❌ FAIL'}** — delta ${params.gateArm.m10DeltaPp >= 0 ? '+' : ''}${params.gateArm.m10DeltaPp.toFixed(2)}pp vs gate-off baseline (${pct(baseline.unmatchedRate.mean)} → ${pct(g.unmatchedRate.mean)}).`);
    L.push('');
  }

  // ── Item 10 derived-chemistry arm (only emitted for --derived-chemistry=on) ──
  if (params.derivedArm) {
    const d = params.derivedArm;
    const c = d.composition;
    const delta = (on: number, off: number) => `${on - off >= 0 ? '+' : ''}${f2(on - off)}`;
    L.push('## Item 10 derived chemistry ON vs OFF (AC-10.5 rollout evidence)');
    L.push('');
    L.push('Same pools, flags-off reported vectors. **OFF** = hand-authored `compatibilityMatrix`; **ON** = mechanically derived matrix (similarity on A/E/C + complementarity on X/P, `derivedChemistryEnabled`). Chemistry is 28% of the 6D pair score (70% primary / 15%+15% cross), so a rank shift can move members between groups.');
    L.push('');
    L.push('| Metric | derived OFF | derived ON | Δ |');
    L.push('|---|---|---|---|');
    L.push(`| Committed groups | ${baseline.groupCount} | ${d.groupCount} | ${d.groupCount - baseline.groupCount >= 0 ? '+' : ''}${d.groupCount - baseline.groupCount} |`);
    L.push(`| Mean group chemistry score | ${f2(d.offMeanChemistryScore)} | ${f2(d.meanChemistryScore)} | ${delta(d.meanChemistryScore, d.offMeanChemistryScore)} |`);
    L.push(`| Mean group pair score | ${f2(d.offMeanPairScore)} | ${f2(d.meanPairScore)} | ${delta(d.meanPairScore, d.offMeanPairScore)} |`);
    L.push(`| min-E mean | ${f2(baseline.minE.mean)} | ${f2(c.minE.mean)} | ${delta(c.minE.mean, baseline.minE.mean)} |`);
    L.push(`| mean-A mean | ${f2(baseline.meanA.mean)} | ${f2(c.meanA.mean)} | ${delta(c.meanA.mean, baseline.meanA.mean)} |`);
    L.push(`| spark 0 / 1 / 2+ | ${pct(baseline.sparkDistribution.zero)} / ${pct(baseline.sparkDistribution.one)} / ${pct(baseline.sparkDistribution.twoPlus)} | ${pct(c.sparkDistribution.zero)} / ${pct(c.sparkDistribution.one)} / ${pct(c.sparkDistribution.twoPlus)} | — |`);
    L.push(`| X-variance mean | ${f2(baseline.xVariance.mean)} | ${f2(c.xVariance.mean)} | ${delta(c.xVariance.mean, baseline.xVariance.mean)} |`);
    L.push(`| clone-group rate | ${pct(baseline.cloneGroupRate)} | ${pct(c.cloneGroupRate)} | ${((c.cloneGroupRate - baseline.cloneGroupRate) * 100).toFixed(1)}pp |`);
    const derUnmatchedDeltaPp = (c.unmatchedRate.mean - baseline.unmatchedRate.mean) * 100;
    L.push(`| unmatched rate (mean) | ${pct(baseline.unmatchedRate.mean)} | ${pct(c.unmatchedRate.mean)} | ${derUnmatchedDeltaPp >= 0 ? '+' : ''}${derUnmatchedDeltaPp.toFixed(1)}pp |`);
    L.push('');
    L.push(`**Group-formation agreement (pairwise co-membership, OFF vs ON): ${pct(d.coMembershipAgreement)}**`);
    L.push(`**Pools with at least one member changing group/unmatched status: ${pct(d.poolsWithMembershipChange)}** (of ${d.poolCount}).`);
    L.push('');
    L.push(d.coMembershipAgreement >= 0.995
      ? 'Verdict: **no material group-formation shift** — the derived matrix preserves the authored grouping across essentially all pairs.'
      : 'Verdict: **material group-formation shift** — the derived matrix re-assigns members; rollout must weigh quality (above) against churn before enabling.');
    L.push('');
  }

  // ── Invariants ──
  L.push('## Structural invariants');
  L.push('');
  if (params.invariantFailures.length === 0) {
    L.push('- INV-1 group size bounds: ✅ PASS');
    L.push('- INV-2 member uniqueness: ✅ PASS');
    L.push('- INV-3 duo atomicity + ≤1 duo per group: ✅ PASS');
    L.push('- INV-4 no NaN metrics: ✅ PASS');
  } else {
    for (const f of params.invariantFailures.slice(0, 20)) {
      L.push(`- ❌ ${f.kind} pool#${f.poolIndex} (seed ${f.poolSeed}) arm=${f.arm}: ${f.detail}`);
    }
  }
  L.push('');
  L.push('---');
  L.push('Generated by `npm run simulate:groups` (`scripts/simulate/run-group-monte-carlo.ts`).');
  L.push('');
  return L.join('\n');
}

// ── JSON artifact ────────────────────────────────────────────────────

function summarizeDist(d: DistSummary) {
  return { n: d.n, mean: round6(d.mean), p10: round6(d.p10), p50: round6(d.p50), p90: round6(d.p90) };
}

function summarizeArm(a: ArmAggregate) {
  return {
    arm: a.arm,
    poolCount: a.poolCount,
    groupCount: a.groupCount,
    minE: summarizeDist(a.minE),
    meanA: summarizeDist(a.meanA),
    xVariance: summarizeDist(a.xVariance),
    maxIntraDistance: summarizeDist(a.maxIntraDistance),
    sparkDistribution: {
      zero: round6(a.sparkDistribution.zero),
      one: round6(a.sparkDistribution.one),
      twoPlus: round6(a.sparkDistribution.twoPlus),
    },
    stabilityFloorViolationRate: round6(a.stabilityFloorViolationRate),
    meanAFloorViolationRate: round6(a.meanAFloorViolationRate),
    xVarianceCapViolationRate: round6(a.xVarianceCapViolationRate),
    cloneGroupRate: round6(a.cloneGroupRate),
    unmatchedRate: summarizeDist(a.unmatchedRate),
    unmatchedTraitDeltas: a.unmatchedTraitDeltas,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { pools, m11Pools, population, seed, onlyPool, outFile, jsonOutFile, mode, compositionGates, derivedChemistry } = parseArgs();

  if (mode === 'gated') {
    console.log('🔒 --mode=gated: INV-5 (M11) will hard-fail;');
    console.log('   M9/M10 hard-fail only when combined with --composition-gates=on (Item 5 locked targets).');
  }
  if (compositionGates) {
    console.log('🧱 --composition-gates=on: Item 5 composition gates arm added (flags-off trait vectors);');
    console.log('   baseline/flags-on/M11 arms are unchanged; outputs default to -gates-on suffixed paths.');
  }
  if (derivedChemistry) {
    console.log('🧬 --derived-chemistry=on: Item 10 derived-chemistry arm added (flags-off vectors);');
    console.log('   reports derived-on vs off group-formation impact (AC-10.5).');
  }
  if (pools < 1 || population < POOL_SIZE_MAX) {
    console.error('❌ population must be ≥ 60 and pools ≥ 1.');
    process.exit(1);
  }
  if (m11Pools > pools) {
    console.error('❌ --m11-pools cannot exceed --pools (M11 pools are the first K pools).');
    process.exit(1);
  }

  const startedAt = Date.now();

  // 1. Population + fixed profiles
  const respondents = generatePopulation(population, seed);
  const profiles = respondents.map((_, i) => generateProfile(i, seed));

  // 2. Pools
  const allPools = generatePools(pools, respondents, profiles, seed);
  const measuredPools = onlyPool !== null ? allPools.filter((p) => p.index === onlyPool) : allPools;
  if (onlyPool !== null && measuredPools.length === 0) {
    console.error(`❌ --only-pool=${onlyPool} out of range (0..${pools - 1}).`);
    process.exit(1);
  }

  // 3. Main arms: flags-off vs flags-on
  const sessions = new SessionStore(seed);
  const invariantFailures: InvariantFailure[] = [];
  const offRuns: PoolMeasurement[] = [];
  const onRuns: PoolMeasurement[] = [];
  const offResults = new Map<number, RunResult>();
  const onResults = new Map<number, RunResult>();
  // Item 5 gate-on arm state (only populated when --composition-gates=on).
  const gatedRuns: PoolMeasurement[] = [];
  const gatedResults = new Map<number, RunResult>();
  const gateStatsTotal = createCompositionGateStats();
  // Item 10 derived-chemistry arm state (only populated when --derived-chemistry=on).
  const derivedRuns: PoolMeasurement[] = [];
  const derivedResults = new Map<number, RunResult>();

  for (const pool of measuredPools) {
    const off = await runMatchForPool(pool, sessions, () => 'off');
    const on = await runMatchForPool(pool, sessions, () => 'on');
    offResults.set(pool.index, off);
    onResults.set(pool.index, on);
    invariantFailures.push(...checkRunInvariants(pool, 'off', off));
    invariantFailures.push(...checkRunInvariants(pool, 'on', on));
    offRuns.push(measurePoolRun(pool, off));
    onRuns.push(measurePoolRun(pool, on));

    // Item 5 gate-on arm (opt-in via --composition-gates=on): SAME pool,
    // flags-off reported vectors, composition gates threaded into the REAL
    // matcher core. M11 injection runs below stay gates-off (locked baseline).
    if (compositionGates) {
      const gated = await runMatchForPool(pool, sessions, () => 'off', true, gateStatsTotal);
      gatedResults.set(pool.index, gated);
      invariantFailures.push(...checkRunInvariants(pool, 'gates-on', gated));
      gatedRuns.push(measurePoolRun(pool, gated));
    }

    // Item 10 derived-chemistry arm (opt-in via --derived-chemistry=on): SAME
    // pool, flags-off reported vectors, derived chemistry threaded into the
    // REAL matcher core. Compared against the flags-off baseline above.
    if (derivedChemistry) {
      const derived = await runMatchForPool(pool, sessions, () => 'off', false, undefined, true);
      derivedResults.set(pool.index, derived);
      invariantFailures.push(...checkRunInvariants(pool, 'derived-on', derived));
      derivedRuns.push(measurePoolRun(pool, derived));
    }
  }

  // 4. M11 arm (first K measured pools; 20% low-confidence injection)
  // 4. M11 injection-rate sweep (5/10/20/40%; plan reformulation) over the
  //    first K measured pools. The 20% rate keeps the original stream tag so
  //    the headline point is byte-identical to the Item-9 baseline. An injected
  //    member's adv-off session provides the per-trait confidences that anchor
  //    the calibration-implied ceiling.
  const m11Measured = measuredPools.slice(0, m11Pools);
  const m11Sweep: M11SweepRateResult[] = [];
  let smokeInjectedConfidences: number[] = [];

  for (const rate of M11_INJECTION_RATES) {
    const isSmoke = Math.abs(rate - M11_SMOKE_RATE) < 1e-9;
    const pools: M11PoolResult[] = [];
    const perPoolInjected: Array<{ pool: SyntheticPool; injected: Set<number> }> = [];
    const rateOffValues: number[] = [];
    const rateOnValues: number[] = [];

    for (const pool of m11Measured) {
      const rng = mulberry32(streamSeed(seed, pool.index, isSmoke ? 'm11' : `m11:${rate}`));
      const injectedCount = Math.max(1, Math.round(pool.size * rate));
      const injected = new Set<number>();
      while (injected.size < injectedCount && injected.size < pool.members.length) {
        injected.add(Math.floor(rng() * pool.members.length));
      }
      perPoolInjected.push({ pool, injected });

      const armFor = (arm: 'adv-off' | 'adv-on', base: 'off' | 'on') => (member: PoolMember): SessionArm => {
        const memberIdx = pool.members.indexOf(member);
        return injected.has(memberIdx) ? arm : base;
      };

      const injOff = await runMatchForPool(pool, sessions, armFor('adv-off', 'off'));
      const injOn = await runMatchForPool(pool, sessions, armFor('adv-on', 'on'));
      invariantFailures.push(...checkRunInvariants(pool, `m11-inj-off@${rate}`, injOff));
      invariantFailures.push(...checkRunInvariants(pool, `m11-inj-on@${rate}`, injOn));

      const refOff = offResults.get(pool.index)!;
      const refOn = onResults.get(pool.index)!;
      const deltaOff = compositionDelta(refOff, injOff);
      const deltaOn = compositionDelta(refOn, injOn);
      // Churn-free report-channel magnitudes over ONLY the injected members,
      // shrink-off vs shrink-on, so non-injected shrinkage cannot contaminate
      // the measurement.
      const injectedRespondents = [...injected].map((i) => pool.members[i].respondent);
      const fixedOff = injectedPerturbation(refOff, injectedRespondents, sessions, 'adv-off');
      const fixedOn = injectedPerturbation(refOff, injectedRespondents, sessions, 'adv-on');
      rateOffValues.push(...injectedNeutralValues(injectedRespondents, sessions, 'adv-off'));
      rateOnValues.push(...injectedNeutralValues(injectedRespondents, sessions, 'adv-on'));
      pools.push({
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        injectedCount: injected.size,
        deltaOff: deltaOff.delta,
        deltaOn: deltaOn.delta,
        alignedPairsOff: deltaOff.alignedPairs,
        alignedPairsOn: deltaOn.alignedPairs,
        fixedDeltaOff: fixedOff,
        fixedDeltaOn: fixedOn,
      });
    }

    const rateDeltaOff = mean(pools.map((r) => r.deltaOff));
    const rateDeltaOn = mean(pools.map((r) => r.deltaOn));
    const endToEndReduction = rateDeltaOff < M11_MIN_DELTA_OFF ? null : 1 - rateDeltaOn / rateDeltaOff;
    const fixedOffMean = mean(pools.map((r) => r.fixedDeltaOff));
    const fixedOnMean = mean(pools.map((r) => r.fixedDeltaOn));
    const varOff = variance(rateOffValues);
    const varOn = variance(rateOnValues);
    // Realized no-information variance reduction (the durable stabilization).
    const stabilization = varOff > 1e-6 ? 1 - varOn / varOff : null;
    m11Sweep.push({
      rate,
      meanDeltaOff: rateDeltaOff,
      meanDeltaOn: rateDeltaOn,
      endToEndReduction,
      fixedDeltaOff: fixedOffMean,
      fixedDeltaOn: fixedOnMean,
      reduction: stabilization,
      pools,
    });

    if (isSmoke) {
      for (const { pool, injected } of perPoolInjected) {
        for (let i = 0; i < pool.members.length; i++) {
          if (!injected.has(i)) continue;
          const adv = sessions.get(pool.members[i].respondent, 'adv-off');
          for (const t of ALL_TRAITS) smokeInjectedConfidences.push(adv.traitConfidences[t]);
        }
      }
    }
  }

  const smokeSweep = m11Sweep.find((s) => Math.abs(s.rate - M11_SMOKE_RATE) < 1e-9)!;
  const m11PoolResults = smokeSweep.pools;
  const meanDeltaOff = smokeSweep.meanDeltaOff;
  const meanDeltaOn = smokeSweep.meanDeltaOn;
  // Legacy end-to-end reduction (the retired ≥50% metric); the durable
  // contract's stabilization is `smokeSweep.reduction` (variance reduction).
  const m11Reduction = meanDeltaOff < M11_MIN_DELTA_OFF ? null : 1 - meanDeltaOn / meanDeltaOff;
  // Legacy ≥50% verdict — retained for history/observability only; the gate
  // uses the durable contract below.
  const m11Pass = m11Reduction === null ? null : m11Reduction >= M11_REDUCTION_TARGET;
  // Population's empirical no-information baseline E|true − 50|: the
  // population-specific half of the durable ceiling (the curve supplies the
  // shrinkable error). Auto-updates with the mixture.
  const populationPriorError =
    respondents.reduce(
      (sum, r) => sum + ALL_TRAITS.reduce((ss, t) => ss + Math.abs(r.trueTraits[t] - 50), 0),
      0
    ) /
    (respondents.length * ALL_TRAITS.length);
  const m11Durable = evaluateM11DurableContract({
    fit: FITTED_CONFIDENCE_CALIBRATION,
    injectedConfidences: smokeInjectedConfidences,
    sweep: m11Sweep.map((s) => ({
      rate: s.rate,
      meanDeltaOff: s.meanDeltaOff,
      meanDeltaOn: s.meanDeltaOn,
      reduction: s.reduction,
    })),
  });

  // 5. Aggregates
  const baseline = aggregateArm('flags-off', offRuns);
  const flagsOn = aggregateArm('flags-on', onRuns);

  // Item 5 gate-on aggregate + LOCKED M9/M10 verdicts (gate-on runs only).
  const M9_TARGET = 0.95;
  const M10_MAX_DELTA_PP = 2;
  const gateArm = compositionGates ? aggregateGateArm(gatedRuns, gatedResults, gateStatsTotal) : null;
  // Item 10 AC-10.5: derived-on vs off group-formation impact.
  const derivedArm = derivedChemistry ? aggregateDerivedArm(derivedRuns, offResults, derivedResults) : null;
  const m9Pass = gateArm ? gateArm.allGatesPassRate >= M9_TARGET : null;
  const m10DeltaPp = gateArm ? (gateArm.unmatchedRate.mean - baseline.unmatchedRate.mean) * 100 : null;
  const m10Pass = m10DeltaPp !== null ? m10DeltaPp <= M10_MAX_DELTA_PP : null;

  const runtimeSec = (Date.now() - startedAt) / 1000;
  const dateStr = new Date().toISOString().slice(0, 10);

  const report = buildReport({
    dateStr,
    seed,
    poolCount: measuredPools.length,
    m11PoolCount: m11Measured.length,
    populationSize: population,
    respondents,
    baseline,
    flagsOn,
    m11: {
      pools: m11PoolResults,
      meanDeltaOff,
      meanDeltaOn,
      reduction: m11Reduction,
      pass: m11Pass,
      sweep: m11Sweep,
      durable: m11Durable,
    },
    gateArm: gateArm && m9Pass !== null && m10DeltaPp !== null && m10Pass !== null
      ? {
          agg: gateArm,
          m9Pass,
          m9Target: M9_TARGET,
          m10DeltaPp,
          m10Pass,
          m10MaxDeltaPp: M10_MAX_DELTA_PP,
          baselineXVarAtShippedCap: (() => {
            const baseGroups = offRuns.flatMap((r) => r.groups);
            return baseGroups.length === 0
              ? 0
              : baseGroups.filter((gr) => gr.xVariance > COMPOSITION_X_VARIANCE_CAP).length / baseGroups.length;
          })(),
        }
      : null,
    derivedArm,
    invariantFailures,
    runtimeSec,
    sessionCount: sessions.size,
    onlyPool,
  });

  // Gate-on runs default to -gates-on suffixed paths so the LOCKED baseline
  // artifacts (report + JSON) are never clobbered; gate-off default runs
  // keep the original paths and must diff-clean against them (AC-5.5).
  // Non-default arms suffix their artifacts so the flag-off baseline is never
  // clobbered (default run → empty suffix → byte-identical paths/content).
  const modeSuffix = `${compositionGates ? '-gates-on' : ''}${derivedChemistry ? '-derived-on' : ''}`;
  const defaultOutName = `${dateStr}-monte-carlo-group-formation${modeSuffix}.md`;
  const outPath = outFile
    ? path.resolve(outFile)
    : path.join(__dirname, '..', '..', 'docs', 'reports', defaultOutName);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');

  const jsonPath = jsonOutFile
    ? path.resolve(jsonOutFile)
    : path.join(__dirname, 'data', `group-monte-carlo${modeSuffix}-latest.json`);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  const json: Record<string, unknown> = {
    generatedAt: dateStr,
    seed,
    poolCount: measuredPools.length,
    m11PoolCount: m11Measured.length,
    populationSize: population,
    provisionalThresholds: {
      stabilityFloorMinE: PROV_STABILITY_FLOOR_MIN_E,
      meanAFloor: PROV_MEAN_A_FLOOR,
      sparkTraitThreshold: PROV_SPARK_TRAIT_THRESHOLD,
      xVarianceCap: PROV_X_VARIANCE_CAP,
      cloneMinMaxDistance: PROV_CLONE_MIN_MAX_DISTANCE,
    },
    baseline: summarizeArm(baseline),
    flagsOn: summarizeArm(flagsOn),
    m11: {
      // Legacy ≥50% fields (retained for history; the gate ignores them).
      meanDeltaOff: round6(meanDeltaOff),
      meanDeltaOn: round6(meanDeltaOn),
      reduction: m11Reduction === null ? null : round6(m11Reduction),
      target: M11_REDUCTION_TARGET,
      pass: m11Pass,
      pools: m11PoolResults.map((p) => ({ ...p, deltaOff: round6(p.deltaOff), deltaOn: round6(p.deltaOn) })),
      // P3 durable contract (the actual gate) + injection-rate sweep.
      sweep: m11Sweep.map((s) => ({
        rate: s.rate,
        poolCount: s.pools.length,
        meanDeltaOff: round6(s.meanDeltaOff),
        meanDeltaOn: round6(s.meanDeltaOn),
        endToEndReduction: s.endToEndReduction === null ? null : round6(s.endToEndReduction),
        fixedDeltaOff: round6(s.fixedDeltaOff),
        fixedDeltaOn: round6(s.fixedDeltaOn),
        reduction: s.reduction === null ? null : round6(s.reduction),
      })),
      durable: {
        pass: m11Durable.pass,
        boundedErrorPass: m11Durable.boundedErrorPass,
        groupStabilizationPass: m11Durable.groupStabilizationPass,
        smokeAlarmPass: m11Durable.smokeAlarmPass,
        envelopePass: m11Durable.envelopePass,
        boundedError: {
          priorError: round6(m11Durable.boundedError.priorError),
          maxRatio: round6(m11Durable.boundedError.maxRatio),
          maxRatioConfidence: round6(m11Durable.boundedError.maxRatioConfidence),
          noInfoCeiling: round6(m11Durable.boundedError.noInfoCeiling),
          optimalNoInfoCeiling: round6(m11Durable.boundedError.optimalNoInfoCeiling),
        },
        ceiling: round6(m11Durable.ceiling),
        achieved: round6(m11Durable.achieved),
        ceilingFractionAchieved: round6(m11Durable.ceilingFractionAchieved),
        populationPriorError: round6(populationPriorError),
        ceilingFraction: M11_CEILING_FRACTION,
        smokeRate: M11_SMOKE_RATE,
        smokeMaxDelta: M11_SMOKE_ALARM_MAX_DELTA,
        injectionRates: [...M11_INJECTION_RATES],
        injectedConfidenceSamples: smokeInjectedConfidences.length,
        meanInjectedConfidence: smokeInjectedConfidences.length > 0 ? round6(mean(smokeInjectedConfidences)) : null,
      },
    },
    invariantFailures,
  };
  // Item 5 gate-on payload — added ONLY in gate-on mode so the gate-off
  // artifact stays byte-identical against the locked baseline JSON (AC-5.5).
  if (gateArm) {
    json.compositionGates = {
      constants: {
        minEFloor: COMPOSITION_MIN_E_FLOOR,
        meanAFloor: COMPOSITION_MEAN_A_FLOOR,
        sparkTraitThreshold: COMPOSITION_SPARK_TRAIT_THRESHOLD,
        xVarianceCap: COMPOSITION_X_VARIANCE_CAP,
      },
      allGatesPassRate: round6(gateArm.allGatesPassRate),
      m9: { target: M9_TARGET, pass: m9Pass },
      unmatchedRate: summarizeDist(gateArm.unmatchedRate),
      m10: { deltaPp: round6(m10DeltaPp!), maxDeltaPp: M10_MAX_DELTA_PP, pass: m10Pass },
      perGate: gateArm.perGate,
      sparkDistribution: {
        zero: round6(gateArm.sparkDistribution.zero),
        one: round6(gateArm.sparkDistribution.one),
        twoPlus: round6(gateArm.sparkDistribution.twoPlus),
      },
      rawViolationRates: {
        minE: round6(gateArm.rawViolationRates.minE),
        meanA: round6(gateArm.rawViolationRates.meanA),
        xVariance: round6(gateArm.rawViolationRates.xVariance),
        sparkNotExactlyOne: round6(gateArm.rawViolationRates.sparkNotExactlyOne),
      },
      exemptPools: gateArm.exemptPools,
      unmatchedTraitDeltas: gateArm.unmatchedTraitDeltas,
      baselineXVarAtShippedCap: round6((() => {
        const baseGroups = offRuns.flatMap((r) => r.groups);
        return baseGroups.length === 0
          ? 0
          : baseGroups.filter((gr) => gr.xVariance > COMPOSITION_X_VARIANCE_CAP).length / baseGroups.length;
      })()),
      commitRejections: gateArm.commitRejections,
      redistributionRejections: gateArm.redistributionRejections,
    };
  }
  // Item 10 AC-10.5 payload — added ONLY in derived-chemistry mode so the
  // flag-off artifact stays byte-identical.
  if (derivedArm) {
    json.derivedChemistry = {
      arm: derivedArm.arm,
      comparison: {
        groupCount: derivedArm.groupCount,
        baselineGroupCount: baseline.groupCount,
        meanChemistryScore: round6(derivedArm.meanChemistryScore),
        offMeanChemistryScore: round6(derivedArm.offMeanChemistryScore),
        meanPairScore: round6(derivedArm.meanPairScore),
        offMeanPairScore: round6(derivedArm.offMeanPairScore),
        coMembershipAgreement: round6(derivedArm.coMembershipAgreement),
        poolsWithMembershipChange: round6(derivedArm.poolsWithMembershipChange),
      },
      composition: summarizeArm(derivedArm.composition),
    };
  }
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');

  // ── Console summary ──
  console.log('🎲 Monte Carlo Group-Formation Harness');
  console.log(`   pools=${measuredPools.length}  m11Pools=${m11Measured.length}  population=${population}  seed=${seed}  runtime=${runtimeSec.toFixed(1)}s  sessions=${sessions.size}`);
  console.log('');
  console.log(`   [flags-off] groups=${baseline.groupCount}  min-E mean=${f2(baseline.minE.mean)} (viol ${pct(baseline.stabilityFloorViolationRate)})  mean-A mean=${f2(baseline.meanA.mean)} (viol ${pct(baseline.meanAFloorViolationRate)})`);
  console.log(`   [flags-off] sparks 0/1/2+: ${pct(baseline.sparkDistribution.zero)} / ${pct(baseline.sparkDistribution.one)} / ${pct(baseline.sparkDistribution.twoPlus)}  X-var viol=${pct(baseline.xVarianceCapViolationRate)}  clone=${pct(baseline.cloneGroupRate)}  unmatched=${pct(baseline.unmatchedRate.mean)}`);
  console.log(`   [flags-on ] groups=${flagsOn.groupCount}  min-E viol=${pct(flagsOn.stabilityFloorViolationRate)}  mean-A viol=${pct(flagsOn.meanAFloorViolationRate)}  clone=${pct(flagsOn.cloneGroupRate)}  unmatched=${pct(flagsOn.unmatchedRate.mean)} (Δ ${unmatchedDeltaPpInline(baseline, flagsOn)}pp)`);
  if (gateArm) {
    console.log(`   [gates-on ] groups=${gateArm.groupCount}  sparks 0/1/2+: ${pct(gateArm.sparkDistribution.zero)} / ${pct(gateArm.sparkDistribution.one)} / ${pct(gateArm.sparkDistribution.twoPlus)}  unmatched=${pct(gateArm.unmatchedRate.mean)}`);
    console.log(`   [M9] all-gates pass=${pct(gateArm.allGatesPassRate)}  target ≥ ${pct(M9_TARGET)}  ${m9Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   [M10] unmatched Δ=${m10DeltaPp! >= 0 ? '+' : ''}${m10DeltaPp!.toFixed(2)}pp  target ≤ +${M10_MAX_DELTA_PP}pp  ${m10Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   [gates] commit rejections: min-E=${gateArm.commitRejections.minEFloor} mean-A=${gateArm.commitRejections.meanAFloor} spark=${gateArm.commitRejections.sparkRule} X-var=${gateArm.commitRejections.xVarianceCap} (total ${gateArm.commitRejections.total})`);
  }
  if (derivedArm) {
    console.log(`   [derived ] groups=${derivedArm.groupCount}  chemistry ${f2(derivedArm.offMeanChemistryScore)}→${f2(derivedArm.meanChemistryScore)}  agreement=${pct(derivedArm.coMembershipAgreement)}  pools-changed=${pct(derivedArm.poolsWithMembershipChange)}`);
  }
  console.log(
    `   [M11 sweep] ${m11Sweep.map((s) => `${pct(s.rate)}→Δoff ${f3(s.meanDeltaOff)}${s.reduction === null ? '/n-a' : `/${pct(s.reduction)}`}`).join('  ')}`
  );
  console.log(
    `   [M11 durable] ${m11Durable.pass ? '✅ PASS' : '❌ FAIL'}  boundedErr=${f3(m11Durable.boundedError.maxRatio)} (${m11Durable.boundedErrorPass ? 'ok' : 'FAIL'})  stab=${pct(m11Durable.achieved)}/${pct(m11Durable.ceiling)} (${pct(m11Durable.ceilingFractionAchieved)}, ${m11Durable.groupStabilizationPass ? 'ok' : 'FAIL'})  smoke=${m11Durable.smokeAlarmPass ? 'ok' : 'FAIL'}  envelope=${m11Durable.envelopePass ? 'ok' : 'FAIL'}`
  );
  console.log(
    `   [M11 legacy] 20% reduction=${m11Reduction === null ? 'n/a' : pct(m11Reduction)} vs retired ${pct(M11_REDUCTION_TARGET)} target → ${m11Pass ? 'PASS' : 'FAIL'} (informational)`
  );
  console.log(`   [invariants] ${invariantFailures.length === 0 ? '✅ all pass' : `❌ ${invariantFailures.length} failures`}`);
  console.log('');
  console.log(`💾 Report: ${outPath}`);
  console.log(`   JSON:    ${jsonPath}`);

  // ── Exit code ──
  const hardFailures: string[] = [];
  if (invariantFailures.length > 0) {
    for (const f of invariantFailures.slice(0, 10)) {
      hardFailures.push(`${f.kind} pool#${f.poolIndex} (pool seed ${f.poolSeed}, base seed ${seed}) arm=${f.arm}: ${f.detail}`);
    }
  }
  // M11 durable contract (P3-reformulated) is the locked group-level target:
  // verdicted in every mode, hard-failing only in --mode=gated (baseline must
  // exit 0). The legacy ≥50% verdict above is informational only.
  if (mode === 'gated' && !m11Durable.pass) {
    const worst = [...m11PoolResults].sort((a, b) => b.deltaOn - a.deltaOn).slice(0, 3);
    hardFailures.push(
      `M11 durable contract failed: boundedError=${m11Durable.boundedErrorPass} groupStabilization=${m11Durable.groupStabilizationPass} ` +
        `smokeAlarm=${m11Durable.smokeAlarmPass} envelope=${m11Durable.envelopePass} ` +
        `(achieved ${pct(m11Durable.achieved)} vs ceiling ${pct(m11Durable.ceiling)}; bound ratio ${f3(m11Durable.boundedError.maxRatio)}). ` +
        `Worst pools: ${worst.map((p) => `#${p.poolIndex} (pool seed ${p.poolSeed}, base seed ${seed}, Δon=${f3(p.deltaOn)})`).join('; ')}. ` +
        `Replay: --seed=${seed} --only-pool=<index>`
    );
  }
  // M9/M10 (LOCKED by sprint-contract.item5-composition-rules): hard-fail only
  // when the gate-on arm actually ran in gated mode; otherwise the console
  // verdict lines above carry the result for calibration iteration.
  if (mode === 'gated' && compositionGates && gateArm) {
    if (m9Pass === false) {
      hardFailures.push(
        `M9 all-gates pass ${pct(gateArm.allGatesPassRate)} below locked target ${pct(M9_TARGET)} ` +
          `(seed ${seed}). Per-gate: min-E ${gateArm.perGate.minE.pass}/${gateArm.perGate.minE.evaluated}, ` +
          `mean-A ${gateArm.perGate.meanA.pass}/${gateArm.perGate.meanA.evaluated}, ` +
          `sparkMin ${gateArm.perGate.sparkMin.pass}/${gateArm.perGate.sparkMin.evaluated}, ` +
          `sparkMax ${gateArm.perGate.sparkMax.pass}/${gateArm.perGate.sparkMax.evaluated}, ` +
          `X-var ${gateArm.perGate.xVariance.pass}/${gateArm.perGate.xVariance.evaluated}.`
      );
    }
    if (m10Pass === false) {
      hardFailures.push(
        `M10 unmatched-rate delta +${m10DeltaPp!.toFixed(2)}pp exceeds locked budget +${M10_MAX_DELTA_PP}pp ` +
          `(${pct(baseline.unmatchedRate.mean)} → ${pct(gateArm.unmatchedRate.mean)}, seed ${seed}).`
      );
    }
  }
  if (!m11Durable.pass) {
    // Always surface the failing durable verdict + worst pools, even when not
    // exit-gating in baseline mode.
    const worst = [...m11PoolResults].sort((a, b) => b.deltaOn - a.deltaOn).slice(0, 3);
    console.log('');
    console.log(`   [M11 durable] ❌ FAIL (reported; non-blocking in baseline mode). Worst pools:`);
    for (const p of worst) {
      console.log(`     pool #${p.poolIndex}: --seed=${seed} --only-pool=${p.poolIndex} (pool seed ${p.poolSeed}, Δoff=${f3(p.deltaOff)}, Δon=${f3(p.deltaOn)})`);
    }
  }
  if (hardFailures.length > 0) {
    console.error('');
    console.error('❌ HARD assertion failures (replay seeds printed):');
    for (const line of hardFailures) console.error(`   - ${line}`);
    process.exit(1);
  }
}

function unmatchedDeltaPpInline(baseline: ArmAggregate, flagsOn: ArmAggregate): string {
  const d = (flagsOn.unmatchedRate.mean - baseline.unmatchedRate.mean) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}`;
}

main().catch((err) => {
  console.error('❌ Harness crashed:', err);
  process.exit(1);
});
