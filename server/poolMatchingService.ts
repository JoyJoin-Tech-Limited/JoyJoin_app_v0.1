
//my path:/Users/felixg/projects/JoyJoin3/server/poolMatchingService.ts
/**
 * Pool-Based Matching Service (池内匹配服务)
 * 两阶段匹配模型 - Stage 2: 用户报名后，在活动池内进行智能分组
 * 
 * 匹配逻辑：
 * 1. 硬约束过滤：检查用户是否符合活动池的硬性限制（性别、行业、年龄等）
 * 2. 软约束评分：基于5个维度计算用户之间的匹配分数
 *    - Personality Chemistry (性格兼容性)
 *    - Interest Overlap (兴趣重叠度)
 *    - Background Diversity (背景多样性)
 *    - Conversation Compatibility (语言沟通)
 *    - Event Preferences (活动偏好: 预算、饮食、社交目的)
 * 3. 智能分组：使用贪婪+优化算法形成高质量小组
 */

import { db } from "./db";
import { 
  eventPools, 
  eventPoolRegistrations, 
  eventPoolGroups,
  events,
  eventAttendance,
  users, 
  matchingConfig,
  invitationUses,
  invitations,
  coupons,
  userCoupons
} from "@shared/schema";
import { eq, and, inArray } from "drizzle-orm";
import { wsService } from "./wsService";
import type { PoolMatchedData } from "../shared/wsEvents";
import { chemistryMatrix as CHEMISTRY_MATRIX, ARCHETYPE_ENERGY } from "./archetypeChemistry";

export interface UserWithProfile {
  userId: string;
  registrationId: string;
  
  // User profile (permanent)
  gender: string | null;
  age: number | null;
  industry: string | null;
  seniority: string | null;
  educationLevel: string | null;
  archetype: string | null;
  secondaryArchetype: string | null;
  interestsTop: string[] | null;
  languagesComfort: string[] | null;
  
  // Event preferences (temporary, from registration)
  budgetRange: string[] | null;
  preferredLanguages: string[] | null;
  socialGoals: string[] | null;
  cuisinePreferences: string[] | null;
  dietaryRestrictions: string[] | null;
  tasteIntensity: string[] | null;
}

export interface MatchGroup {
  members: UserWithProfile[];
  avgPairScore: number;  // 平均配对兼容性分数（chemistry + interest + preference + language）
  diversityScore: number;  // 小组多样性分数
  energyBalance: number;  // 能量平衡分数（0-100，评估小组社交能量的平衡度）
  overallScore: number;  // 综合分数 = avgPairScore × 0.6 + diversityScore × 0.25 + energyBalance × 0.15
  temperatureLevel: string;  // 化学反应温度等级：fire(🔥炽热85+) | warm(🌡️温暖70-84) | mild(🌤️适宜55-69) | cold(❄️冷淡<55)
  explanation: string;
}

/**
 * 硬约束检查：验证用户是否符合活动池的所有限制
 */
function meetsHardConstraints(
  user: UserWithProfile, 
  pool: typeof eventPools.$inferSelect
): boolean {
  // 性别限制
  if (pool.genderRestriction && user.gender !== pool.genderRestriction) {
    return false;
  }
  
  // 行业限制
  if (pool.industryRestrictions && pool.industryRestrictions.length > 0) {
    if (!user.industry || !pool.industryRestrictions.includes(user.industry)) {
      return false;
    }
  }
  
  // 职级限制
  if (pool.seniorityRestrictions && pool.seniorityRestrictions.length > 0) {
    if (!user.seniority || !pool.seniorityRestrictions.includes(user.seniority)) {
      return false;
    }
  }
  
  // 学历限制
  if (pool.educationLevelRestrictions && pool.educationLevelRestrictions.length > 0) {
    if (!user.educationLevel || !pool.educationLevelRestrictions.includes(user.educationLevel)) {
      return false;
    }
  }
  
  // 年龄限制
  if (pool.ageRangeMin && user.age && user.age < pool.ageRangeMin) {
    return false;
  }
  if (pool.ageRangeMax && user.age && user.age > pool.ageRangeMax) {
    return false;
  }
  
  return true;
}

/**
 * 计算两个用户之间的性格化学反应分数 (0-100)
 * 考虑主角色（70%）和次要角色的交叉兼容性（各15%，共30%）
 */
