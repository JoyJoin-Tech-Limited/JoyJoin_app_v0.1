/**
 * Match Explanation Service (桌友分析生成服务)
 * 
 * 使用 DeepSeek API 生成个性化的匹配解释，说明为什么这些用户被匹配在一起。
 * 用于活动详情页的"桌友分析"部分。
 * 
 * 特性：
 * - 配对解释缓存（存储在 eventPoolGroups.pairExplanationsCache）
 * - 破冰话题缓存（存储在 eventPoolGroups.iceBreakersCache）
 * - 并发限制（最多3个并发API调用）
 * - 指数退避重试（最多2次重试）
 */

import OpenAI from 'openai';
import { chemistryMatrix } from './archetypeChemistry';
import { db } from './db';
import { eventPoolGroups } from '@shared/schema';
import { eq } from 'drizzle-orm';

// Configure DeepSeek client with 10-second timeout
const deepseekClient = new OpenAI({
  apiKey: process.env.DEEPSEEK_API_KEY,
  baseURL: 'https://api.deepseek.com',
  timeout: 10000, // 10 second timeout
  maxRetries: 0, // We handle retries manually
});

// ============ 配置常量 ============

const API_CONFIG = {
  MAX_RETRIES: 2,
  RETRY_DELAY_MS: 1000,
  CONCURRENCY_LIMIT: 3, // Max concurrent API calls
};

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
  industry?: string | null;
  hometown?: string | null;
  socialStyle?: string | null;
}

export interface MatchExplanation {
  pairKey: string; // "userId1-userId2" 排序后的组合
  explanation: string; // 2-3句话的匹配解释
  chemistryScore: number; // 化学反应分数
  sharedInterests: string[]; // 共同兴趣
  connectionPoints: string[]; // 连接点（同乡、同行业等）
}

export interface GroupAnalysis {
  groupId: string;
  overallChemistry: string; // fire/warm/mild/cold
  groupDynamics: string; // 整体动态描述
  pairExplanations: MatchExplanation[]; // 两两配对解释
  iceBreakers: string[]; // 推荐破冰话题
}

// ============ 缓存类型 ============

interface PairExplanationsCache {
  memberHash: string; // Hash of sorted member IDs for validation
  pairCount: number;
  generatedAt: string;
  explanations: MatchExplanation[];
}

