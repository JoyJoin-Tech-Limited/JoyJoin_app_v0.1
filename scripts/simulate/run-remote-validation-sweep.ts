#!/usr/bin/env node
/**
 * Remote-validation harness — discriminating-power sweep.
 *
 * Simulated users CANNOT validate the engine (the convergent r recovers whatever
 * the generator planted). They CAN validate the VALIDATOR: sweep the planted
 * true validity from high to low and confirm the harness PASSes a genuinely
 * valid instrument and FAILs a genuinely invalid one. That is real
 * method-validation, not self-certification.
 *
 * Usage:
 *   tsx scripts/simulate/run-remote-validation-sweep.ts [--n=400] [--json=<out>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildFixture, expectedConvergentR, expectedRetestR } from './gen-remote-validation-fixture';
import { analyzeConvergent, analyzeRetest, DEFAULT_CONVERGENT_GATE_MODE, type ConvergentGateMode } from './lib/remote-validation/analyses';
import type { IpIpKeying } from './lib/remote-validation/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

/** V4 measurement-error SDs. Larger SD → weaker planted validity. */
const V4_NOISE_LEVELS = [2, 8, 12, 16, 20, 28, 40];
const IPIP_ITEM_NOISE = 0.7;

const PASS_THRESHOLD = 0.6;
const STRONG_VALID = 0.7;
const STRONG_INVALID = 0.5;
/** Clamping at 0/100 attenuates beyond the closed-form expectation, so the
 *  measured value is allowed to fall further below than it may exceed. */
const MAGNITUDE_TOLERANCE_LOW = 0.09;
const MAGNITUDE_TOLERANCE_HIGH = 0.03;

function loadKeying(): IpIpKeying {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ipip-bigfive-keying.json'), 'utf8'));
}

interface SweepRow {
  v4NoiseSd: number;
  expectedR: number;
  measuredMinR: number;
  convStatus: string;
  expectedRetestR: number;
  retestMeanR: number;
  retestStatus: string;
}

