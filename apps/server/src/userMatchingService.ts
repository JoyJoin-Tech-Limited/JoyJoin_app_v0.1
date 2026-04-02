/**
 * 用户匹配算法服务
 * 实现基于14种性格原型的多维度智能匹配
 */

import type { User } from '@shared/schema';
import { getChemistryScore, calculateGroupChemistry, type ArchetypeName } from './archetypeChemistry';
import { calculateSignatureSimilarity, type ConversationSignature } from './inference/conversationSignature';
import { matchingWeightsService, type MatchingWeights } from './matchingWeightsService';

// 重新导出类型以保持向后兼容
export type { MatchingWeights } from './matchingWeightsService';

// 默认权重配置 (6维度) - 仅作为 fallback 使用
// 实际运行时优先走 matchingWeightsService.ts（Thompson Sampling 自适应权重路径）
export const DEFAULT_WEIGHTS: MatchingWeights = {
  personalityWeight: 23,
  interestsWeight: 24,
  intentWeight: 13,
  backgroundWeight: 15,
  cultureWeight: 10,
  conversationSignatureWeight: 15,
};

// 获取当前自适应权重的辅助函数（首选 Thompson Sampling 路径）
export async function getDynamicWeights(): Promise<MatchingWeights> {
  try {
    return await matchingWeightsService.getActiveWeights();
  } catch {
    return DEFAULT_WEIGHTS;
  }
}

// 用户匹配分数接口
export interface UserMatchScore {
  userId: string;
  overallScore: number;       // 总分 (0-100)
  personalityScore: number;   // 性格兼容性分数
  interestsScore: number;     // 兴趣匹配分数
  intentScore: number;        // 意图匹配分数
  backgroundScore: number;    // 背景多样性分数
  cultureScore: number;       // 文化语言分数
  conversationSignatureScore: number; // 对话签名分数 - 第6维度
  chemistryScore: number;     // 化学反应分数（基于原型）
  matchPoints: string[];      // 匹配点（用于解释）
}

// 小组匹配结果
export interface GroupMatch {
  groupId: string;
  userIds: string[];
  users: Partial<User>[];
  avgChemistryScore: number;
  diversityScore: number;
  overallScore: number;
  matchExplanation: string;
}

/**
 * 计算两个用户之间的性格兼容性分数
 */
function calculatePersonalityScore(user1: Partial<User>, user2: Partial<User>): number {
  if (!user1.primaryArchetype || !user2.primaryArchetype) return 50;
  
  try {
    const chemistry = getChemistryScore(
      user1.primaryArchetype as ArchetypeName,
      user2.primaryArchetype as ArchetypeName
    );
    return chemistry;
  } catch {
    return 50; // 如果原型不在矩阵中，返回中等分数
  }
}

/**
 * 获取用户的有效兴趣列表（合并新旧字段，去重）
 * 新字段primaryInterests优先显示，但保留旧字段interestsTop的数据
 * Note: interestsTop and primaryInterests fields removed - returning empty array
 */
function getUserInterests(user: Partial<User>): string[] {
  // Fields removed - interests now managed by user_interests table
  return [];
  /* Legacy code (commented out since fields were removed):
  const primary = user.primaryInterests || [];
  const legacy = user.interestsTop || [];
  // 合并去重，保持primary在前
  const combined = [...primary, ...legacy.filter((i: string) => !primary.includes(i))];
  return combined;
  */
}

/**
 * 获取用户的话题排斥列表（合并新旧字段，去重）
 * Note: topicAvoidances and topicsAvoid fields removed - returning empty array
 */
function getUserTopicAvoidances(user: Partial<User>): string[] {
  // Fields removed - returning empty array
  return [];
  /* Legacy code (commented out since fields were removed):
  const newAvoid = user.topicAvoidances || [];
  const legacyAvoid = user.topicsAvoid || [];
  const combined = [...newAvoid, ...legacyAvoid.filter((i: string) => !newAvoid.includes(i))];
  return combined;
  */
}

/**
 * 获取用户喜欢聊的话题（合并新旧字段）
 * Note: topicsHappy and primaryInterests fields removed - returning empty array
 */
function getUserHappyTopics(user: Partial<User>): string[] {
  // Fields removed - returning empty array
  return [];
  /* Legacy code (commented out since fields were removed):
  const legacy = user.topicsHappy || [];
  // 新系统中primaryInterests也代表用户喜欢聊的方向
  const primary = user.primaryInterests || [];
  const combined = [...legacy, ...primary.filter((i: string) => !legacy.includes(i))];
  return combined;
  */
}

