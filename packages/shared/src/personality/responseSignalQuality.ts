/**
 * Response Signal-Quality Gate (P5a)
 * 作答信号质量评估 — 纯函数、只读、建议性
 *
 * Computes a post-hoc signal-quality verdict over a completed V4 session's
 * answer history. The verdict is ADVISORY ONLY: it never blocks result
 * assignment, never changes trait scores, matcher outputs, or confidence.
 * It exists so the client can gently offer a retest when the answer pattern
 * carries too little signal to trust (random clicking, straight-lining,
 * midpoint-hugging).
 *
 * Design notes (calibrated 2026-09-14, scripts/simulate/measure-signal-quality-gate.ts)
 * ------------
 * - The question bank is positively AND positionally keyed (see
 *   scripts/simulate/data/question-bias-audit.json: random answering drifts
 *   E+11; the high pole sits at a consistent ordinal position). Two
 *   consequences shaped this design:
 *     1. VALUE-based signals (same-option-value share, identical-value runs)
 *        are UNSOUND here: a genuine extreme-but-consistent user picks the
 *        same value label repeatedly (measured: genuine personas show
 *        longest run up to 10 and same-value share up to 0.79), and in
 *        production the server shuffles options, so a real straight-liner's
 *        VALUES are uniform anyway. Those metrics are reported for
 *        telemetry but deliberately NOT scored.
 *     2. Content-based signals must neutralize keying, so the coherence
 *        signal below works on each user's OWN per-trait reference
 *        direction (derived from their chosen loadings), not on absolute
 *        loadings.
 * - The primary discriminator is CHOICE INCOHERENCE gated by DIRECTION
 *   STRENGTH: for each answer we measure the range-weighted normalized gap
 *   between the chosen option's alignment with the user's leave-one-out
 *   self-consistent reference direction and the best available option's
 *   alignment. A reader answering from a stable latent profile picks
 *   near-optimally (gap ≈ 0.05–0.21 even under moderate noise); a
 *   uniform-random clicker averages gap ≈ 0.5 by construction; a
 *   production straight-liner is content-random (options are shuffled) and
 *   lands in the same place. The full penalty fires only when the gap is
 *   high AND the session produced no strong self-consistent trait
 *   direction — incoherent-but-directional sessions are noisy-but-real
 *   users and stay unflagged.
 * - Answer TIMING is not available to the server and is deliberately unused.
 * - No single signal is trusted alone to flag a borderline pattern: the
 *   verdict combines incoherence+direction, neutral responding, and
 *   evidence sufficiency guards (per-trait sample counts).
 */

import { AnsweredQuestion, TraitKey } from './types';
import { getQuestionById } from './questionsV4';
import { computeNeutralResponseStats } from './consistencyPairs';

// ── Locked thresholds (P5a) ──────────────────────────────────────────
//
// Each constant was calibrated against the persona simulation suite
// (genuine arm: all-personas.json centroids + boundaries, clean + moderate
// noise — false-flag budget ≤ 5%) and the adversarial arms over the
// Item-6 mixture population (n = 300, seed = 42 — random-clicker true-flag
// target ≥ 80%) via scripts/simulate/measure-signal-quality-gate.ts.
// Do not retune without re-running both arms.

/**
 * Choice-incoherence flag: range-weighted mean per-answer normalized
 * optimality gap at or above which the answering pattern resembles
 * content-random picking.
 *
 * Gap definition (per answered question): align every option with the
 * user's leave-one-out self-reference trait direction (the mean of their
 * OTHER chosen loadings per differentiated trait, scaled to [-1,1]);
 * gap = (bestAlignment − chosenAlignment) / (bestAlignment − worstAlignment),
 * weighted by (best − worst) so barely-differentiating questions cannot
 * inject normalized noise. Uniform-random picking has expected gap ≈ 0.5
 * (measured random-clicker p50 = 0.50). Genuine personas measure p50 ≈ 0.05
 * (clean) / ≈ 0.21 (moderate noise), p90 ≈ 0.36.
 *
 * LOCKED 2026-09-14 at 0.33 in an AND rule with the weak-direction cut
 * below, after 4-seed calibration (42 / 7 / 1337 / 20260909, n=300):
 *   - genuine false-flag (45 personas × {clean, moderate}): 3.3–4.4%
 *   - random-clicker true-flag: 77–83% (82.3% on the contract seed 42)
 */
