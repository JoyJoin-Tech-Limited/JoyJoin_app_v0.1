/**
 * 匹配权重服务 - AI进化系统核心组件
 * 实现动态权重读取、Thompson Sampling优化、权重历史记录
 */

import { db } from './db';
import { 
  matchingWeightsConfig, 
  matchingWeightsHistory,
  type MatchingWeightsConfig,
  type MatchingWeightsHistory,
  type InsertMatchingWeightsHistory
} from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

export interface MatchingWeights {
  personalityWeight: number;
  interestsWeight: number;
  intentWeight: number;
  backgroundWeight: number;
  cultureWeight: number;
  conversationSignatureWeight: number;
}

type MatchingDimension =
  | 'personality'
  | 'interests'
  | 'intent'
  | 'background'
  | 'culture'
  | 'conversationSignature';

type WeightField = keyof MatchingWeights;

export interface ShadowOutcomeSignals {
  eventId?: string;
  feedbackId?: string;
  userId?: string;
  source?: string;
  wouldMeetAgain?: boolean | null;
  wouldAttendAgain?: boolean | null;
  hasNewConnections?: boolean | null;
  atmosphereScore?: number | null;
  connectionStatus?: string | null;
  connectionCount?: number | null;
  mutualConnectionCount?: number | null;
  conversationComfort?: number | null;
  connectionRadar?: {
    topicResonance?: number | null;
    personalityMatch?: number | null;
    backgroundDiversity?: number | null;
    overallFit?: number | null;
  } | null;
}

export interface ShadowDimensionRecommendationMetric {
  dimension: MatchingDimension;
  score: number | null;
  hasSignal: boolean;
  priorAlpha: number;
  priorBeta: number;
  posteriorAlpha: number;
  posteriorBeta: number;
  posteriorMean: number;
  sampleCount: number;
  confidence: number;
  liveWeight: number;
  recommendedWeight: number;
  delta: number;
}

export interface ShadowWeightRecommendation {
  configId: string;
  outcomeScore: number;
  signalCoverage: number;
  sampleSize: number;
  overallConfidence: number;
  liveWeights: MatchingWeights;
  recommendedWeights: MatchingWeights;
  dimensionMetrics: Record<MatchingDimension, ShadowDimensionRecommendationMetric>;
  outcomeSignals: ShadowOutcomeSignals;
}

export const SHADOW_RECOMMENDATION_REASON = 'shadow_feedback_recommendation';

const DIMENSIONS: ReadonlyArray<{
  key: MatchingDimension;
  weightField: WeightField;
  alphaField: keyof MatchingWeightsConfig;
  betaField: keyof MatchingWeightsConfig;
}> = [
  {
    key: 'personality',
    weightField: 'personalityWeight',
    alphaField: 'personalityAlpha',
    betaField: 'personalityBeta',
  },
  {
    key: 'interests',
    weightField: 'interestsWeight',
    alphaField: 'interestsAlpha',
    betaField: 'interestsBeta',
  },
  {
    key: 'intent',
    weightField: 'intentWeight',
    alphaField: 'intentAlpha',
    betaField: 'intentBeta',
  },
  {
    key: 'background',
    weightField: 'backgroundWeight',
    alphaField: 'backgroundAlpha',
    betaField: 'backgroundBeta',
  },
  {
    key: 'culture',
    weightField: 'cultureWeight',
    alphaField: 'cultureAlpha',
    betaField: 'cultureBeta',
  },
  {
    key: 'conversationSignature',
    weightField: 'conversationSignatureWeight',
    alphaField: 'conversationSignatureAlpha',
    betaField: 'conversationSignatureBeta',
  },
] as const;

const DEFAULT_WEIGHTS: MatchingWeights = {
  personalityWeight: 23,
  interestsWeight: 24,
  intentWeight: 13,
  backgroundWeight: 15,
  cultureWeight: 10,
  conversationSignatureWeight: 15,
};