interface IceBreakersCache {
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

// ============ 缓存函数 ============

/**
 * 从数据库加载缓存的配对解释（带roster验证）
 */
async function loadCachedPairExplanations(
  groupId: string,
  members: MatchMember[]
): Promise<MatchExplanation[] | null> {
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
      
      return cached.explanations;
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
  explanations: MatchExplanation[]
): Promise<void> {
  try {
    const cache: PairExplanationsCache = {
      memberHash: generateMemberHash(members),
      pairCount: explanations.length,
      generatedAt: new Date().toISOString(),
      explanations,
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
): Promise<string[] | null> {
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
      
      return cached.topics;
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
  topics: string[]
): Promise<void> {
  try {
    const cache: IceBreakersCache = {
      memberHash: generateMemberHash(members),
      eventType,
      generatedAt: new Date().toISOString(),
      topics,
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
 * 为一对用户生成匹配解释
 */
export async function generatePairExplanation(
  member1: MatchMember,
  member2: MatchMember
): Promise<MatchExplanation> {
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

  try {
    const response = await withRetry(async () => {
      return deepseekClient.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 200,
        temperature: 0.7,
      });
    });
    
    const explanation = response.choices[0]?.message?.content?.trim() || 
      `这两位都是有趣的人，期待你们在活动中发现彼此的闪光点！`;
    
    return {
      pairKey: getPairKey(member1.userId, member2.userId),
      explanation,
      chemistryScore,
      sharedInterests,
      connectionPoints,
    };
  } catch (error) {
    console.error('[MatchExplanation] Error generating explanation after retries:', error);
    // 降级处理：返回基于化学反应分数的模板解释
    return {
      pairKey: getPairKey(member1.userId, member2.userId),
      explanation: generateFallbackExplanation(member1, member2, chemistryScore),
      chemistryScore,
      sharedInterests,
      connectionPoints,
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
 * 生成所有配对的解释（不使用缓存）
 */
async function generateFreshPairExplanations(members: MatchMember[]): Promise<MatchExplanation[]> {
  const pairs: Array<{ member1: MatchMember; member2: MatchMember }> = [];
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      pairs.push({ member1: members[i], member2: members[j] });
    }
  }
  
  return runWithConcurrencyLimit(
    pairs,
    async (pair) => generatePairExplanation(pair.member1, pair.member2),
    API_CONFIG.CONCURRENCY_LIMIT
  );
}

/**
 * 为整个小组生成分析报告
 */
export async function generateGroupAnalysis(
  groupId: string,
  members: MatchMember[],
  eventType: string = "饭局",
  useCache: boolean = true
): Promise<GroupAnalysis> {
  let pairExplanations: MatchExplanation[] = [];
  let iceBreakers: string[] = [];
  
  // Try to load from cache first (with roster validation)
  if (useCache) {
    const cachedExplanations = await loadCachedPairExplanations(groupId, members);
    const cachedIceBreakers = await loadCachedIceBreakers(groupId, members, eventType);
    
    if (cachedExplanations && cachedIceBreakers) {
      console.log(`[MatchExplanation] Using cached data for group ${groupId}`);
      pairExplanations = cachedExplanations;
      iceBreakers = cachedIceBreakers;
    } else {
      // Cache miss, expired, or roster changed - regenerate
      pairExplanations = await generateFreshPairExplanations(members);
      iceBreakers = await generateIceBreakers(members, eventType);
      
      // Save to cache with roster metadata (fire and forget with error handling)
      savePairExplanationsCache(groupId, members, pairExplanations).catch((err) => {
        console.error('[MatchExplanation] Failed to save pair explanations cache:', err);
      });
      saveIceBreakersCache(groupId, members, eventType, iceBreakers).catch((err) => {
        console.error('[MatchExplanation] Failed to save ice breakers cache:', err);
      });
    }
  } else {
    // No cache requested - generate fresh
    pairExplanations = await generateFreshPairExplanations(members);
    iceBreakers = await generateIceBreakers(members, eventType);
  }
  
  // 计算整体化学反应
  const totalChemistry = pairExplanations.reduce((sum, exp) => sum + exp.chemistryScore, 0);
  const pairCount = pairExplanations.length;
  const avgChemistry = pairCount > 0 ? totalChemistry / pairCount : 50;
  
  // 确定化学反应等级
  let overallChemistry: string;
  if (avgChemistry >= 85) overallChemistry = 'fire';
  else if (avgChemistry >= 70) overallChemistry = 'warm';
  else if (avgChemistry >= 55) overallChemistry = 'mild';
  else overallChemistry = 'cold';
  
  // 生成小组动态描述
  const groupDynamics = generateGroupDynamics(members, avgChemistry, eventType);
  
  return {
    groupId,
    overallChemistry,
    groupDynamics,
    pairExplanations,
    iceBreakers,
  };
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
 */
export async function generateIceBreakers(
  members: MatchMember[],
  eventType: string = "饭局"
): Promise<string[]> {
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
  
  const prompt = `你是一个社交活动的破冰专家。请为这个${eventType}小组生成3-5个有趣的破冰话题。

小组成员原型: ${archetypes.join('、') || '多样化组合'}
${commonInterests.length > 0 ? `共同兴趣: ${commonInterests.join('、')}` : ''}
活动类型: ${eventType}

要求:
1. 话题要轻松有趣，适合初次见面
2. 避免敏感话题（政治、宗教、催婚催生）
3. 鼓励每个人都能参与
4. 可以结合共同兴趣或原型特点
5. 用中文回复，每个话题一行

请直接列出话题，不要加序号或前缀。`;

  try {
    const response = await withRetry(async () => {
      return deepseekClient.chat.completions.create({
        model: 'deepseek-chat',
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 300,
        temperature: 0.8,
      });
    });
    
    const content = response.choices[0]?.message?.content?.trim() || '';
    const iceBreakers = content
      .split('\n')
      .map(line => line.trim())
      .filter(line => line.length > 5 && line.length < 100)
      .slice(0, 5);
    
    if (iceBreakers.length >= 2) { // Lowered threshold from 3 to 2
      return iceBreakers;
    }
  } catch (error) {
    console.error('[IceBreakers] Error generating ice-breakers after retries:', error);
  }
  
  // 降级：返回预设话题
  return getFallbackIceBreakers(eventType, commonInterests);
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

// ============ 导出 ============

export const matchExplanationService = {
  generatePairExplanation,
  generateGroupAnalysis,
  generateIceBreakers,
  getChemistryScore,
  findSharedInterests,
  findConnectionPoints,
};