function calculateChemistryScore(user1: UserWithProfile, user2: UserWithProfile): number {
  const primary1 = (user1.archetype || "暖心熊") as keyof typeof CHEMISTRY_MATRIX;
  const primary2 = (user2.archetype || "暖心熊") as keyof typeof CHEMISTRY_MATRIX;
  const secondary1 = (user1.secondaryArchetype || "暖心熊") as keyof typeof CHEMISTRY_MATRIX;
  const secondary2 = (user2.secondaryArchetype || "暖心熊") as keyof typeof CHEMISTRY_MATRIX;
  
  // 主角色化学反应（70%权重）
  const primaryChemistry = (CHEMISTRY_MATRIX[primary1]?.[primary2] || 50) * 0.70;
  
  // 次要角色交叉加成（各15%权重，共30%）
  const crossChemistry1 = (CHEMISTRY_MATRIX[primary1]?.[secondary2] || 50) * 0.15;
  const crossChemistry2 = (CHEMISTRY_MATRIX[secondary1]?.[primary2] || 50) * 0.15;
  
  return Math.round(primaryChemistry + crossChemistry1 + crossChemistry2);
}

/**
 * 计算兴趣重叠度 (0-100)
 * 使用Jaccard系数：交集 / 并集
 */
function calculateInterestScore(user1: UserWithProfile, user2: UserWithProfile): number {
  const interests1 = user1.interestsTop || [];
  const interests2 = user2.interestsTop || [];
  
  if (interests1.length === 0 && interests2.length === 0) return 70; // 都没有兴趣记录，默认中等分数
  if (interests1.length === 0 || interests2.length === 0) return 30; // 一方没有记录，低分
  
  const overlap = interests1.filter(i => interests2.includes(i)).length;
  const union = new Set([...interests1, ...interests2]).size;
  
  // Jaccard系数：(交集大小 / 并集大小) * 85 + 15
  // 无重叠=15分，完全重叠=100分
  const jaccardRatio = overlap / union;
  return Math.round(jaccardRatio * 85 + 15);
}

/**
 * 计算语言沟通兼容性 (0-100)
 */
function calculateLanguageScore(user1: UserWithProfile, user2: UserWithProfile): number {
  const langs1 = user1.languagesComfort || user1.preferredLanguages || [];
  const langs2 = user2.languagesComfort || user2.preferredLanguages || [];
  
  if (langs1.length === 0 || langs2.length === 0) return 70; // 默认假设可以沟通
  
  const overlap = langs1.filter(l => langs2.includes(l)).length;
  return overlap > 0 ? 100 : 30; // 有共同语言=100，无共同语言=30
}

/**
 * 计算活动偏好兼容性 (0-100)
 * 考虑：预算、饮食偏好、社交目的
 */
function calculatePreferenceScore(user1: UserWithProfile, user2: UserWithProfile): number {
  let score = 0;
  let factors = 0;
  
  // 预算兼容性
  const budget1 = user1.budgetRange || [];
  const budget2 = user2.budgetRange || [];
  if (budget1.length > 0 && budget2.length > 0) {
    const budgetOverlap = budget1.filter(b => budget2.includes(b)).length;
    score += (budgetOverlap / Math.max(budget1.length, budget2.length)) * 100;
    factors++;
  }
  
  // 饮食偏好兼容性
  const cuisine1 = user1.cuisinePreferences || [];
  const cuisine2 = user2.cuisinePreferences || [];
  if (cuisine1.length > 0 && cuisine2.length > 0) {
    const cuisineOverlap = cuisine1.filter(c => cuisine2.includes(c)).length;
    score += (cuisineOverlap / Math.max(cuisine1.length, cuisine2.length)) * 100;
    factors++;
  }
  
  // 社交目的兼容性
  const goals1 = user1.socialGoals || [];
  const goals2 = user2.socialGoals || [];
  if (goals1.length > 0 && goals2.length > 0) {
    const goalsOverlap = goals1.filter(g => goals2.includes(g)).length;
    score += (goalsOverlap / Math.max(goals1.length, goals2.length)) * 100;
    factors++;
  }
  
  return factors > 0 ? Math.round(score / factors) : 60; // 默认中等兼容
}

/**
 * 计算背景多样性分数 (0-100)
 * 不同行业、职级 = 更高分（鼓励多样性）
 */
