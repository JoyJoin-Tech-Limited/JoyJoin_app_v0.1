/**
 * 对话洞察存储服务 (Dialogue Embeddings Service)
 * 
 * 将检测到的洞察持久化到 dialogue_embeddings 表
 * 支持：
 * 1. 批量写入洞察
 * 2. 按用户/会话查询洞察
 * 3. 洞察统计和分析
 */

import { db } from './db';
import { dialogueEmbeddings, dialogueFeedback, users } from '@shared/schema';
import { eq, desc, and, sql } from 'drizzle-orm';
import type { DetectedInsight, InsightDetectionResult, InsightCategory } from './insightDetectorService';
import type { DeepTraits } from './inference/conversationSignature';
import type { DialectProfile } from './inference/informationTiers';

// ============ 类型定义 ============

export interface StoredInsight {
  id: string;
  sourceSessionId: string | null;
  sourceUserId: string | null;
  dialogueContent: string;
  dialogueSummary: string | null;
  embedding: InsightEmbeddingData | null;
  category: string | null;
  sentiment: string | null;
  qualityScore: string | null;
  isSuccessful: boolean | null;
  createdAt: Date | null;
}

export interface InsightEmbeddingData {
  insights: DetectedInsight[];
  dialectProfile: DialectProfile | null;
  deepTraits: DeepTraits | null;
  totalConfidence: number;
  apiCallsUsed: number;
  version: string;
  phoneNumber?: string; // For cross-session linking
}

export interface InsightStats {
  totalInsights: number;
  byCategory: Record<InsightCategory, number>;
  avgConfidence: number;
  recentInsights: StoredInsight[];
}

// ============ 服务类 ============

export class DialogueEmbeddingsService {
  /**
   * 存储对话洞察结果
   */
  async storeInsights(
    sessionId: string | null,
    userId: string | null,
    dialogueContent: string,
    result: InsightDetectionResult,
    isSuccessful: boolean = true,
    phoneNumber?: string
  ): Promise<string | null> {
    try {
      const embeddingData: InsightEmbeddingData = {
        insights: result.insights,
        dialectProfile: result.dialectProfile,
        deepTraits: result.deepTraits,
        totalConfidence: result.totalConfidence,
        apiCallsUsed: result.apiCallsUsed,
        version: '1.0.0',
        phoneNumber: phoneNumber || undefined,
      };

      // 生成摘要
      const summary = this.generateSummary(result);
      
      // 确定主要类别
      const primaryCategory = this.getPrimaryCategory(result.insights);
      
      // 确定情感倾向
      const sentiment = this.analyzeSentiment(result);

      const [inserted] = await db.insert(dialogueEmbeddings).values({
        sourceSessionId: sessionId,
        sourceUserId: userId,
        dialogueContent,
        dialogueSummary: summary,
        embedding: embeddingData,
        category: primaryCategory,
        sentiment,
        qualityScore: result.totalConfidence.toFixed(4),
        isSuccessful,
      }).returning({ id: dialogueEmbeddings.id });

      console.log(`[DialogueEmbeddings] Stored ${result.insights.length} insights for session ${sessionId}`);
      return inserted?.id || null;
    } catch (error) {
      console.error('[DialogueEmbeddings] Error storing insights:', error);
      return null;
    }
  }

