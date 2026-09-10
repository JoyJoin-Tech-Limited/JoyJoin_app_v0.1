/**
 * Confidence-Weighted Trait Shrinkage (V4 Personality Engine — Plan Item 3)
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.item3-trait-shrinkage.md`.
 * All mechanics are gated behind `AssessmentConfig.enableTraitShrinkage`
 * (default OFF); with the flag off the engine is byte-identical to the
 * pre-flag behavior.
 *
 * ── Mechanic ─────────────────────────────────────────────────────────
 * At the MATCH boundary only, each estimated trait is shrunk toward the
 * neutral population midpoint in proportion to its calibrated unreliability:
 *
 *   reported = w · estimated + (1 − w) · SHRINKAGE_NEUTRAL_TRAIT_VALUE
 *
 * with the weight derived from Item 12's fitted calibration — NEVER from an
 * ad-hoc confidence heuristic:
 *
 *   err(conf)  = expectedTraitAbsError(conf, FITTED_CONFIDENCE_CALIBRATION)
 *   w(conf)    = clamp(1 − max(0, err(conf) − SHRINKAGE_ERROR_FLOOR)
 *                        / SHRINKAGE_EXCESS_SCALE,
 *                      SHRINKAGE_MIN_WEIGHT, 1)
 *
 * ── Why excess-over-floor (the design tension, resolved) ─────────────
 * The fitted trait-error curve (confidenceCalibrationArtifact.ts,
 * v1-20260909) spans raw confidence 0.578 → 1.0 with expected |error|
 * 17.57 → 8.49 on the 0–100 trait scale. Two properties drive the shape:
 *
 *  1. The curve has an IRREDUCIBLE FLOOR: even conf = 1.0 carries ≈ 8.5
 *     points of expected abs error (option quantization, bank coverage —
 *     not respondent noise). Shrinking for the floor component would pull
 *     well-measured honest users toward 50 for error the shrinkage cannot
 *     attribute to them — the AC-3.3 harm ("clean-arm r must not regress").
 *     So only the EXCESS error above the floor justifies shrinkage.
 *
 *  2. The curve is FLAT (≈ 11.1) across conf 0.85–0.97 — exactly where both
 *     clean personas (~0.92 mean) and the consistent-but-biased adversarial
 *     arms (midpoint-hugger 0.925, acquiescence-biased 0.949) sit. This is
 *     the empirical form of the locked AC-7.4 ceiling: per-trait confidence
 *     does NOT separate consistent-but-biased evidence from clean evidence,
 *     so NO monotone w(err(conf)) can shrink those arms without shrinking
 *     honest users identically. Item 3 does not pretend otherwise: the
 *     shrinkage bite lands on the low-confidence tail (conf < 0.65, where
 *     the calibrated error rises steeply to 17.57 — random-clicker /
 *     incomplete-evidence traits), and the adversarial-suite AC-3.2 table
 *     reports the honest, modest shift on the biased arms.
 *
 * K is set by the no-harm constraint, not by the harm side: measured on the
 * 12 centroid personas (2026-09-10 probe, natural termination, clean arm),
 * the worst (|estimated − 50| × (1 − w)) product is driven by high-deviation
 * moderate-confidence traits (e.g. spider X: dev 33 @ conf 0.808 → excess
 * 3.55). K = 75 yields a worst-case centroid delta of ≈ 1.56 points — under
 * the AC-3.3 bound of 2 with ~22% margin (K = 60 would leave < 3%).
 *
 * ── Composition order (locked, documented in adaptiveEngine.ts) ──────
 *   1. trait scores & confidences updated from the answer (raw state —
 *      question selection and termination read THIS, never the shrunken
 *      form);
 *  2. Item 2 consistency fold adjusts traitConfidences[].confidence
 *     (flag-gated) — shrinkage therefore consumes the FOLDED confidence;
 *  3. Item 3: shrink traits → findBestMatchingArchetypesV2 sees the
 *     shrunken vector (this module);
 *  4. Item 2 composition: currentMatches.confidence ×= validityScore
 *     (lastRawMatches preserves the pre-composition matcher output);
 *  5. Item 4: meta-consistency ×= multiplier (flag-gated).
 *
 * ── Boundaries ───────────────────────────────────────────────────────
 * Pure and deterministic: no I/O, no randomness, no mutable module state.
 * Output is always clamped to the 0–100 trait scale. Below the fitted
 * calibration domain (conf < 0.578) expectedTraitAbsError clamps to the
 * worst fitted block (17.57) — the documented conservative clamp semantics
 * of the calibration module ("low-confidence sessions receive near-zero
 * trust … maximal pull toward the population mean"), so w bottoms out at
 * 1 − 9.08/75 ≈ 0.879 with the current artifact; SHRINKAGE_MIN_WEIGHT is a
 * hard safety floor for future recalibration, inert today.
 */

