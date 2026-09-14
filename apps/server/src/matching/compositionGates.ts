/**
 * Item-5 literature-prior composition gates + W6-F X-variance dispersion nudge.
 *
 * Extracted verbatim from `poolMatchingService.ts` as a behavior-preserving
 * modularization; the public API is re-exported from `poolMatchingService.ts`.
 */
import {
  MAGNETISM_ENERGIZER_THRESHOLD,
  userArchetypeEnergy,
} from "./energyComposition";
import type {
  CompositionTraitVector,
  UserWithProfile,
} from "../poolMatchingService";

// ── W6-F (gm-debrief follow-up): trait-X-variance dispersion nudge ──────────
// AC-W6.4's overlap coefficient intentionally re-weighted the trait-independent
// `interest` dimension (28%), diluting the archetype-chemistry signal that used
// to cluster members on trait X. Gate-off group formation therefore became more
// X-dispersed (Item 9 X-var violation 45.9% → 50.9%). This bounded, argmax-only
// nudge restores mild X-cohesion during expansion — the same ranking-nudge
// pattern as R4 `adjustScoreForNoveltyDispersion` / the item-5 gate steering.
// Cached pair scores and the `avgScore ≥ 60` admission threshold are never
// touched; the nudge only reorders candidate admissions.
/** Dispersion target (population variance of reported X). Mirrors the Item 9 provisional measurement cap (std 20). */
export const XVAR_DISPERSION_TARGET = 400;
/** Score points adjusted per 100 variance units above/below target. */
export const XVAR_DISPERSION_PENALTY_PER_100 = 0.9;
/** Hard cap on the dispersion penalty (bounded nudge, never a ban). */
export const XVAR_DISPERSION_MAX_PENALTY = 3;
/** Hard cap on the bonus for pulling an already over-target group back down. */
export const XVAR_DISPERSION_MAX_BONUS = 1.2;

/** Population variance of a numeric vector (deterministic; empty → 0). */
export function traitXVariance(values: number[]): number {
  if (values.length === 0) return 0;
  const mean = values.reduce((s, v) => s + v, 0) / values.length;
  return values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length;
}

/**
 * W6-F: bounded argmax-only X-variance dispersion nudge. Penalises an admission
 * that would push the forming group's reported-X variance above
 * `XVAR_DISPERSION_TARGET`, and rewards one that pulls an already over-target
 * group back down. Inert (returns `rankingScore` unchanged) unless every
 * involved member carries a complete reported vector — the composition-gate
 * cold-start policy. [DUO] the partner's X counts toward the unit's effect; the
 * unit is never split.
 */
export function adjustScoreForXVarianceDispersion(
  candidate: UserWithProfile,
  candidatePartner: UserWithProfile | null,
  groupMembers: UserWithProfile[],
  rankingScore: number,
): number {
  if (groupMembers.length === 0) return rankingScore;
  const unit = candidatePartner ? [candidate, candidatePartner] : [candidate];
  if (!groupMembers.every(hasCompleteTraitVector) || !unit.every(hasCompleteTraitVector)) {
    return rankingScore;
  }

  const beforeValues = groupMembers.map((m) => m.traitScores!.X as number);
  const afterValues = [...beforeValues, ...unit.map((m) => m.traitScores!.X as number)];
  const beforeVar = traitXVariance(beforeValues);
  const afterVar = traitXVariance(afterValues);

  let adjustment = 0;
  if (afterVar > XVAR_DISPERSION_TARGET) {
    adjustment -= Math.min(
      XVAR_DISPERSION_MAX_PENALTY,
      ((afterVar - XVAR_DISPERSION_TARGET) / 100) * XVAR_DISPERSION_PENALTY_PER_100,
    );
  }
  if (beforeVar > XVAR_DISPERSION_TARGET && afterVar < beforeVar) {
    adjustment += Math.min(
      XVAR_DISPERSION_MAX_BONUS,
      ((beforeVar - afterVar) / 100) * XVAR_DISPERSION_PENALTY_PER_100,
    );
  }
  return rankingScore + adjustment;
}

