/**
 * 碎嘴缓存服务 V3
 * 提供缓存查询、存储和批量预生成功能
 */

import { db } from '../db';
import { gossipCache } from '@shared/schema';
import { eq, and, sql } from 'drizzle-orm';
import { generateProfileClusterHash, extractProfileClusterInput, type ProfileClusterInput } from './profileClusterHash';

export interface GossipCacheEntry {
  clusterHash: string;
  triggerType: string;
  variants: string[];
  usageCount: number;
  avgRating: number | null;
}

/**
 * 从缓存获取碎嘴变体
 * 如果命中，随机返回一个变体并更新使用统计
 */
export async function getGossipFromCache(
  profile: ProfileClusterInput,
  triggerType: string
): Promise<string | null> {
  const clusterHash = generateProfileClusterHash(profile);
  
  try {
    const result = await db
      .select()
      .from(gossipCache)
      .where(
        and(
          eq(gossipCache.clusterHash, clusterHash),
          eq(gossipCache.triggerType, triggerType)
        )
      )
      .limit(1);
    
    if (result.length === 0 || !result[0].variants || result[0].variants.length === 0) {
      return null;
    }
    
    const entry = result[0];
    const randomIndex = Math.floor(Math.random() * entry.variants.length);
    const selectedVariant = entry.variants[randomIndex];
    
    // 异步更新使用统计（不等待）
    db.update(gossipCache)
      .set({
        usageCount: sql`${gossipCache.usageCount} + 1`,
        lastUsedAt: new Date(),
      })
      .where(eq(gossipCache.id, entry.id))
      .catch(err => console.error('[GossipCache] Failed to update usage count:', err));
    
    return selectedVariant;
  } catch (error) {
    console.error('[GossipCache] Error fetching from cache:', error);
    return null;
  }
}

/**
 * 保存碎嘴变体到缓存
 */
export async function saveGossipToCache(
  profile: ProfileClusterInput,
  triggerType: string,
  variants: string[]
): Promise<void> {
  const clusterHash = generateProfileClusterHash(profile);
  
  try {
    // 检查是否已存在
    const existing = await db
      .select({ id: gossipCache.id })
      .from(gossipCache)
      .where(
        and(
          eq(gossipCache.clusterHash, clusterHash),
          eq(gossipCache.triggerType, triggerType)
        )
      )
      .limit(1);
    
    if (existing.length > 0) {
      // 更新现有记录，追加新变体
      await db.update(gossipCache)
        .set({
          variants: sql`array_cat(${gossipCache.variants}, ${variants})`,
        })
        .where(eq(gossipCache.id, existing[0].id));
    } else {
      // 插入新记录
      await db.insert(gossipCache).values({
        clusterHash,
        triggerType,
        variants,
      });
    }
  } catch (error) {
    console.error('[GossipCache] Error saving to cache:', error);
  }
}

/**
 * 批量预生成热门画像簇的碎嘴变体
 * 用于后台任务定期执行
 */
export async function preGenerateHotClusters(
  generateVariantsFn: (profile: ProfileClusterInput, triggerType: string) => Promise<string[]>,
  triggerTypes: string[] = ['industry_reveal', 'interest_match', 'hometown_same'],
  targetVariantsPerCluster: number = 6
): Promise<{ generated: number; skipped: number }> {
  // 热门画像簇组合
  const hotProfiles: ProfileClusterInput[] = [
    { industry: '金融', topInterests: ['美食', '旅行'], hometownProvince: '广东', intent: ['networking'] },
    { industry: '互联网', topInterests: ['电影', '游戏'], hometownProvince: '北京', intent: ['friends'] },
    { industry: '科技', topInterests: ['健身', '户外'], hometownProvince: '上海', intent: ['networking', 'friends'] },
    { industry: '咨询', topInterests: ['阅读', '咖啡'], hometownProvince: '广东', intent: ['networking'] },
    { industry: '医疗', topInterests: ['音乐', '摄影'], hometownProvince: '四川', intent: ['friends'] },
  ];
  
  let generated = 0;
  let skipped = 0;
  
  for (const profile of hotProfiles) {
    for (const triggerType of triggerTypes) {
      const clusterHash = generateProfileClusterHash(profile);
      
      // 检查现有变体数量
      const existing = await db
        .select({ variants: gossipCache.variants })
        .from(gossipCache)
        .where(
          and(
            eq(gossipCache.clusterHash, clusterHash),
            eq(gossipCache.triggerType, triggerType)
          )
        )
        .limit(1);
      
      const currentCount = existing[0]?.variants?.length || 0;
      
      if (currentCount >= targetVariantsPerCluster) {
        skipped++;
        continue;
      }
      
      // 生成新变体
      const neededCount = targetVariantsPerCluster - currentCount;
      try {
        const newVariants = await generateVariantsFn(profile, triggerType);
        if (newVariants.length > 0) {
          await saveGossipToCache(profile, triggerType, newVariants.slice(0, neededCount));
          generated++;
        }
      } catch (error) {
        console.error(`[GossipCache] Failed to generate for ${clusterHash}:${triggerType}:`, error);
      }
    }
  }
  
  return { generated, skipped };
}

/**
 * 获取缓存统计信息
 */
export async function getCacheStats(): Promise<{
  totalEntries: number;
  totalVariants: number;
  topTriggerTypes: Array<{ triggerType: string; count: number }>;
}> {
  try {
    const entries = await db.select().from(gossipCache);
    
    const triggerCounts = new Map<string, number>();
    let totalVariants = 0;
    
    for (const entry of entries) {
      totalVariants += entry.variants?.length || 0;
      const current = triggerCounts.get(entry.triggerType) || 0;
      triggerCounts.set(entry.triggerType, current + 1);
    }
    
    const topTriggerTypes = Array.from(triggerCounts.entries())
      .map(([triggerType, count]) => ({ triggerType, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
    
    return {
      totalEntries: entries.length,
      totalVariants,
      topTriggerTypes,
    };
  } catch (error) {
    console.error('[GossipCache] Error getting stats:', error);
    return { totalEntries: 0, totalVariants: 0, topTriggerTypes: [] };
  }
}