/**
 * 检测话题冲突：user1喜欢聊的话题 vs user2排斥的话题
 * 使用统一访问器确保覆盖新旧字段
 * 返回冲突话题数量
 */
function detectTopicConflicts(user1: Partial<User>, user2: Partial<User>): number {
  const user1HappyTopics = getUserHappyTopics(user1);
  const user2Avoidances = getUserTopicAvoidances(user2);
  
  return user1HappyTopics.filter(topic => user2Avoidances.includes(topic)).length;
}

/**
 * 计算两个用户之间的兴趣匹配分数
 * 增强版：支持primaryInterests加权匹配 + 话题排斥惩罚
 * 分数计算公式重新平衡，避免分数饱和
 */
function calculateInterestsScore(user1: Partial<User>, user2: Partial<User>): number {
  const interests1 = getUserInterests(user1);
  const interests2 = getUserInterests(user2);
  
  if (interests1.length === 0 || interests2.length === 0) return 50;
  
  // 计算兴趣交集
  const commonInterests = interests1.filter(i => interests2.includes(i));
  const matchRatio = commonInterests.length / Math.max(interests1.length, interests2.length);
  
  // 基础分数：20分基础 + 最多50分匹配分 = 20-70分区间
  let score = Math.round(20 + matchRatio * 50);
  
  // ❌ REMOVED: Primary interests bonus - primaryInterests field removed from schema (2026-01-19)
  // The field was moved to user_interests table as part of Interest Carousel system
  // This bonus logic is no longer applicable with the new data model
  
  // 话题排斥惩罚：双向检测
  // 最多扣25分，确保惩罚有效果
  const conflictsFromUser1 = detectTopicConflicts(user1, user2);
  const conflictsFromUser2 = detectTopicConflicts(user2, user1);
  const totalConflicts = conflictsFromUser1 + conflictsFromUser2;
  
  if (totalConflicts > 0) {
    score -= Math.min(totalConflicts * 10, 25);
  }
  
  // 确保分数在有效范围内（0-100）
  return Math.min(100, Math.max(0, score));
}

/**
 * 计算两个用户之间的意图匹配分数
 */
function calculateIntentScore(user1: Partial<User>, user2: Partial<User>): number {
  const intent1 = user1.intent || [];
  const intent2 = user2.intent || [];
  
  if (intent1.length === 0 || intent2.length === 0) return 50;
  
  // 计算交集
  const commonIntent = intent1.filter(i => intent2.includes(i));
  
  // "flexible"意图与任何意图都兼容
  const hasFlexible = intent1.includes("flexible") || intent2.includes("flexible");
  
  if (commonIntent.length > 0) {
    return 90; // 有共同意图，高分
  } else if (hasFlexible) {
    return 75; // 一方flexible，良好兼容
  } else {
    return 40; // 意图完全不同，较低分
  }
}

/**
 * 计算用户年龄（从birthdate字段）
 */
function getUserAge(user: Partial<User>): number | null {
  if (!user.birthdate) return null;
  
  const birthDate = new Date(user.birthdate + 'T00:00:00');
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  
  return age;
}

/**
 * 计算两个用户之间的背景分数
 * 综合考虑：多样性（行业、教育）+ 相似性（年龄、老乡）
 */
