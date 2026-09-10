/**
 * Derived Archetype Chemistry — Plan Item 10 (roadmap P2d)
 *
 * Mechanically derives pair chemistry from ACOEXP trait-vector geometry so the
 * chemistry layer stays consistent when prototype centroids change. The
 * hand-authored `compatibilityMatrix` (see `archetypeCompatibility.ts`) remains
 * the default mechanical authority; this module is reachable only behind the
 * `derivedChemistryEnabled` flag (default OFF), and the hand-authored layer is
 * re-scoped to narrative deltas (`ARCHETYPE_COMPATIBILITY_DESCRIPTIONS`
 * unchanged in tone).
 *
 * ── Formula ──────────────────────────────────────────────────────────────
 *
 *   similarity  S = mean_t∈{A,E,C}  ( 1 − |a_t − b_t| / 100 )
 *   complement  K = mean_t∈{X,P}    max(0, 1 − | |a_t − b_t| − D | / W )
 *   raw         R = 0.5·S + 0.5·K              ∈ [0, 1]
 *   score       = clamp( round(scale · (100·R) + offset), 0, 100 )
 *
 * Citations / rationale:
 *   - Similarity on warmth/stability/conscientiousness (A/E/C) follows the
 *     similarity-attraction meta-analysis: actual (not merely perceived)
 *     similarity predicts interpersonal attraction.
 *     Montoya, Horton & Kirchner (2008), J. Social & Personal Relationships,
 *     doi:10.1177/0265407508096700.
 *   - Complementarity on energy/positivity (X/P) follows the 同频 group-design
 *     ("similarity on warmth, complementarity on energy — one high-Positivity
 *     spark in a calm group"; scientific-foundation.md §Why similarity predicts
 *     connection) and team-composition evidence that a group needs an energy
 *     spark rather than clones (Bell 2007, doi:10.1037/0021-9010.92.3.595).
 *     A moderate gap is complementary; near-identical and opposite extremes are
 *     both sub-optimal, hence the triangular "bell" over the gap.
 *
 * Parameter anchors (documented priors — NOT fitted to the authored matrix):
 *   - D (target gap) = 15 = one standard deviation of the trait population used
 *     by the V4 recovery / Monte-Carlo harness (σ = 15 on the 0–100 scale).
 *   - W (half-width) = 30 = two standard deviations, so the complementary
 *     plateau spans a moderate gap while strongly divergent pairs fall to 0.
 *   - Weights 0.5 / 0.5 treat the two evidence bases (Montoya similarity vs.
 *     composition complementarity) as equal priors.
 *
 * ── Calibration ──────────────────────────────────────────────────────────
 *
 * The affine `scale`/`offset` are computed ONCE at module load so the derived
 * distribution is comparable to the authored matrix's distribution:
 *   target mean = 80.01, target sd = 7.27
 *   (authored 12×12 matrix incl. diagonal, measured 2026-09-10).
 * They are fit only to the first two moments of the authored distribution, so
 * Spearman ρ (rank) is unchanged by calibration; it exists solely so derived
 * scores are interchangeable on the same 0–100 scale. Because the constants are
 * re-derived from the current prototype registry on every load, prototype
 * updates automatically re-centre the derived distribution; a calibration-drift
 * test guards the stable values.
 *
 * ── Determinism ──────────────────────────────────────────────────────────
 *
 * `deriveChemistry` is a pure function of the two trait vectors plus the
 * module-level calibration constants (which are themselves a pure function of
 * the frozen prototype registry). No randomness, no I/O, O(1) per pair.
 */

import { TraitKey } from './types';
import { archetypeRegistry } from './archetypeRegistry';

/** Traits whose resemblance drives the similarity term (Montoya 2008). */
export const DERIVED_SIMILARITY_TRAITS: readonly TraitKey[] = ['A', 'E', 'C'] as const;

/** Traits whose moderate difference drives the complementarity term (同频 design). */
export const DERIVED_COMPLEMENTARITY_TRAITS: readonly TraitKey[] = ['X', 'P'] as const;

/** Similarity term weight (equal-prior blend). */
export const DERIVED_SIMILARITY_WEIGHT = 0.5;
/** Complementarity term weight (equal-prior blend). */
export const DERIVED_COMPLEMENTARITY_WEIGHT = 0.5;
/** Target energy/positivity gap ≈ 1 population SD (σ = 15 on the 0–100 scale). */
export const DERIVED_COMPLEMENTARITY_TARGET_GAP = 15;
/** Plateau half-width = 2 population SD; beyond D ± W complementarity is 0. */
export const DERIVED_COMPLEMENTARITY_HALF_WIDTH = 30;

/** Authored compatibilityMatrix distribution (12×12 incl. diagonal), 2026-09-10. */
export const DERIVED_CHEMISTRY_TARGET_MEAN = 80.01;
export const DERIVED_CHEMISTRY_TARGET_SD = 7.27;

export type TraitVector = Record<TraitKey, number>;

function mean(values: number[]): number {
  return values.length === 0 ? 0 : values.reduce((a, b) => a + b, 0) / values.length;
}

function clamp(x: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, x));
}

/**
 * Similarity in [0,1] for one trait: identical = 1, maximally different = 0
 * on the 0–100 trait scale.
 */
