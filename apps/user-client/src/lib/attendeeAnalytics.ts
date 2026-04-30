import { getArchetypeCompatibility } from '@/lib/archetypeCompatibility';
import {
  WORK_MODE_LABELS,
  EDUCATION_LEVEL_RARITY,
  RELATIONSHIP_MATCH_LABELS,
} from '@shared/constants';

export interface AttendeeData {
  userId: string;
  displayName: string;
  archetype?: string;
  socialTag?: string; // Social personality impression tag
  topInterests?: string[];
  primaryInterests?: string[];
  interestFavorite?: string;
  topicsHappy?: string[];
  topicsAvoid?: string[];
  topicAvoidances?: string[];
  debateComfort?: number;
  age?: number;
  birthdate?: string;
  industry?: string;
  industryCategory?: string;
  industryCategoryLabel?: string;
  ageVisible?: boolean;
  industryVisible?: boolean;
  gender?: string;
  pronouns?: string;
  educationLevel?: string;
  hometownCountry?: string;
  hometownRegionCity?: string;
  hometownAffinityOptin?: boolean;
  educationVisible?: boolean;
  relationshipStatus?: string;
  children?: string;
  studyLocale?: string;
  overseasRegions?: string[];
  seniority?: string;
  fieldOfStudy?: string;
  languagesComfort?: string[];
  intent?: string[]; // Event-specific intent (aligned with User.intent)
  // Work fields
  occupationId?: string;
  workMode?: string;
  // New fields from AI chat registration
  cuisinePreference?: string[];
  favoriteRestaurant?: string;
  dialectProfile?: string[]; // Detected dialects from conversation
}

export interface CommonInterest {
  interest: string;
  count: number;
}

export interface ArchetypeDistribution {
  archetype: string;
  count: number;
  percentage: number;
}

export interface GroupInsight {
  type: 'industry' | 'interest' | 'experience' | 'personality' | 'balance';
  label: string;
  icon: string;
}

const interestNameMap: Record<string, string> = {
  "film_entertainment": "电影娱乐",
  "travel_exploration": "旅行探索",
  "food_dining": "美食餐饮",
  "music_concerts": "音乐演出",
  "reading_books": "阅读书籍",
  "art_culture": "艺术文化",
  "sports_fitness": "运动健身",
  "fitness_health": "健身健康",
  "photography": "摄影",
  "gaming": "游戏",
  "technology": "科技",
  "entrepreneurship": "创业",
  "networking": "社交拓展",
  "outdoor_activities": "户外活动",
  "yoga_meditation": "瑜伽冥想",
  "wine_spirits": "品酒",
  "coffee_tea": "咖啡茶艺",
  "cooking_baking": "烹饪烘焙",
};

export function normalizeInterestName(interest: string): string {
  return interestNameMap[interest] || interest;
}