let cachedWeights: MatchingWeights | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL_MS = 60000;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseNumericWeight(value: string | number | null | undefined, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === 'string') {
    const parsed = Number.parseFloat(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => typeof value === 'number' && Number.isFinite(value));
  if (valid.length === 0) {
    return null;
  }
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

function normalizeFivePointScore(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return clamp(value, 1, 5) * 20;
}

function normalizeBooleanScore(value: boolean | null | undefined, truthyScore = 100, falsyScore = 20): number | null {
  if (typeof value !== 'boolean') {
    return null;
  }
  return value ? truthyScore : falsyScore;
}

function normalizeStatusScore(status: string | null | undefined): number | null {
  switch (status) {
    case '已交换联系方式':
      return 100;
    case '有但还没联系':
      return 80;
    case '没有但很愉快':
      return 65;
    case '没有不太合适':
      return 25;
    default:
      return null;
  }
}

function normalizeConnectionCountScore(count: number | null | undefined): number | null {
  if (typeof count !== 'number' || !Number.isFinite(count)) {
    return null;
  }
  if (count <= 0) {
    return 20;
  }
  return clamp(40 + count * 20, 40, 100);
}

function normalizeConversationComfort(value: number | null | undefined): number | null {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return null;
  }
  return clamp(value, 0, 100);
}

function buildDimensionScores(outcomeSignals: ShadowOutcomeSignals): Partial<Record<MatchingDimension, number>> {
  const statusScore = normalizeStatusScore(outcomeSignals.connectionStatus);
  const atmosphereScore = normalizeFivePointScore(outcomeSignals.atmosphereScore);
  const wouldMeetAgainScore = normalizeBooleanScore(outcomeSignals.wouldMeetAgain);
  const wouldAttendAgainScore = normalizeBooleanScore(outcomeSignals.wouldAttendAgain);
  const hasNewConnectionsScore = normalizeBooleanScore(outcomeSignals.hasNewConnections, 90, 25);
  const connectionCountScore = normalizeConnectionCountScore(outcomeSignals.connectionCount);
  const mutualConnectionScore = normalizeConnectionCountScore(outcomeSignals.mutualConnectionCount);
  const overallFitScore = normalizeFivePointScore(outcomeSignals.connectionRadar?.overallFit);

  return {
    personality: average([
      normalizeFivePointScore(outcomeSignals.connectionRadar?.personalityMatch),
      wouldMeetAgainScore,
      statusScore,
    ]) ?? undefined,
    interests: average([
      normalizeFivePointScore(outcomeSignals.connectionRadar?.topicResonance),
      connectionCountScore,
      wouldMeetAgainScore,
    ]) ?? undefined,
    intent: average([
      overallFitScore,
      wouldMeetAgainScore,
      wouldAttendAgainScore,
      statusScore,
    ]) ?? undefined,
    background: average([
      normalizeFivePointScore(outcomeSignals.connectionRadar?.backgroundDiversity),
      hasNewConnectionsScore,
      mutualConnectionScore,
    ]) ?? undefined,
    culture: average([
      atmosphereScore,
      wouldAttendAgainScore,
      statusScore,
    ]) ?? undefined,
    conversationSignature: average([
      normalizeConversationComfort(outcomeSignals.conversationComfort),
      atmosphereScore,
      overallFitScore,
    ]) ?? undefined,
  };
}

function buildOutcomeScore(outcomeSignals: ShadowOutcomeSignals): number | null {
  const normalized = average([
    normalizeFivePointScore(outcomeSignals.atmosphereScore),
    normalizeBooleanScore(outcomeSignals.wouldMeetAgain),
    normalizeBooleanScore(outcomeSignals.wouldAttendAgain),
    normalizeStatusScore(outcomeSignals.connectionStatus),
    normalizeConnectionCountScore(outcomeSignals.mutualConnectionCount ?? outcomeSignals.connectionCount),
  ]);

  if (normalized === null) {
    return null;
  }

  return clamp(normalized / 20, 1, 5);
}

function normalizePosteriorWeights(
  posteriorMeans: Record<MatchingDimension, number>,
): Record<MatchingDimension, number> {
  const total = Object.values(posteriorMeans).reduce((sum, value) => sum + value, 0);
  if (total <= 0) {
    return {
      personality: DEFAULT_WEIGHTS.personalityWeight / 100,
      interests: DEFAULT_WEIGHTS.interestsWeight / 100,
      intent: DEFAULT_WEIGHTS.intentWeight / 100,
      background: DEFAULT_WEIGHTS.backgroundWeight / 100,
      culture: DEFAULT_WEIGHTS.cultureWeight / 100,
      conversationSignature: DEFAULT_WEIGHTS.conversationSignatureWeight / 100,
    };
  }

  return Object.fromEntries(
    Object.entries(posteriorMeans).map(([key, value]) => [key, value / total]),
  ) as Record<MatchingDimension, number>;
}

function calculateConfidence(alpha: number, beta: number): number {
  const sampleCount = Math.max(alpha + beta - 2, 0);
  return clamp(sampleCount / (sampleCount + 5), 0, 1);
}