function calculateDiversityScore(user1: UserWithProfile, user2: UserWithProfile): number {
  let diversityPoints = 0;
  
  // 不同行业 +50
  if (user1.industry && user2.industry && user1.industry !== user2.industry) {
    diversityPoints += 50;
  }
  
  // 不同职级 +30
  if (user1.seniority && user2.seniority && user1.seniority !== user2.seniority) {
    diversityPoints += 30;
  }
  
  // 不同性别 +20
  if (user1.gender && user2.gender && user1.gender !== user2.gender) {
    diversityPoints += 20;
  }
  
  return Math.min(diversityPoints, 100);
}

/**
 * 计算两个用户的配对兼容性分数 (0-100)
 * 注意：diversity在小组层面单独计算，不在配对层面重复计算
 */
function calculatePairScore(user1: UserWithProfile, user2: UserWithProfile): number {
  const chemistry = calculateChemistryScore(user1, user2);
  const interest = calculateInterestScore(user1, user2);
  const language = calculateLanguageScore(user1, user2);
  const preference = calculatePreferenceScore(user1, user2);
  
  // 权重配置：仅包含配对兼容性维度（总和100%）
  // diversity在小组层面单独计算，避免重复计算
  const weights = {
    chemistry: 0.35,   // 性格兼容性 35%
    interest: 0.30,    // 兴趣重叠 30%
    preference: 0.20,  // 活动偏好 20%
    language: 0.15     // 语言沟通 15%
  };
  
  const totalScore = 
    chemistry * weights.chemistry +
    interest * weights.interest +
    preference * weights.preference +
    language * weights.language;
  
  return Math.round(totalScore);
}

/**
 * 计算小组内所有成员的平均配对兼容性分数
 * 包含：chemistry + interest + preference + language（不含diversity）
 */
function calculateGroupPairScore(members: UserWithProfile[]): number {
  if (members.length < 2) return 0;
  
  let totalScore = 0;
  let pairCount = 0;
  
  for (let i = 0; i < members.length; i++) {
    for (let j = i + 1; j < members.length; j++) {
      totalScore += calculatePairScore(members[i], members[j]);
      pairCount++;
    }
  }
  
  return pairCount > 0 ? Math.round(totalScore / pairCount) : 0;
}

/**
 * 计算小组的多样性分数
 */
function calculateGroupDiversity(members: UserWithProfile[]): number {
  const uniqueIndustries = new Set(members.map(m => m.industry).filter(Boolean)).size;
  const uniqueSeniorities = new Set(members.map(m => m.seniority).filter(Boolean)).size;
  const uniqueGenders = new Set(members.map(m => m.gender).filter(Boolean)).size;
  const uniqueArchetypes = new Set(members.map(m => m.archetype).filter(Boolean)).size;
  
  // 归一化到 0-100
  const maxDiversity = members.length;
  const diversityScore = 
    (uniqueIndustries / maxDiversity) * 25 +
    (uniqueSeniorities / maxDiversity) * 25 +
    (uniqueGenders / maxDiversity) * 25 +
    (uniqueArchetypes / maxDiversity) * 25;
  
  return Math.round(diversityScore * 100);
}

/**
 * 计算小组的能量平衡分数 (0-100)
 * 理想的小组应该有平衡的能量分布：
 * - 平均能量在50-70之间（既不全是高能量，也不全是低能量）
 * - 标准差越小越好（成员之间能量差异不能太大）
 */
