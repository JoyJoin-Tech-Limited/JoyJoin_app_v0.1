#!/usr/bin/env node
/**
 * Latent-Trait Recovery Harness (V4 Personality Engine — Plan Item 6)
 *
 * Validates the adaptive engine against synthetic respondents with KNOWN
 * ground-truth ACOEXP trait vectors (zero live user data exists pre-launch).
 *
 * What it does:
 *   1. Generates N synthetic respondents from a documented 2-component
 *      multivariate mixture distribution over the 6 ACOEXP traits (0–100).
 *   2. Runs each respondent through the adaptive engine with a FORCED stop at
 *      exactly 8 / 12 / 16 adaptive questions. Forcing is done purely through
 *      AssessmentConfig overrides (unreachable confidence thresholds +
 *      min=softMax=hardMax=cap) — the engine source is NOT modified. Because
 *      question selection is deterministic and termination can never fire
 *      before the cap, the first 8/12 questions of the forced-16 run are
 *      prefix-identical to dedicated forced-8/12 runs; one 16-question run
 *      per respondent therefore yields all three checkpoints.
 *   3. Measures, per checkpoint: per-trait Pearson r(true, estimated),
 *      per-trait MAE, archetype top-1 agreement (true = matcher-isolation
 *      top-1 on the true vector, same definition as simulate:personas:run:ci),
 *      mean trait confidence, per-trait sample counts.
 *   4. Runs a NATURAL-termination arm (DEFAULT_ASSESSMENT_CONFIG) for
 *      session-length stats and confidence-gap-at-stop analysis.
 *   5. Writes a dated, fully deterministic report to docs/reports/.
 *   6. (Opt-in, Plan Item 12) `--export-sessions=<path>` additionally writes
 *      per-session JSONL calibration rows (raw engine confidence, estimated
 *      top-1, true archetype, correctness, per-trait confidence + |error|).
 *      Default off; the aggregate report is byte-identical with or without it.
 *   7. (Opt-in, Plan Item 1) `--ipsative=on` enables
 *      `AssessmentConfig.enableIpsativeItems` in BOTH the forced-stop and
 *      natural arms for the M4 A/B (r(X)/r(P) uplift ≥ +0.03 vs the
 *      post-Item-11 flag-off baseline). Default off; with the flag off the
 *      selector never serves ipsative items and the report is byte-identical
 *      to a run without this argument.
 *   8. (Opt-in, sprint m4-desirability-bias-arm) `--noise=desirability` runs
 *      an answer-model arm with systematic self-presentation bias (option
 *      score = true-trait alignment + DESIRABILITY_BIAS_BETA * desirability
 *      proxy; see lib/persona-utils.ts). Combine with `--ipsative=on` for the
 *      M4 A/B under bias. Excluded from `--noise=all`; default arms unchanged.
 *   9. (Opt-in, Plan Item 2) `--consistency=on` enables
 *      `AssessmentConfig.enableConsistencyFolding` in BOTH arms for the
 *      Item-2 no-regression A/B: flag-on must not regress any per-trait
 *      recovery r by > 0.03 vs the locked post-Item-11 baseline, and natural
 *      mean session length must stay within 12.6 ± 0.5q. Default off; the
 *      report is byte-identical to a run without this argument. Flag-on runs
 *      print an additive per-arm consistency section (pair completion,
 *      detector fire rates, per-trait deltas vs locked baseline).
 *  10. (Opt-in, Plan Item 3) `--shrinkage=on` enables
 *      `AssessmentConfig.enableTraitShrinkage` in BOTH arms for the Item-3
 *      no-regression A/B: r/MAE are then computed on the REPORTED (shrunken)
 *      trait vector — what the matcher sees — and must not regress any
 *      per-trait recovery r by > 0.03 vs the locked post-Item-11 baseline
 *      (clean arms are well-measured, so the curve must be near-identity
 *      there). Default off; the report is byte-identical to a run without
 *      this argument. Flag-on runs print an additive per-arm shrinkage
 *      section (mean |reported − raw| delta, per-trait deltas vs baseline).
 *
 * Usage:
 *   tsx scripts/simulate/run-recovery-harness.ts
 *   tsx scripts/simulate/run-recovery-harness.ts --n=2000 --seed=20260909 --noise=clean,moderate
 *   tsx scripts/simulate/run-recovery-harness.ts --noise=all --out=docs/reports/custom.md
 *   tsx scripts/simulate/run-recovery-harness.ts --export-sessions=/tmp/sessions.jsonl
 *   tsx scripts/simulate/run-recovery-harness.ts --ipsative=on --out=docs/reports/ipsative-on.md
 *   tsx scripts/simulate/run-recovery-harness.ts --noise=desirability --ipsative=on --out=docs/reports/m4-biased-on.md
 *   tsx scripts/simulate/run-recovery-harness.ts --consistency=on --out=docs/reports/consistency-on.md
 *   tsx scripts/simulate/run-recovery-harness.ts --shrinkage=on --out=docs/reports/shrinkage-on.md
 *   tsx scripts/simulate/run-recovery-harness.ts --json=scripts/simulate/data/recovery-results-latest.json
 *
 * P3: `--json=<path>` emits the machine-readable metric payload the
 * `gate:assessment` CI gate parses (markdown verdict lines predate the amended
 * M2/M3 definitions and must never be parsed). Default off — the markdown
 * report is byte-identical with or without the flag.
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
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
import { getConsistencyPairStatus, computeNeutralResponseStats } from '../../packages/shared/src/personality/consistencyPairs';
import { shrinkTraitsTowardNeutral, SHRINKAGE_ERROR_FLOOR, SHRINKAGE_EXCESS_SCALE, SHRINKAGE_MIN_WEIGHT } from '../../packages/shared/src/personality/traitShrinkage';
import { selectAnswerByTraits, NoiseMode, getDesirabilityBiasBeta } from './lib/persona-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** Plan Item 1: ids of flag-gated ipsative items (used for served-rate reporting in --ipsative=on runs). */
const IPSATIVE_QUESTION_IDS = new Set(
  questionsV4.filter((q) => q.questionType === 'ipsative').map((q) => q.id)
);

/**
 * Plan Item 2 A/B: locked post-Item-11 flag-off baseline (2026-09-09, N=2000,
 * seed 20260909) for the no-regression check. Flag-on runs must not regress
 * any per-trait recovery r (@16q forced OR at natural stop) by more than
 * 0.03, and natural mean length must stay within 12.6 ± 0.5 (M14 lock).
 */
const ITEM2_LOCKED_BASELINE: Record<
  string,
  { r16: Record<TraitKey, number>; rNatural: Record<TraitKey, number>; naturalMeanLength: number }
> = {
  clean: {
    r16: { A: 0.809, C: 0.706, E: 0.763, O: 0.767, X: 0.865, P: 0.730 },
    rNatural: { A: 0.816, C: 0.751, E: 0.771, O: 0.754, X: 0.820, P: 0.683 },
    naturalMeanLength: 12.4,
  },
  moderate: {
    r16: { A: 0.708, C: 0.634, E: 0.701, O: 0.647, X: 0.823, P: 0.687 },
    rNatural: { A: 0.657, C: 0.612, E: 0.660, O: 0.626, X: 0.761, P: 0.639 },
    naturalMeanLength: 12.4,
  },
};
const ITEM2_MAX_R_REGRESSION = 0.03;
const ITEM2_LENGTH_BAND = { center: 12.6, tolerance: 0.5 } as const;

// ── Constants ────────────────────────────────────────────────────────

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const CHECKPOINTS = [8, 12, 16] as const;
type Checkpoint = (typeof CHECKPOINTS)[number];

