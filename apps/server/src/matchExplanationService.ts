// Cache persistence functions below use single UPDATE statements and are independent.
// No multi-statement transaction boundary is required for these best-effort writes.

/**
 * Match Explanation Service (桌友分析生成服务)
 * 
 * 通过 socialModelRouter 的混合路由（MiniMax 优先，DeepSeek 兜底）生成个性化匹配解释，
 * 说明为什么这些用户被匹配在一起。
 * 用于活动详情页的"桌友分析"部分。
 * 
 * 特性：
 * - 配对解释缓存（存储在 eventPoolGroups.pairExplanationsCache）
 * - 破冰话题缓存（存储在 eventPoolGroups.iceBreakersCache）
 * - 并发限制（最多3个并发API调用）
 * - 指数退避重试（最多2次重试）
 */

import { getClientForFunction, getDeepseekSelection } from './ai/socialModelRouter';
import { recordProUsage } from './ai/deepseekBudgetTracker';
import { DEEPSEEK_V4_PRO } from '@joyjoin/shared';
import { getCalibratedChemistryScore } from './archetypeChemistryCalibration';
import { db } from './db';
import { eventPoolGroups } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { WORK_MODE_LABELS, RELATIONSHIP_MATCH_LABELS, DISCUSSION_STYLE_LABELS, getConnectionPointRarity } from '@shared/constants';
import type { MatchExplanationContract, GroupAnalysisContract, OverallChemistry } from '@shared/groupAnalysis';
import type { ConnectionPointWithRarity } from '@shared/types/groupAnalysis';
import type { AIProvider } from '@shared/types/aiMeta';
import { buildAIGCMeta, buildFallbackAIMeta, buildLiveAIMeta, type AIResponseMeta } from '@shared/types/aiMeta';
import { moderateGeneratedContent } from './lib/aiContentModeration';
import { getInterestById } from '@shared/interests';
import { logAITrace } from './lib/aiTraceLogger';
import { logger } from './lib/logger';
import { generateWithCraftQuality } from './lib/craftQualityGate';
import { XIAOYUE_CRAFT_LITE } from './prompts/craft';
import { validateCraft } from './lib/writingCraftValidator';

// ============ 配置常量 ============

const API_CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  CONCURRENCY_LIMIT: 3, // Max concurrent API calls
};

const GROUP_ANALYSIS_PROMPT_VERSION = 'group-analysis-v1';
const PAIR_EXPLANATION_PROMPT_VERSION = 'pair-explanation-v2';
const GROUP_ICEBREAKERS_PROMPT_VERSION = 'group-icebreakers-v1';

// ============ 重试与并发控制 ============

/**
 * 带指数退避的重试逻辑
 */
async function withRetry<T>(
  fn: () => Promise<T>,
  maxRetries: number = API_CONFIG.MAX_RETRIES,
  baseDelayMs: number = API_CONFIG.RETRY_DELAY_MS
): Promise<T> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      logger.warn(`[MatchExplanation] Attempt ${attempt + 1} failed:`, { error: (error as Error).message });
      
      if (attempt < maxRetries) {
        const delay = baseDelayMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }
  
  throw lastError;
}

/**
 * 控制并发的批量执行器（使用队列模式）
 */
async function runWithConcurrencyLimit<T, R>(
  items: T[],
  fn: (item: T) => Promise<R>,
  limit: number = API_CONFIG.CONCURRENCY_LIMIT
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let currentIndex = 0;
  
  async function worker(): Promise<void> {
    while (currentIndex < items.length) {
      const index = currentIndex++;
      const item = items[index];
      results[index] = await fn(item);
    }
  }
  
  // Create 'limit' number of workers that process items from the queue
  const workers = Array.from({ length: Math.min(limit, items.length) }, () => worker());
  await Promise.all(workers);
  
  return results;
}

// ============ 类型定义 ============

export interface MatchMember {
  userId: string;
  displayName: string;
  archetype: string | null;
  secondaryArchetype?: string | null;
  interestsTop?: string[] | null;
  industry?: string | null;           // Display label (e.g. "科技互联网")
  hometown?: string | null;
  socialStyle?: string | null;
  // Enriched fields for connection point detection
  educationLevel?: string | null;
  relationshipStatus?: string | null;
  workMode?: string | null;
  industryCategory?: string | null;   // Category code for matching (e.g. "tech")
  industryCategoryLabel?: string | null; // Human-readable label for display (e.g. "科技互联网")
  interestsWithHeat?: Array<{ topicId: string; heatLevel: number }> | null;
  /** Optional interest signal boost data (from user_interest_signals table) */
  interestSignals?: Array<{
    interestKey: string;
    interestLabel: string;
    enthusiasmLevel: number;       // 1–5
    discussionStyle: string;       // e.g. "character_people"
    conversationDepth: number;     // 1–3
  }> | null;
}

export interface MatchExplanation extends MatchExplanationContract {
  pairKey: string; // "userId1-userId2" 排序后的组合
  explanation: string; // 2-3句话的匹配解释
  chemistryScore: number; // 化学反应分数
  sharedInterests: string[]; // 共同兴趣
  connectionPoints: string[]; // 连接点（同乡、同行业等）
  connectionPointsWithRarity?: ConnectionPointWithRarity[]; // 带稀有度的连接点
  introAngle?: string;
}

export interface GroupAnalysis extends GroupAnalysisContract {
  groupId: string;
  overallChemistry: OverallChemistry; // fire/warm/mild/cold
  groupDynamics: string; // 整体动态描述
  pairExplanations: MatchExplanation[]; // 两两配对解释
  iceBreakers: string[]; // 推荐破冰话题
  groupThemeTags: string[]; // 2–4 compact post-match theme tags
  groupThemeCompanion: string; // one short companion line
  /** true if the response was served from the DB cache */
  fromCache?: boolean;
  /** ISO-8601 timestamp of generation */
  generatedAt?: string;
  /**
   * The LLM provider used for this generation.
   * null when cached metadata is unavailable, when no model call succeeded,
   * or when different successful providers contributed to the same response.
   * Aligned with AIResponseMeta.provider.
   */
  provider?: AIProvider;
  /**
   * true if deterministic fallback content was used for any component of
   * this analysis. Aligned with AIResponseMeta.fallbackUsed.
   */
  fallbackUsed?: boolean;
  /**
   * Response-level prompt version for the group analysis contract.
   */
  promptVersion?: string;
  /** Standard AI observability metadata with AIGC compliance flags. */
  meta?: AIResponseMeta;
}

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

interface PairExplanationGenerationResult {
  explanation: MatchExplanation;
  providerUsed: AIProvider;
  fallbackUsed: boolean;
  promptVersion: string;
}

interface BatchPairExplanationGenerationResult {
  explanations: MatchExplanation[];
  providerUsed: AIProvider;
  fallbackUsed: boolean;
  promptVersion: string;
}

interface IceBreakerGenerationResult {
  iceBreakers: string[];
  providerUsed: AIProvider;
  fallbackUsed: boolean;
  promptVersion: string;
}

// Cache expiry: 7 days
const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

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