export function calculateCommonInterests(
  attendees: AttendeeData[]
): CommonInterest[] {
  const interestMap = new Map<string, number>();
  
  attendees.forEach((attendee) => {
    if (attendee.topInterests) {
      attendee.topInterests.forEach((interest) => {
        const normalizedInterest = normalizeInterestName(interest);
        interestMap.set(normalizedInterest, (interestMap.get(normalizedInterest) || 0) + 1);
      });
    }
  });
  
  const commonInterests = Array.from(interestMap.entries())
    .map(([interest, count]) => ({ interest, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 3);
  
  return commonInterests;
}

export function calculateArchetypeDistribution(
  attendees: AttendeeData[]
): ArchetypeDistribution[] {
  const archetypeMap = new Map<string, number>();
  const total = attendees.length;
  
  attendees.forEach((attendee) => {
    if (attendee.archetype) {
      archetypeMap.set(
        attendee.archetype,
        (archetypeMap.get(attendee.archetype) || 0) + 1
      );
    }
  });
  
  const distribution = Array.from(archetypeMap.entries())
    .map(([archetype, count]) => ({
      archetype,
      count,
      percentage: Math.round((count / total) * 100),
    }))
    .sort((a, b) => b.count - a.count);
  
  return distribution;
}

export function calculateCommonInterestsWithUser(
  userInterests: string[],
  attendeeInterests: string[]
): number {
  if (!userInterests || !attendeeInterests) return 0;
  
  const userSet = new Set(userInterests);
  const commonCount = attendeeInterests.filter((interest) =>
    userSet.has(interest)
  ).length;
  
  return commonCount;
}

export const archetypeDescriptions: Record<string, string> = {
  // 8个核心社交角色
  "火花塞": "点燃话题，激发讨论的活力引擎",
  "探索者": "好奇心驱动，热衷于尝试新事物和新体验",
  "故事家": "善于表达，喜欢分享经历和倾听他人",
  "挑战者": "勇于质疑，推动深度思考和成长",
  "连接者": "擅长建立联系，串联不同的人和话题",
  "协调者": "平衡氛围，善于协调和化解分歧",
  "氛围组": "活跃气氛，让聚会充满欢声笑语",
  "肯定者": "给予支持和认可，提供情感价值",
  
  // 演示数据使用的角色
  "社交达人": "外向热情，擅长社交和建立人脉",
  "创意家": "充满想象力，带来新奇独特的视角",
  
  // 旧版角色（兼容性保留）
  "讲故事的人": "生动有趣，用故事连接彼此的情感",
  "智者": "深思熟虑，享受深度对话和知识交流",
  "发光体": "活力四射，能点燃团队氛围的正能量担当",
  "稳定器": "可靠稳重，为朋友提供情感支持和安全感",
};

export function generatePersonalizedDescription(
  attendee: AttendeeData
): string {
  if (!attendee.topInterests || attendee.topInterests.length === 0) {
    return "期待与你分享精彩时刻";
  }
  
  const interests = attendee.topInterests.slice(0, 2).join("、");
  const templates = [
    `最近迷上了${interests}`,
    `热爱${interests}的生活`,
    `喜欢探索${interests}的世界`,
    `${interests}是我的快乐源泉`,
  ];
  
  const hash = attendee.userId.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
  return templates[hash % templates.length];
}

/**
 * User context for spark predictions and matching
 * Consolidates all user fields needed for connection point generation
 */
export interface UserContext {
  interests?: string[];
  primaryInterests?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
  topicAvoidances?: string[];
  debateComfort?: number;
  educationLevel?: string;
  industry?: string;
  age?: number;
  gender?: string;
  relationshipStatus?: string;
  children?: string;
  studyLocale?: string;
  overseasRegions?: string[];
  seniority?: string;
  fieldOfStudy?: string;
  languages?: string[];
  hometownCountry?: string;
  hometownRegionCity?: string;
  hometownAffinityOptin?: boolean;
  archetype?: string;
  workMode?: string;
  industryCategory?: string;
  industryCategoryLabel?: string;
  intent?: string[]; // Event-specific intent (aligned with User.intent)
  matchedBefore?: string[]; // Array of user IDs previously matched with
  // New fields from AI chat registration
  cuisinePreference?: string[];
  favoriteRestaurant?: string;
  dialectProfile?: string[]; // Detected dialects from conversation
}

/**
 * @deprecated Use UserContext instead. Kept for backward compatibility.
 */
export interface SparkPredictionContext {
  userInterests?: string[];
  userPrimaryInterests?: string[];
  userTopicsHappy?: string[];
  userTopicsAvoid?: string[];
  userTopicAvoidances?: string[];
  userDebateComfort?: number;
  userEducationLevel?: string;
  userIndustry?: string;
  userAge?: number;
  userGender?: string;
  userRelationshipStatus?: string;
  userChildren?: string;
  userStudyLocale?: string;
  userOverseasRegions?: string[];
  userSeniority?: string;
  userFieldOfStudy?: string;
  userLanguages?: string[];
  userHometownCountry?: string;
  userHometownRegionCity?: string;
  userHometownAffinityOptin?: boolean;
  userArchetype?: string;
  userWorkMode?: string;
  userIndustryCategory?: string;
  userIndustryCategoryLabel?: string;
  userIntent?: string[]; // Event-specific intent (aligned with User.intent)
  userMatchedBefore?: string[]; // Array of user IDs previously matched with
  // New fields from AI chat registration
  userCuisinePreference?: string[];
  userFavoriteRestaurant?: string;
  userDialectProfile?: string[]; // Detected dialects from conversation
}

export type RarityLevel = 'common' | 'rare' | 'epic';

export interface SparkPrediction {
  text: string;
  rarity: RarityLevel;
}

export type QualityTier = 'common' | 'rare' | 'epic';

export interface MatchQuality {
  rawScore: number;
  percentage: number;
  qualityTier: QualityTier;
  visualBoost: number;
}

// 契合点质量评分系统
export function calculateMatchQuality(connectionPoints: SparkPrediction[]): MatchQuality {
  const weights = {
    common: 1,    // 基础分
    rare: 3,      // 3倍权重
    epic: 6       // 6倍权重
  };
  
  let totalScore = 0;
  
  connectionPoints.forEach(point => {
    totalScore += weights[point.rarity];
  });
  
  // 能量环填充基于契合点数量（更宽松，更激励用户）
  // 假设6个契合点为满分（100%）
  const maxConnectionPoints = 6;
  const basePercentage = Math.min((connectionPoints.length / maxConnectionPoints) * 100, 100);
  
  // 质量层级基于最稀有的契合点（用于决定颜色和动效）
  let qualityTier: QualityTier;
  let visualBoost: number;
  
  const hasEpic = connectionPoints.some(point => point.rarity === 'epic');
  const hasRare = connectionPoints.some(point => point.rarity === 'rare');
  
  if (hasEpic) {
    qualityTier = 'epic';      // 有Epic契合点 - 金色能量环
    visualBoost = 15;           // 15%视觉加成
  } else if (hasRare) {
    qualityTier = 'rare';      // 有Rare契合点 - 紫色能量环  
    visualBoost = 10;           // 10%视觉加成
  } else {
    qualityTier = 'common';    // 只有Common契合点 - 灰色能量环
    visualBoost = 5;            // 5%视觉加成
  }
  
  return {
    rawScore: totalScore,
    percentage: basePercentage,
    qualityTier,
    visualBoost
  };
}

/**
 * Convert UserContext to SparkPredictionContext for backward compatibility
 */
export function calculateGroupInsights(attendees: AttendeeData[]): GroupInsight[] {
  const insights: GroupInsight[] = [];
  
  // Industry diversity
  const industries = new Set<string>();
  attendees.forEach(attendee => {
    if (attendee.industry) {
      industries.add(attendee.industry);
    }
  });
  
  if (industries.size >= 3) {
    const industryList = Array.from(industries).slice(0, 3).join("、");
    insights.push({
      type: 'industry',
      label: `来自${industryList}等${industries.size}个行业`,
      icon: '💼'
    });
  } else if (industries.size === 2) {
    const industryList = Array.from(industries).join("、");
    insights.push({
      type: 'industry',
      label: `跨${industryList}行业`,
      icon: '💼'
    });
  }
  
  // Common interests
  const interestMap = new Map<string, number>();
  attendees.forEach(attendee => {
    if (attendee.topInterests) {
      attendee.topInterests.forEach(interest => {
        const normalizedInterest = normalizeInterestName(interest);
        interestMap.set(normalizedInterest, (interestMap.get(normalizedInterest) || 0) + 1);
      });
    }
  });
  
  const popularInterests = Array.from(interestMap.entries())
    .filter(([_, count]) => count >= 2)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);
  
  if (popularInterests.length > 0) {
    const interestList = popularInterests.map(([interest]) => interest).join("、");
    insights.push({
      type: 'interest',
      label: `都喜欢${interestList}`,
      icon: '✨'
    });
  }
  
  // Overseas experience
  const overseasCount = attendees.filter(
    a => a.studyLocale === "Overseas" || a.studyLocale === "Both"
  ).length;
  
  if (overseasCount >= 2) {
    if (overseasCount === attendees.length) {
      insights.push({
        type: 'experience',
        label: '均有海外经历',
        icon: '🌍'
      });
    } else {
      insights.push({
        type: 'experience',
        label: `${overseasCount}人有海外经历`,
        icon: '🌍'
      });
    }
  }
  
  // Career stage
  const seniorityCount = {
    'Founder': 0,
    'Executive': 0,
    'Senior': 0,
    'Mid': 0,
    'Junior': 0
  };
  
  attendees.forEach(attendee => {
    if (attendee.seniority && attendee.seniority in seniorityCount) {
      seniorityCount[attendee.seniority as keyof typeof seniorityCount]++;
    }
  });
  
  if (seniorityCount.Founder >= 2) {
    insights.push({
      type: 'experience',
      label: `${seniorityCount.Founder}位创业者`,
      icon: '🚀'
    });
  } else if (seniorityCount.Senior + seniorityCount.Executive >= 2) {
    insights.push({
      type: 'experience',
      label: '职场资深人士聚集',
      icon: '💡'
    });
  } else if (seniorityCount.Mid + seniorityCount.Junior >= 3) {
    insights.push({
      type: 'experience',
      label: '职场同龄人为主',
      icon: '🤝'
    });
  }
  
  // Relationship status
  const singleCount = attendees.filter(
    a => a.relationshipStatus === "Single"
  ).length;
  const marriedCount = attendees.filter(
    a => a.relationshipStatus === "Married/Partnered"
  ).length;
  
  if (singleCount >= 3) {
    insights.push({
      type: 'experience',
      label: '单身友好局',
      icon: '💫'
    });
  } else if (marriedCount >= 3) {
    insights.push({
      type: 'experience',
      label: '已婚/有伴侣人士',
      icon: '💑'
    });
  }
  
  // Education level
  const highEducation = attendees.filter(
    a => a.educationLevel === "Master's" || a.educationLevel === "Doctorate"
  ).length;
  
  if (highEducation >= 3) {
    insights.push({
      type: 'experience',
      label: '高学历人群',
      icon: '🎓'
    });
  }
  
  // 🎯 NEW: Group role composition (balanced conversation dynamics)
  const roleCategories = {
    storytellers: 0, // 讲故事的人, 智者
    listeners: 0,    // 稳定器, 协调者, 肯定者
    energizers: 0,   // 发光体, 火花塞, 氛围组
    questioners: 0,  // 探索者, 挑战者
    connectors: 0    // 连接者
  };
  
  attendees.forEach(attendee => {
    if (!attendee.archetype) return;
    
    if (["讲故事的人", "智者"].includes(attendee.archetype)) {
      roleCategories.storytellers++;
    } else if (["稳定器", "协调者", "肯定者"].includes(attendee.archetype)) {
      roleCategories.listeners++;
    } else if (["发光体", "火花塞", "氛围组"].includes(attendee.archetype)) {
      roleCategories.energizers++;
    } else if (["探索者", "挑战者"].includes(attendee.archetype)) {
      roleCategories.questioners++;
    } else if (attendee.archetype === "连接者") {
      roleCategories.connectors++;
    }
  });
  
  // Ideal composition: balanced roles (no single role > 50%)
  const totalWithRoles = Object.values(roleCategories).reduce((a, b) => a + b, 0);
  const maxRoleCount = Math.max(...Object.values(roleCategories));
  const roleBalance = totalWithRoles > 0 ? maxRoleCount / totalWithRoles : 0;
  
  if (roleBalance <= 0.5 && totalWithRoles >= 4) {
    insights.push({
      type: 'personality',
      label: '角色平衡，对话流畅',
      icon: '🎭'
    });
  } else if (roleCategories.energizers >= 2 && roleCategories.storytellers >= 1) {
    insights.push({
      type: 'personality',
      label: '活力满满的分享局',
      icon: '✨'
    });
  } else if (roleCategories.listeners >= 2 && roleCategories.storytellers >= 2) {
    insights.push({
      type: 'personality',
      label: '倾听与分享兼备',
      icon: '💬'
    });
  }
  
  // 🎯 NEW: Diversity balance scoring (60% similarity, 40% difference)
  // Calculate similarity across multiple dimensions
  const calculateDiversityScore = (): number => {
    if (attendees.length < 2) return 0;
    
    let totalDimensions = 0;
    let similarityScore = 0;
    
    // Industry similarity
    if (industries.size > 0) {
      totalDimensions++;
      const industryDiversity = industries.size / attendees.length;
      similarityScore += (1 - industryDiversity); // Higher when fewer industries (more similar)
    }
    
    // Age similarity (within 5 years = similar)
    const ages = attendees.filter(a => a.age).map(a => a.age!);
    if (ages.length >= 2) {
      totalDimensions++;
      const avgAge = ages.reduce((a, b) => a + b, 0) / ages.length;
      const ageVariance = ages.reduce((sum, age) => sum + Math.abs(age - avgAge), 0) / ages.length;
      const ageSimilarity = Math.max(0, 1 - (ageVariance / 10)); // Normalize to 0-1
      similarityScore += ageSimilarity;
    }
    
    // Relationship status similarity
    const relationshipStatuses = new Set(attendees.filter(a => a.relationshipStatus).map(a => a.relationshipStatus!));
    if (relationshipStatuses.size > 0) {
      totalDimensions++;
      const relationshipDiversity = relationshipStatuses.size / attendees.length;
      similarityScore += (1 - relationshipDiversity);
    }
    
    // Education level similarity
    const educationLevels = new Set(attendees.filter(a => a.educationLevel).map(a => a.educationLevel!));
    if (educationLevels.size > 0) {
      totalDimensions++;
      const educationDiversity = educationLevels.size / attendees.length;
      similarityScore += (1 - educationDiversity);
    }
    
    return totalDimensions > 0 ? (similarityScore / totalDimensions) * 100 : 0;
  };
  
  const diversityScore = calculateDiversityScore();
  
  // Ideal range: 50-70% similarity (60% target)
  if (diversityScore >= 50 && diversityScore <= 70) {
    insights.push({
      type: 'balance',
      label: '相似与差异的完美平衡',
      icon: '⚖️'
    });
  } else if (diversityScore >= 70) {
    insights.push({
      type: 'balance',
      label: '背景相似，易产生共鸣',
      icon: '🤝'
    });
  } else if (diversityScore <= 40 && industries.size >= 3) {
    insights.push({
      type: 'balance',
      label: '多元视角碰撞',
      icon: '🌈'
    });
  }
  
  return insights.slice(0, 4);
}

/**
 * Extract connection point types from predictions for feedback correlation
 * This enables tracking which types of connections lead to successful matches
 */
export function extractConnectionPointTypes(predictions: SparkPrediction[]): string[] {
  const types = new Set<string>();
  
  predictions.forEach(prediction => {
    const text = prediction.text.toLowerCase();
    
    // Categorize based on prediction text patterns
    if (text.includes('兴趣') || text.includes('interest') || text.includes('爱好')) {
      types.add('shared_interests');
    }
    if (text.includes('话题') || text.includes('topic')) {
      types.add('shared_topics');
    }
    if (text.includes('辩论') || text.includes('对话风格') || text.includes('debate')) {
      types.add('debate_comfort');
    }
    if (text.includes('行业') || text.includes('industry') || text.includes('职业')) {
      types.add('industry');
    }
    if (text.includes('学历') || text.includes('education')) {
      types.add('education');
    }
    if (text.includes('人生阶段') || text.includes('life_stage') || text.includes('expecting') || text.includes('parent')) {
      types.add('life_stage');
    }
    if (text.includes('语言') || text.includes('language')) {
      types.add('language');
    }
    if (text.includes('性别') || text.includes('gender')) {
      types.add('gender');
    }
    if (text.includes('老乡') || text.includes('hometown')) {
      types.add('hometown');
    }
    if (text.includes('海外') || text.includes('overseas')) {
      types.add('overseas_experience');
    }
    if (text.includes('社交') || text.includes('交友') || text.includes('对话') || text.includes('玩乐') || text.includes('另一半')) {
      types.add('intent_alignment');
    }
    if (text.includes('性格') || text.includes('archetype') || text.includes('角色')) {
      types.add('personality_archetype');
    }
    if (text.includes('沟通风格') || text.includes('communication')) {
      types.add('communication_style');
    }
    if (text.includes('家庭') || text.includes('family')) {
      types.add('family_status');
    }
  });
  
  return Array.from(types);
}

/**
 * Calculate weighted match score with feedback-based adjustments
 * This is where anti-repetition and feedback loop correlation would be applied
 */
export function calculateWeightedMatchScore(
  predictions: SparkPrediction[],
  attendeeId: string,
  userContext: SparkPredictionContext,
  feedbackWeights?: Record<string, number> // Future: from feedback correlation analysis
): number {
  let score = 0;
  const connectionTypes = extractConnectionPointTypes(predictions);
  
  // Base scoring by rarity
  predictions.forEach(prediction => {
    switch (prediction.rarity) {
      case 'epic':
        score += 10;
        break;
      case 'rare':
        score += 5;
        break;
      case 'common':
        score += 2;
        break;
    }
  });
  
  // Apply feedback-based weights (future enhancement)
  if (feedbackWeights) {
    connectionTypes.forEach(type => {
      if (feedbackWeights[type]) {
        score *= feedbackWeights[type];
      }
    });
  }
  
  // Anti-repetition penalty
  if (userContext.userMatchedBefore && userContext.userMatchedBefore.includes(attendeeId)) {
    score *= 0.5; // Reduce score by 50% for repeat matches
  }
  
  return score;
}