// ── Item 5 (V4 engine upgrade): literature-prior composition gates ────────
// Four group-composition gates behind the compositionGatesEnabled flag
// (COMPOSITION_GATES_ENABLED), extending the R1–R3 commit-gate family.
// Literature priors: docs/strategy/scientific-foundation.md.
//   (i)   group minimum-E floor (stability floor)
//   (ii)  group mean-A floor (viability floor)
//   (iii) exactly-one-spark: spark = member with reported X ≥ 70 ∨ P ≥ 70
//         (LOCKED to the Item 9 Monte Carlo baseline definition; replaces the
//         archetype-level R2 energizer definition when this flag is on).
//         Enforcement = admission-time steering (R4 argmax-nudge pattern) +
//         commit-gate backstop; pool-level exemption is BIDIRECTIONAL
//         (spark-deficit AND spark-surplus pools).
//   (iv)  X-variance hard cap — extends the harmonyScore variance pattern
//         (natural-stdDev ≤ 20 → no penalty) to reported trait X.
// Cold-start policy (AC-5.1b): members without a complete reported vector
// skip gates (i)/(ii)/(iv) — R3 skip-on-missing-cache precedent; without it
// M10 (unmatched-rate delta ≤ +2pp) is unachievable.
// AC-5.2: NONE of the four gates is monotonic under member addition, so they
// are re-evaluated in `magnetismRulesSatisfiedFor` (H4 absorption + Phase-2
// whole-group formation), not just at the greedy commit gate.

/**
 * (i) Stability floor: a committed group's minimum reported E must reach this.
 * Barrick et al. (1998): the MINIMUM member score matters — a single
 * low-stability member degrades the whole group's viability.
 */
export const COMPOSITION_MIN_E_FLOOR = 25;
/**
 * (ii) Viability floor: a committed group's mean reported A must reach this.
 * Bell (2007) meta-analysis: team-level Agreeableness predicts team
 * performance (stronger in field settings).
 */
export const COMPOSITION_MEAN_A_FLOOR = 45;
/**
 * (iii) Spark definition (LOCKED, Item 9 baseline): a member is a spark when
 * reported X ≥ threshold OR P ≥ threshold.
 */
export const COMPOSITION_SPARK_TRAIT_THRESHOLD = 70;
/**
 * (iv) X-variance hard cap: a committed group's population variance of
 * reported X must not exceed this. Extends the harmonyScore variance pattern
 * (energy stdDev ≤ 20 is natural) to trait X — stdDev ≤ 25 within a group is
 * treated as natural spread; beyond it, extraversion polarization degrades
 * the table. Initial value bites the violation TAIL of the Item 9 baseline
 * distribution (p90 ≈ 621), not the median; calibrated via `simulate:groups`
 * gate-on arm against M9 (≥95% pass) ∧ M10 (≤ +2pp unmatched).
 */
export const COMPOSITION_X_VARIANCE_CAP = 750;

/** (iii) Ranking penalty for admitting a SECOND spark into a group that already has one (R4 nudge pattern: argmax-only, never a ban). */
export const COMPOSITION_SECOND_SPARK_RANKING_PENALTY = 12;
/** (iii) Ranking bonus for a spark candidate joining a sparkless group (prefer-a-spark steering). */
export const COMPOSITION_SPARKLESS_GROUP_SPARK_BONUS = 16;
/** (i) Ranking penalty for admitting a member whose reported E is below the stability floor (bad-apple steering; Barrick et al. 1998). */
export const COMPOSITION_LOW_E_RANKING_PENALTY = 8;
/** (ii) Ranking bonus/penalty steering a below-floor group's mean A back over the viability floor. */
export const COMPOSITION_MEAN_A_LIFT_BONUS = 8;
export const COMPOSITION_MEAN_A_DRAG_PENALTY = 8;
/** (iv) Ranking penalty for an admission that would push the group's X-variance over the hard cap. */
export const COMPOSITION_X_VARIANCE_RANKING_PENALTY = 10;

/** True when the member carries a complete, finite reported ACOEXP vector. */
export function hasCompleteTraitVector(member: UserWithProfile): boolean {
  const t = member.traitScores;
  if (!t) return false;
  return (["A", "C", "E", "O", "X", "P"] as const).every(
    (k) => typeof t[k] === "number" && Number.isFinite(t[k]),
  );
}

/**
 * (iii) spark predicate — LOCKED definition: reported X ≥ 70 ∨ P ≥ 70.
 * Cold-start members (no complete vector) count as NON-sparks
 * (deterministic; the bidirectional pool exemption absorbs the uncertainty).
 */
export function isCompositionSpark(member: UserWithProfile): boolean {
  const t = member.traitScores;
  if (!t) return false;
  const x = typeof t.X === "number" ? t.X : null;
  const p = typeof t.P === "number" ? t.P : null;
  return (x !== null && x >= COMPOSITION_SPARK_TRAIT_THRESHOLD) ||
    (p !== null && p >= COMPOSITION_SPARK_TRAIT_THRESHOLD);
}

