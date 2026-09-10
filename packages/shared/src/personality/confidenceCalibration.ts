/**
 * Confidence Calibration (V4 Personality Engine — Plan Item 12)
 *
 * Maps ENGINE confidence → OBSERVED accuracy, fitted offline on the
 * latent-trait recovery harness (`scripts/simulate/run-recovery-harness.ts`
 * `--export-sessions` output) at fixed seed 20260909.
 *
 * Why this exists: the engine's mean trait confidence sits around 0.91 while
 * observed archetype top-1 agreement is only ~45-49% — the raw signal is
 * inflated. Item 3 (confidence-weighted shrinkage) must consume a CALIBRATED
 * probability, not the raw engine number.
 *
 * Boundaries:
 * - Pure and deterministic: no I/O, no randomness, no mutable module state,
 *   no imports beyond types. Safe for any consumer (server, scripts, clients).
 * - NOT wired into the engine. The fitted artifact is consumed by the harness
 *   reporting path and (later) by Item 3's Tier 3 shrinkage work.
 * - The fitted table lives in `confidenceCalibrationArtifact.ts` (generated).
 *   Regenerate deterministically via `npm run simulate:calibration`.
 */

import type { FittedConfidenceCalibration, CalibrationCurveNode } from './confidenceCalibrationArtifact';

// ── Row contract (mirrors the harness --export-sessions JSONL shape) ──

export interface CalibrationRow {
  sessionId: string;
  respondentId: string;
  noise: string;
  /** 'natural' = production termination; 'forced' = fixed checkpoint stop. */
  arm: 'natural' | 'forced';
  /** Forced checkpoint (8/12/16) or null for natural sessions. */
  checkpoint: number | null;
  questionsAnswered: number;
  /** Mean of traitConfidences[].confidence across the 6 ACOEXP traits (0..1). */
  meanTraitConfidence: number;
  traitConfidences: Record<string, number>;
  /** |estimated trait score − true trait score| per trait (0..100 scale). */
  traitAbsErrors: Record<string, number>;
  estimatedTop1: string;
  trueArchetype: string;
  /** 1 if estimatedTop1 === trueArchetype else 0. */
  correct: 0 | 1;
}

// ── Fitting ──────────────────────────────────────────────────────────

export interface FitOptions {
  version: string;
  seed: number;
  /** Noise arms included in the fit set (for artifact metadata). */
  noiseArms: string[];
  /** Decimal places for all fitted numbers (default 6) — keeps artifacts byte-stable. */
  precision?: number;
}

interface PavaBlock {
  xValues: number[];
  weight: number;
  sum: number;
}

function roundTo(x: number, precision: number): number {
  const f = Math.pow(10, precision);
  return Math.round(x * f) / f;
}

/**
 * Pool Adjacent Violators Algorithm — weighted isotonic regression,
 * non-decreasing in x. Deterministic given the input order; input is sorted
 * by (x, originalIndex) so ties never affect the result.
 */
function pava(points: Array<{ x: number; y: number }>): Array<{ xMin: number; xMax: number; p: number; n: number; xMean: number }> {
  const sorted = [...points].sort((a, b) => a.x - b.x);
  const blocks: PavaBlock[] = sorted.map((p) => ({ xValues: [p.x], weight: 1, sum: p.y }));

  let i = 0;
  while (i < blocks.length - 1) {
    const left = blocks[i];
    const right = blocks[i + 1];
    const leftMean = left.sum / left.weight;
    const rightMean = right.sum / right.weight;
    if (leftMean > rightMean + 1e-12) {
      // Violation: pool the adjacent blocks.
      blocks.splice(i, 2, {
        xValues: [...left.xValues, ...right.xValues],
        weight: left.weight + right.weight,
        sum: left.sum + right.sum,
      });
      i = Math.max(0, i - 1);
    } else {
      i++;
    }
  }

  return blocks.map((b) => {
    const xs = b.xValues;
    return {
      xMin: xs[0],
      xMax: xs[xs.length - 1],
      xMean: xs.reduce((a, v) => a + v, 0) / xs.length,
      p: b.sum / b.weight,
      n: xs.length,
    };
  });
}

