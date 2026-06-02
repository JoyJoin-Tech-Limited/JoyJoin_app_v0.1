#!/usr/bin/env node
/**
 * Compute per-trait means across the question bank
 */

import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
import { TraitKey } from '../../packages/shared/src/personality/types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

const sums: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
const counts: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
const optionCounts: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };

for (const q of questionsV4) {
  for (const opt of q.options) {
    for (const trait of ALL_TRAITS) {
      const score = opt.traitScores[trait];
      if (score !== undefined && score !== 0) {
        sums[trait] += score;
        counts[trait]++;
      }
      // Count total options for this trait (including zero scores)
      optionCounts[trait]++;
    }
  }
}

console.log('=== Per-trait statistics ===');
for (const trait of ALL_TRAITS) {
  const meanNonZero = counts[trait] > 0 ? sums[trait] / counts[trait] : 0;
  const meanAll = optionCounts[trait] > 0 ? sums[trait] / optionCounts[trait] : 0;
  console.log(`${trait}: sum=${sums[trait].toFixed(1)}, nonZeroCount=${counts[trait]}, totalOptions=${optionCounts[trait]}, meanNonZero=${meanNonZero.toFixed(3)}, meanAll=${meanAll.toFixed(3)}`);
}

// Also compute per-question means (how much each trait is affected on average per question)
const qSums: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
const qCounts: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };

for (const q of questionsV4) {
  for (const trait of ALL_TRAITS) {
    let qSum = 0;
    let qCount = 0;
    for (const opt of q.options) {
      const score = opt.traitScores[trait];
      if (score !== undefined && score !== 0) {
        qSum += score;
        qCount++;
      }
    }
    if (qCount > 0) {
      qSums[trait] += qSum / qCount;
      qCounts[trait]++;
    }
  }
}

console.log('\n=== Per-question trait means (avg option score per question that samples the trait) ===');
for (const trait of ALL_TRAITS) {
  const mean = qCounts[trait] > 0 ? qSums[trait] / qCounts[trait] : 0;
  console.log(`${trait}: ${mean.toFixed(3)} (sampled in ${qCounts[trait]} questions)`);
}
