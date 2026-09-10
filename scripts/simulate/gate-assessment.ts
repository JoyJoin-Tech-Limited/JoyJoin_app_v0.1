#!/usr/bin/env node
/**
 * Assessment instrument CI gate (P3, sprint-contract.p3-ci-gate-wiring).
 *
 * Parses the COMMITTED artifacts produced by the Item 6–12 instruments and
 * enforces the LOCKED plan §(f) thresholds. Deterministic and offline: it
 * never runs a harness (the recovery `--json` fields, not the markdown verdict
 * lines — `buildVerdicts` predates the amended M2/M3 definitions).
 *
 * Three-state honesty model (AC-P3.6):
 *   PASS        — metric meets its locked threshold.
 *   KNOWN-FAIL  — metric fails, is dispositioned, and was ALREADY failing in
 *                 the committed baseline (never CI-breaking).
 *   REGRESSION  — metric passed in the committed baseline and now fails
 *                 (the ONLY condition that exits non-zero).
 *
 * Baseline: `scripts/simulate/data/assessment-gate-baseline.json`. Regenerate
 * with `--update-baseline` after a threshold/engine change is understood. The
 * mechanism is documented in `docs/reports/`; only metric STATUSES live in the
 * baseline (the measured values always come from the current artifacts).
 *
 * Usage:
 *   npm run gate:assessment
 *   tsx scripts/simulate/gate-assessment.ts --json=/tmp/gate.json
 *   tsx scripts/simulate/gate-assessment.ts --update-baseline
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  expectedTraitAbsError,
  FITTED_CONFIDENCE_CALIBRATION,
  CALIBRATION_VERSION,
} from '../../packages/shared/src/personality/confidenceCalibration';
import { getAllArchetypeIds } from '../../packages/shared/src/personality/archetypeRegistry';
import {
  computeM11BoundedError,
  M11_CEILING_FRACTION,
  M11_SMOKE_ALARM_MAX_DELTA,
  M11_SMOKE_RATE,
  M11_ENVELOPE_SLACK,
} from './lib/m11-durable-contract';
import { runMatcherIsolation, type Persona } from './lib/persona-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');
const BASELINE_PATH = path.join(DATA_DIR, 'assessment-gate-baseline.json');

const TRAITS = ['A', 'C', 'E', 'O', 'X', 'P'] as const;
type Trait = (typeof TRAITS)[number];

/**
 * LOCKED thresholds (plan §(f) / sprint-contract AC-P3.2). Named constants —
 * never duplicated literals elsewhere in this script.
 */
const LOCKED = {
  M1: { r16Min: 0.7 },
  M2: { r8Min: 0.5, r12Min: 0.6, maxDegradation: 0.03 },
  M3: { centroidTop1Min: 0.85, generalCleanMin: 0.4, generalModerateMin: 0.207 },
  M6: { minSessions: 1000 },
  M8: { uniformMaxBreaches: 0 },
  M9: { passMin: 0.95 },
  M10: { maxDeltaPp: 2 },
  M13: { centroidIsolation: 12, maxAdaptiveLength: 16 },
  M14: { rEPMin: 0.7, eSamplesMin: 9, maxBaselineDrop: 0.03, naturalLengthMean: 12.6, naturalLengthTolerance: 0.5 },
  M15: { tolerance: 0.1, minPerBin: 50 },
} as const;

/** Post-Item-11 locked clean-arm 16q baselines (M14 no-regression reference). */
const M14_LOCKED_BASELINE_R16: Record<Trait, number> = {
  A: 0.809,
  C: 0.706,
  E: 0.763,
  O: 0.767,
  X: 0.865,
  P: 0.73,
};

type Status = 'PASS' | 'KNOWN-FAIL' | 'REGRESSION';

interface MetricResult {
  id: string;
  label: string;
  measured: string;
  threshold: string;
  pass: boolean;
  evidence: string;
  disposition?: string;
}

// ── Artifact loading ─────────────────────────────────────────────────