/** Population mixture: share of respondents drawn around archetype centroids. */
const CENTROID_MIXTURE_WEIGHT = 0.6;
/** Per-trait SD for centroid-mixture respondents. */
const CENTROID_TRAIT_SD = 10;
/** Per-trait mean/SD for general-population respondents (matches matcher z-score params). */
const GENERAL_TRAIT_MEAN = 50;
const GENERAL_TRAIT_SD = 15;
/** Truncation bounds for sampled traits (rejection sampling). */
const TRAIT_MIN = 5;
const TRAIT_MAX = 95;

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

  const noiseRaw = options.noise || 'clean,moderate';
  // NOTE: `all` intentionally excludes `desirability` — that arm is an
  // opt-in biased instrument for the M4 A/B (sprint m4-desirability-bias-arm)
  // and must be requested explicitly via --noise=desirability.
  const noiseModes: NoiseMode[] =
    noiseRaw === 'all'
      ? ['clean', 'moderate', 'high']
      : (noiseRaw.split(',').map((s) => s.trim()) as NoiseMode[]);
  for (const m of noiseModes) {
    if (!['clean', 'moderate', 'high', 'desirability'].includes(m)) {
      console.error(`❌ Unknown noise mode: ${m} (expected clean|moderate|high|desirability|all)`);
      process.exit(1);
    }
  }

  return {
    n: parseInt(options.n || '2000', 10),
    seed: parseInt(options.seed || '20260909', 10),
    noiseModes,
    outFile: options.out || '',
    jsonOutFile: options.json || '',
    exportSessionsFile: options['export-sessions'] || '',
    // Plan Item 1 A/B: opt-in only, default off = byte-identical behavior.
    ipsativeOn: options.ipsative === 'on',
    // Plan Item 2 A/B: opt-in only, default off = byte-identical behavior.
    consistencyOn: options.consistency === 'on',
    // Plan Item 4 A/B: opt-in only, default off = byte-identical behavior.
    metaOn: options.meta === 'on',
    // Plan Item 3 A/B: opt-in only, default off = byte-identical behavior.
    shrinkageOn: options.shrinkage === 'on',
  };
}

// ── Seeded RNG ───────────────────────────────────────────────────────

/** mulberry32 — small, fast, deterministic PRNG. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Derive an independent stream seed for a (respondent, arm) pair. */
function streamSeed(baseSeed: number, respondentIndex: number, streamTag: string): number {
  let h = baseSeed >>> 0;
  h = Math.imul(h ^ (respondentIndex + 1), 0x9e3779b1) >>> 0;
  for (const ch of streamTag) {
    h = Math.imul(h ^ ch.charCodeAt(0), 0x85ebca6b) >>> 0;
  }
  return h >>> 0;
}

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

// ── Synthetic Population ─────────────────────────────────────────────

interface SyntheticRespondent {
  id: string;
  source: 'centroid_mixture' | 'general';
  sourceCentroid: string | null;
  trueTraits: Record<TraitKey, number>;
  /** Matcher-isolation top-1 on the TRUE vector (ground-truth archetype). */
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
      id: `S${String(i + 1).padStart(5, '0')}`,
      source: isCentroidArm ? 'centroid_mixture' : 'general',
      sourceCentroid,
      trueTraits,
      trueArchetype: trueMatch[0]?.archetype ?? '',
    });
  }

  return respondents;
}

// ── Engine Session Runners ───────────────────────────────────────────

/**
 * Forced-stop config: confidence-based early termination is disabled by
 * pushing both confidence thresholds above the reachable maximum (confidence
 * is capped at 1.0 by the engine), and min=softMax=hardMax=cap means
 * shouldTerminate() only fires when answeredCount >= cap. Result: exactly
 * `cap` adaptive questions, no closing questions served.
 */
function forcedStopConfig(cap: number, ipsativeOn = false, consistencyOn = false, metaOn = false, shrinkageOn = false): AssessmentConfig {
  return {
    ...DEFAULT_ASSESSMENT_CONFIG,
    minQuestions: cap,
    softMaxQuestions: cap,
    hardMaxQuestions: cap,
    defaultConfidenceThreshold: 2,
    confusablePairThreshold: 2,
    enableTieredThreshold: false,
    useV2Matcher: true,
    enableIpsativeItems: ipsativeOn,
    enableConsistencyFolding: consistencyOn,
    enableMetaConsistency: metaOn,
    enableTraitShrinkage: shrinkageOn,
  };
}

interface Snapshot {
  questions: number;
  traits: Record<TraitKey, number>;
  confidences: Record<TraitKey, number>;
  sampleCounts: Record<TraitKey, number>;
  meanConfidence: number;
  topArchetype: string | null;
  /**
   * Plan Item 3 (flag-on only): the REPORTED (shrunken) trait vector the
   * matcher saw at this checkpoint — shrinkTraitsTowardNeutral(traits,
   * confidences) recomputed from the raw snapshot (exactly the engine's
   * match-boundary transform). Undefined flag-off; r/MAE metrics consume
   * this vector when present so the flag-on A/B measures what the matcher
   * (and downstream consumers) actually see.
   */
  reportedTraits?: Record<TraitKey, number>;
}

function snapshotState(state: EngineState, questions: number, shrinkageOn = false): Snapshot {
  const traits = {} as Record<TraitKey, number>;
  const confidences = {} as Record<TraitKey, number>;
  const sampleCounts = {} as Record<TraitKey, number>;
  let confSum = 0;
  for (const trait of ALL_TRAITS) {
    const tc = state.traitConfidences[trait];
    traits[trait] = tc?.score ?? 50;
    confidences[trait] = tc?.confidence ?? 0;
    sampleCounts[trait] = tc?.sampleCount ?? 0;
    confSum += confidences[trait];
  }
  return {
    questions,
    traits,
    confidences,
    sampleCounts,
    meanConfidence: confSum / ALL_TRAITS.length,
    topArchetype: state.currentMatches[0]?.archetype ?? null,
    ...(shrinkageOn ? { reportedTraits: shrinkTraitsTowardNeutral(traits, confidences) } : {}),
  };
}

/**
 * One forced-16 adaptive run; snapshots state at 8/12/16 answered questions.
 * Relies on the prefix property: with termination impossible before the cap,
 * question selection is a deterministic function of state, so the first k
 * questions equal a dedicated forced-k run.
 */
function runForcedSession(
  respondent: SyntheticRespondent,
  noise: NoiseMode,
  rng: () => number,
  ipsativeOn = false,
  consistencyOn = false,
  metaOn = false,
  shrinkageOn = false
): { snapshots: Map<Checkpoint, Snapshot>; ipsativeAnswers: number; pairsStarted: number; pairsCompleted: number } {
  const cap = CHECKPOINTS[CHECKPOINTS.length - 1];
  let state = initializeEngineState(forcedStopConfig(cap, ipsativeOn, consistencyOn, metaOn, shrinkageOn));
  const snapshots = new Map<Checkpoint, Snapshot>();
  let ipsativeAnswers = 0;

  while (state.answeredQuestionIds.size < cap) {
    const question = selectNextQuestion(state);
    if (!question || isUniversalClosingQuestionId(question.id)) break; // unreachable pre-cap
    const answer = selectAnswerByTraits(question, respondent.trueTraits, noise, rng);
    state = processAnswer(state, question, answer);
    if (IPSATIVE_QUESTION_IDS.has(question.id)) ipsativeAnswers++;
    const count = state.answeredQuestionIds.size;
    if ((CHECKPOINTS as readonly number[]).includes(count)) {
      snapshots.set(count as Checkpoint, snapshotState(state, count, shrinkageOn));
    }
  }

  const pairStatuses = getConsistencyPairStatus(state.questionHistory);
  return {
    snapshots,
    ipsativeAnswers,
    pairsStarted: pairStatuses.filter((p) => p.state !== 'not-started').length,
    pairsCompleted: pairStatuses.filter((p) => p.state === 'complete').length,
  };
}