function blocksToCurve(
  blocks: Array<{ xMean: number; p: number }>,
  precision: number
): CalibrationCurveNode[] {
  return blocks.map((b) => ({ x: roundTo(b.xMean, precision), p: roundTo(b.p, precision) }));
}

/**
 * Fit the calibration on harness session rows.
 *
 * The caller is responsible for passing the intended fit set — the canonical
 * pipeline fits on natural-termination sessions (production termination
 * behavior), pooled across the default noise arms (clean + moderate) as a
 * stand-in for unknown real-world answer noise. See the dated report under
 * docs/reports/ for the full fit provenance.
 */
export function fitCalibration(rows: CalibrationRow[], opts: FitOptions): FittedConfidenceCalibration {
  if (rows.length === 0) throw new Error('fitCalibration requires at least one row');
  const precision = opts.precision ?? 6;

  // Top-1 correctness curve: raw mean trait confidence → P(top-1 correct).
  const correctBlocks = pava(rows.map((r) => ({ x: r.meanTraitConfidence, y: r.correct })));

  // Per-trait error curve: raw per-trait confidence → expected |trait error|.
  // Isotonic DECREASING (higher confidence → lower error): fit increasing on
  // the negated error, then negate the fitted values back.
  const traitPoints: Array<{ x: number; y: number }> = [];
  for (const r of rows) {
    for (const trait of Object.keys(r.traitConfidences)) {
      const err = r.traitAbsErrors[trait];
      if (err === undefined) continue;
      traitPoints.push({ x: r.traitConfidences[trait], y: -err });
    }
  }
  const errorBlocks = pava(traitPoints).map((b) => ({ ...b, p: -b.p }));

  return {
    version: opts.version,
    fittedOnSeed: opts.seed,
    fitArm: 'natural',
    noiseArms: [...opts.noiseArms].sort(),
    sessionCount: rows.length,
    correctnessBlocks: correctBlocks.map((b) => ({
      xMin: roundTo(b.xMin, precision),
      xMax: roundTo(b.xMax, precision),
      p: roundTo(b.p, precision),
      n: b.n,
    })),
    correctnessCurve: blocksToCurve(correctBlocks, precision),
    traitErrorCurve: blocksToCurve(errorBlocks, precision),
  };
}

// ── Evaluation ───────────────────────────────────────────────────────

function evalCurve(curve: CalibrationCurveNode[], rawConfidence: number): number {
  if (curve.length === 0) return rawConfidence;
  const x = Math.max(0, Math.min(1, rawConfidence));
  if (x <= curve[0].x) return curve[0].p;
  const last = curve[curve.length - 1];
  if (x >= last.x) return last.p;
  for (let i = 0; i < curve.length - 1; i++) {
    const a = curve[i];
    const b = curve[i + 1];
    if (x >= a.x && x <= b.x) {
      if (b.x === a.x) return b.p;
      const t = (x - a.x) / (b.x - a.x);
      return a.p + t * (b.p - a.p);
    }
  }
  return last.p;
}

/**
 * Calibrated P(top-1 archetype correct) for a raw engine mean trait
 * confidence. Monotone piecewise-linear over the fitted isotonic blocks.
 * Below the fitted range the curve clamps to the lowest block's probability
 * (conservative: low-confidence sessions receive near-zero trust, which for
 * Item 3 shrinkage means maximal pull toward the population mean).
 */
export function calibrateConfidence(rawConfidence: number, fit: FittedConfidenceCalibration): number {
  return evalCurve(fit.correctnessCurve, rawConfidence);
}

/**
 * Expected per-trait |estimated − true| error (0–100 trait scale) for a raw
 * per-trait engine confidence. Feeds Item 3's per-trait shrinkage weighting.
 */
