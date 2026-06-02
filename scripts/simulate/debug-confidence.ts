#!/usr/bin/env node
/**
 * Check top match confidence for all personas when persistent pair is detected
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  detectPersistentConfusionPair,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { archetypeRegistry } from '../../packages/shared/src/personality/archetypeRegistry';
import { TraitKey, DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

function scoreOptionForTraits(option: any, targetTraits: Record<TraitKey, number>): number {
  let score = 0;
  for (const trait of ALL_TRAITS) {
    const optionValue = option.traitScores[trait] || 0;
    const targetValue = targetTraits[trait];
    const traitAlignment = (targetValue - 50) / 50;
    score += optionValue * traitAlignment;
  }
  return score;
}

function selectAnswerByTraits(question: any, targetTraits: Record<TraitKey, number>): string {
  let bestOption = question.options[0];
  let bestScore = -Infinity;
  for (const option of question.options) {
    const score = scoreOptionForTraits(option, targetTraits);
    if (score > bestScore) {
      bestScore = score;
      bestOption = option;
    }
  }
  return bestOption.value;
}

function runTrace(personaId: string) {
  const registry = archetypeRegistry as any;
  const persona = registry[personaId];
  const traitProfile = persona.profile.traitProfile;
  const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
  let state = initializeEngineState(config);

  const detections: Array<{ q: number; pair: string; gap: number; topConf: number; topArchetype: string }> = [];

  for (let i = 0; i < 16; i++) {
    const q = selectNextQuestion(state);
    if (!q) break;
    const answer = selectAnswerByTraits(q, traitProfile);
    
    const confusion = detectPersistentConfusionPair(state.currentMatches);
    if (confusion.isPersistentPair) {
      detections.push({
        q: i + 1,
        pair: confusion.pair!.join('↔'),
        gap: confusion.scoreGap,
        topConf: state.currentMatches[0]?.confidence || 0,
        topArchetype: state.currentMatches[0]?.archetype || '',
      });
    }
    
    state = processAnswer(state, q, answer);
  }

  const finalTop = state.currentMatches[0];
  const exact = finalTop?.archetype === personaId;
  
  if (detections.length > 0) {
    const first = detections[0];
    const minConf = Math.min(...detections.map(d => d.topConf));
    console.log(`${personaId.padEnd(15)} exact=${exact ? '✅' : '❌'} firstPair=${first.pair.padEnd(20)} firstGap=${first.gap.toFixed(3)} firstConf=${first.topConf.toFixed(3)} firstTop=${first.topArchetype.padEnd(12)} minConf=${minConf.toFixed(3)} detections=${detections.length}`);
  } else {
    console.log(`${personaId.padEnd(15)} exact=${exact ? '✅' : '❌'} no persistent pair detected`);
  }
}

for (const id of Object.keys(archetypeRegistry)) {
  runTrace(id);
}
