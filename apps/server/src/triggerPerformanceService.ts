/**
 * 触发器性能追踪服务 - AI进化系统组件
 * 追踪38个触发器的使用效果，自动调整触发阈值
 */

import { db } from './db';
import { triggerPerformance, type TriggerPerformance } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';

interface TriggerStats {
  triggerId: string;
  triggerName: string;
  currentThreshold: number;
  effectivenessScore: number;
  totalTriggers: number;
  successRate: number;
}

const triggerCache = new Map<string, TriggerPerformance>();
let cacheInitialized = false;

export class TriggerPerformanceService {
  
  async initializeTriggers(triggers: Array<{id: string, name: string, category: string}>): Promise<void> {
    try {
      for (const trigger of triggers) {
        const existing = await db.select()
          .from(triggerPerformance)
          .where(eq(triggerPerformance.triggerId, trigger.id))
          .limit(1);

        if (existing.length === 0) {
          await db.insert(triggerPerformance).values({
            triggerId: trigger.id,
            triggerName: trigger.name,
            triggerCategory: trigger.category,
            currentThreshold: '0.5',
            defaultThreshold: '0.5',
          });
        }
      }
      console.log(`[TriggerPerformanceService] Initialized ${triggers.length} triggers`);
    } catch (error) {
      console.error('[TriggerPerformanceService] Failed to initialize triggers:', error);
    }
  }

  async recordTriggerActivation(triggerId: string, wasSuccessful: boolean): Promise<void> {
    try {
      const existing = await db.select()
        .from(triggerPerformance)
        .where(eq(triggerPerformance.triggerId, triggerId))
        .limit(1);

      if (existing.length === 0) return;

      const current = existing[0];
      const updates: Partial<TriggerPerformance> = {
        totalTriggers: (current.totalTriggers || 0) + 1,
        lastTriggeredAt: new Date(),
        lastUpdatedAt: new Date(),
      };

      if (wasSuccessful) {
        updates.successfulTriggers = (current.successfulTriggers || 0) + 1;
        updates.alpha = (current.alpha || 1) + 1;
      } else {
        updates.abandonedAfterTrigger = (current.abandonedAfterTrigger || 0) + 1;
        updates.beta = (current.beta || 1) + 1;
      }

      const newTotal = (updates.totalTriggers || 1);
      const newSuccessful = updates.successfulTriggers || current.successfulTriggers || 0;
      updates.effectivenessScore = (newSuccessful / newTotal).toFixed(4);

      if (newTotal % 20 === 0) {
        const newThreshold = this.calculateOptimalThreshold(
          updates.alpha || current.alpha || 1,
          updates.beta || current.beta || 1,
          parseFloat(current.defaultThreshold || '0.5')
        );
        updates.currentThreshold = newThreshold.toFixed(4);
      }

      await db.update(triggerPerformance)
        .set(updates)
        .where(eq(triggerPerformance.triggerId, triggerId));

      triggerCache.delete(triggerId);
    } catch (error) {
      console.error('[TriggerPerformanceService] Failed to record activation:', error);
    }
  }

  private calculateOptimalThreshold(alpha: number, beta: number, defaultThreshold: number): number {
    const mean = alpha / (alpha + beta);
    const adjustment = (mean - 0.5) * 0.2;
    const newThreshold = defaultThreshold + adjustment;
    return Math.max(0.1, Math.min(0.9, newThreshold));
  }

  async getTriggerThreshold(triggerId: string): Promise<number> {
    if (triggerCache.has(triggerId)) {
      return parseFloat(triggerCache.get(triggerId)!.currentThreshold || '0.5');
    }

    try {
      const result = await db.select()
        .from(triggerPerformance)
        .where(eq(triggerPerformance.triggerId, triggerId))
        .limit(1);

      if (result.length > 0) {
        triggerCache.set(triggerId, result[0]);
        return parseFloat(result[0].currentThreshold || '0.5');
      }
      return 0.5;
    } catch {
      return 0.5;
    }
  }

  async getAllTriggerStats(): Promise<TriggerStats[]> {
    try {
      const triggers = await db.select()
        .from(triggerPerformance)
        .orderBy(desc(triggerPerformance.effectivenessScore));

      return triggers.map(t: any => ({
        triggerId: t.triggerId,
        triggerName: t.triggerName,
        currentThreshold: parseFloat(t.currentThreshold || '0.5'),
        effectivenessScore: parseFloat(t.effectivenessScore || '0.5'),
        totalTriggers: t.totalTriggers || 0,
        successRate: t.totalTriggers ? ((t.successfulTriggers || 0) / t.totalTriggers) : 0,
      }));
    } catch (error) {
      console.error('[TriggerPerformanceService] Failed to get stats:', error);
      return [];
    }
  }

  async getTopPerformingTriggers(limit: number = 10): Promise<TriggerStats[]> {
    const all = await this.getAllTriggerStats();
    return all.slice(0, limit);
  }

  async getUnderperformingTriggers(threshold: number = 0.3): Promise<TriggerStats[]> {
    const all = await this.getAllTriggerStats();
    return all.filter(t: any => t.successRate < threshold && t.totalTriggers >= 10);
  }

  invalidateCache(): void {
    triggerCache.clear();
    cacheInitialized = false;
  }
}

export const triggerPerformanceService = new TriggerPerformanceService();
