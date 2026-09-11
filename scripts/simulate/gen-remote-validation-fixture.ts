#!/usr/bin/env node
/**
 * Synthetic remote-validation fixture generator.
 *
 * Produces a deterministic panel with KNOWN planted structure so the harness
 * can be verified before any real data exists. The generator draws a latent
 * Big Five profile, renders ACOEXP + IPIP measurements with controlled
 * attenuation, plants a 4-week retest, plants composition→同频 coefficients,
 * and plants a narrative-arm effect. The orchestrator's `--self-test` asserts
 * the analyses recover these planted quantities.
 *
 * Usage:
 *   tsx scripts/simulate/gen-remote-validation-fixture.ts [--n=400] [--seed=20260911]
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mulberry32 } from './lib/persona-utils';
import type {
  AcoexpTrait,
  BigFiveDomain,
  IpIpKeying,
  PanelDataset,
  PanelRespondent,
  TraitScores,
  VibeSession,
} from './lib/remote-validation/types';
import { ACOEXP_TRAITS, BIG_FIVE_DOMAINS } from './lib/remote-validation/types';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.join(__dirname, 'data');

const LATENT_SD = 15;
const V4_MEASUREMENT_SD = 8;
const RETEST_MEASUREMENT_SD = 8;
const IPIP_ITEM_NOISE_SD_RANGE = 0.7;

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function gaussian(rng: () => number, mu: number, sigma: number): number {
  const u1 = Math.max(1e-12, rng());
  const u2 = rng();
  return mu + sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

function loadKeying(): IpIpKeying {
  return JSON.parse(fs.readFileSync(path.join(DATA_DIR, 'ipip-bigfive-keying.json'), 'utf8'));
}

function buildTrueTraits(latent: Record<BigFiveDomain, number>, rng: () => number): TraitScores {
  return {
    A: latent.agreeableness,
    C: latent.conscientiousness,
    E: latent.emotional_stability,
    O: latent.openness,
    X: latent.extraversion,
    P: clamp(0.55 * latent.extraversion + 0.45 * gaussian(rng, 50, LATENT_SD), 0, 100),
  };
}

function measureV4(trueTraits: TraitScores, rng: () => number, sdBudget: number): TraitScores {
  const out = {} as TraitScores;
  for (const t of ACOEXP_TRAITS) {
    out[t] = clamp(trueTraits[t] + gaussian(rng, 0, sdBudget), 0, 100);
  }
  return out;
}

function simulateIpip(
  latent: Record<BigFiveDomain, number>,
  keying: IpIpKeying,
  rng: () => number,
  itemNoiseSd: number,
) {
  const responses: Record<string, number> = {};
  const range = keying.responseMax - keying.responseMin;
  for (const item of keying.items) {
    const target = latent[item.domain] / 100;
    const oriented = keying.responseMin + range * target;
    const rawTarget = item.reversed ? keying.responseMax + keying.responseMin - oriented : oriented;
    const noisy = rawTarget + gaussian(rng, 0, itemNoiseSd);
    responses[item.id] = clamp(Math.round(noisy), keying.responseMin, keying.responseMax);
  }
  return { responses };
}

export interface FixtureOptions {
  n: number;
  seed: number;
  sessionCount: number;
  narrativeEffect: number;
  /** SD of the V4 measurement error around the true ACOEXP profile. */
  v4NoiseSd?: number;
  /** SD of the 4-week retest measurement error. */
  retestNoiseSd?: number;
  /** Per-item IPIP response noise (1–5 scale). */
  ipipItemNoiseSd?: number;
}

export function buildFixture(options: FixtureOptions): PanelDataset {
  const rng = mulberry32(options.seed);
  const keying = loadKeying();
  const v4NoiseSd = options.v4NoiseSd ?? V4_MEASUREMENT_SD;
  const retestNoiseSd = options.retestNoiseSd ?? RETEST_MEASUREMENT_SD;
  const ipipNoiseSd = options.ipipItemNoiseSd ?? IPIP_ITEM_NOISE_SD_RANGE;

  const respondents: PanelRespondent[] = [];
  const v4ById = new Map<string, TraitScores>();

  for (let i = 0; i < options.n; i++) {
    const latent = {} as Record<BigFiveDomain, number>;
    for (const d of BIG_FIVE_DOMAINS) latent[d] = clamp(gaussian(rng, 50, LATENT_SD), 0, 100);

    const trueTraits = buildTrueTraits(latent, rng);
    const v4Scores = measureV4(trueTraits, rng, v4NoiseSd);
    const retestScores = measureV4(trueTraits, rng, retestNoiseSd);

    const arm = i % 2 === 0 ? 'answer_citing' : 'generic';
    const narrativeRating = clamp(
      4 + (arm === 'answer_citing' ? options.narrativeEffect : 0) + gaussian(rng, 0, 1.2),
      1,
      7,
    );

    const id = `R${String(i + 1).padStart(4, '0')}`;
    v4ById.set(id, v4Scores);
    respondents.push({
      participantId: id,
      v4: {
        traitScores: v4Scores,
        archetype: 'unknown',
        confidence: 0.7,
        completedAt: '2026-09-11T00:00:00.000Z',
      },
      ipip: simulateIpip(latent, keying, rng, ipipNoiseSd),
      retest: { traitScores: retestScores, completedAt: '2026-10-09T00:00:00.000Z' },
      narrativeArm: arm,
      narrativeRating: Math.round(narrativeRating * 10) / 10,
    });
  }

  const sessions: VibeSession[] = [];
  const ids = respondents.map((r) => r.participantId);
  const shuffled = [...ids];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  let cursor = 0;
  for (let s = 0; s < options.sessionCount && cursor < shuffled.length - 3; s++) {
    const size = 4 + Math.floor(rng() * 3);
    const memberIds = shuffled.slice(cursor, cursor + size);
    cursor += size;
    if (memberIds.length < 4) break;

    const traits = memberIds.map((id) => v4ById.get(id)!);
    const A = traits.map((t) => t.A);
    const C = traits.map((t) => t.C);
    const E = traits.map((t) => t.E);
    const X = traits.map((t) => t.X);
    const P = traits.map((t) => t.P);
    const meanA = A.reduce((a, b) => a + b, 0) / A.length;
    const meanC = C.reduce((a, b) => a + b, 0) / C.length;
    const minE = Math.min(...E);
    const spark = Math.max(...X.map((x, k) => Math.max(x, P[k])));
    const xVar = X.reduce((a, b) => a + (b - X.reduce((c, d) => c + d, 0) / X.length) ** 2, 0) / X.length;

    const sameFrequency = clamp(
      50 +
        0.3 * (meanA - 50) +
        0.2 * (meanC - 50) +
        0.4 * (minE - 50) +
        0.5 * (spark - 50) -
        0.1 * (xVar - 200) +
        gaussian(rng, 0, 6),
      0,
      100,
    );

    sessions.push({
      sessionId: `S${String(s + 1).padStart(4, '0')}`,
      completedAt: '2026-09-12T00:00:00.000Z',
      memberIds,
      sameFrequency: Math.round(sameFrequency * 10) / 10,
    });
  }

  return {
    meta: {
      panelId: 'synthetic-self-test',
      collectedAt: '2026-09-11T00:00:00.000Z',
      instrument: keying.instrument,
      notes: 'Generated fixture — planted structure for harness self-test only. NOT real panel data.',
    },
    respondents,
    vibeSessions: sessions,
    narrative: {
      arms: ['answer_citing', 'generic'],
      metric: 'perceived_accuracy_1_7',
      hypothesizedBetterArm: 'answer_citing',
    },
  };
}

