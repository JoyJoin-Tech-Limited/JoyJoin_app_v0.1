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
} from '@shared/schema';
import { desc, eq } from 'drizzle-orm';

export interface MatchingWeights {
  personalityWeight: number;
  interestsWeight: number;
  intentWeight: number;
  backgroundWeight: number;
  cultureWeight: number;
  conversationSignatureWeight: number;
}

export interface MatchingWeightsRolloutStatus {
  adaptiveWeightsEnabled: boolean;
  activeConfigId: string | null;
  liveConfigName: string;
  fallbackConfigName: string;
  maxWeightMovementPercent: number;
  activeWeights: MatchingWeights;
}

const DEFAULT_WEIGHTS: MatchingWeights = {
  personalityWeight: 23,
  interestsWeight: 24,
  intentWeight: 13,
  backgroundWeight: 15,
  cultureWeight: 10,
  conversationSignatureWeight: 15,
};

const DEFAULT_CONFIG_NAME = 'default';
const ADAPTIVE_CONFIG_NAME = 'adaptive_live';
const ADAPTIVE_BOUNDED_REASON = 'adaptive_bandit_bounded';
const ADAPTIVE_ENABLED_REASON = 'adaptive_enabled';
const ADAPTIVE_DISABLED_REASON = 'adaptive_disabled';
const ADAPTIVE_ROLLBACK_REASON = 'adaptive_rollback';
const MATCHES_PER_RECALCULATION = 50;
const MAX_WEIGHT_MOVEMENT_PERCENT = 3;
const CACHE_TTL_MS = 60000;
const STORED_WEIGHT_RATIO_THRESHOLD = 1;

type WeightKey = keyof MatchingWeights;
type FeedbackDimensionKey =
  | 'personality'
  | 'interests'
  | 'intent'
  | 'background'
  | 'culture'
  | 'conversationSignature';

const WEIGHT_KEYS: WeightKey[] = [
  'personalityWeight',
  'interestsWeight',
  'intentWeight',
  'backgroundWeight',
  'cultureWeight',
  'conversationSignatureWeight',
];

const WEIGHT_COLUMN_DEFAULTS: Record<WeightKey, string> = {
  personalityWeight: '0.23',
  interestsWeight: '0.24',
  intentWeight: '0.13',
  backgroundWeight: '0.15',
  cultureWeight: '0.10',
  conversationSignatureWeight: '0.15',
};

let cachedWeights: MatchingWeights | null = null;
let cacheTimestamp = 0;

function parseWeightValue(value: unknown, fallbackPercent: number): number {
  const parsed =
    typeof value === 'number' ? value : typeof value === 'string' ? parseFloat(value) : Number.NaN;

  if (!Number.isFinite(parsed)) {
    return fallbackPercent;
  }

  // Existing rows are mixed: legacy/default inserts store ratios like `0.23`,
  // while some callers may already persist expanded percentages like `23`.
  // Values up to and including `1` therefore represent ratios and are scaled
  // back into runtime percentages; larger values are treated as percentages.
  return Math.abs(parsed) <= STORED_WEIGHT_RATIO_THRESHOLD ? parsed * 100 : parsed;
}

function normalizeRuntimeWeights(weights: MatchingWeights): MatchingWeights {
  const total = WEIGHT_KEYS.reduce((sum, key) => sum + weights[key], 0);
  if (!Number.isFinite(total) || total <= 0) {
    return { ...DEFAULT_WEIGHTS };
  }

  const normalized = {} as MatchingWeights;
  let runningTotal = 0;

  WEIGHT_KEYS.slice(0, -1).forEach((key) => {
    const value = Number(((weights[key] / total) * 100).toFixed(4));
    normalized[key] = value;
    runningTotal += value;
  });

  const lastKey = WEIGHT_KEYS[WEIGHT_KEYS.length - 1];
  normalized[lastKey] = Number((100 - runningTotal).toFixed(4));

  return normalized;
}

function runtimeWeightsFromRecord(record: Partial<Record<WeightKey, unknown>> | null | undefined): MatchingWeights {
  return normalizeRuntimeWeights({
    personalityWeight: parseWeightValue(record?.personalityWeight, DEFAULT_WEIGHTS.personalityWeight),
    interestsWeight: parseWeightValue(record?.interestsWeight, DEFAULT_WEIGHTS.interestsWeight),
    intentWeight: parseWeightValue(record?.intentWeight, DEFAULT_WEIGHTS.intentWeight),
    backgroundWeight: parseWeightValue(record?.backgroundWeight, DEFAULT_WEIGHTS.backgroundWeight),
    cultureWeight: parseWeightValue(record?.cultureWeight, DEFAULT_WEIGHTS.cultureWeight),
    conversationSignatureWeight: parseWeightValue(
      record?.conversationSignatureWeight,
      DEFAULT_WEIGHTS.conversationSignatureWeight,
    ),
  });
}

