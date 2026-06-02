import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { runAssessmentSimulation } from './lib/persona-utils';
import { V2_ASSESSMENT_CONFIG, DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function loadPersonas(filter: 'centroids' | 'boundaries' | 'all') {
  const allPath = join(__dirname, 'data', 'all-personas.json');
  const all = JSON.parse(readFileSync(allPath, 'utf-8'));
  if (filter === 'centroids') return all.filter((p: any) => p.category === 'centroid');
  if (filter === 'boundaries') return all.filter((p: any) => p.category === 'boundary');
  return all;
}

const personas = loadPersonas('centroids');

const BASELINES = {
  A: 0.515, C: 0.531, E: 0.709,
  O: 0.429, X: 0.074, P: 0.327,
};

Object.assign(DEFAULT_ASSESSMENT_CONFIG, {
  ...V2_ASSESSMENT_CONFIG,
  traitScoreBaselines: BASELINES,
  traitScoreMultiplier: 15,
  anchorQuestionCount: 10,
});

let exact = 0;
let similar = 0;
for (const p of personas) {
  const result = runAssessmentSimulation(p, 'clean');
  if (result.isExactMatch) exact++;
  if (result.isSimilarMatch) similar++;
  const status = result.isExactMatch ? '✅' : result.isSimilarMatch ? '🟡' : '❌';
  console.log(`${p.name}: ${p.expectedArchetype} → ${result.assignedArchetype} ${status} (${result.questionsAsked}Q)`);
}

console.log(`\nExact: ${exact}/${personas.length} = ${(exact/personas.length*100).toFixed(1)}%`);
