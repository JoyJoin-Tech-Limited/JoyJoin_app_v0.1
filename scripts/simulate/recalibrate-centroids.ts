#!/usr/bin/env node
/**
 * Centroid Recalibration (P5c — approved follow-up to the P5b question-bank
 * debias, commit d5ab60f95).
 *
 * ── Why this exists ──────────────────────────────────────────────────
 * P5b made the question bank zero-sum: measured trait vectors are now
 * 50-centered under random/neutral answering (per-trait drift ≤ 0.7, was
 * up to +15). The 12 archetype centroids in archetypeRegistry.ts were
 * calibrated to the OLD biased measurement scale, so measured vectors
 * translated toward 50 while the centroids stayed put — boundary-persona
 * end-to-end fidelity dropped from 53.3% (pre-debias) to ~31–36%.
 *
 * This script re-estimates each archetype's centroid on the DEBIASED
 * measurement scale: what vector does the post-debias engine actually
 * measure for a true member of that archetype?
 *
 * ── Estimator ────────────────────────────────────────────────────────
 * For each archetype A with old registry centroid c_A:
 *   1. Sample K idealized members: latent vectors ~ N(c_A, σ=10) per
 *      trait, truncated to [5, 95] — the documented Item-6 synthetic
 *      population contract (CENTROID_TRAIT_SD / TRAIT_MIN / TRAIT_MAX in
 *      lib/persona-utils.ts), so the sample matches the population model
 *      every other instrument in this suite uses.
 *   2. Run each member through a FULL natural-termination end-to-end
 *      session (DEFAULT_ASSESSMENT_CONFIG + V2 matcher, clean
 *      trait-faithful argmax answering — the honest-respondent model).
 *   3. Recalibrated centroid = per-trait MEAN of the K measured vectors
 *      (rounded to integers). The mean is the right central tendency for
 *      the matcher's distance geometry: it minimizes expected squared
 *      deviation between measured members and the centroid. The per-trait
 *      MEDIAN is reported alongside as a skew robustness check; a
 *      |mean − median| > 2 divergence is flagged, not silently averaged.
 *
 * ── Guards ───────────────────────────────────────────────────────────
 *   • RADICAL-MOVE STOP: any single trait moving > 15 points aborts with
 *     exit 1 — report instead of forcing it (per the approved method).
 *   • DIRECTIONAL SUMMARY: per-trait mean move across archetypes is
 *     printed; post-debias theory expects A/C/E/O to move DOWN more than
 *     X/P (the pre-debias positive keying inflated exactly those traits).
 *   • FIXED-POINT CHECK: one re-estimation step around the PROPOSED new
 *     centroid (fresh sample, same K) — if the pipeline's measured mean
 *     lands back within ~1 point per trait, the one-shot estimator is
 *     self-consistent on the debiased scale.
 *
 * ── Trial gates (in-memory, non-destructive) ─────────────────────────
 * After estimation the script mutates the registry IN MEMORY ONLY:
 *   • matcher isolation on the 12 new centroids (target 12/12 — the
 *     `simulate:personas:run:ci` gate);
 *   • seeded regeneration of the 33 boundary personas from the NEW
 *     centroids (same blend logic as generate-boundary-personas.ts but
 *     with mulberry32 noise instead of Math.random) + end-to-end fidelity
 *     (the `simulate:personas:run:all` metric, pre-debias baseline 53.3%).
 * The old values are restored before exit; nothing on disk is modified.
 *
 * ── Population baseline re-fit ───────────────────────────────────────
 * traitCorrection.ts POPULATION_BASELINE was fit on the biased scale
 * (capping is disabled at both call sites — matcherV2.ts correctTraits
 * and adaptiveEngine.ts — the constants are documentation/future-use
 * only). Re-fit here: clean honest sessions over the documented
 * 2-component mixture population (60% centroid-mixture around the
 * CURRENT on-disk centroids, 40% general N(50,15²), truncated [5,95]);
 * per-trait mean/std of measured vectors.
 *
 * Usage:
 *   npx tsx scripts/simulate/recalibrate-centroids.ts
 *   npx tsx scripts/simulate/recalibrate-centroids.ts --k=80 --pop=600 --seed=20260914
 *   npx tsx scripts/simulate/recalibrate-centroids.ts --json-out=/tmp/recal.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { archetypeRegistry, type ArchetypeId } from '../../packages/shared/src/personality/archetypeRegistry';
import { findBestMatchingArchetypesV2 } from '../../packages/shared/src/personality/matcherV2';
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
import {
  DEFAULT_ASSESSMENT_CONFIG,
  type TraitKey,
} from '../../packages/shared/src/personality/types';
import {
  mulberry32,
  streamSeed,
  selectAnswerByTraits,
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
/** Hard stop: a single-trait move beyond this aborts (approved-method guard). */
const RADICAL_MOVE_THRESHOLD = 15;
/** Skew flag: mean/median divergence worth a human look. */
const MEAN_MEDIAN_DIVERGENCE_FLAG = 2;
/** Fixed-point tolerance: one-step re-estimation drift per trait. */
const FIXED_POINT_WARN = 1.5;

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
    k: parseInt(options.k || '80', 10),
    pop: parseInt(options.pop || '600', 10),
    seed: parseInt(options.seed || '20260914', 10),
    jsonOut:
      options['json-out'] ||
      path.join(__dirname, 'data', 'centroid-recalibration-latest.json'),
    // DIAGNOSTIC ONLY: downgrades the radical-move STOP to a warning so the
    // trial gates can be inspected. Default (flag absent) keeps the approved
    // guard: stop and report, never force a >15pt move through.
    allowRadical: options['allow-radical'] === 'true',
  };
}