function runtimeWeightsToStored(weights: MatchingWeights): Record<WeightKey, string> {
  const normalized = normalizeRuntimeWeights(weights);

  return Object.fromEntries(
    WEIGHT_KEYS.map((key) => [key, (normalized[key] / 100).toFixed(4)]),
  ) as Record<WeightKey, string>;
}

function blendWeightsTowardCandidate(
  current: MatchingWeights,
  candidate: MatchingWeights,
  maxMovementPercent: number,
): MatchingWeights {
  const maxObservedDelta = Math.max(
    ...WEIGHT_KEYS.map((key) => Math.abs(candidate[key] - current[key])),
  );

  if (maxObservedDelta === 0) {
    return normalizeRuntimeWeights(candidate);
  }

  const scale = Math.min(1, maxMovementPercent / maxObservedDelta);

  const blended = {} as MatchingWeights;
  for (const key of WEIGHT_KEYS) {
    blended[key] = current[key] + (candidate[key] - current[key]) * scale;
  }

  return normalizeRuntimeWeights(blended);
}

export class MatchingWeightsService {
  async getActiveWeights(): Promise<MatchingWeights> {
    const now = Date.now();
    if (cachedWeights && now - cacheTimestamp < CACHE_TTL_MS) {
      return cachedWeights;
    }

    try {
      const config = await this.getActiveConfig();

      if (config) {
        cachedWeights = runtimeWeightsFromRecord(config);
      } else {
        const defaultConfig = await this.ensureDefaultConfig();
        cachedWeights = runtimeWeightsFromRecord(defaultConfig);
      }

      cacheTimestamp = now;
      return cachedWeights;
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to fetch weights:', error);
      return { ...DEFAULT_WEIGHTS };
    }
  }

  async updateWeightsAfterFeedback(
    satisfaction: number,
    dimensionScores: Record<string, number>,
  ): Promise<void> {
    try {
      const config = await this.getActiveConfig();
      if (!config) {
        return;
      }

      const totalMatchesBefore = config.totalMatches || 0;
      const currentAverageSatisfaction = parseFloat(config.averageSatisfaction || '0');
      const totalMatchesAfter = totalMatchesBefore + 1;
      const updatedAverageSatisfaction =
        (currentAverageSatisfaction * totalMatchesBefore + satisfaction) / totalMatchesAfter;

      const isSuccess = satisfaction >= 4;
      const updates: Partial<MatchingWeightsConfig> = {
        totalMatches: totalMatchesAfter,
        successfulMatches: (config.successfulMatches || 0) + (isSuccess ? 1 : 0),
        averageSatisfaction: updatedAverageSatisfaction.toFixed(4),
        updatedAt: new Date(),
      };

      const dimensions: FeedbackDimensionKey[] = [
        'personality',
        'interests',
        'intent',
        'background',
        'culture',
        'conversationSignature',
      ];

      for (const dimension of dimensions) {
        const score = dimensionScores[dimension] || 50;
        const highScore = score >= 60;

        if (isSuccess && highScore) {
          this.incrementBanditCounter(updates, config, dimension, true);
        } else if (!isSuccess && !highScore) {
          this.incrementBanditCounter(updates, config, dimension, false);
        }
      }

      await db.update(matchingWeightsConfig).set(updates).where(eq(matchingWeightsConfig.id, config.id));

      const shouldRecalculate = totalMatchesAfter % MATCHES_PER_RECALCULATION === 0;
      if (shouldRecalculate && this.isAdaptiveConfig(config)) {
        await this.recalculateWeightsFromBandit(config.id);
      }

      this.invalidateCache();
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to update weights:', error);
    }
  }

  async getWeightsHistory(limit = 30): Promise<MatchingWeightsHistory[]> {
    try {
      return await db
        .select()
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
      const config = await db
        .select()
        .from(matchingWeightsConfig)
        .where(eq(matchingWeightsConfig.isActive, true))
        .limit(1);

      return config[0] || null;
    } catch (error) {
      console.error('[MatchingWeightsService] Failed to get active config:', error);
      return null;
    }
  }

  async getRolloutStatus(): Promise<MatchingWeightsRolloutStatus> {
    const activeConfig = await this.getActiveConfig();
    const activeWeights = activeConfig ? runtimeWeightsFromRecord(activeConfig) : { ...DEFAULT_WEIGHTS };

    return {
      adaptiveWeightsEnabled: this.isAdaptiveConfig(activeConfig),
      activeConfigId: activeConfig?.id ?? null,
      liveConfigName: activeConfig?.configName ?? DEFAULT_CONFIG_NAME,
      fallbackConfigName: DEFAULT_CONFIG_NAME,
      maxWeightMovementPercent: MAX_WEIGHT_MOVEMENT_PERCENT,
      activeWeights,
    };
  }