export interface CompositionSparkPoolState {
  sparkCount: number;
  expectedGroups: number;
  /** sparks < expectedGroups → some group MUST end sparkless → skip the ≥1-spark direction. */
  deficitExempt: boolean;
  /** sparks > expectedGroups → some group MUST take 2+ sparks → skip the ≤1-spark direction. */
  surplusExempt: boolean;
}

/**
 * Pool-level spark arithmetic, computed once per run. The exemption is
 * BIDIRECTIONAL (contract AC-5.1(iii)): rejection-only against a spark-surplus
 * population (Item 9 baseline: 79.3% of groups carry 2+ sparks) would strand
 * pools and blow M10, and a spark-deficit pool can never give every group a
 * spark. `expectedGroups` is the pool's planned group count (targetGroups,
 * fallback ceil(eligible/maxGroupSize)).
 */
export function computeSparkPoolState(
  eligibleUsers: UserWithProfile[],
  expectedGroups: number,
): CompositionSparkPoolState {
  const sparkCount = eligibleUsers.filter(isCompositionSpark).length;
  const groups = Math.max(1, expectedGroups);
  return {
    sparkCount,
    expectedGroups: groups,
    deficitExempt: sparkCount < groups,
    surplusExempt: sparkCount > groups,
  };
}

// ── W2 (gm-debrief): table-viability floor — R1 无孤立者 + R2 能量编排 ──────
// OD-W2 (locked): W2 owns the R1/R2 commit gate. The energizer predicate
// ADOPTS the item5 spark definition (reported X ≥ 70 ∨ P ≥ 70) when a member
// carries a complete reported ACOEXP vector, and FALLS BACK to the
// archetype-level ARCHETYPE_ENERGY ≥ 75 definition otherwise (cold-start
// members). W6 owns the `calculateEnergyBalance` quality metric — this gate
// must not re-implement it.

/**
 * W2 energizer fallback threshold for members without a complete reported
 * vector. Mirrors the archetype-level R2 definition (MAGNETISM_ENERGIZER_THRESHOLD).
 */
export const TABLE_VIABILITY_ENERGIZER_THRESHOLD = MAGNETISM_ENERGIZER_THRESHOLD;

/**
 * W2 energizer predicate (OD-W2, locked): reported X ≥ 70 ∨ P ≥ 70 when the
 * member has a complete trait vector, else ARCHETYPE_ENERGY ≥ 75. Cold-start
 * members are therefore measurable (unlike the item5 spark, which counts them
 * as non-sparks) — the archetype fallback is what keeps R2 meaningful before
 * trait vectors exist.
 */
export function isTableViabilityEnergizer(member: UserWithProfile): boolean {
  if (hasCompleteTraitVector(member)) return isCompositionSpark(member);
  return userArchetypeEnergy(member) >= TABLE_VIABILITY_ENERGIZER_THRESHOLD;
}

/**
 * W2 R2 能量编排 (energizer presence). `energizerDeficitExempt` is the
 * pool-level no-deadlock exemption: when the pool has fewer energizers than
 * planned groups, some group MUST end energizer-less by pigeonhole, so
 * rejecting them would only strand the pool.
 */
export function groupSatisfiesEnergizerRule(
  members: UserWithProfile[],
  energizerDeficitExempt: boolean,
): boolean {
  return energizerDeficitExempt || members.some(isTableViabilityEnergizer);
}

/** W2 pool-level energizer arithmetic, computed once per run. */
export function computeEnergizerPoolState(
  eligibleUsers: UserWithProfile[],
  expectedGroups: number,
): { energizerCount: number; expectedGroups: number; energizerDeficitExempt: boolean } {
  const groups = Math.max(1, expectedGroups);
  const energizerCount = eligibleUsers.filter(isTableViabilityEnergizer).length;
  return { energizerCount, expectedGroups: groups, energizerDeficitExempt: energizerCount < groups };
}

export interface CompositionGateEvaluation {
  satisfied: boolean;
  minEFloorSatisfied: boolean;
  meanAFloorSatisfied: boolean;
  sparkRuleSatisfied: boolean;
  xVarianceCapSatisfied: boolean;
  /** Per-gate false = gate skipped (cold-start skip or pool exemption). */
  evaluated: { minE: boolean; meanA: boolean; sparkMin: boolean; sparkMax: boolean; xVariance: boolean };
}