// ── Sampling (mirrors gate-random-drift.ts / measure-random-drift.ts) ──

export function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

export function sampleTrait(rng: () => number, mean: number, sd: number): number {
  for (let i = 0; i < 100; i++) {
    const v = mean + gaussian(rng) * sd;
    if (v >= TRAIT_MIN && v <= TRAIT_MAX) return v;
  }
  return Math.max(TRAIT_MIN, Math.min(TRAIT_MAX, mean));
}

export function sampleMember(
  rng: () => number,
  center: Record<TraitKey, number>
): Record<TraitKey, number> {
  const traits = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    traits[trait] = sampleTrait(rng, center[trait], CENTROID_TRAIT_SD);
  }
  return traits;
}

// ── End-to-end measurement ───────────────────────────────────────────

/**
 * Run one honest (clean argmax) natural-termination session for the given
 * latent vector and return the measured trait vector the debiased engine
 * reports (flag-off raw == FinalResultV2 traitScores).
 */
export function measureVector(
  latent: Record<TraitKey, number>,
  rng: () => number
): Record<TraitKey, number> {
  let state = initializeEngineState({ ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true });
  let asked = 0;
  while (true) {
    const question = selectNextQuestion(state);
    if (!question) break;
    state = processAnswer(state, question, selectAnswerByTraits(question, latent, 'clean', rng));
    if (++asked >= SESSION_SAFETY_CAP) break;
  }
  const measured = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    measured[trait] = state.traitConfidences[trait]?.score ?? 50;
  }
  return measured;
}

// ── Statistics ───────────────────────────────────────────────────────

export function mean(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0) / xs.length;
}

export function median(xs: number[]): number {
  const sorted = [...xs].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
}

export function std(xs: number[]): number {
  const m = mean(xs);
  return Math.sqrt(xs.reduce((s, v) => s + (v - m) * (v - m), 0) / xs.length);
}

interface TraitEstimate {
  mean: number;
  median: number;
  sd: number;
  standardError: number;
}

type VectorEstimate = Record<TraitKey, TraitEstimate>;

/**
 * Estimate the measured centroid for one archetype: K idealized members
 * sampled around `center`, each run through the debiased pipeline.
 */
