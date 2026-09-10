#!/usr/bin/env node
/**
 * Archetype Boundary Stability Sweep — Plan Item 8 / Metric M8
 *
 * Numerically measures how fragile each of the 12 archetype centroids is under
 * trait-vector perturbation. For every centroid it draws seeded perturbations at
 * two radii (±5, ±10), runs each perturbed vector through the REAL MatcherV2 in
 * matcher-isolation mode (the same `findBestMatchingArchetypesV2` entry point
 * `runMatcherIsolation` uses — no engine sessions, no mocks), and reports:
 *
 *   - flip rate  = share of samples whose top-1 archetype ≠ the source centroid
 *   - absorbers  = which archetype(s) took the flips → a ranked fragile-pair table
 *   - clamping   = how often the [5,95] clamp fires (a geometry fact, see below)
 *
 * Thresholds (LOCKED after the first baseline run, AC-8.2):
 *   flip ≤ 5%  @ ±5
 *   flip ≤ 20% @ ±10
 *
 * Modes:
 *   --mode=baseline (default) — report + artifacts, ALWAYS exit 0. Use this to
 *                               establish/report the baseline.
 *   --mode=gated              — same sweep, but exit 1 if ANY cell exceeds its
 *                               locked threshold (regression gate).
 *
 * Determinism: identical `--seed` reproduces every number (bag of seeded
 * streams, one per centroid×radius via the shared `mulberry32`/`streamSeed`
 * helpers). The printed `contentHash` is a deterministic digest of the numeric
 * payload (excluding wall-clock metadata) — two same-seed runs must match.
 *
 * Perturbation distributions (Item 8 verifier amendment A1, P3):
 *   - `uniform` (LOCKED GATE ARM): each trait independently jittered by
 *     Uniform[−r, +r], then clamped to [5, 95]. Bounds the perturbation to
 *     exactly the declared radius, so "±10" means no trait ever moves more than
 *     10 points. Centroids near a bound (e.g. corgi X=95, octopus O=95) have
 *     an asymmetric effective distribution — half of the raw draws clamp flat
 *     at the bound; reported per cell (`clampEvents`) as a geometry fact.
 *   - `normal` (secondary robustness arm, NOT the gate): each trait
 *     independently jittered by Normal(0, σ=CENTROID_TRAIT_SD=10), the SAME σ
 *     as Item 6's centroid-mixture ground truth. Uniform ±10 has SD≈5.8, so the
 *     uniform arm can be optimistic; this arm is reported alongside so the
 *     asymmetry is visible. Thresholds for the normal arm reuse the ±10 bar
 *     (20%) as a documented context bar only — the locked M8 gate counts
 *     uniform cells.
 *
 * Flip classification (A2): every flipped sample is split by whether its
 * (source → absorber) pair is registered (`CONFUSABLE_ARCHETYPE_PAIRS` /
 * `PERSISTENT_CONFUSION_PAIRS`) — a "confusable flip" addressable by a targeted
 * confusion gate — or unregistered ("hard flip", requirement a centroid redraw).
 *
 * Usage:
 *   tsx scripts/simulate/run-boundary-sweep.ts
 *   tsx scripts/simulate/run-boundary-sweep.ts --mode=gated --seed=20260910
 *   tsx scripts/simulate/run-boundary-sweep.ts --samples=1000 --out=docs/reports/custom.md
 *   tsx scripts/simulate/run-boundary-sweep.ts --repeat=2   # in-process determinism check
 *
 * Hard boundary: this instrument is READ-ONLY over the engine/matcher/prototypes.
 * It never edits centroids, confusion pairs, or matcher code.
 */

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

import { archetypePrototypes } from '../../packages/shared/src/personality/prototypes';
import { getAllArchetypeIds } from '../../packages/shared/src/personality/archetypeRegistry';
import { findBestMatchingArchetypesV2 } from '../../packages/shared/src/personality/matcherV2';
import {
  CONFUSABLE_ARCHETYPE_PAIRS,
  type TraitKey,
} from '../../packages/shared/src/personality/types';
import { PERSISTENT_CONFUSION_PAIRS } from '../../packages/shared/src/personality/adaptiveEngine';
import { mulberry32, streamSeed, CENTROID_TRAIT_SD } from './lib/persona-utils';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// ── Constants ────────────────────────────────────────────────────────

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const TRAIT_MIN = 5;
const TRAIT_MAX = 95;

/** Perturbation distribution of a cell. `uniform` is the LOCKED M8 gate arm. */
type Distribution = 'uniform' | 'normal';

/** Uniform perturbation radii, in trait points (the locked gate arms). */
const RADII = [5, 10] as const;
/** Secondary Normal(c, σ) arm: σ = Item 6's centroid-mixture σ (A1). */
const NORMAL_SIGMA = CENTROID_TRAIT_SD;
/**
 * Locked M8 thresholds. Uniform cells are the gate (AC-8.2); the normal arm
 * reuses the ±10 bar as a documented context bar only.
 */
