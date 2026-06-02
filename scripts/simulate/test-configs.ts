import { loadPersonas } from './lib/persona-utils';
import { DEFAULT_ASSESSMENT_CONFIG, V2_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';

const totals: Record<string, { sum: number; count: number }> = {};
for (const t of ['A','C','E','O','X','P']) totals[t] = { sum: 0, count: 0 };

for (const q of questionsV4) {
  for (const opt of q.options) {
    for (const t of ['A','C','E','O','X','P']) {
      const v = opt.traitScores[t] || 0;
      totals[t].sum += v;
      totals[t].count++;
    }
  }
}

const baselines: Record<string, number> = {};
for (const t of ['A','C','E','O','X','P']) {
  baselines[t] = totals[t].sum / totals[t].count;
}

console.log('Computed baselines:', baselines);
console.log('Total options:', totals.A.count);

const personas = loadPersonas().filter(p => p.category === 'centroid');
console.log(`Loaded ${personas.length} centroids`);