export function traitSimilarity(a: TraitVector, b: TraitVector, trait: TraitKey): number {
  return 1 - Math.abs((a[trait] ?? 50) - (b[trait] ?? 50)) / 100;
}

/**
 * Complementarity in [0,1] for one trait: 1 at the target gap D, falling to 0
 * at a 0 gap, at a 2D gap, and beyond D ± W. Symmetric in the trait values.
 */
export function traitComplementarity(a: TraitVector, b: TraitVector, trait: TraitKey): number {
  const gap = Math.abs((a[trait] ?? 50) - (b[trait] ?? 50));
  return Math.max(0, 1 - Math.abs(gap - DERIVED_COMPLEMENTARITY_TARGET_GAP) / DERIVED_COMPLEMENTARITY_HALF_WIDTH);
}

/**
 * Uncalibrated derived chemistry in [0,1] — the raw geometry, exposed so
 * validation reports and calibration tests can read the pre-affine signal.
 */
export function deriveChemistryRaw(protoA: TraitVector, protoB: TraitVector): number {
  const similarity = mean(DERIVED_SIMILARITY_TRAITS.map((t) => traitSimilarity(protoA, protoB, t)));
  const complementarity = mean(
    DERIVED_COMPLEMENTARITY_TRAITS.map((t) => traitComplementarity(protoA, protoB, t)),
  );
  return DERIVED_SIMILARITY_WEIGHT * similarity + DERIVED_COMPLEMENTARITY_WEIGHT * complementarity;
}

// ── Calibration ──────────────────────────────────────────────────────────
// Fit the affine map from the CURRENT raw derived distribution to the fixed
// authored target moments. Computed once at module load (pure, registry-derived).

function buildRawDistribution(): number[] {
  const ids = Object.keys(archetypeRegistry);
  const raw: number[] = [];
  for (const a of ids) {
    for (const b of ids) {
      raw.push(
        deriveChemistryRaw(
          archetypeRegistry[a as keyof typeof archetypeRegistry].profile.traitProfile,
          archetypeRegistry[b as keyof typeof archetypeRegistry].profile.traitProfile,
        ) * 100,
      );
    }
  }
  return raw;
}

const rawDistribution = buildRawDistribution();
const rawMean = mean(rawDistribution);
const rawSd = Math.sqrt(mean(rawDistribution.map((v) => (v - rawMean) ** 2)));

/** Affine scale (sd-normalising) and offset (mean-centering) to the authored scale. */
export const DERIVED_CHEMISTRY_CALIBRATION = {
  similarityWeight: DERIVED_SIMILARITY_WEIGHT,
  complementarityWeight: DERIVED_COMPLEMENTARITY_WEIGHT,
  complementarityTargetGap: DERIVED_COMPLEMENTARITY_TARGET_GAP,
  complementarityHalfWidth: DERIVED_COMPLEMENTARITY_HALF_WIDTH,
  targetMean: DERIVED_CHEMISTRY_TARGET_MEAN,
  targetSd: DERIVED_CHEMISTRY_TARGET_SD,
  rawMean: Math.round(rawMean * 1e6) / 1e6,
  rawSd: Math.round(rawSd * 1e6) / 1e6,
  scale: rawSd === 0 ? 1 : DERIVED_CHEMISTRY_TARGET_SD / rawSd,
  offset: rawSd === 0 ? DERIVED_CHEMISTRY_TARGET_MEAN - rawMean : DERIVED_CHEMISTRY_TARGET_MEAN - (DERIVED_CHEMISTRY_TARGET_SD / rawSd) * rawMean,
} as const;

/**
 * Calibrate a raw [0,1] derived value onto the authored matrix's 0–100 scale.
 * Exposed for tests; the affine map never changes Spearman rank correlation.
 */
export function calibrateDerivedChemistry(raw: number): number {
  const scaled = DERIVED_CHEMISTRY_CALIBRATION.scale * (raw * 100) + DERIVED_CHEMISTRY_CALIBRATION.offset;
  return clamp(Math.round(scaled), 0, 100);
}

/**
 * Derived pair chemistry — pure, deterministic, 0–100, same scale as
 * `compatibilityMatrix`. Uses the module-load calibration constants.
 */
export function deriveChemistry(protoA: TraitVector, protoB: TraitVector): number {
  return calibrateDerivedChemistry(deriveChemistryRaw(protoA, protoB));
}

// ── Precomputed 12×12 matrix ─────────────────────────────────────────────
// Symmetric by construction. Built from the frozen prototype registry.

export const DERIVED_CHEMISTRY_MATRIX: Record<string, Record<string, number>> = (() => {
  const matrix: Record<string, Record<string, number>> = {};
  const ids = Object.keys(archetypeRegistry);
  for (const a of ids) {
    matrix[a] = {};
    for (const b of ids) {
      matrix[a][b] = deriveChemistry(
        archetypeRegistry[a as keyof typeof archetypeRegistry].profile.traitProfile,
        archetypeRegistry[b as keyof typeof archetypeRegistry].profile.traitProfile,
      );
    }
  }
  return matrix;
})();

/** Derived score for a pair, 0–100; 50 fallback for unknown archetype ids. */
export function getDerivedArchetypeChemistry(primaryArchetype: string, targetArchetype: string): number {
  return DERIVED_CHEMISTRY_MATRIX[primaryArchetype]?.[targetArchetype] ?? 50;
}