export const SIGNAL_QUALITY_INCOHERENCE_FLAG = 0.33;

/**
 * Weak-direction cut for the incoherence AND rule. A session only earns the
 * full incoherence penalty when its mean |self-reference direction| is at
 * or below this value — i.e. the answers neither cohere NOR point anywhere.
 * Psychometric semantics: incoherent answers WITH a strong self-consistent
 * direction are a noisy-but-real user (borderline personas under moderate
 * noise legitimately live there); incoherent answers with NO direction mean
 * the session carried no trait signal at all.
 * Random clickers measure direction p50 ≈ 0.19 (p90 ≈ 0.25); genuine
 * personas p10 ≈ 0.23 (moderate) / 0.30 (clean). The 0.24 cut sits in the
 * overlap but only binds jointly with incoherence, which is what keeps the
 * combined false-flag rate ≤ 5%.
 */
export const SIGNAL_QUALITY_WEAK_DIRECTION_FLAG = 0.24;

/**
 * Neutral-responding share flag: fraction of eligible answers that picked
 * the question's minimum-total-|loading| option. Reuses the
 * consistencyPairs detector's eligibility floor and firing semantics so
 * the gate and the (flag-gated) engine penalty agree on what
 * midpoint-hugging means. Alone this is a WEAK signal (penalty 40 does not
 * cross the verdict cut); it flags in combination with incoherence, which
 * is exactly the midpoint-hugger profile (min-|loading| options are rarely
 * alignment-optimal).
 */
export const SIGNAL_QUALITY_NEUTRAL_SHARE_FLAG = 0.7;

/**
 * Sessions shorter than this are not judged: the coherence estimator needs
 * a handful of per-trait samples to form a reference direction, and the
 * adaptive engine guarantees minQuestions (8) + 2 closing anyway, so a
 * shorter history means the verdict would be built on noise. Such sessions
 * return quality 'ok' with score 100 and no reasons.
 */
export const SIGNAL_QUALITY_MIN_ANSWERS = 8;

/**
 * A trait needs at least this many chosen-loading samples before it can
 * contribute a leave-one-out reference direction (LOO leaves n−1 samples;
 * at n = 2 the reference would rest on a single point — pure noise).
 */
export const SIGNAL_QUALITY_MIN_SAMPLES_PER_TRAIT = 3;

/**
 * Verdict cut: composite score strictly below this → quality 'low'.
 * Incoherence (penalty 60) crosses it alone — random clicking is THE
 * target pathology of this gate. Neutral responding (40) does not cross
 * alone, which keeps consistent-but-moderate genuine users safe; the
 * midpoint-hugger is caught by the combination.
 */
export const SIGNAL_QUALITY_LOW_SCORE_THRESHOLD = 50;

/** Penalty weights per signal (subtracted from 100). */
export const SIGNAL_QUALITY_PENALTY_INCOHERENCE = 60;
/**
 * Soft evidence when answers are incoherent but DO point in a self-
 * consistent direction (noisy-but-real user). Never crosses the verdict
 * cut alone; only combines with another signal.
 */
export const SIGNAL_QUALITY_PENALTY_INCOHERENCE_SOFT = 20;
export const SIGNAL_QUALITY_PENALTY_NEUTRAL_RESPONDING = 40;

// ── Types ────────────────────────────────────────────────────────────

export type SignalQuality = 'ok' | 'low';

/** Machine-readable reason codes; stable for client/analytics consumption. */
export type SignalQualityReason =
  | 'choice_incoherence'  // answers scatter like content-random picking
  | 'neutral_responding'; // midpoint/min-loading hugging

export interface SignalQualityVerdict {
  quality: SignalQuality;
  /** 0–100, higher = more trustworthy answer signal. */
  score: number;
  reasons: SignalQualityReason[];
}

