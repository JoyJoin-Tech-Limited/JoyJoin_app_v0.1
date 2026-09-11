#!/usr/bin/env node
/**
 * Remote-validation — convergent-gate power analysis (P1).
 *
 * Settles the convergent decision rule and the panel size. For each candidate
 * gate mode, true per-trait validity, and N, estimates the probability the gate
 * PASSes when the instrument is genuinely valid. A high false-FAIL rate at a
 * true r comfortably above 0.6 means the rule is too strict for the panel size.
 *
 * Model: the five gated traits' observed correlations are sampled as
 *   z_obs ~ Normal(fisherZ(r_true), 1/sqrt(N-3));  r_obs = tanh(z_obs)
 * (Fisher-z sampling, traits treated as independent across domains).
 *
 * Usage:
 *   tsx scripts/simulate/run-remote-validation-power.ts [--reps=20000] [--json=<out>]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mulberry32 } from './lib/persona-utils';
import { fisherZ } from './lib/remote-validation/stats';
import {
  evaluateConvergentGate,
  CONVERGENT_GATE,
  type ConvergentGateMode,
} from './lib/remote-validation/analyses';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

const MODES: ConvergentGateMode[] = ['all', 'mean-floor'];
const TRUE_RS = [0.55, 0.6, 0.65, 0.7, 0.75];
const NS = [300, 400, 500];
const N_TRAITS = 5;
const POWER_TARGET = 0.9;
const POWER_REFERENCE_TRUE_R = 0.65;

function gaussian(rng: () => number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function passRate(
  mode: ConvergentGateMode,
  trueR: number,
  n: number,
  reps: number,
  seedBase: number,
): number {
  const rng = mulberry32(seedBase + Math.round(trueR * 1000) * 100000 + n);
  const zTrue = fisherZ(trueR);
  const se = 1 / Math.sqrt(n - 3);
  let passed = 0;
  for (let i = 0; i < reps; i++) {
    const rs: number[] = [];
    for (let t = 0; t < N_TRAITS; t++) {
      const z = zTrue + gaussian(rng) * se;
      rs.push(Math.tanh(z));
    }
    if (evaluateConvergentGate(rs, mode).pass) passed++;
  }
  return passed / reps;
}

/** Smallest N (step 25) clearing the power target at the reference true r. */
function requiredN(mode: ConvergentGateMode, reps: number, seedBase: number): number | null {
  for (let n = 100; n <= 1500; n += 25) {
    if (passRate(mode, POWER_REFERENCE_TRUE_R, n, reps, seedBase) >= POWER_TARGET) return n;
  }
  return null;
}

function main() {
  const args = process.argv.slice(2);
  const reps = parseInt(args.find((a) => a.startsWith('--reps='))?.slice(7) ?? '20000', 10);
  const jsonOut = args.find((a) => a.startsWith('--json='))?.slice(7);
  const seedBase = 0x5eed;

  console.log('═'.repeat(80));
  console.log('📐 Remote-Validation — Convergent-Gate Power Analysis');
  console.log('═'.repeat(80));
  console.log(`reps=${reps} | ${N_TRAITS} gated traits | gate modes: ${MODES.join(', ')}\n`);

  const matrix: Array<{ mode: ConvergentGateMode; trueR: number; passRate: Record<number, number> }> = [];
  for (const mode of MODES) {
    for (const trueR of TRUE_RS) {
      const row: Record<number, number> = {};
      for (const n of NS) row[n] = passRate(mode, trueR, n, reps, seedBase);
      matrix.push({ mode, trueR, passRate: row });
    }
  }

  for (const n of NS) {
    console.log(`N = ${n}  (PASS probability)`);
    console.log(`${'true r'.padEnd(9)} ${MODES.map((m) => m.padEnd(14)).join('')}`);
    console.log('─'.repeat(9 + MODES.length * 14));
    for (const trueR of TRUE_RS) {
      const cells = MODES.map((m) => {
        const row = matrix.find((r) => r.mode === m && r.trueR === trueR)!;
        return row.passRate[n].toFixed(3).padEnd(14);
      });
      console.log(`${trueR.toFixed(2).padEnd(9)} ${cells.join('')}`);
    }
    console.log('');
  }

  const required: Record<ConvergentGateMode, number | null> = {
    all: requiredN('all', reps, seedBase),
    'mean-floor': requiredN('mean-floor', reps, seedBase),
  };
  console.log('─'.repeat(80));
  console.log(`N required for ${(POWER_TARGET * 100).toFixed(0)}% power at true r = ${POWER_REFERENCE_TRUE_R}:`);
  for (const mode of MODES) {
    console.log(`  ${mode.padEnd(14)} N ≥ ${required[mode] ?? '>1500'}`);
  }
  console.log('');
  console.log('Gate definitions:');
  for (const mode of MODES) {
    const cfg = CONVERGENT_GATE[mode];
    console.log(`  ${mode.padEnd(14)} mean r ≥ ${cfg.meanMin}, min r ≥ ${cfg.floorMin}`);
  }

  if (jsonOut) {
    const artifact = {
      meta: {
        timestamp: new Date().toISOString(),
        reps,
        nTraits: N_TRAITS,
        trueRs: TRUE_RS,
        ns: NS,
        powerTarget: POWER_TARGET,
        powerReferenceTrueR: POWER_REFERENCE_TRUE_R,
        model: 'Fisher-z sampling, traits independent across domains',
        seedBase,
      },
      matrix,
      requiredN: required,
      gateDefinitions: CONVERGENT_GATE,
    };
    fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
    fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2));
    console.log(`\n✅ Artifact: ${path.relative(process.cwd(), jsonOut)}`);
  }
}

main();