interface NaturalRun {
  adaptiveCount: number;
  snapshot: Snapshot;
  /** top1.confidence − top2.confidence at natural stop (1 if <2 matches). */
  confidenceGap: number;
  hitHardMax: boolean;
  /** Count of ipsative (forced-choice pair) questions answered (Plan Item 1 A/B reporting). */
  ipsativeAnswers: number;
  /** Plan Item 2 telemetry (0 when flag off — no pair is ever started). */
  pairsStarted: number;
  pairsCompleted: number;
  neutralDetectorFired: boolean;
}

/** Natural-termination session under DEFAULT_ASSESSMENT_CONFIG (stops before closing questions). */
function runNaturalSession(
  respondent: SyntheticRespondent,
  noise: NoiseMode,
  rng: () => number,
  ipsativeOn = false,
  consistencyOn = false,
  metaOn = false,
  shrinkageOn = false
): NaturalRun {
  let state = initializeEngineState({
    ...DEFAULT_ASSESSMENT_CONFIG,
    useV2Matcher: true,
    enableIpsativeItems: ipsativeOn,
    enableConsistencyFolding: consistencyOn,
    enableMetaConsistency: metaOn,
    enableTraitShrinkage: shrinkageOn,
  });
  let adaptiveCount = 0;
  let ipsativeAnswers = 0;

  while (adaptiveCount < 25) {
    const question = selectNextQuestion(state);
    if (!question || isUniversalClosingQuestionId(question.id)) break;
    // Plan Item 2: pair second members pending at adaptive termination are
    // served in the CLOSING phase (before the universals). They are real
    // answers (they feed the engine exactly as production would) but NOT
    // adaptive questions, so they do not count toward adaptiveCount.
    // Flag-off equivalence: with the flag off selectNextQuestion only returns
    // universal closing ids (or null) once shouldTerminate is true — both
    // break above — so this branch never fires and behavior is byte-identical.
    const postTermination = shouldTerminate(state);
    const answer = selectAnswerByTraits(question, respondent.trueTraits, noise, rng);
    state = processAnswer(state, question, answer);
    if (IPSATIVE_QUESTION_IDS.has(question.id)) ipsativeAnswers++;
    if (!postTermination) adaptiveCount++;
  }

  const top = state.currentMatches[0];
  const second = state.currentMatches[1];
  const pairStatuses = getConsistencyPairStatus(state.questionHistory);
  return {
    adaptiveCount,
    snapshot: snapshotState(state, adaptiveCount, shrinkageOn),
    confidenceGap: top && second ? top.confidence - second.confidence : 1,
    hitHardMax: adaptiveCount >= DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions,
    ipsativeAnswers,
    pairsStarted: pairStatuses.filter((p) => p.state !== 'not-started').length,
    pairsCompleted: pairStatuses.filter((p) => p.state === 'complete').length,
    neutralDetectorFired: computeNeutralResponseStats(state.questionHistory).fired,
  };
}

// ── Statistics ───────────────────────────────────────────────────────

function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

function pearson(xs: number[], ys: number[]): number {
  const mx = mean(xs);
  const my = mean(ys);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < xs.length; i++) {
    const a = xs[i] - mx;
    const b = ys[i] - my;
    num += a * b;
    dx += a * a;
    dy += b * b;
  }
  if (dx === 0 || dy === 0) return 0;
  return num / Math.sqrt(dx * dy);
}

function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

// ── Metrics Assembly ─────────────────────────────────────────────────

interface CheckpointMetrics {
  checkpoint: Checkpoint;
  pearsonByTrait: Record<TraitKey, number>;
  maeByTrait: Record<TraitKey, number>;
  top1Agreement: number;
  /** Agreement split by population component — center-mass respondents sit far
   *  from all centroids, so their "true nearest centroid" is inherently unstable. */
  top1AgreementBySource: Record<SyntheticRespondent['source'], number>;
  meanConfidence: number;
  meanSampleCountByTrait: Record<TraitKey, number>;
}

interface NaturalMetrics {
  lengthMean: number;
  lengthMedian: number;
  lengthMin: number;
  lengthMax: number;
  hardMaxHitRate: number;
  stopAtOrBelow12Rate: number;
  pearsonByTraitAtStop: Record<TraitKey, number>;
  top1AgreementAtStop: number;
  top1AgreementAtStopBySource: Record<SyntheticRespondent['source'], number>;
  meanConfidenceAtStop: number;
  meanGapAtStop: number;
  lowGapShare: number; // share of sessions stopping with gap < 0.10
  agreementLowGap: number | null; // top-1 agreement among gap < 0.10 sessions
  agreementHighGap: number | null; // top-1 agreement among gap >= 0.10 sessions
}

interface ArmResults {
  noise: NoiseMode;
  byCheckpoint: Map<Checkpoint, CheckpointMetrics>;
  natural: NaturalMetrics;
  /** Plan Item 1 A/B reporting (only meaningful with --ipsative=on). */
  ipsative: {
    forcedServedRate: number; // share of forced sessions answering ≥1 ipsative item
    forcedMeanAnswers: number; // mean ipsative answers per forced-16 session
    naturalServedRate: number;
    naturalMeanAnswers: number;
  };
  /** Plan Item 2 A/B reporting (only meaningful with --consistency=on). */
  consistency: {
    naturalPairCompletionRate: number; // completed / started, natural arm
    naturalPairStartedMean: number;
    naturalNeutralFireRate: number;
    forcedPairCompletionRate: number;
  };
  /** Plan Item 3 A/B reporting (only meaningful with --shrinkage=on). */
  shrinkage: {
    /** Mean over natural sessions of max_t |reported_t − raw_t| (0 flag-off). */
    naturalMeanMaxAbsDelta: number;
  };
}