/** Minimal answer shape the gate needs (EngineState.questionHistory-compatible). */
export type SignalQualityAnswer = Pick<AnsweredQuestion, 'questionId' | 'selectedOption'>;

export type SignalQualityInput =
  | ReadonlyArray<SignalQualityAnswer>
  | { questionHistory: ReadonlyArray<SignalQualityAnswer> };

// ── Implementation ───────────────────────────────────────────────────

function normalizeAnswers(input: SignalQualityInput): ReadonlyArray<SignalQualityAnswer> {
  if (Array.isArray(input)) return input as ReadonlyArray<SignalQualityAnswer>;
  return (input as { questionHistory: ReadonlyArray<SignalQualityAnswer> }).questionHistory;
}

/**
 * Raw per-signal metrics behind the verdict. Exported for calibration
 * tooling (scripts/simulate/measure-signal-quality-gate.ts) and for
 * observability payloads — the verdict logic below consumes exactly these
 * numbers, so telemetry always matches the decision.
 */
export interface SignalQualityMetrics {
  answerCount: number;
  /**
   * Mean per-answer normalized optimality gap (0 = every answer was the
   * best-aligned option for the user's self-consistent direction;
   * 0.5 = uniform-random expectation). Null when too little per-trait
   * evidence exists to form a reference direction.
   */
  incoherence: number | null;
  /** Share of eligible answers that picked the min-total-|loading| option. */
  neutralResponseShare: number;
  /** The consistencyPairs neutral detector's own eligibility+firing verdict. */
  neutralDetectorFired: boolean;
  /** Number of traits with ≥ SIGNAL_QUALITY_MIN_SAMPLES_PER_TRAIT samples. */
  traitsWithUsableSamples: number;
  /** Telemetry only (NOT scored — see header): same-value concentration. */
  maxSameOptionShare: number;
  /** Telemetry only (NOT scored — see header): longest identical-value run. */
  longestIdenticalRun: number;
  /**
   * Mean |full-sample reference direction| across usable traits (0–1).
   * Random answering has no stable latent direction (≈ bank-keying drift,
   * small); a genuine profile points somewhere (larger). Reported for
   * calibration/telemetry.
   */
  meanAbsReferenceDirection: number | null;
  /** Telemetry: population stdev of the per-answer normalized gaps. */
  incoherenceSpread: number | null;
  /** Telemetry: usable traits whose full-sample |direction| ≥ 0.25. */
  strongTraitCount: number;
}

