#!/usr/bin/env node
/**
 * Signal-Quality Gate Measurement (P5a)
 *
 * The calibration instrument for packages/shared/src/personality/responseSignalQuality.ts.
 * Measures the two numbers the sprint contract locks:
 *
 *   FALSE-FLAG rate (budget ≤ 5%): genuine persona answer patterns flagged
 *   'low'. Genuine arm = all-personas.json (12 centroids + 33 boundaries)
 *   run end-to-end under clean AND moderate noise (moderate is the realistic
 *   worst case for false flags).
 *
 *   TRUE-FLAG rate (target ≥ 80%): the random-clicker arm over the SAME
 *   documented 2-component mixture population as run-adversarial-suite.ts
 *   (constants mirrored verbatim via persona-utils exports; n=300, seed=42).
 *   Other adversarial arms are reported for information only.
 *
 * Also dumps the raw trait-dispersion distributions (genuine vs random) so
 * the SIGNAL_QUALITY_TRAIT_DISPERSION_FLAG cut can be audited at a glance.
 *
 * Usage:
 *   tsx scripts/simulate/measure-signal-quality-gate.ts
 *   tsx scripts/simulate/measure-signal-quality-gate.ts --n=300 --seed=42
 *   tsx scripts/simulate/measure-signal-quality-gate.ts --json-out=/tmp/sqg.json
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { archetypePrototypes } from '../../packages/shared/src/personality/prototypes';
import { findBestMatchingArchetypesV2 } from '../../packages/shared/src/personality/matcherV2';
import { DEFAULT_ASSESSMENT_CONFIG, TraitKey } from '../../packages/shared/src/personality/types';
import {
  assessResponseSignalQuality,
  computeSignalQualityMetrics,
} from '../../packages/shared/src/personality/responseSignalQuality';
import {
  ADVERSARIAL_TYPES,
  AdversarialType,
  Persona,
  mulberry32,
  selectAnswerAdversarial,
  selectAnswerByTraits,
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
const FALSE_FLAG_BUDGET = 0.05;
const TRUE_FLAG_TARGET = 0.8;

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
    jsonOutFile: options['json-out'] || path.join(__dirname, 'data', 'signal-quality-gate-latest.json'),
  };
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

// ── Session runner (same loop shape as the adversarial suite) ────────

type AnswerPolicy =
  | { kind: 'persona'; traits: Record<TraitKey, number>; noise: 'clean' | 'moderate' }
  | { kind: 'arm'; arm: 'clean-control' | AdversarialType; traits: Record<TraitKey, number> };

function runSession(policy: AnswerPolicy, rng: () => number) {
  let state = initializeEngineState({ ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true });
  let asked = 0;
  while (true) {
    const question = selectNextQuestion(state);
    if (!question) break;
    const answer =
      policy.kind === 'persona'
        ? selectAnswerByTraits(question, policy.traits, policy.noise, rng)
        : policy.arm === 'clean-control'
          ? selectAnswerByTraits(question, policy.traits, 'clean', rng)
          : selectAnswerAdversarial(question, policy.arm, policy.traits, rng);
    state = processAnswer(state, question, answer);
    if (++asked >= SESSION_SAFETY_CAP) break;
  }
  const verdict = assessResponseSignalQuality(state.questionHistory);
  const metrics = computeSignalQualityMetrics(state.questionHistory);
  return { verdict, metrics, questionsAsked: asked };
}

// ── Reporting helpers ────────────────────────────────────────────────

function quantiles(values: number[]): { p10: number; p50: number; p90: number; p99: number; max: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const q = (p: number) => sorted[Math.min(sorted.length - 1, Math.floor(p * sorted.length))] ?? NaN;
  return { p10: q(0.1), p50: q(0.5), p90: q(0.9), p99: q(0.99), max: sorted[sorted.length - 1] ?? NaN };
}

interface ArmSummary {
  sessions: number;
  flaggedLow: number;
  flagRate: number;
  incoherence: ReturnType<typeof quantiles> | null;
  direction: ReturnType<typeof quantiles> | null;
  longestRunMax: number;
  maxShareP99: number;
}

function summarize(records: Array<ReturnType<typeof runSession>>): ArmSummary {
  const incoherences = records.map((r) => r.metrics.incoherence).filter((d): d is number => d !== null);
  const directions = records.map((r) => r.metrics.meanAbsReferenceDirection).filter((d): d is number => d !== null);
  return {
    sessions: records.length,
    flaggedLow: records.filter((r) => r.verdict.quality === 'low').length,
    flagRate: records.filter((r) => r.verdict.quality === 'low').length / records.length,
    incoherence: incoherences.length > 0 ? quantiles(incoherences) : null,
    direction: directions.length > 0 ? quantiles(directions) : null,
    longestRunMax: Math.max(...records.map((r) => r.metrics.longestIdenticalRun)),
    maxShareP99: quantiles(records.map((r) => r.metrics.maxSameOptionShare)).p99,
  };
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const { n, seed, jsonOutFile } = parseArgs();
  console.log('🎚️  Signal-Quality Gate Measurement (P5a)');
  console.log(`   Population: n=${n} seed=${seed}`);
  console.log('');

  // ── GENUINE arm: curated personas, clean + moderate noise ──
  const personas = JSON.parse(
    fs.readFileSync(path.join(__dirname, 'data', 'all-personas.json'), 'utf8')
  ) as Persona[];

  const rawDump: Array<{ group: string; incoherence: number | null; direction: number | null; neutralShare: number; quality: string; usableTraits: number; answers: number; spread: number | null; strongTraits: number }> = [];
  const genuineRecords: Record<'clean' | 'moderate', Array<ReturnType<typeof runSession>>> = {
    clean: [],
    moderate: [],
  };
  for (const [pi, persona] of personas.entries()) {
    for (const noise of ['clean', 'moderate'] as const) {
      const rng = mulberry32(streamSeed(seed, pi, `persona-${noise}`));
      const r = runSession({ kind: 'persona', traits: persona.traitProfile, noise }, rng);
      genuineRecords[noise].push(r);
      rawDump.push({ group: `genuine-${noise}`, incoherence: r.metrics.incoherence, direction: r.metrics.meanAbsReferenceDirection, neutralShare: r.metrics.neutralResponseShare, quality: r.verdict.quality, usableTraits: r.metrics.traitsWithUsableSamples, answers: r.metrics.answerCount, spread: r.metrics.incoherenceSpread, strongTraits: r.metrics.strongTraitCount });
    }
  }
  const genuineClean = summarize(genuineRecords.clean);
  const genuineModerate = summarize(genuineRecords.moderate);
  const genuineAll = summarize([...genuineRecords.clean, ...genuineRecords.moderate]);

  // ── ADVERSARIAL arms over the mixture population ──
  const respondents = generatePopulation(n, seed);
  const arms: Array<'clean-control' | AdversarialType> = [
    'clean-control',
    ...ADVERSARIAL_TYPES.filter((a) => a !== 'self-image-inflated-differential'),
  ];
  const armSummaries: Record<string, ArmSummary> = {};
  for (const arm of arms) {
    const records = respondents.map((respondent, i) => {
      const r = runSession({ kind: 'arm', arm, traits: respondent.trueTraits }, mulberry32(streamSeed(seed, i, `arm-${arm}`)));
      rawDump.push({ group: `arm-${arm}`, incoherence: r.metrics.incoherence, direction: r.metrics.meanAbsReferenceDirection, neutralShare: r.metrics.neutralResponseShare, quality: r.verdict.quality, usableTraits: r.metrics.traitsWithUsableSamples, answers: r.metrics.answerCount, spread: r.metrics.incoherenceSpread, strongTraits: r.metrics.strongTraitCount });
      return r;
    });
    armSummaries[arm] = summarize(records);
  }

  // ── Report ──
  const pct = (x: number) => `${(x * 100).toFixed(1)}%`;
  console.log('─'.repeat(78));
  console.log('GENUINE arm (false-flag budget ≤ 5%)');
  console.log(`   personas=${personas.length} × {clean, moderate} = ${genuineAll.sessions} sessions`);
  for (const [label, s] of [['clean', genuineClean], ['moderate', genuineModerate], ['combined', genuineAll]] as const) {
    console.log(
      `   ${label.padEnd(9)} flagged ${s.flaggedLow}/${s.sessions} = ${pct(s.flagRate)}` +
      (s.incoherence ? `   incoherence p50=${s.incoherence.p50.toFixed(3)} p90=${s.incoherence.p90.toFixed(3)} p99=${s.incoherence.p99.toFixed(3)} max=${s.incoherence.max.toFixed(3)}` : '') +
      (s.direction ? `   |dir| p10=${s.direction.p10.toFixed(3)} p50=${s.direction.p50.toFixed(3)}` : '') +
      `   longestRun max=${s.longestRunMax} maxShare p99=${s.maxShareP99.toFixed(2)}`
    );
  }
  console.log('');
  console.log('ADVERSARIAL arms (true-flag target on random-clicker ≥ 80%)');
  for (const arm of arms) {
    const s = armSummaries[arm];
    console.log(
      `   ${arm.padEnd(28)} flagged ${String(s.flaggedLow).padStart(3)}/${s.sessions} = ${pct(s.flagRate)}` +
      (s.incoherence ? `   incoherence p10=${s.incoherence.p10.toFixed(3)} p50=${s.incoherence.p50.toFixed(3)} p90=${s.incoherence.p90.toFixed(3)}` : '') +
      (s.direction ? `   |dir| p10=${s.direction.p10.toFixed(3)} p50=${s.direction.p50.toFixed(3)} p90=${s.direction.p90.toFixed(3)}` : '') +
      `   longestRun max=${s.longestRunMax}`
    );
  }
  console.log('─'.repeat(78));

  const falseFlagRate = genuineAll.flagRate;
  const trueFlagRate = armSummaries['random-clicker'].flagRate;
  const cleanControlFlagRate = armSummaries['clean-control'].flagRate;
  console.log(`FALSE-FLAG (genuine, combined):      ${pct(falseFlagRate)}  (budget ≤ ${pct(FALSE_FLAG_BUDGET)})  ${falseFlagRate <= FALSE_FLAG_BUDGET ? '✅ PASS' : '❌ FAIL'}`);
  console.log(`FALSE-FLAG (clean-control, n=${n}):  ${pct(cleanControlFlagRate)}  (reference)`);
  console.log(`TRUE-FLAG  (random-clicker, n=${n}): ${pct(trueFlagRate)}  (target ≥ ${pct(TRUE_FLAG_TARGET)})  ${trueFlagRate >= TRUE_FLAG_TARGET ? '✅ PASS' : '❌ FAIL'}`);

  const artifact = {
    generatedAt: new Date().toISOString(),
    n,
    seed,
    budgets: { falseFlagMax: FALSE_FLAG_BUDGET, trueFlagMin: TRUE_FLAG_TARGET },
    genuine: { clean: genuineClean, moderate: genuineModerate, combined: genuineAll },
    adversarial: armSummaries,
    rawDump,
    verdict: {
      falseFlagRate,
      trueFlagRate,
      cleanControlFlagRate,
      pass: falseFlagRate <= FALSE_FLAG_BUDGET && trueFlagRate >= TRUE_FLAG_TARGET,
    },
  };
  fs.writeFileSync(jsonOutFile, JSON.stringify(artifact, null, 2));
  console.log(`\nArtifact: ${jsonOutFile}`);

  if (!artifact.verdict.pass) process.exitCode = 1;
}

main();
