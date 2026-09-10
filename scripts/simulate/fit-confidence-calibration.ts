#!/usr/bin/env node
/**
 * Confidence Calibration Pipeline (V4 Personality Engine — Plan Item 12)
 *
 * Contract: .git/.orchestration/sprints/sprint-contract.item12-confidence-calibration.md
 *
 * Pipeline:
 *   1. Runs the latent-trait recovery harness with --export-sessions at the
 *      fixed calibration seed (default 20260909) — or reads an existing
 *      export via --sessions=<path>.
 *   2. Fits the calibration on NATURAL-termination sessions only (production
 *      termination behavior), pooled across the default noise arms
 *      (clean + moderate) as a stand-in for unknown real-world answer noise.
 *      Forced-16 sessions are measured separately as a comparison table.
 *   3. Verifies M15 (LOCKED): binned by calibrated confidence, every bin with
 *      n >= 50 must have |observed agreement - mean calibrated| <= 0.10.
 *   4. Rewrites the generated artifact
 *      `packages/shared/src/personality/confidenceCalibrationArtifact.ts`
 *      deterministically (two runs at the same seed produce identical bytes)
 *      and writes a dated report to docs/reports/.
 *
 * The calibration is NOT wired into the engine. Item 3 (confidence-weighted
 * shrinkage, Tier 3) is the sole intended shipping consumer.
 *
 * Usage:
 *   tsx scripts/simulate/fit-confidence-calibration.ts
 *   tsx scripts/simulate/fit-confidence-calibration.ts --sessions=/tmp/sessions.jsonl
 *   tsx scripts/simulate/fit-confidence-calibration.ts --check   (verify embedded artifact matches a fresh fit; no rewrite)
 */

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import {
  fitCalibration,
  verifyCalibration,
  calibrateConfidence,
  expectedTraitAbsError,
  CalibrationRow,
  CalibrationVerification,
  FittedConfidenceCalibration,
} from '../../packages/shared/src/personality/confidenceCalibration';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.join(__dirname, '..', '..');
const ARTIFACT_PATH = path.join(
  REPO_ROOT,
  'packages',
  'shared',
  'src',
  'personality',
  'confidenceCalibrationArtifact.ts'
);
const HARNESS_PATH = path.join(REPO_ROOT, 'scripts', 'simulate', 'run-recovery-harness.ts');

const VERSION = 'v1-20260909';
const DEFAULT_SEED = 20260909;
const DEFAULT_N = 2000;
const DEFAULT_NOISE = 'clean,moderate';

// ── CLI ──────────────────────────────────────────────────────────────

function parseArgs() {
  const options: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ?? 'true';
    }
  }
  return {
    seed: parseInt(options.seed || String(DEFAULT_SEED), 10),
    n: parseInt(options.n || String(DEFAULT_N), 10),
    noise: options.noise || DEFAULT_NOISE,
    sessionsFile: options.sessions || '',
    outFile: options.out || '',
    check: options.check === 'true',
  };
}

// ── Harness invocation ───────────────────────────────────────────────

function runHarnessExport(seed: number, n: number, noise: string): string {
  const exportPath = path.join(
    os.tmpdir(),
    `joyjoin-recovery-sessions-seed${seed}-n${n}-${noise.replace(/[^a-z,]/g, '')}.jsonl`
  );
  console.log(`[1/4] Running recovery harness (seed=${seed}, n=${n}, noise=${noise}) ...`);
  const result = spawnSync(
    process.execPath,
    ['--import', 'tsx', HARNESS_PATH, `--n=${n}`, `--seed=${seed}`, `--noise=${noise}`, `--export-sessions=${exportPath}`, `--out=${path.join(os.tmpdir(), 'joyjoin-calibration-harness-report.md')}`],
    { stdio: ['ignore', 'inherit', 'inherit'] }
  );
  if (result.status !== 0) {
    console.error(`Harness run failed (exit ${result.status}).`);
    process.exit(1);
  }
  if (!fs.existsSync(exportPath)) {
    console.error(`Harness did not produce the session export at ${exportPath}.`);
    process.exit(1);
  }
  return exportPath;
}

function readRows(file: string): CalibrationRow[] {
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim().length > 0)
    .map((line) => JSON.parse(line) as CalibrationRow);
}

// ── Artifact serialization (deterministic byte output) ───────────────