  async setAdaptiveWeightsEnabled(enabled: boolean): Promise<MatchingWeightsRolloutStatus> {
    const defaultConfig = await this.ensureDefaultConfig();

    if (!enabled) {
      await this.deactivateAllConfigs();
      await db
        .update(matchingWeightsConfig)
        .set({ isActive: true, updatedAt: new Date() })
        .where(eq(matchingWeightsConfig.id, defaultConfig.id));

      await this.recordHistorySnapshot(defaultConfig.id, runtimeWeightsFromRecord(defaultConfig), ADAPTIVE_DISABLED_REASON);
      this.invalidateCache();
      return this.getRolloutStatus();
    }

    const adaptiveConfig = await this.ensureAdaptiveConfig();

    await this.deactivateAllConfigs();
    await db
      .update(matchingWeightsConfig)
      .set({ isActive: true, updatedAt: new Date() })
      .where(eq(matchingWeightsConfig.id, adaptiveConfig.id));

    await this.recordHistorySnapshot(adaptiveConfig.id, runtimeWeightsFromRecord(adaptiveConfig), ADAPTIVE_ENABLED_REASON);
    this.invalidateCache();
    return this.getRolloutStatus();
  }

  async rollbackAdaptiveWeights(): Promise<MatchingWeightsRolloutStatus> {
    const rolloutStatus = await this.getRolloutStatus();
    if (!rolloutStatus.adaptiveWeightsEnabled || !rolloutStatus.activeConfigId) {
      throw new Error('Adaptive weights are not currently active');
    }

    const history = await this.getAdaptiveHistory(10);
    const previousSnapshot = history.find((entry) => {
      const snapshot = runtimeWeightsFromRecord(entry);
      return WEIGHT_KEYS.some(
        (key) => Math.abs(snapshot[key] - rolloutStatus.activeWeights[key]) > 0.0001,
      );
    });

    const rollbackWeights = previousSnapshot
      ? runtimeWeightsFromRecord(previousSnapshot)
      : { ...DEFAULT_WEIGHTS };

    await db
      .update(matchingWeightsConfig)
      .set({
        ...runtimeWeightsToStored(rollbackWeights),
        updatedAt: new Date(),
      })
      .where(eq(matchingWeightsConfig.id, rolloutStatus.activeConfigId));

    await this.recordHistorySnapshot(
      rolloutStatus.activeConfigId,
      rollbackWeights,
      ADAPTIVE_ROLLBACK_REASON,
    );

    this.invalidateCache();
    return this.getRolloutStatus();
  }

  invalidateCache(): void {
    cachedWeights = null;
    cacheTimestamp = 0;
  }