import { TraitKey } from './types';
import {
  expectedTraitAbsError,
  FITTED_CONFIDENCE_CALIBRATION,
} from './confidenceCalibration';

/** Neutral population midpoint of the 0–100 ACOEXP trait scale. */
export const SHRINKAGE_NEUTRAL_TRAIT_VALUE = 50;

/**
 * Irreducible expected |trait error| at maximal measured confidence,
 * computed from the shipped fitted artifact (v1-20260909: 8.492476).
 * Derived — not copied — so regenerating the artifact re-anchors the curve.
 */
export const SHRINKAGE_ERROR_FLOOR = expectedTraitAbsError(1, FITTED_CONFIDENCE_CALIBRATION);

/**
 * Excess-error scale K (trait points of excess calibrated error that cost
 * the full weight). Chosen 2026-09-10 from the centroid-persona probe:
 * worst-case AC-3.3 shrink delta ≈ 1.56 points (< 2 with ~22% margin); at
 * the fitted floor (conf 0.578) w = 1 − 9.08/75 ≈ 0.879.
 */
export const SHRINKAGE_EXCESS_SCALE = 75;

/**
 * Hard lower bound on w. Inert with the current fitted artifact (the
 * clamped below-domain weight ≈ 0.879 sits far above it); guards future
 * recalibration from ever collapsing a reported trait to the midpoint.
 */
export const SHRINKAGE_MIN_WEIGHT = 0.5;

/**
 * Shrinkage weight for one raw per-trait engine confidence. Monotone
 * non-decreasing in confidence (the calibrated error curve is isotonic
 * decreasing), w(1) = 1, w ≥ SHRINKAGE_MIN_WEIGHT.
 */
export function traitShrinkageWeight(rawTraitConfidence: number): number {
  const expectedError = expectedTraitAbsError(rawTraitConfidence, FITTED_CONFIDENCE_CALIBRATION);
  const excessError = Math.max(0, expectedError - SHRINKAGE_ERROR_FLOOR);
  const w = 1 - excessError / SHRINKAGE_EXCESS_SCALE;
  return Math.max(SHRINKAGE_MIN_WEIGHT, Math.min(1, w));
}

/**
 * Apply confidence-weighted shrinkage to a full trait vector.
 * `confidences` are the RAW per-trait engine confidences (post Item-2 fold
 * when that flag is on — the caller passes the current engine state).
 * Never expands a deviation: |reported − 50| ≤ |estimated − 50|; a trait
 * sitting exactly at the neutral midpoint is a fixed point.
 */
export function shrinkTraitsTowardNeutral(
  traits: Record<TraitKey, number>,
  confidences: Record<TraitKey, number>
): Record<TraitKey, number> {
  const reported = {} as Record<TraitKey, number>;
  for (const trait of Object.keys(traits) as TraitKey[]) {
    const w = traitShrinkageWeight(confidences[trait]);
    const shrunk = w * traits[trait] + (1 - w) * SHRINKAGE_NEUTRAL_TRAIT_VALUE;
    reported[trait] = Math.max(0, Math.min(100, shrunk));
  }
  return reported;
}