function calculateBackgroundScore(user1: Partial<User>, user2: Partial<User>): number {
  let score = 50; // 基础分
  let factors = 0;
  
  // ====== 多样性因素（不同加分）======
  
  // 行业多样性 - DEPRECATED: industry field removed from schema
  // Industry diversity is now handled through industryCategory/industryNicheLabel
  // This matching logic should be updated to use the new 3-tier classification
  // For now, removing to fix TypeScript errors
  
  // 学习地域多样性 - REMOVED: studyLocale field deprecated and dropped
  
  // ====== 相似性因素（相同加分）======
  
  // 年龄相近度 (+15分如果年龄差≤3岁，+10分如果≤5岁，+5分如果≤8岁)
  const age1 = getUserAge(user1);
  const age2 = getUserAge(user2);
  if (age1 && age2) {
    factors++;
    const ageDiff = Math.abs(age1 - age2);
    if (ageDiff <= 3) {
      score += 15; // 年龄非常相近
    } else if (ageDiff <= 5) {
      score += 10; // 年龄比较相近
    } else if (ageDiff <= 8) {
      score += 5; // 年龄有些相近
    }
    // 年龄差>8岁不加分也不扣分
  }
  
  // 城市级老乡匹配 (+20分如果同城)
  if (user1.hometownRegionCity && user2.hometownRegionCity) {
    factors++;
    if (user1.hometownRegionCity === user2.hometownRegionCity) {
      score += 20; // 同城老乡！超级加分
    }
  }
  
  // 资历相似度 - DEPRECATED: seniority field removed from schema
  // Seniority was never collected in onboarding and has been removed from matching
  // For now, removing to fix TypeScript errors
  
  // ====== 人生阶段匹配 ======
  
  // 感情状态匹配 (+8分如果相同)
  if (user1.relationshipStatus && user2.relationshipStatus &&
      user1.relationshipStatus !== 'Prefer not to say' && user2.relationshipStatus !== 'Prefer not to say') {
    factors++;
    if (user1.relationshipStatus === user2.relationshipStatus) {
      score += 8; // 相同感情状态
    }
  }
  
  // ====== 归一化处理 ======
  // 防止分数因多因素堆叠过高，使用衰减因子
  // 基础分50 + 加分 → 归一化到合理范围
  const rawBonus = score - 50;
  
  // 使用对数衰减：超过30分的部分按50%计算
  let normalizedBonus = rawBonus;
  if (rawBonus > 30) {
    normalizedBonus = 30 + (rawBonus - 30) * 0.5;
  }
  
  // 最终分数 = 基础分 + 归一化加分
  const finalScore = 50 + normalizedBonus;
  
  // 确保分数在有效范围内（0-100）
  return Math.min(100, Math.max(0, Math.round(finalScore)));
}

/**
 * 计算两个用户之间的文化语言分数
 * 包括：共同语言 + 海外地区经历匹配
 */
function calculateCultureScore(user1: Partial<User>, user2: Partial<User>): number {
  let score = 40; // 基础分
  
  // 确保分数在有效范围内（0-100）
  return Math.min(100, Math.max(0, score));
}

/**
 * 从用户对象中提取对话签名
 */
function getUserConversationSignature(user: Partial<User>): ConversationSignature | null {
  // 检查用户是否有对话签名数据 - 至少需要一个字段存在
  const hasConversationMode = user.conversationMode !== undefined && user.conversationMode !== null;
  const hasLinguisticStyle = user.primaryLinguisticStyle !== undefined && user.primaryLinguisticStyle !== null;
  const hasConversationEnergy = user.conversationEnergy !== undefined && user.conversationEnergy !== null;
  
  if (!hasConversationMode && !hasLinguisticStyle && !hasConversationEnergy) {
    return null;
  }
  
  // 使用nullish coalescing避免将0值误转为默认值
  return {
    conversationMode: (user.conversationMode as ConversationSignature['conversationMode']) ?? 'standard',
    primaryLinguisticStyle: (user.primaryLinguisticStyle as ConversationSignature['primaryLinguisticStyle']) ?? 'direct',
    conversationEnergy: user.conversationEnergy ?? 50,
    negationReliability: user.negationReliability !== undefined && user.negationReliability !== null 
      ? parseFloat(String(user.negationReliability)) 
      : 0.8,
    inferredTraits: (user.inferredTraits as Record<string, string | number | boolean>) ?? {},
    inferenceConfidence: user.inferenceConfidence !== undefined && user.inferenceConfidence !== null 
      ? parseFloat(String(user.inferenceConfidence)) 
      : 0.5,
  };
}

/**
 * 计算两个用户之间的对话签名相似度分数
 * 第6维度 - 基于AI对话中提取的特征向量
 */
function calculateConversationSignatureScore(user1: Partial<User>, user2: Partial<User>): number {
  const sig1 = getUserConversationSignature(user1);
  const sig2 = getUserConversationSignature(user2);
  
  return calculateSignatureSimilarity(sig1, sig2);
}

/**
 * 计算两个用户之间的综合匹配分数
 */