export function buildShadowRecommendation(
  config: MatchingWeightsConfig,
  outcomeSignals: ShadowOutcomeSignals,
): ShadowWeightRecommendation | null {
  const outcomeScore = buildOutcomeScore(outcomeSignals);
  if (outcomeScore === null) {
    return null;
  }

  const liveWeights = DIMENSIONS.reduce((acc, dimension) => {
    acc[dimension.weightField] = parseNumericWeight(
      config[dimension.weightField] as string | number | null | undefined,
      DEFAULT_WEIGHTS[dimension.weightField] / 100,
    );
    return acc;
  }, {} as MatchingWeights);

  const dimensionScores = buildDimensionScores(outcomeSignals);
  const signalCoverage =
    Object.values(dimensionScores).filter((score) => typeof score === 'number' && Number.isFinite(score)).length /
    DIMENSIONS.length;
  const isSuccessfulOutcome = outcomeScore >= 4;

  const posteriorMeans = {} as Record<MatchingDimension, number>;
  const dimensionMetrics = {} as Record<MatchingDimension, ShadowDimensionRecommendationMetric>;

  for (const dimension of DIMENSIONS) {
    const priorAlpha = Number(config[dimension.alphaField] ?? 1) || 1;
    const priorBeta = Number(config[dimension.betaField] ?? 1) || 1;
    const rawScore = dimensionScores[dimension.key];
    const hasSignal = typeof rawScore === 'number' && Number.isFinite(rawScore);
    const score = hasSignal ? clamp(rawScore, 0, 100) : null;
    const scoredSignal = score ?? 0;
    const posteriorAlpha = priorAlpha + (hasSignal && isSuccessfulOutcome && scoredSignal >= 60 ? 1 : 0);
    const posteriorBeta = priorBeta + (hasSignal && !isSuccessfulOutcome && scoredSignal < 60 ? 1 : 0);
    const posteriorMean = posteriorAlpha / (posteriorAlpha + posteriorBeta);

    posteriorMeans[dimension.key] = posteriorMean;
    dimensionMetrics[dimension.key] = {
      dimension: dimension.key,
      hasSignal,
      score,
      priorAlpha,
      priorBeta,
      posteriorAlpha,
      posteriorBeta,
      posteriorMean,
      sampleCount: Math.max(posteriorAlpha + posteriorBeta - 2, 0),
      confidence: calculateConfidence(posteriorAlpha, posteriorBeta),
      liveWeight: liveWeights[dimension.weightField],
      recommendedWeight: 0,
      delta: 0,
    };
  }

  const normalizedWeights = normalizePosteriorWeights(posteriorMeans);
  const overallConfidence =
    average(Object.values(dimensionMetrics).map((metric) => metric.confidence)) ?? 0;
  const sampleSize = Math.max(...Object.values(dimensionMetrics).map((metric) => metric.sampleCount), 0);

  for (const dimension of DIMENSIONS) {
    const recommendedWeight = normalizedWeights[dimension.key];
    const liveWeight = liveWeights[dimension.weightField];
    dimensionMetrics[dimension.key].recommendedWeight = recommendedWeight;
    dimensionMetrics[dimension.key].delta = Number((recommendedWeight - liveWeight).toFixed(4));
  }

  return {
    configId: config.id,
    outcomeScore: Number(outcomeScore.toFixed(2)),
    signalCoverage: Number(signalCoverage.toFixed(2)),
    sampleSize,
    overallConfidence: Number(overallConfidence.toFixed(2)),
    liveWeights,
    recommendedWeights: {
      personalityWeight: normalizedWeights.personality,
      interestsWeight: normalizedWeights.interests,
      intentWeight: normalizedWeights.intent,
      backgroundWeight: normalizedWeights.background,
      cultureWeight: normalizedWeights.culture,
      conversationSignatureWeight: normalizedWeights.conversationSignature,
    },
    dimensionMetrics,
    outcomeSignals,
  };
}

export class MatchingWeightsService {
  
