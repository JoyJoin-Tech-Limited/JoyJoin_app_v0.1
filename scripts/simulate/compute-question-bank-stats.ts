#!/usr/bin/env tsx
/**
 * Compute per-trait statistics from the question bank for z-score normalization
 */

import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';

const ALL_TRAITS = ['A', 'C', 'E', 'O', 'X', 'P'] as const;

// Collect all non-zero option trait scores
const traitScores: Record<string, number[]> = {
  A: [], C: [], E: [], O: [], X: [], P: [],
};

for (const q of questionsV4) {
  for (const opt of q.options) {
    for (const [trait, score] of Object.entries(opt.traitScores)) {
      if (score !== 0) {
        traitScores[trait].push(score);
      }
    }
  }
}

console.log('// Auto-generated from question bank statistics');
console.log('// Run: tsx scripts/simulate/compute-question-bank-stats.ts');
console.log('export const QUESTION_BANK_TRAIT_STATS: Record<string, { mean: number; std: number; count: number }> = {');
for (const trait of ALL_TRAITS) {
  const scores = traitScores[trait];
  const mean = scores.reduce((s, v) => s + v, 0) / scores.length;
  const variance = scores.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / scores.length;
  const std = Math.sqrt(variance);
  console.log(`  ${trait}: { mean: ${mean.toFixed(4)}, std: ${std.toFixed(4)}, count: ${scores.length} },`);
}
console.log('};');