function serializeArtifact(fit: FittedConfidenceCalibration): string {
  const json = JSON.stringify(fit, null, 2);
  return `/**
 * GENERATED FILE — do not edit by hand.
 *
 * Fitted confidence-calibration artifact (Plan Item 12).
 * Regenerate deterministically (fixed seed ${fit.fittedOnSeed}):
 *
 *   npm run simulate:calibration
 *
 * The generator (\`scripts/simulate/fit-confidence-calibration.ts\`) runs the
 * recovery harness session export, fits isotonic curves, verifies M15, and
 * rewrites this file. Two runs at the same seed produce identical bytes.
 *
 * Fit provenance: natural-termination sessions of the latent-trait recovery
 * harness (seed ${fit.fittedOnSeed}, noise arms: ${fit.noiseArms.join(' + ')}),
 * ${fit.sessionCount} sessions, PAVA isotonic regression, 6dp rounding.
 */

export const CALIBRATION_VERSION = '${fit.version}';
export const CALIBRATION_SEED = ${fit.fittedOnSeed};

export interface CalibrationCurveNode {
  /** Raw engine confidence at the isotonic block centroid (0..1). */
  x: number;
  /** Fitted probability / expected value at that centroid. */
  p: number;
}

export interface FittedConfidenceCalibration {
  version: string;
  fittedOnSeed: number;
  fitArm: 'natural';
  noiseArms: string[];
  sessionCount: number;
  /** Isotonic (PAVA) blocks: raw mean trait confidence -> observed top-1 agreement. */
  correctnessBlocks: Array<{ xMin: number; xMax: number; p: number; n: number }>;
  /** Monotone piecewise-linear nodes derived from the block centroids. */
  correctnessCurve: CalibrationCurveNode[];
  /** Per-trait confidence -> expected |trait error| (0-100 scale), decreasing. */
  traitErrorCurve: CalibrationCurveNode[];
}

export const FITTED_CONFIDENCE_CALIBRATION: FittedConfidenceCalibration = ${json};
`;
}

// ── Report ───────────────────────────────────────────────────────────

function f3(x: number): string {
  return x.toFixed(3);
}
function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function verificationTable(v: CalibrationVerification): string[] {
  const L: string[] = [];
  L.push('| Bin (calibrated) | n | mean calibrated | observed agreement | |gap| | status |');
  L.push('|---|---|---|---|---|---|');
  for (const b of v.bins) {
    L.push(
      `| [${b.lo.toFixed(1)}, ${b.hi.toFixed(1)}) | ${b.n} | ${b.n > 0 ? f3(b.meanCalibrated) : '—'} | ${b.n > 0 ? pct(b.observedAgreement) : '—'} | ${b.n > 0 ? f3(b.absGap) : '—'} | ${b.status} |`
    );
  }
  return L;
}

function rawReliabilityTable(rows: CalibrationRow[], fit: FittedConfidenceCalibration): string[] {
  // "Before" picture: bin by RAW confidence, show observed agreement vs raw
  // confidence vs the calibrated prediction.
  const binCount = 10;
  const acc = Array.from({ length: binCount }, () => ({ n: 0, rawSum: 0, calSum: 0, hitSum: 0 }));
  for (const r of rows) {
    const idx = Math.min(binCount - 1, Math.max(0, Math.floor(r.meanTraitConfidence * binCount)));
    acc[idx].n++;
    acc[idx].rawSum += r.meanTraitConfidence;
    acc[idx].calSum += calibrateConfidence(r.meanTraitConfidence, fit);
    acc[idx].hitSum += r.correct;
  }
  const L: string[] = [];
  L.push('| Bin (raw confidence) | n | mean raw | observed agreement | raw inflation | calibrated prediction |');
  L.push('|---|---|---|---|---|---|');
  for (let i = 0; i < binCount; i++) {
    const b = acc[i];
    if (b.n === 0) {
      L.push(`| [${(i / 10).toFixed(1)}, ${((i + 1) / 10).toFixed(1)}) | 0 | — | — | — | — |`);
      continue;
    }
    const meanRaw = b.rawSum / b.n;
    const observed = b.hitSum / b.n;
    L.push(
      `| [${(i / 10).toFixed(1)}, ${((i + 1) / 10).toFixed(1)}) | ${b.n} | ${f3(meanRaw)} | ${pct(observed)} | +${f3(meanRaw - observed)} | ${f3(b.calSum / b.n)} |`
    );
  }
  return L;
}

