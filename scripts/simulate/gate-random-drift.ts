#!/usr/bin/env node
/**
 * Random-Drift Regression Gate (P5b — locked 2026-09-14)
 *
 * Locks the question-bank debias in CI. Three layers:
 *
 *   1. STATIC KEYING LOCK (deterministic, no sampling): every servable
 *      (non-ipsative) question × trait must have option loadings summing to
 *      exactly 0. This is the debias invariant itself — a future hand-edit
 *      that re-keys a question fails immediately. Ipsative items are exempt
 *      (flag-gated dark; deliberately structured debit design).
 *
 *   2. DYNAMIC DRIFT LOCK: n=300 (seed=42) uniform-random sessions through
 *      the full natural-termination engine must yield per-trait means within
 *      50 ± 3. Achieved at lock time: max |drift| = 0.7 — the ±3 budget is
 *      the contract target, not the achieved value, so benign future bank
 *      edits have headroom.
 *
 *   3. DISTRIBUTION GUARDS: the random-arm archetype distribution is
 *      dominated by FIXED matcher geometry around the center (the octopus
 *      basin holds ≥31% for ANY noise cloud around 50 — measured by sweeping
 *      per-trait σ 8–30 through findBestMatchingArchetypesV2 directly;
 *      matcherV2/centroids are outside P5b scope). The gate therefore locks:
 *        a. max share ≤ 35% — guards a catastrophic geometry collapse
 *           (achieved 30.3% octopus);
 *        b. the four archetypes the PRE-debias positive keying inflated
 *           (spider 23.6%, koala 20.6%, turtle 15.3%, dolphin_calm 12.4% at
 *           n=2000) stay deflated: spider/koala/dolphin_calm ≤ 13%,
 *           turtle ≤ 15% (achieved 13.0–13.3%; its basin is fed by the
 *           low-X center cloud, a matcher-geometry property, not keying).
 *
 * Exit code 1 on any violation. Wired into `npm run simulate:gate`.
 *
 * Usage: npx tsx scripts/simulate/gate-random-drift.ts [--n=300] [--seed=42]
 */

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

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const SESSION_SAFETY_CAP = 25;

/** Contract target (achieved at lock: ≤ 0.7). */
const TRAIT_DRIFT_MAX_ABS = 3;
/** Catastrophic-geometry guard (achieved at lock: 30.3% octopus). */
const MAX_ARCHETYPE_SHARE = 0.35;
/**
 * Pre-debias bias-favorites must stay deflated. Achieved at lock:
 * spider 4.7%, koala 0.7%, dolphin_calm 1.7%, turtle 13.0% (n=300 seed=42).
 */
const BIAS_FAVORITE_CAPS: Record<string, number> = {
  spider: 0.13,
  koala: 0.13,
  dolphin_calm: 0.13,
  turtle: 0.15,
};

function parseArgs() {
  const options: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ?? 'true';
    }
  }
  return { n: parseInt(options.n || '300', 10), seed: parseInt(options.seed || '42', 10) };
}

// ── Layer 1: static keying lock ──────────────────────────────────────

function checkStaticKeying(): string[] {
  const failures: string[] = [];
  let cells = 0;
  for (const q of questionsV4) {
    if (q.questionType === 'ipsative') continue; // dark, structured debit
    for (const trait of ALL_TRAITS) {
      cells++;
      const sum = q.options.reduce((s, o) => s + (o.traitScores?.[trait] ?? 0), 0);
      if (sum !== 0) {
        failures.push(`${q.id} trait ${trait}: option loadings sum ${sum} ≠ 0 (re-keyed)`);
      }
      for (const o of q.options) {
        const v = o.traitScores?.[trait] ?? 0;
        if (Math.abs(v) > 6) {
          failures.push(`${q.id} option ${o.value} trait ${trait}: loading ${v} outside [-6, +6]`);
        }
      }
    }
  }
  console.log(`   static keying: ${cells} servable question×trait cells checked`);
  return failures;
}

// ── Layer 2+3: dynamic random-clicker arm ────────────────────────────

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