/**
 * Evaluate the four Item-5 composition gates on a candidate group.
 * Cold-start skip (AC-5.1b): if ANY member lacks a complete reported vector,
 * gates (i)/(ii)/(iv) are skipped (satisfied, evaluated=false). Gate (iii)
 * counts only known vectors and respects the bidirectional pool exemption.
 * Pure + sync: usable by the greedy commit gate, the H4 redistribution
 * re-evaluation, and the Monte Carlo harness (identical predicate, no drift).
 */
export function evaluateCompositionGates(
  members: UserWithProfile[],
  sparkPoolState: CompositionSparkPoolState,
): CompositionGateEvaluation {
  const allHaveTraits = members.every(hasCompleteTraitVector);

  // (i) stability floor — Barrick et al. (1998): minimum member score matters.
  let minEFloorSatisfied = true;
  if (allHaveTraits) {
    minEFloorSatisfied = members.every((m) => (m.traitScores!.E as number) >= COMPOSITION_MIN_E_FLOOR);
  }

  // (ii) viability floor — Bell (2007): team-level Agreeableness.
  let meanAFloorSatisfied = true;
  if (allHaveTraits) {
    const meanA = members.reduce((s, m) => s + (m.traitScores!.A as number), 0) / members.length;
    meanAFloorSatisfied = meanA >= COMPOSITION_MEAN_A_FLOOR;
  }

  // (iv) X-variance hard cap — harmonyScore variance pattern extended to trait X.
  let xVarianceCapSatisfied = true;
  if (allHaveTraits) {
    const meanX = members.reduce((s, m) => s + (m.traitScores!.X as number), 0) / members.length;
    const varX = members.reduce((s, m) => s + Math.pow((m.traitScores!.X as number) - meanX, 2), 0) / members.length;
    xVarianceCapSatisfied = varX <= COMPOSITION_X_VARIANCE_CAP;
  }

  // (iii) exactly-one-spark — bidirectional exemption; sparkless members with
  // missing vectors count as non-sparks (see isCompositionSpark).
  const sparkCount = members.filter(isCompositionSpark).length;
  const sparkMinSatisfied = sparkPoolState.deficitExempt || sparkCount >= 1;
  const sparkMaxSatisfied = sparkPoolState.surplusExempt || sparkCount <= 1;
  const sparkRuleSatisfied = sparkMinSatisfied && sparkMaxSatisfied;

  return {
    satisfied: minEFloorSatisfied && meanAFloorSatisfied && sparkRuleSatisfied && xVarianceCapSatisfied,
    minEFloorSatisfied,
    meanAFloorSatisfied,
    sparkRuleSatisfied,
    xVarianceCapSatisfied,
    evaluated: {
      minE: allHaveTraits,
      meanA: allHaveTraits,
      sparkMin: !sparkPoolState.deficitExempt,
      sparkMax: !sparkPoolState.surplusExempt,
      xVariance: allHaveTraits,
    },
  };
}

/**
 * Item-5 admission-time steering (AC-5.1(iii)/AC-5.2): R4-pattern argmax-only
 * nudges during group expansion. NEVER a ban — the admission threshold
 * (`bestAvgScore >= minPairScore`) still sees the true pair-score average, and
 * cached pair scores are never mutated. [DUO] a duo candidate is steered as a
 * UNIT: the partner's traits count toward the unit's spark/floor effects, so
 * steering can never prefer splitting an atomic unit.
 *
 * The spark nudges respect the BIDIRECTIONAL pool exemption: in a
 * spark-surplus pool (sparks > expectedGroups) exactly-one-per-group is
 * arithmetically impossible, so the second-spark penalty is skipped —
 * penalizing it would only delay spark admissions until their best partners
 * are consumed (Monte Carlo stranding evidence, 2026-09-10). In a
 * spark-deficit pool the prefer-a-spark bonus is skipped (some groups must go
 * sparkless regardless). The mean-A nudge is PREVENTIVE: it fires when the
 * projected post-admission mean would sit below the viability floor.
 */
