#!/usr/bin/env node
/**
 * Monte Carlo Group-Formation Harness (V4 Personality Engine — Plan Item 9)
 *
 * Contract: `.git/.orchestration/sprints/sprint-contract.item9-monte-carlo-groups.md`
 * Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 9.
 *
 * What it does:
 *   1. Generates a synthetic respondent population with KNOWN ground-truth
 *      ACOEXP trait vectors, reusing Item 6's documented 2-component mixture
 *      (60% centroid-mixture σ=10 / 40% general N(50,15), truncated [5,95]).
 *   2. Runs each respondent through the adaptive engine TWICE: flags-off
 *      (baseline) and flags-on (`enableConsistencyFolding` +
 *      `enableTraitShrinkage`). The matcher never sees raw engine state —
 *      production wiring stores the resulting archetype + reported trait
 *      vector, so this harness feeds the matcher exactly those arm-specific
 *      products (archetype = engine top-1; with shrinkage on the engine's
 *      currentMatches already derive from the shrunken vector at the
 *      processAnswer match boundary; reported = shrinkTraitsTowardNeutral).
 *   3. Draws ≥500 synthetic pools (sizes 12–60, duo-bound pairs included) and
 *      runs each through `runGreedyPoolMatchingCore` — the REAL matcher core,
 *      read-only, driven fully in-memory (complete interests cache → zero DB
 *      access; static chemistry matrix; semantic dimension off; magnetism
 *      R1–R3 group rules OFF — this is the gate-off baseline instrument).
 *   4. Measures formed-group composition per pool: (a) min-E per group
 *      (stability floor violations), (b) mean-A, (c) spark-count distribution
 *      (high-X/P members per group: 0 / 1 / 2+), (d) X-variance, (e)
 *      clone-group rate (max intra-group 6D trait distance below a locked
 *      minimum), (f) unmatched rate + unmatched-member trait profiles.
 *   5. A/B arms: flags-off vs flags-on composition delta (preview evidence
 *      for Item 5's M9/M10 gates — thresholds PROVISIONAL, measurement-only).
 *      Optional third arm `--composition-gates=on` (Item 5, LOCKED M9/M10):
 *      same pools, flags-off reported vectors supplied at the
 *      toUserWithProfile boundary (AC-5.1b — measurement and gating see
 *      identical inputs), compositionGatesEnabled threaded into the REAL
 *      matcher core. Reports per-gate pass shares (exemption-aware), raw
 *      violation shares, per-gate rejection counts, M9 (≥95% all-gates pass)
 *      and M10 (unmatched delta ≤ +2pp vs the gate-off baseline); hard-fails
 *      M9/M10 only under `--mode=gated`. Gate-on outputs default to
 *      `-gates-on`-suffixed paths so the locked baseline artifacts are never
 *      clobbered; default (gate-off) runs stay byte-identical (AC-5.5).
 *      W2 COVERAGE (gm-debrief): `compositionGatesEnabled` also activates the
 *      W2 table-viability floor (`tableViabilityActive = tableViabilityFloor
 *      Enabled || compositionGatesEnabled`), so the gates-on arm measures W2
 *      R1/R2 TOGETHER with the Item-5 gates. The production default is W2 ON /
 *      Item-5 gates OFF; a dedicated `w2-only` arm is intentionally NOT shipped
 *      (it would duplicate this arm's plumbing plus a second aggregator/report
 *      section for a one-filter delta). The gates-on arm is a CONSERVATIVE
 *      UPPER BOUND on the W2-only arm: the Item-5 gates only ADD commit /
 *      redistribution rejections on top of W2 R1/R2, so gates-on unmatched ≥
 *      W2-only unmatched and gates-on M9 all-gates pass ≤ the R1/R2-only pass.
 *      Both arms run strictness 50 (allowOverflow=false), so W2's
 *      `maxGroupSize+1` overflow bound (AC-W2.3) is inert and cannot perturb
 *      either M9/M10.
 *   6. M11 arm (LOCKED target ≥50% reduction; measured + verdicted in all
 *      modes, HARD-failing only in --mode=gated — contract verification
 *      method #1 requires baseline exit 0): 20% of pool members replaced by
 *      low-confidence adversarial respondents (random-clicker from
 *      persona-utils — Item 7 machinery; the ONLY adversarial arm whose
 *      session confidence lands in the shrinkage bite-zone conf < 0.65 —
 *      midpoint-hugger/acquiescence sit at ~0.92–0.95 where the locked
 *      AC-7.4 ceiling keeps w ≈ 1); per-trait group-mean delta vs the
 *      no-injection reference measured with shrinkage off vs on. NOTE: the
 *      shipped Item-3 mechanic (K=75, tuned for AC-3.3 no-harm) clamps
 *      w ≥ 0.879, capping first-order per-trait stabilization at ≈12.1% —
 *      the report prints this mechanical ceiling alongside the measured
 *      reduction so the ≥50% target-vs-mechanic tension is visible.
 *   7. Writes a dated report to docs/reports/ + a machine-readable JSON
 *      artifact to scripts/simulate/data/group-monte-carlo-latest.json.
 *
 * Assertion classes (Reliability pillar, contract AC-9.3):
 *   HARD (exit 1, failing pool index + seed printed for replay):
 *     INV-1 every committed group size ∈ [minGroupSize, maxGroupSize]
 *     INV-2 no member appears in two groups of the same run
 *     INV-3 duo partners are co-located or both unmatched; ≤1 duo per group
 *     INV-4 no NaN/undefined composition metric
 *   HARD ONLY IN --mode=gated (locked target; measured + verdicted everywhere):
 *     INV-5 M11 shrinkage stabilization ≥ 50% reduction (LOCKED, AC-9.4).
 *     Baseline mode reports the verdict without failing so the instrument
 *     can run while the ≥50% target and the K=75 no-harm mechanic are
 *     reconciled by the plan owners (see the mechanical-ceiling note above).
 *   MEASUREMENT-ONLY (reported, not gated — thresholds lock in Item 5):
 *     min-E floor violation rate, mean-A floor violation rate, spark-count
 *     distribution, X-variance cap violation rate, clone-group rate,
 *     unmatched rate + flags-on unmatched-rate delta (M10 preview).
 *   `--mode=gated` promotes INV-5 to a hard failure (the only LOCKED
 *   composition target so far); M9/M10-style rates stay measurement-only
 *   until Item 5 locks their thresholds.
 *
 * Determinism: identical `--seed` reproduces every number (all randomness
 * flows through mulberry32 streams tagged by purpose; the matcher is
 * deterministic given identical input order; V8 Array.prototype.sort is
 * stable per ES2019).
 *
 * Usage:
 *   npm run simulate:groups
 *   tsx --tsconfig apps/server/tsconfig.json scripts/simulate/run-group-monte-carlo.ts
 *   tsx --tsconfig apps/server/tsconfig.json scripts/simulate/run-group-monte-carlo.ts --pools=500 --seed=20260910
 *   tsx --tsconfig apps/server/tsconfig.json scripts/simulate/run-group-monte-carlo.ts --only-pool=17   # replay one pool
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { FITTED_CONFIDENCE_CALIBRATION } from '../../packages/shared/src/personality/confidenceCalibration';
import {
  M11_CEILING_FRACTION,
  M11_INJECTION_RATES,
  M11_SMOKE_ALARM_MAX_DELTA,
  M11_SMOKE_RATE,
  evaluateM11DurableContract,
} from './lib/m11-durable-contract';
import { mulberry32, streamSeed } from './lib/persona-utils';
import {
  createCompositionGateStats,
  COMPOSITION_MEAN_A_FLOOR,
  COMPOSITION_MIN_E_FLOOR,
  COMPOSITION_SPARK_TRAIT_THRESHOLD,
  COMPOSITION_X_VARIANCE_CAP,
} from '../../apps/server/src/poolMatchingService';
import {
  ALL_TRAITS,
  M11_MIN_DELTA_OFF,
  M11_REDUCTION_TARGET,
  POOL_SIZE_MAX,
  PROV_CLONE_MIN_MAX_DISTANCE,
  PROV_MEAN_A_FLOOR,
  PROV_SPARK_TRAIT_THRESHOLD,
  PROV_STABILITY_FLOOR_MIN_E,
  PROV_X_VARIANCE_CAP,
} from './lib/monte-carlo-constants';
import { generatePopulation, generateProfile } from './lib/monte-carlo-population';
import { SessionStore, type SessionArm } from './lib/monte-carlo-sessions';
import {
  generatePools,
  runMatchForPool,
  type PoolMember,
  type RunResult,
  type SyntheticPool,
} from './lib/monte-carlo-pool';
import { checkRunInvariants, type InvariantFailure } from './lib/monte-carlo-invariants';
import {
  aggregateArm,
  aggregateDerivedArm,
  aggregateGateArm,
  mean,
  measurePoolRun,
  round6,
  type ArmAggregate,
  type PoolMeasurement,
} from './lib/monte-carlo-measurement';
import {
  compositionDelta,
  injectedNeutralValues,
  injectedPerturbation,
  variance,
  type M11PoolResult,
  type M11SweepRateResult,
} from './lib/monte-carlo-m11';
import { buildReport, f2, f3, pct, summarizeArm, summarizeDist } from './lib/monte-carlo-report';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

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
  const mode = options.mode || 'baseline';
  if (!['baseline', 'gated'].includes(mode)) {
    console.error(`❌ Unknown mode: ${mode} (expected baseline|gated)`);
    process.exit(1);
  }
  return {
    pools: parseInt(options.pools || '500', 10),
    m11Pools: parseInt(options['m11-pools'] || '200', 10),
    population: parseInt(options.population || '6000', 10),
    seed: parseInt(options.seed || '20260910', 10),
    onlyPool: options['only-pool'] !== undefined ? parseInt(options['only-pool'], 10) : null,
    outFile: options.out || '',
    jsonOutFile: options['json-out'] || '',
    mode,
    compositionGates: options['composition-gates'] === 'on',
    // Item 10 / AC-10.5: opt-in derived-chemistry arm (default off → baseline
    // report + JSON stay byte-identical).
    derivedChemistry: options['derived-chemistry'] === 'on',
  };
}

// ── Main ─────────────────────────────────────────────────────────────

async function main() {
  const { pools, m11Pools, population, seed, onlyPool, outFile, jsonOutFile, mode, compositionGates, derivedChemistry } = parseArgs();

  if (mode === 'gated') {
    console.log('🔒 --mode=gated: INV-5 (M11) will hard-fail;');
    console.log('   M9/M10 hard-fail only when combined with --composition-gates=on (Item 5 locked targets).');
  }
  if (compositionGates) {
    console.log('🧱 --composition-gates=on: Item 5 composition gates arm added (flags-off trait vectors);');
    console.log('   baseline/flags-on/M11 arms are unchanged; outputs default to -gates-on suffixed paths.');
  }
  if (derivedChemistry) {
    console.log('🧬 --derived-chemistry=on: Item 10 derived-chemistry arm added (flags-off vectors);');
    console.log('   reports derived-on vs off group-formation impact (AC-10.5).');
  }
  if (pools < 1 || population < POOL_SIZE_MAX) {
    console.error('❌ population must be ≥ 60 and pools ≥ 1.');
    process.exit(1);
  }
  if (m11Pools > pools) {
    console.error('❌ --m11-pools cannot exceed --pools (M11 pools are the first K pools).');
    process.exit(1);
  }

  const startedAt = Date.now();

  // 1. Population + fixed profiles
  const respondents = generatePopulation(population, seed);
  const profiles = respondents.map((_, i) => generateProfile(i, seed));

  // 2. Pools
  const allPools = generatePools(pools, respondents, profiles, seed);
  const measuredPools = onlyPool !== null ? allPools.filter((p) => p.index === onlyPool) : allPools;
  if (onlyPool !== null && measuredPools.length === 0) {
    console.error(`❌ --only-pool=${onlyPool} out of range (0..${pools - 1}).`);
    process.exit(1);
  }

  // 3. Main arms: flags-off vs flags-on
  const sessions = new SessionStore(seed);
  const invariantFailures: InvariantFailure[] = [];
  const offRuns: PoolMeasurement[] = [];
  const onRuns: PoolMeasurement[] = [];
  const offResults = new Map<number, RunResult>();
  const onResults = new Map<number, RunResult>();
  // Item 5 gate-on arm state (only populated when --composition-gates=on).
  const gatedRuns: PoolMeasurement[] = [];
  const gatedResults = new Map<number, RunResult>();
  const gateStatsTotal = createCompositionGateStats();
  // Item 10 derived-chemistry arm state (only populated when --derived-chemistry=on).
  const derivedRuns: PoolMeasurement[] = [];
  const derivedResults = new Map<number, RunResult>();

  for (const pool of measuredPools) {
    const off = await runMatchForPool(pool, sessions, () => 'off');
    const on = await runMatchForPool(pool, sessions, () => 'on');
    offResults.set(pool.index, off);
    onResults.set(pool.index, on);
    invariantFailures.push(...checkRunInvariants(pool, 'off', off));
    invariantFailures.push(...checkRunInvariants(pool, 'on', on));
    offRuns.push(measurePoolRun(pool, off));
    onRuns.push(measurePoolRun(pool, on));

    // Item 5 gate-on arm (opt-in via --composition-gates=on): SAME pool,
    // flags-off reported vectors, composition gates threaded into the REAL
    // matcher core. M11 injection runs below stay gates-off (locked baseline).
    // NOTE: this arm also activates W2 (compositionGatesEnabled ⇒ table-
    // viability floor active) and is the sanctioned proxy for the production
    // W2-ON / gates-OFF default — a conservative upper bound since the Item-5
    // gates stack additional rejections on top of W2 R1/R2 (see header).
    if (compositionGates) {
      const gated = await runMatchForPool(pool, sessions, () => 'off', true, gateStatsTotal);
      gatedResults.set(pool.index, gated);
      // W2 rides this arm (compositionGatesEnabled also activates the
      // table-viability floor) → allow the documented maxGroupSize+1 soft
      // overflow introduced by the always-on absorption pass (AC-W2.3).
      invariantFailures.push(...checkRunInvariants(pool, 'gates-on', gated, true));
      gatedRuns.push(measurePoolRun(pool, gated));
    }

    // Item 10 derived-chemistry arm (opt-in via --derived-chemistry=on): SAME
    // pool, flags-off reported vectors, derived chemistry threaded into the
    // REAL matcher core. Compared against the flags-off baseline above.
    if (derivedChemistry) {
      const derived = await runMatchForPool(pool, sessions, () => 'off', false, undefined, true);
      derivedResults.set(pool.index, derived);
      invariantFailures.push(...checkRunInvariants(pool, 'derived-on', derived));
      derivedRuns.push(measurePoolRun(pool, derived));
    }
  }

  // 4. M11 arm (first K measured pools; 20% low-confidence injection)
  // 4. M11 injection-rate sweep (5/10/20/40%; plan reformulation) over the
  //    first K measured pools. The 20% rate keeps the original stream tag so
  //    the headline point is byte-identical to the Item-9 baseline. An injected
  //    member's adv-off session provides the per-trait confidences that anchor
  //    the calibration-implied ceiling.
  const m11Measured = measuredPools.slice(0, m11Pools);
  const m11Sweep: M11SweepRateResult[] = [];
  let smokeInjectedConfidences: number[] = [];

  for (const rate of M11_INJECTION_RATES) {
    const isSmoke = Math.abs(rate - M11_SMOKE_RATE) < 1e-9;
    const pools: M11PoolResult[] = [];
    const perPoolInjected: Array<{ pool: SyntheticPool; injected: Set<number> }> = [];
    const rateOffValues: number[] = [];
    const rateOnValues: number[] = [];

    for (const pool of m11Measured) {
      const rng = mulberry32(streamSeed(seed, pool.index, isSmoke ? 'm11' : `m11:${rate}`));
      const injectedCount = Math.max(1, Math.round(pool.size * rate));
      const injected = new Set<number>();
      while (injected.size < injectedCount && injected.size < pool.members.length) {
        injected.add(Math.floor(rng() * pool.members.length));
      }
      perPoolInjected.push({ pool, injected });

      const armFor = (arm: 'adv-off' | 'adv-on', base: 'off' | 'on') => (member: PoolMember): SessionArm => {
        const memberIdx = pool.members.indexOf(member);
        return injected.has(memberIdx) ? arm : base;
      };

      const injOff = await runMatchForPool(pool, sessions, armFor('adv-off', 'off'));
      const injOn = await runMatchForPool(pool, sessions, armFor('adv-on', 'on'));
      invariantFailures.push(...checkRunInvariants(pool, `m11-inj-off@${rate}`, injOff));
      invariantFailures.push(...checkRunInvariants(pool, `m11-inj-on@${rate}`, injOn));

      const refOff = offResults.get(pool.index)!;
      const refOn = onResults.get(pool.index)!;
      const deltaOff = compositionDelta(refOff, injOff);
      const deltaOn = compositionDelta(refOn, injOn);
      // Churn-free report-channel magnitudes over ONLY the injected members,
      // shrink-off vs shrink-on, so non-injected shrinkage cannot contaminate
      // the measurement.
      const injectedRespondents = [...injected].map((i) => pool.members[i].respondent);
      const fixedOff = injectedPerturbation(refOff, injectedRespondents, sessions, 'adv-off');
      const fixedOn = injectedPerturbation(refOff, injectedRespondents, sessions, 'adv-on');
      rateOffValues.push(...injectedNeutralValues(injectedRespondents, sessions, 'adv-off'));
      rateOnValues.push(...injectedNeutralValues(injectedRespondents, sessions, 'adv-on'));
      pools.push({
        poolIndex: pool.index,
        poolSeed: pool.poolSeed,
        injectedCount: injected.size,
        deltaOff: deltaOff.delta,
        deltaOn: deltaOn.delta,
        alignedPairsOff: deltaOff.alignedPairs,
        alignedPairsOn: deltaOn.alignedPairs,
        fixedDeltaOff: fixedOff,
        fixedDeltaOn: fixedOn,
      });
    }

    const rateDeltaOff = mean(pools.map((r) => r.deltaOff));
    const rateDeltaOn = mean(pools.map((r) => r.deltaOn));
    const endToEndReduction = rateDeltaOff < M11_MIN_DELTA_OFF ? null : 1 - rateDeltaOn / rateDeltaOff;
    const fixedOffMean = mean(pools.map((r) => r.fixedDeltaOff));
    const fixedOnMean = mean(pools.map((r) => r.fixedDeltaOn));
    const varOff = variance(rateOffValues);
    const varOn = variance(rateOnValues);
    // Realized no-information variance reduction (the durable stabilization).
    const stabilization = varOff > 1e-6 ? 1 - varOn / varOff : null;
    m11Sweep.push({
      rate,
      meanDeltaOff: rateDeltaOff,
      meanDeltaOn: rateDeltaOn,
      endToEndReduction,
      fixedDeltaOff: fixedOffMean,
      fixedDeltaOn: fixedOnMean,
      reduction: stabilization,
      pools,
    });

    if (isSmoke) {
      for (const { pool, injected } of perPoolInjected) {
        for (let i = 0; i < pool.members.length; i++) {
          if (!injected.has(i)) continue;
          const adv = sessions.get(pool.members[i].respondent, 'adv-off');
          for (const t of ALL_TRAITS) smokeInjectedConfidences.push(adv.traitConfidences[t]);
        }
      }
    }
  }

  const smokeSweep = m11Sweep.find((s) => Math.abs(s.rate - M11_SMOKE_RATE) < 1e-9)!;
  const m11PoolResults = smokeSweep.pools;
  const meanDeltaOff = smokeSweep.meanDeltaOff;
  const meanDeltaOn = smokeSweep.meanDeltaOn;
  // Legacy end-to-end reduction (the retired ≥50% metric); the durable
  // contract's stabilization is `smokeSweep.reduction` (variance reduction).
  const m11Reduction = meanDeltaOff < M11_MIN_DELTA_OFF ? null : 1 - meanDeltaOn / meanDeltaOff;
  // Legacy ≥50% verdict — retained for history/observability only; the gate
  // uses the durable contract below.
  const m11Pass = m11Reduction === null ? null : m11Reduction >= M11_REDUCTION_TARGET;
  // Population's empirical no-information baseline E|true − 50|: the
  // population-specific half of the durable ceiling (the curve supplies the
  // shrinkable error). Auto-updates with the mixture.
  const populationPriorError =
    respondents.reduce(
      (sum, r) => sum + ALL_TRAITS.reduce((ss, t) => ss + Math.abs(r.trueTraits[t] - 50), 0),
      0
    ) /
    (respondents.length * ALL_TRAITS.length);
  const m11Durable = evaluateM11DurableContract({
    fit: FITTED_CONFIDENCE_CALIBRATION,
    injectedConfidences: smokeInjectedConfidences,
    sweep: m11Sweep.map((s) => ({
      rate: s.rate,
      meanDeltaOff: s.meanDeltaOff,
      meanDeltaOn: s.meanDeltaOn,
      reduction: s.reduction,
    })),
  });

  // 5. Aggregates
  const baseline = aggregateArm('flags-off', offRuns);
  const flagsOn = aggregateArm('flags-on', onRuns);

  // Item 5 gate-on aggregate + LOCKED M9/M10 verdicts (gate-on runs only).
  const M9_TARGET = 0.95;
  const M10_MAX_DELTA_PP = 2;
  const gateArm = compositionGates ? aggregateGateArm(gatedRuns, gatedResults, gateStatsTotal) : null;
  // Item 10 AC-10.5: derived-on vs off group-formation impact.
  const derivedArm = derivedChemistry ? aggregateDerivedArm(derivedRuns, offResults, derivedResults) : null;
  const m9Pass = gateArm ? gateArm.allGatesPassRate >= M9_TARGET : null;
  const m10DeltaPp = gateArm ? (gateArm.unmatchedRate.mean - baseline.unmatchedRate.mean) * 100 : null;
  const m10Pass = m10DeltaPp !== null ? m10DeltaPp <= M10_MAX_DELTA_PP : null;

  const runtimeSec = (Date.now() - startedAt) / 1000;
  const dateStr = new Date().toISOString().slice(0, 10);

  const report = buildReport({
    dateStr,
    seed,
    poolCount: measuredPools.length,
    m11PoolCount: m11Measured.length,
    populationSize: population,
    respondents,
    baseline,
    flagsOn,
    m11: {
      pools: m11PoolResults,
      meanDeltaOff,
      meanDeltaOn,
      reduction: m11Reduction,
      pass: m11Pass,
      sweep: m11Sweep,
      durable: m11Durable,
    },
    gateArm: gateArm && m9Pass !== null && m10DeltaPp !== null && m10Pass !== null
      ? {
          agg: gateArm,
          m9Pass,
          m9Target: M9_TARGET,
          m10DeltaPp,
          m10Pass,
          m10MaxDeltaPp: M10_MAX_DELTA_PP,
          baselineXVarAtShippedCap: (() => {
            const baseGroups = offRuns.flatMap((r) => r.groups);
            return baseGroups.length === 0
              ? 0
              : baseGroups.filter((gr) => gr.xVariance > COMPOSITION_X_VARIANCE_CAP).length / baseGroups.length;
          })(),
        }
      : null,
    derivedArm,
    invariantFailures,
    runtimeSec,
    sessionCount: sessions.size,
    onlyPool,
  });

  // Gate-on runs default to -gates-on suffixed paths so the LOCKED baseline
  // artifacts (report + JSON) are never clobbered; gate-off default runs
  // keep the original paths and must diff-clean against them (AC-5.5).
  // Non-default arms suffix their artifacts so the flag-off baseline is never
  // clobbered (default run → empty suffix → byte-identical paths/content).
  const modeSuffix = `${compositionGates ? '-gates-on' : ''}${derivedChemistry ? '-derived-on' : ''}`;
  const defaultOutName = `${dateStr}-monte-carlo-group-formation${modeSuffix}.md`;
  const outPath = outFile
    ? path.resolve(outFile)
    : path.join(__dirname, '..', '..', 'docs', 'reports', defaultOutName);
  fs.mkdirSync(path.dirname(outPath), { recursive: true });
  fs.writeFileSync(outPath, report, 'utf8');

  const jsonPath = jsonOutFile
    ? path.resolve(jsonOutFile)
    : path.join(__dirname, 'data', `group-monte-carlo${modeSuffix}-latest.json`);
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  const json: Record<string, unknown> = {
    generatedAt: dateStr,
    seed,
    poolCount: measuredPools.length,
    m11PoolCount: m11Measured.length,
    populationSize: population,
    provisionalThresholds: {
      stabilityFloorMinE: PROV_STABILITY_FLOOR_MIN_E,
      meanAFloor: PROV_MEAN_A_FLOOR,
      sparkTraitThreshold: PROV_SPARK_TRAIT_THRESHOLD,
      xVarianceCap: PROV_X_VARIANCE_CAP,
      cloneMinMaxDistance: PROV_CLONE_MIN_MAX_DISTANCE,
    },
    baseline: summarizeArm(baseline),
    flagsOn: summarizeArm(flagsOn),
    m11: {
      // Legacy ≥50% fields (retained for history; the gate ignores them).
      meanDeltaOff: round6(meanDeltaOff),
      meanDeltaOn: round6(meanDeltaOn),
      reduction: m11Reduction === null ? null : round6(m11Reduction),
      target: M11_REDUCTION_TARGET,
      pass: m11Pass,
      pools: m11PoolResults.map((p) => ({ ...p, deltaOff: round6(p.deltaOff), deltaOn: round6(p.deltaOn) })),
      // P3 durable contract (the actual gate) + injection-rate sweep.
      sweep: m11Sweep.map((s) => ({
        rate: s.rate,
        poolCount: s.pools.length,
        meanDeltaOff: round6(s.meanDeltaOff),
        meanDeltaOn: round6(s.meanDeltaOn),
        endToEndReduction: s.endToEndReduction === null ? null : round6(s.endToEndReduction),
        fixedDeltaOff: round6(s.fixedDeltaOff),
        fixedDeltaOn: round6(s.fixedDeltaOn),
        reduction: s.reduction === null ? null : round6(s.reduction),
      })),
      durable: {
        pass: m11Durable.pass,
        boundedErrorPass: m11Durable.boundedErrorPass,
        groupStabilizationPass: m11Durable.groupStabilizationPass,
        smokeAlarmPass: m11Durable.smokeAlarmPass,
        envelopePass: m11Durable.envelopePass,
        boundedError: {
          priorError: round6(m11Durable.boundedError.priorError),
          maxRatio: round6(m11Durable.boundedError.maxRatio),
          maxRatioConfidence: round6(m11Durable.boundedError.maxRatioConfidence),
          noInfoCeiling: round6(m11Durable.boundedError.noInfoCeiling),
          optimalNoInfoCeiling: round6(m11Durable.boundedError.optimalNoInfoCeiling),
        },
        ceiling: round6(m11Durable.ceiling),
        achieved: round6(m11Durable.achieved),
        ceilingFractionAchieved: round6(m11Durable.ceilingFractionAchieved),
        populationPriorError: round6(populationPriorError),
        ceilingFraction: M11_CEILING_FRACTION,
        smokeRate: M11_SMOKE_RATE,
        smokeMaxDelta: M11_SMOKE_ALARM_MAX_DELTA,
        injectionRates: [...M11_INJECTION_RATES],
        injectedConfidenceSamples: smokeInjectedConfidences.length,
        meanInjectedConfidence: smokeInjectedConfidences.length > 0 ? round6(mean(smokeInjectedConfidences)) : null,
      },
    },
    invariantFailures,
  };
  // Item 5 gate-on payload — added ONLY in gate-on mode so the gate-off
  // artifact stays byte-identical against the locked baseline JSON (AC-5.5).
  if (gateArm) {
    json.compositionGates = {
      constants: {
        minEFloor: COMPOSITION_MIN_E_FLOOR,
        meanAFloor: COMPOSITION_MEAN_A_FLOOR,
        sparkTraitThreshold: COMPOSITION_SPARK_TRAIT_THRESHOLD,
        xVarianceCap: COMPOSITION_X_VARIANCE_CAP,
      },
      allGatesPassRate: round6(gateArm.allGatesPassRate),
      m9: { target: M9_TARGET, pass: m9Pass },
      unmatchedRate: summarizeDist(gateArm.unmatchedRate),
      m10: { deltaPp: round6(m10DeltaPp!), maxDeltaPp: M10_MAX_DELTA_PP, pass: m10Pass },
      perGate: gateArm.perGate,
      sparkDistribution: {
        zero: round6(gateArm.sparkDistribution.zero),
        one: round6(gateArm.sparkDistribution.one),
        twoPlus: round6(gateArm.sparkDistribution.twoPlus),
      },
      rawViolationRates: {
        minE: round6(gateArm.rawViolationRates.minE),
        meanA: round6(gateArm.rawViolationRates.meanA),
        xVariance: round6(gateArm.rawViolationRates.xVariance),
        sparkNotExactlyOne: round6(gateArm.rawViolationRates.sparkNotExactlyOne),
      },
      exemptPools: gateArm.exemptPools,
      unmatchedTraitDeltas: gateArm.unmatchedTraitDeltas,
      baselineXVarAtShippedCap: round6((() => {
        const baseGroups = offRuns.flatMap((r) => r.groups);
        return baseGroups.length === 0
          ? 0
          : baseGroups.filter((gr) => gr.xVariance > COMPOSITION_X_VARIANCE_CAP).length / baseGroups.length;
      })()),
      commitRejections: gateArm.commitRejections,
      redistributionRejections: gateArm.redistributionRejections,
    };
  }
  // Item 10 AC-10.5 payload — added ONLY in derived-chemistry mode so the
  // flag-off artifact stays byte-identical.
  if (derivedArm) {
    json.derivedChemistry = {
      arm: derivedArm.arm,
      comparison: {
        groupCount: derivedArm.groupCount,
        baselineGroupCount: baseline.groupCount,
        meanChemistryScore: round6(derivedArm.meanChemistryScore),
        offMeanChemistryScore: round6(derivedArm.offMeanChemistryScore),
        meanPairScore: round6(derivedArm.meanPairScore),
        offMeanPairScore: round6(derivedArm.offMeanPairScore),
        coMembershipAgreement: round6(derivedArm.coMembershipAgreement),
        poolsWithMembershipChange: round6(derivedArm.poolsWithMembershipChange),
      },
      composition: summarizeArm(derivedArm.composition),
    };
  }
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');

  // ── Console summary ──
  console.log('🎲 Monte Carlo Group-Formation Harness');
  console.log(`   pools=${measuredPools.length}  m11Pools=${m11Measured.length}  population=${population}  seed=${seed}  runtime=${runtimeSec.toFixed(1)}s  sessions=${sessions.size}`);
  console.log('');
  console.log(`   [flags-off] groups=${baseline.groupCount}  min-E mean=${f2(baseline.minE.mean)} (viol ${pct(baseline.stabilityFloorViolationRate)})  mean-A mean=${f2(baseline.meanA.mean)} (viol ${pct(baseline.meanAFloorViolationRate)})`);
  console.log(`   [flags-off] sparks 0/1/2+: ${pct(baseline.sparkDistribution.zero)} / ${pct(baseline.sparkDistribution.one)} / ${pct(baseline.sparkDistribution.twoPlus)}  X-var viol=${pct(baseline.xVarianceCapViolationRate)}  clone=${pct(baseline.cloneGroupRate)}  unmatched=${pct(baseline.unmatchedRate.mean)}`);
  console.log(`   [flags-on ] groups=${flagsOn.groupCount}  min-E viol=${pct(flagsOn.stabilityFloorViolationRate)}  mean-A viol=${pct(flagsOn.meanAFloorViolationRate)}  clone=${pct(flagsOn.cloneGroupRate)}  unmatched=${pct(flagsOn.unmatchedRate.mean)} (Δ ${unmatchedDeltaPpInline(baseline, flagsOn)}pp)`);
  if (gateArm) {
    console.log(`   [gates-on ] groups=${gateArm.groupCount}  sparks 0/1/2+: ${pct(gateArm.sparkDistribution.zero)} / ${pct(gateArm.sparkDistribution.one)} / ${pct(gateArm.sparkDistribution.twoPlus)}  unmatched=${pct(gateArm.unmatchedRate.mean)}`);
    console.log(`   [M9] all-gates pass=${pct(gateArm.allGatesPassRate)}  target ≥ ${pct(M9_TARGET)}  ${m9Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   [M10] unmatched Δ=${m10DeltaPp! >= 0 ? '+' : ''}${m10DeltaPp!.toFixed(2)}pp  target ≤ +${M10_MAX_DELTA_PP}pp  ${m10Pass ? '✅ PASS' : '❌ FAIL'}`);
    console.log(`   [gates] commit rejections: min-E=${gateArm.commitRejections.minEFloor} mean-A=${gateArm.commitRejections.meanAFloor} spark=${gateArm.commitRejections.sparkRule} X-var=${gateArm.commitRejections.xVarianceCap} noIsolate=${gateArm.commitRejections.noIsolate} energizer=${gateArm.commitRejections.energizer} (total ${gateArm.commitRejections.total})`);
  }
  if (derivedArm) {
    console.log(`   [derived ] groups=${derivedArm.groupCount}  chemistry ${f2(derivedArm.offMeanChemistryScore)}→${f2(derivedArm.meanChemistryScore)}  agreement=${pct(derivedArm.coMembershipAgreement)}  pools-changed=${pct(derivedArm.poolsWithMembershipChange)}`);
  }
  console.log(
    `   [M11 sweep] ${m11Sweep.map((s) => `${pct(s.rate)}→Δoff ${f3(s.meanDeltaOff)}${s.reduction === null ? '/n-a' : `/${pct(s.reduction)}`}`).join('  ')}`
  );
  console.log(
    `   [M11 durable] ${m11Durable.pass ? '✅ PASS' : '❌ FAIL'}  boundedErr=${f3(m11Durable.boundedError.maxRatio)} (${m11Durable.boundedErrorPass ? 'ok' : 'FAIL'})  stab=${pct(m11Durable.achieved)}/${pct(m11Durable.ceiling)} (${pct(m11Durable.ceilingFractionAchieved)}, ${m11Durable.groupStabilizationPass ? 'ok' : 'FAIL'})  smoke=${m11Durable.smokeAlarmPass ? 'ok' : 'FAIL'}  envelope=${m11Durable.envelopePass ? 'ok' : 'FAIL'}`
  );
  console.log(
    `   [M11 legacy] 20% reduction=${m11Reduction === null ? 'n/a' : pct(m11Reduction)} vs retired ${pct(M11_REDUCTION_TARGET)} target → ${m11Pass ? 'PASS' : 'FAIL'} (informational)`
  );
  console.log(`   [invariants] ${invariantFailures.length === 0 ? '✅ all pass' : `❌ ${invariantFailures.length} failures`}`);
  console.log('');
  console.log(`💾 Report: ${outPath}`);
  console.log(`   JSON:    ${jsonPath}`);

  // ── Exit code ──
  const hardFailures: string[] = [];
  if (invariantFailures.length > 0) {
    for (const f of invariantFailures.slice(0, 10)) {
      hardFailures.push(`${f.kind} pool#${f.poolIndex} (pool seed ${f.poolSeed}, base seed ${seed}) arm=${f.arm}: ${f.detail}`);
    }
  }
  // M11 durable contract (P3-reformulated) is the locked group-level target:
  // verdicted in every mode, hard-failing only in --mode=gated (baseline must
  // exit 0). The legacy ≥50% verdict above is informational only.
  if (mode === 'gated' && !m11Durable.pass) {
    const worst = [...m11PoolResults].sort((a, b) => b.deltaOn - a.deltaOn).slice(0, 3);
    hardFailures.push(
      `M11 durable contract failed: boundedError=${m11Durable.boundedErrorPass} groupStabilization=${m11Durable.groupStabilizationPass} ` +
        `smokeAlarm=${m11Durable.smokeAlarmPass} envelope=${m11Durable.envelopePass} ` +
        `(achieved ${pct(m11Durable.achieved)} vs ceiling ${pct(m11Durable.ceiling)}; bound ratio ${f3(m11Durable.boundedError.maxRatio)}). ` +
        `Worst pools: ${worst.map((p) => `#${p.poolIndex} (pool seed ${p.poolSeed}, base seed ${seed}, Δon=${f3(p.deltaOn)})`).join('; ')}. ` +
        `Replay: --seed=${seed} --only-pool=<index>`
    );
  }
  // M9/M10 (LOCKED by sprint-contract.item5-composition-rules): hard-fail only
  // when the gate-on arm actually ran in gated mode; otherwise the console
  // verdict lines above carry the result for calibration iteration.
  if (mode === 'gated' && compositionGates && gateArm) {
    if (m9Pass === false) {
      hardFailures.push(
        `M9 all-gates pass ${pct(gateArm.allGatesPassRate)} below locked target ${pct(M9_TARGET)} ` +
          `(seed ${seed}). Per-gate: min-E ${gateArm.perGate.minE.pass}/${gateArm.perGate.minE.evaluated}, ` +
          `mean-A ${gateArm.perGate.meanA.pass}/${gateArm.perGate.meanA.evaluated}, ` +
          `sparkMin ${gateArm.perGate.sparkMin.pass}/${gateArm.perGate.sparkMin.evaluated}, ` +
          `sparkMax ${gateArm.perGate.sparkMax.pass}/${gateArm.perGate.sparkMax.evaluated}, ` +
          `X-var ${gateArm.perGate.xVariance.pass}/${gateArm.perGate.xVariance.evaluated}.`
      );
    }
    if (m10Pass === false) {
      hardFailures.push(
        `M10 unmatched-rate delta +${m10DeltaPp!.toFixed(2)}pp exceeds locked budget +${M10_MAX_DELTA_PP}pp ` +
          `(${pct(baseline.unmatchedRate.mean)} → ${pct(gateArm.unmatchedRate.mean)}, seed ${seed}).`
      );
    }
  }
  if (!m11Durable.pass) {
    // Always surface the failing durable verdict + worst pools, even when not
    // exit-gating in baseline mode.
    const worst = [...m11PoolResults].sort((a, b) => b.deltaOn - a.deltaOn).slice(0, 3);
    console.log('');
    console.log(`   [M11 durable] ❌ FAIL (reported; non-blocking in baseline mode). Worst pools:`);
    for (const p of worst) {
      console.log(`     pool #${p.poolIndex}: --seed=${seed} --only-pool=${p.poolIndex} (pool seed ${p.poolSeed}, Δoff=${f3(p.deltaOff)}, Δon=${f3(p.deltaOn)})`);
    }
  }
  if (hardFailures.length > 0) {
    console.error('');
    console.error('❌ HARD assertion failures (replay seeds printed):');
    for (const line of hardFailures) console.error(`   - ${line}`);
    process.exit(1);
  }
}

function unmatchedDeltaPpInline(baseline: ArmAggregate, flagsOn: ArmAggregate): string {
  const d = (flagsOn.unmatchedRate.mean - baseline.unmatchedRate.mean) * 100;
  return `${d >= 0 ? '+' : ''}${d.toFixed(1)}`;
}

main().catch((err) => {
  console.error('❌ Harness crashed:', err);
  process.exit(1);
});