export function computeSignalQualityMetrics(input: SignalQualityInput): SignalQualityMetrics {
  const answers = normalizeAnswers(input);

  // ── Telemetry metrics (not scored; see header note 1) ──
  const optionCounts = new Map<string, number>();
  let longestRun = answers.length > 0 ? 1 : 0;
  let currentRun = answers.length > 0 ? 1 : 0;
  for (let i = 0; i < answers.length; i++) {
    optionCounts.set(answers[i].selectedOption, (optionCounts.get(answers[i].selectedOption) ?? 0) + 1);
    if (i > 0) {
      if (answers[i].selectedOption === answers[i - 1].selectedOption) {
        currentRun++;
        if (currentRun > longestRun) longestRun = currentRun;
      } else {
        currentRun = 1;
      }
    }
  }
  const maxSameOptionShare = answers.length > 0
    ? Math.max(...optionCounts.values()) / answers.length
    : 0;

  // ── Self-reference trait direction from chosen loadings ──
  // For each trait, the user's direction is the mean of the loadings THEY
  // chose on questions that differentiate that trait, scaled to [-1, 1]
  // (loadings live in -3..+3 by convention). Keying-neutral: a consistently
  // negative-X user gets a negative reference exactly like a positive one
  // gets a positive reference.
  const chosenLoadingsByTrait = new Map<TraitKey, number[]>();
  const resolvedAnswers: Array<{
    question: NonNullable<ReturnType<typeof getQuestionById>>;
    chosenValue: string;
    chosenLoadings: Partial<Record<TraitKey, number>>;
    /** Traits this question differentiates (option-loading sd ≥ 0.5). */
    differentiatedTraits: TraitKey[];
  }> = [];
  const ALL_TRAIT_KEYS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
  for (const a of answers) {
    const question = getQuestionById(a.questionId);
    if (!question || question.options.length < 2) continue;
    const chosen = question.options.find((o) => o.value === a.selectedOption);
    if (!chosen) continue;
    // Use EVERY trait the question differentiates (not just primaryTraits):
    // the option set carries loadings on all six traits, and restricting to
    // primary traits starves the per-trait reference of samples (measured
    // 2026-09-14: primary-only references top out the random-clicker
    // true-flag rate at ~70% within the false-flag budget; differentiated-
    // trait references roughly double per-trait sample counts).
    const differentiatedTraits = ALL_TRAIT_KEYS.filter((trait) => {
      const loadings = question.options.map((o) => o.traitScores[trait] ?? 0);
      const mean = loadings.reduce((s, v) => s + v, 0) / loadings.length;
      const sd = Math.sqrt(loadings.reduce((s, v) => s + (v - mean) * (v - mean), 0) / loadings.length);
      return sd >= 0.5;
    });
    resolvedAnswers.push({ question, chosenValue: a.selectedOption, chosenLoadings: chosen.traitScores, differentiatedTraits });
    for (const trait of differentiatedTraits) {
      const bucket = chosenLoadingsByTrait.get(trait);
      const loading = chosen.traitScores[trait] ?? 0;
      if (bucket) bucket.push(loading);
      else chosenLoadingsByTrait.set(trait, [loading]);
    }
  }

  // ── Incoherence: normalized optimality gap vs a LEAVE-ONE-OUT reference ──
  // Each answer is scored against the reference direction computed WITHOUT
  // itself. This matters: with only ~3–8 samples per trait, a full-sample
  // reference partially fits a random clicker's own noise, dragging the
  // measured gap from the uniform-random expectation (0.5) down to ~0.35
  // and destroying separation (measured 2026-09-14, first calibration pass).
  const gaps: number[] = [];
  const gapWeights: number[] = [];
  for (const { question, chosenValue, chosenLoadings, differentiatedTraits } of resolvedAnswers) {
    const looDirection = new Map<TraitKey, number>();
    for (const trait of differentiatedTraits) {
      const samples = chosenLoadingsByTrait.get(trait);
      if (!samples || samples.length < SIGNAL_QUALITY_MIN_SAMPLES_PER_TRAIT) continue;
      const chosenLoading = chosenLoadings[trait] ?? 0;
      const looMean = (samples.reduce((s, v) => s + v, 0) - chosenLoading) / (samples.length - 1);
      looDirection.set(trait, looMean / 3);
    }
    if (looDirection.size === 0) continue;
    const align = (loadings: Partial<Record<TraitKey, number>>): number => {
      let s = 0;
      for (const [trait, dir] of looDirection) s += dir * (loadings[trait] ?? 0);
      return s;
    };
    const alignments = question.options.map((o) => align(o.traitScores));
    const best = Math.max(...alignments);
    const worst = Math.min(...alignments);
    if (best - worst < 1e-6) continue; // question cannot rank options against this reference
    // Weight by the question's alignment range: a question that barely
    // differentiates (given this reference) would otherwise inject pure
    // noise amplified to the full [0,1] scale by normalization. Range-
    // weighting keeps the verdict driven by questions that actually rank
    // the options (measured 2026-09-14: unweighted gaps inflated the
    // genuine-moderate tail past the 5% false-flag budget).
    gaps.push((best - align(chosenLoadings)) / (best - worst));
    gapWeights.push(best - worst);
  }
  const totalGapWeight = gapWeights.reduce((s, v) => s + v, 0);
  const incoherence = gaps.length > 0 && totalGapWeight > 0
    ? gaps.reduce((s, v, i) => s + v * gapWeights[i], 0) / totalGapWeight
    : null;
  const incoherenceSpread = gaps.length > 1
    ? Math.sqrt(gaps.reduce((s, v) => s + (v - (incoherence ?? 0)) * (v - (incoherence ?? 0)), 0) / gaps.length)
    : null;

  const neutralStats = computeNeutralResponseStats(answers as AnsweredQuestion[]);

  let traitsWithUsableSamples = 0;
  let strongTraitCount = 0;
  const absDirections: number[] = [];
  for (const samples of chosenLoadingsByTrait.values()) {
    if (samples.length >= SIGNAL_QUALITY_MIN_SAMPLES_PER_TRAIT) {
      traitsWithUsableSamples++;
      const absDir = Math.abs(samples.reduce((s, v) => s + v, 0) / samples.length) / 3;
      absDirections.push(absDir);
      if (absDir >= 0.25) strongTraitCount++;
    }
  }
  const meanAbsReferenceDirection = absDirections.length > 0
    ? absDirections.reduce((s, v) => s + v, 0) / absDirections.length
    : null;

  return {
    answerCount: answers.length,
    incoherence,
    neutralResponseShare: neutralStats.share,
    neutralDetectorFired: neutralStats.fired,
    traitsWithUsableSamples,
    maxSameOptionShare,
    longestIdenticalRun: longestRun,
    meanAbsReferenceDirection,
    incoherenceSpread,
    strongTraitCount,
  };
}