  async getActiveWeights(): Promise<MatchingWeights> {
    const now = Date.now();
    if (cachedWeights && (now - cacheTimestamp) < CACHE_TTL_MS) {
      return cachedWeights;
    }

    try {
      const config = await db.select()
        .from(matchingWeightsConfig)
        .where(eq(matchingWeightsConfig.isActive, true))
        .limit(1);

      if (config.length > 0) {
        const c = config[0];
        cachedWeights = {
          personalityWeight: parseFloat(c.personalityWeight || '23'),
          interestsWeight: parseFloat(c.interestsWeight || '24'),
          intentWeight: parseFloat(c.intentWeight || '13'),
          backgroundWeight: parseFloat(c.backgroundWeight || '15'),
          cultureWeight: parseFloat(c.cultureWeight || '10'),
          conversationSignatureWeight: parseFloat(c.conversationSignatureWeight || '15'),
        };
      } else {
        cachedWeights = { ...DEFAULT_WEIGHTS };
        await this.initializeDefaultConfig();
      }

      cacheTimestamp = now;
      return cachedWeights;
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to fetch weights:', error);
      return { ...DEFAULT_WEIGHTS };
    }
  }

  private async initializeDefaultConfig(): Promise<void> {
    try {
      const existing = await db.select()
        .from(matchingWeightsConfig)
        .where(eq(matchingWeightsConfig.configName, 'default'))
        .limit(1);

      if (existing.length === 0) {
        await db.insert(matchingWeightsConfig).values({
          configName: 'default',
          isActive: true,
          personalityWeight: '0.23',
          interestsWeight: '0.24',
          intentWeight: '0.13',
          backgroundWeight: '0.15',
          cultureWeight: '0.10',
          conversationSignatureWeight: '0.15',
        });
        console.log('[MatchingWeightsService] Initialized default config');
      }
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to initialize default config:', error);
    }
  }

  async updateWeightsAfterFeedback(
    satisfaction: number,
    dimensionScores: Record<string, number>
  ): Promise<void> {
    try {
      const config = await db.select()
        .from(matchingWeightsConfig)
        .where(eq(matchingWeightsConfig.isActive, true))
        .limit(1);

      if (config.length === 0) return;

      const c = config[0];
      const isSuccess = satisfaction >= 4;

      const updates: Partial<MatchingWeightsConfig> = {
        totalMatches: (c.totalMatches || 0) + 1,
        successfulMatches: (c.successfulMatches || 0) + (isSuccess ? 1 : 0),
        updatedAt: new Date(),
      };

      const dimensions = ['personality', 'interests', 'intent', 'background', 'culture', 'conversationSignature'] as const;
      
      for (const dim of dimensions) {
        const alphaKey = `${dim}Alpha` as keyof typeof c;
        const betaKey = `${dim}Beta` as keyof typeof c;
        const score = dimensionScores[dim] || 50;
        const highScore = score >= 60;
        
        if (isSuccess && highScore) {
          (updates as any)[alphaKey] = ((c[alphaKey] as number) || 1) + 1;
        } else if (!isSuccess && !highScore) {
          (updates as any)[betaKey] = ((c[betaKey] as number) || 1) + 1;
        }
      }

      await db.update(matchingWeightsConfig)
        .set(updates)
        .where(eq(matchingWeightsConfig.id, c.id));

      const shouldRecalculate = ((c.totalMatches || 0) + 1) % 50 === 0;
      if (shouldRecalculate) {
        await this.recalculateWeightsFromBandit(c.id);
      }

      cachedWeights = null;
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to update weights:', error);
    }
  }

  async recordShadowRecommendation(outcomeSignals: ShadowOutcomeSignals): Promise<ShadowWeightRecommendation | null> {
    try {
      const config = await this.getActiveConfig();
      if (!config) {
        return null;
      }

      const recommendation = buildShadowRecommendation(config, outcomeSignals);
      if (!recommendation) {
        return null;
      }

      const historyRow: InsertMatchingWeightsHistory = {
        configId: config.id,
        personalityWeight: recommendation.recommendedWeights.personalityWeight.toFixed(4),
        interestsWeight: recommendation.recommendedWeights.interestsWeight.toFixed(4),
        intentWeight: recommendation.recommendedWeights.intentWeight.toFixed(4),
        backgroundWeight: recommendation.recommendedWeights.backgroundWeight.toFixed(4),
        cultureWeight: recommendation.recommendedWeights.cultureWeight.toFixed(4),
        conversationSignatureWeight: recommendation.recommendedWeights.conversationSignatureWeight.toFixed(4),
        changeReason: SHADOW_RECOMMENDATION_REASON,
        matchesSinceLastUpdate: recommendation.sampleSize,
        satisfactionSinceLastUpdate: recommendation.outcomeScore.toFixed(4),
        shadowMetadata: recommendation as unknown as Record<string, unknown>,
      };

      await db.insert(matchingWeightsHistory).values(historyRow);

      console.log('[MatchingWeightsService] Shadow recommendation generated:', {
        eventId: outcomeSignals.eventId,
        feedbackId: outcomeSignals.feedbackId,
        overallConfidence: recommendation.overallConfidence,
        sampleSize: recommendation.sampleSize,
        recommendedWeights: recommendation.recommendedWeights,
      });

      return recommendation;
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to record shadow recommendation:', error);
      return null;
    }
  }

