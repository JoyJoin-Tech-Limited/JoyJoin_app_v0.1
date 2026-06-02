#!/usr/bin/env node
/**
 * Debug utility scoring for a specific persona at a specific question number
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
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

function runTrace(personaId: string, inspectAtQuestion: number) {
  const registry = archetypeRegistry as any;
  const persona = registry[personaId];
  const traitProfile = persona.profile.traitProfile;
  const config = {
    ...DEFAULT_ASSESSMENT_CONFIG,
    useV2Matcher: true,
  };
  let state = initializeEngineState(config);

  for (let i = 0; i < inspectAtQuestion - 1; i++) {
    const q = selectNextQuestion(state);
    if (!q) break;
    const answer = selectAnswerByTraits(q, traitProfile);
    state = processAnswer(state, q, answer);
  }

  const nextQ = selectNextQuestion(state);
  console.log(`\n=== After Q${inspectAtQuestion - 1}, next question selected: ${nextQ?.id} (L${nextQ?.level}) ===`);
  console.log(`Top matches: ${state.currentMatches.slice(0, 3).map((m: any) => `${m.archetype}(${m.confidence.toFixed(3)})`).join(' > ')}`);
  
  const available = questionsV4.filter((q: any) => 
    !state.answeredQuestionIds.has(q.id) && 
    !state.skippedQuestionIds.has(q.id) &&
    !['Q_PLAYFUL_SLIDER', 'Q_PLAYFUL_EMOJI'].includes(q.id)
  );
  
  const scored = available.map((q: any) => {
    const top2 = state.currentMatches.slice(0, 2);
    let discBonus = 0;
    if (top2.length >= 2) {
      const proto1 = (archetypeRegistry as any)[top2[0].archetype]?.profile?.traitProfile;
      const proto2 = (archetypeRegistry as any)[top2[1].archetype]?.profile?.traitProfile;
      if (proto1 && proto2) {
        for (const trait of q.primaryTraits) {
          discBonus += Math.abs((proto1[trait] || 50) - (proto2[trait] || 50)) / 100;
        }
        discBonus /= q.primaryTraits.length;
      }
    }
    const di = q.discriminationIndex || 0.3;
    const levelBonus = q.level === 3 ? 0.1 : q.level === 2 ? 0.05 : 0;
    const targetPairBoost = q.targetPairs?.includes('机智狐') && q.targetPairs?.includes('灵感章鱼') ? 'OCTOPUS-FOX' : 
                           q.targetPairs?.includes('开心柯基') && q.targetPairs?.includes('太阳鸡') ? 'CORGI-ROOSTER' :
                           q.targetPairs?.includes('隐身猫') && q.targetPairs?.includes('稳如龟') ? 'CAT-TURTLE' :
                           q.targetPairs?.includes('织网蛛') && q.targetPairs?.includes('淡定海豚') ? 'SPIDER-DOLPHIN' : '';
    return {
      id: q.id,
      level: q.level,
      primaryTraits: q.primaryTraits.join(','),
      di,
      discBonus: discBonus.toFixed(3),
      levelBonus,
      targetPairBoost,
      score: (di * 0.15 + discBonus * 0.20 + levelBonus * 0.05).toFixed(3),
    };
  });
  
  scored.sort((a: any, b: any) => parseFloat(b.score) - parseFloat(a.score));
  console.log('\nTop 15 available questions by heuristic score:');
  console.table(scored.slice(0, 15));
}

const personaId = process.argv[2] || 'octopus';
const qNum = parseInt(process.argv[3] || '9', 10);
runTrace(personaId, qNum);
