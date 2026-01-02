/**
 * V4 Adaptive Assessment Engine
 * 自适应测评引擎 - 弹性16+4题目选择算法
 */

import {
  TraitKey,
  TraitConfidence,
  ArchetypeMatch,
  AnsweredQuestion,
  DEFAULT_ASSESSMENT_CONFIG,
  CONFUSABLE_ARCHETYPE_PAIRS,
  AssessmentConfig,
  AdaptiveQuestion,
} from './types';
import { questionsV4, getAnchorQuestions } from './questionsV4';
import { archetypePrototypes, findBestMatchingArchetypes, normalizeTraitScore } from './prototypes';

const ALL_TRAITS: TraitKey[] = ['A', 'C', 'E', 'O', 'X', 'P'];

export const MAX_SKIP_COUNT = 3;

export interface EngineState {
  answeredQuestionIds: Set<string>;
  skippedQuestionIds: Set<string>;
  skipCount: number;
  traitScores: Record<TraitKey, number>;
  traitSampleCounts: Record<TraitKey, number>;
  traitConfidences: Record<TraitKey, TraitConfidence>;
  currentMatches: ArchetypeMatch[];
  questionHistory: AnsweredQuestion[];
  config: AssessmentConfig;
}

export function initializeEngineState(config?: Partial<AssessmentConfig>): EngineState {
  const fullConfig = { ...DEFAULT_ASSESSMENT_CONFIG, ...config };
  
  const traitScores: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const traitSampleCounts: Record<TraitKey, number> = { A: 0, C: 0, E: 0, O: 0, X: 0, P: 0 };
  const traitConfidences: Record<TraitKey, TraitConfidence> = {} as Record<TraitKey, TraitConfidence>;
  
  for (const trait of ALL_TRAITS) {
    traitConfidences[trait] = {
      trait,
      score: 0,
      confidence: 0,
      sampleCount: 0,
    };
  }
  
  return {
    answeredQuestionIds: new Set(),
    skippedQuestionIds: new Set(),
    skipCount: 0,
    traitScores,
    traitSampleCounts,
    traitConfidences,
    currentMatches: [],
    questionHistory: [],
    config: fullConfig,
  };
}

export function processAnswer(
  state: EngineState,
  question: AdaptiveQuestion,
  selectedOption: string
): EngineState {
  const option = question.options.find(o => o.value === selectedOption);
  if (!option) {
    throw new Error(`Invalid option ${selectedOption} for question ${question.id}`);
  }
  
  const newState = { ...state };
  newState.answeredQuestionIds = new Set(state.answeredQuestionIds);
  newState.answeredQuestionIds.add(question.id);
  
  newState.traitScores = { ...state.traitScores };
  newState.traitSampleCounts = { ...state.traitSampleCounts };
  newState.traitConfidences = { ...state.traitConfidences };
  
  for (const [trait, score] of Object.entries(option.traitScores) as [TraitKey, number][]) {
    if (score !== undefined && score !== 0) {
      newState.traitScores[trait] = (newState.traitScores[trait] || 0) + score;
      newState.traitSampleCounts[trait] = (newState.traitSampleCounts[trait] || 0) + 1;
    }
  }
  
  for (const trait of ALL_TRAITS) {
    const rawScore = newState.traitScores[trait];
    const sampleCount = newState.traitSampleCounts[trait];
    const normalizedScore = normalizeTraitScore(rawScore / Math.max(1, sampleCount) * sampleCount);
    
    const confidence = calculateTraitConfidence(sampleCount, rawScore);
    
    newState.traitConfidences[trait] = {
      trait,
      score: normalizedScore,
      confidence,
      sampleCount,
    };
  }
  
  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = newState.traitConfidences[trait].score;
  }
  
  newState.currentMatches = findBestMatchingArchetypes(normalizedTraits, 3);
  
  newState.questionHistory = [
    ...state.questionHistory,
    {
      questionId: question.id,
      selectedOption,
      traitScores: option.traitScores,
      answeredAt: new Date().toISOString(),
    },
  ];
  
  return newState;
}

