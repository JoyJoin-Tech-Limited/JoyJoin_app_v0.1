/**
 * 黄金话术服务 - AI进化系统组件
 * 管理成功对话模式，支持相似场景检索
 */

import { db } from './db';
import { 
  goldenDialogues, 
  dialogueEmbeddings,
  dialogueFeedback,
  type GoldenDialogue,
  type InsertGoldenDialogue,
  type InsertDialogueFeedback
} from '@shared/schema';
import { eq, desc, gte, and, sql } from 'drizzle-orm';

interface DialogueSearchResult {
  id: string;
  category: string;
  dialogueContent: string;
  refinedVersion: string | null;
  successRate: number;
  usageCount: number;
}

export class GoldenDialogueService {
  
  async addGoldenDialogue(data: InsertGoldenDialogue): Promise<GoldenDialogue | null> {
    try {
      const result = await db.insert(goldenDialogues)
        .values(data)
        .returning();
      console.log('[GoldenDialogueService] Added golden dialogue:', result[0]?.id);
      return result[0] || null;
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to add dialogue:', error);
      return null;
    }
  }

  async findByCategory(category: string, limit: number = 5): Promise<DialogueSearchResult[]> {
    try {
      const results = await db.select({
        id: goldenDialogues.id,
        category: goldenDialogues.category,
        dialogueContent: goldenDialogues.dialogueContent,
        refinedVersion: goldenDialogues.refinedVersion,
        successRate: goldenDialogues.successRate,
        usageCount: goldenDialogues.usageCount,
      })
        .from(goldenDialogues)
        .where(and(
          eq(goldenDialogues.category, category),
          eq(goldenDialogues.isActive, true)
        ))
        .orderBy(desc(goldenDialogues.successRate))
        .limit(limit);

      return results.map(r => ({
        ...r,
        successRate: parseFloat(r.successRate || '0'),
        usageCount: r.usageCount || 0,
      }));
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to find by category:', error);
      return [];
    }
  }

  async findTopPerforming(minSuccessRate: number = 0.7, limit: number = 20): Promise<DialogueSearchResult[]> {
    try {
      const results = await db.select({
        id: goldenDialogues.id,
        category: goldenDialogues.category,
        dialogueContent: goldenDialogues.dialogueContent,
        refinedVersion: goldenDialogues.refinedVersion,
        successRate: goldenDialogues.successRate,
        usageCount: goldenDialogues.usageCount,
      })
        .from(goldenDialogues)
        .where(and(
          eq(goldenDialogues.isActive, true),
          gte(goldenDialogues.successRate, minSuccessRate.toString())
        ))
        .orderBy(desc(goldenDialogues.successRate))
        .limit(limit);

      return results.map(r => ({
        ...r,
        successRate: parseFloat(r.successRate || '0'),
        usageCount: r.usageCount || 0,
      }));
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to find top performing:', error);
      return [];
    }
  }

  async recordUsage(dialogueId: string, wasSuccessful: boolean): Promise<void> {
    try {
      const existing = await db.select()
        .from(goldenDialogues)
        .where(eq(goldenDialogues.id, dialogueId))
        .limit(1);

      if (existing.length === 0) return;

      const current = existing[0];
      const newUsageCount = (current.usageCount || 0) + 1;
      const newPositiveReactions = (current.positiveReactions || 0) + (wasSuccessful ? 1 : 0);
      const newSuccessRate = (newPositiveReactions / newUsageCount).toFixed(4);

      await db.update(goldenDialogues)
        .set({
          usageCount: newUsageCount,
          positiveReactions: newPositiveReactions,
          successRate: newSuccessRate,
          updatedAt: new Date(),
        })
        .where(eq(goldenDialogues.id, dialogueId));
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to record usage:', error);
    }
  }

  async tagAsGolden(
    dialogueContent: string,
    category: string,
    adminId: string,
    sourceSessionId?: string,
    sourceUserId?: string
  ): Promise<GoldenDialogue | null> {
    return this.addGoldenDialogue({
      category,
      dialogueContent,
      isManuallyTagged: true,
      taggedByAdminId: adminId,
      sourceSessionId,
      sourceUserId,
      successRate: '0.8',
    });
  }

  async updateRefinedVersion(dialogueId: string, refinedVersion: string): Promise<boolean> {
    try {
      await db.update(goldenDialogues)
        .set({
          refinedVersion,
          updatedAt: new Date(),
        })
        .where(eq(goldenDialogues.id, dialogueId));
      return true;
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to update refined version:', error);
      return false;
    }
  }

  async deactivateDialogue(dialogueId: string): Promise<boolean> {
    try {
      await db.update(goldenDialogues)
        .set({
          isActive: false,
          updatedAt: new Date(),
        })
        .where(eq(goldenDialogues.id, dialogueId));
      return true;
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to deactivate:', error);
      return false;
    }
  }

  async getStatistics(): Promise<{
    totalDialogues: number;
    activeDialogues: number;
    manuallyTagged: number;
    avgSuccessRate: number;
    byCategory: Record<string, number>;
  }> {
    try {
      const all = await db.select()
        .from(goldenDialogues);

      const active = all.filter(d => d.isActive);
      const manual = all.filter(d => d.isManuallyTagged);
      const avgRate = active.length > 0
        ? active.reduce((sum, d) => sum + parseFloat(d.successRate || '0'), 0) / active.length
        : 0;

      const byCategory: Record<string, number> = {};
      for (const d of active) {
        byCategory[d.category] = (byCategory[d.category] || 0) + 1;
      }

      return {
        totalDialogues: all.length,
        activeDialogues: active.length,
        manuallyTagged: manual.length,
        avgSuccessRate: avgRate,
        byCategory,
      };
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to get statistics:', error);
      return {
        totalDialogues: 0,
        activeDialogues: 0,
        manuallyTagged: 0,
        avgSuccessRate: 0,
        byCategory: {},
      };
    }
  }

  async recordDialogueFeedback(data: InsertDialogueFeedback): Promise<void> {
    try {
      await db.insert(dialogueFeedback).values(data);
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to record feedback:', error);
    }
  }

  async getAllDialogues(limit: number = 100): Promise<GoldenDialogue[]> {
    try {
      return await db.select()
        .from(goldenDialogues)
        .orderBy(desc(goldenDialogues.createdAt))
        .limit(limit);
    } catch (error) {
      console.error('[GoldenDialogueService] Failed to get all dialogues:', error);
      return [];
    }
  }
}

export const goldenDialogueService = new GoldenDialogueService();