/**
 * Analytic expectation for the attenuated convergent correlation given the
 * measurement-error SDs actually used. Lets the self-test and the validity
 * sweep assert recovery against a closed-form target rather than a hunch.
 */
export function expectedConvergentR(
  v4NoiseSd: number,
  ipipItemNoiseSd: number,
  itemsPerDomain = 10,
  responseRange = 4,
): number {
  const domainNoise = (ipipItemNoiseSd / Math.sqrt(itemsPerDomain)) * (100 / responseRange);
  return LATENT_SD ** 2 / Math.sqrt((LATENT_SD ** 2 + v4NoiseSd ** 2) * (LATENT_SD ** 2 + domainNoise ** 2));
}

/** Analytic expectation for 4-week test-retest given the two measurement-error SDs. */
export function expectedRetestR(v4NoiseSd: number, retestNoiseSd = RETEST_MEASUREMENT_SD): number {
  return LATENT_SD ** 2 / Math.sqrt((LATENT_SD ** 2 + v4NoiseSd ** 2) * (LATENT_SD ** 2 + retestNoiseSd ** 2));
}

function main() {
  const args = process.argv.slice(2);
  const n = parseInt(args.find((a) => a.startsWith('--n='))?.slice(4) ?? '400', 10);
  const seed = parseInt(args.find((a) => a.startsWith('--seed='))?.slice(7) ?? '20260911', 10);
  const sessionCount = parseInt(args.find((a) => a.startsWith('--sessions='))?.slice(11) ?? '80', 10);
  const narrativeEffect = parseFloat(args.find((a) => a.startsWith('--effect='))?.slice(9) ?? '0.6');
  const v4NoiseSd = parseFloat(args.find((a) => a.startsWith('--v4-noise='))?.slice(11) ?? String(V4_MEASUREMENT_SD));
  const ipipItemNoiseSd = parseFloat(args.find((a) => a.startsWith('--ipip-noise='))?.slice(13) ?? String(IPIP_ITEM_NOISE_SD_RANGE));

  const expectedConvergentRVal = expectedConvergentR(v4NoiseSd, ipipItemNoiseSd);
  const expectedRetestRVal = expectedRetestR(v4NoiseSd);

  const dataset = buildFixture({ n, seed, sessionCount, narrativeEffect, v4NoiseSd, ipipItemNoiseSd });
  (dataset.meta as Record<string, unknown>).planted = {
    expectedConvergentR: Math.round(expectedConvergentRVal * 1000) / 1000,
    expectedRetestR: Math.round(expectedRetestRVal * 1000) / 1000,
    narrativeEffect,
    vibeBetas: { meanA: 0.3, meanC: 0.2, minE: 0.4, spark: 0.5, xVariance: -0.1 },
    seed,
    v4NoiseSd,
    ipipItemNoiseSd,
  };

  const outPath = path.join(DATA_DIR, 'remote-validation-fixture.json');
  fs.writeFileSync(outPath, JSON.stringify(dataset, null, 2));

  console.log('🧪 Synthetic remote-validation fixture generated');
  console.log(`   Respondents: ${dataset.respondents.length}`);
  console.log(`   Vibe sessions: ${dataset.vibeSessions?.length ?? 0}`);
  console.log(`   Narrative effect planted: +${narrativeEffect}`);
  console.log(`   Expected convergent r: ${expectedConvergentRVal.toFixed(3)}`);
  console.log(`   Expected retest r: ${expectedRetestRVal.toFixed(3)}`);
  console.log(`   Output: ${path.relative(process.cwd(), outPath)}`);
}

const isDirectRun =
  !!process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isDirectRun) main();