export function adjustScoreForCompositionGates(
  candidate: UserWithProfile,
  candidatePartner: UserWithProfile | null,
  groupMembers: UserWithProfile[],
  avgScore: number,
  sparkPoolState: CompositionSparkPoolState,
): number {
  const unit = candidatePartner ? [candidate, candidatePartner] : [candidate];
  let score = avgScore;

  // (iii) spark steering: spread sparks across groups, exemption-aware.
  const unitHasSpark = unit.some(isCompositionSpark);
  if (unitHasSpark) {
    const groupSparkCount = groupMembers.filter(isCompositionSpark).length;
    if (!sparkPoolState.surplusExempt && groupSparkCount >= 1) {
      score -= COMPOSITION_SECOND_SPARK_RANKING_PENALTY; // second-spark admission
    } else if (!sparkPoolState.deficitExempt && groupSparkCount === 0) {
      score += COMPOSITION_SPARKLESS_GROUP_SPARK_BONUS; // prefer-a-spark for sparkless groups
    }
  }

  // (i) stability steering: discourage admitting a sub-floor-E member.
  if (unit.some((m) => hasCompleteTraitVector(m) && (m.traitScores!.E as number) < COMPOSITION_MIN_E_FLOOR)) {
    score -= COMPOSITION_LOW_E_RANKING_PENALTY;
  }

  // (ii) viability steering (preventive): when the PROJECTED post-admission
  // mean A would sit below the floor, lift high-A units and drag low-A units.
  const traitedMembers = groupMembers.filter(hasCompleteTraitVector);
  const unitTraited = unit.filter(hasCompleteTraitVector);
  if (traitedMembers.length > 0 && unitTraited.length === unit.length && unitTraited.length > 0) {
    const projected = [...traitedMembers, ...unitTraited];
    const projectedMeanA = projected.reduce((s, m) => s + (m.traitScores!.A as number), 0) / projected.length;
    if (projectedMeanA < COMPOSITION_MEAN_A_FLOOR) {
      const unitMeanA = unitTraited.reduce((s, m) => s + (m.traitScores!.A as number), 0) / unitTraited.length;
      score += unitMeanA >= COMPOSITION_MEAN_A_FLOOR
        ? COMPOSITION_MEAN_A_LIFT_BONUS
        : -COMPOSITION_MEAN_A_DRAG_PENALTY;
    }
  }

  // (iv) X-variance steering: penalize admissions that would push the group's
  // X-variance over the hard cap (projected variance over trait-bearing members).
  if (traitedMembers.length >= 1 && unitTraited.length === unit.length && unitTraited.length > 0) {
    const projected = [...traitedMembers, ...unitTraited];
    const meanX = projected.reduce((s, m) => s + (m.traitScores!.X as number), 0) / projected.length;
    const varX = projected.reduce((s, m) => s + Math.pow((m.traitScores!.X as number) - meanX, 2), 0) / projected.length;
    if (varX > COMPOSITION_X_VARIANCE_CAP) {
      score -= COMPOSITION_X_VARIANCE_RANKING_PENALTY;
    }
  }

  return score;
}

/**
 * Per-gate rejection counters for the observability pillar (AC: gate-rejection
 * counts logged per gate). Optional trailing core param; undefined = no
 * collection (byte-identical gate-off). The Monte Carlo harness aggregates
 * these into the gate-on report's per-gate rejection shares.
 */
export interface CompositionGateStats {
  commitRejections: { minEFloor: number; meanAFloor: number; sparkRule: number; xVarianceCap: number; noIsolate: number; energizer: number; total: number };
  redistributionRejections: { minEFloor: number; meanAFloor: number; sparkRule: number; xVarianceCap: number; noIsolate: number; energizer: number; total: number };
}

export function createCompositionGateStats(): CompositionGateStats {
  const zero = () => ({ minEFloor: 0, meanAFloor: 0, sparkRule: 0, xVarianceCap: 0, noIsolate: 0, energizer: 0, total: 0 });
  return { commitRejections: zero(), redistributionRejections: zero() };
}

/** W2 table-viability rejection counters (R1 no-isolate / R2 energizer). */
export function recordTableViabilityRejection(
  stats: CompositionGateStats | undefined,
  bucket: keyof CompositionGateStats,
  noIsolateSatisfied: boolean,
  energizerSatisfied: boolean,
): void {
  if (!stats) return;
  const b = stats[bucket];
  if (!noIsolateSatisfied) b.noIsolate++;
  if (!energizerSatisfied) b.energizer++;
  b.total++;
}

export function recordCompositionGateRejection(
  stats: CompositionGateStats | undefined,
  bucket: keyof CompositionGateStats,
  result: CompositionGateEvaluation,
): void {
  if (!stats) return;
  const b = stats[bucket];
  if (!result.minEFloorSatisfied) b.minEFloor++;
  if (!result.meanAFloorSatisfied) b.meanAFloor++;
  if (!result.sparkRuleSatisfied) b.sparkRule++;
  if (!result.xVarianceCapSatisfied) b.xVarianceCap++;
  b.total++;
}