/**
 * Assess the signal quality of a completed session's answers.
 *
 * Pure and deterministic: same answers in → same verdict out. No I/O, no
 * RNG, no clock, no engine-state mutation.
 */
export function assessResponseSignalQuality(input: SignalQualityInput): SignalQualityVerdict {
  const metrics = computeSignalQualityMetrics(input);

  // Insufficient history: never flag on noise. Short sessions keep quality
  // 'ok' so the retest prompt can never fire on a truncated/legacy record.
  if (metrics.answerCount < SIGNAL_QUALITY_MIN_ANSWERS) {
    return { quality: 'ok', score: 100, reasons: [] };
  }

  const reasons: SignalQualityReason[] = [];
  let penalty = 0;

  // ── Signal 1: choice incoherence (content-random picking) ──
  // Full penalty requires BOTH high incoherence AND no self-consistent
  // trait direction (the AND rule — see the locked constants above).
  // Incoherence with a real direction is soft evidence only: that profile
  // is a noisy-but-genuine user, and flagging them would blow the ≤5%
  // false-flag budget. A null direction with computable incoherence means
  // no usable trait evidence at all — treated as weak (cannot prove the
  // session pointed anywhere).
  if (
    metrics.incoherence !== null &&
    metrics.incoherence >= SIGNAL_QUALITY_INCOHERENCE_FLAG
  ) {
    const directionWeak =
      metrics.meanAbsReferenceDirection === null ||
      metrics.meanAbsReferenceDirection <= SIGNAL_QUALITY_WEAK_DIRECTION_FLAG;
    if (directionWeak) {
      reasons.push('choice_incoherence');
      penalty += SIGNAL_QUALITY_PENALTY_INCOHERENCE;
    } else {
      penalty += SIGNAL_QUALITY_PENALTY_INCOHERENCE_SOFT;
    }
  }

  // ── Signal 2: neutral responding (min-|loading| hugging) ──
  // The consistencyPairs detector's `fired` flag already encodes the
  // minimum-eligible-answers floor; we re-check the share against our own
  // named constant so the two instruments can drift apart deliberately if
  // either threshold is ever re-locked.
  if (
    metrics.neutralDetectorFired &&
    metrics.neutralResponseShare >= SIGNAL_QUALITY_NEUTRAL_SHARE_FLAG
  ) {
    reasons.push('neutral_responding');
    penalty += SIGNAL_QUALITY_PENALTY_NEUTRAL_RESPONDING;
  }

  const score = Math.max(0, 100 - penalty);
  return {
    quality: score < SIGNAL_QUALITY_LOW_SCORE_THRESHOLD ? 'low' : 'ok',
    score,
    reasons,
  };
}
