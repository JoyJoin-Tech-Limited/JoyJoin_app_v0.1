/**
 * Monte Carlo group-formation harness — markdown report + JSON summarisation.
 * Extracted verbatim from run-group-monte-carlo.ts (behaviour-preserving).
 */
import {
  COMPOSITION_MIN_E_FLOOR,
  COMPOSITION_MEAN_A_FLOOR,
  COMPOSITION_SPARK_TRAIT_THRESHOLD,
  COMPOSITION_X_VARIANCE_CAP,
} from '../../../apps/server/src/poolMatchingService';
import { SHRINKAGE_ERROR_FLOOR, SHRINKAGE_EXCESS_SCALE } from '../../../packages/shared/src/personality/traitShrinkage';
import {
  M11_CEILING_FRACTION,
  M11_SMOKE_ALARM_MAX_DELTA,
  M11_SMOKE_RATE,
  type M11DurableEvaluation,
} from './m11-durable-contract';
import type { SyntheticRespondent } from './monte-carlo-population';
import {
  ALL_TRAITS,
  CENTROID_MIXTURE_WEIGHT,
  CENTROID_TRAIT_SD,
  DUO_MEMBER_SHARE,
  GENERAL_TRAIT_MEAN,
  GENERAL_TRAIT_SD,
  M11_FIRST_ORDER_CEILING,
  M11_MIN_WEIGHT_SHIPPED,
  M11_REDUCTION_TARGET,
  POOL_SIZE_MAX,
  POOL_SIZE_MIN,
  PROV_CLONE_MIN_MAX_DISTANCE,
  PROV_MEAN_A_FLOOR,
  PROV_SPARK_TRAIT_THRESHOLD,
  PROV_STABILITY_FLOOR_MIN_E,
  PROV_X_VARIANCE_CAP,
  TRAIT_MAX,
  TRAIT_MIN,
} from './monte-carlo-constants';
import {
  round6,
  type ArmAggregate,
  type DerivedArmAggregate,
  type DistSummary,
  type GateArmAggregate,
} from './monte-carlo-measurement';
import type { M11PoolResult, M11SweepRateResult } from './monte-carlo-m11';
import type { InvariantFailure } from './monte-carlo-invariants';

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
  L.push('> Item 5\'s M9/M10 gates and Item 3\'s M11 — the matcher core is driven');
  L.push('> in-memory (no DB access). NOTE: the W6 and W6-F follow-up changes modified');
  L.push('> `poolMatchingService`; see the W6-F section below for the X-variance closure.');
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
    // W2 (gm-debrief) table-viability floor — piggybacks the item5 gate arm
    // (compositionGates ON also activates W2 R1/R2). Rejection counts only.
    L.push(`| (W2) R1 no-isolate | ${g.commitRejections.noIsolate} | ${g.redistributionRejections.noIsolate} |`);
    L.push(`| (W2) R2 energizer | ${g.commitRejections.energizer} | ${g.redistributionRejections.energizer} |`);
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

export {
  pct,
  f2,
  f3,
  fmtDist,
  buildReport,
  summarizeDist,
  summarizeArm,
};