function calculateEnergyBalance(members: UserWithProfile[]): number {
  if (members.length === 0) return 0;
  
  // 1. 获取每个成员的能量值
  const energyLevels = members.map(m => {
    const archetype = (m.archetype || "暖心熊") as keyof typeof ARCHETYPE_ENERGY;
    return ARCHETYPE_ENERGY[archetype] || 50;
  });
  
  // 2. 计算平均能量
  const avgEnergy = energyLevels.reduce((sum, e) => sum + e, 0) / energyLevels.length;
  
  // 3. 计算标准差
  const variance = energyLevels.reduce((sum, e) => sum + Math.pow(e - avgEnergy, 2), 0) / energyLevels.length;
  const stdDev = Math.sqrt(variance);
  
  // 4. 评分逻辑
  // 4.1 平均能量得分：目标范围50-70，越接近越好
  let avgEnergyScore = 0;
  if (avgEnergy >= 50 && avgEnergy <= 70) {
    avgEnergyScore = 100; // 理想范围
  } else if (avgEnergy >= 40 && avgEnergy < 50) {
    avgEnergyScore = 80 + (avgEnergy - 40) * 2; // 40-49: 80-100分
  } else if (avgEnergy > 70 && avgEnergy <= 80) {
    avgEnergyScore = 100 - (avgEnergy - 70); // 70-80: 100-90分
  } else if (avgEnergy >= 30 && avgEnergy < 40) {
    avgEnergyScore = 60 + (avgEnergy - 30) * 2; // 30-39: 60-80分
  } else if (avgEnergy > 80 && avgEnergy <= 90) {
    avgEnergyScore = 90 - (avgEnergy - 80) * 2; // 80-90: 90-70分
  } else {
    avgEnergyScore = Math.max(0, 100 - Math.abs(avgEnergy - 60) * 2); // 其他范围递减
  }
  
  // 4.2 标准差得分：标准差越小越好（目标<15）
  let stdDevScore = 0;
  if (stdDev <= 15) {
    stdDevScore = 100;
  } else if (stdDev <= 25) {
    stdDevScore = 100 - (stdDev - 15) * 4; // 15-25: 100-60分
  } else {
    stdDevScore = Math.max(0, 60 - (stdDev - 25) * 2); // >25: 递减
  }
  
  // 5. 综合得分：平均能量60% + 标准差40%
  const balanceScore = Math.round(avgEnergyScore * 0.6 + stdDevScore * 0.4);
  
  return balanceScore;
}

/**
 * 根据综合分数获取化学反应温度等级
 */
function getTemperatureLevel(overallScore: number): string {
  if (overallScore >= 85) return "fire";    // 🔥炽热
  if (overallScore >= 70) return "warm";    // 🌡️温暖
  if (overallScore >= 55) return "mild";    // 🌤️适宜
  return "cold";                             // ❄️冷淡
}

/**
 * 获取温度等级的emoji显示
 */
export function getTemperatureEmoji(temperatureLevel: string): string {
  const emojiMap: Record<string, string> = {
    "fire": "🔥",
    "warm": "🌡️",
    "mild": "🌤️",
    "cold": "❄️"
  };
  return emojiMap[temperatureLevel] || "🌤️";
}

/**
 * 生成小组匹配解释文案
 */
function generateGroupExplanation(group: MatchGroup): string {
  const archetypes = group.members.map(m => m.archetype || "未知").filter((v, i, a) => a.indexOf(v) === i);
  const industries = group.members.map(m => m.industry || "未知").filter((v, i, a) => a.indexOf(v) === i);
  const tempEmoji = getTemperatureEmoji(group.temperatureLevel);
  
  return `${tempEmoji} 这个小组有${group.members.length}位成员，包含${archetypes.length}种人格类型（${archetypes.join("、")}），来自${industries.length}个行业。配对兼容性${group.avgPairScore}分，多样性${group.diversityScore}分，能量平衡${group.energyBalance}分，综合匹配度${group.overallScore}分。`;
}

/**
 * 主匹配算法：贪婪+优化策略
 * 1. 按匹配分数排序所有可能的配对
 * 2. 贪婪地组建小组，确保每个小组质量
 * 3. 优化：调整边界成员以提升整体分数
 */