export function expectedTraitAbsError(rawTraitConfidence: number, fit: FittedConfidenceCalibration): number {
  return evalCurve(fit.traitErrorCurve, rawTraitConfidence);
}

// ── M15 reliability verification ─────────────────────────────────────

export interface CalibrationBin {
  index: number;
  lo: number;
  hi: number;
  n: number;
  meanCalibrated: number;
  observedAgreement: number;
  absGap: number;
  status: 'pass' | 'fail' | 'insufficient';
}

export interface CalibrationVerification {
  bins: CalibrationBin[];
  /** M15: every bin with n ≥ minPerBin has |observed − mean calibrated| ≤ tolerance. */
  pass: boolean;
  tolerance: number;
  minPerBin: number;
  evaluatedBins: number;
  failedBins: number;
  /** Expected calibration error over all rows (context metric, not gated). */
  ece: number;
}

export interface VerifyOptions {
  /** Number of equal-width bins over calibrated confidence in [0,1]. Default 10. */
  binCount?: number;
  /** M15 per-bin minimum sample count. Default 50. */
  minPerBin?: number;
  /** M15 per-bin tolerance. Default 0.10. */
  tolerance?: number;
}

/**
 * M15 post-calibration reliability check (LOCKED): bin rows by CALIBRATED
 * confidence; in every bin with n ≥ minPerBin, the observed top-1 agreement
 * must be within ±tolerance of the mean calibrated confidence.
 */
export function verifyCalibration(
  rows: CalibrationRow[],
  fit: FittedConfidenceCalibration,
  opts: VerifyOptions = {}
): CalibrationVerification {
  const binCount = opts.binCount ?? 10;
  const minPerBin = opts.minPerBin ?? 50;
  const tolerance = opts.tolerance ?? 0.1;

  const acc = Array.from({ length: binCount }, () => ({ n: 0, calSum: 0, hitSum: 0 }));
  let eceSum = 0;

  for (const r of rows) {
    const calibrated = calibrateConfidence(r.meanTraitConfidence, fit);
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor(calibrated * binCount)));
    acc[idx].n++;
    acc[idx].calSum += calibrated;
    acc[idx].hitSum += r.correct;
    eceSum += Math.abs(r.correct - calibrated);
  }

  const bins: CalibrationBin[] = acc.map((b, i) => {
    const meanCalibrated = b.n > 0 ? b.calSum / b.n : 0;
    const observedAgreement = b.n > 0 ? b.hitSum / b.n : 0;
    const absGap = Math.abs(observedAgreement - meanCalibrated);
    const status: CalibrationBin['status'] =
      b.n < minPerBin ? 'insufficient' : absGap <= tolerance + 1e-12 ? 'pass' : 'fail';
    return {
      index: i,
      lo: i / binCount,
      hi: (i + 1) / binCount,
      n: b.n,
      meanCalibrated,
      observedAgreement,
      absGap,
      status,
    };
  });

  const evaluated = bins.filter((b) => b.status !== 'insufficient');
  const failed = evaluated.filter((b) => b.status === 'fail');

  return {
    bins,
    pass: failed.length === 0,
    tolerance,
    minPerBin,
    evaluatedBins: evaluated.length,
    failedBins: failed.length,
    ece: rows.length > 0 ? eceSum / rows.length : 0,
  };
}

// ── Fitted artifact (generated) ──────────────────────────────────────

export { CALIBRATION_VERSION, CALIBRATION_SEED } from './confidenceCalibrationArtifact';
export type { FittedConfidenceCalibration, CalibrationCurveNode } from './confidenceCalibrationArtifact';
import { FITTED_CONFIDENCE_CALIBRATION } from './confidenceCalibrationArtifact';
export { FITTED_CONFIDENCE_CALIBRATION } from './confidenceCalibrationArtifact';

/** Calibrated P(correct) against the currently shipped fitted artifact. */
export function calibrateConfidenceCurrent(rawConfidence: number): number {
  return calibrateConfidence(rawConfidence, FITTED_CONFIDENCE_CALIBRATION);
}