function loadJson<T = any>(name: string): T {
  const p = path.join(DATA_DIR, name);
  if (!fs.existsSync(p)) {
    throw new Error(`Missing committed artifact: ${path.relative(process.cwd(), p)}. Regenerate with the matching simulate:* script.`);
  }
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

// ── Metric evaluators ────────────────────────────────────────────────

function evalM1(recovery: any): MetricResult {
  const clean = recovery.arms.find((a: any) => a.noise === 'clean');
  const r16 = clean.checkpoints['16'].pearsonByTrait as Record<Trait, number>;
  const fails = TRAITS.filter((t) => r16[t] < LOCKED.M1.r16Min);
  return {
    id: 'M1',
    label: 'Recovery r ≥ 0.70 @16q (clean, all traits)',
    measured: `min ${Math.min(...TRAITS.map((t) => r16[t])).toFixed(3)} (${fails.length} below)`,
    threshold: `all six ≥ ${LOCKED.M1.r16Min}`,
    pass: fails.length === 0,
    evidence: 'recovery-results-latest.json clean @16q',
  };
}

function evalM2(recovery: any): MetricResult {
  const clean = recovery.arms.find((a: any) => a.noise === 'clean');
  const cp = clean.checkpoints;
  const below8 = TRAITS.filter((t) => cp['8'].pearsonByTrait[t] < LOCKED.M2.r8Min);
  const below12 = TRAITS.filter((t) => cp['12'].pearsonByTrait[t] < LOCKED.M2.r12Min);
  // "no degradation > 0.03": no checkpoint may fall > 0.03 below the 8q
  // short-test floor (the amended M2 relaxes naive monotonicity to real
  // degradations; a mid-run dip that net-recovers at 16q is not a degradation
  // below the shorter test).
  const degraded = TRAITS.filter(
    (t) =>
      cp['8'].pearsonByTrait[t] - cp['12'].pearsonByTrait[t] > LOCKED.M2.maxDegradation + 1e-9 ||
      cp['8'].pearsonByTrait[t] - cp['16'].pearsonByTrait[t] > LOCKED.M2.maxDegradation + 1e-9
  );
  return {
    id: 'M2',
    label: 'Recovery floors @8q/12q + no >0.03 degradation',
    measured: `below8:${below8.join(',') || 'none'} below12:${below12.join(',') || 'none'} degraded:${degraded.join(',') || 'none'}`,
    threshold: `r@8 ≥ ${LOCKED.M2.r8Min}, r@12 ≥ ${LOCKED.M2.r12Min}, drop ≤ ${LOCKED.M2.maxDegradation}`,
    pass: below8.length === 0 && below12.length === 0 && degraded.length === 0,
    evidence: 'recovery-results-latest.json clean checkpoints',
  };
}

function evalM3(recovery: any): MetricResult {
  const clean = recovery.arms.find((a: any) => a.noise === 'clean');
  const moderate = recovery.arms.find((a: any) => a.noise === 'moderate');
  const centroid = clean.checkpoints['16'].top1AgreementBySource.centroid_mixture as number;
  const generalClean = clean.checkpoints['16'].top1AgreementBySource.general as number;
  const generalModerate = moderate ? (moderate.checkpoints['16'].top1AgreementBySource.general as number) : 0;
  const pass =
    centroid >= LOCKED.M3.centroidTop1Min &&
    generalClean >= LOCKED.M3.generalCleanMin &&
    generalModerate >= LOCKED.M3.generalModerateMin;
  return {
    id: 'M3',
    label: 'Centroid-mixture top-1 ≥ 85% + general-pop no-regression',
    measured: `centroid ${(centroid * 100).toFixed(1)}%, general clean ${(generalClean * 100).toFixed(1)}% / moderate ${(generalModerate * 100).toFixed(1)}%`,
    threshold: `centroid ≥ ${LOCKED.M3.centroidTop1Min * 100}%, general ≥ ${LOCKED.M3.generalCleanMin * 100}% / ${LOCKED.M3.generalModerateMin * 100}%`,
    pass,
    evidence: 'recovery-results-latest.json clean/moderate @16q',
    disposition:
      'Structural (Item 6 post-P1a audit): the 85% centroid-mixture bar predates the stratified-reachability finding — σ=10 centroid respondents have inherently unstable true labels (their true nearest centroid flips under the mixture). Item 11 improved centroid top-1 53.0%→54.3%; general-pop clean (38.5%) sits just under the 40.0% floor. Not CI-breaking until the threshold is re-locked.',
  };
}

function evalM6(adversarial: any): MetricResult {
  const byId = new Map<string, any>((adversarial.assertions ?? []).map((a: any) => [a.id, a]));
  const a = byId.get('AC-7.2a');
  const b = byId.get('AC-7.2b');
  const sessions = adversarial.totalSessions ?? 0;
  const pass = Boolean(a?.pass) && Boolean(b?.pass) && sessions >= LOCKED.M6.minSessions;
  return {
    id: 'M6',
    label: 'Adversarial 0 crashes / 0 NaN',
    measured: `${a?.measured ?? 'n/a'}; ${b?.measured ?? 'n/a'}; sessions ${sessions}`,
    threshold: `0 crashes + 0 NaN, ≥ ${LOCKED.M6.minSessions} sessions`,
    pass,
    evidence: 'adversarial-results-latest.json assertions',
  };
}

function evalM8(boundary: any): MetricResult {
  const breaches = boundary.breachingCells ?? [];
  const uniformCells = (boundary.grid ?? []).filter((c: any) => c.lockedGate).length;
  return {
    id: 'M8',
    label: 'Boundary flip ≤5% @±5 ∧ ≤20% @±10 (uniform gate arm)',
    measured: `${breaches.length}/${uniformCells} uniform cells breach`,
    threshold: `≤ ${LOCKED.M8.uniformMaxBreaches} breaches`,
    pass: breaches.length === LOCKED.M8.uniformMaxBreaches,
    evidence: 'boundary-sweep-latest.json breachingCells',
    disposition:
      'Tier 3 centroid/gate work: hamster_praise→rooster (unregistered, redraw); dolphin_calm→rooster/spider (registered persistent confusion gates). Item 8 baseline locked RED 3/24.',
  };
}

function evalM9M10(gates: any): { m9: MetricResult; m10: MetricResult } {
  const cg = gates.compositionGates ?? {};
  const m9Pass = cg.m9?.pass === true && (cg.allGatesPassRate ?? 0) >= LOCKED.M9.passMin;
  const m10Pass = cg.m10?.pass === true && (cg.m10?.deltaPp ?? Infinity) <= LOCKED.M10.maxDeltaPp;
  return {
    m9: {
      id: 'M9',
      label: 'Composition-rule satisfaction ≥95%',
      measured: `${((cg.allGatesPassRate ?? 0) * 100).toFixed(1)}% of ${gates.poolCount ?? '?'} pools`,
      threshold: `≥ ${LOCKED.M9.passMin * 100}%`,
      pass: m9Pass,
      evidence: 'group-monte-carlo-gates-on-latest.json compositionGates',
    },
    m10: {
      id: 'M10',
      label: 'Unmatched-rate delta ≤ +2pp vs gate-off',
      measured: `${(cg.m10?.deltaPp ?? 0) >= 0 ? '+' : ''}${(cg.m10?.deltaPp ?? 0).toFixed(2)}pp`,
      threshold: `≤ +${LOCKED.M10.maxDeltaPp}pp`,
      pass: m10Pass,
      evidence: 'group-monte-carlo-gates-on-latest.json compositionGates',
    },
  };
}

function evalM11(group: any): MetricResult {
  const durable = group.m11?.durable;
  if (!durable) {
    throw new Error('group-monte-carlo-latest.json is missing m11.durable (regenerate with simulate:groups).');
  }
  const sweep: any[] = group.m11.sweep ?? [];
  const smoke = sweep.find((s) => Math.abs(s.rate - M11_SMOKE_RATE) < 1e-9);
  // Re-derive part (a) from the Item 12 curve (helper), and re-check parts
  // (b)/smoke/envelope from the committed artifact.
  const bounded = computeM11BoundedError(FITTED_CONFIDENCE_CALIBRATION);
  const boundedPass = bounded.maxRatio <= 1 + 1e-9;
  const ceiling = durable.ceiling as number;
  const achieved = durable.achieved as number;
  const stabilizationPass = achieved >= M11_CEILING_FRACTION * ceiling - 1e-9;
  const smokePass = smoke !== undefined && (smoke.meanDeltaOff as number) <= M11_SMOKE_ALARM_MAX_DELTA;
  const envelopePass = sweep.every((s) => s.reduction === null || (s.reduction as number) >= -M11_ENVELOPE_SLACK);
  const pass = boundedPass && stabilizationPass && smokePass && envelopePass;
  return {
    id: 'M11',
    label: 'Shrinkage durable contract (bounded error + ceiling-normalized stabilization + smoke + sweep)',
    measured: `bound ${bounded.maxRatio.toFixed(3)}; stab ${(achieved * 100).toFixed(1)}%/${(ceiling * 100).toFixed(1)}% (${(durable.ceilingFractionAchieved * 100).toFixed(0)}%); smoke Δoff ${smoke ? (smoke.meanDeltaOff as number).toFixed(2) : 'n/a'}; envelope ${envelopePass ? 'ok' : 'FAIL'}`,
    threshold: `bound ≤1; stab ≥ ${M11_CEILING_FRACTION * 100}% of ceiling; Δoff ≤ ${M11_SMOKE_ALARM_MAX_DELTA}; sweep ≥ -${M11_ENVELOPE_SLACK}`,
    pass,
    evidence: 'group-monte-carlo-latest.json m11.durable + m11.sweep; Item 12 curve',
  };
}

function evalM12(derived: any): MetricResult {
  const pass = derived.gate?.pass === true && (derived.spearman ?? 0) >= 0.7;
  return {
    id: 'M12',
    label: 'Chemistry matrix validity ρ ≥ 0.7 (derived vs authored)',
    measured: `ρ = ${(derived.spearman ?? 0).toFixed(2)} (best achievable ${(derived.bestSensitivity ?? 0).toFixed(2)})`,
    threshold: `ρ ≥ 0.7`,
    pass,
    evidence: 'derived-chemistry-latest.json gate',
    disposition:
      'Curated-matrix finding (Item 10): the authored matrix encodes X/P complementarity but no A/E/C similarity signal; the contract-faithful family ceiling is ≈0.69. Derived chemistry ships dark.',
  };
}

function evalM13(boundary: any, recovery: any): MetricResult {
  // (1) roster order frozen.
  const expectedOrder = getAllArchetypeIds();
  const artifactOrder: string[] = boundary.rosterOrder ?? [];
  const rosterOk = JSON.stringify(artifactOrder) === JSON.stringify(expectedOrder);
  // (2) centroid isolation 12/12, deterministic in-process.
  const personasPath = path.join(DATA_DIR, 'all-personas.json');
  const personas = JSON.parse(fs.readFileSync(personasPath, 'utf8')) as Persona[];
  const centroids = personas.filter((p) => p.category === 'centroid');
  const exact = centroids.filter((p) => runMatcherIsolation(p).isExactMatch).length;
  const isolationOk = exact === LOCKED.M13.centroidIsolation && centroids.length === LOCKED.M13.centroidIsolation;
  // (3) adaptive session length bounded.
  const clean = recovery.arms.find((a: any) => a.noise === 'clean');
  const maxLen = clean.natural.lengthMax as number;
  const lengthOk = maxLen <= LOCKED.M13.maxAdaptiveLength;
  return {
    id: 'M13',
    label: 'Regression invariants (run:ci 12/12, roster order, ≤16 adaptive)',
    measured: `isolation ${exact}/${LOCKED.M13.centroidIsolation}; roster ${rosterOk ? 'ok' : 'REORDERED'}; max length ${maxLen}q`,
    threshold: `isolation = ${LOCKED.M13.centroidIsolation}, roster frozen, length ≤ ${LOCKED.M13.maxAdaptiveLength}`,
    pass: rosterOk && isolationOk && lengthOk,
    evidence: 'boundary-sweep-latest.json rosterOrder; all-personas.json isolation; recovery JSON natural length',
  };
}

function evalM14(recovery: any): MetricResult {
  const clean = recovery.arms.find((a: any) => a.noise === 'clean');
  const r16 = clean.checkpoints['16'].pearsonByTrait as Record<Trait, number>;
  const eSamples = clean.checkpoints['16'].meanSampleCountByTrait.E as number;
  const belowBaseline = TRAITS.filter(
    (t) => r16[t] < M14_LOCKED_BASELINE_R16[t] - LOCKED.M14.maxBaselineDrop - 1e-9
  );
  const lengthOk =
    Math.abs(clean.natural.lengthMean - LOCKED.M14.naturalLengthMean) <= LOCKED.M14.naturalLengthTolerance;
  const pass =
    r16.E >= LOCKED.M14.rEPMin &&
    r16.P >= LOCKED.M14.rEPMin &&
    eSamples >= LOCKED.M14.eSamplesMin &&
    belowBaseline.length === 0 &&
    lengthOk;
  return {
    id: 'M14',
    label: 'E/P bank uplift + no-regression + length band',
    measured: `r(E)=${r16.E.toFixed(3)} r(P)=${r16.P.toFixed(3)}, E samples ${eSamples.toFixed(1)}, length ${clean.natural.lengthMean.toFixed(1)}q, below-baseline ${belowBaseline.join(',') || 'none'}`,
    threshold: `r(E),r(P) ≥ ${LOCKED.M14.rEPMin}; E samples ≥ ${LOCKED.M14.eSamplesMin}; drop ≤ ${LOCKED.M14.maxBaselineDrop}; length ${LOCKED.M14.naturalLengthMean}±${LOCKED.M14.naturalLengthTolerance}`,
    pass,
    evidence: 'recovery-results-latest.json clean arm',
  };
}

function evalM15(calibration: any): MetricResult {
  const m15 = calibration.m15 ?? {};
  const tolerance = m15.tolerance ?? LOCKED.M15.tolerance;
  const minPerBin = m15.minPerBin ?? LOCKED.M15.minPerBin;
  const evaluated = (m15.bins ?? []).filter((b: any) => b.n >= minPerBin);
  const bad = evaluated.filter((b: any) => b.absGap > tolerance + 1e-9);
  const pass = m15.pass === true && bad.length === 0 && calibration.calibrationVersion === CALIBRATION_VERSION;
  return {
    id: 'M15',
    label: 'Confidence calibration reliability check (per-bin |gap| ≤ 0.10, n ≥ 50)',
    measured: `${evaluated.length} bins evaluated, ${bad.length} fail; version ${calibration.calibrationVersion}`,
    threshold: `|observed − calibrated| ≤ ${tolerance}, n ≥ ${minPerBin}`,
    pass,
    evidence: 'calibration-verification-latest.json (verifyCalibration output)',
  };
}

// ── Baseline + classification ────────────────────────────────────────

interface BaselineFile {
  note: string;
  docsSyncNotes?: string[];
  metrics: Record<string, { status: 'pass' | 'known-fail'; disposition?: string }>;
}

/**
 * Stale guidance to hand to the `docs-sync` skill (AC-P3.5). The Item 10
 * verifier established that the runtime/canonical "two-copy" hazard does not
 * exist — `archetypeChemistry.ts` re-exports the canonical matrix by reference
 * — so the personality-system SKILL.md Common-mistakes/checklist entries that
 * instruct keeping two copies in sync are misleading (and the pre-P3 sync test
 * was tautological because of it).
 */
const DOCS_SYNC_NOTES = [
  'personality-system SKILL.md §"Common mistakes" (line ~64) and checklist (line ~75): the runtime/canonical chemistry "two-copy" sync warning is stale — apps/server/src/archetypeChemistry.ts re-exports compatibilityMatrix / derived chemistry from @shared/personality/archetypeCompatibility by reference. There is no second copy to update; canonical sync is an identity invariant, not a data-sync task. Reword or remove; the P3 sync test now asserts object identity.',
];

function loadBaseline(): BaselineFile | null {
  if (!fs.existsSync(BASELINE_PATH)) return null;
  return JSON.parse(fs.readFileSync(BASELINE_PATH, 'utf8')) as BaselineFile;
}

function classify(result: MetricResult, baseline: BaselineFile | null): Status {
  if (result.pass) return 'PASS';
  const base = baseline?.metrics?.[result.id]?.status;
  if (base === 'pass') return 'REGRESSION';
  return 'KNOWN-FAIL';
}

function buildBaselineFile(results: MetricResult[], statuses: Map<string, Status>): BaselineFile {
  const metrics: BaselineFile['metrics'] = {};
  for (const r of results) {
    const status = statuses.get(r.id)!;
    metrics[r.id] = {
      status: status === 'PASS' ? 'pass' : 'known-fail',
      ...(r.disposition ? { disposition: r.disposition } : {}),
    };
  }
  return {
    note: 'Assessment gate baseline (P3). Records the last-known STATUS per metric. REGRESSION = status was pass and is now fail. Regenerate with `npm run gate:assessment -- --update-baseline` only after a change is understood.',
    docsSyncNotes: DOCS_SYNC_NOTES,
    metrics,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

function fmtStatus(s: Status): string {
  if (s === 'PASS') return 'PASS';
  if (s === 'KNOWN-FAIL') return 'KNOWN-FAIL';
  return 'REGRESSION';
}

function main() {
  const args = process.argv.slice(2);
  const jsonArg = args.find((a) => a.startsWith('--json='));
  const jsonOut = jsonArg ? path.resolve(jsonArg.slice('--json='.length)) : '';
  const updateBaseline = args.includes('--update-baseline');

  const recovery = loadJson('recovery-results-latest.json');
  const adversarial = loadJson('adversarial-results-latest.json');
  const boundary = loadJson('boundary-sweep-latest.json');
  const groups = loadJson('group-monte-carlo-latest.json');
  const gatesOn = loadJson('group-monte-carlo-gates-on-latest.json');
  const derived = loadJson('derived-chemistry-latest.json');
  const calibration = loadJson('calibration-verification-latest.json');

  const { m9, m10 } = evalM9M10(gatesOn);
  const results: MetricResult[] = [
    evalM1(recovery),
    evalM2(recovery),
    evalM3(recovery),
    evalM6(adversarial),
    evalM8(boundary),
    m9,
    m10,
    evalM11(groups),
    evalM12(derived),
    evalM13(boundary, recovery),
    evalM14(recovery),
    evalM15(calibration),
  ];

  const baseline = loadBaseline();
  const statuses = new Map<string, Status>();
  for (const r of results) statuses.set(r.id, classify(r, baseline));

  // Table
  console.log('');
  console.log('════════════════════════════════════════════════════════════════════════════════════════════');
  console.log('  Assessment Instrument Gate — locked plan §(f) thresholds');
  console.log('════════════════════════════════════════════════════════════════════════════════════════════');
  console.log(`  ${'Metric'.padEnd(6)} ${'Status'.padEnd(12)} ${'Measured'.padEnd(52)} Threshold`);
  console.log(`  ${'─'.repeat(104)}`);
  for (const r of results) {
    const status = statuses.get(r.id)!;
    console.log(`  ${r.id.padEnd(6)} ${fmtStatus(status).padEnd(12)} ${r.measured.slice(0, 52).padEnd(52)} ${r.threshold}`);
  }
  console.log(`  ${'─'.repeat(104)}`);
  const regressions = results.filter((r) => statuses.get(r.id) === 'REGRESSION');
  const knownFails = results.filter((r) => statuses.get(r.id) === 'KNOWN-FAIL');
  const passes = results.filter((r) => statuses.get(r.id) === 'PASS');
  console.log(`  PASS ${passes.length} · KNOWN-FAIL ${knownFails.length} · REGRESSION ${regressions.length}`);
  console.log('');
  for (const r of knownFails) {
    console.log(`  ⚠️  ${r.id} KNOWN-FAIL — ${r.disposition ?? 'dispositioned; not CI-breaking.'}`);
    console.log(`      evidence: ${r.evidence}`);
  }
  for (const r of regressions) {
    console.error(`  ❌ ${r.id} REGRESSION — previously PASS, now failing (${r.measured}).`);
  }
  console.log('');

  if (updateBaseline) {
    const file = buildBaselineFile(results, statuses);
    fs.writeFileSync(BASELINE_PATH, JSON.stringify(file, null, 2) + '\n', 'utf8');
    console.log(`  baseline updated: ${path.relative(process.cwd(), BASELINE_PATH)}`);
  } else if (!baseline) {
    console.log('  ℹ️  no baseline file — first run: all current failures treated as KNOWN-FAIL (no REGRESSION).');
    console.log('      Commit a baseline via `npm run gate:assessment -- --update-baseline`.');
  }

  if (jsonOut) {
    const payload = {
      suite: 'assessment-gate',
      generatedAt: new Date().toISOString(),
      summary: { pass: passes.length, knownFail: knownFails.length, regression: regressions.length },
      metrics: results.map((r) => ({ ...r, status: statuses.get(r.id) })),
    };
    fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(payload, null, 2) + '\n', 'utf8');
    // Round-trip: parse what we wrote.
    const round = JSON.parse(fs.readFileSync(jsonOut, 'utf8'));
    if (round.metrics.length !== results.length) throw new Error('gate --json round-trip failed');
    console.log(`  gate JSON: ${path.relative(process.cwd(), jsonOut)}`);
  }

  if (regressions.length > 0) {
    console.error(`❌ assessment gate FAILED — ${regressions.length} REGRESSION(s).`);
    process.exit(1);
  }
  console.log('✅ assessment gate passed (no REGRESSION).');
}

main();
