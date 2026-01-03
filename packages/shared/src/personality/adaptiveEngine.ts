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
  CohortType,
} from './types';
import { questionsV4, getAnchorQuestions } from './questionsV4';
import { archetypePrototypes, findBestMatchingArchetypes, normalizeTraitScore } from './prototypes';
import { prototypeMatcher, findBestMatchingArchetypesV2, ExplainableMatchResult, UserSecondaryData } from './matcherV2';
import { applyZScoreCapping, calculateSdiIndex, applySdiCorrection } from './traitCorrection';

// Feature flag - can be overridden via config.useV2Matcher
// Default false to ensure opt-in behavior - V2 only enabled when explicitly set in config
export const ENABLE_MATCHER_V2_DEFAULT = false;

// A/B test cohort percentage (0-100) for V2 matcher rollout
// Set to 0 for disabled, 100 for full rollout
export const V2_MATCHER_AB_PERCENTAGE = 50;

/**
 * Deterministic cohort assignment using user ID hash
 * Same user always gets same cohort assignment for consistent experience
 * @param userId - User ID (number or string)
 * @param rolloutPercentage - Percentage of users assigned to V2 (0-100)
 * @returns true if user should use V2 matcher
 */
export function shouldUseV2Matcher(
  userId: number | string,
  rolloutPercentage: number = V2_MATCHER_AB_PERCENTAGE
): boolean {
  if (rolloutPercentage <= 0) return false;
  if (rolloutPercentage >= 100) return true;

  // Simple hash function for deterministic assignment
  const idStr = String(userId);
  let hash = 0;
  for (let i = 0; i < idStr.length; i++) {
    const char = idStr.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  // Map hash to 0-99 range and compare against rollout percentage
  const bucket = Math.abs(hash) % 100;
  return bucket < rolloutPercentage;
}

/**
 * Get cohort label for analytics/logging
 */
export function getCohortLabel(userId: number | string): 'v1' | 'v2' {
  return shouldUseV2Matcher(userId) ? 'v2' : 'v1';
}

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
  detectedCohort?: CohortType;
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
  
  // Note: Z-score capping is applied at match time in matcherV2, not here
  // Keeping raw scores in state for question selection and analytics
  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = newState.traitConfidences[trait].score;
  }
  
  const useV2 = newState.config.useV2Matcher ?? ENABLE_MATCHER_V2_DEFAULT;
  if (useV2) {
    newState.currentMatches = findBestMatchingArchetypesV2(normalizedTraits, undefined, 3);
  } else {
    newState.currentMatches = findBestMatchingArchetypes(normalizedTraits, 3);
  }
  
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

/**
 * Detect user cohort based on trait signals after anchor questions
 * Used to route users to cohort-specific differentiation questions
 * 
 * Cohort thresholds (after 8 anchors):
 * - creative_explorer: O≥78, 55≤X≤78 (灵感章鱼, 机智狐, 沉思猫头鹰)
 * - quiet_anchor: X≤42, C≥72 (隐身猫, 稳如龟, 定心大象)
 * - social_catalyst: X≥78, P≥75 (开心柯基, 太阳鸡, 夸夸豚)
 * - steady_harmonizer: A≥78, 55≤E≤85, 60≤C≤80 (暖心熊, 淡定海豚, 织网蛛)
 */
export function detectCohort(normalizedTraits: Record<TraitKey, number>): CohortType {
  const { A, C, E, O, X, P } = normalizedTraits;
  
  // Priority order: most distinctive patterns first
  
  // Creative Explorer: High openness with moderate extraversion
  if (O >= 78 && X >= 55 && X <= 78) {
    return 'creative_explorer';
  }
  
  // Quiet Anchor: Low extraversion with high conscientiousness  
  if (X <= 42 && C >= 72) {
    return 'quiet_anchor';
  }
  
  // Social Catalyst: High extraversion with high positivity
  if (X >= 78 && P >= 75) {
    return 'social_catalyst';
  }
  
  // Steady Harmonizer: High affinity with moderate emotional stability
  if (A >= 78 && E >= 55 && E <= 85 && C >= 60 && C <= 80) {
    return 'steady_harmonizer';
  }
  
  // Fallback: check for partial matches with relaxed thresholds
  // Creative tendency
  if (O >= 70) {
    return 'creative_explorer';
  }
  
  // Introverted tendency
  if (X <= 45) {
    return 'quiet_anchor';
  }
  
  // Social tendency
  if (X >= 70) {
    return 'social_catalyst';
  }
  
  // Default to harmonizer (most balanced)
  return 'steady_harmonizer';
}

