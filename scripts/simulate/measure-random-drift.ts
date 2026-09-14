#!/usr/bin/env node
/**
 * Random-Drift Measurement (P5b — question-bank debias instrument)
 *
 * Two lenses on the same question bank:
 *
 *   STATIC  — per-question net keying: for every question × trait, the mean
 *             option loading across ALL options (zeros included). Under
 *             uniform-random answering, a question whose per-trait option
 *             sum is S pushes that trait's running sum by S/nOptions in
 *             expectation. A zero-mean bank ⇒ zero expected drift under ANY
 *             adaptive selection path.
 *
 *   DYNAMIC — n uniform-random ("random-clicker") sessions through the full
 *             natural-termination V4 engine loop (same loop shape as
 *             run-adversarial-suite.ts / measure-signal-quality-gate.ts),
 *             over the documented 2-component mixture population. Reports
 *             per-trait mean final scores, per-trait drift vs 50, and the
 *             top-1 archetype distribution.
 *
 * Also reports per-trait question coverage (questions with ≥1 option loading
 * nonzero on the trait) so debias rounds can prove no trait is starved.
 *
 * Usage:
 *   npx tsx scripts/simulate/measure-random-drift.ts
 *   npx tsx scripts/simulate/measure-random-drift.ts --n=2000 --seed=42
 *   npx tsx scripts/simulate/measure-random-drift.ts --json-out=/tmp/rd.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  getFinalResult,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
import { archetypePrototypes } from '../../packages/shared/src/personality/prototypes';
import {
  DEFAULT_ASSESSMENT_CONFIG,
  TraitKey,
  AdaptiveQuestion,
} from '../../packages/shared/src/personality/types';
import {
  mulberry32,
  selectAnswerAdversarial,
  streamSeed,
  CENTROID_MIXTURE_WEIGHT,
  CENTROID_TRAIT_SD,
  GENERAL_TRAIT_MEAN,
  GENERAL_TRAIT_SD,
  TRAIT_MIN,
  TRAIT_MAX,
} from './lib/persona-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const SESSION_SAFETY_CAP = 25;

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
    n: parseInt(options.n || '300', 10),
    seed: parseInt(options.seed || '42', 10),
    jsonOutFile:
      options['json-out'] ||
      path.join(__dirname, 'data', 'random-drift-latest.json'),
  };
}

// ── Static bank keying ───────────────────────────────────────────────

interface StaticBankReport {
  /** Servable pool under DEFAULT_ASSESSMENT_CONFIG (ipsative ships dark). */
  servableQuestions: number;
  ipsativeExcluded: number;
  /** Per-trait: sum over servable questions of per-question mean loading. */
  perTraitExpectedDriftMass: Record<TraitKey, number>;
  /** Per-trait: mean option loading across every servable option. */
  perTraitMeanOptionLoading: Record<TraitKey, number>;
  /** Per-trait question coverage (≥1 option with nonzero loading). */
  perTraitQuestionCoverage: Record<TraitKey, number>;
  /** Questions whose per-trait option sum is non-zero (keyed), per trait. */
  perTraitKeyedQuestionCount: Record<TraitKey, number>;
  /** Worst offenders: top 15 by total absolute net keying. */
  worstOffenders: Array<{
    id: string;
    level: number;
    netSums: Record<TraitKey, number>;
  }>;
}