export async function matchEventPool(poolId: string): Promise<MatchGroup[]> {
  // 1. 获取活动池配置
  const pool = await db.query.eventPools.findFirst({
    where: eq(eventPools.id, poolId)
  });
  
  if (!pool) {
    throw new Error("活动池不存在");
  }
  
  // 2. 获取所有报名者 + 用户资料
  const registrations = await db
    .select({
      registrationId: eventPoolRegistrations.id,
      userId: eventPoolRegistrations.userId,
      budgetRange: eventPoolRegistrations.budgetRange,
      preferredLanguages: eventPoolRegistrations.preferredLanguages,
      socialGoals: eventPoolRegistrations.socialGoals,
      cuisinePreferences: eventPoolRegistrations.cuisinePreferences,
      dietaryRestrictions: eventPoolRegistrations.dietaryRestrictions,
      tasteIntensity: eventPoolRegistrations.tasteIntensity,
      gender: users.gender,
      age: users.age,
      industry: users.industry,
      seniority: users.seniority,
      educationLevel: users.educationLevel,
      archetype: users.archetype,
      secondaryArchetype: users.secondaryRole,
      interestsTop: users.interestsTop,
      languagesComfort: users.languagesComfort,
    })
    .from(eventPoolRegistrations)
    .innerJoin(users, eq(eventPoolRegistrations.userId, users.id))
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.matchStatus, "pending")
      )
    );
  
  // 3. 硬约束过滤
  const eligibleUsers = registrations.filter((reg: any) => 
    meetsHardConstraints(reg as UserWithProfile, pool)
  );
  
  if (eligibleUsers.length < (pool.minGroupSize || 4)) {
    throw new Error(`报名人数不足，至少需要${pool.minGroupSize}人`);
  }
  
  // 3.5 获取邀请关系 (invitation relationships)
  // Query all invitation uses for registrations in this pool
  const registrationIds = eligibleUsers.map(u => u.registrationId);
  
  // Build invitation map: inviteeUserId -> inviterUserId
  // This will help us prioritize matching invited users with their inviters
  const invitationPairs: Array<{inviterId: string, inviteeId: string}> = [];
  
  for (const user of eligibleUsers) {
    // Check if this user was invited (is an invitee)
    const [inviteUse] = await db
      .select()
      .from(invitationUses)
      .where(eq(invitationUses.poolRegistrationId, user.registrationId))
      .limit(1);
    
    if (inviteUse && inviteUse.invitationId) {
      // Get the invitation to find who invited this user
      const [invitation] = await db
        .select()
        .from(invitations)
        .where(eq(invitations.code, inviteUse.invitationId))
        .limit(1);
      
      if (invitation) {
        // Check if inviter is also in this pool
        const inviter = eligibleUsers.find(u => u.userId === invitation.inviterId);
        if (inviter) {
          invitationPairs.push({
            inviterId: inviter.userId,
            inviteeId: user.userId
          });
        }
      }
    }
  }
  
  // 4. 贪婪分组算法（优先处理邀请关系）
  const groups: MatchGroup[] = [];
  const used = new Set<string>();
  const targetGroupSize = pool.maxGroupSize || 6;
  const minGroupSize = pool.minGroupSize || 4;
  
  // 计算所有可能的配对分数，并为邀请关系加权
  const pairScores: { user1: UserWithProfile; user2: UserWithProfile; score: number; isInvited: boolean }[] = [];
  for (let i = 0; i < eligibleUsers.length; i++) {
    for (let j = i + 1; j < eligibleUsers.length; j++) {
      let score = calculatePairScore(
        eligibleUsers[i] as UserWithProfile, 
        eligibleUsers[j] as UserWithProfile
      );
      
      // Check if this pair has an invitation relationship
      const user1 = eligibleUsers[i] as UserWithProfile;
      const user2 = eligibleUsers[j] as UserWithProfile;
      const isInvited = invitationPairs.some(pair => 
        (pair.inviterId === user1.userId && pair.inviteeId === user2.userId) ||
        (pair.inviterId === user2.userId && pair.inviteeId === user1.userId)
      );
      
      // Boost score for invited pairs (soft constraint)
      if (isInvited) {
        score = Math.min(100, score + 20); // Add 20 points bonus
      }
      
      pairScores.push({
        user1,
        user2,
        score,
        isInvited
      });
    }
  }
  
  // 按分数降序排序（邀请关系会自动排在前面因为有加分）
  pairScores.sort((a, b) => b.score - a.score);
  
  // 贪婪组建小组
  for (const pair of pairScores) {
    if (used.has(pair.user1.userId) || used.has(pair.user2.userId)) continue;
    
    // 以这对高分用户为核心，找到其他合适的成员
    const groupMembers = [pair.user1, pair.user2];
    used.add(pair.user1.userId);
    used.add(pair.user2.userId);
    
    // 继续添加成员直到达到目标人数
    while (groupMembers.length < targetGroupSize) {
      let bestCandidate: UserWithProfile | null = null;
      let bestScore = 0;
      
      for (const candidate of eligibleUsers as UserWithProfile[]) {
        if (used.has(candidate.userId)) continue;
        
        // 计算候选人与当前小组成员的平均分数
        let totalScore = 0;
        for (const member of groupMembers) {
          totalScore += calculatePairScore(candidate, member);
        }
        const avgScore = totalScore / groupMembers.length;
        
        if (avgScore > bestScore) {
          bestScore = avgScore;
          bestCandidate = candidate;
        }
      }
      
      if (bestCandidate && bestScore >= 60) { // 最低质量门槛
        groupMembers.push(bestCandidate);
        used.add(bestCandidate.userId);
      } else {
        break; // 没有合适的候选人
      }
    }
    
    // 只保留达到最小人数的小组
    if (groupMembers.length >= minGroupSize) {
      const avgPairScore = calculateGroupPairScore(groupMembers);
      const diversity = calculateGroupDiversity(groupMembers);
      const energyBalance = calculateEnergyBalance(groupMembers);
      const overall = Math.round((avgPairScore * 0.6) + (diversity * 0.25) + (energyBalance * 0.15));
      const temperatureLevel = getTemperatureLevel(overall);
      
      const group: MatchGroup = {
        members: groupMembers,
        avgPairScore: avgPairScore,
        diversityScore: diversity,
        energyBalance: energyBalance,
        overallScore: overall,
        temperatureLevel: temperatureLevel,
        explanation: ""
      };
      
      group.explanation = generateGroupExplanation(group);
      groups.push(group);
    } else {
      // 释放这些成员，允许他们加入其他组
      groupMembers.forEach(m => used.delete(m.userId));
    }
    
    // 达到目标组数就停止
    if (groups.length >= (pool.targetGroups || 1)) {
      break;
    }
  }
  
  return groups;
}