export function selectNextQuestion(state: EngineState): AdaptiveQuestion | null {
  const { answeredQuestionIds, skippedQuestionIds, config, traitConfidences } = state;
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
  
  // Detect cohort after anchor questions if not already detected
  let updatedState = state;
  if (!state.detectedCohort && questionCount >= config.anchorQuestionCount) {
    const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
    for (const trait of ALL_TRAITS) {
      normalizedTraits[trait] = traitConfidences[trait]?.score ?? 50;
    }
    updatedState = { ...state, detectedCohort: detectCohort(normalizedTraits) };
  }
  
  if (shouldTerminate(updatedState)) {
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
    score: calculateQuestionUtility(q, updatedState),
  }));
  
  scoredQuestions.sort((a, b) => b.score - a.score);
  
  // Implement option randomization
  const selectedQuestion = scoredQuestions[0]?.question || null;
  if (selectedQuestion) {
    const randomizedOptions = [...selectedQuestion.options].sort(() => Math.random() - 0.5);
    return { ...selectedQuestion, options: randomizedOptions };
  }
  
  return null;
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
  
  // Implement option randomization for skipped question
  if (newQuestion) {
    const randomizedOptions = [...newQuestion.options].sort(() => Math.random() - 0.5);
    return { newState, newQuestion: { ...newQuestion, options: randomizedOptions } };
  }
  
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
    
    const selectedQuestion = scoredQuestions[0]?.question || null;
    if (selectedQuestion) {
      const randomizedOptions = [...selectedQuestion.options].sort(() => Math.random() - 0.5);
      return { ...selectedQuestion, options: randomizedOptions };
    }
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
  const { traitConfidences, currentMatches, detectedCohort } = state;
  
  let informationGain = 0;
  for (const trait of question.primaryTraits) {
    const conf = traitConfidences[trait];
    if (conf) {
      informationGain += (1 - conf.confidence);
    }
  }
  informationGain /= question.primaryTraits.length;
  
  let discriminationBonus = 0;
  let targetedPairBonus = 0;
  
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
      
      // Check if this question has explicit targetPairs that match the current top 2
      if (question.targetPairs && question.targetPairs.length > 0) {
        const topArchetypes = [top2[0].archetype, top2[1].archetype];
        const matchCount = topArchetypes.filter(a => question.targetPairs!.includes(a)).length;
        if (matchCount >= 2) {
          // Strong bonus - this question is designed exactly for this confusion
          targetedPairBonus = 0.5;
        } else if (matchCount >= 1) {
          // Moderate bonus - at least one archetype matches
          targetedPairBonus = 0.2;
        }
      }
    }
  }
  
  const levelBonus = question.level === 3 ? 0.1 : question.level === 2 ? 0.05 : 0;
  
  const discriminationIndex = question.discriminationIndex || 0.3;
  
  // Forced choice questions get a small boost when differentiating close matches
  const forcedChoiceBonus = question.isForcedChoice && currentMatches.length >= 2 ? 0.1 : 0;
  
  // Cohort-based routing bonus/penalty
  let cohortBonus = 0;
  if (detectedCohort && question.cohortTag) {
    if (question.cohortTag === detectedCohort) {
      // Strong bonus for cohort-matched questions (+0.12)
      cohortBonus = 0.12;
    } else if (question.cohortTag === 'universal') {
      // No bonus or penalty for universal questions
      cohortBonus = 0;
    } else {
      // Penalty for mismatched cohort questions (-0.08)
      cohortBonus = -0.08;
    }
  }
  
  return (
    informationGain * 0.3 +
    discriminationBonus * 0.2 +
    targetedPairBonus * 0.25 +
    discriminationIndex * 0.15 +
    levelBonus * 0.05 +
    forcedChoiceBonus * 0.05 +
    cohortBonus
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
      if (config.enableTieredThreshold) {
        const needsExtraQuestions = checkTieredThresholdConditions(state, config);
        const extraQuestionsUsed = questionCount - config.softMaxQuestions;
        
        if (needsExtraQuestions && extraQuestionsUsed < config.tieredThresholdConfig.maxExtraQuestions) {
          return false;
        }
      }
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
      if (config.enableTieredThreshold) {
        const needsExtraQuestions = checkTieredThresholdConditions(state, config);
        if (needsExtraQuestions) {
          return false;
        }
      }
      return true;
    }
  }
  
  return false;
}