function calculateTraitConfidence(sampleCount: number, totalScore: number): number {
  if (sampleCount === 0) return 0;
  
  const baseSampleWeight = Math.min(1, sampleCount / 4);
  
  const scoreVariance = Math.abs(totalScore) / Math.max(1, sampleCount);
  const consistencyBonus = Math.min(0.2, scoreVariance * 0.05);
  
  return Math.min(1, baseSampleWeight * 0.8 + consistencyBonus);
}

export function selectNextQuestion(state: EngineState): AdaptiveQuestion | null {
  const { answeredQuestionIds, skippedQuestionIds, config } = state;
  const questionCount = answeredQuestionIds.size;
  
  if (questionCount < config.anchorQuestionCount) {
    const anchors = getAnchorQuestions();
    const unansweredAnchors = anchors.filter(q => 
      !answeredQuestionIds.has(q.id) && !skippedQuestionIds.has(q.id)
    );
    if (unansweredAnchors.length > 0) {
      return unansweredAnchors[0];
    }
  }
  
  if (shouldTerminate(state)) {
    return null;
  }
  
  const availableQuestions = questionsV4.filter(q => 
    !answeredQuestionIds.has(q.id) && !skippedQuestionIds.has(q.id)
  );
  if (availableQuestions.length === 0) {
    return null;
  }
  
  const scoredQuestions = availableQuestions.map(q => ({
    question: q,
    score: calculateQuestionUtility(q, state),
  }));
  
  scoredQuestions.sort((a, b) => b.score - a.score);
  
  return scoredQuestions[0]?.question || null;
}

export function skipQuestion(
  state: EngineState,
  currentQuestionId: string
): { newState: EngineState; newQuestion: AdaptiveQuestion | null } | null {
  if (state.skipCount >= MAX_SKIP_COUNT) {
    return null;
  }
  
  const newState = { ...state };
  newState.skippedQuestionIds = new Set(state.skippedQuestionIds);
  newState.skippedQuestionIds.add(currentQuestionId);
  newState.skipCount = state.skipCount + 1;
  
  const currentQuestion = questionsV4.find(q => q.id === currentQuestionId);
  const currentLevel = currentQuestion?.level || 2;
  
  const newQuestion = selectAlternativeQuestion(newState, currentLevel);
  
  return { newState, newQuestion };
}

export function selectAlternativeQuestion(
  state: EngineState,
  preferredLevel: 1 | 2 | 3
): AdaptiveQuestion | null {
  const { answeredQuestionIds, skippedQuestionIds } = state;
  
  const sameLevelQuestions = questionsV4.filter(q => 
    q.level === preferredLevel &&
    !answeredQuestionIds.has(q.id) && 
    !skippedQuestionIds.has(q.id)
  );
  
  if (sameLevelQuestions.length > 0) {
    const scoredQuestions = sameLevelQuestions.map(q => ({
      question: q,
      score: calculateQuestionUtility(q, state),
    }));
    scoredQuestions.sort((a, b) => b.score - a.score);
    return scoredQuestions[0]?.question || null;
  }
  
  return selectNextQuestion(state);
}

export function canSkipQuestion(state: EngineState): boolean {
  return state.skipCount < MAX_SKIP_COUNT;
}

export function getRemainingSkips(state: EngineState): number {
  return MAX_SKIP_COUNT - state.skipCount;
}

function calculateQuestionUtility(question: AdaptiveQuestion, state: EngineState): number {
  const { traitConfidences, currentMatches } = state;
  
  let informationGain = 0;
  for (const trait of question.primaryTraits) {
    const conf = traitConfidences[trait];
    if (conf) {
      informationGain += (1 - conf.confidence);
    }
  }
  informationGain /= question.primaryTraits.length;
  
  let discriminationBonus = 0;
  if (currentMatches.length >= 2) {
    const top2 = currentMatches.slice(0, 2);
    const proto1 = archetypePrototypes[top2[0].archetype];
    const proto2 = archetypePrototypes[top2[1].archetype];
    
    if (proto1 && proto2) {
      for (const trait of question.primaryTraits) {
        const diff = Math.abs(proto1.traitProfile[trait] - proto2.traitProfile[trait]);
        discriminationBonus += diff / 100;
      }
      discriminationBonus /= question.primaryTraits.length;
    }
  }
  
  const levelBonus = question.level === 3 ? 0.1 : question.level === 2 ? 0.05 : 0;
  
  const discriminationIndex = question.discriminationIndex || 0.3;
  
  return (
    informationGain * 0.4 +
    discriminationBonus * 0.3 +
    discriminationIndex * 0.2 +
    levelBonus * 0.1
  );
}

