#!/usr/bin/env node
/**
 * Debug trace for a specific persona
 */

import {
  initializeEngineState,
  processAnswer,
  selectNextQuestion,
  shouldTerminate,
  getFinalResult,
  detectPersistentConfusionPair,
  PERSISTENT_CONFUSION_PAIRS,
} from '../../packages/shared/src/personality/adaptiveEngine';
import { questionsV4 } from '../../packages/shared/src/personality/questionsV4';
import { archetypeRegistry } from '../../packages/shared/src/personality/archetypeRegistry';
import { findBestMatchingArchetypesV2 } from '../../packages/shared/src/personality/matcherV2';
import { TraitKey, DEFAULT_ASSESSMENT_CONFIG } from '../../packages/shared/src/personality/types';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

function scoreOptionForTraits(
  option: { value: string; traitScores: Partial<Record<TraitKey, number>> },
  targetTraits: Record<TraitKey, number>
): number {
  let score = 0;
  for (const trait of ALL_TRAITS) {
    const optionValue = option.traitScores[trait] || 0;
    const targetValue = targetTraits[trait];
    const traitAlignment = (targetValue - 50) / 50;
    score += optionValue * traitAlignment;
  }
  return score;
}

function selectAnswerByTraits(
  question: any,
  targetTraits: Record<TraitKey, number>
): string {
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
  if (!persona) {
    console.error(`Persona ${personaId} not found`);
    return;
  }

  const traitProfile = persona.profile.traitProfile;
  const config = { ...DEFAULT_ASSESSMENT_CONFIG, useV2Matcher: true };
  let state = initializeEngineState(config);
  const questionSequence: string[] = [];

  console.log(`\n=== Tracing ${personaId} (${persona.name}) ===`);
  console.log(`Expected: ${personaId}`);
  console.log(`Trait profile:`, traitProfile);
  console.log(`Persistent pairs:`, PERSISTENT_CONFUSION_PAIRS.map(p => p.join(' ↔ ')));

  while (true) {
    const question = selectNextQuestion(state);
    if (!question) break;

    const answer = selectAnswerByTraits(question, traitProfile);
    const prevMatches = state.currentMatches.slice(0, 3).map(m => `${m.archetype}(${m.confidence.toFixed(2)})`);
    
    state = processAnswer(state, question, answer);
    
    const newMatches = state.currentMatches.slice(0, 3).map(m => `${m.archetype}(${m.confidence.toFixed(2)})`);
    const confusion = detectPersistentConfusionPair(state.currentMatches);
    
    console.log(`\nQ${questionSequence.length + 1}: ${question.id} (L${question.level}) [${question.primaryTraits.join(',')}]`);
    console.log(`  targetPairs: ${JSON.stringify(question.targetPairs || [])}`);
    console.log(`  Before: ${prevMatches.join(' > ')}`);
    console.log(`  After:  ${newMatches.join(' > ')}`);
    if (confusion.isPersistentPair) {
      console.log(`  🔥 PERSISTENT PAIR: ${confusion.pair!.join(' ↔ ')} (gap: ${confusion.scoreGap.toFixed(3)})`);
    }

    questionSequence.push(question.id);
    if (questionSequence.length >= 25) break;
  }

  // Final result
  const topMatch = state.currentMatches[0];
  const secondMatch = state.currentMatches[1];
  console.log(`\n=== FINAL ===`);
  console.log(`Assigned: ${topMatch?.archetype} (conf: ${topMatch?.confidence.toFixed(3)})`);
  console.log(`Runner-up: ${secondMatch?.archetype} (conf: ${secondMatch?.confidence.toFixed(3)})`);
  console.log(`Questions: ${questionSequence.length}`);
  console.log(`Exact match: ${topMatch?.archetype === personaId ? '✅' : '❌'}`);
}

const personaId = process.argv[2] || 'rooster';
runTrace(personaId);
