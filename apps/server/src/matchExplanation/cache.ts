import { eq } from 'drizzle-orm';
import { eventPoolGroups } from '@shared/schema';
import type { AIProvider } from '@shared/types/aiMeta';
import { db } from '../db';
import { logger } from '../lib/logger';
import { CACHE_EXPIRY_MS } from './constants';
import { normalizePairExplanationText } from './parsing';
import type { MatchMember, MatchExplanation } from './types';

// ============ 事务边界说明 (transaction boundary) ============
//
// Every exported cache function in this module performs EXACTLY ONE database
// statement against a single `eventPoolGroups` row:
//   - loadCachedPairExplanations / loadCachedIceBreakers → one SELECT
//   - savePairExplanationsCache / saveIceBreakersCache   → one UPDATE
//
// PostgreSQL guarantees statement-level atomicity, so each operation is
// independently safe and there is no multi-statement read/write sequence to
// wrap in `db.transaction(...)`. Adding an explicit transaction here would
// only add BEGIN/COMMIT round-trips without changing correctness.
//
// Cross-function atomicity is deliberately NOT required:
//   - loads (cache-miss decision) and saves (post-generation persist) run on
//     different code paths and are never part of one logical write;
//   - saves are best-effort / fire-and-forget — callers log and continue on
//     error, so a failed write must not roll back the request;
//   - pairExplanationsCache and iceBreakersCache are independent columns, so a
//     partial write degrades to a per-column cache miss, never corruption.
//
// If a future change makes any function perform multiple dependent statements,
// it MUST be wrapped in `db.transaction(...)` at that point.

// ============ 缓存类型 ============

interface CachedAIMetadata {
  provider?: AIProvider;
  fallbackUsed?: boolean;
  promptVersion?: string;
}

interface PairExplanationsCache extends CachedAIMetadata {
  schemaVersion: number;
  memberHash: string; // Hash of sorted member IDs for validation
  pairCount: number;
  generatedAt: string;
  explanations: MatchExplanation[];
}

interface IceBreakersCache extends CachedAIMetadata {
  memberHash: string; // Hash of sorted member IDs for validation
  eventType: string;
  generatedAt: string;
  topics: string[];
}

// Legacy types for backwards compatibility during migration
interface LegacyCachedPairExplanation extends MatchExplanation {
  generatedAt: string;
}

interface LegacyCachedIceBreakers {
  topics: string[];
  generatedAt: string;
}

// ============ 缓存辅助函数 ============

/**
 * 生成成员ID的哈希用于缓存验证
 * 使用排序后的成员ID列表生成简单哈希
 */
function generateMemberHash(members: MatchMember[]): string {
  const sortedIds = members.map(m => m.userId).sort();
  return sortedIds.join(',');
}

/**
 * 计算配对数量（n choose 2）
 */
function calculatePairCount(memberCount: number): number {
  return (memberCount * (memberCount - 1)) / 2;
}

/**
 * Normalize cache metadata with safe defaults for legacy or partially populated
 * cache records. This keeps `provider` nullable and forces `fallbackUsed` to a
 * strict boolean so cache-hit observability is consistent.
 */
function coerceCachedAIMetadata(cache: CachedAIMetadata | null | undefined): {
  provider: AIProvider;
  fallbackUsed: boolean;
  promptVersion?: string;
} {
  return {
    provider: cache?.provider ?? null,
    fallbackUsed: cache?.fallbackUsed === true,
    promptVersion: cache?.promptVersion,
  };
}

// ============ 缓存函数 ============

/**
 * 从数据库加载缓存的配对解释（带roster验证）
 * Single SELECT — independently atomic; see transaction-boundary note above.
 */
