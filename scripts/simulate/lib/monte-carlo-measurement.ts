/**
 * Monte Carlo group-formation harness — composition measurements and arm
 * aggregation (baseline / derived-chemistry / gate-on). Extracted verbatim
 * from run-group-monte-carlo.ts (behaviour-preserving).
 */
import {
  evaluateCompositionGates,
  isCompositionSpark,
  COMPOSITION_MIN_E_FLOOR,
  COMPOSITION_MEAN_A_FLOOR,
  COMPOSITION_X_VARIANCE_CAP,
  type MatchGroup,
  type CompositionGateStats,
} from '../../../apps/server/src/poolMatchingService';
import type { TraitKey } from '../../../packages/shared/src/personality/types';
import type { RunResult, SyntheticPool, PoolMember } from './monte-carlo-pool';
import type { SessionProduct } from './monte-carlo-sessions';
import {
  ALL_TRAITS,
  PROV_CLONE_MIN_MAX_DISTANCE,
  PROV_MEAN_A_FLOOR,
  PROV_SPARK_TRAIT_THRESHOLD,
  PROV_STABILITY_FLOOR_MIN_E,
  PROV_X_VARIANCE_CAP,
} from './monte-carlo-constants';

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

export type {
  GroupComposition,
  PoolMeasurement,
  DistSummary,
  ArmAggregate,
  DerivedArmAggregate,
  GateArmAggregate,
};

export {
  measureGroup,
  measurePoolRun,
  mean,
  percentile,
  dist,
  round3,
  round6,
  aggregateArm,
  groupAssignment,
  coMembershipAgreement,
  aggregateDerivedArm,
  aggregateGateArm,
};
