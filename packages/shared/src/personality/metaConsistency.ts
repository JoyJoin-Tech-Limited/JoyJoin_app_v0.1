/**
 * Plan Item 4 (2026-09-09) — End-of-test meta-consistency check.
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.item4-meta-consistency.md`.
 * All mechanics are gated behind `AssessmentConfig.enableMetaConsistency`
 * (default OFF); with the flag off the engine is byte-identical to the
 * pre-flag behavior.
 *
 * ── Mechanic ─────────────────────────────────────────────────────────
 * One meta item (Q168, a slider in questionsV4Attractor) is served as the
 * LAST closing-phase question — after the consistency-pair seconds (Item 2)
 * and the universal closing questions — so the engine's trait estimate is
 * maximally final when the comparison happens. The item asks for a DIRECT
 * self-report on a target trait ("self-view"); the engine compares it
 * against its own estimate of that trait:
 *
 *   discrepancy = |selfReport − estimate| ≥ META_CONSISTENCY_DISCREPANCY_THRESHOLD
 *     ⇒ currentMatches.confidence ×= META_CONSISTENCY_MULTIPLIER
 *
 * The multiplier composes multiplicatively with Item 2's composition step
 * (conf = raw × validityScore × metaMultiplier) and hits match/session
 * CONFIDENCE only — trait scores are never touched (AC-4.2).
 *
 * ── No-contamination invariant ─────────────────────────────────────────
 * The meta item's options carry ZERO trait loadings, so processAnswer's
 * scoring loop structurally cannot fold the self-report into the estimate
 * it is compared against. A self-report that fed trait estimation would
 * pull the estimate toward itself and mask exactly the discrepancy this
 * mechanic exists to detect.
 *
 * ── Target-trait decision (AC-4.3 coordination) ─────────────────────
 * The Item 7 `self-image-inflated` persona inflates A/P/C/E (+15, clamped
 * 95) via `inflateTraitProfile`; O/X pass through. The meta item's target
 * trait MUST intersect that inflation set or M7 is unmeasurable (the M4
 * instrument-first lesson), which rules out the plan's original
 * Extraversion target. Among {A, P, C, E}, trait A (Affinity) was chosen
 * from the 2026-09-09 measurement probe (N=240/arm, seed 20260909, flag-off
 * engine, post-Item-11 bank): A showed the best recall/precision separation
 * of the four candidates (inflated recall 7.5% vs clean false-flag 4.6% at
 * threshold 30 — the only candidate with positive separation) and is the
 * best-tracked inflated trait (clean-arm r=0.809 @16q, Item 6 baseline),
 * so a flag on A is maximally meaningful when it fires. Option (a) of the
 * coordination note: target a trait the persona already inflates; no
 * persona-side extension was needed.
 *
 * ── M7 ceiling (documented honestly, not a tuning failure) ──────────
 * M7 locks ≥80% recall on the inflated persona at ≤10% false-flag on clean.
 * Cycle 1 (2026-09-09): uniform-inflation recall 7.5% — the persona answers
 * EVERY item (adaptive + meta) through the same inflated profile, so the
 * engine estimate tracks the inflation and self-report ≈ estimate.
 * Cycle 2 (2026-09-10, verifier amendment 1 — DEFINITIVE): a
 * DIFFERENTIAL-inflation persona (scenario answers +15, direct self-view
 * +30 on the target trait — the psychometrically realistic self-enhancement
 * model) flags at 2.5%, BELOW the clean false-flag tail (4.6%). The
 * estimate on A absorbs the +15 scenario inflation with a small positive
 * bias (est ≈ true + 20), so even a +30 self-view lands within ~10 of the
 * estimate after bucket quantization. The discrepancy distributions overlap
 * almost perfectly (differential p99 31.6 < clean p99 34.2), so NO
 * threshold separates inflation from honest error — self-inflation
 * detection from internal evidence is out of reach, period. The meta check
 * still earns its place on the discrepancy construct it CAN see: direct
 * self-views that outrun scenario-level evidence (straight-liner 100%,
 * random-clicker 42.9% flag rates). Disposition: ships dark as a
 * precision-safe / low-recall signal; downstream items (Item 3 shrinkage)
 * must NOT count on self-inflation detection from internal evidence.
 * Full evidence: docs/reports/2026-09-10-adversarial-persona-suite-meta-on.md.
 */