const THRESHOLDS: Record<string, number> = {
  'uniform:5': 0.05,
  'uniform:10': 0.2,
  [`normal:${NORMAL_SIGMA}`]: 0.2,
};
function thresholdFor(distribution: Distribution, radius: number): number {
  return THRESHOLDS[`${distribution}:${radius}`] ?? 0.2;
}
function cellKey(distribution: Distribution, radius: number): string {
  return `${distribution}:${radius}`;
}
/** Default seeds are the same family as the other simulate runners. */
const DEFAULT_SEED = 20260910;
/** ≥500 required by AC-8.1; 600 gives margin for resolving a 5% bar. */
const DEFAULT_SAMPLES = 600;
/** P0 `simulate:personas:run:all` observed fragile pairs (baseline context). */
const P0_FRAGILE_PAIRS: [string, string][] = [
  ['fox', 'owl'],
  ['octopus', 'owl'],
  ['cat', 'turtle'],
  ['elephant', 'koala'],
];

// Registered pair registries (read-only, for AC-8.3 dispositions).
const CONFUSABLE_SET = new Set(
  CONFUSABLE_ARCHETYPE_PAIRS.map((p) => [...p.archetypes].sort().join('|'))
);
const PERSISTENT_SET = new Set(
  PERSISTENT_CONFUSION_PAIRS.map((p) => [...p].sort().join('|'))
);

// ── Types ────────────────────────────────────────────────────────────

type TraitRecord = Record<TraitKey, number>;

interface AbsorberStat {
  archetype: string;
  count: number;
  /** count / samples for this cell. */
  rate: number;
  /** count / flips for this cell. */
  shareOfFlips: number;
  /** A2: pair registered in a confusion registry → gate-addressable. */
  classification: 'confusable' | 'hard';
}

interface SweepCell {
  source: string;
  sourceIndex: number;
  distribution: Distribution;
  /** Nominal radius: 5/10 for uniform, NORMAL_SIGMA for the normal arm. */
  radius: number;
  /** Normal-arm σ (undefined for uniform). */
  sigma?: number;
  samples: number;
  flips: number;
  flipRate: number;
  threshold: number;
  breach: boolean;
  /** A2 split: flips whose (source→absorber) pair is registered. */
  confusableFlips: number;
  /** A2 split: flips into an unregistered pair (redraw territory). */
  hardFlips: number;
  confusableFlipRate: number;
  hardFlipRate: number;
  /** True for uniform cells — the LOCKED M8 gate arm (A1). */
  lockedGate: boolean;
  /** Top-1 absorbers (source excluded), ranked by count desc. */
  absorbers: AbsorberStat[];
  /** Full top-1 histogram (including the source itself). */
  top1Counts: Record<string, number>;
  /** For NON-flipped samples only: nearest rival (top-2) histogram. */
  nonFlipRunnerUpCounts: Record<string, number>;
  /** Total clamped trait events across all samples × 6 traits. */
  clampEvents: number;
  /** Samples where at least one trait clamped. */
  clampSamples: number;
}

interface RadiusPairCount {
  aToB: number;
  bToA: number;
  total: number;
}

interface FragilePairStat {
  /** Alphabetically sorted pair. */
  pair: [string, string];
  aToB: number;
  bToA: number;
  total: number;
  /** A2: flips whose pair is registered in a confusion registry. */
  confusableTotal: number;
  /** A2: flips into an unregistered pair (redraw territory). */
  hardTotal: number;
  byRadius: Record<string, RadiusPairCount>;
  registeredConfusable: boolean;
  registeredPersistent: boolean;
}

interface CliOptions {
  mode: 'baseline' | 'gated';
  seed: number;
  samples: number;
  radii: number[];
  outFile: string;
  jsonOutFile: string;
  repeat: number;
}

// ── CLI ──────────────────────────────────────────────────────────────

function parseArgs(): CliOptions {
  const args = process.argv.slice(2);
  const options: Record<string, string> = {};
  for (const arg of args) {
    if (arg.startsWith('--')) {
      const [key, value] = arg.slice(2).split('=');
      options[key] = value ?? 'true';
    }
  }

  const mode = options.mode || 'baseline';
  if (!['baseline', 'gated'].includes(mode)) {
    console.error(`❌ Unknown --mode=${mode} (expected baseline|gated)`);
    process.exit(1);
  }

  const samples = parseInt(options.samples || String(DEFAULT_SAMPLES), 10);
  if (!Number.isFinite(samples) || samples < 500) {
    console.error(`❌ --samples must be an integer ≥ 500 (AC-8.1); got ${options.samples}`);
    process.exit(1);
  }

  const repeat = parseInt(options.repeat || '1', 10);
  if (!Number.isFinite(repeat) || repeat < 1) {
    console.error(`❌ --repeat must be an integer ≥ 1; got ${options.repeat}`);
    process.exit(1);
  }

  return {
    mode: mode as 'baseline' | 'gated',
    seed: parseInt(options.seed || String(DEFAULT_SEED), 10),
    samples,
    radii: [...RADII],
    outFile: options.out || '',
    jsonOutFile: options['json-out'] || '',
    repeat,
  };
}

// ── Helpers ──────────────────────────────────────────────────────────

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