function computeArmMetrics(
  respondents: SyntheticRespondent[],
  noise: NoiseMode,
  forcedRuns: { snapshots: Map<Checkpoint, Snapshot>; ipsativeAnswers: number; pairsStarted: number; pairsCompleted: number }[],
  naturalRuns: NaturalRun[]
): ArmResults {
  const byCheckpoint = new Map<Checkpoint, CheckpointMetrics>();

  for (const cp of CHECKPOINTS) {
    const pearsonByTrait = {} as Record<TraitKey, number>;
    const maeByTrait = {} as Record<TraitKey, number>;
    const meanSampleCountByTrait = {} as Record<TraitKey, number>;

    for (const trait of ALL_TRAITS) {
      const trueVals: number[] = [];
      const estVals: number[] = [];
      const absErrs: number[] = [];
      const samples: number[] = [];
      for (let i = 0; i < respondents.length; i++) {
        const snap = forcedRuns[i].snapshots.get(cp);
        if (!snap) continue;
        // Plan Item 3: flag-on measures the REPORTED (shrunken) traits — the
        // vector the matcher and downstream consumers see. Flag-off
        // reportedTraits is undefined and this reads the raw estimate
        // (byte-identical).
        const estimated = snap.reportedTraits?.[trait] ?? snap.traits[trait];
        trueVals.push(respondents[i].trueTraits[trait]);
        estVals.push(estimated);
        absErrs.push(Math.abs(estimated - respondents[i].trueTraits[trait]));
        samples.push(snap.sampleCounts[trait]);
      }
      pearsonByTrait[trait] = pearson(trueVals, estVals);
      maeByTrait[trait] = mean(absErrs);
      meanSampleCountByTrait[trait] = mean(samples);
    }

    let agree = 0;
    let confSum = 0;
    let counted = 0;
    const agreeBySource: Record<SyntheticRespondent['source'], { hit: number; n: number }> = {
      centroid_mixture: { hit: 0, n: 0 },
      general: { hit: 0, n: 0 },
    };
    for (let i = 0; i < respondents.length; i++) {
      const snap = forcedRuns[i].snapshots.get(cp);
      if (!snap) continue;
      counted++;
      const hit = snap.topArchetype === respondents[i].trueArchetype;
      if (hit) agree++;
      const bucket = agreeBySource[respondents[i].source];
      bucket.n++;
      if (hit) bucket.hit++;
      confSum += snap.meanConfidence;
    }

    byCheckpoint.set(cp, {
      checkpoint: cp,
      pearsonByTrait,
      maeByTrait,
      top1Agreement: counted > 0 ? agree / counted : 0,
      top1AgreementBySource: {
        centroid_mixture: agreeBySource.centroid_mixture.n > 0 ? agreeBySource.centroid_mixture.hit / agreeBySource.centroid_mixture.n : 0,
        general: agreeBySource.general.n > 0 ? agreeBySource.general.hit / agreeBySource.general.n : 0,
      },
      meanConfidence: counted > 0 ? confSum / counted : 0,
      meanSampleCountByTrait,
    });
  }

  const lengths = naturalRuns.map((r) => r.adaptiveCount);
  const gaps = naturalRuns.map((r) => r.confidenceGap);
  const lowGapIdx = naturalRuns.map((r, i) => (r.confidenceGap < 0.1 ? i : -1)).filter((i) => i >= 0);
  const highGapIdx = naturalRuns.map((r, i) => (r.confidenceGap >= 0.1 ? i : -1)).filter((i) => i >= 0);
  const agreementFor = (idxs: number[]): number | null => {
    if (idxs.length === 0) return null;
    return idxs.filter((i) => naturalRuns[i].snapshot.topArchetype === respondents[i].trueArchetype).length / idxs.length;
  };

  const pearsonByTraitAtStop = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    pearsonByTraitAtStop[trait] = pearson(
      respondents.map((r) => r.trueTraits[trait]),
      // Plan Item 3: reported (shrunken) traits when the flag is on.
      naturalRuns.map((r) => r.snapshot.reportedTraits?.[trait] ?? r.snapshot.traits[trait])
    );
  }

  const naturalAgreementFor = (source: SyntheticRespondent['source']): number => {
    const idxs = respondents.map((r, i) => (r.source === source ? i : -1)).filter((i) => i >= 0);
    if (idxs.length === 0) return 0;
    return idxs.filter((i) => naturalRuns[i].snapshot.topArchetype === respondents[i].trueArchetype).length / idxs.length;
  };

  const natural: NaturalMetrics = {
    lengthMean: mean(lengths),
    lengthMedian: median(lengths),
    lengthMin: Math.min(...lengths),
    lengthMax: Math.max(...lengths),
    hardMaxHitRate: naturalRuns.filter((r) => r.hitHardMax).length / naturalRuns.length,
    stopAtOrBelow12Rate: lengths.filter((l) => l <= 12).length / lengths.length,
    pearsonByTraitAtStop,
    top1AgreementAtStop:
      naturalRuns.filter((r, i) => r.snapshot.topArchetype === respondents[i].trueArchetype).length /
      naturalRuns.length,
    top1AgreementAtStopBySource: {
      centroid_mixture: naturalAgreementFor('centroid_mixture'),
      general: naturalAgreementFor('general'),
    },
    meanConfidenceAtStop: mean(naturalRuns.map((r) => r.snapshot.meanConfidence)),
    meanGapAtStop: mean(gaps),
    lowGapShare: lowGapIdx.length / naturalRuns.length,
    agreementLowGap: agreementFor(lowGapIdx),
    agreementHighGap: agreementFor(highGapIdx),
  };

  const ipsative = {
    forcedServedRate: forcedRuns.filter((r) => r.ipsativeAnswers > 0).length / forcedRuns.length,
    forcedMeanAnswers: mean(forcedRuns.map((r) => r.ipsativeAnswers)),
    naturalServedRate: naturalRuns.filter((r) => r.ipsativeAnswers > 0).length / naturalRuns.length,
    naturalMeanAnswers: mean(naturalRuns.map((r) => r.ipsativeAnswers)),
  };

  const completionRate = (runs: { pairsStarted: number; pairsCompleted: number }[]) => {
    const started = runs.reduce((s, r) => s + r.pairsStarted, 0);
    return started > 0 ? runs.reduce((s, r) => s + r.pairsCompleted, 0) / started : 0;
  };
  const consistency = {
    naturalPairCompletionRate: completionRate(naturalRuns),
    naturalPairStartedMean: mean(naturalRuns.map((r) => r.pairsStarted)),
    naturalNeutralFireRate: naturalRuns.filter((r) => r.neutralDetectorFired).length / naturalRuns.length,
    forcedPairCompletionRate: completionRate(forcedRuns),
  };

  const shrinkage = {
    naturalMeanMaxAbsDelta: mean(
      naturalRuns.map((r) =>
        r.snapshot.reportedTraits
          ? Math.max(...ALL_TRAITS.map((t) => Math.abs(r.snapshot.reportedTraits![t] - r.snapshot.traits[t])))
          : 0
      )
    ),
  };

  return { noise, byCheckpoint, natural, ipsative, consistency, shrinkage };
}

// ── Verdicts (plan success metrics M1–M3 + config review) ────────────

function buildVerdicts(arm: ArmResults): string[] {
  const lines: string[] = [];
  const m8 = arm.byCheckpoint.get(8)!;
  const m12 = arm.byCheckpoint.get(12)!;
  const m16 = arm.byCheckpoint.get(16)!;

  // M1: r ≥ 0.70 for all six traits at 16q
  const m1Fails = ALL_TRAITS.filter((t) => m16.pearsonByTrait[t] < 0.7);
  lines.push(
    `- **M1 — recovery r ≥ 0.70 @16q (all traits):** ${m1Fails.length === 0 ? '✅ PASS' : `❌ FAIL (${m1Fails.map((t) => `${t}=${m16.pearsonByTrait[t].toFixed(3)}`).join(', ')})`}`
  );

  // M2: r ≥ 0.60 @12q, ≥ 0.50 @8q, monotone 8→12→16
  const m2Fails12 = ALL_TRAITS.filter((t) => m12.pearsonByTrait[t] < 0.6);
  const m2Fails8 = ALL_TRAITS.filter((t) => m8.pearsonByTrait[t] < 0.5);
  const nonMonotone = ALL_TRAITS.filter(
    (t) => !(m8.pearsonByTrait[t] <= m12.pearsonByTrait[t] + 1e-9 && m12.pearsonByTrait[t] <= m16.pearsonByTrait[t] + 1e-9)
  );
  const m2Parts: string[] = [];
  if (m2Fails8.length > 0) m2Parts.push(`8q below 0.50: ${m2Fails8.join(',')}`);
  if (m2Fails12.length > 0) m2Parts.push(`12q below 0.60: ${m2Fails12.join(',')}`);
  if (nonMonotone.length > 0) m2Parts.push(`non-monotone: ${nonMonotone.join(',')}`);
  lines.push(`- **M2 — r ≥ 0.50 @8q / ≥ 0.60 @12q / monotone:** ${m2Parts.length === 0 ? '✅ PASS' : `❌ FAIL (${m2Parts.join('; ')})`}`);

  // M3: top-1 agreement ≥ 85% @16q
  lines.push(
    `- **M3 — archetype top-1 agreement ≥ 85% @16q:** ${m16.top1Agreement >= 0.85 ? '✅ PASS' : '❌ FAIL'} (${(m16.top1Agreement * 100).toFixed(1)}% overall; centroid-mixture ${(m16.top1AgreementBySource.centroid_mixture * 100).toFixed(1)}%, general ${(m16.top1AgreementBySource.general * 100).toFixed(1)}%)`
  );

  // hardMax=16 review
  const meanR12 = mean(ALL_TRAITS.map((t) => m12.pearsonByTrait[t]));
  const meanR16 = mean(ALL_TRAITS.map((t) => m16.pearsonByTrait[t]));
  const gain12to16 = meanR16 - meanR12;
  const agreeGain = m16.top1Agreement - m12.top1Agreement;
  lines.push(
    `- **hardMax=16 review:** mean r gain 12q→16q = +${gain12to16.toFixed(3)}, agreement gain = ${(agreeGain * 100).toFixed(1)}pp, ` +
      `natural sessions hitting hardMax = ${(arm.natural.hardMaxHitRate * 100).toFixed(1)}%, natural mean length = ${arm.natural.lengthMean.toFixed(1)}q. ` +
      (arm.natural.hardMaxHitRate > 0.3 && gain12to16 > 0.02
        ? 'A large capped-share combined with meaningful 12→16 gains would argue for raising hardMax.'
        : 'hardMax=16 looks well-set: the cap rarely binds and/or the marginal measurement gain beyond 12–14 questions is modest.')
  );

  // confidenceGapThreshold=0.10 review (tiered threshold currently DISABLED in DEFAULT config)
  const lowAgree = arm.natural.agreementLowGap;
  const highAgree = arm.natural.agreementHighGap;
  lines.push(
    `- **confidenceGapThreshold=0.10 review (tiered threshold currently disabled):** ${(arm.natural.lowGapShare * 100).toFixed(1)}% of natural sessions stop with top1–top2 gap < 0.10; ` +
      `their top-1 agreement = ${lowAgree === null ? 'n/a' : (lowAgree * 100).toFixed(1) + '%'} vs ${highAgree === null ? 'n/a' : (highAgree * 100).toFixed(1) + '%'} for gap ≥ 0.10 sessions. ` +
      (lowAgree !== null && highAgree !== null && highAgree - lowAgree > 0.05
        ? 'Low-gap sessions are measurably less accurate, so the 0.10 gap threshold has discriminative value as an extension trigger.'
        : 'The 0.10 gap split shows little accuracy separation in this population; the threshold adds little as an extension trigger.')
  );

  return lines;
}

