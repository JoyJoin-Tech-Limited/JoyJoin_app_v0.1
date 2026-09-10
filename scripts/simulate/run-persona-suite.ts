#!/usr/bin/env node
/**
 * Unified Persona Simulation Runner
 * Runs end-to-end adaptive assessment + matcher isolation on curated personas
 *
 * Usage:
 *   tsx scripts/simulate/run-persona-suite.ts --personas=centroids --noise=clean
 *   tsx scripts/simulate/run-persona-suite.ts --personas=boundaries --noise=moderate
 *   tsx scripts/simulate/run-persona-suite.ts --personas=all --noise=moderate --retest=3
 *   tsx scripts/simulate/run-persona-suite.ts --personas=centroids --isolation-only
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  type Persona,
  type SimulationRunResult,
  type MatcherIsolationResult,
  type NoiseMode,
  runAssessmentSimulation,
  runMatcherIsolation,
  formatConsoleReport,
  formatMatcherIsolationReport,
} from './lib/persona-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── CLI Arg Parsing ──────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};

  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ?? 'true';
    }
  }

  return {
    personas: (options.personas as 'centroids' | 'boundaries' | 'all') || 'all',
    noise: (options.noise as NoiseMode) || 'clean',
    retest: parseInt(options.retest || '1', 10),
    isolationOnly: options['isolation-only'] === 'true',
    outFile: options.out || '',
    // Plan Item 3 A/B: opt-in only. Runs end-to-end sessions TWICE per
    // persona — flag-off reference and enableTraitShrinkage flag-on via
    // engine-level config override — and reports the paired assignment
    // identity + max per-trait shrink delta (AC-3.3 evidence). Forces the
    // end-to-end path even under --isolation-only (isolation has no engine
    // confidence, so shrinkage cannot apply there; the isolation results
    // above are unaffected and stay flag-free).
    shrinkageOn: options.shrinkage === 'on',
  };
}

// ── Persona Loading ──────────────────────────────────────────────────

function loadPersonas(filter: 'centroids' | 'boundaries' | 'all'): Persona[] {
  const allPath = path.join(__dirname, 'data', 'all-personas.json');

  if (!fs.existsSync(allPath)) {
    console.error('❌ Persona data not found. Run: tsx scripts/simulate/generate-boundary-personas.ts');
    process.exit(1);
  }

  const all = JSON.parse(fs.readFileSync(allPath, 'utf8')) as Persona[];

  if (filter === 'centroids') return all.filter((p) => p.category === 'centroid');
  if (filter === 'boundaries') return all.filter((p) => p.category === 'boundary');
  return all;
}

// ── Main Runner ──────────────────────────────────────────────────────

function main() {
  const { personas: personaFilter, noise, retest, isolationOnly, outFile, shrinkageOn } = parseArgs();

  console.log('🔬 Personality Test Simulation Suite');
  console.log(`   Personas: ${personaFilter}`);
  console.log(`   Noise:    ${noise}`);
  console.log(`   Retest:   ${retest}x per persona`);
  console.log(`   Mode:     ${isolationOnly ? 'matcher isolation only' : 'end-to-end + isolation'}${shrinkageOn ? ' + shrinkage A/B (engine-level config)' : ''}`);
  console.log('');

  const personas = loadPersonas(personaFilter);
  console.log(`Loaded ${personas.length} personas\n`);

  const endToEndResults: SimulationRunResult[] = [];
  const isolationResults: MatcherIsolationResult[] = [];

  // Matcher isolation (fast — run first)
  console.log('⚡ Running matcher isolation...');
  for (const persona of personas) {
    const result = runMatcherIsolation(persona);
    isolationResults.push(result);
  }

  console.log(formatMatcherIsolationReport(isolationResults, 'Matcher Isolation Results'));

  // End-to-end simulation (slow — only if not isolation-only)
  if (!isolationOnly) {
    console.log('🔄 Running end-to-end adaptive simulation...');
    for (const persona of personas) {
      for (let run = 0; run < retest; run++) {
        const result = runAssessmentSimulation(persona, noise, retest > 1 ? run + 1 : undefined);
        endToEndResults.push(result);
      }
    }

    console.log(formatConsoleReport(endToEndResults, 'End-to-End Adaptive Simulation Results'));
  }

  // ── Plan Item 3 (AC-3.3) shrinkage A/B ─────────────────────────────
  // Paired flag-off / flag-on end-to-end runs (engine-level config override).
  // Evidence: per-persona assignment identity (with the documented exact
  // score-tie carve-out) and the max per-trait shrink delta across the
  // cohort — must be < 2 points (contract bound).
  let shrinkageSummary: { maxDelta: number; flips: string[]; tieFlips: string[] } | null = null;
  if (shrinkageOn) {
    console.log('🧪 Running shrinkage A/B (Plan Item 3, enableTraitShrinkage via engine config)...');
    const flagOff: SimulationRunResult[] = [];
    const flagOn: SimulationRunResult[] = [];
    for (const persona of personas) {
      flagOff.push(runAssessmentSimulation(persona, noise, retest > 1 ? 1 : undefined));
      flagOn.push(
        runAssessmentSimulation(persona, noise, retest > 1 ? 1 : undefined, {
          enableTraitShrinkage: true,
        })
      );
    }
    const flips: string[] = [];
    const tieFlips: string[] = [];
    let maxDelta = 0;
    console.log('');
    console.log('─'.repeat(96));
    console.log(
      `${'Persona'.padEnd(24)} ${'Off assigns'.padEnd(14)} ${'On assigns'.padEnd(14)} ${'Max Δtrait'.padEnd(11)} Verdict`
    );
    console.log('─'.repeat(96));
    for (let i = 0; i < personas.length; i++) {
      const off = flagOff[i];
      const on = flagOn[i];
      const delta = on.maxShrinkageDelta ?? 0;
      maxDelta = Math.max(maxDelta, delta);
      // Exact-tie carve-out (measured 2026-09-10, e.g. the spider session):
      // when the flag-off top-2 match SCORES are exactly equal, the primary
      // survives only via the matcher's confidence tie-break and any epsilon
      // input perturbation flips it — a pre-existing knife-edge, not a
      // shrinkage regression. Reported separately, not counted as a flip.
      const exactTie =
        off.top3Matches.length >= 2 &&
        Math.abs(off.top3Matches[0].score - off.top3Matches[1].score) < 1e-9;
      const same = off.assignedArchetype === on.assignedArchetype;
      if (!same) {
        const entry = `${off.personaId}: ${off.assignedArchetype}→${on.assignedArchetype}`;
        if (exactTie) tieFlips.push(entry);
        else flips.push(entry);
      }
      console.log(
        `${off.personaLabel.slice(0, 23).padEnd(24)} ${(off.assignedArchetype ?? '—').padEnd(14)} ${(on.assignedArchetype ?? '—').padEnd(14)} ${delta.toFixed(3).padEnd(11)} ${same ? '✅ identical' : exactTie ? '🟰 tie-break flip' : '❌ FLIP'}`
      );
    }
    console.log('─'.repeat(96));
    console.log(
      `   Max per-trait shrink delta: ${maxDelta.toFixed(3)} (contract bound < 2)  |  flips: ${flips.length}  |  exact-tie flips (documented): ${tieFlips.length}${tieFlips.length ? ` [${tieFlips.join('; ')}]` : ''}`
    );
    console.log('');
    shrinkageSummary = { maxDelta, flips, tieFlips };
  }

  // Summary stats
  const exactIsolation = isolationResults.filter((r) => r.isExactMatch).length;
  const exactEndToEnd = endToEndResults.filter((r) => r.isExactMatch).length;

  console.log('');
  console.log('═'.repeat(80));
  console.log('  FINAL SUMMARY');
  console.log('═'.repeat(80));
  console.log(`  Matcher isolation exact match: ${exactIsolation}/${isolationResults.length} (${((exactIsolation / isolationResults.length) * 100).toFixed(1)}%)`);
  if (!isolationOnly) {
    console.log(`  End-to-end exact match:        ${exactEndToEnd}/${endToEndResults.length} (${((exactEndToEnd / endToEndResults.length) * 100).toFixed(1)}%)`);
  }
  console.log('═'.repeat(80));
  console.log('');

  // Write JSON artifact if requested
  if (outFile) {
    const artifact = {
      meta: {
        timestamp: new Date().toISOString(),
        personaFilter,
        noise,
        retest,
        isolationOnly,
        personaCount: personas.length,
      },
      isolation: isolationResults,
      endToEnd: endToEndResults,
    };

    const outPath = path.resolve(outFile);
    fs.writeFileSync(outPath, JSON.stringify(artifact, null, 2), 'utf8');
    console.log(`💾 Wrote results to ${outPath}\n`);
  }

  // Exit code: 0 if all centroids match, 1 otherwise
  if (personaFilter === 'centroids' && exactIsolation < isolationResults.length) {
    console.error('❌ CENTROID REGRESSION DETECTED — not all centroids matched exactly');
    process.exit(1);
  }

  // Plan Item 3 (AC-3.3) gate: clean high-confidence personas must be
  // near-identity under shrinkage — max centroid trait delta < 2 and zero
  // non-tie assignment flips.
  if (shrinkageSummary && personaFilter === 'centroids') {
    if (shrinkageSummary.maxDelta >= 2 || shrinkageSummary.flips.length > 0) {
      console.error(
        `❌ SHRINKAGE NO-REGRESSION FAILED — maxDelta=${shrinkageSummary.maxDelta.toFixed(3)} (bound < 2), non-tie flips=${shrinkageSummary.flips.length}`
      );
      process.exit(1);
    }
    console.log('✅ Shrinkage no-regression gate passed (AC-3.3: delta < 2, no non-tie flips).');
  }
}

main();