  /**
   * 更新用户的关键洞察到用户表
   */
  async updateUserWithInsights(
    userId: string,
    result: InsightDetectionResult
  ): Promise<boolean> {
    try {
      const updates: Record<string, unknown> = {};

      // 提取安全约束
      const safetyInsights = result.insights.filter(i => i.category === 'safety');
      if (safetyInsights.length > 0) {
        updates.safetyNoteHost = safetyInsights
          .map(i => `[${i.subType}] ${i.value}`)
          .join('; ');
      }

      // 提取生活方式偏好 (宠物)
      const petInsights = result.insights.filter(i => 
        i.subType === 'pet_owner_cat' || i.subType === 'pet_owner_dog'
      );
      if (petInsights.length > 0) {
        updates.hasPets = true;
        updates.petTypes = petInsights.map(i => 
          i.subType === 'pet_owner_cat' ? '猫' : '狗'
        );
      }

      // 提取社交偏好
      const groupPref = result.insights.find(i => i.subType === 'avoid_large_groups');
      if (groupPref) {
        updates.groupSizeComfort = 'small';
      }

      // 只有有更新时才执行
      if (Object.keys(updates).length > 0) {
        await db.update(users).set(updates).where(eq(users.id, userId));
        console.log(`[DialogueEmbeddings] Updated user ${userId} with ${Object.keys(updates).length} fields`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('[DialogueEmbeddings] Error updating user:', error);
      return false;
    }
  }

  /**
   * 将会话洞察链接到用户ID（用于注册完成后）
   * 优先使用isSuccessful=true的完整记录，而不是per-turn的部分记录
   */
  async linkSessionToUser(
    sessionId: string,
    userId: string
  ): Promise<{ linked: number; insights: InsightDetectionResult | null }> {
    try {
      // 更新该会话所有记录的sourceUserId
      await db.update(dialogueEmbeddings)
        .set({ sourceUserId: userId })
        .where(eq(dialogueEmbeddings.sourceSessionId, sessionId));

      // 查询已完成的完整记录（isSuccessful=true）优先
      const successfulRecords = await db.select({
        id: dialogueEmbeddings.id,
        embedding: dialogueEmbeddings.embedding,
        isSuccessful: dialogueEmbeddings.isSuccessful
      })
        .from(dialogueEmbeddings)
        .where(
          and(
            eq(dialogueEmbeddings.sourceSessionId, sessionId),
            eq(dialogueEmbeddings.isSuccessful, true)
          )
        )
        .orderBy(desc(dialogueEmbeddings.id))
        .limit(1);

      // 如果有完整记录，使用它；否则合并所有部分记录的insights
      let allInsights: DetectedInsight[] = [];
      
      if (successfulRecords.length > 0) {
        const embeddingData = successfulRecords[0].embedding as { insights?: DetectedInsight[] } | null;
        if (embeddingData?.insights) {
          allInsights = embeddingData.insights;
        }
      } else {
        // 没有完整记录，合并所有per-turn部分记录
        const partialRecords = await db.select({
          embedding: dialogueEmbeddings.embedding
        })
          .from(dialogueEmbeddings)
          .where(eq(dialogueEmbeddings.sourceSessionId, sessionId));

        for (const record of partialRecords) {
          const embeddingData = record.embedding as { insights?: DetectedInsight[] } | null;
          if (embeddingData?.insights) {
            for (const insight of embeddingData.insights) {
              // 按subType去重
              if (!allInsights.some(i => i.subType === insight.subType)) {
                allInsights.push(insight);
              }
            }
          }
        }
      }

      // 更新用户表
      if (allInsights.length > 0) {
        const isComplete = successfulRecords.length > 0;
        const insightResult: InsightDetectionResult = {
          insights: allInsights,
          dialectProfile: null,
          deepTraits: null,
          totalConfidence: isComplete ? 0.95 : 0.70, // Lower confidence for partials
          apiCallsUsed: 0
        };
        
        // Only update user profile with complete data, skip partials to avoid incomplete safety data
        if (isComplete) {
          await this.updateUserWithInsights(userId, insightResult);
          console.log(`[DialogueEmbeddings] Linked session ${sessionId} to user ${userId} with ${allInsights.length} complete insights`);
        } else {
          console.log(`[DialogueEmbeddings] Session ${sessionId} has ${allInsights.length} partial insights - skipping user profile update`);
        }
        
        return { linked: isComplete ? 1 : 0, insights: insightResult };
      }

      console.log(`[DialogueEmbeddings] Linked session ${sessionId} to user ${userId} (no insights found)`);
      return { linked: 0, insights: null };
    } catch (error) {
      console.error('[DialogueEmbeddings] Error linking session to user:', error);
      return { linked: 0, insights: null };
    }
  }

  /**
   * 通过手机号查找并链接洞察到用户（跨session关联）
   * 这是最可靠的关联方式，因为手机号在chat/complete和user/register之间保持一致
   */
  async linkByPhoneNumber(
    phoneNumber: string,
    userId: string
  ): Promise<{ linked: number; insights: InsightDetectionResult | null }> {
    try {
      // 查询包含该手机号的最新成功记录
      const records = await db.select({
        id: dialogueEmbeddings.id,
        embedding: dialogueEmbeddings.embedding,
        isSuccessful: dialogueEmbeddings.isSuccessful
      })
        .from(dialogueEmbeddings)
        .where(
          sql`${dialogueEmbeddings.embedding}->>'phoneNumber' = ${phoneNumber}`
        )
        .orderBy(desc(dialogueEmbeddings.id));

      if (records.length === 0) {
        console.log(`[DialogueEmbeddings] No insights found for phone ${phoneNumber.slice(-4)}`);
        return { linked: 0, insights: null };
      }

      // 更新所有匹配记录的userId
      await db.update(dialogueEmbeddings)
        .set({ sourceUserId: userId })
        .where(
          sql`${dialogueEmbeddings.embedding}->>'phoneNumber' = ${phoneNumber}`
        );

      // 优先使用成功的完整记录
      const successfulRecord = records.find(r => r.isSuccessful === true);
      const targetRecord = successfulRecord || records[0];
      
      const embeddingData = targetRecord.embedding as InsightEmbeddingData | null;
      
      if (embeddingData?.insights && embeddingData.insights.length > 0) {
        const insightResult: InsightDetectionResult = {
          insights: embeddingData.insights,
          dialectProfile: embeddingData.dialectProfile || null,
          deepTraits: embeddingData.deepTraits || null,
          totalConfidence: embeddingData.totalConfidence || 0.85,
          apiCallsUsed: embeddingData.apiCallsUsed || 0
        };
        
        // 只有完整记录才更新用户表
        if (successfulRecord) {
          await this.updateUserWithInsights(userId, insightResult);
          console.log(`[DialogueEmbeddings] Linked ${records.length} records by phone to user ${userId} with ${insightResult.insights.length} insights`);
        } else {
          console.log(`[DialogueEmbeddings] Phone ${phoneNumber.slice(-4)} has ${records.length} partial records - skipping user update`);
        }
        
        return { linked: successfulRecord ? records.length : 0, insights: insightResult };
      }

      return { linked: 0, insights: null };
    } catch (error) {
      console.error('[DialogueEmbeddings] Error linking by phone:', error);
      return { linked: 0, insights: null };
    }
  }

  /**
   * 记录反馈
   */
  async recordFeedback(
    sessionId: string,
    userId: string | null,
    insightId: string,
    isAccurate: boolean,
    userComment?: string
  ): Promise<boolean> {
    try {
      await db.insert(dialogueFeedback).values({
        sessionId,
        userId,
        feedbackType: isAccurate ? 'implicit' : 'explicit',
        overallRating: isAccurate ? 5 : 1,
        feedbackText: userComment ? `[${insightId}] ${userComment}` : undefined,
      });

      console.log(`[DialogueEmbeddings] Recorded feedback for insight ${insightId}`);
      return true;
    } catch (error) {
      console.error('[DialogueEmbeddings] Error recording feedback:', error);
      return false;
    }
  }

  /**
   * 获取用户的历史洞察
   */
  async getUserInsights(userId: string, limit: number = 10): Promise<StoredInsight[]> {
    try {
      const results = await db.select()
        .from(dialogueEmbeddings)
        .where(eq(dialogueEmbeddings.sourceUserId, userId))
        .orderBy(desc(dialogueEmbeddings.createdAt))
        .limit(limit);

      return results as StoredInsight[];
    } catch (error) {
      console.error('[DialogueEmbeddings] Error fetching user insights:', error);
      return [];
    }
  }

  /**
   * 获取会话的洞察
   */
  async getSessionInsights(sessionId: string): Promise<StoredInsight | null> {
    try {
      const [result] = await db.select()
        .from(dialogueEmbeddings)
        .where(eq(dialogueEmbeddings.sourceSessionId, sessionId))
        .limit(1);

      return result as StoredInsight || null;
    } catch (error) {
      console.error('[DialogueEmbeddings] Error fetching session insights:', error);
      return null;
    }
  }

  /**
   * 获取洞察统计
   */
  async getInsightStats(): Promise<InsightStats> {
    try {
      // 总数
      const [countResult] = await db.select({ 
        count: sql<number>`count(*)` 
      }).from(dialogueEmbeddings);
      const totalInsights = Number(countResult?.count || 0);

      // 按类别统计
      const categoryResults = await db.select({
        category: dialogueEmbeddings.category,
        count: sql<number>`count(*)`
      })
        .from(dialogueEmbeddings)
        .groupBy(dialogueEmbeddings.category);

      const byCategory: Record<InsightCategory, number> = {
        safety: 0,
        emotional: 0,
        lifestyle: 0,
        relationship: 0,
        career: 0,
        preference: 0,
        dialect: 0,
        signature: 0,
      };

      categoryResults.forEach(r => {
        if (r.category && r.category in byCategory) {
          byCategory[r.category as InsightCategory] = Number(r.count);
        }
      });

      // 平均置信度
      const [avgResult] = await db.select({
        avg: sql<number>`avg(quality_score::numeric)`
      }).from(dialogueEmbeddings);
      const avgConfidence = Number(avgResult?.avg || 0);

      // 最近洞察
      const recentInsights = await db.select()
        .from(dialogueEmbeddings)
        .orderBy(desc(dialogueEmbeddings.createdAt))
        .limit(10);

      return {
        totalInsights,
        byCategory,
        avgConfidence,
        recentInsights: recentInsights as StoredInsight[],
      };
    } catch (error) {
      console.error('[DialogueEmbeddings] Error fetching stats:', error);
      return {
        totalInsights: 0,
        byCategory: {
          safety: 0,
          emotional: 0,
          lifestyle: 0,
          relationship: 0,
          career: 0,
          preference: 0,
          dialect: 0,
          signature: 0,
        },
        avgConfidence: 0,
        recentInsights: [],
      };
    }
  }

  // ============ 辅助方法 ============

  private generateSummary(result: InsightDetectionResult): string {
    const parts: string[] = [];

    if (result.insights.length > 0) {
      const categories = Array.from(new Set(result.insights.map(i => i.category)));
      parts.push(`检测到 ${result.insights.length} 个洞察，涵盖 ${categories.join('、')}`);
    }

    if (result.dialectProfile?.primaryDialect) {
      parts.push(`方言: ${result.dialectProfile.primaryDialect}`);
    }

    if (result.deepTraits) {
      parts.push(`深度特征置信度: ${(result.deepTraits.overallConfidence * 100).toFixed(0)}%`);
    }

    return parts.join(' | ') || '无显著洞察';
  }

  private getPrimaryCategory(insights: DetectedInsight[]): string | null {
    if (insights.length === 0) return null;

    // 安全类优先
    const safetyInsight = insights.find(i => i.category === 'safety');
    if (safetyInsight) return 'safety';

    // 否则返回最多的类别
    const categoryCounts = insights.reduce((acc, i) => {
      acc[i.category] = (acc[i.category] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return Object.entries(categoryCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || null;
  }

  private analyzeSentiment(result: InsightDetectionResult): string {
    if (!result.deepTraits?.emotional) return 'neutral';

    const positivity = result.deepTraits.emotional.positivityLevel;
    if (positivity === 'optimistic') return 'positive';
    if (positivity === 'cautious') return 'cautious';
    return 'neutral';
  }
}

export const dialogueEmbeddingsService = new DialogueEmbeddingsService();