function buildReport(params: {
  dateStr: string;
  seed: number;
  n: number;
  noiseArms: string[];
  fitRows: CalibrationRow[];
  forced16Rows: CalibrationRow[];
  fit: FittedConfidenceCalibration;
  verification: CalibrationVerification;
  perNoise: Array<{ noise: string; v: CalibrationVerification }>;
  forced16Verification: CalibrationVerification;
  rawEce: number;
}): string {
  const { fit, verification } = params;
  const L: string[] = [];
  L.push(`# Confidence Calibration — ${params.dateStr}`);
  L.push('');
  L.push('> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 12.');
  L.push('> Contract: `.git/.orchestration/sprints/sprint-contract.item12-confidence-calibration.md`.');
  L.push(`> Artifact: \`packages/shared/src/personality/confidenceCalibrationArtifact.ts\` (version \`${fit.version}\`).`);
  L.push('> Fully deterministic: `npm run simulate:calibration` at the fixed seed reproduces every number and byte of the artifact.');
  L.push('');
  L.push('## Run parameters');
  L.push('');
  L.push(`- Seed: \`${params.seed}\``);
  L.push(`- Respondents (N): ${params.n}`);
  L.push(`- Noise arms: ${params.noiseArms.map((a) => `\`${a}\``).join(', ')}`);
  L.push(`- Fit set: natural-termination sessions only (${fit.sessionCount} sessions, pooled across noise arms)`);
  L.push('- Fit method: PAVA isotonic regression on (raw mean trait confidence -> top-1 correct), 6dp rounding; piecewise-linear curve through block centroids');
  L.push('');
  L.push('**Fit-set choice (documented per contract):** natural termination matches production session composition (min=10/softMax=12/hardMax=16, confidence early-stop active); forced checkpoints are a measurement instrument, not a production flow. Pooling clean + moderate stands in for unknown real-world answer noise (clean = model ceiling, moderate = realistic bar per the P1a audit). Forced-16 is examined below for comparison only.');
  L.push('');
  L.push('## Why: raw confidence is inflated');
  L.push('');
  L.push(`- Mean raw confidence on the fit set: ${f3(params.fitRows.reduce((s, r) => s + r.meanTraitConfidence, 0) / params.fitRows.length)}`);
  L.push(`- Observed top-1 agreement on the fit set: ${pct(params.fitRows.reduce((s, r) => s + r.correct, 0) / params.fitRows.length)}`);
  L.push(`- Expected calibration error (ECE), raw confidence: ${f3(params.rawEce)} -> calibrated: ${f3(verification.ece)}`);
  L.push('');
  L.push(...rawReliabilityTable(params.fitRows, fit));
  L.push('');
  L.push('## Fitted artifact');
  L.push('');
  L.push('### Isotonic blocks (raw mean trait confidence -> observed top-1 agreement)');
  L.push('');
  L.push('| Block | x range | n | fitted p |');
  L.push('|---|---|---|---|');
  fit.correctnessBlocks.forEach((b, i) => {
    L.push(`| ${i + 1} | [${f3(b.xMin)}, ${f3(b.xMax)}] | ${b.n} | ${f3(b.p)} |`);
  });
  L.push('');
  L.push('### Correctness curve nodes (piecewise-linear)');
  L.push('');
  L.push('| raw confidence x | calibrated P(correct) |');
  L.push('|---|---|');
  for (const node of fit.correctnessCurve) {
    L.push(`| ${f3(node.x)} | ${f3(node.p)} |`);
  }
  L.push('');
  L.push('### Per-trait error curve nodes (raw per-trait confidence -> expected |trait error|, 0-100 scale)');
  L.push('');
  L.push('| raw trait confidence x | expected |error| |');
  L.push('|---|---|');
  for (const node of fit.traitErrorCurve) {
    L.push(`| ${f3(node.x)} | ${f3(node.p)} |`);
  }
  L.push('');
  L.push('Spot check: raw 0.90 -> calibrated ' + f3(calibrateConfidence(0.9, fit)) + '; raw 0.95 -> ' + f3(calibrateConfidence(0.95, fit)) + '; raw 0.70 -> ' + f3(calibrateConfidence(0.7, fit)) + '.');
  L.push('');
  L.push('## M15 verification (LOCKED)');
  L.push('');
  L.push(`Rule: bin the fit set by CALIBRATED confidence (10 equal-width bins); every bin with n >= ${verification.minPerBin} must satisfy |observed agreement - mean calibrated| <= ${verification.tolerance}.`);
  L.push('');
  L.push(...verificationTable(verification));
  L.push('');
  L.push(`**M15: ${verification.pass ? 'PASS' : 'FAIL'}** (${verification.evaluatedBins} bins evaluated, ${verification.failedBins} failed; bins with n < ${verification.minPerBin} reported as insufficient and not gated).`);
  L.push('');
  L.push('### Per-noise-arm reliability (context, same rule)');
  L.push('');
  L.push('Key structural finding: raw engine confidence is blind to answer noise — at equal raw confidence, clean sessions are systematically MORE accurate than moderate sessions. The pooled fit therefore under-predicts the clean arm and over-predicts the moderate arm, and one or both per-arm tables can show a bin outside ±0.10 even when the pooled M15 gate passes. Consequence for Item 3: calibrated confidence is a noise-regime-averaged probability; shrinkage weights derived from it are conservative for noisy answerers and slightly lax for clean ones.');
  L.push('');
  for (const { noise, v } of params.perNoise) {
    L.push(`Arm \`${noise}\` — ${v.pass ? 'PASS' : 'FAIL'} (${v.evaluatedBins} evaluated, ${v.failedBins} failed, ECE ${f3(v.ece)}):`);
    L.push('');
    L.push(...verificationTable(v));
    L.push('');
  }
  L.push('## Forced-16 comparison (context only — not the fit set)');
  L.push('');
  L.push(`Forced-16 sessions evaluated against the natural-fitted artifact: ${params.forced16Verification.pass ? 'PASS' : 'FAIL'} (ECE ${f3(params.forced16Verification.ece)}). Forcing every session to 16 questions lifts raw confidence (more samples) without changing production termination, so mild drift vs the natural fit is expected; the artifact intentionally reflects production sessions.`);
  L.push('');
  L.push(...verificationTable(params.forced16Verification));
  L.push(`(${params.forced16Rows.length} forced-16 sessions.)`);
  L.push('');
  L.push('## Consumption boundary');
  L.push('');
  L.push('- The calibration is NOT wired into `adaptiveEngine.ts`, `matcherV2.ts`, or any runtime path. Item 3 (confidence-weighted shrinkage, Tier 3) is the sole intended shipping consumer.');
  L.push('- The shared module is pure: no I/O, no randomness, no mutable state. The fitted table is embedded as a versioned constant; regenerate with `npm run simulate:calibration`.');
  L.push('');
  L.push('---');
  L.push('Generated by `npm run simulate:calibration` (`scripts/simulate/fit-confidence-calibration.ts`).');
  L.push('');
  return L.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const { seed, n, noise, sessionsFile, outFile, check } = parseArgs();
  const noiseArms = noise.split(',').map((s) => s.trim());

  const exportPath = sessionsFile || runHarnessExport(seed, n, noise);
  console.log(`[2/4] Reading session export: ${exportPath}`);
  const rows = readRows(exportPath);

  const fitRows = rows.filter((r) => r.arm === 'natural');
  const forced16Rows = rows.filter((r) => r.arm === 'forced' && r.checkpoint === 16);
  if (fitRows.length === 0) {
    console.error('No natural-termination rows in the export.');
    process.exit(1);
  }
  console.log(`   ${rows.length} rows total; fit set = ${fitRows.length} natural sessions; comparison = ${forced16Rows.length} forced-16 sessions.`);

  console.log('[3/4] Fitting calibration (PAVA isotonic) ...');
  const fit = fitCalibration(fitRows, { version: VERSION, seed, noiseArms });

  const verification = verifyCalibration(fitRows, fit);
  const perNoise = noiseArms.map((arm) => ({
    noise: arm,
    v: verifyCalibration(fitRows.filter((r) => r.noise === arm), fit),
  }));
  const forced16Verification = verifyCalibration(forced16Rows, fit);
  const rawEce =
    fitRows.reduce((s, r) => s + Math.abs(r.correct - r.meanTraitConfidence), 0) / fitRows.length;

  // M15 console table
  console.log('');
  console.log('   M15 verification (bins by calibrated confidence, n>=50, tolerance +/-0.10):');
  for (const b of verification.bins) {
    const range = `[${b.lo.toFixed(1)}, ${b.hi.toFixed(1)})`;
    console.log(
      `     ${range.padEnd(12)} n=${String(b.n).padEnd(5)} calibrated=${b.n > 0 ? f3(b.meanCalibrated) : '   —— '} observed=${b.n > 0 ? pct(b.observedAgreement) : '  ——  '} gap=${b.n > 0 ? f3(b.absGap) : '  —— '} ${b.status}`
    );
  }
  console.log('');
  console.log(`   M15: ${verification.pass ? 'PASS' : 'FAIL'} (${verification.evaluatedBins} bins evaluated, ${verification.failedBins} failed; ECE raw=${f3(rawEce)} calibrated=${f3(verification.ece)})`);
  console.log(`   Spot check: raw 0.90 -> calibrated ${f3(calibrateConfidence(0.9, fit))}; raw 0.95 -> ${f3(calibrateConfidence(0.95, fit))}`);
  console.log(`   Trait error curve: raw 0.90 -> expected |error| ${expectedTraitAbsError(0.9, fit).toFixed(1)}`);

  console.log('[4/4] Writing artifact + report ...');
  const artifactSource = serializeArtifact(fit);

  if (check) {
    const existing = fs.existsSync(ARTIFACT_PATH) ? fs.readFileSync(ARTIFACT_PATH, 'utf8') : '';
    if (existing === artifactSource) {
      console.log(`   CHECK OK: embedded artifact matches fresh fit at seed ${seed}.`);
    } else {
      console.error(`   CHECK FAILED: embedded artifact differs from a fresh fit at seed ${seed}. Run npm run simulate:calibration to regenerate.`);
      process.exit(1);
    }
  } else {
    fs.writeFileSync(ARTIFACT_PATH, artifactSource, 'utf8');
    console.log(`   Artifact: ${ARTIFACT_PATH}`);
  }

  const dateStr = new Date().toISOString().slice(0, 10);
  const reportPath = outFile
    ? path.resolve(outFile)
    : path.join(REPO_ROOT, 'docs', 'reports', `${dateStr}-confidence-calibration.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  fs.writeFileSync(
    reportPath,
    buildReport({ dateStr, seed, n, noiseArms, fitRows, forced16Rows, fit, verification, perNoise, forced16Verification, rawEce }),
    'utf8'
  );
  console.log(`   Report: ${reportPath}`);

  // P3 gate artifact: the M15 verification result as machine-readable JSON (the
  // gate parses this and re-checks the module's pass condition; it never
  // re-runs the harness).
  const r6 = (x: number) => Math.round(x * 1e6) / 1e6;
  const verificationPath = path.join(__dirname, 'data', 'calibration-verification-latest.json');
  const verificationJson = {
    suite: 'confidence-calibration-verification',
    planItem: 12,
    generatedAt: dateStr,
    seed,
    n,
    noiseArms,
    calibrationVersion: VERSION,
    sessionCount: fitRows.length,
    m15: {
      pass: verification.pass,
      tolerance: verification.tolerance,
      minPerBin: verification.minPerBin,
      evaluatedBins: verification.evaluatedBins,
      failedBins: verification.failedBins,
      bins: verification.bins.map((b) => ({
        index: b.index,
        lo: r6(b.lo),
        hi: r6(b.hi),
        n: b.n,
        meanCalibrated: r6(b.meanCalibrated),
        observedAgreement: r6(b.observedAgreement),
        absGap: r6(b.absGap),
        status: b.status,
      })),
    },
    rawEce: r6(rawEce),
    calibratedEce: r6(verification.ece),
    perNoise: perNoise.map((p) => ({
      noise: p.noise,
      pass: p.v.pass,
      evaluatedBins: p.v.evaluatedBins,
      failedBins: p.v.failedBins,
    })),
    forced16: {
      pass: forced16Verification.pass,
      evaluatedBins: forced16Verification.evaluatedBins,
      failedBins: forced16Verification.failedBins,
    },
  };
  fs.mkdirSync(path.dirname(verificationPath), { recursive: true });
  fs.writeFileSync(verificationPath, JSON.stringify(verificationJson, null, 2) + '\n', 'utf8');
  console.log(`   Verification JSON: ${verificationPath}`);

  if (!verification.pass) {
    console.error('M15 verification FAILED — artifact written but the fit does not meet the locked reliability bar.');
    process.exit(1);
  }
  console.log('Done. M15 PASS.');
}

main();
