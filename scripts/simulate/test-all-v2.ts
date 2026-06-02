import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { runAssessmentSimulation } from './lib/persona-utils';
import { V2_ASSESSMENT_CONFIG, DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const all = JSON.parse(readFileSync(join(__dirname, 'data/all-personas.json'), 'utf-8'));

const BASELINES = { A: 0.515, C: 0.531, E: 0.709, O: 0.429, X: 0.074, P: 0.327 };
Object.assign(DEFAULT_ASSESSMENT_CONFIG, {
  ...V2_ASSESSMENT_CONFIG,
  traitScoreBaselines: BASELINES,
  traitScoreMultiplier: 15,
});

let exact = 0, similar = 0, totalQ = 0;
for (const p of all) {
  const result = runAssessmentSimulation(p, 'clean');
  if (result.isExactMatch) exact++;
  if (result.isSimilarMatch) similar++;
  totalQ += result.questionsAsked;
  const status = result.isExactMatch ? '✅' : result.isSimilarMatch ? '🟡' : '❌';
  console.log(`${p.name}: ${p.expectedArchetype} → ${result.assignedArchetype} ${status} (${result.questionsAsked}Q)`);
}
console.log(`\nExact: ${exact}/${all.length} = ${(exact/all.length*100).toFixed(1)}%`);
console.log(`Similar: ${similar}/${all.length}`);
console.log(`Avg questions: ${(totalQ/all.length).toFixed(1)}`);