/**
 * 保存匹配结果到数据库
 */
export async function saveMatchResults(poolId: string, groups: MatchGroup[]): Promise<void> {
  // 获取活动池信息用于通知
  const [pool] = await db.select().from(eventPools).where(eq(eventPools.id, poolId));
  
  // 1. 创建小组记录并发送WebSocket通知
  for (let i = 0; i < groups.length; i++) {
    const group = groups[i];
    
    const [groupRecord] = await db.insert(eventPoolGroups).values({
      poolId,
      groupNumber: i + 1,
      memberCount: group.members.length,
      avgChemistryScore: group.avgPairScore,
      diversityScore: group.diversityScore,
      energyBalance: group.energyBalance,
      overallScore: group.overallScore,
      temperatureLevel: group.temperatureLevel,
      matchExplanation: group.explanation,
      status: "confirmed"
    }).returning();
    
    // 2. 更新用户报名状态
    const memberRegistrationIds = group.members.map(m => m.registrationId);
    await db.update(eventPoolRegistrations)
      .set({
        matchStatus: "matched",
        assignedGroupId: groupRecord.id,
        matchScore: group.overallScore,
        updatedAt: new Date()
      })
      .where(inArray(eventPoolRegistrations.id, memberRegistrationIds));
    
    // 2.5 创建对应的events记录，使其出现在活动管理模块
    const memberUserIds = group.members.map(m => m.userId);
    const location = pool?.district ? `${pool.city} ${pool.district}` : pool?.city || "待定";
    
    const [eventRecord] = await db.insert(events).values({
      title: `${pool?.title || "盲盒活动"} - 第${i + 1}组`,
      description: `来自活动池匹配：${pool?.description || ""}\n匹配分数: ${group.overallScore}\n化学反应: ${group.temperatureLevel}`,
      dateTime: pool?.dateTime || new Date(),
      location: location,
      area: pool?.district || null,
      maxAttendees: group.members.length,
      currentAttendees: group.members.length,
      hostId: pool?.createdBy || null,
      status: "matched", // 匹配成功的状态
      iconName: pool?.eventType === "饭局" ? "utensils" : pool?.eventType === "酒局" ? "wine" : "calendar",
    }).returning();
    
    // 2.6 为每个成员创建eventAttendance记录
    for (const member of group.members) {
      await db.insert(eventAttendance).values({
        eventId: eventRecord.id,
        userId: member.userId,
        status: "confirmed",
      });
    }
    
    // 2.7 更新groupRecord关联的eventId（如果需要的话，可以在eventPoolGroups表添加eventId字段）
    // 这里暂时不修改schema，只是创建关联记录
    
    console.log(`[Pool Matching] Created event ${eventRecord.id} for group ${i + 1} with ${memberUserIds.length} attendees`);
    
    // 3. 发送WebSocket通知给每个匹配到的用户
    const notificationData: PoolMatchedData = {
      poolId,
      poolTitle: pool?.title || "活动池",
      groupId: groupRecord.id,
      groupNumber: i + 1,
      matchScore: group.overallScore,
      memberCount: group.members.length,
      temperatureLevel: group.temperatureLevel
    };
    
    memberUserIds.forEach(userId => {
      wsService.broadcastToUser(userId, {
        type: "POOL_MATCHED",
        data: notificationData,
        timestamp: new Date().toISOString()
      });
    });
    
    console.log(`[Pool Matching] Sent POOL_MATCHED notification to ${memberUserIds.length} users for group ${i + 1}`);
  }
  
  // 4. 更新活动池状态
  await db.update(eventPools)
    .set({
      status: "matched",
      successfulMatches: groups.reduce((sum, g) => sum + g.members.length, 0),
      matchedAt: new Date(),
      updatedAt: new Date()
    })
    .where(eq(eventPools.id, poolId));
  
  // 5. 标记未匹配用户
  await db.update(eventPoolRegistrations)
    .set({
      matchStatus: "unmatched",
      updatedAt: new Date()
    })
    .where(
      and(
        eq(eventPoolRegistrations.poolId, poolId),
        eq(eventPoolRegistrations.matchStatus, "pending")
      )
    );
  
  // 6. 发放邀请奖励优惠券 (Invitation Reward Coupons)
  await processInvitationRewards(poolId, groups);
}