function main() {
  const args = process.argv.slice(2);
  const n = parseInt(args.find((a) => a.startsWith('--n='))?.slice(4) ?? '400', 10);
  const jsonOut = args.find((a) => a.startsWith('--json='))?.slice(7);
  const gateMode = (args.find((a) => a.startsWith('--gate-mode='))?.slice(12) as ConvergentGateMode | undefined) ?? DEFAULT_CONVERGENT_GATE_MODE;
  const keying = loadKeying();

  console.log('═'.repeat(78));
  console.log('🧪 Remote-Validation Harness — Validity Discrimination Sweep');
  console.log('═'.repeat(78));
  console.log(`n=${n} per level | IPIP item noise=${IPIP_ITEM_NOISE} | gate=${gateMode} | ${V4_NOISE_LEVELS.length} levels\n`);

  const rows: SweepRow[] = [];
  for (const v4NoiseSd of V4_NOISE_LEVELS) {
    const dataset = buildFixture({
      n,
      seed: 20260911 + v4NoiseSd,
      sessionCount: 0,
      narrativeEffect: 0,
      v4NoiseSd,
      ipipItemNoiseSd: IPIP_ITEM_NOISE,
    });
    const conv = analyzeConvergent(dataset, keying, { gateMode });
    const retest = analyzeRetest(dataset);
    const gated = (conv.detail.perTrait as Array<{ gated: boolean; r: number }>).filter((t) => t.gated);
    const measuredMinR = Math.min(...gated.map((t) => t.r));
    const expectedR = expectedConvergentR(v4NoiseSd, IPIP_ITEM_NOISE);
    const expectedRetest = expectedRetestR(v4NoiseSd);
    rows.push({
      v4NoiseSd,
      expectedR: Math.round(expectedR * 1000) / 1000,
      measuredMinR: Math.round(measuredMinR * 1000) / 1000,
      convStatus: conv.status,
      expectedRetestR: Math.round(expectedRetest * 1000) / 1000,
      retestMeanR: retest.detail.meanR as number,
      retestStatus: retest.status,
    });
  }

  console.log(
    `${'V4 noise'.padEnd(10)} ${'expected r'.padEnd(12)} ${'measured r'.padEnd(12)} ${'convergent'.padEnd(12)} ${'retest'.padEnd(8)}`,
  );
  console.log('─'.repeat(78));
  for (const r of rows) {
    const icon = r.convStatus === 'PASS' ? '✅' : r.convStatus === 'FAIL' ? '❌' : '⚪';
    console.log(
      `${String(r.v4NoiseSd).padEnd(10)} ${r.expectedR.toFixed(3).padEnd(12)} ${r.measuredMinR.toFixed(3).padEnd(12)} ` +
        `${icon} ${r.convStatus.padEnd(9)} ${r.retestStatus}`,
    );
  }

  const checks: Array<{ id: string; pass: boolean; detail: string }> = [];

  const strongValid = rows.filter((r) => r.expectedR >= STRONG_VALID);
  const strongInvalid = rows.filter((r) => r.expectedR <= STRONG_INVALID);
  checks.push({
    id: 'discrimination:strong-valid-PASS',
    pass: strongValid.length > 0 && strongValid.every((r) => r.convStatus === 'PASS'),
    detail: `expected r ≥ ${STRONG_VALID} → all PASS (${strongValid.length} levels)`,
  });
  checks.push({
    id: 'discrimination:strong-invalid-FAIL',
    pass: strongInvalid.length > 0 && strongInvalid.every((r) => r.convStatus === 'FAIL'),
    detail: `expected r ≤ ${STRONG_INVALID} → all FAIL (${strongInvalid.length} levels)`,
  });

  const magnitudeOk = rows.every(
    (r) =>
      r.measuredMinR <= r.expectedR + MAGNITUDE_TOLERANCE_HIGH &&
      r.measuredMinR >= r.expectedR - MAGNITUDE_TOLERANCE_LOW,
  );
  checks.push({
    id: 'magnitude:recovery',
    pass: magnitudeOk,
    detail: `measured ∈ [expected − ${MAGNITUDE_TOLERANCE_LOW}, expected + ${MAGNITUDE_TOLERANCE_HIGH}] for all levels`,
  });

  const monotone = rows.every((r, i) => i === 0 || r.measuredMinR <= rows[i - 1].measuredMinR + 0.02);
  checks.push({
    id: 'monotonicity',
    pass: monotone,
    detail: 'measured r non-increasing as measurement noise grows (±0.02)',
  });

  const retestStrong = rows.filter((r) => r.expectedRetestR >= 0.75);
  const retestWeak = rows.filter((r) => r.expectedRetestR <= 0.62);
  checks.push({
    id: 'retest:tracks-expectation',
    pass:
      retestStrong.length > 0 &&
      retestStrong.every((r) => r.retestStatus === 'PASS') &&
      retestWeak.every((r) => r.retestStatus === 'FAIL'),
    detail: `expected retest r ≥ 0.75 → PASS (${retestStrong.length}); ≤ 0.62 → FAIL (${retestWeak.length})`,
  });

  console.log('\n' + '─'.repeat(78));
  console.log('🧪 Discrimination checks');
  console.log('─'.repeat(78));
  let failed = 0;
  for (const c of checks) {
    console.log(`${c.pass ? '✅' : '❌'} ${c.id}: ${c.detail}`);
    if (!c.pass) failed++;
  }
  console.log(`\nSweep: ${checks.length - failed}/${checks.length} passed`);

  if (jsonOut) {
    const artifact = {
      meta: {
        timestamp: new Date().toISOString(),
        n,
        ipipItemNoise: IPIP_ITEM_NOISE,
        passThreshold: PASS_THRESHOLD,
        gateMode,
        seedBase: 20260911,
      },
      rows,
      checks,
      passed: failed === 0,
    };
    fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2));
    console.log(`✅ Artifact: ${path.relative(process.cwd(), jsonOut)}`);
  }

  process.exit(failed === 0 ? 0 : 1);
}

main();