export function estimateMeasuredCentroid(
  archetypeId: string,
  center: Record<TraitKey, number>,
  k: number,
  seed: number,
  streamTag: string
): VectorEstimate {
  const samples: Record<TraitKey, number[]> = { A: [], C: [], E: [], O: [], X: [], P: [] };
  for (let i = 0; i < k; i++) {
    const latentRng = mulberry32(streamSeed(seed, i, `${streamTag}-latent:${archetypeId}`));
    const sessionRng = mulberry32(streamSeed(seed, i, `${streamTag}-session:${archetypeId}`));
    const latent = sampleMember(latentRng, center);
    const measured = measureVector(latent, sessionRng);
    for (const trait of ALL_TRAITS) samples[trait].push(measured[trait]);
  }
  const estimate = {} as VectorEstimate;
  for (const trait of ALL_TRAITS) {
    const vs = samples[trait];
    estimate[trait] = {
      mean: mean(vs),
      median: median(vs),
      sd: std(vs),
      standardError: std(vs) / Math.sqrt(vs.length),
    };
  }
  return estimate;
}

// ── Trial-gate helpers (in-memory) ───────────────────────────────────

export function centroidVector(id: ArchetypeId): Record<TraitKey, number> {
  return { ...archetypeRegistry[id].profile.traitProfile };
}

/** In-place mutation so archetypePrototypes (built by reference) sees it. */
export function applyCentroidsInMemory(next: Record<string, Record<TraitKey, number>>): void {
  for (const [id, traits] of Object.entries(next)) {
    Object.assign(archetypeRegistry[id as ArchetypeId].profile.traitProfile, traits);
  }
}

/**
 * Seeded re-implementation of generate-boundary-personas.ts blend logic
 * (identical confusion-pair collection, blend ratios [0.4, 0.5, 0.6], ±3
 * noise) so the trial fidelity number is deterministic. The committed
 * generator uses Math.random for the noise; the committed persona files
 * therefore redraw per `simulate:personas:generate` run, and run:all
 * after regeneration will differ from this seeded trial by the persona
 * noise draw only.
 */
