#!/usr/bin/env node
/**
 * Matcher Trial Evaluator (P5c gate-retune iteration tool)
 *
 * Fast inner loop for the post-debias matcher recalibration. Reads the
 * CURRENT on-disk state of archetypeRegistry.ts + matcherV2Gates.ts +
 * matcherV2.ts (no in-memory mutation — what you see on disk is what is
 * evaluated) and reports:
 *
 *   1. CENTROID ISOLATION — findBestMatchingArchetypesV2 on each of the 12
 *      registry centroids (the `simulate:personas:run:ci` metric, target 12/12).
 *   2. SEEDED BOUNDARY FIDELITY — 12 centroid + 33 boundary personas
 *      (seeded mulberry32 noise, same blend logic as generate-boundary-personas.ts)
 *      run end-to-end through the debiased engine (the run:all metric,
 *      pre-debias baseline 53.3%). Misses print the measured vector and
 *      top-3 matches for tuning.
 *   3. (with --random) RANDOM-CLICKER BASIN — n uniform-random sessions,
 *      per-archetype tally + per-trait drift (mirrors gate-random-drift.ts
 *      layer 2/3 semantics; the octopus/cat center-basin check).
 *
 * Usage:
 *   npx tsx scripts/simulate/evaluate-matcher-trial.ts
 *   npx tsx scripts/simulate/evaluate-matcher-trial.ts --random --n=300 --seed=42
 *   npx tsx scripts/simulate/evaluate-matcher-trial.ts --verbose   (per-persona top-3)
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  getFinalResult,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { archetypeRegistry, type ArchetypeId } from '../../packages/shared/src/personality/archetypeRegistry';
import { findBestMatchingArchetypesV2 } from '../../packages/shared/src/personality/matcherV2';
import {
  DEFAULT_ASSESSMENT_CONFIG,
  type TraitKey,
} from '../../packages/shared/src/personality/types';
import {
  mulberry32,
  streamSeed,
  selectAnswerAdversarial,
  GENERAL_TRAIT_MEAN,
  GENERAL_TRAIT_SD,
} from './lib/persona-utils';
import {
  measureVector,
  buildTrialPersonas,
  sampleTrait,
  sampleMember,
} from './recalibrate-centroids';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const SESSION_SAFETY_CAP = 25;

function parseArgs() {
  const options: Record<string, string> = {};
  for (const arg of process.argv.slice(2)) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ?? 'true';
    }
  }
  return {
    random: options.random === 'true',
    verbose: options.verbose === 'true',
    modes: options.modes === 'true',
    k: parseInt(options.k || '100', 10),
    n: parseInt(options.n || '300', 10),
    seed: parseInt(options.seed || '42', 10),
  };
}

function fmtVec(v: Record<TraitKey, number>): string {
  return ALL_TRAITS.map((t) => `${t}:${String(Math.round(v[t])).padStart(2)}`).join(' ');
}

function main() {
  const { random, verbose, modes, k, n, seed } = parseArgs();
  const archetypeIds = Object.keys(archetypeRegistry) as ArchetypeId[];

  // ── 0. Measured-vector MODE analysis (attractor structure) ──
  if (modes) {
    console.log('═'.repeat(96));
    console.log(`MEASURED-VECTOR MODES (K=${k} members/archetype around CURRENT registry centroids)`);
    console.log('   The debiased measurement map is attractor-structured: members funnel');
    console.log('   into a few answer-path equivalence classes. The MODE is the right');
    console.log('   central tendency here; the mean of a bimodal distribution is nobody.');
    console.log('═'.repeat(96));
    for (const id of archetypeIds) {
      const center = archetypeRegistry[id].profile.traitProfile;
      const counts = new Map<string, { vec: Record<TraitKey, number>; n: number }>();
      for (let i = 0; i < k; i++) {
        const latentRng = mulberry32(streamSeed(20260914, i, `modes-latent:${id}`));
        const sessionRng = mulberry32(streamSeed(20260914, i, `modes-session:${id}`));
        const measured = measureVector(sampleMember(latentRng, center), sessionRng);
        const key = fmtVec(measured);
        const entry = counts.get(key) ?? { vec: measured, n: 0 };
        entry.n++;
        counts.set(key, entry);
      }
      const sorted = [...counts.values()].sort((a, b) => b.n - a.n);
      // Exact-centroid persona measured vector (what the gate sees).
      const exactRng = mulberry32(streamSeed(20260914, 0, `trial-e2e:centroid-${id}`));
      const exactVec = measureVector(center, exactRng);
      const top3 = findBestMatchingArchetypesV2(exactVec, undefined, 3);
      console.log(`   ${id.padEnd(16)} exact-centroid → ${fmtVec(exactVec)} → assigned ${top3[0]?.archetype}`);
      for (const mode of sorted.slice(0, 3)) {
        const assigned = findBestMatchingArchetypesV2(mode.vec, undefined, 1)[0]?.archetype;
        console.log(`      mode ${((mode.n / k) * 100).toFixed(0).padStart(3)}%  ${fmtVec(mode.vec)}  → ${assigned}`);
      }
    }
    console.log('');
    return;
  }

  // ── 1. Centroid isolation ──
  console.log('═'.repeat(96));
  console.log('CENTROID ISOLATION (matcher on registry centroids, target 12/12)');
  console.log('═'.repeat(96));
  let isolationExact = 0;
  for (const id of archetypeIds) {
    const c = archetypeRegistry[id].profile.traitProfile;
    const top3 = findBestMatchingArchetypesV2({ ...c }, undefined, 3);
    const ok = top3[0]?.archetype === id;
    if (ok) isolationExact++;
    console.log(
      `   ${ok ? '✅' : '❌'} ${id.padEnd(16)} top1=${top3[0]?.archetype} (${top3[0]?.score.toFixed(1)})  top2=${top3[1]?.archetype} (${top3[1]?.score.toFixed(1)})  top3=${top3[2]?.archetype} (${top3[2]?.score.toFixed(1)})`
    );
  }
  console.log(`   → ${isolationExact}/12`);

  // ── 2. Seeded boundary + centroid end-to-end fidelity ──
  console.log('');
  console.log('═'.repeat(96));
  console.log('END-TO-END FIDELITY (seeded personas from CURRENT registry, clean sessions)');
  console.log('═'.repeat(96));
  const personas = buildTrialPersonas();
  let exact = 0;
  let similar = 0;
  const misses: string[] = [];
  for (const p of personas) {
    const rng = mulberry32(streamSeed(20260914, 0, `trial-e2e:${p.id}`));
    const measured = measureVector(p.traits, rng);
    const top3 = findBestMatchingArchetypesV2(measured, undefined, 3);
    const top = top3[0]?.archetype;
    const expectedRecord = archetypeRegistry[p.expected as ArchetypeId];
    const isSimilar = expectedRecord?.profile.confusableWith?.includes(top as ArchetypeId) ?? false;
    const isExact = top === p.expected;
    if (isExact) exact++;
    else if (isSimilar) similar++;
    else {
      misses.push(p.id);
      console.log(
        `   ❌ ${p.id.padEnd(14)} exp=${p.expected.padEnd(15)} got=${String(top).padEnd(15)} measured ${fmtVec(measured)}`
      );
      console.log(
        `        top3: ${top3.map((m) => `${m.archetype}=${m.score.toFixed(1)}`).join('  ')}`
      );
    }
    if (verbose && (isExact || isSimilar)) {
      console.log(
        `   ${isExact ? '✅' : '🟡'} ${p.id.padEnd(14)} exp=${p.expected.padEnd(15)} got=${String(top).padEnd(15)} measured ${fmtVec(measured)}`
      );
    }
  }
  console.log(
    `   → exact ${exact}/${personas.length} = ${((exact / personas.length) * 100).toFixed(1)}%  (baseline 53.3%, broken 35.6%)   similar+exact ${exact + similar}/${personas.length}`
  );

  // ── 3. Random-clicker basin ──
  if (random) {
    console.log('');
    console.log('═'.repeat(96));
    console.log(`RANDOM-CLICKER BASIN (n=${n}, seed=${seed})`);
    console.log('═'.repeat(96));
    const tally: Record<string, number> = {};
    const traitValues: Record<TraitKey, number[]> = { A: [], C: [], E: [], O: [], X: [], P: [] };
    for (let i = 0; i < n; i++) {
      const popRng = mulberry32(streamSeed(seed, i, 'trial-random-pop'));
      const latent = {} as Record<TraitKey, number>;
      for (const trait of ALL_TRAITS) latent[trait] = sampleTrait(popRng, GENERAL_TRAIT_MEAN, GENERAL_TRAIT_SD);
      const rng = mulberry32(streamSeed(seed, i, 'arm-random-clicker'));
      let state = initializeEngineState({ ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true });
      let asked = 0;
      while (true) {
        const question = selectNextQuestion(state);
        if (!question) break;
        state = processAnswer(state, question, selectAnswerAdversarial(question, 'random-clicker', latent, rng));
        if (++asked >= SESSION_SAFETY_CAP) break;
      }
      const final = getFinalResult(state);
      for (const trait of ALL_TRAITS) traitValues[trait].push(final.traitScores[trait]);
      tally[final.primaryArchetype] = (tally[final.primaryArchetype] ?? 0) + 1;
    }
    const sorted = Object.entries(tally).sort((a, b) => b[1] - a[1]);
    for (const [arch, count] of sorted) {
      console.log(`   ${arch.padEnd(16)} ${((count / n) * 100).toFixed(1).padStart(5)}%  (n=${count})`);
    }
    for (const trait of ALL_TRAITS) {
      const vs = traitValues[trait];
      const m = vs.reduce((a, b) => a + b, 0) / vs.length;
      console.log(`   trait ${trait}: mean ${m.toFixed(2)} (drift ${(m - 50 >= 0 ? '+' : '') + (m - 50).toFixed(2)})`);
    }
  }
}

main();