  private async recalculateWeightsFromBandit(configId: string): Promise<void> {
    try {
      const config = await this.getConfigById(configId);
      if (!config) {
        return;
      }

      const samples = {
        personalityWeight: this.sampleBeta(config.personalityAlpha || 1, config.personalityBeta || 1) * 100,
        interestsWeight: this.sampleBeta(config.interestsAlpha || 1, config.interestsBeta || 1) * 100,
        intentWeight: this.sampleBeta(config.intentAlpha || 1, config.intentBeta || 1) * 100,
        backgroundWeight: this.sampleBeta(config.backgroundAlpha || 1, config.backgroundBeta || 1) * 100,
        cultureWeight: this.sampleBeta(config.cultureAlpha || 1, config.cultureBeta || 1) * 100,
        conversationSignatureWeight:
          this.sampleBeta(config.conversationSignatureAlpha || 1, config.conversationSignatureBeta || 1) * 100,
      } satisfies MatchingWeights;

      const candidateWeights = normalizeRuntimeWeights(samples);
      const currentWeights = runtimeWeightsFromRecord(config);
      const boundedWeights = blendWeightsTowardCandidate(
        currentWeights,
        candidateWeights,
        MAX_WEIGHT_MOVEMENT_PERCENT,
      );

      await db
        .update(matchingWeightsConfig)
        .set({
          ...runtimeWeightsToStored(boundedWeights),
          updatedAt: new Date(),
        })
        .where(eq(matchingWeightsConfig.id, configId));

      await this.recordHistorySnapshot(configId, boundedWeights, ADAPTIVE_BOUNDED_REASON, MATCHES_PER_RECALCULATION);

      this.invalidateCache();
      console.log('[MatchingWeightsService] Weights recalculated via bounded Thompson Sampling:', boundedWeights);
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
      let x;
      let v;
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

  private incrementBanditCounter(
    updates: Partial<MatchingWeightsConfig>,
    config: MatchingWeightsConfig,
    dimension: FeedbackDimensionKey,
    incrementAlpha: boolean,
  ): void {
    switch (dimension) {
      case 'personality':
        if (incrementAlpha) {
          updates.personalityAlpha = (config.personalityAlpha || 1) + 1;
        } else {
          updates.personalityBeta = (config.personalityBeta || 1) + 1;
        }
        return;
      case 'interests':
        if (incrementAlpha) {
          updates.interestsAlpha = (config.interestsAlpha || 1) + 1;
        } else {
          updates.interestsBeta = (config.interestsBeta || 1) + 1;
        }
        return;
      case 'intent':
        if (incrementAlpha) {
          updates.intentAlpha = (config.intentAlpha || 1) + 1;
        } else {
          updates.intentBeta = (config.intentBeta || 1) + 1;
        }
        return;
      case 'background':
        if (incrementAlpha) {
          updates.backgroundAlpha = (config.backgroundAlpha || 1) + 1;
        } else {
          updates.backgroundBeta = (config.backgroundBeta || 1) + 1;
        }
        return;
      case 'culture':
        if (incrementAlpha) {
          updates.cultureAlpha = (config.cultureAlpha || 1) + 1;
        } else {
          updates.cultureBeta = (config.cultureBeta || 1) + 1;
        }
        return;
      case 'conversationSignature':
        if (incrementAlpha) {
          updates.conversationSignatureAlpha = (config.conversationSignatureAlpha || 1) + 1;
        } else {
          updates.conversationSignatureBeta = (config.conversationSignatureBeta || 1) + 1;
        }
        return;
    }
  }

  private async ensureDefaultConfig(): Promise<MatchingWeightsConfig> {
    const existing = await this.getConfigByName(DEFAULT_CONFIG_NAME);
    if (existing) {
      return existing;
    }

    await db.insert(matchingWeightsConfig).values({
      configName: DEFAULT_CONFIG_NAME,
      isActive: true,
      ...WEIGHT_COLUMN_DEFAULTS,
    });

    const created = await this.getConfigByName(DEFAULT_CONFIG_NAME);
    if (!created) {
      throw new Error('Failed to initialize default matching weights config');
    }

    console.log('[MatchingWeightsService] Initialized default config');
    return created;
  }

  private async ensureAdaptiveConfig(): Promise<MatchingWeightsConfig> {
    const existing = await this.getConfigByName(ADAPTIVE_CONFIG_NAME);
    if (existing) {
      return existing;
    }

    await db.insert(matchingWeightsConfig).values({
      configName: ADAPTIVE_CONFIG_NAME,
      isActive: false,
      ...WEIGHT_COLUMN_DEFAULTS,
    });

    const created = await this.getConfigByName(ADAPTIVE_CONFIG_NAME);
    if (!created) {
      throw new Error('Failed to initialize adaptive matching weights config');
    }

    return created;
  }

  private async getAdaptiveHistory(limit: number): Promise<MatchingWeightsHistory[]> {
    const adaptiveConfig = await this.getConfigByName(ADAPTIVE_CONFIG_NAME);
    if (!adaptiveConfig) {
      return [];
    }

    return db
      .select()
      .from(matchingWeightsHistory)
      .where(eq(matchingWeightsHistory.configId, adaptiveConfig.id))
      .orderBy(desc(matchingWeightsHistory.recordedAt))
      .limit(limit);
  }

  private async recordHistorySnapshot(
    configId: string,
    weights: MatchingWeights,
    changeReason: string,
    matchesSinceLastUpdate = 0,
  ): Promise<void> {
    await db.insert(matchingWeightsHistory).values({
      configId,
      ...runtimeWeightsToStored(weights),
      changeReason,
      matchesSinceLastUpdate,
    });
  }

  private async deactivateAllConfigs(): Promise<void> {
    await db
      .update(matchingWeightsConfig)
      .set({ isActive: false, updatedAt: new Date() })
      .where(eq(matchingWeightsConfig.isActive, true));
  }

  private isAdaptiveConfig(config: Pick<MatchingWeightsConfig, 'configName'> | null): boolean {
    return config?.configName === ADAPTIVE_CONFIG_NAME;
  }

  private async getConfigById(id: string): Promise<MatchingWeightsConfig | null> {
    const rows = await db.select().from(matchingWeightsConfig).where(eq(matchingWeightsConfig.id, id)).limit(1);
    return rows[0] || null;
  }

  private async getConfigByName(configName: string): Promise<MatchingWeightsConfig | null> {
    const rows = await db
      .select()
      .from(matchingWeightsConfig)
      .where(eq(matchingWeightsConfig.configName, configName))
      .limit(1);

    return rows[0] || null;
  }
}

export const matchingWeightsService = new MatchingWeightsService();