export function shouldTerminate(state: EngineState): boolean {
  const { answeredQuestionIds, config, currentMatches, traitConfidences } = state;
  const questionCount = answeredQuestionIds.size;
  
  if (questionCount >= config.hardMaxQuestions) {
    return true;
  }
  
  if (questionCount < config.minQuestions) {
    return false;
  }
  
  const allConfidences = Object.values(traitConfidences).map(t => t.confidence);
  const avgConfidence = allConfidences.reduce((a, b) => a + b, 0) / allConfidences.length;
  const minConfidence = Math.min(...allConfidences);
  
  const hasConfusablePair = checkConfusablePairRisk(currentMatches, config.confusablePairThreshold);
  const requiredConfidence = hasConfusablePair 
    ? config.confusablePairThreshold 
    : config.defaultConfidenceThreshold;
  
  if (questionCount >= config.softMaxQuestions) {
    if (avgConfidence >= requiredConfidence && minConfidence >= requiredConfidence * 0.8) {
      return true;
    }
    
    if (questionCount >= config.softMaxQuestions + 2) {
      const topMatch = currentMatches[0];
      const secondMatch = currentMatches[1];
      if (topMatch && secondMatch) {
        const confidenceGap = topMatch.confidence - secondMatch.confidence;
        if (confidenceGap > 0.15) {
          return true;
        }
      }
    }
    
    return false;
  }
  
  if (avgConfidence >= requiredConfidence && 
      minConfidence >= requiredConfidence * 0.85 &&
      currentMatches[0]?.confidence >= requiredConfidence) {
    
    if (!hasConfusablePair) {
      return true;
    }
  }
  
  return false;
}

function checkConfusablePairRisk(matches: ArchetypeMatch[], threshold: number): boolean {
  if (matches.length < 2) return false;
  
  const top2 = [matches[0].archetype, matches[1].archetype];
  const confidenceGap = matches[0].confidence - matches[1].confidence;
  
  if (confidenceGap > 0.2) return false;
  
  for (const pair of CONFUSABLE_ARCHETYPE_PAIRS) {
    if (
      (pair.archetypes.includes(top2[0]) && pair.archetypes.includes(top2[1])) ||
      (pair.archetypes[0] === top2[0] && pair.archetypes[1] === top2[1]) ||
      (pair.archetypes[1] === top2[0] && pair.archetypes[0] === top2[1])
    ) {
      return matches[0].confidence < threshold;
    }
  }
  
  return false;
}

export function getPreSignupPreview(state: EngineState): {
  previewArchetype: string;
  confidence: number;
  traitProfile: Record<TraitKey, number>;
} {
  const topMatch = state.currentMatches[0];
  
  const traitProfile: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    traitProfile[trait] = state.traitConfidences[trait].score;
  }
  
  return {
    previewArchetype: topMatch?.archetype || '开心柯基',
    confidence: topMatch?.confidence || 0,
    traitProfile,
  };
}

export function calculateValidityScore(state: EngineState): number {
  return 0.85;
}

export function getFinalResult(state: EngineState): {
  primaryArchetype: string;
  secondaryArchetype?: string;
  traitScores: Record<TraitKey, number>;
  confidences: Record<TraitKey, number>;
  validityScore: number;
} {
  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  const confidences: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = state.traitConfidences[trait].score;
    confidences[trait] = state.traitConfidences[trait].confidence;
  }
  
  const matches = findBestMatchingArchetypes(normalizedTraits, 2);
  
  return {
    primaryArchetype: matches[0]?.archetype || '开心柯基',
    secondaryArchetype: matches[1]?.archetype,
    traitScores: normalizedTraits,
    confidences,
    validityScore: calculateValidityScore(state),
  };
}

export function importPreSignupAnswers(
  state: EngineState,
  preSignupAnswers: AnsweredQuestion[]
): EngineState {
  let currentState = state;
  
  for (const answer of preSignupAnswers) {
    const question = questionsV4.find(q => q.id === answer.questionId);
    if (question) {
      currentState = processAnswer(currentState, question, answer.selectedOption);
    }
  }
  
  return currentState;
}