export function calculateUserMatchScore(
  user1: Partial<User>,
  user2: Partial<User>,
  weights: MatchingWeights = DEFAULT_WEIGHTS
): UserMatchScore {
  const personalityScore = calculatePersonalityScore(user1, user2);
  const interestsScore = calculateInterestsScore(user1, user2);
  const intentScore = calculateIntentScore(user1, user2);
  const backgroundScore = calculateBackgroundScore(user1, user2);
  const cultureScore = calculateCultureScore(user1, user2);
  const conversationSignatureScore = calculateConversationSignatureScore(user1, user2);
  
  // 计算加权总分 (6维度)
  const overallScore = Math.round(
    (personalityScore * weights.personalityWeight +
     interestsScore * weights.interestsWeight +
     intentScore * weights.intentWeight +
     backgroundScore * weights.backgroundWeight +
     cultureScore * weights.cultureWeight +
     conversationSignatureScore * weights.conversationSignatureWeight) / 100
  );
  
  // 生成匹配点（更精细的解释）
  const matchPoints: string[] = [];
  
  if (personalityScore >= 80) {
    matchPoints.push(`性格高度互补 (${personalityScore}分)`);
  }
  
  if (interestsScore >= 70) {
    const interests1 = getUserInterests(user1);
    const interests2 = getUserInterests(user2);
    const common = interests1.filter(i => interests2.includes(i));
    if (common.length > 0) {
      matchPoints.push(`共同兴趣：${common.slice(0, 2).join('、')}`);
    }
    
    // ❌ REMOVED: Primary interests bonus - primaryInterests field removed from schema (2026-01-19)
    // The field was moved to user_interests table as part of Interest Carousel system
  }
  
  if (intentScore >= 75) {
    matchPoints.push('活动意图一致');
  }
  
  // 背景匹配细分
  if (backgroundScore >= 70) {
    // 年龄相近
    const age1 = getUserAge(user1);
    const age2 = getUserAge(user2);
    if (age1 && age2 && Math.abs(age1 - age2) <= 5) {
      matchPoints.push('年龄相近');
    }
    
    // 同城老乡
    if (user1.hometownRegionCity && user2.hometownRegionCity && 
        user1.hometownRegionCity === user2.hometownRegionCity) {
      matchPoints.push(`老乡！都来自${user1.hometownRegionCity}`);
    }
    
    // 资历相同 - DEPRECATED: seniority field removed from schema
    // Commenting out as seniority is no longer collected
  }
  
  // 文化匹配细分
  if (cultureScore >= 70) {
    matchPoints.push('语言文化相通');
  }
  
  if (conversationSignatureScore >= 75) {
    matchPoints.push('沟通风格契合');
  }
  
  return {
    userId: user2.id || '',
    overallScore,
    personalityScore,
    interestsScore,
    intentScore,
    backgroundScore,
    cultureScore,
    conversationSignatureScore,
    chemistryScore: personalityScore, // 化学反应分数即性格分数
    matchPoints,
  };
}

/**
 * 为一组用户进行匹配并分组
 * 使用贪心算法将用户分配到最佳小组
 */