function staticReport(): StaticBankReport {
  const ipsativeOn = DEFAULT_ASSESSMENT_CONFIG.enableIpsativeItems === true;
  const servable = questionsV4.filter(
    (q) => ipsativeOn || q.questionType !== 'ipsative'
  );

  const driftMass: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const loadingSum: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const loadingCount: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const coverage: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const keyedCount: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };

  const offenders: Array<{ id: string; level: number; netSums: Record<TraitKey, number>; total: number }> = [];

  for (const q of servable) {
    const netSums: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
    for (const trait of ALL_TRAITS) {
      let hasNonzero = false;
      for (const opt of q.options) {
        const s = opt.traitScores[trait] ?? 0;
        netSums[trait] += s;
        loadingSum[trait] += s;
        loadingCount[trait]++;
        if (s !== 0) hasNonzero = true;
      }
      driftMass[trait] += netSums[trait] / q.options.length;
      if (hasNonzero) coverage[trait]++;
      if (netSums[trait] !== 0) keyedCount[trait]++;
    }
    offenders.push({
      id: q.id,
      level: q.level,
      netSums,
      total: ALL_TRAITS.reduce((s, t) => s + Math.abs(netSums[t]), 0),
    });
  }

  offenders.sort((a, b) => b.total - a.total);

  return {
    servableQuestions: servable.length,
    ipsativeExcluded: questionsV4.length - servable.length,
    perTraitExpectedDriftMass: roundRecord(driftMass, 3),
    perTraitMeanOptionLoading: roundRecord(
      Object.fromEntries(ALL_TRAITS.map((t) => [t, loadingSum[t] / loadingCount[t]])) as Record<TraitKey, number>,
      4
    ),
    perTraitQuestionCoverage: coverage,
    perTraitKeyedQuestionCount: keyedCount,
    worstOffenders: offenders.slice(0, 15).map((o) => ({
      id: o.id,
      level: o.level,
      netSums: roundRecord(o.netSums, 2),
    })),
  };
}

function roundRecord(r: Record<TraitKey, number>, digits: number): Record<TraitKey, number> {
  const f = Math.pow(10, digits);
  return Object.fromEntries(ALL_TRAITS.map((t) => [t, Math.round(r[t] * f) / f])) as Record<TraitKey, number>;
}

// ── Population (mirrors run-adversarial-suite.ts verbatim) ───────────

function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function sampleTrait(rng: () => number, mean: number, sd: number): number {
  for (let i = 0; i < 100; i++) {
    const v = mean + gaussian(rng) * sd;
    if (v >= TRAIT_MIN && v <= TRAIT_MAX) return v;
  }
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, mean));
}

interface SyntheticRespondent {
  id: string;
  trueTraits: Record<TraitKey, number>;
}

function generatePopulation(n: number, seed: number): SyntheticRespondent[] {
  const rng = mulberry32(streamSeed(seed, 0, 'population'));
  const centroidIds = Object.keys(archetypePrototypes);
  const respondents: SyntheticRespondent[] = [];
  for (let i = 0; i < n; i++) {
    const isCentroidArm = rng() < CENTROID_MIXTURE_WEIGHT;
    const trueTraits = {} as Record<TraitKey, number>;
    if (isCentroidArm) {
      const centroid = archetypePrototypes[centroidIds[Math.floor(rng() * centroidIds.length)]].traitProfile;
      for (const trait of ALL_TRAITS) trueTraits[trait] = sampleTrait(rng, centroid[trait], CENTROID_TRAIT_SD);
    } else {
      for (const trait of ALL_TRAITS) trueTraits[trait] = sampleTrait(rng, GENERAL_TRAIT_MEAN, GENERAL_TRAIT_SD);
    }
    respondents.push({ id: `S${String(i + 1).padStart(5, '0')}`, trueTraits });
  }
  return respondents;
}

// ── Dynamic random-clicker simulation ────────────────────────────────

interface DynamicReport {
  n: number;
  seed: number;
  perTraitMean: Record<TraitKey, number>;
  perTraitDrift: Record<TraitKey, number>;
  perTraitSd: Record<TraitKey, number>;
  archetypeTally: Record<string, number>;
  archetypeShares: Record<string, number>;
  maxArchetypeShare: number;
  meanQuestionsAsked: number;
}

