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
import { chemistryMatrix } from './archetypeChemistry';
import { db } from './db';
import { eventPoolGroups } from '@shared/schema';
import { eq } from 'drizzle-orm';
import { WORK_MODE_LABELS, RELATIONSHIP_MATCH_LABELS, DISCUSSION_STYLE_LABELS } from '@shared/constants';
import type { MatchExplanationContract, GroupAnalysisContract, OverallChemistry } from '@shared/groupAnalysis';
import type { AIProvider } from '@shared/types/aiMeta';
import { getInterestById } from '@shared/interests';
import { logAITrace } from './lib/aiTraceLogger';

// ============ 配置常量 ============

const API_CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  CONCURRENCY_LIMIT: 3, // Max concurrent API calls
};

const GROUP_ANALYSIS_PROMPT_VERSION = 'group-analysis-v1';
const PAIR_EXPLANATION_PROMPT_VERSION = 'pair-explanation-v1';
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
      console.warn(`[MatchExplanation] Attempt ${attempt + 1} failed:`, (error as Error).message);
      
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
}

// ============ 缓存类型 ============

interface CachedAIMetadata {
  provider?: AIProvider;
  fallbackUsed?: boolean;
  promptVersion?: string;
}

interface PairExplanationsCache extends CachedAIMetadata {
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
      
      // Validate roster hasn't changed
      if (cached.memberHash !== currentHash) {
        console.log(`[MatchExplanation] Cache invalidated for group ${groupId}: roster changed`);
        return null;
      }
      
      // Validate pair count matches
      if (cached.pairCount !== expectedPairCount) {
        console.log(`[MatchExplanation] Cache invalidated for group ${groupId}: pair count mismatch`);
        return null;
      }
      
      // Check if cache is still valid
      const generatedTime = new Date(cached.generatedAt).getTime();
      if (Date.now() - generatedTime > CACHE_EXPIRY_MS) {
        console.log(`[MatchExplanation] Cache expired for group ${groupId}`);
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
      console.log(`[MatchExplanation] Legacy cache format detected for group ${groupId}, invalidating`);
      return null;
    }
    
    return null;
  } catch (error) {
    console.warn('[MatchExplanation] Error loading cache:', error);
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
    const cache: PairExplanationsCache = {
      memberHash: generateMemberHash(members),
      pairCount: explanations.length,
      generatedAt: new Date().toISOString(),
      explanations,
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
    
    console.log(`[MatchExplanation] Saved ${explanations.length} pair explanations to cache for group ${groupId}`);
  } catch (error) {
    console.warn('[MatchExplanation] Error saving cache:', error);
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
        console.log(`[IceBreakers] Cache invalidated for group ${groupId}: roster changed`);
        return null;
      }
      
      // Validate event type matches
      if (cached.eventType !== eventType) {
        console.log(`[IceBreakers] Cache invalidated for group ${groupId}: event type changed`);
        return null;
      }
      
      // Check if cache is still valid
      const generatedTime = new Date(cached.generatedAt).getTime();
      if (Date.now() - generatedTime > CACHE_EXPIRY_MS) {
        console.log(`[IceBreakers] Cache expired for group ${groupId}`);
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
      console.log(`[IceBreakers] Legacy cache format detected for group ${groupId}, invalidating`);
      return null;
    }
    
    return null;
  } catch (error) {
    console.warn('[IceBreakers] Error loading cache:', error);
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
    
    console.log(`[IceBreakers] Saved ${topics.length} ice breakers to cache for group ${groupId}`);
  } catch (error) {
    console.warn('[IceBreakers] Error saving cache:', error);
  }
}

// ============ 原型中文名映射 ============

const archetypeNames: Record<string, string> = {
  "开心柯基": "开心柯基",
  "太阳鸡": "太阳鸡",
  "夸夸豚": "夸夸豚",
  "机智狐": "机智狐",
  "淡定海豚": "淡定海豚",
  "织网蛛": "织网蛛",
  "暖心熊": "暖心熊",
  "灵感章鱼": "灵感章鱼",
  "沉思猫头鹰": "沉思猫头鹰",
  "定心大象": "定心大象",
  "稳如龟": "稳如龟",
  "隐身猫": "隐身猫",
};

// ============ 辅助函数 ============

/**
 * 获取两个原型之间的化学反应分数
 */
function getChemistryScore(archetype1: string | null, archetype2: string | null): number {
  const a1 = archetype1 || "暖心熊";
  const a2 = archetype2 || "暖心熊";
  return (chemistryMatrix as any)[a1]?.[a2] || 50;
}

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
 * 找出连接点（同乡、同行业等）
 */