function pct(v: number): string {
  return `${(v * 100).toFixed(1)}%`;
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

/** Standard normal via Box-Muller on the seeded stream (mirrors Item 6). */
function gaussian(rng: () => number): number {
  const u1 = Math.max(rng(), 1e-12);
  const u2 = rng();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/**
 * Draw one perturbed vector for `centroid`, then clamp to [TRAIT_MIN,
 * TRAIT_MAX]. `uniform` jitters each trait by Uniform[−radius, +radius];
 * `normal` jitters by Normal(0, radius) where radius is the σ. Returns the
 * vector plus the number of traits that actually clamped.
 */
function perturb(
  centroid: TraitRecord,
  distribution: Distribution,
  radius: number,
  rng: () => number
): { traits: TraitRecord; clamped: number } {
  const traits = {} as TraitRecord;
  let clamped = 0;
  for (const trait of ALL_TRAITS) {
    const jitter = distribution === 'uniform' ? (rng() * 2 - 1) * radius : gaussian(rng) * radius;
    const raw = centroid[trait] + jitter;
    const value = clamp(raw, TRAIT_MIN, TRAIT_MAX);
    if (value !== raw) clamped++;
    traits[trait] = value;
  }
  return { traits, clamped };
}

// ── Sweep ────────────────────────────────────────────────────────────

/** The perturbation arms: uniform ±5/±10 (locked gate) + Normal(0, σ=10) (A1). */
function sweepArms(opts: Pick<CliOptions, 'radii'>): Array<{ distribution: Distribution; radius: number }> {
  const arms: Array<{ distribution: Distribution; radius: number }> = opts.radii.map((radius) => ({
    distribution: 'uniform' as const,
    radius,
  }));
  arms.push({ distribution: 'normal', radius: NORMAL_SIGMA });
  return arms;
}

function runSweep(opts: Pick<CliOptions, 'seed' | 'samples' | 'radii'>): SweepCell[] {
  const ids = getAllArchetypeIds();
  const cells: SweepCell[] = [];

  ids.forEach((source, sourceIndex) => {
    const prototype = archetypePrototypes[source];
    if (!prototype) throw new Error(`No archetype prototype for id "${source}"`);
    const centroid = prototype.traitProfile;

    for (const arm of sweepArms(opts)) {
      // One independent deterministic stream per (centroid, arm). The uniform
      // arm keeps the original Item-8 tag (`radiusR`) so the locked baseline
      // numbers are byte-preserved; the normal arm gets its own stream.
      const streamTag = arm.distribution === 'uniform' ? `radius${arm.radius}` : `normal:${arm.radius}`;
      const rng = mulberry32(streamSeed(opts.seed, sourceIndex, streamTag));

      let flips = 0;
      let confusableFlips = 0;
      let hardFlips = 0;
      let clampEvents = 0;
      let clampSamples = 0;
      const top1Counts: Record<string, number> = {};
      const nonFlipRunnerUpCounts: Record<string, number> = {};

      for (let s = 0; s < opts.samples; s++) {
        const { traits, clamped } = perturb(centroid, arm.distribution, arm.radius, rng);
        clampEvents += clamped;
        if (clamped > 0) clampSamples++;

        const matches = findBestMatchingArchetypesV2(traits, undefined, 3);
        const top1 = matches[0]?.archetype ?? '';
        top1Counts[top1] = (top1Counts[top1] ?? 0) + 1;

        if (top1 !== source) {
          flips++;
          // A2: a flipped pair into a REGISTERED confusion pair is
          // gate-addressable ("confusable"); anything else needs a redraw.
          const reg = isRegisteredPair([source, top1]);
          if (top1 !== '' && (reg.confusable || reg.persistent)) {
            confusableFlips++;
          } else {
            hardFlips++;
          }
        } else {
          const top2 = matches[1]?.archetype ?? '';
          nonFlipRunnerUpCounts[top2] = (nonFlipRunnerUpCounts[top2] ?? 0) + 1;
        }
      }

      const flipRate = flips / opts.samples;
      const threshold = thresholdFor(arm.distribution, arm.radius);

      const absorbers: AbsorberStat[] = Object.entries(top1Counts)
        .filter(([arch]) => arch !== source && arch !== '')
        .map(([arch, count]) => ({
          archetype: arch,
          count,
          rate: count / opts.samples,
          shareOfFlips: flips > 0 ? count / flips : 0,
          classification: isRegisteredPair([source, arch]).confusable ? 'confusable' : isRegisteredPair([source, arch]).persistent ? 'confusable' : 'hard',
        }))
        .sort((a, b) => b.count - a.count || a.archetype.localeCompare(b.archetype));

      cells.push({
        source,
        sourceIndex,
        distribution: arm.distribution,
        radius: arm.radius,
        ...(arm.distribution === 'normal' ? { sigma: NORMAL_SIGMA } : {}),
        samples: opts.samples,
        flips,
        flipRate: round6(flipRate),
        threshold,
        breach: flipRate > threshold,
        confusableFlips,
        hardFlips,
        confusableFlipRate: round6(confusableFlips / opts.samples),
        hardFlipRate: round6(hardFlips / opts.samples),
        lockedGate: arm.distribution === 'uniform',
        absorbers,
        top1Counts,
        nonFlipRunnerUpCounts,
        clampEvents,
        clampSamples,
      });
    }
  });

  return cells;
}

// ── Pair aggregation ─────────────────────────────────────────────────

function buildPairRanking(cells: SweepCell[]): FragilePairStat[] {
  const map = new Map<string, FragilePairStat>();

  for (const cell of cells) {
    for (const absorber of cell.absorbers) {
      const a = cell.source;
      const b = absorber.archetype;
      const [x, y] = [a, b].sort();
      const key = `${x}|${y}`;

      let stat = map.get(key);
      if (!stat) {
        stat = {
          pair: [x, y],
          aToB: 0,
          bToA: 0,
          total: 0,
          confusableTotal: 0,
          hardTotal: 0,
          byRadius: {},
          registeredConfusable: CONFUSABLE_SET.has(key),
          registeredPersistent: PERSISTENT_SET.has(key),
        };
        map.set(key, stat);
      }

      const radiusKey = cellKey(cell.distribution, cell.radius);
      const byRadius =
        stat.byRadius[radiusKey] ??
        (stat.byRadius[radiusKey] = { aToB: 0, bToA: 0, total: 0 });

      if (a === x) {
        stat.aToB += absorber.count;
        byRadius.aToB += absorber.count;
      } else {
        stat.bToA += absorber.count;
        byRadius.bToA += absorber.count;
      }
      stat.total += absorber.count;
      byRadius.total += absorber.count;
      if (absorber.classification === 'confusable') stat.confusableTotal += absorber.count;
      else stat.hardTotal += absorber.count;
    }
  }

  return [...map.values()].sort(
    (p, q) =>
      q.total - p.total ||
      p.pair[0].localeCompare(q.pair[0]) ||
      p.pair[1].localeCompare(q.pair[1])
  );
}

function isRegisteredPair(pair: [string, string]): { confusable: boolean; persistent: boolean } {
  const key = [...pair].sort().join('|');
  return { confusable: CONFUSABLE_SET.has(key), persistent: PERSISTENT_SET.has(key) };
}

// ── Content hash (determinism) ───────────────────────────────────────

function computeContentHash(opts: Pick<CliOptions, 'seed' | 'samples' | 'radii'>, cells: SweepCell[]): string {
  const canonical = {
    seed: opts.seed,
    samples: opts.samples,
    radii: [...opts.radii].sort((a, b) => a - b),
    normalSigma: NORMAL_SIGMA,
    cells: cells.map((c) => ({
      source: c.source,
      distribution: c.distribution,
      radius: c.radius,
      samples: c.samples,
      flips: c.flips,
      flipRate: c.flipRate,
      confusableFlips: c.confusableFlips,
      hardFlips: c.hardFlips,
      absorbers: c.absorbers.map((a) => ({ archetype: a.archetype, count: a.count, classification: a.classification })),
      clampEvents: c.clampEvents,
    })),
  };
  return sha256(JSON.stringify(canonical));
}

// ── Report builder ───────────────────────────────────────────────────

function buildReport(
  opts: CliOptions,
  cells: SweepCell[],
  pairs: FragilePairStat[],
  contentHash: string,
  dateStr: string,
  runtimeSec: number
): string {
  const L: string[] = [];
  const breachingCells = cells.filter((c) => c.breach);
  const lockedBreachingCells = cells.filter((c) => c.lockedGate && c.breach);
  const normalCells = cells.filter((c) => c.distribution === 'normal');
  const ids = getAllArchetypeIds();

  L.push(`# Archetype Boundary Stability Sweep — ${dateStr}`);
  L.push('');
  L.push('> Plan: `docs/plans/2026-09-09-personality-engine-v4-upgrade-plan.md` Item 8 (M8).');
  L.push('> Contract: `.git/.orchestration/sprints/sprint-contract.item8-boundary-stability.md`.');
  L.push(`> Mode: **${opts.mode}**${opts.mode === 'baseline' ? ' (report-only; exit 0 by design)' : ' (hard gate: exit 1 on any breach)'}.`);
  L.push('> Fully deterministic: identical `--seed` reproduces every number in this report.');
  L.push('> **Read-only instrument:** the matcher, engine, prototypes and confusion registries are used as-is; no source was modified.');
  L.push('');
  L.push('## Run parameters');
  L.push('');
  L.push(`- Seed: \`${opts.seed}\``);
  L.push(`- Samples per centroid per arm: **${opts.samples}** (AC-8.1 requires ≥500)`);
  L.push(`- Gate arms (uniform): ${opts.radii.map((r) => `±${r}`).join(', ')} — clamped to [${TRAIT_MIN}, ${TRAIT_MAX}]`);
  L.push(`- Secondary robustness arm (A1): independent Normal(0, σ=${NORMAL_SIGMA}) per trait (Item 6's centroid-mixture σ; uniform ±10 has SD≈5.8 so the uniform arm is the optimistic one)`);
  L.push(`- Flip classification (A2): **confusable** = (source→absorber) pair registered in \`CONFUSABLE_ARCHETYPE_PAIRS\`/\`PERSISTENT_CONFUSION_PAIRS\`; **hard** = unregistered (needs a centroid redraw)`);
  L.push(`- Matcher: \`findBestMatchingArchetypesV2\` (MatcherV2, isolation mode — no engine sessions, no mocks)`);
  L.push(`- Content hash: \`${contentHash}\``);
  L.push(`- Runtime: ${runtimeSec.toFixed(2)}s`);
  L.push('');
  L.push('## Method');
  L.push('');
  L.push('- For each centroid and each radius, one deterministic stream (`mulberry32(streamSeed(seed, centroidIndex, "radiusR"))`).');
  L.push('- **Flip rate** = fraction of perturbed samples whose MatcherV2 top-1 archetype ≠ the source centroid archetype.');
  L.push('- **Absorbing archetype** = the top-1 archetype of a flipped sample (the archetype that took the vector). The ranked fragile-pair table aggregates `source → absorber` across the full 12×2 grid.');
  L.push('- **Clamping caveat (geometry, not a matcher defect):** centroids near a trait bound (e.g. corgi X=95, octopus O=95) absorb half of their raw draws flat at the bound, so their effective perturbation is asymmetric. `clampEvents` is reported per cell.');
  L.push('- **Non-monotonicity:** flip rate is not guaranteed monotone in radius — hard thresholds (signature/veto/confusion classifiers) mean a wider spread can re-enter a centroid\'s basin (observed: `hamster_praise` 10.2% @±5 vs 8.3% @±10). Read the grid per cell, not as a monotone curve.');
  L.push(`- **Roster order (frozen reference for AC-8.3):** ${ids.map((id) => `\`${id}\``).join(' → ')}. A Tier 3 redraw must keep this sequence identical; it is captured in the JSON artifact as \`rosterOrder\` so a future reorder is diff-detectable.`);
  L.push('');
  const findCell = (id: string, distribution: Distribution, radius: number): SweepCell =>
    cells.find((c) => c.source === id && c.distribution === distribution && c.radius === radius)!;
  const mark = (c: SweepCell) => `${pct(c.flipRate)} ${c.breach ? '❌' : '✅'}`;
  const classNote = (c: SweepCell) =>
    c.confusableFlips + c.hardFlips > 0 ? ` (conf ${c.confusableFlips} / hard ${c.hardFlips})` : '';

  L.push('## 12×3 grid (flip rate — uniform is the locked gate)');
  L.push('');
  L.push(`| Archetype | uniform ±5 (≤5%) | uniform ±10 (≤20%) | Normal σ=${NORMAL_SIGMA} (context ≤20%) |`);
  L.push('|---|---|---|---|');
  for (const id of ids) {
    const c5 = findCell(id, 'uniform', 5);
    const c10 = findCell(id, 'uniform', 10);
    const nrm = findCell(id, 'normal', NORMAL_SIGMA);
    L.push(`| \`${id}\` | ${mark(c5)} | ${mark(c10)} | ${mark(nrm)} |`);
  }
  L.push('');
  L.push(
    `**LOCKED gate breaches (uniform): ${lockedBreachingCells.length}/${cells.filter((c) => c.lockedGate).length}.** ` +
      (lockedBreachingCells.length === 0
        ? 'All uniform cells within locked tolerance.'
        : lockedBreachingCells
            .map((c) => `\`${c.source}\` @±${c.radius} (${pct(c.flipRate)} > ${pct(c.threshold)})`)
            .join('; '))
  );
  L.push(
    `**Secondary Normal-arm breaches: ${normalCells.filter((c) => c.breach).length}/${normalCells.length}** ` +
      `(context only — ${normalCells.filter((c) => c.breach).map((c) => `\`${c.source}\` (${pct(c.flipRate)})`).join('; ') || 'none'}).`
  );
  L.push('');
  L.push('**Confusable/hard flip split (A2) per breaching gate cell:**');
  L.push('');
  L.push('| Gate cell | Flip rate | Confusable flips | Hard flips |');
  L.push('|---|---|---|---|');
  for (const c of lockedBreachingCells) {
    L.push(`| \`${c.source}\` @±${c.radius} | ${pct(c.flipRate)} | ${c.confusableFlips} | ${c.hardFlips} |`);
  }
  if (lockedBreachingCells.length === 0) L.push('| — | — | 0 | 0 |');
  L.push('');
  const nearThreshold = cells.filter((c) => c.lockedGate && !c.breach && c.flipRate >= 0.75 * c.threshold);
  L.push(
    `**Near-threshold watch (passing but ≥75% of the bar):** ` +
      (nearThreshold.length === 0
        ? 'none.'
        : nearThreshold
            .map((c) => `\`${c.source}\` @±${c.radius} (${pct(c.flipRate)} / ${pct(c.threshold)})`)
            .join('; ') + '. Monitor — a seed or bank change could tip these over.')
  );
  L.push('');
  L.push('Absorber class detail (all flipped cells, both arms):');
  for (const c of cells.filter((cell) => cell.flips > 0)) {
    L.push(
      `- \`${c.source}\` ${c.distribution}${c.distribution === 'uniform' ? ` @±${c.radius}` : ` σ=${c.sigma}`}: ${c.flips} flips${classNote(c)}`
    );
  }
  L.push('');

  // ── Ranked fragile-pair table ──
  L.push('## Ranked fragile pairs (absorbed flips)');
  L.push('');
  L.push('Ranked by total flips absorbed across both radii. `a→b` / `b→a` are directional (source→absorber).');
  L.push('');
  L.push('| # | Pair | a→b (±5) | b→a (±5) | a→b (±10) | b→a (±10) | a→b (N) | b→a (N) | Total | Confusable / Hard | Registered |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|');
  pairs.forEach((p, i) => {
    const r5 = p.byRadius['uniform:5'] ?? { aToB: 0, bToA: 0, total: 0 };
    const r10 = p.byRadius['uniform:10'] ?? { aToB: 0, bToA: 0, total: 0 };
    const rn = p.byRadius[`normal:${NORMAL_SIGMA}`] ?? { aToB: 0, bToA: 0, total: 0 };
    const reg = p.registeredPersistent
      ? 'persistent-confusion'
      : p.registeredConfusable
        ? 'confusable'
        : '—';
    L.push(
      `| ${i + 1} | \`${p.pair[0]}\`↔\`${p.pair[1]}\` | ${r5.aToB} | ${r5.bToA} | ${r10.aToB} | ${r10.bToA} | ${rn.aToB} | ${rn.bToA} | **${p.total}** | ${p.confusableTotal} / ${p.hardTotal} | ${reg} |`
    );
  });
  if (pairs.length === 0) L.push('| — | (none) | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 / 0 | — |');
  L.push('');

  // ── P0 cross-reference ──
  L.push('## P0 baseline fragile-pair cross-reference');
  L.push('');
  L.push('Pairs flagged by the P0 `simulate:personas:run:all` boundary run (owl↔fox, owl↔octopus, turtle↔cat, elephant↔koala):');
  L.push('');
  L.push('| P0 pair | a→b (±5) | b→a (±5) | a→b (±10) | b→a (±10) | a→b (N) | b→a (N) | Total | In sweep ranking |');
  L.push('|---|---|---|---|---|---|---|---|---|');
  for (const [a, b] of P0_FRAGILE_PAIRS) {
    const [x, y] = [a, b].sort();
    const stat = pairs.find((p) => p.pair[0] === x && p.pair[1] === y);
    const r5 = stat?.byRadius['uniform:5'] ?? { aToB: 0, bToA: 0, total: 0 };
    const r10 = stat?.byRadius['uniform:10'] ?? { aToB: 0, bToA: 0, total: 0 };
    const rn = stat?.byRadius[`normal:${NORMAL_SIGMA}`] ?? { aToB: 0, bToA: 0, total: 0 };
    const rank = stat ? pairs.indexOf(stat) + 1 : null;
    L.push(
      `| \`${x}\`↔\`${y}\` | ${r5.aToB} | ${r5.bToA} | ${r10.aToB} | ${r10.bToA} | ${rn.aToB} | ${rn.bToA} | **${stat?.total ?? 0}** | ${rank ? `#${rank}` : 'not observed'} |`
    );
  }
  L.push('');

  // ── AC-8.3 dispositions ──
  L.push('## AC-8.3 dispositions');
  L.push('');
  if (breachingCells.length === 0) {
    L.push('All cells are **within tolerance, monitored** — no centroid redraw and no confusion-gate change is recommended at this radius set. Thresholds lock as measured (AC-8.2).');
  } else {
    L.push('For every breaching cell, each absorbing pair gets a disposition. Recommendation rule: a pair already registered in `PERSISTENT_CONFUSION_PAIRS` / `CONFUSABLE_ARCHETYPE_PAIRS` → **option (b) confusion-gate**; otherwise → **option (a) centroid redraw** (Tier 3 follow-up). **No redraw or registry change is performed by this instrument.**');
    L.push('');
    for (const cell of breachingCells) {
      L.push(
        `### \`${cell.source}\` ${cell.distribution}${cell.distribution === 'uniform' ? ` @±${cell.radius}` : ` σ=${cell.sigma}`}${cell.lockedGate ? '' : ' (context arm)'} — ${pct(cell.flipRate)} (${cell.flips}/${cell.samples}) > ${pct(cell.threshold)}`
      );
      L.push('');
      if (cell.absorbers.length === 0) {
        L.push('- no absorber recorded (unexpected)');
      }
      for (const absorber of cell.absorbers) {
        const reg = isRegisteredPair([cell.source, absorber.archetype]);
        const disposition = reg.persistent
          ? 'option (b) confusion-gate — already in `PERSISTENT_CONFUSION_PAIRS`; requires targeted disambiguation questions, not a redraw'
          : reg.confusable
            ? 'option (b) confusion-gate — already in `CONFUSABLE_ARCHETYPE_PAIRS`; tighten `differentiatingTraits` / `requiredConfidence`'
            : 'option (a) centroid redraw — unregistered fragile pair; Tier 3 follow-up. A redraw MUST NOT reorder the roster: an order-invariant test must assert `getAllArchetypeIds()` sequence unchanged';
        L.push(
          `- \`${cell.source}\`→\`${absorber.archetype}\`: ${absorber.count} flips (${pct(absorber.shareOfFlips)} of the cell). Disposition: **${disposition}**.`
        );
      }
      L.push('');
    }
  }
  L.push('');
  L.push('## Determinism');
  L.push('');
  L.push(`Content hash (numeric payload, wall-clock excluded): \`${contentHash}\`. Two same-seed runs must print the identical hash.`);
  L.push('');
  L.push('## Raw cell detail');
  L.push('');
  L.push('| Archetype | Arm | Flips / Samples | Flip rate | Conf / Hard | Top absorbers | Clamp events / (samples×6) |');
  L.push('|---|---|---|---|---|---|---|');
  for (const cell of cells) {
    const abs =
      cell.absorbers.length === 0
        ? '—'
        : cell.absorbers
            .slice(0, 4)
            .map((a) => `${a.archetype}:${a.count}${a.classification === 'hard' ? '*' : ''}`)
            .join(', ');
    const armLabel = cell.distribution === 'uniform' ? `±${cell.radius}` : `N σ=${cell.sigma}`;
    L.push(
      `| \`${cell.source}\` | ${armLabel} | ${cell.flips}/${cell.samples} | ${pct(cell.flipRate)} | ${cell.confusableFlips} / ${cell.hardFlips} | ${abs} | ${cell.clampEvents}/${cell.samples * ALL_TRAITS.length} |`
    );
  }
  L.push('');
  L.push('`*` = unregistered (hard) absorber, resolved by a centroid redraw rather than a confusion gate.');
  L.push('');
  return L.join('\n');
}