// ── Report ───────────────────────────────────────────────────────────

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}
function f3(x: number): string {
  return x.toFixed(3);
}

function buildReport(
  dateStr: string,
  n: number,
  seed: number,
  respondents: SyntheticRespondent[],
  arms: ArmResults[],
  ipsativeOn = false,
  consistencyOn = false,
  metaOn = false,
  shrinkageOn = false
): string {
  const L: string[] = [];
  L.push(`# Latent-Trait Recovery Harness — ${dateStr}`);
  L.push('');
  L.push('> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 6.');
  L.push('> Contract: `.git/.orchestration/sprints/sprint-contract.item6-recovery-harness.md`.');
  L.push('> Fully deterministic: identical `--seed` reproduces every number in this report.');
  L.push('');
  L.push('## Run parameters');
  L.push('');
  L.push(`- Seed: \`${seed}\``);
  L.push(`- Respondents (N): ${n}`);
  L.push(`- Noise arms: ${arms.map((a) => `\`${a.noise}\``).join(', ')} (persona-utils answer model: trait-proportional option scoring + mode-specific jitter/suboptimal/contrarian rates)`);
  L.push(`- Checkpoints (forced stop, adaptive questions only): ${CHECKPOINTS.join(' / ')}`);
  L.push('');
  L.push('## Ground-truth distribution (documented multivariate mixture)');
  L.push('');
  L.push(`1. **Centroid mixture (${pct(CENTROID_MIXTURE_WEIGHT)} of N):** pick one of the 12 archetype centroids uniformly; each trait ~ Normal(centroid_t, σ=${CENTROID_TRAIT_SD}) independently, truncated to [${TRAIT_MIN}, ${TRAIT_MAX}] by rejection sampling.`);
  L.push(`2. **General population (${pct(1 - CENTROID_MIXTURE_WEIGHT)} of N):** each trait ~ Normal(μ=${GENERAL_TRAIT_MEAN}, σ=${GENERAL_TRAIT_SD}) independently (multivariate normal, identity covariance), truncated to [${TRAIT_MIN}, ${TRAIT_MAX}].`);
  L.push('');
  L.push('Ground-truth archetype = MatcherV2 isolation top-1 on the true vector (same definition as `simulate:personas:run:ci`, which is 12/12 at exact centroids).');
  L.push('');
  const centroidCount = respondents.filter((r) => r.source === 'centroid_mixture').length;
  L.push(`Realized split: ${centroidCount} centroid-mixture / ${n - centroidCount} general.`);
  L.push('');
  const tally = new Map<string, number>();
  for (const r of respondents) tally.set(r.trueArchetype, (tally.get(r.trueArchetype) ?? 0) + 1);
  L.push('| True archetype | Count |');
  L.push('|---|---|');
  for (const [arch, count] of [...tally.entries()].sort((a, b) => b[1] - a[1])) {
    L.push(`| ${arch} | ${count} |`);
  }
  L.push('');
  L.push('## Engine configuration');
  L.push('');
  L.push('- Forced-stop arms: `DEFAULT_ASSESSMENT_CONFIG` with `minQuestions = softMaxQuestions = hardMaxQuestions = 16`, `defaultConfidenceThreshold = 2`, `confusablePairThreshold = 2` (unreachable → confidence early-stop disabled), `enableTieredThreshold = false`, `useV2Matcher = true`. Session composition (9 anchors + ≤2 calibration + adaptive utility picks) is otherwise production-identical; checkpoints snapshot engine state after exactly 8/12/16 answered questions. Engine source unmodified.');
  L.push(`- Natural arm: unmodified \`DEFAULT_ASSESSMENT_CONFIG\` (min=${DEFAULT_ASSESSMENT_CONFIG.minQuestions}, softMax=${DEFAULT_ASSESSMENT_CONFIG.softMaxQuestions}, hardMax=${DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions}, defaultConfidenceThreshold=${DEFAULT_ASSESSMENT_CONFIG.defaultConfidenceThreshold}, confusablePairThreshold=${DEFAULT_ASSESSMENT_CONFIG.confusablePairThreshold}, tieredThresholdConfig.confidenceGapThreshold=${DEFAULT_ASSESSMENT_CONFIG.tieredThresholdConfig.confidenceGapThreshold} [tiered disabled]).`);
  if (ipsativeOn) {
    // Printed ONLY for --ipsative=on runs so the default report stays byte-identical.
    L.push('- **Ipsative items (Plan Item 1): ENABLED via `--ipsative=on`** — `enableIpsativeItems: true` in both arms; the 12 equal-SDI forced-choice items (Q154–Q165) compete in the adaptive utility pool. Compare against the flag-off post-Item-11 baseline for the M4 verdict (r(X), r(P) uplift ≥ +0.03 @16q clean).');
  }
  if (consistencyOn) {
    // Printed ONLY for --consistency=on runs so the default report stays byte-identical.
    L.push('- **Consistency folding (Plan Item 2): ENABLED via `--consistency=on`** — `enableConsistencyFolding: true` in both arms. CP1\'s first is the anchor Q150 (position 9, zero slot cost); CP2/CP3 firsts are the pure-C/pure-O calibration items injected at positions 10–11 (superseding the calibration phase 1:1, so the displaced C/O signal is restored by the firsts themselves); seconds serve in the closing phase (≥4 spacing by construction, completion guaranteed). Pair disagreement folds into validityScore (0.15 adjacent-level / 0.20 opposite-pole per pair) and traitConfidences (±0.15, never trait scores); the neutral-responding detector and the match-confidence composition step are active; termination reads raw matcher output (lastRawMatches), so session length geometry is flag-off-identical.');
  }
  if (metaOn) {
    // Printed ONLY for --meta=on runs so the default report stays byte-identical.
    // The meta item is a CLOSING-phase item served only after termination;
    // both harness arms stop at or before the first universal closing
    // question, so the flag is structurally inert here (AC-4.6: no trait or
    // length regression is possible by construction — asserted by the
    // engine-level invariant tests in metaConsistency.test.ts).
    L.push('- **Meta-consistency check (Plan Item 4): ENABLED via `--meta=on`** — `enableMetaConsistency: true` in both arms. Structurally inert in this harness: the meta item Q168 is served only in the closing phase AFTER the universal closing questions (and after termination), while forced-stop sessions end at the 16-question cap and natural sessions break at the first universal closing question. Per-trait r, agreement, and adaptive length are therefore flag-off-identical by construction (verified against the locked baseline in the dated Item 4 report).');
  }
  if (shrinkageOn) {
    // Printed ONLY for --shrinkage=on runs so the default report stays byte-identical.
    L.push(`- **Confidence-weighted trait shrinkage (Plan Item 3): ENABLED via \`--shrinkage=on\`** — \`enableTraitShrinkage: true\` in both arms. At the match boundary each estimated trait is reported as \`w·estimated + (1−w)·50\` with \`w = clamp(1 − max(0, err(conf) − ${SHRINKAGE_ERROR_FLOOR.toFixed(3)}) / ${SHRINKAGE_EXCESS_SCALE}, ${SHRINKAGE_MIN_WEIGHT}, 1)\`, where \`err(conf)\` is Item 12's calibrated per-trait expected-error curve (\`expectedTraitAbsError\`, artifact v1-20260909: err 17.57 @ conf 0.578 → 8.49 @ conf 1.0). The A/B below measures r/MAE on the REPORTED (shrunken) vector — what the matcher and downstream consumers see; raw engine state (question selection, termination inputs) is untouched by construction. Per the locked AC-7.4 ceiling the calibrated error curve is flat (≈11.1) across conf 0.85–0.97 where both clean and consistent-but-biased answering sit, so the curve is deliberately conservative: near-identity for well-measured traits, biting only the low-confidence tail (conf < 0.65).`);
  }
  if (arms.some((a) => a.noise === 'desirability')) {
    // Printed ONLY when the opt-in biased arm runs — default report unchanged.
    L.push(`- **Desirability-biased answer arm (sprint m4-desirability-bias-arm): PRESENT via \`--noise=desirability\`** — option score = true-trait alignment + ${getDesirabilityBiasBeta()} × desirabilityProxy(option). Proxy = declared \`socialDesirabilityIndex\` (centered) for ipsative options, Σ max(0, positive loadings)/4 for all other bank options. See \`lib/persona-utils.ts\` for the full model definition and β tuning rationale.`);
  }
  L.push('');

  for (const arm of arms) {
    L.push(`## Noise arm: \`${arm.noise}\``);
    L.push('');
    L.push('### Per-trait recovery — Pearson r(true, estimated)');
    L.push('');
    L.push('| Trait | r @8q | r @12q | r @16q | MAE @16q | mean samples @16q |');
    L.push('|---|---|---|---|---|---|');
    for (const t of ALL_TRAITS) {
      const m8 = arm.byCheckpoint.get(8)!;
      const m12 = arm.byCheckpoint.get(12)!;
      const m16 = arm.byCheckpoint.get(16)!;
      L.push(
        `| ${t} | ${f3(m8.pearsonByTrait[t])} | ${f3(m12.pearsonByTrait[t])} | ${f3(m16.pearsonByTrait[t])} | ${m16.maeByTrait[t].toFixed(1)} | ${m16.meanSampleCountByTrait[t].toFixed(1)} |`
      );
    }
    const meanR = (m: CheckpointMetrics) => f3(mean(ALL_TRAITS.map((t) => m.pearsonByTrait[t])));
    L.push(
      `| **mean** | **${meanR(arm.byCheckpoint.get(8)!)}** | **${meanR(arm.byCheckpoint.get(12)!)}** | **${meanR(arm.byCheckpoint.get(16)!)}** | | |`
    );
    L.push('');
    L.push('### Archetype top-1 agreement & confidence');
    L.push('');
    L.push('| Metric | @8q | @12q | @16q | natural stop |');
    L.push('|---|---|---|---|---|');
    L.push(
      `| Top-1 agreement | ${pct(arm.byCheckpoint.get(8)!.top1Agreement)} | ${pct(arm.byCheckpoint.get(12)!.top1Agreement)} | ${pct(arm.byCheckpoint.get(16)!.top1Agreement)} | ${pct(arm.natural.top1AgreementAtStop)} |`
    );
    L.push(
      `| — centroid-mixture respondents | ${pct(arm.byCheckpoint.get(8)!.top1AgreementBySource.centroid_mixture)} | ${pct(arm.byCheckpoint.get(12)!.top1AgreementBySource.centroid_mixture)} | ${pct(arm.byCheckpoint.get(16)!.top1AgreementBySource.centroid_mixture)} | ${pct(arm.natural.top1AgreementAtStopBySource.centroid_mixture)} |`
    );
    L.push(
      `| — general respondents | ${pct(arm.byCheckpoint.get(8)!.top1AgreementBySource.general)} | ${pct(arm.byCheckpoint.get(12)!.top1AgreementBySource.general)} | ${pct(arm.byCheckpoint.get(16)!.top1AgreementBySource.general)} | ${pct(arm.natural.top1AgreementAtStopBySource.general)} |`
    );
    L.push(
      `| Mean trait confidence | ${f3(arm.byCheckpoint.get(8)!.meanConfidence)} | ${f3(arm.byCheckpoint.get(12)!.meanConfidence)} | ${f3(arm.byCheckpoint.get(16)!.meanConfidence)} | ${f3(arm.natural.meanConfidenceAtStop)} |`
    );
    L.push('');
    L.push('### Natural-termination session stats');
    L.push('');
    L.push(`- Adaptive questions: mean ${arm.natural.lengthMean.toFixed(1)}, median ${arm.natural.lengthMedian}, range ${arm.natural.lengthMin}–${arm.natural.lengthMax}`);
    L.push(`- Hit hardMax (${DEFAULT_ASSESSMENT_CONFIG.hardMaxQuestions}q): ${pct(arm.natural.hardMaxHitRate)}; stopped ≤12q: ${pct(arm.natural.stopAtOrBelow12Rate)}`);
    L.push(`- Mean top1–top2 confidence gap at stop: ${f3(arm.natural.meanGapAtStop)}; sessions stopping with gap < 0.10: ${pct(arm.natural.lowGapShare)}`);
    L.push(`- Per-trait r at natural stop: ${ALL_TRAITS.map((t) => `${t}=${f3(arm.natural.pearsonByTraitAtStop[t])}`).join(', ')}`);
    L.push('');
    if (ipsativeOn) {
      L.push('### Ipsative serving stats (Plan Item 1 A/B)');
      L.push('');
      L.push(`- Forced-16 sessions answering ≥1 ipsative item: ${pct(arm.ipsative.forcedServedRate)} (mean ${arm.ipsative.forcedMeanAnswers.toFixed(2)} ipsative answers/session)`);
      L.push(`- Natural sessions answering ≥1 ipsative item: ${pct(arm.ipsative.naturalServedRate)} (mean ${arm.ipsative.naturalMeanAnswers.toFixed(2)})`);
      L.push('');
    }
    if (consistencyOn) {
      const locked = ITEM2_LOCKED_BASELINE[arm.noise];
      L.push('### Consistency-folding A/B (Plan Item 2, vs locked post-Item-11 flag-off baseline)');
      L.push('');
      L.push(`- Pair completion (started → completed): natural ${pct(arm.consistency.naturalPairCompletionRate)}, forced-16 ${pct(arm.consistency.forcedPairCompletionRate)}; mean pairs started per natural session: ${arm.consistency.naturalPairStartedMean.toFixed(2)}`);
      L.push(`- Neutral-responding detector fire rate (natural arm): ${pct(arm.consistency.naturalNeutralFireRate)}`);
      L.push(`- Natural mean length: ${arm.natural.lengthMean.toFixed(2)}q (locked baseline ${locked ? locked.naturalMeanLength.toFixed(1) : 'n/a'}q; M14 band ${ITEM2_LENGTH_BAND.center} ± ${ITEM2_LENGTH_BAND.tolerance} → [${(ITEM2_LENGTH_BAND.center - ITEM2_LENGTH_BAND.tolerance).toFixed(1)}, ${(ITEM2_LENGTH_BAND.center + ITEM2_LENGTH_BAND.tolerance).toFixed(1)}]) ${arm.natural.lengthMean >= ITEM2_LENGTH_BAND.center - ITEM2_LENGTH_BAND.tolerance && arm.natural.lengthMean <= ITEM2_LENGTH_BAND.center + ITEM2_LENGTH_BAND.tolerance ? '✅ in band' : '❌ OUT OF BAND'}`);
      if (locked) {
        L.push('');
        L.push('| Trait | r@16q flag-on | r@16q locked | Δ | r@natural flag-on | r@natural locked | Δ | regression > 0.03? |');
        L.push('|---|---|---|---|---|---|---|---|');
        for (const t of ALL_TRAITS) {
          const r16 = arm.byCheckpoint.get(16)!.pearsonByTrait[t];
          const rn = arm.natural.pearsonByTraitAtStop[t];
          const d16 = r16 - locked.r16[t];
          const dn = rn - locked.rNatural[t];
          const regressed = d16 < -ITEM2_MAX_R_REGRESSION || dn < -ITEM2_MAX_R_REGRESSION;
          L.push(`| ${t} | ${f3(r16)} | ${f3(locked.r16[t])} | ${d16 >= 0 ? '+' : ''}${f3(d16)} | ${f3(rn)} | ${f3(locked.rNatural[t])} | ${dn >= 0 ? '+' : ''}${f3(dn)} | ${regressed ? '❌ YES' : '✅ no'} |`);
        }
      }
      L.push('');
    }
    if (shrinkageOn) {
      const locked = ITEM2_LOCKED_BASELINE[arm.noise];
      L.push('### Trait-shrinkage A/B (Plan Item 3, vs locked post-Item-11 flag-off baseline)');
      L.push('');
      L.push(`- Mean max |reported − raw| per natural session: ${arm.shrinkage.naturalMeanMaxAbsDelta.toFixed(3)} points (AC-3.3 no-harm side: clean-arm traits must be near-identity)`);
      L.push(`- Natural mean length: ${arm.natural.lengthMean.toFixed(2)}q (locked baseline ${locked ? locked.naturalMeanLength.toFixed(1) : 'n/a'}q; M14 band ${ITEM2_LENGTH_BAND.center} ± ${ITEM2_LENGTH_BAND.tolerance}) ${arm.natural.lengthMean >= ITEM2_LENGTH_BAND.center - ITEM2_LENGTH_BAND.tolerance && arm.natural.lengthMean <= ITEM2_LENGTH_BAND.center + ITEM2_LENGTH_BAND.tolerance ? '✅ in band' : '❌ OUT OF BAND'}`);
      if (locked) {
        L.push('');
        L.push('| Trait | r@16q flag-on | r@16q locked | Δ | r@natural flag-on | r@natural locked | Δ | regression > 0.03? |');
        L.push('|---|---|---|---|---|---|---|---|');
        for (const t of ALL_TRAITS) {
          const r16 = arm.byCheckpoint.get(16)!.pearsonByTrait[t];
          const rn = arm.natural.pearsonByTraitAtStop[t];
          const d16 = r16 - locked.r16[t];
          const dn = rn - locked.rNatural[t];
          const regressed = d16 < -ITEM2_MAX_R_REGRESSION || dn < -ITEM2_MAX_R_REGRESSION;
          L.push(`| ${t} | ${f3(r16)} | ${f3(locked.r16[t])} | ${d16 >= 0 ? '+' : ''}${f3(d16)} | ${f3(rn)} | ${f3(locked.rNatural[t])} | ${dn >= 0 ? '+' : ''}${f3(dn)} | ${regressed ? '❌ YES' : '✅ no'} |`);
        }
        L.push('');
        L.push('Note: r is computed on the REPORTED (shrunken) vector — the shrink is a per-session affine pull toward 50 with w ∈ [~0.88, 1], so clean-arm r moves only through the w-variance across respondents, not through added noise.');
      }
      L.push('');
    }
    L.push('### Verdict');
    L.push('');
    L.push(...buildVerdicts(arm));
    L.push('');
  }

  L.push('---');
  L.push('Generated by `npm run simulate:recovery` (`scripts/simulate/run-recovery-harness.ts`).');
  L.push('');
  return L.join('\n');
}