export async function loadCachedPairExplanations(
  groupId: string,
  members: MatchMember[]
): Promise<{ explanations: MatchExplanation[]; generatedAt: string; provider: AIProvider; fallbackUsed: boolean; promptVersion?: string } | null> {
  try {
    const group = await db.query.eventPoolGroups.findFirst({
      where: eq(eventPoolGroups.id, groupId),
    });
    
    if (!group?.pairExplanationsCache) return null;
    
    const rawCache = group.pairExplanationsCache;
    
    // Handle new cache format with roster validation
    if (rawCache && typeof rawCache === 'object' && 'memberHash' in rawCache) {
      const cached = rawCache as PairExplanationsCache;
      const currentHash = generateMemberHash(members);
      const expectedPairCount = calculatePairCount(members.length);

      // Schema-version gate: reject old caches (lazy invalidation)
      if (typeof cached.schemaVersion !== 'number' || cached.schemaVersion < 3) {
        logger.info(`[MatchExplanation] Cache invalidated for group ${groupId}: schemaVersion=${cached.schemaVersion ?? 'missing'} < 3`);
        return null;
      }

      // Validate roster hasn't changed
      if (cached.memberHash !== currentHash) {
        logger.info(`[MatchExplanation] Cache invalidated for group ${groupId}: roster changed`);
        return null;
      }

      // Validate pair count matches
      if (cached.pairCount !== expectedPairCount) {
        logger.info(`[MatchExplanation] Cache invalidated for group ${groupId}: pair count mismatch`);
        return null;
      }

      // Check if cache is still valid
      const generatedTime = new Date(cached.generatedAt).getTime();
      if (Date.now() - generatedTime > CACHE_EXPIRY_MS) {
        logger.info(`[MatchExplanation] Cache expired for group ${groupId}`);
        return null;
      }

      const metadata = coerceCachedAIMetadata(cached);
      return {
        explanations: cached.explanations,
        generatedAt: cached.generatedAt,
        provider: metadata.provider,
        fallbackUsed: metadata.fallbackUsed,
        promptVersion: metadata.promptVersion,
      };
    }
    
    // Handle legacy cache format (without memberHash) - invalidate and regenerate
    if (Array.isArray(rawCache) && rawCache.length > 0) {
      logger.info(`[MatchExplanation] Legacy cache format detected for group ${groupId}, invalidating`);
      return null;
    }
    
    return null;
  } catch (error) {
    logger.warn('[MatchExplanation] Error loading cache:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 保存配对解释到数据库缓存（带roster元数据）
 * Single UPDATE — independently atomic; see transaction-boundary note above.
 */
export async function savePairExplanationsCache(
  groupId: string, 
  members: MatchMember[],
  explanations: MatchExplanation[],
  metadata: { provider: AIProvider; fallbackUsed: boolean; promptVersion: string }
): Promise<void> {
  try {
    // Authoritative persist guard: the DB must always hold plain-text
    // explanations — never a serialized/truncated JSON wrapper.
    const safeExplanations: MatchExplanation[] = explanations.map((exp) => ({
      ...exp,
      explanation: normalizePairExplanationText(exp.explanation),
      ...(exp.introAngle ? { introAngle: normalizePairExplanationText(exp.introAngle) } : {}),
    }));
    const cache: PairExplanationsCache = {
      schemaVersion: 3,
      memberHash: generateMemberHash(members),
      pairCount: safeExplanations.length,
      generatedAt: new Date().toISOString(),
      explanations: safeExplanations,
      provider: metadata.provider,
      fallbackUsed: metadata.fallbackUsed,
      promptVersion: metadata.promptVersion,
    };
    
    await db.update(eventPoolGroups)
      .set({ 
        pairExplanationsCache: cache,
        updatedAt: new Date(),
      })
      .where(eq(eventPoolGroups.id, groupId));
    
    logger.info(`[MatchExplanation] Saved ${explanations.length} pair explanations to cache for group ${groupId}`);
  } catch (error) {
    logger.warn('[MatchExplanation] Error saving cache:', { error: error instanceof Error ? error.message : String(error) });
  }
}

/**
 * 从数据库加载缓存的破冰话题（带roster验证）
 * Single SELECT — independently atomic; see transaction-boundary note above.
 */
export async function loadCachedIceBreakers(
  groupId: string,
  members: MatchMember[],
  eventType: string
): Promise<{ topics: string[]; generatedAt: string; provider: AIProvider; fallbackUsed: boolean; promptVersion?: string } | null> {
  try {
    const group = await db.query.eventPoolGroups.findFirst({
      where: eq(eventPoolGroups.id, groupId),
    });
    
    if (!group?.iceBreakersCache) return null;
    
    const rawCache = group.iceBreakersCache;
    
    // Handle new cache format with roster validation
    if (rawCache && typeof rawCache === 'object' && 'memberHash' in rawCache) {
      const cached = rawCache as IceBreakersCache;
      const currentHash = generateMemberHash(members);
      
      // Validate roster hasn't changed
      if (cached.memberHash !== currentHash) {
        logger.info(`[IceBreakers] Cache invalidated for group ${groupId}: roster changed`);
        return null;
      }
      
      // Validate event type matches
      if (cached.eventType !== eventType) {
        logger.info(`[IceBreakers] Cache invalidated for group ${groupId}: event type changed`);
        return null;
      }
      
      // Check if cache is still valid
      const generatedTime = new Date(cached.generatedAt).getTime();
      if (Date.now() - generatedTime > CACHE_EXPIRY_MS) {
        logger.info(`[IceBreakers] Cache expired for group ${groupId}`);
        return null;
      }
      
      const metadata = coerceCachedAIMetadata(cached);
      return {
        topics: cached.topics,
        generatedAt: cached.generatedAt,
        provider: metadata.provider,
        fallbackUsed: metadata.fallbackUsed,
        promptVersion: metadata.promptVersion,
      };
    }
    
    // Handle legacy cache format - invalidate and regenerate
    if (rawCache && typeof rawCache === 'object' && 'topics' in rawCache) {
      logger.info(`[IceBreakers] Legacy cache format detected for group ${groupId}, invalidating`);
      return null;
    }
    
    return null;
  } catch (error) {
    logger.warn('[IceBreakers] Error loading cache:', { error: error instanceof Error ? error.message : String(error) });
    return null;
  }
}

/**
 * 保存破冰话题到数据库缓存（带roster元数据）
 * Single UPDATE — independently atomic; see transaction-boundary note above.
 */
export async function saveIceBreakersCache(
  groupId: string,
  members: MatchMember[],
  eventType: string,
  topics: string[],
  metadata: { provider: AIProvider; fallbackUsed: boolean; promptVersion: string }
): Promise<void> {
  try {
    const cache: IceBreakersCache = {
      memberHash: generateMemberHash(members),
      eventType,
      generatedAt: new Date().toISOString(),
      topics,
      provider: metadata.provider,
      fallbackUsed: metadata.fallbackUsed,
      promptVersion: metadata.promptVersion,
    };
    
    await db.update(eventPoolGroups)
      .set({ 
        iceBreakersCache: cache,
        updatedAt: new Date(),
      })
      .where(eq(eventPoolGroups.id, groupId));
    
    logger.info(`[IceBreakers] Saved ${topics.length} ice breakers to cache for group ${groupId}`);
  } catch (error) {
    logger.warn('[IceBreakers] Error saving cache:', { error: error instanceof Error ? error.message : String(error) });
  }
}
