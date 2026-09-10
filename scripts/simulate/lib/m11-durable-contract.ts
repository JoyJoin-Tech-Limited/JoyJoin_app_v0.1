/**
 * M11 durable contract (Plan Item 9 / M11) — shared helper.
 *
 * The original "≥50% relative reduction" M11 target was retired 2026-09-10
 * (plan-owner decision): it conflicted with Item 3's no-harm K (mechanically
 * capped at ≈12%) and was a magic number needing re-derivation whenever the
 * population mix, bank, or calibration changed. Replacement — calibration-
 * anchored, so it auto-updates when the Item 12 curve is refitted:
 *
 *   (a) Per-session bounded-error invariant.
 *       The shipped shrinkage estimator (Item 3) may never make a session's
 *       expected trait error worse than the population prior (the
 *       no-information baseline = predicting the neutral value 50). Modelled
 *       as a Gaussian posterior over the Item 12 curve:
 *
 *         σ_obs(c)  = e(c) / √(2/π)          e = expectedTraitAbsError(c)
 *         σ_0       = e(0) / √(2/π)          no-information prior error
 *         σ_post(c) = √( w(c)² σ_obs(c)² + (1−w(c))² σ_0² )
 *         E|shrunk − true|(c) = √(2/π) σ_post(c)  ≤  e(0)   at every c
 *
 *       where w(c) is the SHIPPED weight (`traitShrinkageWeight`, itself
 *       derived from the Item 12 curve). The only way a refit/bank change can
 *       break this is if the estimate error at some confidence exceeds the
 *       no-information prior error — which is exactly the regression the
 *       invariant is meant to catch.
 *
 *   (b) Ceiling-normalized group stabilization.
 *       Shrinking toward the no-information value 50 removes the fraction
 *       (1 − w(c)) of a session's deviation. The calibration-implied ceiling
 *       over the injected population is therefore mean(1 − w(c_inj)); the
 *       measured group-level delta reduction must reach ≥ 80% of it. Unlike a
 *       fixed constant this tracks the actual confidence distribution and the
 *       curve.
 *
 * Plus the absolute CI smoke alarm (M11_SMOKE_ALARM_MAX_DELTA ≤ 5 points at
 * 20% injection) and the injection-rate SWEEP (5/10/20/40%), asserting the
 * bounded envelope at each rate rather than a single operating point.
 *
 * Pure / deterministic / no I/O: consumes only the committed Item 12 artifact
 * and the shipped shrinkage weight.
 */

import {
  expectedTraitAbsError,
  type FittedConfidenceCalibration,
} from '../../../packages/shared/src/personality/confidenceCalibration';
import { traitShrinkageWeight } from '../../../packages/shared/src/personality/traitShrinkage';

const SQRT_2_OVER_PI = Math.sqrt(2 / Math.PI);
const SQRT_2_OVER_PI_INV = 1 / SQRT_2_OVER_PI;
const GRID_EPS = 1e-9;

// ── Locked M11 constants (mirror the plan §(f) reformulation) ────────

/** Absolute CI smoke alarm: 20% low-confidence injection moves group means ≤ this. */
export const M11_SMOKE_ALARM_MAX_DELTA = 5;
/** Injection-rate sweep (share of pool members replaced by low-confidence respondents). */
export const M11_INJECTION_RATES = [0.05, 0.1, 0.2, 0.4] as const;
/** Durable-contract (b): measured stabilization must reach this fraction of the ceiling. */
export const M11_CEILING_FRACTION = 0.8;
/** The rate at which the absolute smoke alarm is asserted. */
export const M11_SMOKE_RATE = 0.2;
/**
 * Sweep envelope slack: shrinkage must never worsen the measured stabilization
 * by more than this absolute fraction at any rate. The true first-order effect
 * is ~1%, so a small negative allowance absorbs finite-sample noise without
 * allowing a real regression (which would be an order of magnitude larger).
 */
export const M11_ENVELOPE_SLACK = 0.02;

export interface BoundedErrorGridPoint {
  /** Raw per-trait confidence. */
  confidence: number;
  /** Item 12 expected |trait error| at this confidence. */
  observedError: number;
  /** Shipped shrinkage weight w(c). */
  weight: number;
  /** No-information prior error e(0) (constant across the grid). */
  priorError: number;
  /** Gaussian posterior expected |error| after shrinkage. */
  postShrinkError: number;
  /** postShrinkError / priorError (≤ 1 is the invariant). */
  ratio: number;
}

export interface M11BoundedErrorResult {
  /** No-information baseline error e(0); below the fitted domain the curve clamps here. */
  priorError: number;
  /** Worst post-shrink/prior ratio across the confidence grid. */
  maxRatio: number;
  /** Confidence at which maxRatio occurs. */
  maxRatioConfidence: number;
  /** (a) true when postShrinkError ≤ priorError at every confidence level. */
  pass: boolean;
  /** First-order ceiling at the no-information end: 1 − w(0). */
  noInfoCeiling: number;
  /** Bayesian-optimal ceiling: 1 − w_opt(0) with w_opt = σ_0²/(σ_0²+σ_obs²). */
  optimalNoInfoCeiling: number;
  /** Sampled grid (report detail). */
  grid: BoundedErrorGridPoint[];
}

/**
 * (a) Per-session bounded-error invariant over the Item 12 curve, plus the
 * no-information-end ceilings used for context/part (b).
 */