function findConnectionPoints(member1: MatchMember, member2: MatchMember): string[] {
  const points: string[] = [];

  if (member1.hometown && member2.hometown && member1.hometown === member2.hometown) {
    points.push(`同乡（${member1.hometown}）`);
  }

  if (member1.industry && member2.industry && member1.industry === member2.industry) {
    points.push(`同行业（${member1.industry}）`);
  }

  // Same education level
  if (member1.educationLevel && member2.educationLevel &&
      member1.educationLevel === member2.educationLevel) {
    points.push(`同学历（${member1.educationLevel}）`);
  }

  // Same relationship status — use shared RELATIONSHIP_MATCH_LABELS for display text
  if (member1.relationshipStatus && member2.relationshipStatus &&
      member1.relationshipStatus === member2.relationshipStatus &&
      member1.relationshipStatus !== "不透露") {
    const label = RELATIONSHIP_MATCH_LABELS[member1.relationshipStatus];
    if (label) {
      points.push(label.text);
    }
  }

  // Same work mode AND same industry category (rare compound)
  // Match on category code; display using the human-readable label
  if (member1.workMode && member2.workMode &&
      member1.workMode === member2.workMode &&
      member1.industryCategory && member2.industryCategory &&
      member1.industryCategory === member2.industryCategory) {
    const displayLabel = member1.industryCategoryLabel || member1.industryCategory;
    points.push(`同在${displayLabel}·${getWorkModeLabel(member1.workMode)}`);
  }

  // Archetype checks
  if (member1.archetype && member2.archetype) {
    if (member1.archetype === member2.archetype) {
      // Exact same archetype (epic)
      points.push(`同款人格（${member1.archetype}）`);
    } else {
      // Complementary archetype (chemistry score > 85)
      const chemScore = getChemistryScore(member1.archetype, member2.archetype);
      if (chemScore > 85) {
        points.push(`性格互补（${member1.archetype}×${member2.archetype}）`);
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
    points.push(`老乡+同行（${member1.hometown}·${displayLabel}）`);
  }

  // Deep interest overlap (≥3 interests at heat level ≥ 2)
  const deepOverlap = findDeepInterestOverlap(
    member1.interestsWithHeat,
    member2.interestsWithHeat,
    2
  );
  if (deepOverlap.count >= 3) {
    points.push(`深度同好（${deepOverlap.count}个共同深度兴趣）`);
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
        points.push(`${sig1.interestLabel}同款聊法（${formatDiscussionStyle(sig1.discussionStyle)}）`);
      } else if (Math.abs(sig1.conversationDepth - sig2.conversationDepth) <= 1) {
        points.push(`${sig1.interestLabel}话题深度相近`);
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
  const chemistryScore = getChemistryScore(member1.archetype, member2.archetype);
  const sharedInterests = findSharedInterests(member1.interestsTop, member2.interestsTop);
  const connectionPoints = findConnectionPoints(member1, member2);
  
  // 构建提示词
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

请用中文回复，语气温暖友好，突出他们可能的互补或共鸣点。不要使用"用户A/B"的称呼，直接用描述性语言。回复长度控制在50-80字。`;

  const { client, model, provider } = getClientForFunction('generatePairExplanation');
  const t0 = Date.now();
  try {
    const response = await withRetry(async () => {
      return client.chat.completions.create({
        model,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });
    });
    const latencyMs = Date.now() - t0;
    console.log(`[MatchExplanation] generatePairExplanation provider=${provider} latency=${latencyMs}ms`);
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
    
    const explanation = response.choices[0]?.message?.content?.trim() || 
      `这两位都是有趣的人，期待你们在活动中发现彼此的闪光点！`;
    
    return {
      explanation: {
        pairKey: getPairKey(member1.userId, member2.userId),
        explanation,
        chemistryScore,
        sharedInterests,
        connectionPoints,
      },
      providerUsed: provider,
      fallbackUsed: false,
      promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
    };
  } catch (primaryError) {
    if (provider === 'minimax') {
      console.warn(`[MatchExplanation] generatePairExplanation minimax failed after retries, trying deepseek fallback:`, primaryError);
      const { client: fbClient, model: fbModel } = getDeepseekSelection();
      try {
        // Single attempt only — the primary path already exhausted its retries
        const fbResponse = await fbClient.chat.completions.create({
          model: fbModel,
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 200,
          temperature: 0.7,
        });
        const latencyMs = Date.now() - t0;
        console.log(`[MatchExplanation] generatePairExplanation provider=deepseek (fallback) latency=${latencyMs}ms`);
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
        const explanation = fbResponse.choices[0]?.message?.content?.trim() ||
          `这两位都是有趣的人，期待你们在活动中发现彼此的闪光点！`;
        return {
          explanation: {
            pairKey: getPairKey(member1.userId, member2.userId),
            explanation,
            chemistryScore,
            sharedInterests,
            connectionPoints,
          },
          providerUsed: 'deepseek',
          fallbackUsed: true,
          promptVersion: PAIR_EXPLANATION_PROMPT_VERSION,
        };
      } catch (fallbackError) {
        console.error('[MatchExplanation] Error generating explanation after deepseek fallback:', fallbackError);
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
      console.error('[MatchExplanation] Error generating explanation after retries:', primaryError);
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
    return {
      explanation: {
        pairKey: getPairKey(member1.userId, member2.userId),
        explanation: generateFallbackExplanation(member1, member2, chemistryScore),
        chemistryScore,
        sharedInterests,
        connectionPoints,
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
function generateFallbackExplanation(
  member1: MatchMember,
  member2: MatchMember,
  chemistryScore: number
): string {
  if (chemistryScore >= 85) {
    return `这两位的性格特质非常互补，预计会擦出精彩的火花！`;
  } else if (chemistryScore >= 70) {
    return `两位都是社交能量满满的人，相信会有很多话题可以聊。`;
  } else if (chemistryScore >= 55) {
    return `虽然风格不同，但这正是发现新朋友的好机会！`;
  }
  return `每一次相遇都是缘分，期待你们发现彼此的独特之处。`;
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
  
  // Try to load from cache first (with roster validation)
  if (useCache) {
    // Parallelize cache loading for better performance
    const [cachedExplanations, cachedIceBreakers] = await Promise.all([
      loadCachedPairExplanations(groupId, members),
      loadCachedIceBreakers(groupId, members, eventType)
    ]);
    
    if (cachedExplanations && cachedIceBreakers) {
      console.log(`[MatchExplanation] Using cached data for group ${groupId}`);
      pairExplanations = cachedExplanations.explanations;
      cacheGeneratedAt = cachedExplanations.generatedAt;
      iceBreakers = cachedIceBreakers.topics;
      fromCache = true;
      provider = mergeProviders(cachedExplanations.provider, cachedIceBreakers.provider);
      fallbackUsed = cachedExplanations.fallbackUsed || cachedIceBreakers.fallbackUsed;
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
      
      // Save to cache with roster metadata (fire and forget with error handling)
      savePairExplanationsCache(groupId, members, pairExplanations, {
        provider: pairExplanationResult.providerUsed,
        fallbackUsed: pairExplanationResult.fallbackUsed,
        promptVersion: pairExplanationResult.promptVersion,
      }).catch((err) => {
        console.error('[MatchExplanation] Failed to save pair explanations cache:', err);
      });
      saveIceBreakersCache(groupId, members, eventType, iceBreakers, {
        provider: iceBreakerResult.providerUsed,
        fallbackUsed: iceBreakerResult.fallbackUsed,
        promptVersion: iceBreakerResult.promptVersion,
      }).catch((err) => {
        console.error('[MatchExplanation] Failed to save ice breakers cache:', err);
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
  }

  logAITrace({
    domain: 'match_explanation',
    feature: 'generateGroupAnalysis',
    provider,
    latencyMs: Date.now() - startedAt,
    success: true,
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

  return {
    groupId,
    overallChemistry,
    groupDynamics,
    pairExplanations,
    iceBreakers,
    groupThemeTags,
    groupThemeCompanion,
    fromCache,
    // On cache hit, use the original generation timestamp so clients can tell when data was last refreshed
    generatedAt: fromCache && cacheGeneratedAt ? cacheGeneratedAt : new Date().toISOString(),
    provider,
    fallbackUsed,
    promptVersion,
  };
}

// ============ 主题标签生成 ============

/** Archetype clusters used for theme tag derivation */
const ENERGETIC_ARCHETYPES = new Set(['开心柯基', '太阳鸡', '夸夸豚']);
const ANALYTICAL_ARCHETYPES = new Set(['机智狐', '沉思猫头鹰', '灵感章鱼']);
const WARM_ARCHETYPES = new Set(['暖心熊', '定心大象']);
const QUIET_ARCHETYPES = new Set(['稳如龟', '隐身猫']);

type GroupThemeBucket = 'exploration' | 'food' | 'music' | 'culture' | null;

function normalizeInterestForTheme(interest: string): string {
  return getInterestById(interest)?.label ?? interest;
}

function getInterestThemeBucket(interest: string): GroupThemeBucket {
  const normalized = normalizeInterestForTheme(interest);

  if (
    ['旅游', '旅行', '户外', '徒步', '露营', 'CityWalk', '城市漫步', '海边帆船'].includes(normalized)
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
    ['开心柯基', '太阳鸡', '夸夸豚'].includes(a as string)
  );
  const hasListeners = archetypes.some(a => 
    ['暖心熊', '沉思猫头鹰', '隐身猫'].includes(a as string)
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
    console.log(`[IceBreakers] generateIceBreakers provider=${provider} latency=${latencyMs}ms`);
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
      return {
        iceBreakers,
        providerUsed: provider,
        fallbackUsed: false,
        promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
      };
    }
  } catch (primaryError) {
    if (provider === 'minimax') {
      console.warn(`[IceBreakers] generateIceBreakers minimax failed after retries, trying deepseek fallback:`, primaryError);
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
        console.log(`[IceBreakers] generateIceBreakers provider=deepseek (fallback) latency=${latencyMs}ms`);
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
          return {
            iceBreakers,
            providerUsed: 'deepseek',
            fallbackUsed: true,
            promptVersion: GROUP_ICEBREAKERS_PROMPT_VERSION,
          };
        }
      } catch (fallbackError) {
        console.error('[IceBreakers] Error generating ice-breakers after deepseek fallback:', fallbackError);
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
      console.error('[IceBreakers] Error generating ice-breakers after retries:', primaryError);
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
  getChemistryScore,
  findSharedInterests,
  findConnectionPoints,
  getPairExplanationForUser,
};