function dynamicReport(n: number, seed: number): DynamicReport {
  const respondents = generatePopulation(n, seed);
  const traitValues: Record<TraitKey, number[]> = { A: [], C: [], E: [], O: [], X: [], P: [] };
  const archetypeTally: Record<string, number> = {};
  let questionsSum = 0;

  for (let i = 0; i < respondents.length; i++) {
    const rng = mulberry32(streamSeed(seed, i, 'arm-random-clicker'));
    let state = initializeEngineState({ ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true });
    let asked = 0;
    while (true) {
      const question = selectNextQuestion(state);
      if (!question) break;
      const answer = selectAnswerAdversarial(question, 'random-clicker', respondents[i].trueTraits, rng);
      state = processAnswer(state, question, answer);
      if (++asked >= SESSION_SAFETY_CAP) break;
    }
    questionsSum += asked;
    const final = getFinalResult(state);
    for (const trait of ALL_TRAITS) traitValues[trait].push(final.traitScores[trait]);
    archetypeTally[final.primaryArchetype] = (archetypeTally[final.primaryArchetype] ?? 0) + 1;
  }

  const perTraitMean = {} as Record<TraitKey, number>;
  const perTraitDrift = {} as Record<TraitKey, number>;
  const perTraitSd = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    const vs = traitValues[trait];
    const m = vs.reduce((a, b) => a + b, 0) / vs.length;
    perTraitMean[trait] = Math.round(m * 100) / 100;
    perTraitDrift[trait] = Math.round((m - 50) * 100) / 100;
    perTraitSd[trait] = Math.round(Math.sqrt(vs.reduce((s, v) => s + Math.pow(v - m, 2), 0) / vs.length) * 100) / 100;
  }

  const archetypeShares = Object.fromEntries(
    Object.entries(archetypeTally).map(([k, v]) => [k, Math.round((v / n) * 1000) / 10])
  );
  const maxArchetypeShare = Math.max(...Object.values(archetypeTally)) / n;

  return {
    n,
    seed,
    perTraitMean,
    perTraitDrift,
    perTraitSd,
    archetypeTally,
    archetypeShares,
    maxArchetypeShare: Math.round(maxArchetypeShare * 1000) / 10,
    meanQuestionsAsked: Math.round((questionsSum / n) * 100) / 100,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const { n, seed, jsonOutFile } = parseArgs();
  console.log('📏 Random-Drift Measurement (P5b)');
  console.log(`   Dynamic arm: n=${n} seed=${seed} uniform-random clicker`);
  console.log('');

  const staticR = staticReport();
  console.log('─'.repeat(78));
  console.log(`STATIC bank keying — servable pool ${staticR.servableQuestions} questions (ipsative excluded: ${staticR.ipsativeExcluded})`);
  console.log('   trait | expected drift mass | mean option loading | coverage | keyed questions');
  for (const trait of ALL_TRAITS) {
    console.log(
      `   ${trait}     | ${String(staticR.perTraitExpectedDriftMass[trait]).padStart(19)} | ${String(staticR.perTraitMeanOptionLoading[trait]).padStart(19)} | ${String(staticR.perTraitQuestionCoverage[trait]).padStart(8)} | ${staticR.perTraitKeyedQuestionCount[trait]}`
    );
  }
  console.log('');
  console.log('   Worst offenders (Σ|net| per question):');
  for (const o of staticR.worstOffenders.slice(0, 10)) {
    const nets = ALL_TRAITS.map((t) => `${t}:${o.netSums[t] >= 0 ? '+' : ''}${o.netSums[t]}`).join(' ');
    console.log(`     ${o.id.padEnd(18)} L${o.level}  ${nets}`);
  }

  const dyn = dynamicReport(n, seed);
  console.log('');
  console.log('─'.repeat(78));
  console.log(`DYNAMIC random-clicker (n=${dyn.n}, seed=${dyn.seed}, mean questions/session ${dyn.meanQuestionsAsked})`);
  console.log('   trait | mean  | drift vs 50 | sd');
  for (const trait of ALL_TRAITS) {
    const d = dyn.perTraitDrift[trait];
    console.log(
      `   ${trait}     | ${String(dyn.perTraitMean[trait]).padStart(5)} | ${(d >= 0 ? '+' : '') + d}          | ${dyn.perTraitSd[trait]} ${Math.abs(d) > 3 ? '  ⚠️ >±3' : ''}`
    );
  }
  console.log('');
  console.log('   Archetype distribution (share %, uniform ≈ 8.3%):');
  const sorted = Object.entries(dyn.archetypeShares).sort((a, b) => b[1] - a[1]);
  for (const [arch, share] of sorted) {
    console.log(`     ${arch.padEnd(16)} ${String(share).padStart(5)}%  (n=${dyn.archetypeTally[arch]}) ${share > 13 ? '  ⚠️ >13%' : ''}`);
  }
  console.log(`   Max archetype share: ${dyn.maxArchetypeShare}%`);

  const artifact = { generatedAt: new Date().toISOString(), static: staticR, dynamic: dyn };
  fs.writeFileSync(jsonOutFile, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: ${jsonOutFile}`);
}

main();