// ── Machine-readable payload (P3 gate: --json) ───────────────────────

/**
 * Structured companion to the markdown report. The `gate:assessment` CI gate
 * reads THESE fields (never the markdown verdict lines, whose M2/M3 logic
 * predates the amended definitions). All floats rounded to 6dp for byte
 * stability across runs.
 */
function buildRecoveryJson(
  dateStr: string,
  n: number,
  seed: number,
  respondents: SyntheticRespondent[],
  arms: ArmResults[],
  flags: { ipsativeOn: boolean; consistencyOn: boolean; metaOn: boolean; shrinkageOn: boolean }
): Record<string, unknown> {
  const centroidCount = respondents.filter((r) => r.source === 'centroid_mixture').length;
  return {
    suite: 'latent-trait-recovery',
    planItem: 6,
    generatedAt: dateStr,
    seed,
    n,
    checkpoints: [...CHECKPOINTS],
    population: {
      centroidMixtureWeight: CENTROID_MIXTURE_WEIGHT,
      centroidTraitSd: CENTROID_TRAIT_SD,
      generalTraitMean: GENERAL_TRAIT_MEAN,
      generalTraitSd: GENERAL_TRAIT_SD,
      traitMin: TRAIT_MIN,
      traitMax: TRAIT_MAX,
      realizedCentroidMixture: centroidCount,
      realizedGeneral: n - centroidCount,
    },
    engineFlags: { ...flags },
    arms: arms.map((arm) => ({
      noise: arm.noise,
      checkpoints: Object.fromEntries(
        CHECKPOINTS.map((cp) => {
          const m = arm.byCheckpoint.get(cp)!;
          const pearsonByTrait = {} as Record<TraitKey, number>;
          const maeByTrait = {} as Record<TraitKey, number>;
          const meanSampleCountByTrait = {} as Record<TraitKey, number>;
          for (const t of ALL_TRAITS) {
            pearsonByTrait[t] = round6(m.pearsonByTrait[t]);
            maeByTrait[t] = round6(m.maeByTrait[t]);
            meanSampleCountByTrait[t] = round6(m.meanSampleCountByTrait[t]);
          }
          return [
            String(cp),
            {
              checkpoint: cp,
              pearsonByTrait,
              maeByTrait,
              top1Agreement: round6(m.top1Agreement),
              top1AgreementBySource: {
                centroid_mixture: round6(m.top1AgreementBySource.centroid_mixture),
                general: round6(m.top1AgreementBySource.general),
              },
              meanConfidence: round6(m.meanConfidence),
              meanSampleCountByTrait,
            },
          ];
        })
      ),
      natural: {
        lengthMean: round6(arm.natural.lengthMean),
        lengthMedian: arm.natural.lengthMedian,
        lengthMin: arm.natural.lengthMin,
        lengthMax: arm.natural.lengthMax,
        hardMaxHitRate: round6(arm.natural.hardMaxHitRate),
        stopAtOrBelow12Rate: round6(arm.natural.stopAtOrBelow12Rate),
        pearsonByTraitAtStop: Object.fromEntries(
          ALL_TRAITS.map((t) => [t, round6(arm.natural.pearsonByTraitAtStop[t])])
        ),
        top1AgreementAtStop: round6(arm.natural.top1AgreementAtStop),
        top1AgreementAtStopBySource: {
          centroid_mixture: round6(arm.natural.top1AgreementAtStopBySource.centroid_mixture),
          general: round6(arm.natural.top1AgreementAtStopBySource.general),
        },
        meanConfidenceAtStop: round6(arm.natural.meanConfidenceAtStop),
        meanGapAtStop: round6(arm.natural.meanGapAtStop),
        lowGapShare: round6(arm.natural.lowGapShare),
      },
    })),
  };
}