// ── Main ─────────────────────────────────────────────────────────────

function main(): void {
  const opts = parseArgs();
  const dateStr = new Date().toISOString().slice(0, 10);

  console.log('🧪 Archetype Boundary Stability Sweep (Plan Item 8 / M8)');
  console.log(
    `   mode=${opts.mode}  seed=${opts.seed}  samples=${opts.samples}  radii=${opts.radii.map((r) => `±${r}`).join(',')}  repeat=${opts.repeat}`
  );
  console.log('');

  const started = Date.now();
  let cells = runSweep(opts);
  let contentHash = computeContentHash(opts, cells);

  // In-process determinism check (AC-8.5): re-run and compare hashes.
  if (opts.repeat > 1) {
    for (let i = 2; i <= opts.repeat; i++) {
      const again = runSweep(opts);
      const againHash = computeContentHash(opts, again);
      if (againHash !== contentHash) {
        console.error(`❌ Determinism failure: run 1 hash ${contentHash} ≠ run ${i} hash ${againHash}`);
        process.exit(1);
      }
    }
    console.log(`✅ Determinism: ${opts.repeat} same-seed runs identical (${contentHash.slice(0, 16)}…)\n`);
  }

  const runtimeSec = (Date.now() - started) / 1000;
  const pairs = buildPairRanking(cells);
  const lockedBreachingCells = cells.filter((c) => c.lockedGate && c.breach);
  const normalBreachingCells = cells.filter((c) => c.distribution === 'normal' && c.breach);

  // ── Console grid ──
  const ids = getAllArchetypeIds();
  console.log('   flip-rate grid (uniform = locked gate; N = Normal σ arm)');
  console.log(`   ${'archetype'.padEnd(16)} ${'±5 (≤5%)'.padEnd(12)} ${'±10 (≤20%)'.padEnd(12)} ${`N σ=${NORMAL_SIGMA} (ctx)`.padEnd(14)}`);
  console.log(`   ${'─'.repeat(56)}`);
  for (const id of ids) {
    const c5 = cells.find((c) => c.source === id && c.distribution === 'uniform' && c.radius === 5)!;
    const c10 = cells.find((c) => c.source === id && c.distribution === 'uniform' && c.radius === 10)!;
    const cn = cells.find((c) => c.source === id && c.distribution === 'normal')!;
    console.log(
      `   ${id.padEnd(16)} ${`${pct(c5.flipRate)} ${c5.breach ? '❌' : '✅'}`.padEnd(12)} ${`${pct(c10.flipRate)} ${c10.breach ? '❌' : '✅'}`.padEnd(12)} ${`${pct(cn.flipRate)} ${cn.breach ? '❌' : '✅'}`.padEnd(14)}`
    );
  }
  console.log('');
  console.log(`   LOCKED gate (uniform) breaches: ${lockedBreachingCells.length}/${cells.filter((c) => c.lockedGate).length}; normal-arm (context): ${normalBreachingCells.length}/${cells.filter((c) => c.distribution === 'normal').length}`);
  console.log('');

  // ── Console ranked pairs (top 10) ──
  console.log('   ranked fragile pairs (absorbed flips)');
  pairs.slice(0, 10).forEach((p, i) => {
    const reg = p.registeredPersistent ? 'persistent' : p.registeredConfusable ? 'confusable' : '—';
    console.log(
      `   ${String(i + 1).padStart(2)}. ${p.pair[0]}↔${p.pair[1]}  total=${p.total}  (registered: ${reg})`
    );
  });
  if (pairs.length === 0) console.log('   (none)');
  console.log('');

  // ── Console P0 cross-reference ──
  console.log('   P0 cross-reference');
  for (const [a, b] of P0_FRAGILE_PAIRS) {
    const [x, y] = [a, b].sort();
    const stat = pairs.find((p) => p.pair[0] === x && p.pair[1] === y);
    console.log(`   ${x}↔${y}: total=${stat?.total ?? 0}${stat ? ` (#${pairs.indexOf(stat) + 1})` : ' (not observed)'}`);
  }
  console.log('');

  // ── Artifacts ──
  const reportPath = opts.outFile
    ? path.resolve(opts.outFile)
    : path.join(__dirname, '..', '..', 'docs', 'reports', `${dateStr}-boundary-stability-sweep.md`);
  fs.mkdirSync(path.dirname(reportPath), { recursive: true });
  const report = buildReport(opts, cells, pairs, contentHash, dateStr, runtimeSec);
  fs.writeFileSync(reportPath, report, 'utf8');

  const jsonPath = opts.jsonOutFile
    ? path.resolve(opts.jsonOutFile)
    : path.join(__dirname, 'data', 'boundary-sweep-latest.json');
  fs.mkdirSync(path.dirname(jsonPath), { recursive: true });
  const json = {
    generatedAt: new Date().toISOString(),
    date: dateStr,
    mode: opts.mode,
    seed: opts.seed,
    samples: opts.samples,
    radii: opts.radii,
    distributions: ['uniform', 'normal'],
    normalSigma: NORMAL_SIGMA,
    contentHash,
    runtimeSec: round6(runtimeSec),
    thresholds: THRESHOLDS,
    rosterOrder: ids,
    /** LOCKED M8 gate arm (uniform) — the gate counts these. */
    breachingCells: lockedBreachingCells.map((c) => ({
      source: c.source,
      distribution: c.distribution,
      radius: c.radius,
      flipRate: c.flipRate,
      threshold: c.threshold,
      confusableFlips: c.confusableFlips,
      hardFlips: c.hardFlips,
    })),
    /** Secondary Normal(σ) arm (A1) — context only, never gate-breaking. */
    normalBreachingCells: normalBreachingCells.map((c) => ({
      source: c.source,
      distribution: c.distribution,
      radius: c.radius,
      flipRate: c.flipRate,
      threshold: c.threshold,
      confusableFlips: c.confusableFlips,
      hardFlips: c.hardFlips,
    })),
    flipSplit: {
      byGateCell: lockedBreachingCells.map((c) => ({
        source: c.source,
        radius: c.radius,
        confusableFlips: c.confusableFlips,
        hardFlips: c.hardFlips,
      })),
      byAbsorber: cells.flatMap((c) =>
        c.absorbers.map((a) => ({
          source: c.source,
          distribution: c.distribution,
          radius: c.radius,
          absorber: a.archetype,
          count: a.count,
          classification: a.classification,
        }))
      ),
    },
    grid: cells,
    fragilePairs: pairs,
    p0CrossReference: P0_FRAGILE_PAIRS.map(([a, b]) => {
      const [x, y] = [a, b].sort();
      const stat = pairs.find((p) => p.pair[0] === x && p.pair[1] === y);
      return { pair: [x, y], total: stat?.total ?? 0, byRadius: stat?.byRadius ?? {} };
    }),
    registeredPairs: {
      confusable: CONFUSABLE_ARCHETYPE_PAIRS.map((p) => [...p.archetypes].sort()),
      persistent: PERSISTENT_CONFUSION_PAIRS.map((p) => [...p].sort()),
    },
  };
  fs.writeFileSync(jsonPath, JSON.stringify(json, null, 2) + '\n', 'utf8');

  console.log(`💾 report: ${path.relative(process.cwd(), reportPath)}`);
  console.log(`💾 JSON:   ${path.relative(process.cwd(), jsonPath)}`);
  console.log(`🔑 contentHash: ${contentHash}`);
  console.log('');

  // ── Gate (uniform = the locked M8 arm; A1) ──
  if (opts.mode === 'gated' && lockedBreachingCells.length > 0) {
    console.error(
      `❌ M8 GATE FAILED — ${lockedBreachingCells.length}/${cells.filter((c) => c.lockedGate).length} uniform cell(s) exceed locked thresholds:`
    );
    for (const c of lockedBreachingCells) {
      console.error(
        `   ${c.source} @±${c.radius}: ${pct(c.flipRate)} > ${pct(c.threshold)} (confusable ${c.confusableFlips} / hard ${c.hardFlips})`
      );
    }
    process.exit(1);
  }

  if (opts.mode === 'gated') {
    console.log('✅ M8 gate passed — all uniform cells within locked thresholds.');
  } else {
    console.log('ℹ️ baseline mode — thresholds reported, not enforced (exit 0 by design).');
  }
}

main();