import { AdaptiveQuestion, TraitKey } from './types';

// ── Named constants (with rationale) ─────────────────────────────────

/** The meta-consistency item (slider in questionsV4Attractor, after Q167). */
export const META_CONSISTENCY_QUESTION_ID = 'Q168';

/**
 * Target trait for the self-report comparison. A (Affinity) — see the
 * target-trait decision note above. In the Item 7 inflation set (AC-4.3
 * overlap), best probe separation, best-tracked inflated trait.
 */
export const META_CONSISTENCY_TARGET_TRAIT: TraitKey = 'A';

/**
 * Discrepancy threshold on the 0–100 trait scale (contract AC-4.2:
 * "|self-report − estimate| ≥ 30"). ≈ 2× the clean-arm per-trait MAE
 * (9.9–11.9, Item 6 baseline @16q) — far enough into the error tail that
 * honest respondents rarely cross it (probe: clean false-flag 4.6% on A).
 */
export const META_CONSISTENCY_DISCREPANCY_THRESHOLD = 30;

/**
 * Session-confidence multiplier applied to match confidence when the flag
 * fires (contract AC-4.2: "bounded ≤ ×0.8"). A single fixed multiplier at
 * the contracted bound — applied at most once per session (one meta item),
 * so the mechanic can remove at most 20% of confidence and can never zero
 * it out.
 */
export const META_CONSISTENCY_MULTIPLIER = 0.8;

/**
 * Option value → self-reported trait level (0–100 scale). Centered buckets
 * (10/30/50/70/90): the endpoint labels read as "几乎不会…" / "几乎总是…"
 * (near-extremes), not absolute 0/100 claims. Declared explicitly (not
 * inferred from the slider position encoding) so the mapping is auditable
 * and immune to bank edits silently changing the mechanic — same rationale
 * as CONSISTENCY_PAIRS.levelByOptionValue (Item 2).
 */
export const META_SELF_REPORT_BY_OPTION: Readonly<Record<string, number>> = {
  slider_0: 10,
  slider_25: 30,
  slider_50: 50,
  slider_75: 70,
  slider_100: 90,
};

export function isMetaConsistencyQuestionId(id: string): boolean {
  return id === META_CONSISTENCY_QUESTION_ID;
}

/** Self-reported trait level for a meta-item answer; null for unknown options. */
export function getMetaConsistencySelfReport(selectedOption: string): number | null {
  return META_SELF_REPORT_BY_OPTION[selectedOption] ?? null;
}

export interface MetaConsistencyEvaluation {
  questionId: string;
  targetTrait: TraitKey;
  /** Direct self-report mapped to the 0–100 trait scale. */
  selfReport: number;
  /** Engine estimate of the target trait at answer time (pre-multiplier). */
  estimate: number;
  /** |selfReport − estimate|. */
  discrepancy: number;
  /** True when discrepancy ≥ META_CONSISTENCY_DISCREPANCY_THRESHOLD. */
  flagged: boolean;
  /** Confidence multiplier to compose: META_CONSISTENCY_MULTIPLIER when flagged, else 1. */
  multiplier: number;
}

/**
 * Evaluate one meta-item answer against the engine's current estimate of the
 * target trait. Pure; the caller (adaptiveEngine.processAnswer) applies the
 * multiplier to currentMatches when flagged.
 */
export function evaluateMetaConsistency(
  question: AdaptiveQuestion,
  selectedOption: string,
  estimate: number
): MetaConsistencyEvaluation | null {
  if (!isMetaConsistencyQuestionId(question.id)) return null;
  const selfReport = getMetaConsistencySelfReport(selectedOption);
  if (selfReport === null) return null;
  const discrepancy = Math.abs(selfReport - estimate);
  const flagged = discrepancy >= META_CONSISTENCY_DISCREPANCY_THRESHOLD;
  return {
    questionId: question.id,
    targetTrait: META_CONSISTENCY_TARGET_TRAIT,
    selfReport,
    estimate,
    discrepancy,
    flagged,
    multiplier: flagged ? META_CONSISTENCY_MULTIPLIER : 1,
  };
}