// ── Per-session export (Plan Item 12, opt-in via --export-sessions) ──

/**
 * One JSONL row per session observation: natural sessions produce one row
 * each; each forced run contributes one row per checkpoint (8/12/16). The row
 * shape mirrors `CalibrationRow` in
 * `packages/shared/src/personality/confidenceCalibration.ts` (kept structurally
 * identical by the fit script — the shared module itself has no file I/O).
 * All floats are rounded to 6dp so the export is byte-stable across runs.
 */
interface SessionExportRow {
  sessionId: string;
  respondentId: string;
  noise: NoiseMode;
  arm: 'natural' | 'forced';
  checkpoint: Checkpoint | null;
  questionsAnswered: number;
  meanTraitConfidence: number;
  traitConfidences: Record<TraitKey, number>;
  traitAbsErrors: Record<TraitKey, number>;
  estimatedTop1: string;
  trueArchetype: string;
  correct: 0 | 1;
}

function round6(x: number): number {
  return Math.round(x * 1e6) / 1e6;
}

function buildSessionExportRow(
  respondent: SyntheticRespondent,
  noise: NoiseMode,
  arm: SessionExportRow['arm'],
  checkpoint: Checkpoint | null,
  questionsAnswered: number,
  snapshot: Snapshot
): SessionExportRow {
  const traitAbsErrors = {} as Record<TraitKey, number>;
  const traitConfidences = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    traitConfidences[trait] = round6(snapshot.confidences[trait]);
    traitAbsErrors[trait] = round6(Math.abs(snapshot.traits[trait] - respondent.trueTraits[trait]));
  }
  const estimatedTop1 = snapshot.topArchetype ?? '';
  return {
    sessionId: `${arm}${checkpoint ?? ''}:${noise}:${respondent.id}`,
    respondentId: respondent.id,
    noise,
    arm,
    checkpoint,
    questionsAnswered,
    meanTraitConfidence: round6(snapshot.meanConfidence),
    traitConfidences,
    traitAbsErrors,
    estimatedTop1,
    trueArchetype: respondent.trueArchetype,
    correct: estimatedTop1 === respondent.trueArchetype ? 1 : 0,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const { n, seed, noiseModes, outFile, jsonOutFile, exportSessionsFile, ipsativeOn, consistencyOn, metaOn, shrinkageOn } = parseArgs();
  if (n < 2000) {
    console.error('❌ N must be ≥ 2,000 (contract AC-6.1). Use --n=2000 or larger.');
    process.exit(1);
  }

  const startedAt = Date.now();
  const respondents = generatePopulation(n, seed);

  const arms: ArmResults[] = [];
  const exportRows: SessionExportRow[] = [];
  for (const noise of noiseModes) {
    const forcedRuns: { snapshots: Map<Checkpoint, Snapshot>; ipsativeAnswers: number; pairsStarted: number; pairsCompleted: number }[] = [];
    const naturalRuns: NaturalRun[] = [];

    for (let i = 0; i < respondents.length; i++) {
      const respondent = respondents[i];
      const forced = runForcedSession(respondent, noise, mulberry32(streamSeed(seed, i, `forced:${noise}`)), ipsativeOn, consistencyOn, metaOn, shrinkageOn);
      const natural = runNaturalSession(respondent, noise, mulberry32(streamSeed(seed, i, `natural:${noise}`)), ipsativeOn, consistencyOn, metaOn, shrinkageOn);
      forcedRuns.push(forced);
      naturalRuns.push(natural);

      if (exportSessionsFile) {
        for (const cp of CHECKPOINTS) {
          const snap = forced.snapshots.get(cp);
          if (snap) exportRows.push(buildSessionExportRow(respondent, noise, 'forced', cp, cp, snap));
        }
        exportRows.push(
          buildSessionExportRow(respondent, noise, 'natural', null, natural.adaptiveCount, natural.snapshot)
        );
      }
    }

    arms.push(computeArmMetrics(respondents, noise, forcedRuns, naturalRuns));
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const report = buildReport(dateStr, n, seed, respondents, arms, ipsativeOn, consistencyOn, metaOn, shrinkageOn);
  const outPath = outFile
    ? path.resolve(outFile)
    : path.join(__dirname, '..', '..', 'docs', 'reports', `${dateStr}-latent-trait-recovery.md`);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');

  let jsonPath = '';
  if (jsonOutFile) {
    jsonPath = path.resolve(jsonOutFile);
    fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
    const json = buildRecoveryJson(dateStr, n, seed, respondents, arms, {
      ipsativeOn,
      consistencyOn,
      metaOn,
      shrinkageOn,
    });
    fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');
  }

  let exportPath = '';
  if (exportSessionsFile) {
    exportPath = path.resolve(exportSessionsFile);
    fs.mkdirSync(path.dirname(exportPath), { recursive: true });
    fs.writeFileSync(exportPath, exportRows.map((r) => JSON.stringify(r)).join('\n') + '\n', 'utf8');
  }

  // ── Final summary (only console output) ──
  console.log('🔬 Latent-Trait Recovery Harness');
  console.log(`   N=${n}  seed=${seed}  arms=${noiseModes.join(',')}  runtime=${((Date.now() - startedAt) / 1000).toFixed(1)}s`);
  for (const arm of arms) {
    console.log('');
    console.log(`   [${arm.noise}] per-trait Pearson r (8q / 12q / 16q):`);
    for (const t of ALL_TRAITS) {
      console.log(
        `     ${t}: ${f3(arm.byCheckpoint.get(8)!.pearsonByTrait[t])} / ${f3(arm.byCheckpoint.get(12)!.pearsonByTrait[t])} / ${f3(arm.byCheckpoint.get(16)!.pearsonByTrait[t])}`
      );
    }
    console.log(
      `   [${arm.noise}] top-1 agreement: ${pct(arm.byCheckpoint.get(8)!.top1Agreement)} / ${pct(arm.byCheckpoint.get(12)!.top1Agreement)} / ${pct(arm.byCheckpoint.get(16)!.top1Agreement)}  (natural: ${pct(arm.natural.top1AgreementAtStop)}, mean length ${arm.natural.lengthMean.toFixed(1)}q, cap-hit ${pct(arm.natural.hardMaxHitRate)})`
    );
    if (ipsativeOn) {
      console.log(
        `   [${arm.noise}] ipsative served: forced ${pct(arm.ipsative.forcedServedRate)} of sessions (mean ${arm.ipsative.forcedMeanAnswers.toFixed(2)}), natural ${pct(arm.ipsative.naturalServedRate)} (mean ${arm.ipsative.naturalMeanAnswers.toFixed(2)})`
      );
    }
    if (consistencyOn) {
      console.log(
        `   [${arm.noise}] consistency: pair completion natural ${pct(arm.consistency.naturalPairCompletionRate)} / forced ${pct(arm.consistency.forcedPairCompletionRate)}, neutral fired ${pct(arm.consistency.naturalNeutralFireRate)}`
      );
    }
    if (shrinkageOn) {
      console.log(
        `   [${arm.noise}] shrinkage: mean max |reported−raw| ${arm.shrinkage.naturalMeanMaxAbsDelta.toFixed(3)} pts (natural arm)`
      );
    }
  }
  console.log('');
  console.log(`💾 Report: ${outPath}`);
  if (jsonPath) {
    console.log(`   JSON:   ${jsonPath}`);
  }
  if (exportPath) {
    console.log(`   Session export: ${exportPath} (${exportRows.length} rows)`);
  }
}

main();
