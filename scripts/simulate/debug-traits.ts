#!/usr/bin/env node

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { archetypeRegistry } from '../../packages/shared/src/personality/archetypeRegistry';
import { TraitKey, DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

function selectAnswerByTraits(question: any, targetTraits: Record<TraitKey, number>): string {
  let bestOption = question.options[0];
  let bestScore = -Infinity;
  for (const option of question.options) {
    let score = 0;
    for (const trait of ALL_TRAITS) {
      const optionValue = option.traitScores[trait] || 0;
      const targetValue = targetTraits[trait];
      const traitAlignment = (targetValue - 50) / 50;
      score += optionValue * traitAlignment;
    }
    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }
  return bestOption.value;
}

const personaId = process.argv[2] || 'octopus';
const persona = (archetypeRegistry as any)[personaId];
const traitProfile = persona.profile.traitProfile;
const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
let state = initializeEngineState(config);

console.log(`=== Trait score trace for ${personaId} ===`);
console.log('Target traits:', traitProfile);

for (let i = 0; i < 16; i++) {
  const q = selectNextQuestion(state);
  if (!q) break;
  const answer = selectAnswerByTraits(q, traitProfile);
  
  const scores = ALL_TRAITS.map(t => {
    const tc = state.traitConfidences[t];
    return `${t}=${tc?.score?.toFixed(0) || 0}`;
  }).join(', ');
  
  const top2 = state.currentMatches.slice(0, 2).map((m: any) => `${m.archetype}(${m.confidence.toFixed(2)})`).join(' > ');
  
  console.log(`Q${i+1}: ${q.id} [${q.primaryTraits.join(',')}] | ${scores} | ${top2}`);
  
  state = processAnswer(state, q, answer);
}

console.log('\nFinal trait scores:');
for (const trait of ALL_TRAITS) {
  const tc = state.traitConfidences[trait];
  console.log(`  ${trait}: ${tc?.score?.toFixed(1)} (target: ${traitProfile[trait]})`);
}
console.log(`\nFinal match: ${state.currentMatches[0]?.archetype}`);