export function buildTrialPersonas(): Array<{
  id: string;
  traits: Record<TraitKey, number>;
  expected: string;
  category: 'centroid' | 'boundary';
}> {
  const personas: Array<{ id: string; traits: Record<TraitKey, number>; expected: string; category: 'centroid' | 'boundary' }> = [];
  const ids = Object.keys(archetypeRegistry) as ArchetypeId[];

  for (const id of ids) {
    personas.push({ id: `centroid-${id}`, traits: centroidVector(id), expected: id, category: 'centroid' });
  }

  const pairs = new Set<string>();
  let counter = 1;
  for (const id of ids) {
    for (const confusable of archetypeRegistry[id].profile.confusableWith) {
      const pairKey = [id, confusable].sort().join(':');
      if (pairs.has(pairKey)) continue;
      pairs.add(pairKey);
      const [a, b] = pairKey.split(':') as [ArchetypeId, ArchetypeId];
      for (const ratio of [0.4, 0.5, 0.6]) {
        const rng = mulberry32(streamSeed(42, counter, 'trial-boundary-noise'));
        const blended = {} as Record<TraitKey, number>;
        for (const trait of ALL_TRAITS) {
          const base = Math.round(
            archetypeRegistry[a].profile.traitProfile[trait] * (1 - ratio) +
              archetypeRegistry[b].profile.traitProfile[trait] * ratio
          );
          const noise = (rng() - 0.5) * 3 * 2;
          blended[trait] = Math.max(15, Math.min(95, base + noise));
        }
        personas.push({
          id: `boundary-${String(counter).padStart(2, '0')}`,
          traits: blended,
          expected: ratio < 0.5 ? a : b,
          category: 'boundary',
        });
        counter++;
      }
    }
  }
  return personas;
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const { k, pop, seed, jsonOut, allowRadical } = parseArgs();
  console.log('🎯 Centroid Recalibration (P5c — post-debias scale refit)');
  console.log(`   Estimator: per-trait MEAN of K=${k} idealized members (σ=${CENTROID_TRAIT_SD}, trunc [${TRAIT_MIN},${TRAIT_MAX}]), clean end-to-end sessions, seed=${seed}`);
  if (allowRadical) console.log('   ⚠️  --allow-radical: guard downgraded to warning (DIAGNOSTIC ONLY — do not apply output blindly)');
  console.log('');

  const archetypeIds = Object.keys(archetypeRegistry) as ArchetypeId[];

  // ── Phase 0: exact-centroid probe — WHY fidelity collapsed ──
  // The exact OLD centroid of each archetype through the debiased pipeline:
  // the measured vector and the archetype the matcher assigns it. This is
  // the direct evidence of the scale mismatch (centroid personas missing
  // end-to-end post-debias).
  console.log('─'.repeat(96));
  console.log('PHASE 0 — exact OLD centroids through the DEBIASED pipeline (why fidelity collapsed)');
  console.log('─'.repeat(96));
  const exactProbe: Record<string, { measured: Record<TraitKey, number>; assigned: string }> = {};
  for (const id of archetypeIds) {
    const rng = mulberry32(streamSeed(seed, 0, `probe:${id}`));
    const measured = measureVector(centroidVector(id), rng);
    const assigned = findBestMatchingArchetypesV2(measured)[0]?.archetype ?? '—';
    exactProbe[id] = { measured, assigned };
    console.log(
      `   ${id.padEnd(16)} → measured ${ALL_TRAITS.map((t) => `${t}:${String(measured[t]).padStart(2)}`).join(' ')}  → assigned ${assigned}${assigned === id ? ' ✅' : ' ❌'}`
    );
  }
  console.log('');

  // ── Phase 0b: bank reachable-range statics (explains radical moves) ──
  // For each trait, the per-question max/min option loading across the
  // servable bank; the realistic measurement ceiling/floor for a member who
  // ALWAYS picks the most extreme option on that trait is
  // 50 ± 15 × mean(per-question extreme loading). Old centroids outside the
  // reachable band MUST move radically to stay matchable — that is a scale
  // property of the debiased bank, not an estimator artifact.
  console.log('─'.repeat(96));
  console.log('PHASE 0b — debiased-bank reachable measurement range per trait (static)');
  console.log('─'.repeat(96));
  const reachable: Record<TraitKey, { ceiling: number; floor: number }> = {} as never;
  {
    const servable = questionsV4.filter((q) => q.questionType !== 'ipsative');
    for (const trait of ALL_TRAITS) {
      const loaded = servable.filter((q) =>
        q.options.some((o) => (o.traitScores?.[trait] ?? 0) !== 0)
      );
      const maxMean = mean(loaded.map((q) => Math.max(...q.options.map((o) => o.traitScores?.[trait] ?? 0))));
      const minMean = mean(loaded.map((q) => Math.min(...q.options.map((o) => o.traitScores?.[trait] ?? 0))));
      reachable[trait] = {
        ceiling: Math.round(50 + 15 * maxMean),
        floor: Math.round(50 + 15 * minMean),
      };
      console.log(
        `   ${trait}: questions-with-loading ${String(loaded.length).padStart(3)}  mean max-loading ${maxMean.toFixed(2)}  mean min-loading ${minMean.toFixed(2)}  → reachable ≈ [${reachable[trait].floor}, ${reachable[trait].ceiling}]`
      );
    }
  }
  console.log('');

  // ── Phase 1: one-shot estimation around the OLD centroids ──
  const oldCentroids: Record<string, Record<TraitKey, number>> = {};
  const estimates: Record<string, VectorEstimate> = {};
  const newCentroids: Record<string, Record<TraitKey, number>> = {};

  for (const id of archetypeIds) {
    oldCentroids[id] = centroidVector(id);
    estimates[id] = estimateMeasuredCentroid(id, oldCentroids[id], k, seed, 'recal');
    const next = {} as Record<TraitKey, number>;
    for (const trait of ALL_TRAITS) next[trait] = Math.round(estimates[id][trait].mean);
    newCentroids[id] = next;
  }

  // ── Phase 2: guards ──
  const radicalViolations: string[] = [];
  const skewFlags: string[] = [];
  for (const id of archetypeIds) {
    for (const trait of ALL_TRAITS) {
      const move = newCentroids[id][trait] - oldCentroids[id][trait];
      if (Math.abs(move) > RADICAL_MOVE_THRESHOLD) {
        radicalViolations.push(`${id}.${trait}: ${oldCentroids[id][trait]} → ${newCentroids[id][trait]} (move ${move > 0 ? '+' : ''}${move})`);
      }
      if (Math.abs(estimates[id][trait].mean - estimates[id][trait].median) > MEAN_MEDIAN_DIVERGENCE_FLAG) {
        skewFlags.push(`${id}.${trait}: mean ${estimates[id][trait].mean.toFixed(1)} vs median ${estimates[id][trait].median.toFixed(1)}`);
      }
    }
  }

  console.log('─'.repeat(96));
  console.log('PER-ARCHETYPE CENTROID MOVES (old → new, integer-rounded mean)');
  console.log('─'.repeat(96));
  console.log(
    `${'archetype'.padEnd(16)} ${ALL_TRAITS.map((t) => t.padEnd(18)).join('')}`
  );
  for (const id of archetypeIds) {
    const cells = ALL_TRAITS.map((trait) => {
      const o = oldCentroids[id][trait];
      const n = newCentroids[id][trait];
      const d = n - o;
      return `${o}→${n} (${d >= 0 ? '+' : ''}${d})`.padEnd(18);
    });
    console.log(`${id.padEnd(16)} ${cells.join('')}`);
  }
  console.log('');

  // Directional summary: mean move per trait across archetypes.
  console.log('Directional summary (mean move per trait across the 12 archetypes):');
  const meanMove = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    meanMove[trait] = mean(archetypeIds.map((id) => newCentroids[id][trait] - oldCentroids[id][trait]));
    console.log(`   ${trait}: ${meanMove[trait] >= 0 ? '+' : ''}${meanMove[trait].toFixed(2)}`);
  }
  const aceO = mean((['A', 'C', 'E', 'O'] as TraitKey[]).map((t) => meanMove[t]));
  const xP = mean((['X', 'P'] as TraitKey[]).map((t) => meanMove[t]));
  console.log(`   A/C/E/O mean move ${aceO.toFixed(2)} vs X/P mean move ${xP.toFixed(2)} (expect A/C/E/O more negative: the debias removed their positive keying)`);
  console.log('');

  if (skewFlags.length > 0) {
    console.log(`⚠️  mean/median skew flags (>${MEAN_MEDIAN_DIVERGENCE_FLAG} pts — informational):`);
    for (const f of skewFlags) console.log(`   - ${f}`);
    console.log('');
  }

  if (radicalViolations.length > 0) {
    console.error(`${allowRadical ? '⚠️' : '❌ RADICAL-MOVE STOP —'} the following traits need a move > 15 points.`);
    if (!allowRadical) {
      console.error('   Per the approved method: STOP and report instead of forcing it.');
      console.error('   (Re-run with --allow-radical to inspect trial gates diagnostically.)');
      for (const v of radicalViolations) console.error(`   - ${v}`);
      process.exit(1);
    }
    console.error('   --allow-radical set: continuing for DIAGNOSTIC trial gates only.');
    for (const v of radicalViolations) console.error(`   - ${v}`);
  } else {
    console.log(`✅ Radical-move guard: all per-trait moves within ±${RADICAL_MOVE_THRESHOLD}`);
  }
  console.log('');

  // ── Phase 3: one-step fixed-point stability check ──
  console.log('─'.repeat(96));
  console.log(`FIXED-POINT CHECK — re-estimate around the PROPOSED centroids (fresh K=${k} sample)`);
  console.log('─'.repeat(96));
  let maxFixedPointDrift = 0;
  const fixedPoint: Record<string, number> = {};
  for (const id of archetypeIds) {
    const secondPass = estimateMeasuredCentroid(id, newCentroids[id], k, seed, 'recal-fp');
    for (const trait of ALL_TRAITS) {
      const drift = Math.abs(secondPass[trait].mean - newCentroids[id][trait]);
      maxFixedPointDrift = Math.max(maxFixedPointDrift, drift);
      fixedPoint[`${id}.${trait}`] = Math.round(drift * 100) / 100;
    }
  }
  console.log(`   max per-trait |second-pass mean − proposed|: ${maxFixedPointDrift.toFixed(2)} ${maxFixedPointDrift <= FIXED_POINT_WARN ? '✅ self-consistent' : '⚠️ exceeds warn threshold ' + FIXED_POINT_WARN}`);
  console.log('');

  // ── Phase 4: trial gates in memory (registry restored after) ──
  console.log('─'.repeat(96));
  console.log('TRIAL GATES (in-memory apply; registry on disk untouched)');
  console.log('─'.repeat(96));
  applyCentroidsInMemory(newCentroids);

  // 4a. matcher isolation on the new centroids (the run:ci gate).
  let isolationExact = 0;
  const isolationMisses: string[] = [];
  for (const id of archetypeIds) {
    const top = findBestMatchingArchetypesV2(centroidVector(id))[0];
    if (top?.archetype === id) isolationExact++;
    else isolationMisses.push(`${id} → ${top?.archetype ?? '—'}`);
  }
  console.log(`   matcher isolation: ${isolationExact}/12 ${isolationExact === 12 ? '✅' : `❌ misses: ${isolationMisses.join('; ')}`}`);

  // 4b. seeded boundary personas from NEW centroids → end-to-end fidelity.
  const trialPersonas = buildTrialPersonas();
  let e2eExact = 0;
  let e2eSimilar = 0;
  const e2eMisses: string[] = [];
  for (const p of trialPersonas) {
    const rng = mulberry32(streamSeed(seed, 0, `trial-e2e:${p.id}`));
    const measured = measureVector(p.traits, rng);
    const top = findBestMatchingArchetypesV2(measured)[0];
    const expectedRecord = archetypeRegistry[p.expected as ArchetypeId];
    const similar = expectedRecord?.profile.confusableWith?.includes(top?.archetype as ArchetypeId) ?? false;
    if (top?.archetype === p.expected) e2eExact++;
    else if (similar) e2eSimilar++;
    else e2eMisses.push(`${p.id} exp=${p.expected} got=${top?.archetype ?? '—'}`);
  }
  const fidelity = e2eExact / trialPersonas.length;
  console.log(`   end-to-end fidelity (seeded personas, n=${trialPersonas.length}): ${e2eExact}/${trialPersonas.length} = ${(fidelity * 100).toFixed(1)}% (pre-debias baseline 53.3%, post-debias broken 35.6%)  similar+exact ${e2eExact + e2eSimilar}/${trialPersonas.length}`);
  if (e2eMisses.length > 0) {
    console.log(`   misses: ${e2eMisses.join('; ')}`);
  }

  // ── Phase 5: population baseline re-fit (for traitCorrection.ts) ──
  // Fit against the CURRENT on-disk centroids (the live scale). This is the
  // measured-vector distribution of the documented population model as the
  // debiased pipeline reports it TODAY — the honest re-fit target for
  // POPULATION_BASELINE regardless of whether the centroid recalibration
  // is applied.
  console.log('');
  console.log('─'.repeat(96));
  console.log(`POPULATION BASELINE RE-FIT (n=${pop} clean sessions, 2-component mixture around CURRENT centroids)`);
  console.log('─'.repeat(96));
  const popValues: Record<TraitKey, number[]> = { A: [], C: [], E: [], O: [], X: [], P: [] };
  for (let i = 0; i < pop; i++) {
    const rng = mulberry32(streamSeed(seed, i, 'recal-population'));
    const isCentroidArm = rng() < CENTROID_MIXTURE_WEIGHT;
    const latent = {} as Record<TraitKey, number>;
    if (isCentroidArm) {
      const id = archetypeIds[Math.floor(rng() * archetypeIds.length)];
      for (const trait of ALL_TRAITS) latent[trait] = sampleTrait(rng, oldCentroids[id][trait], CENTROID_TRAIT_SD);
    } else {
      for (const trait of ALL_TRAITS) latent[trait] = sampleTrait(rng, GENERAL_TRAIT_MEAN, GENERAL_TRAIT_SD);
    }
    const sessionRng = mulberry32(streamSeed(seed, i, 'recal-population-session'));
    const measured = measureVector(latent, sessionRng);
    for (const trait of ALL_TRAITS) popValues[trait].push(measured[trait]);
  }
  const populationBaseline = { mean: {} as Record<TraitKey, number>, std: {} as Record<TraitKey, number> };
  for (const trait of ALL_TRAITS) {
    populationBaseline.mean[trait] = Math.round(mean(popValues[trait]));
    populationBaseline.std[trait] = Math.round(std(popValues[trait]));
    console.log(`   ${trait}: mean ${mean(popValues[trait]).toFixed(2)} (→${populationBaseline.mean[trait]})  std ${std(popValues[trait]).toFixed(2)} (→${populationBaseline.std[trait]})`);
  }

  // Restore old values (defense-in-depth: the process exits after this,
  // but never leave a mutated singleton behind).
  applyCentroidsInMemory(oldCentroids);

  // ── Artifact ──
  const artifact = {
    generatedAt: new Date().toISOString(),
    method: {
      estimator: 'per-trait mean of K idealized-member measured vectors (clean end-to-end, natural termination)',
      kPerArchetype: k,
      memberSampling: `N(oldCentroid, sd=${CENTROID_TRAIT_SD}) truncated [${TRAIT_MIN}, ${TRAIT_MAX}] (Item-6 contract)`,
      seed,
      fixedPointCheck: 'one re-estimation pass around the proposed centroid, fresh sample',
      populationBaselineFit: `n=${pop} clean sessions over 60% centroid-mixture (CURRENT on-disk centroids) + 40% general N(${GENERAL_TRAIT_MEAN},${GENERAL_TRAIT_SD}²)`,
    },
    oldCentroids,
    newCentroids,
    exactOldCentroidProbe: exactProbe,
    reachableRange: reachable,
    moves: Object.fromEntries(
      archetypeIds.map((id) => [
        id,
        Object.fromEntries(ALL_TRAITS.map((t) => [t, newCentroids[id][t] - oldCentroids[id][t]])),
      ])
    ),
    estimates: Object.fromEntries(
      archetypeIds.map((id) => [
        id,
        Object.fromEntries(
          ALL_TRAITS.map((t) => [
            t,
            {
              mean: Math.round(estimates[id][t].mean * 100) / 100,
              median: Math.round(estimates[id][t].median * 100) / 100,
              sd: Math.round(estimates[id][t].sd * 100) / 100,
              se: Math.round(estimates[id][t].standardError * 100) / 100,
            },
          ])
        ),
      ])
    ),
    directionalSummary: { perTraitMeanMove: meanMove, aceOMeanMove: aceO, xpMeanMove: xP },
    guards: {
      radicalMoveThreshold: RADICAL_MOVE_THRESHOLD,
      radicalViolations,
      skewFlags,
      maxFixedPointDrift: Math.round(maxFixedPointDrift * 100) / 100,
    },
    trialGates: {
      matcherIsolation: `${isolationExact}/12`,
      isolationMisses,
      endToEndFidelity: Math.round(fidelity * 1000) / 10,
      endToEndExact: e2eExact,
      endToEndSimilar: e2eSimilar,
      personaCount: trialPersonas.length,
      e2eMisses,
      note: 'Seeded personas (mulberry32 noise). run:all after `simulate:personas:generate` redraws persona noise with Math.random, so the committed-suite number will differ by the noise draw.',
    },
    populationBaseline,
  };
  fs.mkdirSync(path.dirname(jsonOut), { recursive: true });
  fs.writeFileSync(jsonOut, JSON.stringify(artifact, null, 2));
  console.log('');
  console.log(`💾 Artifact: ${jsonOut}`);
}

// Run main only when invoked directly (helpers are imported by
// evaluate-matcher-trial.ts for the gate-retune iteration loop).
const invokedDirectly = process.argv[1]?.endsWith('recalibrate-centroids.ts');
if (invokedDirectly) main();
