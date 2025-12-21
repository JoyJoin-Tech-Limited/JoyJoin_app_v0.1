/**
 * 匹配权重服务 - AI进化系统核心组件
 * 实现动态权重读取、Thompson Sampling优化、权重历史记录
 */

import { db } from './db';
import { 
  matchingWeightsConfig, 
  matchingWeightsHistory,
  type MatchingWeightsConfig,
  type InsertMatchingWeightsConfig,
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

  async getWeightsHistory(limit: number = 30): Promise<any[]> {
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