/**
 * Collapse component-level provider signals to a single response-level provider.
 *
 * @param providers Providers reported by individual Match Intelligence
 *   components (pair explanations, ice-breakers, etc.).
 * @returns The single provider when all successful LLM-generated components
 *   came from the same provider; otherwise null for mixed-provider or
 *   no-provider responses.
 */
function mergeProviders(...providers: AIProvider[]): AIProvider {
  const successfulProviders = Array.from(
    new Set(providers.filter((provider): provider is Exclude<AIProvider, null> => provider !== null))
  );

  if (successfulProviders.length === 1) {
    return successfulProviders[0];
  }

  return null;
}

function didComponentUseLLM(metadata: {
  provider: AIProvider;
  fallbackUsed: boolean;
}): boolean {
  return metadata.provider !== null || metadata.fallbackUsed === false;
}

// ============ 缓存函数 ============

/**
 * 从数据库加载缓存的配对解释（带roster验证）
 */
async function loadCachedPairExplanations(
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
      if (typeof cached.schemaVersion !== 'number' || cached.schemaVersion < 2) {
        logger.info(`[MatchExplanation] Cache invalidated for group ${groupId}: schemaVersion=${cached.schemaVersion ?? 'missing'} < 2`);
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
 */
async function savePairExplanationsCache(
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
      schemaVersion: 2,
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
 */
async function loadCachedIceBreakers(
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
 */
async function saveIceBreakersCache(
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
// ============ 辅助函数 ============

/**
 * 找出两个用户的共同兴趣
 */
function findSharedInterests(
  interests1: string[] | null | undefined,
  interests2: string[] | null | undefined
): string[] {
  if (!interests1 || !interests2) return [];
  return interests1.filter(i => interests2.includes(i));
}
/**
 * 获取工作模式的中文标签（使用共享常量 WORK_MODE_LABELS）
 */
function getWorkModeLabel(mode: string): string {
  return WORK_MODE_LABELS[mode as keyof typeof WORK_MODE_LABELS] || mode;
}

/** Maps internal discussionStyle keys to Chinese display labels */
function formatDiscussionStyle(style: string): string {
  return DISCUSSION_STYLE_LABELS[style] || style;
}

/**
 * 找出两个用户在热度达标兴趣上的深度重叠
 */
function findDeepInterestOverlap(
  interestsA: Array<{ topicId: string; heatLevel: number }> | null | undefined,
  interestsB: Array<{ topicId: string; heatLevel: number }> | null | undefined,
  minHeatLevel: number
): { count: number; topics: string[] } {
  if (!interestsA || !interestsB) return { count: 0, topics: [] };
  const deepA = new Set(
    interestsA.filter(i => i.heatLevel >= minHeatLevel).map(i => i.topicId)
  );
  const overlap = interestsB.filter(
    i => i.heatLevel >= minHeatLevel && deepA.has(i.topicId)
  );
  return { count: overlap.length, topics: overlap.map(i => i.topicId) };
}

/**
 * 找出连接点（同乡、同行业等），返回带稀有度的结构化结果。
 */
function findConnectionPoints(member1: MatchMember, member2: MatchMember): ConnectionPointWithRarity[] {
  const points: ConnectionPointWithRarity[] = [];

  const pushPoint = (text: string) => {
    points.push({ text, rarity: getConnectionPointRarity(text) });
  };

  if (member1.hometown && member2.hometown && member1.hometown === member2.hometown) {
    pushPoint(`同乡（${member1.hometown}）`);
  }

  if (member1.industry && member2.industry && member1.industry === member2.industry) {
    pushPoint(`同行业（${member1.industry}）`);
  }

  // Same education level
  if (member1.educationLevel && member2.educationLevel &&
      member1.educationLevel === member2.educationLevel) {
    pushPoint(`同学历（${member1.educationLevel}）`);
  }

  // Same relationship status — use shared RELATIONSHIP_MATCH_LABELS for display text
  if (member1.relationshipStatus && member2.relationshipStatus &&
      member1.relationshipStatus === member2.relationshipStatus &&
      member1.relationshipStatus !== "不透露") {
    const label = RELATIONSHIP_MATCH_LABELS[member1.relationshipStatus];
    if (label) {
      pushPoint(label.text);
    }
  }

  // Same work mode AND same industry category (rare compound)
  // Match on category code; display using the human-readable label
  if (member1.workMode && member2.workMode &&
      member1.workMode === member2.workMode &&
      member1.industryCategory && member2.industryCategory &&
      member1.industryCategory === member2.industryCategory) {
    const displayLabel = member1.industryCategoryLabel || member1.industryCategory;
    pushPoint(`同在${displayLabel}·${getWorkModeLabel(member1.workMode)}`);
  }

  // Archetype checks
  if (member1.archetype && member2.archetype) {
    if (member1.archetype === member2.archetype) {
      // Exact same archetype (epic)
      pushPoint(`同款人格（${member1.archetype}）`);
    } else {
      // Complementary archetype (chemistry score > 85)
      const chemScore = getCalibratedChemistryScore(member1.archetype || "koala", member2.archetype || "koala");
      if (chemScore > 85) {
        pushPoint(`性格互补（${member1.archetype}×${member2.archetype}）`);
      }
    }
  }

  // Compound epic: same hometown + same industry category (老乡+同行 bonus)
  // Match on category code; display using the human-readable label
  if (member1.hometown && member2.hometown &&
      member1.hometown === member2.hometown &&
      member1.industryCategory && member2.industryCategory &&
      member1.industryCategory === member2.industryCategory) {
    const displayLabel = member1.industryCategoryLabel || member1.industryCategory;
    pushPoint(`老乡+同行（${member1.hometown}·${displayLabel}）`);
  }

  // Deep interest overlap (≥3 interests at heat level ≥ 2)
  const deepOverlap = findDeepInterestOverlap(
    member1.interestsWithHeat,
    member2.interestsWithHeat,
    2
  );
  if (deepOverlap.count >= 3) {
    pushPoint(`深度同好（${deepOverlap.count}个共同深度兴趣）`);
  }

  // Interest signal alignment — prompt enrichment only.
  // user_interest_signals (discussionStyle, conversationDepth) are valid here for
  // generating richer connection points shown in the AI match explanation.
  // They must NOT be read inside poolMatchingService pair-score computation.
  if (member1.interestSignals?.length && member2.interestSignals?.length) {
    const signalMap2 = new Map(
      member2.interestSignals.map(s => [s.interestKey, s])
    );
    for (const sig1 of member1.interestSignals) {
      const sig2 = signalMap2.get(sig1.interestKey);
      if (!sig2) continue;
      // Both have signaled this interest
      if (sig1.discussionStyle === sig2.discussionStyle) {
        pushPoint(`${sig1.interestLabel}同款聊法（${formatDiscussionStyle(sig1.discussionStyle)}）`);
      } else if (Math.abs(sig1.conversationDepth - sig2.conversationDepth) <= 1) {
        pushPoint(`${sig1.interestLabel}话题深度相近`);
      }
    }
  }

  return points;
}

/**
 * 生成配对键（排序后的用户ID组合）
 */
function getPairKey(userId1: string, userId2: string): string {
  return [userId1, userId2].sort().join('-');
}

const DEFAULT_PAIR_EXPLANATION =
  '这两位都是有趣的人，期待你们在活动中发现彼此的闪光点！';

type MalformedExplanationRecoveryKind = 'truncated' | 'fenced' | 'nested' | 'missing-key';

/**
 * Generation-boundary observability for LLM-output recovery. Emitted only when
 * `recoverExplanationFromMalformedJson` salvages text AND the caller opted in
 * via `logRecovery` — serve-path normalization of legacy rows stays silent by
 * design. Never log the recovered text itself (user-adjacent profile data).
 */
function logMalformedExplanationRecovery(
  kind: MalformedExplanationRecoveryKind,
  recoveredLength: number,
): void {
  logger.warn('[MatchExplanation] recovered malformed explanation payload', {
    promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    kind,
    recoveredLength,
  });
}

/**
 * Recover the human-readable `explanation` value from a JSON-ish string that
 * failed strict JSON.parse — e.g. truncated by the model's max_tokens limit or
 * wrapped in markdown code fences. Returns plain text, or null when nothing
 * usable can be salvaged.
 *
 * When `options.logRecovery` is set (LLM generation boundary only), a
 * successful salvage emits one `logger.warn` classifying the recovery so
 * truncation/fencing rates can inform max_tokens and prompt tuning.
 */
function recoverExplanationFromMalformedJson(
  raw: string,
  options?: { logRecovery?: boolean },
): string | null {
  let text = raw.trim();
  // Strip ```json ... ``` (or ``` ... ```) fences when the model ignored the
  // "no markdown code block" instruction.
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);
  if (fence) text = fence[1].trim();

  // Strict parse on the (possibly de-fenced) text — handles valid JSON and
  // double-serialized / object-wrapped explanations.
  let parseOk = false;
  try {
    const parsed = JSON.parse(text) as { explanation?: unknown };
    parseOk = true;
    if (parsed && typeof parsed === 'object' && 'explanation' in parsed) {
      const inner = normalizePairExplanationText(parsed.explanation);
      if (inner) {
        if (options?.logRecovery) {
          logMalformedExplanationRecovery(fence ? 'fenced' : 'nested', inner.length);
        }
        return inner;
      }
    }
  } catch {
    // Fall through to regex recovery for truncated / malformed JSON.
  }

  // Regex recovery: capture the explanation string value even when the closing
  // quote/brace is missing (truncated output).
  const match = text.match(/"explanation"\s*:\s*"((?:[^"\\]|\\.)*)/);
  if (match && match[1]) {
    const value = match[1]
      .replace(/\\(["\\/])/g, '$1')
      .replace(/\\n/g, '\n')
      .replace(/\\t/g, '\t')
      .trim();
    if (value) {
      if (options?.logRecovery) {
        // parseOk + regex salvage ⇒ valid JSON without a usable explanation key.
        logMalformedExplanationRecovery(parseOk ? 'missing-key' : 'truncated', value.length);
      }
      return value;
    }
  }

  return null;
}

/**
 * Normalize any pair-explanation payload to guaranteed plain text.
 *
 * The DB (event_pool_groups.pair_explanations_cache) must never hold a
 * serialized/truncated JSON wrapper as the explanation. This helper unwraps
 * JSON-encoded strings, extracts `.explanation` from objects, recovers text
 * from malformed/truncated JSON, and trims the result. It NEVER returns a
 * string beginning with '{' or '['; unrecoverable input yields `fallback`.
 * Idempotent — clean plain text passes through unchanged.
 *
 * `options.logRecovery` opts into a `logger.warn` when malformed-JSON recovery
 * salvages text — pass it only at the LLM generation boundary; serve-path and
 * persist-guard normalization must stay silent to avoid per-read log spam.
 */
export function normalizePairExplanationText(
  value: unknown,
  fallback = '',
  options?: { logRecovery?: boolean },
): string {
  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return fallback;
    // Route JSON objects/arrays AND markdown-fenced JSON to recovery; plain
    // prose (the normal case) falls through untouched.
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('```')) {
      const recovered = recoverExplanationFromMalformedJson(trimmed, options);
      if (recovered && !recovered.startsWith('{') && !recovered.startsWith('[')) {
        return recovered;
      }
      return fallback;
    }
    return trimmed;
  }

  if (value && typeof value === 'object') {
    const obj = value as { explanation?: unknown };
    if ('explanation' in obj) {
      return normalizePairExplanationText(obj.explanation, fallback, options);
    }
    // Object without an explanation key: use its first string property.
    const firstString = Object.values(obj).find((v): v is string => typeof v === 'string');
    if (firstString) return normalizePairExplanationText(firstString, fallback, options);
  }

  return fallback;
}

/**
 * Parse pair-explanation LLM output: `pair-explanation-v2` expects a single JSON object;
 * legacy plain-text responses remain supported. The returned explanation is always
 * plain text — never a serialized/truncated JSON wrapper.
 *
 * This is the LLM generation boundary: recoveries are logged (logger.warn with
 * `logRecovery: true`) so malformed-output rates stay observable.
 */
function parsePairExplanationContent(raw: string): { explanation: string; introAngle?: string } {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { explanation: DEFAULT_PAIR_EXPLANATION };
  }
  try {
    const parsed = JSON.parse(trimmed) as { explanation?: unknown; introAngle?: unknown };
    if (parsed && typeof parsed === 'object') {
      const explanation = normalizePairExplanationText(
        parsed.explanation,
        DEFAULT_PAIR_EXPLANATION,
        { logRecovery: true },
      );
      const introAngle =
        typeof parsed.introAngle === 'string'
          ? normalizePairExplanationText(parsed.introAngle, '', { logRecovery: true }).slice(0, 48) || undefined
          : undefined;
      return { explanation, introAngle };
    }
  } catch {
    // Not valid complete JSON (truncated by max_tokens, fenced, or legacy plain
    // text): recover/unwrap instead of persisting the raw JSON wrapper.
  }
  return {
    explanation: normalizePairExplanationText(trimmed, DEFAULT_PAIR_EXPLANATION, {
      logRecovery: true,
    }),
  };
}

// ============ 核心生成函数 ============

/**
 * 为一对用户生成匹配解释及其生成元数据。
 * Internal helper for group-level aggregation so the public
 * `generatePairExplanation()` API can stay focused on the explanation payload
 * while group analysis still captures provider/fallback observability.
 */
async function generatePairExplanationWithMetadata(
  member1: MatchMember,
  member2: MatchMember
): Promise<PairExplanationGenerationResult> {
  const chemistryScore = getCalibratedChemistryScore(member1.archetype || "koala", member2.archetype || "koala");
  const sharedInterests = findSharedInterests(member1.interestsTop, member2.interestsTop);
  const connectionPointsWithRarity = findConnectionPoints(member1, member2);
  const connectionPoints = connectionPointsWithRarity.map(cp => cp.text);

  // 构建提示词（结构化 JSON：主解释 + 开场角度）
  const prompt = `你是一个社交活动的匹配分析师。请用2-3句温暖、正面的话语解释为什么这两位参与者可能会聊得来。

用户A: ${member1.displayName || '神秘嘉宾'}
- 社交原型: ${member1.archetype || '未知'}
- 兴趣: ${member1.interestsTop?.slice(0, 3).join('、') || '未知'}
- 行业: ${member1.industry || '未知'}
${member1.socialStyle ? `- 社交风格: ${member1.socialStyle}` : ''}

用户B: ${member2.displayName || '神秘嘉宾'}
- 社交原型: ${member2.archetype || '未知'}
- 兴趣: ${member2.interestsTop?.slice(0, 3).join('、') || '未知'}
- 行业: ${member2.industry || '未知'}
${member2.socialStyle ? `- 社交风格: ${member2.socialStyle}` : ''}

化学反应分数: ${chemistryScore}/100
${sharedInterests.length > 0 ? `共同兴趣: ${sharedInterests.join('、')}` : ''}
${connectionPoints.length > 0 ? `连接点: ${connectionPoints.join('、')}` : ''}

${XIAOYUE_CRAFT_LITE}

请用中文，语气温暖友好，突出互补或共鸣点；不要使用「用户A/B」称呼。

输出要求：只输出**一行**合法 JSON（不要 markdown 代码块），格式如下：
{"explanation":"50-80字的解释正文","introAngle":"一句自然破冰的开场建议（≤24字）"}
explanation 为正文；introAngle 为两人见面时如何开口的一句提示。`;

  const { client, model, provider } = getClientForFunction('generatePairExplanation');
  const t0 = Date.now();
  try {
    const response = await withRetry(async () => {
      return client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 280,
        temperature: 0.7,
      });
    });
    if (response.model === DEEPSEEK_V4_PRO && response.usage) {
      recordProUsage({
        inputTokens: response.usage.prompt_tokens ?? 0,
        outputTokens: response.usage.completion_tokens ?? 0,
        feature: 'generatePairExplanation',
      });
    }
    const latencyMs = Date.now() - t0;
    logger.info(`[MatchExplanation] generatePairExplanation provider=${provider} latency=${latencyMs}ms`);
    logAITrace({
      domain: 'match_explanation',
      feature: 'generatePairExplanation',
      provider,
      model,
      latencyMs,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    });

    const rawContent = response.choices[0]?.message?.content?.trim() || '';
    const parsed = parsePairExplanationContent(rawContent || DEFAULT_PAIR_EXPLANATION);

    // Craft quality diagnostic (non-blocking — prompt injection handles quality)
    const craftDiag = validateCraft(parsed.explanation, 'comment');
    if (craftDiag.craftScore < 55) {
      logger.info('[MatchExplanation] Craft score below threshold', {
        pairKey: getPairKey(member1.userId, member2.userId),
        craftScore: craftDiag.craftScore,
        issues: craftDiag.fixableIssues.length,
      });
    }

    // Post-generation content safety moderation before returning to users.
    const moderation = moderateGeneratedContent(
      [
        { field: 'explanation', text: parsed.explanation },
        { field: 'introAngle', text: parsed.introAngle },
      ],
      {
        domain: 'match_explanation',
        feature: 'generatePairExplanation',
        provider,
        model,
        latencyMs,
        promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
      }
    );

    if (!moderation.safe) {
      logger.warn('[MatchExplanation] Content safety moderation failed, using fallback pair copy', {
        pairKey: getPairKey(member1.userId, member2.userId),
        field: moderation.field,
      });
      const fb = generateFallbackPairCopy(chemistryScore, sharedInterests);
      return {
        explanation: {
          pairKey: getPairKey(member1.userId, member2.userId),
          explanation: fb.explanation,
          chemistryScore,
          sharedInterests,
          connectionPoints,
          connectionPointsWithRarity,
          ...(fb.introAngle ? { introAngle: fb.introAngle } : {}),
        },
        providerUsed: null,
        fallbackUsed: true,
        promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
      };
    }

    return {
      explanation: {
        pairKey: getPairKey(member1.userId, member2.userId),
        explanation: parsed.explanation,
        chemistryScore,
        sharedInterests,
        connectionPoints,
        connectionPointsWithRarity,
        ...(parsed.introAngle ? { introAngle: parsed.introAngle } : {}),
      },
      providerUsed: provider,
      fallbackUsed: false,
      promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    };
  } catch (primaryError) {
    if (provider === 'minimax') {
      logger.warn(`[MatchExplanation] generatePairExplanation minimax failed after retries, trying deepseek fallback:`, { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      const { client: fbClient, model: fbModel } = getDeepseekSelection();
      try {
        // Single attempt only — the primary path already exhausted its retries
        const fbResponse = await fbClient.chat.completions.create({
          model: fbModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 280,
          temperature: 0.7,
        });
        if (fbResponse.model === DEEPSEEK_V4_PRO && fbResponse.usage) {
          recordProUsage({
            inputTokens: fbResponse.usage.prompt_tokens ?? 0,
            outputTokens: fbResponse.usage.completion_tokens ?? 0,
            feature: 'generatePairExplanation_fallback',
          });
        }
        const latencyMs = Date.now() - t0;
        logger.info(`[MatchExplanation] generatePairExplanation provider=deepseek (fallback) latency=${latencyMs}ms`);
        logAITrace({
          domain: 'match_explanation',
          feature: 'generatePairExplanation',
          provider: 'deepseek',
          model: fbModel,
          latencyMs,
          success: true,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        });
        const fbRaw = fbResponse.choices[0]?.message?.content?.trim() || '';
        const fbParsed = parsePairExplanationContent(fbRaw || DEFAULT_PAIR_EXPLANATION);
        // Craft quality diagnostic
        const fbCraftDiag = validateCraft(fbParsed.explanation, 'comment');
        if (fbCraftDiag.craftScore < 55) {
          logger.info('[MatchExplanation] Craft score below threshold (fallback path)', {
            pairKey: getPairKey(member1.userId, member2.userId),
            craftScore: fbCraftDiag.craftScore,
          });
        }

        const fbModeration = moderateGeneratedContent(
          [
            { field: 'explanation', text: fbParsed.explanation },
            { field: 'introAngle', text: fbParsed.introAngle },
          ],
          {
            domain: 'match_explanation',
            feature: 'generatePairExplanation',
            provider: 'deepseek',
            model: fbModel,
            latencyMs: Date.now() - t0,
            promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
          }
        );

        if (!fbModeration.safe) {
          logger.warn('[MatchExplanation] Content safety moderation failed on deepseek fallback, using deterministic fallback', {
            pairKey: getPairKey(member1.userId, member2.userId),
            field: fbModeration.field,
          });
          const fb = generateFallbackPairCopy(chemistryScore, sharedInterests);
          return {
            explanation: {
              pairKey: getPairKey(member1.userId, member2.userId),
              explanation: fb.explanation,
              chemistryScore,
              sharedInterests,
              connectionPoints,
              connectionPointsWithRarity,
              ...(fb.introAngle ? { introAngle: fb.introAngle } : {}),
            },
            providerUsed: null,
            fallbackUsed: true,
            promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
          };
        }

        return {
          explanation: {
            pairKey: getPairKey(member1.userId, member2.userId),
            explanation: fbParsed.explanation,
            chemistryScore,
            sharedInterests,
            connectionPoints,
            connectionPointsWithRarity,
            ...(fbParsed.introAngle ? { introAngle: fbParsed.introAngle } : {}),
          },
          providerUsed: 'deepseek',
          fallbackUsed: true,
          promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        };
      } catch (fallbackError) {
        logger.error('[MatchExplanation] Error generating explanation after deepseek fallback:', { error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
        logAITrace({
          domain: 'match_explanation',
          feature: 'generatePairExplanation',
          provider: 'deepseek',
          model: fbModel,
          latencyMs: Date.now() - t0,
          success: false,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
          errorCode: 'deepseek_fallback_error',
        });
      }
    } else {
      logger.error('[MatchExplanation] Error generating explanation after retries:', { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      logAITrace({
        domain: 'match_explanation',
        feature: 'generatePairExplanation',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        errorCode: 'primary_retry_exhausted',
      });
    }
    // 降级处理：返回基于化学反应分数的模板解释
    const fb = generateFallbackPairCopy(chemistryScore, sharedInterests);
    return {
      explanation: {
        pairKey: getPairKey(member1.userId, member2.userId),
        explanation: fb.explanation,
        chemistryScore,
        sharedInterests,
        connectionPoints,
        connectionPointsWithRarity,
        ...(fb.introAngle ? { introAngle: fb.introAngle } : {}),
      },
      providerUsed: null,
      fallbackUsed: true,
      promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    };
  }
}

/**
 * 降级模板解释（当API调用失败时使用）
 */
function generateFallbackPairCopy(
  chemistryScore: number,
  sharedInterests: string[],
): { explanation: string; introAngle?: string } {
  let explanation: string;
  if (chemistryScore >= 85) {
    explanation = `这两位的性格特质非常互补，预计会擦出精彩的火花！`;
  } else if (chemistryScore >= 70) {
    explanation = `两位都是社交能量满满的人，相信会有很多话题可以聊。`;
  } else if (chemistryScore >= 55) {
    explanation = `虽然风格不同，但这正是发现新朋友的好机会！`;
  } else {
    explanation = `每一次相遇都是缘分，期待你们发现彼此的独特之处。`;
  }
  const introAngle =
    sharedInterests.length > 0 ? `先从「${sharedInterests[0]}」聊起吧` : undefined;
  return { explanation, introAngle };
}

/**
 * 生成所有配对的解释（不使用缓存），并汇总批次级别的元数据。
 * Returns the explanations plus aggregated provider/fallback state for the
 * full pair-explanation batch.
 */
async function generateFreshPairExplanations(members: MatchMember[]): Promise<BatchPairExplanationGenerationResult> {
  const pairs: Array<{ member1: MatchMember; member2: MatchMember }> = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      pairs.push({ member1: members[i], member2: members[j] });
    }
  }
  
  const results = await runWithConcurrencyLimit(
    pairs,
    async (pair) => generatePairExplanationWithMetadata(pair.member1, pair.member2),
    API_CONFIG.CONCURRENCY_LIMIT
  );

  return {
    explanations: results.map((result) => result.explanation),
    providerUsed: mergeProviders(...results.map((result) => result.providerUsed)),
    fallbackUsed: results.some((result) => result.fallbackUsed),
    promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
  };
}

/**
 * 为一对用户生成匹配解释
 */
export async function generatePairExplanation(
  member1: MatchMember,
  member2: MatchMember
): Promise<MatchExplanation> {
  const result = await generatePairExplanationWithMetadata(member1, member2);
  return result.explanation;
}

/**
 * 为整个小组生成分析报告
 */
export async function generateGroupAnalysis(
  groupId: string,
  members: MatchMember[],
  eventType: string = "饭局",
  useCache: boolean = true
): Promise<GroupAnalysis & { fromCache: boolean; generatedAt: string; provider: AIProvider; fallbackUsed: boolean; promptVersion: string }> {
  const startedAt = Date.now();
  let pairExplanations: MatchExplanation[] = [];
  let iceBreakers: string[] = [];
  let fromCache = false;
  let cacheGeneratedAt: string | undefined;
  // Normalized metadata fields (aligned with AIResponseMeta)
  let provider: AIProvider = null;
  let fallbackUsed = false;
  let promptVersion = GROUP_ANALYSIS_PROMPT_VERSION;
  let llmOutputUsed = false;
  
  // Try to load from cache first (with roster validation)
  if (useCache) {
    // Parallelize cache loading for better performance
    const [cachedExplanations, cachedIceBreakers] = await Promise.all([
      loadCachedPairExplanations(groupId, members),
      loadCachedIceBreakers(groupId, members, eventType)
    ]);
    
    if (cachedExplanations && cachedIceBreakers) {
      logger.info(`[MatchExplanation] Using cached data for group ${groupId}`);
      pairExplanations = cachedExplanations.explanations;
      cacheGeneratedAt = cachedExplanations.generatedAt;
      iceBreakers = cachedIceBreakers.topics;
      fromCache = true;
      provider = mergeProviders(cachedExplanations.provider, cachedIceBreakers.provider);
      fallbackUsed = cachedExplanations.fallbackUsed || cachedIceBreakers.fallbackUsed;
      llmOutputUsed =
        didComponentUseLLM(cachedExplanations) ||
        didComponentUseLLM(cachedIceBreakers);
    } else {
      // Cache miss, expired, or roster changed - regenerate in parallel
      const [pairExplanationResult, iceBreakerResult] = await Promise.all([
        generateFreshPairExplanations(members),
        generateIceBreakers(members, eventType)
      ]);
      pairExplanations = pairExplanationResult.explanations;
      iceBreakers = iceBreakerResult.iceBreakers;
      provider = mergeProviders(pairExplanationResult.providerUsed, iceBreakerResult.providerUsed);
      fallbackUsed = pairExplanationResult.fallbackUsed || iceBreakerResult.fallbackUsed;
      llmOutputUsed =
        didComponentUseLLM({
          provider: pairExplanationResult.providerUsed,
          fallbackUsed: pairExplanationResult.fallbackUsed,
        }) ||
        didComponentUseLLM({
          provider: iceBreakerResult.providerUsed,
          fallbackUsed: iceBreakerResult.fallbackUsed,
        });
      
      // Save to cache with roster metadata (fire and forget with error handling)
      savePairExplanationsCache(groupId, members, pairExplanations, {
        provider: pairExplanationResult.providerUsed,
        fallbackUsed: pairExplanationResult.fallbackUsed,
        promptVersion: pairExplanationResult.promptVersion,
      }).catch((err) => {
        logger.error('[MatchExplanation] Failed to save pair explanations cache:', { error: err instanceof Error ? err.message : String(err) });
      });
      saveIceBreakersCache(groupId, members, eventType, iceBreakers, {
        provider: iceBreakerResult.providerUsed,
        fallbackUsed: iceBreakerResult.fallbackUsed,
        promptVersion: iceBreakerResult.promptVersion,
      }).catch((err) => {
        logger.error('[MatchExplanation] Failed to save ice breakers cache:', { error: err instanceof Error ? err.message : String(err) });
      });
    }
  } else {
    // No cache requested - generate fresh in parallel
    const [pairExplanationResult, iceBreakerResult] = await Promise.all([
      generateFreshPairExplanations(members),
      generateIceBreakers(members, eventType)
    ]);
    pairExplanations = pairExplanationResult.explanations;
    iceBreakers = iceBreakerResult.iceBreakers;
    provider = mergeProviders(pairExplanationResult.providerUsed, iceBreakerResult.providerUsed);
    fallbackUsed = pairExplanationResult.fallbackUsed || iceBreakerResult.fallbackUsed;
    llmOutputUsed =
      didComponentUseLLM({
        provider: pairExplanationResult.providerUsed,
        fallbackUsed: pairExplanationResult.fallbackUsed,
      }) ||
      didComponentUseLLM({
        provider: iceBreakerResult.providerUsed,
        fallbackUsed: iceBreakerResult.fallbackUsed,
      });
  }

  logAITrace({
    domain: 'match_explanation',
    feature: 'generateGroupAnalysis',
    provider,
    latencyMs: Date.now() - startedAt,
    success: llmOutputUsed,
    fallbackUsed,
    fromCache,
    promptVersion,
  });
  
  // 计算整体化学反应
  const totalChemistry = pairExplanations.reduce((sum, exp) => sum + exp.chemistryScore, 0);
  const pairCount = pairExplanations.length;
  const avgChemistry = pairCount > 0 ? totalChemistry / pairCount : 50;

  // 确定化学反应等级
  let overallChemistry: OverallChemistry;
  if (avgChemistry >= 85) overallChemistry = 'fire';
  else if (avgChemistry >= 70) overallChemistry = 'warm';
  else if (avgChemistry >= 55) overallChemistry = 'mild';
  else overallChemistry = 'cold';

  // 生成小组动态描述
  const groupDynamics = generateGroupDynamics(members, avgChemistry, eventType);

  // 生成主题标签和伴随说明（确定性生成，无需LLM调用）
  const groupThemeTags = generateGroupThemeTags(members, overallChemistry, eventType);
  const groupThemeCompanion = generateGroupThemeCompanion(members, overallChemistry, eventType);

  // Final post-generation safety check — also defends against stale cache content
  // that may not have been moderated by earlier code versions.
  // Serve-path normalization: guarantee plain-text explanations for every
  // consumer, including legacy cached rows persisted before the persist fix.
  let pairExplanationsSafe: MatchExplanation[] = pairExplanations.map((exp) => ({
    ...exp,
    explanation: normalizePairExplanationText(exp.explanation),
    ...(exp.introAngle ? { introAngle: normalizePairExplanationText(exp.introAngle) } : {}),
  }));
  let iceBreakersSafe = iceBreakers;
  let anyModerationFailure = false;

  for (let i = 0; i < pairExplanationsSafe.length; i++) {
    const exp = pairExplanationsSafe[i];
    const moderation = moderateGeneratedContent(
      [
        { field: `pair_${i}_explanation`, text: exp.explanation },
        { field: `pair_${i}_introAngle`, text: exp.introAngle },
      ],
      {
        domain: 'match_explanation',
        feature: 'generateGroupAnalysis',
        provider,
        latencyMs: Date.now() - startedAt,
        promptVersion,
      }
    );
    if (!moderation.safe) {
      anyModerationFailure = true;
      const fb = generateFallbackPairCopy(exp.chemistryScore, exp.sharedInterests);
      pairExplanationsSafe[i] = {
        ...exp,
        explanation: fb.explanation,
        introAngle: fb.introAngle,
      };
    }
  }

  const iceBreakerModeration = moderateGeneratedContent(
    iceBreakersSafe.map((topic, i) => ({ field: `iceBreaker_${i}`, text: topic })),
    {
      domain: 'match_explanation',
      feature: 'generateGroupAnalysis',
      provider,
      latencyMs: Date.now() - startedAt,
      promptVersion,
    }
  );
  if (!iceBreakerModeration.safe) {
    anyModerationFailure = true;
    const interestCounts = new Map<string, number>();
    members.forEach(m => {
      (m.interestsTop || []).forEach(i => {
        interestCounts.set(i, (interestCounts.get(i) || 0) + 1);
      });
    });
    const commonInterests = Array.from(interestCounts.entries())
      .filter(([_, count]) => count >= 2)
      .map(([interest]) => interest)
      .slice(0, 3);
    iceBreakersSafe = getFallbackIceBreakers(eventType, commonInterests);
  }

  if (anyModerationFailure) {
    fallbackUsed = true;
    logger.warn('[MatchExplanation] Final group-analysis moderation failed for some components; using deterministic fallback for those components');
  }

  const generatedAt = fromCache && cacheGeneratedAt ? cacheGeneratedAt : new Date().toISOString();

  return {
    groupId,
    overallChemistry,
    groupDynamics,
    pairExplanations: pairExplanationsSafe,
    iceBreakers: iceBreakersSafe,
    groupThemeTags,
    groupThemeCompanion,
    fromCache,
    generatedAt,
    provider,
    fallbackUsed,
    promptVersion,
    meta: {
      generatedAt,
      fromCache,
      provider,
      fallbackUsed,
      promptVersion,
      aigc: buildAIGCMeta({ fallbackUsed, labelType: 'ai-generated' }),
    },
  };
}

// ============ 主题标签生成 ============

/** Archetype clusters used for theme tag derivation */
const ENERGETIC_ARCHETYPES = new Set(['corgi', 'rooster', 'hamster_praise']);
const ANALYTICAL_ARCHETYPES = new Set(['fox', 'owl', 'octopus']);
const WARM_ARCHETYPES = new Set(['koala', 'elephant']);
const QUIET_ARCHETYPES = new Set(['turtle', 'cat']);

type GroupThemeBucket = 'exploration' | 'food' | 'music' | 'culture' | null;

function normalizeInterestForTheme(interest: string): string {
  return getInterestById(interest)?.label ?? interest;
}

function getInterestThemeBucket(interest: string): GroupThemeBucket {
  const normalized = normalizeInterestForTheme(interest);

  if (
    ['旅游', '旅行', '户外', '徒步', '露营', 'CityWalk', '城市漫步', '水上运动'].includes(normalized)
  ) {
    return 'exploration';
  }

  if (
    ['美食', '烹饪', '火锅', '撸串', '早茶', '日料', '西餐', '下午茶', '咖啡', '探店', '打边炉', '私厨'].includes(normalized)
  ) {
    return 'food';
  }

  if (
    ['音乐', '玩音乐', '乐器', '演唱会', 'LiveHouse', 'KTV'].includes(normalized)
  ) {
    return 'music';
  }

  if (
    ['读书', '阅读', '文学', '书', '看展', '话剧', '电影'].includes(normalized)
  ) {
    return 'culture';
  }

  return null;
}

/**
 * Deterministically generate 2–4 compact post-match theme tags.
 * Derived from archetype composition, chemistry level, and shared interests.
 * No LLM call — always returns a result instantly.
 */
function generateGroupThemeTags(
  members: MatchMember[],
  overallChemistry: OverallChemistry,
  eventType: string
): string[] {
  const tags: string[] = [];
  const archetypes = members.map(m => m.archetype).filter(Boolean) as string[];

  // 1. Chemistry vibe tag
  if (overallChemistry === 'fire') tags.push('高火花');
  else if (overallChemistry === 'warm') tags.push('相遇顺畅');
  else tags.push('轻松破冰');

  // 2. Archetype composition tag
  const energeticCount = archetypes.filter(a => ENERGETIC_ARCHETYPES.has(a)).length;
  const analyticalCount = archetypes.filter(a => ANALYTICAL_ARCHETYPES.has(a)).length;
  const warmCount = archetypes.filter(a => WARM_ARCHETYPES.has(a)).length;
  const quietCount = archetypes.filter(a => QUIET_ARCHETYPES.has(a)).length;
  if (energeticCount > 0 && analyticalCount > 0) tags.push('动静结合');
  else if (energeticCount >= 2) tags.push('活力满格');
  else if (analyticalCount >= 2) tags.push('深度交流');
  else if (warmCount >= 2) tags.push('温暖同频');
  else if (quietCount >= 2) tags.push('慢热深聊');
  else if (archetypes.length > 0) tags.push('性格多元');

  // 3. Interest / activity tag (supports both canonical interest IDs and legacy/display labels)
  const allInterests = members.flatMap(m => (m.interestsTop ?? []).map(normalizeInterestForTheme));
  const interestCounts = new Map<string, number>();
  allInterests.forEach(i => interestCounts.set(i, (interestCounts.get(i) || 0) + 1));
  const topShared = Array.from(interestCounts.entries())
    .filter(([_, c]) => c >= 2)
    .map(([i]) => i);
  if (topShared.some(t => getInterestThemeBucket(t) === 'exploration')) tags.push('城市探索');
  else if (topShared.some(t => getInterestThemeBucket(t) === 'food')) tags.push('美食同好');
  else if (topShared.some(t => getInterestThemeBucket(t) === 'music')) tags.push('音乐同频');
  else if (topShared.some(t => getInterestThemeBucket(t) === 'culture')) tags.push('文化共鸣');
  else if (eventType === '酒局') tags.push('把酒言欢');
  else if (topShared.length >= 2) tags.push('话题丰富');

  // 4. Background diversity tag (only when truly cross-industry)
  const industries = new Set(members.map(m => m.industryCategory).filter(Boolean));
  if (industries.size >= 3 && tags.length < 4) tags.push('背景多元');

  while (tags.length < 2) {
    const fallbackTag =
      eventType === '酒局'
        ? '轻松小酌'
        : members.length >= 4
        ? '缘分开桌'
        : '轻松相处';

    if (!tags.includes(fallbackTag)) {
      tags.push(fallbackTag);
      continue;
    }

    tags.push('自然同桌');
  }

  return tags.slice(0, 4);
}

/**
 * Deterministically generate a compact companion line contextualising the group theme.
 * Non-duplicative of pair explanations and groupDynamics.
 */
function generateGroupThemeCompanion(
  members: MatchMember[],
  overallChemistry: OverallChemistry,
  eventType: string
): string {
  const archetypes = members.map(m => m.archetype).filter(Boolean) as string[];
  const energeticCount = archetypes.filter(a => ENERGETIC_ARCHETYPES.has(a)).length;
  const analyticalCount = archetypes.filter(a => ANALYTICAL_ARCHETYPES.has(a)).length;
  const quietCount = archetypes.filter(a => QUIET_ARCHETYPES.has(a)).length;

  if (overallChemistry === 'fire') {
    return `这组的火花感很强，${eventType}现场很可能很快就热络起来。`;
  }
  if (energeticCount > 0 && analyticalCount > 0) {
    return `动静结合的组合，${eventType}中往往能聊出意想不到的层次。`;
  }
  if (quietCount >= 2 || overallChemistry === 'mild' || overallChemistry === 'cold') {
    return `这组更适合先自然接触，再慢慢进入更有质量的交流。`;
  }
  if (energeticCount >= 2) {
    return `活力型组合，${eventType}开场会很自然，记得给安静的成员留点空间。`;
  }
  return `多元背景带来新鲜视角，${eventType}中聊开了会很有意思。`;
}

/**
 * 生成小组动态描述
 */
function generateGroupDynamics(
  members: MatchMember[],
  avgChemistry: number,
  eventType: string
): string {
  const archetypes = members.map(m => m.archetype).filter(Boolean);
  const hasEnergizers = archetypes.some(a => 
    ['corgi', 'rooster', 'hamster_praise'].includes(a as string)
  );
  const hasListeners = archetypes.some(a => 
    ['koala', 'owl', 'cat'].includes(a as string)
  );
  
  if (avgChemistry >= 80 && hasEnergizers) {
    return `这是一个充满活力的组合！${eventType}氛围会非常热闹，记得留点时间让每个人都能分享故事。`;
  } else if (hasEnergizers && hasListeners) {
    return `完美的平衡组合！有人带动气氛，有人倾听回应，这场${eventType}会很温馨。`;
  } else if (hasListeners) {
    return `这是一个温和、深度的组合，适合慢慢建立信任，聊一些走心的话题。`;
  }
  return `多元化的组合带来不同视角，期待你们在${eventType}中发现彼此的有趣之处！`;
}

/**
 * 生成个性化破冰话题
 * Returns both the ice-breaker topics and a flag indicating whether
 * deterministic fallback content was used (i.e. all LLM calls failed).
 */
export async function generateIceBreakers(
  members: MatchMember[],
  eventType: string = "饭局"
): Promise<IceBreakerGenerationResult> {
  // 收集共同兴趣
  const allInterests: string[] = [];
  members.forEach(m => {
    if (m.interestsTop) allInterests.push(...m.interestsTop);
  });
  
  // 统计兴趣频率
  const interestCounts = new Map<string, number>();
  allInterests.forEach(i => {
    interestCounts.set(i, (interestCounts.get(i) || 0) + 1);
  });
  
  // 找出共同兴趣（至少2人有）
  const commonInterests = Array.from(interestCounts.entries())
    .filter(([_, count]) => count >= 2)
    .map(([interest, _]) => interest)
    .slice(0, 3);
  
  // 收集原型信息
  const archetypes = members.map(m => m.archetype).filter(Boolean);

  // Collect aligned interest signals (same interest key shared by ≥2 members)
  const signalKeyCount = new Map<string, { label: string; styles: string[]; depths: number[] }>();
  members.forEach(m => {
    (m.interestSignals || []).forEach(sig => {
      const entry = signalKeyCount.get(sig.interestKey) ?? { label: sig.interestLabel, styles: [], depths: [] };
      entry.styles.push(sig.discussionStyle);
      entry.depths.push(sig.conversationDepth);
      signalKeyCount.set(sig.interestKey, entry);
    });
  });
  const sharedSignals = Array.from(signalKeyCount.entries())
    .filter(([_, v]) => v.styles.length >= 2)
    .map(([key, v]) => {
      const styleCounts = new Map<string, number>();
      v.styles.forEach(s => styleCounts.set(s, (styleCounts.get(s) || 0) + 1));
      const dominantStyle = Array.from(styleCounts.entries()).sort((a, b) => b[1] - a[1])[0][0];
      const avgDepth = Math.round(v.depths.reduce((a, c) => a + c, 0) / v.depths.length);
      return `${v.label}（${formatDiscussionStyle(dominantStyle)}，深度${avgDepth}/3）`;
    })
    .slice(0, 3);
  
  const prompt = `你是一个社交活动的破冰专家。请为这个${eventType}小组生成3-5个有趣的破冰话题。

小组成员原型: ${archetypes.join('、') || '多样化组合'}
${commonInterests.length > 0 ? `共同兴趣: ${commonInterests.join('、')}` : ''}
${sharedSignals.length > 0 ? `兴趣偏好信号（成员自填）: ${sharedSignals.join('；')}` : ''}
活动类型: ${eventType}

要求:
1. 话题要轻松有趣，适合初次见面
2. 避免敏感话题（政治、宗教、催婚催生）
3. 鼓励每个人都能参与
4. 可以结合共同兴趣或原型特点
5. 用中文回复，每个话题一行

请直接列出话题，不要加序号或前缀。`;

  const { client, model, provider } = getClientForFunction('generateIceBreakers');
  const t0 = Date.now();
  try {
    const response = await withRetry(async () => {
      return client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.8,
      });
    });
    const latencyMs = Date.now() - t0;
    logger.info(`[IceBreakers] generateIceBreakers provider=${provider} latency=${latencyMs}ms`);
    logAITrace({
      domain: 'match_explanation',
      feature: 'generateIceBreakers',
      provider,
      model,
      latencyMs,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
    });
    
    const content = response.choices[0]?.message?.content?.trim() || '';
    const iceBreakers = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5 && line.length < 100)
      .slice(0, 5);
    
    if (iceBreakers.length >= 2) { // Lowered threshold from 3 to 2
      const moderation = moderateGeneratedContent(
        iceBreakers.map((topic, i) => ({ field: `iceBreaker_${i}`, text: topic })),
        {
          domain: 'match_explanation',
          feature: 'generateIceBreakers',
          provider,
          model,
          latencyMs,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
        }
      );

      if (!moderation.safe) {
        logger.warn('[IceBreakers] Content safety moderation failed, using fallback topics', {
          field: moderation.field,
        });
        return {
          iceBreakers: getFallbackIceBreakers(eventType, commonInterests),
          providerUsed: null,
          fallbackUsed: true,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
        };
      }

      return {
        iceBreakers,
        providerUsed: provider,
        fallbackUsed: false,
        promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
      };
    }
  } catch (primaryError) {
    if (provider === 'minimax') {
      logger.warn(`[IceBreakers] generateIceBreakers minimax failed after retries, trying deepseek fallback:`, { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      const { client: fbClient, model: fbModel } = getDeepseekSelection();
      try {
        // Single attempt only — the primary path already exhausted its retries
        const fbResponse = await fbClient.chat.completions.create({
          model: fbModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 300,
          temperature: 0.8,
        });
        const latencyMs = Date.now() - t0;
        logger.info(`[IceBreakers] generateIceBreakers provider=deepseek (fallback) latency=${latencyMs}ms`);
        logAITrace({
          domain: 'match_explanation',
          feature: 'generateIceBreakers',
          provider: 'deepseek',
          model: fbModel,
          latencyMs,
          success: true,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
        });
        const content = fbResponse.choices[0]?.message?.content?.trim() || '';
        const iceBreakers = content
          .split('\n')
          .map(line => line.trim())
          .filter(line => line.length > 5 && line.length < 100)
          .slice(0, 5);
        if (iceBreakers.length >= 2) {
          const moderation = moderateGeneratedContent(
            iceBreakers.map((topic, i) => ({ field: `iceBreaker_${i}`, text: topic })),
            {
              domain: 'match_explanation',
              feature: 'generateIceBreakers',
              provider: 'deepseek',
              model: fbModel,
              latencyMs: Date.now() - t0,
              promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
            }
          );

          if (!moderation.safe) {
            logger.warn('[IceBreakers] Content safety moderation failed on deepseek fallback, using fallback topics', {
              field: moderation.field,
            });
            return {
              iceBreakers: getFallbackIceBreakers(eventType, commonInterests),
              providerUsed: null,
              fallbackUsed: true,
              promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
            };
          }

          return {
            iceBreakers,
            providerUsed: 'deepseek',
            fallbackUsed: true,
            promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
          };
        }
      } catch (fallbackError) {
        logger.error('[IceBreakers] Error generating ice-breakers after deepseek fallback:', { error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError) });
        logAITrace({
          domain: 'match_explanation',
          feature: 'generateIceBreakers',
          provider: 'deepseek',
          model: fbModel,
          latencyMs: Date.now() - t0,
          success: false,
          fallbackUsed: true,
          fromCache: false,
          promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
          errorCode: 'deepseek_fallback_error',
        });
      }
    } else {
      logger.error('[IceBreakers] Error generating ice-breakers after retries:', { error: primaryError instanceof Error ? primaryError.message : String(primaryError) });
      logAITrace({
        domain: 'match_explanation',
        feature: 'generateIceBreakers',
        provider,
        model,
        latencyMs: Date.now() - t0,
        success: false,
        fallbackUsed: true,
        fromCache: false,
        promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
        errorCode: 'primary_retry_exhausted',
      });
    }
  }
  
  // 降级：返回预设话题
  return {
    iceBreakers: getFallbackIceBreakers(eventType, commonInterests),
    providerUsed: null,
    fallbackUsed: true,
    promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
  };
}

/**
 * 降级破冰话题
 */
function getFallbackIceBreakers(eventType: string, commonInterests: string[]): string[] {
  const baseTopics = [
    "最近发现的一家宝藏餐厅是哪家？",
    "如果可以拥有一项超能力，你会选什么？",
    "周末最喜欢的放松方式是什么？",
    "最近在追什么剧或者看什么书？",
    "如果明天开始一段旅行，你最想去哪里？",
  ];
  
  if (eventType === "酒局") {
    baseTopics.unshift("你喜欢什么类型的酒？有什么推荐的吗？");
  }
  
  if (commonInterests.includes("美食")) {
    baseTopics.unshift("最拿手的一道菜是什么？");
  }
  
  if (commonInterests.includes("旅游")) {
    baseTopics.unshift("印象最深的一次旅行经历是什么？");
  }
  
  return baseTopics.slice(0, 5);
}

// ============ 查看者配对辅助函数 ============

/**
 * 返回与特定查看者相关的所有配对解释。
 * 
 * pairKey 格式为 sorted([userId1, userId2]).join('-')，因此查看者的 userId
 * 要么作为前缀（排序在前），要么作为后缀（排序在后）出现。
 * 通过 startsWith / endsWith 检测边界，避免子字符串误匹配
 * （UUID 自身含有短横线，不能直接使用 String.prototype.includes）。
 *
 * @param analysis  generateGroupAnalysis() 返回的 GroupAnalysis 对象
 * @param viewerUserId  当前请求用户的 userId
 * @returns 包含该用户的所有配对解释（0 到 n-1 条）
 */
export function getPairExplanationForUser(
  analysis: GroupAnalysis,
  viewerUserId: string
): MatchExplanation[] {
  if (!viewerUserId) return [];
  return analysis.pairExplanations.filter(exp => {
    const key = exp.pairKey;
    // The viewer's ID appears as prefix (sorted first) or suffix (sorted second)
    return key.startsWith(viewerUserId + '-') || key.endsWith('-' + viewerUserId);
  });
}

// ============ 导出 ============

export const matchExplanationService = {
  generatePairExplanation,
  generateGroupAnalysis,
  generateIceBreakers,
  findSharedInterests,
  findConnectionPoints,
  getPairExplanationForUser,
  normalizePairExplanationText,
};
