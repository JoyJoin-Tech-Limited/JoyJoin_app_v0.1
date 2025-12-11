/**
 * 用户匹配算法服务
 * 实现基于14种性格原型的多维度智能匹配
 */

import type { User } from '@shared/schema';
import { getChemistryScore, calculateGroupChemistry, type ArchetypeName } from './archetypeChemistry';

// 匹配配置接口
export interface MatchingWeights {
  personalityWeight: number;   // 性格兼容性权重 (0-100)
  interestsWeight: number;      // 兴趣匹配权重 (0-100)
  intentWeight: number;         // 意图匹配权重 (0-100)
  backgroundWeight: number;     // 背景多样性权重 (0-100)
  cultureWeight: number;        // 文化语言权重 (0-100)
}

// 默认权重配置
export const DEFAULT_WEIGHTS: MatchingWeights = {
  personalityWeight: 30,
  interestsWeight: 25,
  intentWeight: 20,
  backgroundWeight: 15,
  cultureWeight: 10,
};

// 用户匹配分数接口
export interface UserMatchScore {
  userId: string;
  overallScore: number;       // 总分 (0-100)
  personalityScore: number;   // 性格兼容性分数
  interestsScore: number;     // 兴趣匹配分数
  intentScore: number;        // 意图匹配分数
  backgroundScore: number;    // 背景多样性分数
  cultureScore: number;       // 文化语言分数
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
  if (!user1.primaryRole || !user2.primaryRole) return 50;
  
  try {
    const chemistry = getChemistryScore(
      user1.primaryRole as ArchetypeName,
      user2.primaryRole as ArchetypeName
    );
    return chemistry;
  } catch {
    return 50; // 如果原型不在矩阵中，返回中等分数
  }
}

/**
 * 计算两个用户之间的兴趣匹配分数
 */
function calculateInterestsScore(user1: Partial<User>, user2: Partial<User>): number {
  const interests1 = user1.interestsTop || [];
  const interests2 = user2.interestsTop || [];
  
  if (interests1.length === 0 || interests2.length === 0) return 50;
  
  // 计算交集
  const commonInterests = interests1.filter(i => interests2.includes(i));
  const matchRatio = commonInterests.length / Math.max(interests1.length, interests2.length);
  
  // 转换为0-100分数
  return Math.min(100, Math.round(matchRatio * 100 + 30)); // 至少30分基础分
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
 * 计算两个用户之间的背景多样性分数
 * 注意：多样性分数越高表示背景越不同，这对于丰富对话很有价值
 */
function calculateBackgroundScore(user1: Partial<User>, user2: Partial<User>): number {
  let diversityPoints = 0;
  let totalChecks = 0;
  
  // 行业不同 (+1)
  if (user1.industry && user2.industry) {
    totalChecks++;
    if (user1.industry !== user2.industry) diversityPoints += 1;
  }
  
  // 教育背景不同 (+1)
  if (user1.educationLevel && user2.educationLevel) {
    totalChecks++;
    if (user1.educationLevel !== user2.educationLevel) diversityPoints += 0.5;
  }
  
  // 学习地域不同 (+1)
  if (user1.studyLocale && user2.studyLocale) {
    totalChecks++;
    if (user1.studyLocale !== user2.studyLocale) diversityPoints += 1;
  }
  
  // 家乡不同 (+1)
  if (user1.hometownCountry && user2.hometownCountry) {
    totalChecks++;
    if (user1.hometownCountry !== user2.hometownCountry) diversityPoints += 1;
  }
  
  if (totalChecks === 0) return 50;
  
  // 转换为0-100分数（多样性越高，分数越高）
  const diversityRatio = diversityPoints / totalChecks;
  return Math.round(diversityRatio * 100);
}

/**
 * 计算两个用户之间的文化语言分数
 */
function calculateCultureScore(user1: Partial<User>, user2: Partial<User>): number {
  const lang1 = user1.languagesComfort || [];
  const lang2 = user2.languagesComfort || [];
  
  if (lang1.length === 0 || lang2.length === 0) return 50;
  
  // 计算共同语言
  const commonLanguages = lang1.filter(l => lang2.includes(l));
  
  if (commonLanguages.length === 0) {
    return 20; // 没有共同语言，低分
  } else if (commonLanguages.length >= 2) {
    return 95; // 多个共同语言，高分
  } else {
    return 75; // 一个共同语言，良好
  }
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
  
  // 计算加权总分
  const overallScore = Math.round(
    (personalityScore * weights.personalityWeight +
     interestsScore * weights.interestsWeight +
     intentScore * weights.intentWeight +
     backgroundScore * weights.backgroundWeight +
     cultureScore * weights.cultureWeight) / 100
  );
  
  // 生成匹配点
  const matchPoints: string[] = [];
  
  if (personalityScore >= 80) {
    matchPoints.push(`性格高度互补 (${personalityScore}分)`);
  }
  if (interestsScore >= 70) {
    const common = (user1.interestsTop || []).filter(i => 
      (user2.interestsTop || []).includes(i)
    );
    if (common.length > 0) {
      matchPoints.push(`共同兴趣：${common.slice(0, 2).join('、')}`);
    }
  }
  if (intentScore >= 75) {
    matchPoints.push('活动意图一致');
  }
  if (backgroundScore >= 70) {
    matchPoints.push('背景多元化');
  }
  if (cultureScore >= 80) {
    matchPoints.push('语言文化相通');
  }
  
  return {
    userId: user2.id || '',
    overallScore,
    personalityScore,
    interestsScore,
    intentScore,
    backgroundScore,
    cultureScore,
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
      .map(u => u.primaryRole)
      .filter(Boolean) as ArchetypeName[];
    
    const avgChemistryScore = calculateGroupChemistry(archetypes);
    
    // 计算多样性分数（背景、行业等的多样性）
    const industries = new Set(group.map(u => u.industry).filter(Boolean));
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
  const archetypes = users.map(u => u.primaryRole).filter(Boolean);
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
  
  // 兴趣共鸣
  const interests = users.flatMap(u => u.interestsTop || []);
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
