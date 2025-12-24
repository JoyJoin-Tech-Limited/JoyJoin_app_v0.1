/**
 * SmartInsights 运维服务
 * 
 * 负责：
 * 1. 洞察去重 - 避免重复记录相似洞察
 * 2. 置信度过滤 - 只保留高质量洞察 (confidence >= 0.7)
 * 3. 洞察合并 - 合并来自多轮对话的洞察
 * 4. 历史数据回填策略
 */

import type { SmartInsight } from '../deepseekClient';

// ============ 配置常量 ============

export const INSIGHT_CONFIG = {
  MIN_CONFIDENCE: 0.7,           // 最低置信度阈值
  MAX_INSIGHTS_PER_CATEGORY: 5,  // 每个类别最多保留的洞察数
  SIMILARITY_THRESHOLD: 0.8,     // 相似度阈值（用于去重）
  MAX_TOTAL_INSIGHTS: 20,        // 用户最多保留的洞察总数
};

// ============ 去重逻辑 ============

/**
 * 计算两个洞察的相似度（简化版，基于关键词重叠）
 */
function calculateInsightSimilarity(a: SmartInsight, b: SmartInsight): number {
  if (a.category !== b.category) return 0;
  
  const wordsAArray = a.insight.toLowerCase().split(/[\s,，。、]+/).filter(w => w.length > 1);
  const wordsBArray = b.insight.toLowerCase().split(/[\s,，。、]+/).filter(w => w.length > 1);
  const wordsA = new Set(wordsAArray);
  const wordsB = new Set(wordsBArray);
  
  if (wordsA.size === 0 || wordsB.size === 0) return 0;
  
  const intersection = wordsAArray.filter(w => wordsB.has(w)).length;
  const unionArray = Array.from(wordsA).concat(Array.from(wordsB));
  const union = new Set(unionArray).size;
  
  return intersection / union; // Jaccard similarity
}

/**
 * 检查洞察是否与现有洞察重复
 */
export function isDuplicateInsight(newInsight: SmartInsight, existingInsights: SmartInsight[]): boolean {
  for (const existing of existingInsights) {
    const similarity = calculateInsightSimilarity(newInsight, existing);
    if (similarity >= INSIGHT_CONFIG.SIMILARITY_THRESHOLD) {
      return true;
    }
  }
  return false;
}

// ============ 置信度过滤 ============

/**
 * 过滤低置信度洞察
 */
export function filterByConfidence(insights: SmartInsight[]): SmartInsight[] {
  return insights.filter(i => i.confidence >= INSIGHT_CONFIG.MIN_CONFIDENCE);
}

// ============ 洞察合并 ============

/**
 * 合并新洞察到现有洞察列表
 * - 去重
 * - 置信度过滤
 * - 数量限制
 */
export function mergeInsights(
  existing: SmartInsight[],
  newInsights: SmartInsight[]
): SmartInsight[] {
  // 1. 先过滤新洞察的置信度
  const validNewInsights = filterByConfidence(newInsights);
  
  // 2. 去重
  const dedupedNew = validNewInsights.filter(ni => !isDuplicateInsight(ni, existing));
  
  // 3. 合并
  const merged = [...existing, ...dedupedNew];
  
  // 4. 按类别分组并限制数量
  const byCategory = new Map<string, SmartInsight[]>();
  for (const insight of merged) {
    const list = byCategory.get(insight.category) || [];
    list.push(insight);
    byCategory.set(insight.category, list);
  }
  
  // 5. 每个类别保留置信度最高的N个
  const result: SmartInsight[] = [];
  byCategory.forEach((categoryInsights: SmartInsight[], _: string) => {
    const sorted = categoryInsights.sort((a: SmartInsight, b: SmartInsight) => b.confidence - a.confidence);
    result.push(...sorted.slice(0, INSIGHT_CONFIG.MAX_INSIGHTS_PER_CATEGORY));
  });
  
  // 6. 总数限制
  return result
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, INSIGHT_CONFIG.MAX_TOTAL_INSIGHTS);
}

// ============ 洞察清理 ============

/**
 * 清理过期或低质量洞察
 */
export function cleanupInsights(insights: SmartInsight[]): SmartInsight[] {
  // 移除低置信度
  const highConfidence = filterByConfidence(insights);
  
  // 移除内容过短的洞察
  const validContent = highConfidence.filter(i => 
    i.insight.length >= 4 && i.evidence.length >= 2
  );
  
  return validContent;
}

// ============ 洞察提取辅助 ============

/**
 * 从LLM响应中提取并验证smartInsights
 */
export function extractAndValidateInsights(rawInsights: unknown[]): SmartInsight[] {
  if (!Array.isArray(rawInsights)) return [];
  
  const validCategories = ['career', 'personality', 'lifestyle', 'preference', 'background', 'social'];
  const validated: SmartInsight[] = [];
  
  for (const raw of rawInsights) {
    if (typeof raw !== 'object' || raw === null) continue;
    
    const r = raw as Record<string, unknown>;
    
    // 验证必需字段
    if (
      typeof r.category === 'string' &&
      validCategories.includes(r.category) &&
      typeof r.insight === 'string' &&
      r.insight.length > 0 &&
      typeof r.evidence === 'string' &&
      typeof r.confidence === 'number' &&
      r.confidence >= 0 &&
      r.confidence <= 1
    ) {
      validated.push({
        category: r.category as SmartInsight['category'],
        insight: r.insight,
        evidence: r.evidence,
        confidence: r.confidence,
        timestamp: new Date().toISOString(),
      });
    }
  }
  
  return validated;
}

// ============ 洞察总结生成 ============

/**
 * 生成用户洞察总结（用于UI展示）
 * 返回2-3条最有价值的洞察描述
 */
export function generateInsightSummary(insights: SmartInsight[]): string[] {
  if (!insights || insights.length === 0) return [];
  
  // 按置信度排序，取前3个
  const topInsights = [...insights]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 3);
  
  return topInsights.map(i => i.insight);
}

/**
 * 生成神秘感洞察描述（用于确认卡片）
 */
export function generateMysteriousDescription(insights: SmartInsight[]): string {
  const count = insights?.length || 0;
  
  if (count === 0) return '';
  if (count <= 2) return '小悦已捕捉到一些有趣线索';
  if (count <= 5) return '小悦已解读到你的一些独特印记';
  return '小悦已深入理解你的社交密码';
}

// ============ 类别统计 ============

/**
 * 获取洞察类别分布
 */
export function getInsightDistribution(insights: SmartInsight[]): Record<string, number> {
  const distribution: Record<string, number> = {};
  
  for (const insight of insights) {
    distribution[insight.category] = (distribution[insight.category] || 0) + 1;
  }
  
  return distribution;
}

/**
 * 检查是否有特定类别的洞察
 */
export function hasInsightCategory(insights: SmartInsight[], category: SmartInsight['category']): boolean {
  return insights.some(i => i.category === category);
}