function generatePopulation(n: number, seed: number): Array<Record<TraitKey, number>> {
  const rng = mulberry32(streamSeed(seed, 0, 'population'));
  const centroidIds = Object.keys(archetypePrototypes);
  const out: Array<Record<TraitKey, number>> = [];
  for (let i = 0; i < n; i++) {
    const isCentroidArm = rng() < CENTROID_MIXTURE_WEIGHT;
    const trueTraits = {} as Record<TraitKey, number>;
    if (isCentroidArm) {
      const centroid = archetypePrototypes[centroidIds[Math.floor(rng() * centroidIds.length)]].traitProfile;
      for (const trait of ALL_TRAITS) trueTraits[trait] = sampleTrait(rng, centroid[trait], CENTROID_TRAIT_SD);
    } else {
      for (const trait of ALL_TRAITS) trueTraits[trait] = sampleTrait(rng, GENERAL_TRAIT_MEAN, GENERAL_TRAIT_SD);
    }
    out.push(trueTraits);
  }
  return out;
}

function main() {
  const { n, seed } = parseArgs();
  console.log('🚦 Random-Drift Regression Gate (P5b)');
  console.log(`   dynamic arm: n=${n} seed=${seed} uniform-random clicker`);

  const failures: string[] = [];

  // Layer 1
  const staticFailures = checkStaticKeying();
  failures.push(...staticFailures);
  console.log(`   ${staticFailures.length === 0 ? '✅' : '❌'} static keying lock (zero-sum per question×trait)`);

  // Layer 2+3
  const population = generatePopulation(n, seed);
  const traitValues: Record<TraitKey, number[]> = { A: [], C: [], E: [], O: [], X: [], P: [] };
  const tally: Record<string, number> = {};
  for (let i = 0; i < n; i++) {
    const rng = mulberry32(streamSeed(seed, i, 'arm-random-clicker'));
    let state = initializeEngineState({ ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true });
    let asked = 0;
    while (true) {
      const question = selectNextQuestion(state);
      if (!question) break;
      state = processAnswer(state, question, selectAnswerAdversarial(question, 'random-clicker', population[i], rng));
      if (++asked >= SESSION_SAFETY_CAP) break;
    }
    const final = getFinalResult(state);
    for (const trait of ALL_TRAITS) traitValues[trait].push(final.traitScores[trait]);
    tally[final.primaryArchetype] = (tally[final.primaryArchetype] ?? 0) + 1;
  }

  console.log('');
  for (const trait of ALL_TRAITS) {
    const vs = traitValues[trait];
    const m = vs.reduce((a, b) => a + b, 0) / vs.length;
    const drift = m - 50;
    const ok = Math.abs(drift) <= TRAIT_DRIFT_MAX_ABS;
    if (!ok) failures.push(`trait ${trait} drift ${drift.toFixed(2)} exceeds ±${TRAIT_DRIFT_MAX_ABS}`);
    console.log(`   ${ok ? '✅' : '❌'} trait ${trait}: mean ${m.toFixed(2)} (drift ${drift >= 0 ? '+' : ''}${drift.toFixed(2)}, budget ±${TRAIT_DRIFT_MAX_ABS})`);
  }

  console.log('');
  const maxShare = Math.max(...Object.values(tally)) / n;
  const maxArchetype = Object.entries(tally).sort((a, b) => b[1] - a[1])[0];
  const maxOk = maxShare <= MAX_ARCHETYPE_SHARE;
  if (!maxOk) failures.push(`max archetype share ${(maxShare * 100).toFixed(1)}% (${maxArchetype[0]}) exceeds ${MAX_ARCHETYPE_SHARE * 100}%`);
  console.log(`   ${maxOk ? '✅' : '❌'} max archetype share ${(maxShare * 100).toFixed(1)}% (${maxArchetype[0]}) ≤ ${MAX_ARCHETYPE_SHARE * 100}%`);

  for (const [arch, cap] of Object.entries(BIAS_FAVORITE_CAPS)) {
    const share = (tally[arch] ?? 0) / n;
    const ok = share <= cap;
    if (!ok) failures.push(`bias-favorite ${arch} share ${(share * 100).toFixed(1)}% exceeds cap ${cap * 100}%`);
    console.log(`   ${ok ? '✅' : '❌'} bias-favorite ${arch}: ${(share * 100).toFixed(1)}% ≤ ${cap * 100}%`);
  }

  console.log('');
  if (failures.length > 0) {
    console.log(`❌ GATE FAILED — ${failures.length} violation(s):`);
    for (const f of failures) console.log(`   - ${f}`);
    process.exitCode = 1;
  } else {
    console.log('✅ GATE PASSED — debias locked.');
  }
}

main();
