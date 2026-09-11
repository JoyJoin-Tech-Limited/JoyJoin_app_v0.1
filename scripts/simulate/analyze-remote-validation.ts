#!/usr/bin/env node
/**
 * Remote-validation analyzer.
 *
 * Consumes a panel dataset (real or synthetic fixture) and runs the four
 * pre-launch validation analyses, emitting a JSON artifact and a markdown
 * report. With `--self-test` it additionally asserts the harness recovers the
 * synthetic fixture's planted structure (CI-able proof the harness works
 * before real data exists).
 *
 * Usage:
 *   tsx scripts/simulate/analyze-remote-validation.ts --panel=<file.json>
 *   tsx scripts/simulate/analyze-remote-validation.ts --self-test
 *   tsx scripts/simulate/analyze-remote-validation.ts --panel=<file> --report=<out.md>
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { AnalysisResult, IpIpKeying, PanelDataset } from './lib/remote-validation/types';
import { analyzeAll, VALIDATION_THRESHOLDS, DEFAULT_CONVERGENT_GATE_MODE, type ConvergentGateMode } from './lib/remote-validation/analyses';
import { validateKeying } from './lib/remote-validation/ipip';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

function arg(args: string[], name: string, fallback?: string): string | undefined {
  return args.find((a) => a.startsWith(`--${name}=`))?.slice(name.length + 3) ?? fallback;
}

function readJson<T>(p: string): T {
  if (!fs.existsSync(p)) throw new Error(`File not found: ${p}`);
  return JSON.parse(fs.readFileSync(p, 'utf8')) as T;
}

interface SelfTestCheck {
  id: string;
  expectation: string;
  observed: string;
  pass: boolean;
}

function runSelfTest(analyses: AnalysisResult[], dataset: PanelDataset): SelfTestCheck[] {
  const planted = (dataset.meta as any).planted ?? {};
  const checks: SelfTestCheck[] = [];
  const byId = new Map(analyses.map((a) => [a.id, a]));

  for (const id of ['convergent', 'retest', 'vibe', 'narrative']) {
    const a = byId.get(id)!;
    checks.push({
      id: `status:${id}`,
      expectation: 'analysis recovers planted signal (PASS)',
      observed: a.status,
      pass: a.status === 'PASS',
    });
  }

  const convMin = Math.min(
    ...(byId.get('convergent')!.detail.perTrait as Array<{ gated: boolean; r: number }>)
      .filter((t) => t.gated)
      .map((t) => t.r),
  );
  if (typeof planted.expectedConvergentR === 'number') {
    checks.push({
      id: 'magnitude:convergent',
      expectation: `min r within ±0.08 of planted ${planted.expectedConvergentR}`,
      observed: `min r ${convMin.toFixed(3)}`,
      pass: Math.abs(convMin - planted.expectedConvergentR) <= 0.08,
    });
  }

  const retestMean = byId.get('retest')!.detail.meanR as number;
  if (typeof planted.expectedRetestR === 'number') {
    checks.push({
      id: 'magnitude:retest',
      expectation: `mean r within ±0.08 of planted ${planted.expectedRetestR}`,
      observed: `mean r ${retestMean.toFixed(3)}`,
      pass: Math.abs(retestMean - planted.expectedRetestR) <= 0.08,
    });
  }

  const vibeCoefs = (byId.get('vibe')!.detail.coefs ?? []) as Array<{ name: string; beta: number }>;
  const betaOf = (name: string) => vibeCoefs.find((c) => c.name === name)?.beta ?? 0;
  checks.push({
    id: 'sign:vibe:spark',
    expectation: 'spark β > 0 (planted +0.5)',
    observed: `spark β ${betaOf('spark').toFixed(3)}`,
    pass: betaOf('spark') > 0,
  });
  checks.push({
    id: 'sign:vibe:minE',
    expectation: 'minE β ≥ 0 (planted +0.4 floor effect)',
    observed: `minE β ${betaOf('minE').toFixed(3)}`,
    pass: betaOf('minE') >= 0,
  });

  const narrativeDetail = byId.get('narrative')!.detail.welch as { p: number } | undefined;
  checks.push({
    id: 'effect:narrative',
    expectation: 'answer-citing scores higher at p < 0.05',
    observed: narrativeDetail ? `p ${narrativeDetail.p}` : String(byId.get('narrative')!.measured),
    pass: (narrativeDetail?.p ?? 1) < 0.05 && byId.get('narrative')!.status === 'PASS',
  });

  return checks;
}

function markdownReport(dataset: PanelDataset, analyses: AnalysisResult[]): string {
  const lines: string[] = [];
  lines.push('# Remote Validation Report');
  lines.push('');
  lines.push(`**Panel:** ${dataset.meta.panelId}  `);
  lines.push(`**Instrument:** ${dataset.meta.instrument}  `);
  lines.push(`**Collected:** ${dataset.meta.collectedAt}  `);
  lines.push(`**Respondents:** ${dataset.respondents.length}  `);
  lines.push(`**Vibe sessions:** ${dataset.vibeSessions?.length ?? 0}`);
  lines.push('');
  if (dataset.meta.notes) {
    lines.push(`> ${dataset.meta.notes}`);
    lines.push('');
  }
  lines.push('## Results');
  lines.push('');
  lines.push('| Analysis | Status | Measured | Threshold |');
  lines.push('|---|---|---|---|');
  for (const a of analyses) {
    lines.push(`| ${a.label} | ${a.status} | ${a.measured} | ${a.threshold} |`);
  }
  lines.push('');

  const conv = analyses.find((a) => a.id === 'convergent')!;
  lines.push('### Convergent validity (per trait)');
  lines.push('');
  lines.push('| ACOEXP | Big Five | sign | r | 95% CI | n | gated |');
  lines.push('|---|---|---|---|---|---|---|');
  for (const t of conv.detail.perTrait as any[]) {
    lines.push(`| ${t.trait} | ${t.bigFive} | ${t.sign > 0 ? '+' : '−'} | ${t.r} | [${t.ci[0]}, ${t.ci[1]}] | ${t.n} | ${t.gated ? 'yes' : 'no'} |`);
  }
  lines.push('');
  const divergent = (conv.detail.divergent ?? []) as any[];
  if (divergent.length) {
    lines.push('**Divergent (reported, not gated):**');
    for (const d of divergent) lines.push(`- ${d.trait}: r=${d.r} — ${d.note}`);
    lines.push('');
  }

  const vibe = analyses.find((a) => a.id === 'vibe')!;
  if (vibe.detail.coefs) {
    lines.push('### Vibe composition regression (standardized)');
    lines.push('');
    lines.push('| Predictor | β | SE | t | p |');
    lines.push('|---|---|---|---|---|');
    for (const c of vibe.detail.coefs as any[]) {
      lines.push(`| ${c.name} | ${c.beta} | ${c.se} | ${c.t} | ${c.p} |`);
    }
    lines.push('');
    lines.push(`Model R² = ${vibe.detail.r2}, adj R² = ${vibe.detail.adjR2}`);
    lines.push('');
  }

  const narrative = analyses.find((a) => a.id === 'narrative')!;
  if (narrative.detail.perArm) {
    lines.push('### Narrative A/B');
    lines.push('');
    lines.push('| Arm | n | mean |');
    lines.push('|---|---|---|');
    for (const a of narrative.detail.perArm as any[]) lines.push(`| ${a.arm} | ${a.n} | ${a.mean} |`);
    lines.push('');
    if (narrative.detail.welch) {
      lines.push(`Welch t=${narrative.detail.welch.t}, df=${narrative.detail.welch.df}, p=${narrative.detail.welch.p}`);
      lines.push('');
    }
  }

  lines.push('## Threshold provenance');
  lines.push('');
  lines.push('| Analysis | Threshold | Locked? | Source |');
  lines.push('|---|---|---|---|');
  for (const [k, v] of Object.entries(VALIDATION_THRESHOLDS)) {
    const t = 'rMin' in v ? `r ≥ ${(v as any).rMin}` : 'meanRMin' in v ? `mean r ≥ ${(v as any).meanRMin}` : 'see detail';
    lines.push(`| ${k} | ${t} | ${(v as any).locked ? 'LOCKED' : 'proposed'} | ${(v as any).source} |`);
  }
  lines.push('');
  lines.push('Locked = may block rollout. Proposed = requires plan-owner ratification.');
  lines.push('');
  return lines.join('\n');
}

function main() {
  const args = process.argv.slice(2);
  const selfTest = args.includes('--self-test');
  const panelPath = arg(args, 'panel', path.join(DATA_DIR, 'remote-validation-fixture.json'))!;
  const keyingPath = arg(args, 'keying', path.join(DATA_DIR, 'ipip-bigfive-keying.json'))!;
  const jsonOut = arg(args, 'json', path.join(DATA_DIR, 'remote-validation-latest.json'))!;
  const reportOut = arg(args, 'report');
  const gateMode = (arg(args, 'gate-mode') as ConvergentGateMode | undefined) ?? DEFAULT_CONVERGENT_GATE_MODE;

  const dataset = readJson<PanelDataset>(panelPath);
  const keying = readJson<IpIpKeying>(keyingPath);

  const keyingErrors = validateKeying(keying);
  if (keyingErrors.length) {
    console.error('❌ Invalid IPIP keying:');
    for (const e of keyingErrors) console.error(`   - ${e}`);
    process.exit(2);
  }
  if (keying.placeholder && !selfTest) {
    console.warn('⚠️  IPIP keying is a STRUCTURAL PLACEHOLDER — replace with the official keying before a live panel.');
  }

  const analyses = analyzeAll(dataset, keying, { gateMode });

  console.log('═'.repeat(74));
  console.log('🔬 Remote Validation Analysis');
  console.log('═'.repeat(74));
  console.log(`Panel: ${dataset.meta.panelId}  (n=${dataset.respondents.length}, sessions=${dataset.vibeSessions?.length ?? 0})`);
  console.log(`Convergent gate mode: ${gateMode}`);
  console.log('');

  for (const a of analyses) {
    const icon = a.status === 'PASS' ? '✅' : a.status === 'INSUFFICIENT' ? '⚪' : '❌';
    const lock = (VALIDATION_THRESHOLDS as any)[a.id]?.locked ? ' [LOCKED]' : '';
    console.log(`${icon} ${a.id.padEnd(12)} ${a.status.padEnd(13)}${lock} ${a.measured}`);
    console.log(`   └ ${a.threshold}`);
  }

  const artifact = {
    meta: {
      timestamp: new Date().toISOString(),
      panelId: dataset.meta.panelId,
      instrument: dataset.meta.instrument,
      respondents: dataset.respondents.length,
      vibeSessions: dataset.vibeSessions?.length ?? 0,
      selfTest,
      keyingPlaceholder: keying.placeholder ?? false,
      convergentGateMode: gateMode,
    },
    thresholds: VALIDATION_THRESHOLDS,
    results: analyses,
  };
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2));
  console.log(`\n✅ Artifact: ${path.relative(process.cwd(), jsonOut)}`);

  if (reportOut) {
    fs.mkdirSync(path.dirname(reportOut), { recursive: true });
    fs.writeFileSync(reportOut, markdownReport(dataset, analyses));
    console.log(`✅ Report:   ${path.relative(process.cwd(), reportOut)}`);
  }

  let exitCode = 0;

  if (selfTest) {
    const checks = runSelfTest(analyses, dataset);
    console.log('\n' + '─'.repeat(74));
    console.log('🧪 Self-test (planted-structure recovery)');
    console.log('─'.repeat(74));
    let failed = 0;
    for (const c of checks) {
      console.log(`${c.pass ? '✅' : '❌'} ${c.id}: ${c.observed}  (expect ${c.expectation})`);
      if (!c.pass) failed++;
    }
    (artifact.meta as any).selfTestChecks = checks;
    fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2));
    console.log(`\nSelf-test: ${checks.length - failed}/${checks.length} passed`);
    if (failed > 0) exitCode = 1;
  } else {
    const lockedFailures = analyses.filter(
      (a) => (VALIDATION_THRESHOLDS as any)[a.id]?.locked && a.status === 'FAIL',
    );
    if (lockedFailures.length) {
      console.error(`\n❌ Locked validation failure(s): ${lockedFailures.map((a) => a.id).join(', ')}`);
      exitCode = 1;
    }
  }

  process.exit(exitCode);
}

main();
