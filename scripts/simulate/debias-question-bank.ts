#!/usr/bin/env node
/**
 * P5b Question-Bank Debias Codemod
 *
 * Re-centers positively-keyed option traitScores in the servable V4 question
 * bank so every question × trait has option loadings summing to ZERO (or the
 * nearest achievable integer residual, recorded). Under uniform-random
 * answering a zero-sum question contributes zero expected trait drift; a
 * zero-sum bank therefore kills the random-answering drift regardless of the
 * adaptive selection path.
 *
 * Transform discipline (per question × trait):
 *   1. Compute the mean option loading c = Σv/n over ALL options (absent
 *      keys count as 0).
 *   2. Apply a CONSTANT integer shift to every option (v → v − round(c)).
 *      Constant shifts preserve pairwise differences AND ties by
 *      construction — discriminating power is untouched where it exists;
 *      where all options load equally there was no discrimination to lose.
 *   3. Fix the integer-rounding residual by adjusting WHOLE VALUE LEVELS
 *      (never individual options) so ties stay tied. Levels with fewer
 *      options are preferred, to minimise the number of moved options.
 *   4. Candidates from floor(c) and ceil(c) are scored by total distortion
 *      Σ|new − (v − c)|, tie-broken by preserving the top pole (max).
 *   5. Hard guard: no loading may leave [-6, +6] (the bank's pre-existing
 *      extreme, on forced-choice pair items like Q123). If exact zero-sum
 *      would violate the guard, the smallest achievable residual is kept and
 *      recorded.
 *
 * Ipsative items (questionsV4Ipsative) are EXCLUDED: they ship dark behind
 * enableIpsativeItems and carry a deliberately structured debit design.
 *
 * Option TEXT is never modified — score-only debias.
 *
 * Source-application method: every option in these files carries exactly one
 * single-line `traitScores: { ... }` literal, in module order (verified:
 * literal count == option count per file). The codemod walks each file's
 * literals sequentially, maps them to (questionId, optionValue), and rewrites
 * only the numeric values, preserving key order and spacing style.
 *
 * Usage:
 *   npx tsx scripts/simulate/debias-question-bank.ts --dry-run   (default)
 *   npx tsx scripts/simulate/debias-question-bank.ts --apply
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { questionsV4L1 } from '../../packages/shared/src/personality/questionsV4L1.js';
import { questionsV4L2 } from '../../packages/shared/src/personality/questionsV4L2.js';
import { questionsV4Extended } from '../../packages/shared/src/personality/questionsV4Extended.js';
import { questionsV4Advanced } from '../../packages/shared/src/personality/questionsV4Advanced.js';
import { questionsV4Attractor } from '../../packages/shared/src/personality/questionsV4Attractor.js';
import type { AdaptiveQuestion, TraitKey } from '../../packages/shared/src/personality/types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];
const LOADING_GUARD = 6;

const MODULES: Array<{ name: string; file: string; questions: AdaptiveQuestion[] }> = [
  { name: 'L1', file: 'questionsV4L1.ts', questions: questionsV4L1 },
  { name: 'L2', file: 'questionsV4L2.ts', questions: questionsV4L2 },
  { name: 'Extended', file: 'questionsV4Extended.ts', questions: questionsV4Extended },
  { name: 'Advanced', file: 'questionsV4Advanced.ts', questions: questionsV4Advanced },
  { name: 'Attractor', file: 'questionsV4Attractor.ts', questions: questionsV4Attractor },
  // Ipsative intentionally excluded (flag-gated dark; structured debit design).
];

// ── Transform ────────────────────────────────────────────────────────

interface TraitPlan {
  trait: TraitKey;
  before: number[];
  after: number[];
  residual: number; // Σafter (target 0)
  distortion: number;
}

interface Candidate {
  after: number[];
  sum: number;
  distortion: number;
  maxPole: number;
  guardOk: boolean;
}

function constantShiftCandidate(values: number[], c: number, base: number): Candidate | null {
  const after = values.map((v) => v - base);
  let sum = after.reduce((a, b) => a + b, 0);

  // Fix residual by whole-level adjustments (tie-preserving).
  let guardOk = true;
  let guard = 32;
  while (sum !== 0 && guard-- > 0) {
    // Group option indices by current value.
    const levels = new Map<number, number[]>();
    after.forEach((v, i) => {
      const g = levels.get(v) ?? [];
      g.push(i);
      levels.set(v, g);
    });
    if (levels.size === 0) {
      guardOk = false;
      break;
    }
    const sortedLevels = [...levels.entries()].sort((a, b) =>
      sum > 0 ? a[0] - b[0] : b[0] - a[0]
    );
    // Choose the level to move: fewest options first (minimises moved
    // options); for sum>0 we decrement (starting from the lowest level so
    // the top pole is preserved), for sum<0 we increment from the highest.
    const pick = [...sortedLevels].sort((a, b) => a[1].length - b[1].length)[0];
    const delta = sum > 0 ? -1 : 1;
    for (const i of pick[1]) after[i] += delta;
    sum += delta * pick[1].length;
    if (after.some((v) => Math.abs(v) > LOADING_GUARD)) {
      guardOk = false;
      break;
    }
  }

  const distortion = after.reduce((s, v, i) => s + Math.abs(v - (values[i] - c)), 0);
  return {
    after,
    sum,
    distortion,
    maxPole: Math.max(...after),
    guardOk: guardOk && after.every((v) => Math.abs(v) <= LOADING_GUARD),
  };
}

function planQuestionTrait(values: number[]): { after: number[]; residual: number; distortion: number } | null {
  const S = values.reduce((a, b) => a + b, 0);
  if (S === 0) return null; // already balanced
  const c = S / values.length;

  // Diagnostic mode (DEBIAS_FRACTIONAL=1): apply the EXACT constant shift
  // (2-decimal rounding) instead of integer programming. Under an exact
  // constant shift every option's trait-alignment ordering is preserved
  // perfectly; this mode exists to separate "unavoidable per-trait
  // translation geometry" from "integer-rounding reordering" when evaluating
  // end-to-end persona fidelity changes. Never ship fractional loadings.
  if (process.env.DEBIAS_FRACTIONAL === '1') {
    const after = values.map((v) => Math.round((v - c) * 100) / 100);
    const residual = Math.round(after.reduce((a, b) => a + b, 0) * 100) / 100;
    return { after, residual, distortion: 0 };
  }

  const candidates: Candidate[] = [];
  for (const b of [Math.floor(c), Math.ceil(c)].filter((b, i, arr) => arr.indexOf(b) === i)) {
    const plain = constantShiftCandidate(values, c, b);
    if (plain?.guardOk) candidates.push(plain);
  }

  if (candidates.length === 0) return null;

  // Prefer exact zero-sum; then minimal distortion (stay closest to the
  // ideal uniform re-centering); then preserve the higher top pole.
  candidates.sort((a, b) =>
    Math.abs(a.sum) - Math.abs(b.sum) ||
    a.distortion - b.distortion ||
    b.maxPole - a.maxPole
  );
  const best = candidates[0];
  return { after: best.after, residual: best.sum, distortion: best.distortion };
}

// ── Plan construction (from module data — source of truth) ───────────

interface OptionPlan {
  questionId: string;
  optionValue: string;
  before: Record<string, number>;
  after: Record<string, number>; // only keys that change
  changed: boolean;
}

function buildPlans(): {
  perModule: Array<{ name: string; file: string; optionPlans: OptionPlan[] }>;
  stats: {
    questionsTouched: Set<string>;
    optionsChanged: number;
    traitCells: number;
    exactZero: number;
    residualCells: Array<{ questionId: string; trait: TraitKey; residual: number }>;
    totalDistortion: number;
  };
} {
  const perModule: Array<{ name: string; file: string; optionPlans: OptionPlan[] }> = [];
  const stats = {
    questionsTouched: new Set<string>(),
    optionsChanged: 0,
    traitCells: 0,
    exactZero: 0,
    residualCells: [] as Array<{ questionId: string; trait: TraitKey; residual: number }>,
    totalDistortion: 0,
  };

  for (const mod of MODULES) {
    // optionPlans[i][j] corresponds to mod.questions[i].options[j]
    const optionPlans: OptionPlan[] = [];
    for (const q of mod.questions) {
      const perOptionBefore = q.options.map((o) => ({ ...(o.traitScores ?? {}) }));
      const perOptionAfter: Array<Record<string, number>> = q.options.map(() => ({}));
      let questionTouched = false;

      for (const trait of ALL_TRAITS) {
        const values = q.options.map((o) => o.traitScores?.[trait] ?? 0);
        const plan = planQuestionTrait(values);
        if (!plan) continue;
        if (plan.after.every((v, i) => v === values[i])) continue;
        stats.traitCells++;
        stats.totalDistortion += plan.distortion;
        if (plan.residual === 0) stats.exactZero++;
        else stats.residualCells.push({ questionId: q.id, trait, residual: plan.residual });
        questionTouched = true;
        plan.after.forEach((v, i) => {
          if (v !== values[i]) perOptionAfter[i][trait] = v;
        });
      }

      q.options.forEach((o, i) => {
        const changedKeys = Object.keys(perOptionAfter[i]);
        const changed = changedKeys.length > 0;
        if (changed) stats.optionsChanged++;
        optionPlans.push({
          questionId: q.id,
          optionValue: o.value,
          before: Object.fromEntries(
            Object.entries(perOptionBefore[i]).filter(([, v]) => v !== 0)
          ),
          after: perOptionAfter[i],
          changed,
        });
      });
      if (questionTouched) stats.questionsTouched.add(q.id);
    }
    perModule.push({ name: mod.name, file: mod.file, optionPlans });
  }
  return { perModule, stats };
}

// ── Source rewrite ───────────────────────────────────────────────────

const LITERAL_RE = /traitScores:\s*\{([^{}]*)\}/g;

function rewriteFile(
  filePath: string,
  optionPlans: OptionPlan[],
  expectedOptionCount: number,
  apply: boolean
): { literals: number; rewritten: number; mismatches: string[] } {
  const src = fs.readFileSync(filePath, 'utf-8');
  const matches = [...src.matchAll(LITERAL_RE)];
  const mismatches: string[] = [];
  if (matches.length !== expectedOptionCount) {
    mismatches.push(
      `FATAL: literal count ${matches.length} != option count ${expectedOptionCount} in ${path.basename(filePath)} — sequential mapping unsafe, aborting this file`
    );
    return { literals: matches.length, rewritten: 0, mismatches };
  }

  let rewritten = 0;
  let cursor = 0;
  let out = '';
  matches.forEach((m, idx) => {
    const plan = optionPlans[idx];
    const literal = m[0];
    const inner = m[1];

    // Parse the literal's key/value entries in order.
    const entries = [...inner.matchAll(/([ACEOXP]):\s*(-?\d+)/g)].map((e) => ({
      key: e[1] as TraitKey,
      value: parseInt(e[2], 10),
    }));

    // Sanity: the literal must correspond to the planned option's original
    // scores (every nonzero planned-before value must appear with the same
    // value in the literal).
    for (const [k, v] of Object.entries(plan.before)) {
      const found = entries.find((e) => e.key === k);
      if (!found || found.value !== v) {
        mismatches.push(
          `mapping mismatch at literal #${idx} (${plan.questionId}/${plan.optionValue}): literal has ${k}=${found?.value}, module says ${v}`
        );
      }
    }

    let replacement = literal;
    if (plan.changed && mismatches.length === 0) {
      // Rebuild preserving key order and the literal's spacing style.
      // Sparse literals (some trait keys absent, meaning 0) gain keys when
      // the plan moves that option's trait away from 0: entries are emitted
      // in canonical A,C,E,O,X,P order, merging existing + inserted keys.
      // Planned value 0 for an absent key stays absent (no diff noise).
      const hasInnerSpaces = /^\s/.test(inner) || /\s$/.test(inner);
      const existing = new Map(entries.map((e) => [e.key, e.value]));
      const merged: Array<{ key: TraitKey; value: number }> = [];
      for (const key of ALL_TRAITS) {
        const planned = plan.after[key];
        const orig = existing.get(key);
        const value = planned !== undefined ? planned : orig;
        if (value === undefined) continue; // absent and unplanned → stay absent
        if (orig === undefined && value === 0) continue; // absent → stays absent
        merged.push({ key, value });
      }
      const body = merged.map((e) => `${e.key}: ${e.value}`).join(', ');
      replacement = hasInnerSpaces
        ? `traitScores: { ${body} }`
        : `traitScores: {${body}}`;
      if (replacement !== literal) rewritten++;
    }

    out += src.slice(cursor, m.index) + replacement;
    cursor = (m.index ?? 0) + literal.length;
  });
  out += src.slice(cursor);

  if (apply && mismatches.length === 0 && rewritten > 0) {
    fs.writeFileSync(filePath, out, 'utf-8');
  }
  return { literals: matches.length, rewritten, mismatches };
}

// ── Main ─────────────────────────────────────────────────────────────

function main() {
  const apply = process.argv.includes('--apply');
  console.log(`🛠️  P5b Question-Bank Debias Codemod — ${apply ? 'APPLY' : 'DRY-RUN'}`);
  console.log('');

  const { perModule, stats } = buildPlans();

  console.log(`Questions touched:      ${stats.questionsTouched.size}`);
  console.log(`Options changed:        ${stats.optionsChanged}`);
  console.log(`Trait cells rebalanced: ${stats.traitCells} (exact zero-sum: ${stats.exactZero})`);
  console.log(`Total distortion:       ${stats.totalDistortion.toFixed(1)}`);
  if (stats.residualCells.length > 0) {
    console.log(`Residual (non-zero-sum) cells: ${stats.residualCells.length}`);
    for (const r of stats.residualCells.slice(0, 20)) {
      console.log(`   ${r.questionId} ${r.trait}: residual ${r.residual}`);
    }
  }
  console.log('');

  const planArtifact: Record<string, unknown> = {
    generatedAt: new Date().toISOString(),
    applied: apply,
    stats: {
      questionsTouched: stats.questionsTouched.size,
      optionsChanged: stats.optionsChanged,
      traitCells: stats.traitCells,
      exactZero: stats.exactZero,
      totalDistortion: Math.round(stats.totalDistortion * 10) / 10,
      residualCells: stats.residualCells,
    },
    modules: {},
  };

  let anyMismatch = false;
  for (const mod of perModule) {
    const filePath = path.join(
      __dirname,
      '..',
      '..',
      'packages',
      'shared',
      'src',
      'personality',
      mod.file
    );
    const expected = mod.optionPlans.length;
    const res = rewriteFile(filePath, mod.optionPlans, expected, apply);
    console.log(
      `${mod.name.padEnd(10)} ${mod.file.padEnd(28)} literals=${res.literals} options=${expected} rewritten=${res.rewritten}`
    );
    for (const mm of res.mismatches) {
      console.log(`   ❌ ${mm}`);
      anyMismatch = true;
    }
    (planArtifact.modules as Record<string, unknown>)[mod.name] = {
      file: mod.file,
      optionsChanged: mod.optionPlans.filter((p) => p.changed).length,
      changes: mod.optionPlans
        .filter((p) => p.changed)
        .map((p) => ({ question: p.questionId, option: p.optionValue, set: p.after })),
    };
  }

  fs.writeFileSync(
    path.join(__dirname, 'data', 'debias-plan.json'),
    JSON.stringify(planArtifact, null, 2)
  );

  if (anyMismatch) {
    console.log('\n❌ Mapping mismatches detected — no files written. Aborting.');
    process.exitCode = 1;
    return;
  }
  console.log(`\n${apply ? '✅ Applied. Re-run measure-random-drift.ts to verify.' : 'ℹ️  Dry-run only. Re-run with --apply to write.'}`);
  console.log('Plan artifact: scripts/simulate/data/debias-plan.json');
}

main();
