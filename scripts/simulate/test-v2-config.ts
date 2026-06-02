import { readFileSync } from 'fs';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { runAssessmentSimulation } from './lib/persona-utils';
import { V2_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function loadPersonas(filter: 'centroids' | 'boundaries' | 'all') {
  const allPath = join(__dirname, 'data', 'all-personas.json');
  const all = JSON.parse(readFileSync(allPath, 'utf-8'));
  if (filter === 'centroids') return all.filter((p: any) => p.category === 'centroid');
  if (filter === 'boundaries') return all.filter((p: any) => p.category === 'boundary');
  return all;
}

const personas = loadPersonas('centroids');

// Patch the config that runAssessmentSimulation uses
// It does: const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
// We need to patch DEFAULT_ASSESSMENT_CONFIG directly before the function runs
import { DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';
Object.assign(DEFAULT_ASSESSMENT_CONFIG, V2_ASSESSMENT_CONFIG);

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