  private async recalculateWeightsFromBandit(configId: string): Promise<void> {
    try {
      const config = await db.select()
        .from(matchingWeightsConfig)
        .where(eq(matchingWeightsConfig.id, configId))
        .limit(1);

      if (config.length === 0) return;

      const c = config[0];

      const samples = {
        personality: this.sampleBeta(c.personalityAlpha || 1, c.personalityBeta || 1),
        interests: this.sampleBeta(c.interestsAlpha || 1, c.interestsBeta || 1),
        intent: this.sampleBeta(c.intentAlpha || 1, c.intentBeta || 1),
        background: this.sampleBeta(c.backgroundAlpha || 1, c.backgroundBeta || 1),
        culture: this.sampleBeta(c.cultureAlpha || 1, c.cultureBeta || 1),
        conversationSignature: this.sampleBeta(c.conversationSignatureAlpha || 1, c.conversationSignatureBeta || 1),
      };

      const total = Object.values(samples).reduce((a, b) => a + b, 0);
      const normalized = {
        personalityWeight: (samples.personality / total).toFixed(4),
        interestsWeight: (samples.interests / total).toFixed(4),
        intentWeight: (samples.intent / total).toFixed(4),
        backgroundWeight: (samples.background / total).toFixed(4),
        cultureWeight: (samples.culture / total).toFixed(4),
        conversationSignatureWeight: (samples.conversationSignature / total).toFixed(4),
      };

      await db.update(matchingWeightsConfig)
        .set({
          ...normalized,
          updatedAt: new Date(),
        })
        .where(eq(matchingWeightsConfig.id, configId));

      await db.insert(matchingWeightsHistory).values({
        configId,
        ...normalized,
        changeReason: 'bandit_exploration',
        matchesSinceLastUpdate: 50,
      });

      console.log('[MatchingWeightsService] Weights recalculated via Thompson Sampling:', normalized);
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to recalculate weights:', error);
    }
  }

  private sampleBeta(alpha: number, beta: number): number {
    const gammaAlpha = this.sampleGamma(alpha);
    const gammaBeta = this.sampleGamma(beta);
    return gammaAlpha / (gammaAlpha + gammaBeta);
  }

  private sampleGamma(shape: number): number {
    if (shape < 1) {
      return this.sampleGamma(1 + shape) * Math.pow(Math.random(), 1 / shape);
    }
    const d = shape - 1 / 3;
    const c = 1 / Math.sqrt(9 * d);
    while (true) {
      let x, v;
      do {
        x = this.sampleNormal();
        v = 1 + c * x;
      } while (v <= 0);
      v = v * v * v;
      const u = Math.random();
      if (u < 1 - 0.0331 * (x * x) * (x * x)) return d * v;
      if (Math.log(u) < 0.5 * x * x + d * (1 - v + Math.log(v))) return d * v;
    }
  }

  private sampleNormal(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  async getWeightsHistory(limit: number = 30): Promise<MatchingWeightsHistory[]> {
    try {
      return await db.select()
        .from(matchingWeightsHistory)
        .orderBy(desc(matchingWeightsHistory.recordedAt))
        .limit(limit);
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to get weights history:', error);
      return [];
    }
  }

  async getShadowRecommendations(limit: number = 20): Promise<MatchingWeightsHistory[]> {
    try {
      return await db.select()
        .from(matchingWeightsHistory)
        .where(eq(matchingWeightsHistory.changeReason, SHADOW_RECOMMENDATION_REASON))
        .orderBy(desc(matchingWeightsHistory.recordedAt))
        .limit(limit);
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to get shadow recommendations:', error);
      return [];
    }
  }

  async getActiveConfig(): Promise<MatchingWeightsConfig | null> {
    try {
      const config = await db.select()
        .from(matchingWeightsConfig)
        .where(eq(matchingWeightsConfig.isActive, true))
        .limit(1);
      return config[0] || null;
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to get active config:', error);
      return null;
    }
  }

  invalidateCache(): void {
    cachedWeights = null;
    cacheTimestamp = 0;
  }
}

export const matchingWeightsService = new MatchingWeightsService();