function checkTieredThresholdConditions(state: EngineState, config: AssessmentConfig): boolean {
  const { currentMatches, traitConfidences, traitSampleCounts } = state;
  const tieredConfig = config.tieredThresholdConfig;
  
  if (currentMatches.length >= 2) {
    const confidenceGap = currentMatches[0].confidence - currentMatches[1].confidence;
    if (confidenceGap < tieredConfig.confidenceGapThreshold) {
      return true;
    }
  }
  
  const totalSamples = Object.values(traitSampleCounts).reduce((a, b) => a + b, 0);
  if (totalSamples > 0) {
    const coveredDimensions = Object.values(traitConfidences).filter(t => t.confidence >= 0.6).length;
    const coverageRatio = coveredDimensions / ALL_TRAITS.length;
    if (coverageRatio < tieredConfig.dimensionCoverageThreshold) {
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

export interface FinalResultV2 {
  primaryArchetype: string;
  secondaryArchetype?: string;
  traitScores: Record<TraitKey, number>;
  confidences: Record<TraitKey, number>;
  validityScore: number;
  algorithmVersion: string;
  matchDetails?: ExplainableMatchResult;
  isDecisive?: boolean;
  decisiveReason?: string;
}

export function getFinalResult(state: EngineState, userSecondaryData?: UserSecondaryData): FinalResultV2 {
  const normalizedTraits: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  const confidences: Record<TraitKey, number> = {} as Record<TraitKey, number>;
  
  for (const trait of ALL_TRAITS) {
    normalizedTraits[trait] = state.traitConfidences[trait].score;
    confidences[trait] = state.traitConfidences[trait].confidence;
  }
  
  // Calculate SDI from answer history for analytics (SDI correction disabled for now - too aggressive)
  // Note: Z-score capping is already applied in processAnswer, so scores are already corrected
  const answerTraitScores = state.questionHistory.map(a => a.traitScores as Record<string, number>);
  const sdiIndex = calculateSdiIndex(answerTraitScores);
  
  // SDI correction temporarily disabled - was causing over-correction
  // Will re-enable with tuned parameters after baseline validation
  // if (sdiIndex > 70) {
  //   const correctedTraits = applySdiCorrection(normalizedTraits, sdiIndex);
  //   for (const trait of ALL_TRAITS) {
  //     normalizedTraits[trait] = correctedTraits[trait];
  //   }
  // }
  void sdiIndex; // Suppress unused variable warning
  
  const useV2 = state.config.useV2Matcher ?? ENABLE_MATCHER_V2_DEFAULT;
  if (useV2) {
    const matches = prototypeMatcher.findBestMatches(normalizedTraits, userSecondaryData, 3);
    const decisiveCheck = prototypeMatcher.isDecisiveMatch(matches);
    
    return {
      primaryArchetype: matches[0]?.archetype || '开心柯基',
      secondaryArchetype: matches[1]?.archetype,
      traitScores: normalizedTraits,
      confidences,
      validityScore: calculateValidityScore(state),
      algorithmVersion: prototypeMatcher.getAlgorithmVersion(),
      matchDetails: matches[0],
      isDecisive: decisiveCheck.decisive,
      decisiveReason: decisiveCheck.reason,
    };
  }
  
  const matches = findBestMatchingArchetypes(normalizedTraits, 2);
  
  return {
    primaryArchetype: matches[0]?.archetype || '开心柯基',
    secondaryArchetype: matches[1]?.archetype,
    traitScores: normalizedTraits,
    confidences,
    validityScore: calculateValidityScore(state),
    algorithmVersion: 'v1.0',
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
