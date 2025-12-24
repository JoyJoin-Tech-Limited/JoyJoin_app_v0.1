/**
 * 动态权重调整系统
 * 张浩然/林晓婷专家建议：基于用户反馈自适应调整维度权重
 */

import { DEFAULT_WEIGHTS, type MatchingWeights } from './userMatchingService';

interface FeedbackStats {
  totalFeedbacks: number;
  positiveRate: number;
  dimensionScores: Record<keyof MatchingWeights, number>;
}

interface WeightAdjustment {
  dimension: keyof MatchingWeights;
  delta: number;
  reason: string;
}

const MIN_WEIGHT = 5;
const MAX_WEIGHT = 35;
const LEARNING_RATE = 0.05;

let currentWeights: MatchingWeights = { ...DEFAULT_WEIGHTS };
let feedbackHistory: FeedbackStats[] = [];

export function getCurrentWeights(): MatchingWeights {
  return { ...currentWeights };
}

export function adjustWeightsFromFeedback(
  feedbackData: {
    overallSatisfaction: number;
    dimensionFeedback?: Partial<Record<keyof MatchingWeights, number>>;
    matchPointsDiscussed?: string[];
    eventType?: string;
  }
): WeightAdjustment[] {
  const adjustments: WeightAdjustment[] = [];
  
  if (feedbackData.overallSatisfaction < 3) {
    return adjustments;
  }

  if (feedbackData.dimensionFeedback) {
    for (const [dim, score] of Object.entries(feedbackData.dimensionFeedback)) {
      const dimension = dim as keyof MatchingWeights;
      if (score !== undefined && score > 0) {
        const delta = calculateDelta(score, currentWeights[dimension]);
        if (Math.abs(delta) > 0.5) {
          adjustments.push({
            dimension,
            delta,
            reason: score > 3 
              ? `用户反馈${getDimensionLabel(dimension)}匹配效果好` 
              : `用户反馈${getDimensionLabel(dimension)}需改进`
          });
        }
      }
    }
  }

  if (feedbackData.matchPointsDiscussed && feedbackData.matchPointsDiscussed.length > 0) {
    const dimensionCounts = countMatchPointDimensions(feedbackData.matchPointsDiscussed);
    for (const [dim, count] of Object.entries(dimensionCounts)) {
      if (count > 1) {
        adjustments.push({
          dimension: dim as keyof MatchingWeights,
          delta: LEARNING_RATE * 2,
          reason: `匹配点"${dim}"被多次讨论`
        });
      }
    }
  }

  applyAdjustments(adjustments);
  return adjustments;
}

function calculateDelta(feedbackScore: number, currentWeight: number): number {
  const normalizedFeedback = (feedbackScore - 3) / 2;
  return normalizedFeedback * LEARNING_RATE * currentWeight;
}

function applyAdjustments(adjustments: WeightAdjustment[]): void {
  for (const adj of adjustments) {
    const newWeight = currentWeights[adj.dimension] + adj.delta;
    currentWeights[adj.dimension] = Math.max(MIN_WEIGHT, Math.min(MAX_WEIGHT, newWeight));
  }
  
  normalizeWeights();
}

function normalizeWeights(): void {
  const total = Object.values(currentWeights).reduce((sum, w) => sum + w, 0);
  if (Math.abs(total - 100) > 0.1) {
    const factor = 100 / total;
    for (const key of Object.keys(currentWeights) as (keyof MatchingWeights)[]) {
      currentWeights[key] = Math.round(currentWeights[key] * factor * 10) / 10;
    }
  }
}

function countMatchPointDimensions(matchPoints: string[]): Record<string, number> {
  const counts: Record<string, number> = {};
  
  for (const point of matchPoints) {
    let dim = 'interestsWeight';
    if (point.includes('老乡') || point.includes('来自')) {
      dim = 'backgroundWeight';
    } else if (point.includes('留学') || point.includes('海外')) {
      dim = 'cultureWeight';
    } else if (point.includes('性格') || point.includes('原型')) {
      dim = 'personalityWeight';
    } else if (point.includes('聊天') || point.includes('对话')) {
      dim = 'conversationSignatureWeight';
    } else if (point.includes('目的') || point.includes('意图')) {
      dim = 'intentWeight';
    }
    counts[dim] = (counts[dim] || 0) + 1;
  }
  
  return counts;
}

function getDimensionLabel(dimension: keyof MatchingWeights): string {
  const labels: Record<keyof MatchingWeights, string> = {
    personalityWeight: '性格匹配',
    interestsWeight: '兴趣匹配',
    intentWeight: '意图匹配',
    backgroundWeight: '背景匹配',
    cultureWeight: '文化匹配',
    conversationSignatureWeight: '对话特征',
  };
  return labels[dimension] || dimension;
}

export function getWeightsByEventType(eventType: string): MatchingWeights {
  const weights = { ...currentWeights };
  
  switch (eventType) {
    case 'professional':
    case 'networking':
      weights.backgroundWeight += 5;
      weights.intentWeight += 3;
      weights.interestsWeight -= 5;
      weights.personalityWeight -= 3;
      break;
    case 'hobby':
    case 'interest':
      weights.interestsWeight += 8;
      weights.backgroundWeight -= 5;
      weights.intentWeight -= 3;
      break;
    case 'casual':
    case 'social':
      weights.personalityWeight += 5;
      weights.conversationSignatureWeight += 3;
      weights.backgroundWeight -= 5;
      weights.intentWeight -= 3;
      break;
    case 'cultural':
      weights.cultureWeight += 8;
      weights.backgroundWeight -= 5;
      weights.intentWeight -= 3;
      break;
  }
  
  const total = Object.values(weights).reduce((sum, w) => sum + w, 0);
  const factor = 100 / total;
  for (const key of Object.keys(weights) as (keyof MatchingWeights)[]) {
    weights[key] = Math.round(weights[key] * factor * 10) / 10;
  }
  
  return weights;
}

export function resetWeights(): void {
  currentWeights = { ...DEFAULT_WEIGHTS };
  feedbackHistory = [];
}

export function getWeightStats(): {
  current: MatchingWeights;
  default: MatchingWeights;
  feedbackCount: number;
  deviationFromDefault: number;
} {
  let deviation = 0;
  for (const key of Object.keys(DEFAULT_WEIGHTS) as (keyof MatchingWeights)[]) {
    deviation += Math.abs(currentWeights[key] - DEFAULT_WEIGHTS[key]);
  }
  
  return {
    current: { ...currentWeights },
    default: { ...DEFAULT_WEIGHTS },
    feedbackCount: feedbackHistory.length,
    deviationFromDefault: Math.round(deviation * 10) / 10,
  };
}

export default {
  getCurrentWeights,
  adjustWeightsFromFeedback,
  getWeightsByEventType,
  resetWeights,
  getWeightStats,
};
