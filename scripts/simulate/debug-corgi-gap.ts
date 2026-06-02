#!/usr/bin/env node

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  detectPersistentConfusionPair,
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

const personaId = 'corgi';
const persona = (archetypeRegistry as any)[personaId];
const traitProfile = persona.profile.traitProfile;
const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
let state = initializeEngineState(config);

let prevGap = 1;

for (let i = 0; i < 16; i++) {
  const q = selectNextQuestion(state);
  if (!q) break;
  const answer = selectAnswerByTraits(q, traitProfile);
  
  const confusion = detectPersistentConfusionPair(state.currentMatches);
  const topMatch = state.currentMatches[0];
  const gap = confusion.isPersistentPair ? confusion.scoreGap : 1;
  const gapTrend = gap < prevGap ? '↓' : gap > prevGap ? '↑' : '→';
  
  if (confusion.isPersistentPair) {
    console.log(`Q${i+1}: ${q.id} (L${q.level}) | pair=${confusion.pair!.join('↔')} | gap=${gap.toFixed(3)} ${gapTrend} | top=${topMatch?.archetype}(${topMatch?.confidence.toFixed(3)}) | targetPairs=${JSON.stringify(q.targetPairs || [])}`);
  } else {
    console.log(`Q${i+1}: ${q.id} (L${q.level}) | no persistent pair | top=${topMatch?.archetype}(${topMatch?.confidence.toFixed(3)}) | targetPairs=${JSON.stringify(q.targetPairs || [])}`);
  }
  
  prevGap = gap;
  state = processAnswer(state, q, answer);
}

const finalTop = state.currentMatches[0];
console.log(`\nFinal: ${finalTop?.archetype} (conf: ${finalTop?.confidence.toFixed(3)})`);
