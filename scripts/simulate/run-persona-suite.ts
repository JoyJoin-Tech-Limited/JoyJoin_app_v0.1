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
  const { personas: personaFilter, noise, retest, isolationOnly, outFile } = parseArgs();

  console.log('🔬 Personality Test Simulation Suite');
  console.log(`   Personas: ${personaFilter}`);
  console.log(`   Noise:    ${noise}`);
  console.log(`   Retest:   ${retest}x per persona`);
  console.log(`   Mode:     ${isolationOnly ? 'matcher isolation only' : 'end-to-end + isolation'}`);
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
}

main();