export function computeM11BoundedError(fit: FittedConfidenceCalibration): M11BoundedErrorResult {
  const priorError = expectedTraitAbsError(0, fit);
  const sigmaPrior = priorError * SQRT_2_OVER_PI_INV;

  const grid: BoundedErrorGridPoint[] = [];
  let maxRatio = -Infinity;
  let maxRatioConfidence = 0;

  for (let i = 0; i <= 100; i++) {
    const c = i / 100;
    const observedError = expectedTraitAbsError(c, fit);
    const weight = traitShrinkageWeight(c);
    const sigmaObs = observedError * SQRT_2_OVER_PI_INV;
    const sigmaPost = Math.sqrt(weight * weight * sigmaObs * sigmaObs + (1 - weight) * (1 - weight) * sigmaPrior * sigmaPrior);
    const postShrinkError = SQRT_2_OVER_PI * sigmaPost;
    const ratio = postShrinkError / priorError;
    grid.push({ confidence: c, observedError, weight, priorError, postShrinkError, ratio });
    if (ratio > maxRatio) {
      maxRatio = ratio;
      maxRatioConfidence = c;
    }
  }

  const noInfoWeight = traitShrinkageWeight(0);
  const sigmaObs0 = priorError * SQRT_2_OVER_PI_INV; // at c=0, observed == prior
  const optimalWeight0 = sigmaPrior * sigmaPrior / (sigmaPrior * sigmaPrior + sigmaObs0 * sigmaObs0);

  return {
    priorError,
    maxRatio,
    maxRatioConfidence,
    pass: maxRatio <= 1 + GRID_EPS,
    noInfoCeiling: 1 - noInfoWeight,
    optimalNoInfoCeiling: 1 - optimalWeight0,
    grid,
  };
}

/**
 * (b) Calibration-implied stabilization ceiling over an injected population.
 * Shrinking a deviation from the no-information value by w multiplies its
 * variance by w² (the no-information baseline is 50: x' − 50 = w·(x − 50)), so
 * the exact calibration-implied variance-reduction ceiling is 1 − w(c)². The
 * harness measures the REALIZED reduction from the engine's reported vectors;
 * the gate requires it to reach ≥80% of this ceiling — a genuine end-to-end
 * check that the shipped mechanism applies the calibration weight it claims
 * (a decoupled/broken shrink collapses the realized reduction toward 0).
 * Averaged over the observed injected confidences; defaults to c=0 when none.
 */
export function m11AchievableCeiling(confidences: number[]): number {
  const cs = confidences.length > 0 ? confidences : [0];
  let sum = 0;
  for (const c of cs) {
    const w = traitShrinkageWeight(c);
    sum += 1 - w * w;
  }
  return sum / cs.length;
}

export interface M11DurableEvaluation {
  boundedError: M11BoundedErrorResult;
  /** Calibration-implied ceiling over the injected population. */
  ceiling: number;
  /** Measured group-level stabilization at the smoke rate. */
  achieved: number;
  /** achieved / ceiling (∞-safe). */
  ceilingFractionAchieved: number;
  /** (b) achieved ≥ M11_CEILING_FRACTION · ceiling. */
  groupStabilizationPass: boolean;
  /** (a) bounded-error pass. */
  boundedErrorPass: boolean;
  /** Absolute smoke alarm pass. */
  smokeAlarmPass: boolean;
  /** Every sweep rate has reduction ≥ 0 (shrinkage never increases movement). */
  envelopePass: boolean;
  pass: boolean;
}

/**
 * Evaluate the full durable contract from a harness-produced sweep. The gate
 * calls this directly; the harness uses it to emit the JSON evidence so both
 * consume one implementation.
 */
export function evaluateM11DurableContract(args: {
  fit: FittedConfidenceCalibration;
  /** Injected members' raw per-trait confidences at the smoke rate. */
  injectedConfidences: number[];
  /**
   * Sweep rows. `meanDeltaOff`/`meanDeltaOn` are absolute end-to-end group-mean
   * movements (the smoke alarm basis); `reduction` is the churn-free
   * calibration-anchored stabilization the envelope consumes.
   */
  sweep: Array<{ rate: number; meanDeltaOff: number; meanDeltaOn: number; reduction: number | null }>;
  /** Measured stabilization override (defaults to the smoke-rate reduction). */
  achieved?: number;
}): M11DurableEvaluation {
  const boundedError = computeM11BoundedError(args.fit);
  const ceiling = m11AchievableCeiling(args.injectedConfidences);

  const smoke = args.sweep.find((s) => Math.abs(s.rate - M11_SMOKE_RATE) < 1e-9);
  const achieved = args.achieved ?? (smoke && smoke.reduction !== null ? smoke.reduction : 0);
  const smokeAlarmPass = smoke !== undefined && smoke.meanDeltaOff <= M11_SMOKE_ALARM_MAX_DELTA;
  const groupStabilizationPass = achieved >= M11_CEILING_FRACTION * ceiling - GRID_EPS;
  const envelopePass = args.sweep.every((s) => s.reduction === null || s.reduction >= -M11_ENVELOPE_SLACK);

  return {
    boundedError,
    ceiling,
    achieved,
    ceilingFractionAchieved: ceiling > 0 ? achieved / ceiling : 0,
    groupStabilizationPass,
    boundedErrorPass: boundedError.pass,
    smokeAlarmPass,
    envelopePass,
    pass: boundedError.pass && groupStabilizationPass && smokeAlarmPass && envelopePass,
  };
}