/**
 * 处理邀请奖励：为成功匹配的邀请关系发放优惠券
 */
async function processInvitationRewards(poolId: string, groups: MatchGroup[]): Promise<void> {
  // 查找邀请奖励优惠券（管理员需要预先创建code为"INVITE_REWARD"的优惠券）
  const [inviteRewardCoupon] = await db.select()
    .from(coupons)
    .where(eq(coupons.code, "INVITE_REWARD"))
    .limit(1);
  
  if (!inviteRewardCoupon || !inviteRewardCoupon.isActive) {
    console.log('[Invitation Reward] No active INVITE_REWARD coupon found, skipping rewards');
    return;
  }
  
  // 获取该pool的所有成功匹配的用户
  const allMatchedUserIds = groups.flatMap(g => g.members.map(m => m.userId));
  
  // 查找所有涉及该pool的邀请使用记录
  const poolRegistrations = await db.select()
    .from(eventPoolRegistrations)
    .where(eq(eventPoolRegistrations.poolId, poolId));
  
  const registrationIds = poolRegistrations.map(r => r.id);
  
  if (registrationIds.length === 0) return;
  
  const inviteUses = await db.select()
    .from(invitationUses)
    .where(inArray(invitationUses.poolRegistrationId, registrationIds));
  
  // 对于每个邀请使用记录，检查是否成功匹配到同一局
  for (const inviteUse of inviteUses) {
    if (inviteUse.rewardIssued || !inviteUse.invitationId) continue;
    
    // 获取邀请信息
    const [invitation] = await db.select()
      .from(invitations)
      .where(eq(invitations.code, inviteUse.invitationId))
      .limit(1);
    
    if (!invitation) continue;
    
    const inviterId = invitation.inviterId;
    const inviteeId = inviteUse.inviteeId;
    
    // 检查inviter和invitee是否都在匹配用户列表中
    if (!allMatchedUserIds.includes(inviterId) || !allMatchedUserIds.includes(inviteeId)) {
      continue;
    }
    
    // 检查他们是否在同一个group中
    let matchedTogether = false;
    for (const group of groups) {
      const groupUserIds = group.members.map(m => m.userId);
      if (groupUserIds.includes(inviterId) && groupUserIds.includes(inviteeId)) {
        matchedTogether = true;
        break;
      }
    }
    
    if (matchedTogether) {
      // 发放优惠券给邀请人
      try {
        await db.insert(userCoupons).values({
          userId: inviterId,
          couponId: inviteRewardCoupon.id,
          source: "invitation_reward",
          sourceId: invitation.id,
          isUsed: false
        });
        
        // 标记奖励已发放
        await db.update(invitationUses)
          .set({
            matchedTogether: true,
            rewardIssued: true,
            matchedAt: new Date()
          })
          .where(eq(invitationUses.id, inviteUse.id));
        
        console.log(`[Invitation Reward] Issued coupon to user ${inviterId} for inviting ${inviteeId}`);
      } catch (error) {
        console.error(`[Invitation Reward] Failed to issue coupon:`, error);
      }
    }
  }
}