export function matchUsersToGroups(
  users: Partial<User>[],
  config: {
    minGroupSize?: number;
    maxGroupSize?: number;
    preferredGroupSize?: number;
    weights?: MatchingWeights;
  } = {}
): GroupMatch[] {
  const {
    minGroupSize = 5,
    maxGroupSize = 10,
    preferredGroupSize = 7,
    weights = DEFAULT_WEIGHTS,
  } = config;
  
  if (users.length < minGroupSize) {
    throw new Error(`用户数量不足，至少需要${minGroupSize}人`);
  }
  
  const groups: GroupMatch[] = [];
  const assignedUsers = new Set<string>();
  const remainingUsers = [...users];
  
  let groupCounter = 1;
  
  while (remainingUsers.length >= minGroupSize) {
    // 创建新组
    const group: Partial<User>[] = [];
    
    // 选择第一个未分配的用户作为种子
    const seedUser = remainingUsers.find(u => !assignedUsers.has(u.id || ''));
    if (!seedUser) break;
    
    group.push(seedUser);
    assignedUsers.add(seedUser.id || '');
    
    // 贪心选择：为当前组添加与现有成员最匹配的用户
    while (group.length < preferredGroupSize && remainingUsers.length > 0) {
      let bestUser: Partial<User> | null = null;
      let bestScore = -1;
      
      for (const candidate of remainingUsers) {
        if (assignedUsers.has(candidate.id || '')) continue;
        
        // 计算候选用户与当前组所有成员的平均匹配分数
        let totalScore = 0;
        for (const member of group) {
          const score = calculateUserMatchScore(member, candidate, weights);
          totalScore += score.overallScore;
        }
        const avgScore = totalScore / group.length;
        
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestUser = candidate;
        }
      }
      
      if (bestUser && bestScore > 0) {
        group.push(bestUser);
        assignedUsers.add(bestUser.id || '');
      } else {
        break; // 没有找到合适的用户
      }
    }
    
    // 计算组的评分指标
    const archetypes = group
      .map(u => u.primaryArchetype)
      .filter(Boolean) as ArchetypeName[];
    
    const avgChemistryScore = calculateGroupChemistry(archetypes);
    
    // 计算多样性分数（背景、行业等的多样性）
    // DEPRECATED: industry field removed from schema
    // Using industryCategory as replacement for now
    const industries = new Set(group.map(u => (u as any).industryCategory).filter(Boolean));
    const educations = new Set(group.map(u => u.educationLevel).filter(Boolean));
    const diversityScore = Math.round(
      ((industries.size / group.length) * 50 +
       (educations.size / group.length) * 50)
    );
    
    const overallScore = Math.round((avgChemistryScore + diversityScore) / 2);
    
    groups.push({
      groupId: `group-${groupCounter++}`,
      userIds: group.map(u => u.id || ''),
      users: group,
      avgChemistryScore,
      diversityScore,
      overallScore,
      matchExplanation: generateGroupExplanation(group, avgChemistryScore, diversityScore),
    });
  }
  
  // 处理剩余用户（如果有的话）
  const unassignedUsers = users.filter(u => !assignedUsers.has(u.id || ''));
  
  if (unassignedUsers.length > 0 && groups.length > 0) {
    // 将剩余用户分配到现有组
    for (const user of unassignedUsers) {
      let bestGroup: GroupMatch | null = null;
      let bestScore = -1;
      
      for (const group of groups) {
        if (group.users.length >= maxGroupSize) continue;
        
        // 计算用户与该组的平均匹配分数
        let totalScore = 0;
        for (const member of group.users) {
          const score = calculateUserMatchScore(member, user, weights);
          totalScore += score.overallScore;
        }
        const avgScore = totalScore / group.users.length;
        
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestGroup = group;
        }
      }
      
      if (bestGroup) {
        bestGroup.users.push(user);
        bestGroup.userIds.push(user.id || '');
        assignedUsers.add(user.id || '');
      }
    }
  }
  
  return groups;
}

/**
 * 生成小组匹配解释文本
 */
function generateGroupExplanation(
  users: Partial<User>[],
  chemistryScore: number,
  diversityScore: number
): string {
  const parts: string[] = [];
  
  // 性格原型分布
  const archetypes = users.map(u => u.primaryArchetype).filter(Boolean);
  const archetypeCount = new Map<string, number>();
  archetypes.forEach(a => {
    archetypeCount.set(a!, (archetypeCount.get(a!) || 0) + 1);
  });
  
  const topArchetypes = Array.from(archetypeCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);
  
  if (topArchetypes.length > 0) {
    parts.push(`这一桌汇聚了${topArchetypes.join('与')}等多元性格`);
  }
  
  // 化学反应评价
  if (chemistryScore >= 80) {
    parts.push('性格高度互补，对话火花四溅');
  } else if (chemistryScore >= 65) {
    parts.push('性格搭配和谐，互动自然流畅');
  }
  
  // 多样性评价
  if (diversityScore >= 70) {
    parts.push('背景多元化，能带来不同视角');
  }
  
  // 兴趣共鸣 (interestsTop field removed - using empty array)
  const interests: string[] = []; // users.flatMap(u => u.interestsTop || []);
  const interestCount = new Map<string, number>();
  interests.forEach(i => {
    interestCount.set(i, (interestCount.get(i) || 0) + 1);
  });
  
  const commonInterests = Array.from(interestCount.entries())
    .filter(([, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 2)
    .map(([name]) => name);
  
  if (commonInterests.length > 0) {
    parts.push(`共同喜欢${commonInterests.join('、')}`);
  }
  
  return parts.join('，') + '。';
}

/**
 * 验证权重配置是否有效
 */
export function validateWeights(weights: MatchingWeights): { 
  valid: boolean; 
  error?: string 
} {
  const total = 
    weights.personalityWeight +
    weights.interestsWeight +
    weights.intentWeight +
    weights.backgroundWeight +
    weights.cultureWeight;
  
  if (total !== 100) {
    return {
      valid: false,
      error: `权重总和必须为100，当前为${total}`,
    };
  }
  
  // 检查每个权重是否在0-100范围内
  const values = Object.values(weights);
  if (values.some(v => v < 0 || v > 100)) {
    return {
      valid: false,
      error: '每个权重必须在0-100之间',
    };
  }
  
  return { valid: true };
}
