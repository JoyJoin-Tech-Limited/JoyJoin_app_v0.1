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

const sparkPredictions: Record<string, string> = {
  "电影": "共同影迷",
  "旅行": "旅行搭子",
  "美食": "美食探店搭档",
  "音乐": "音乐知音",
  "阅读": "书友",
  "艺术": "艺术鉴赏伙伴",
  "运动": "运动伙伴",
  "健身": "健身搭子",
  "摄影": "摄影同好",
  "游戏": "游戏战友",
  "科技": "科技发烧友",
  "Film": "Movie Buddies",
  "Travel": "Travel Companions",
  "Food": "Foodie Friends",
  "Music": "Music Lovers",
  "Reading": "Book Club",
  "Art": "Art Enthusiasts",
  "Sports": "Sports Partners",
  "Fitness": "Gym Buddies",
  "Photography": "Photo Pals",
  "Gaming": "Gaming Partners",
  // English interest keys
  "film_entertainment": "共同影迷",
  "travel_exploration": "旅行搭子",
  "food_dining": "美食探店搭档",
  "music_concerts": "音乐知音",
  "reading_books": "书友",
  "art_culture": "艺术鉴赏伙伴",
  "sports_fitness": "运动伙伴",
  "fitness_health": "健身搭子",
  "photography": "摄影同好",
  "gaming": "游戏战友",
  "technology": "科技发烧友",
  "entrepreneurship": "创业搭档",
  "networking": "社交达人",
  "outdoor_activities": "户外探险伙伴",
  "yoga_meditation": "身心修炼伙伴",
  "wine_spirits": "品酒搭子",
  "coffee_tea": "咖啡/茶友",
  "cooking_baking": "下厨搭档",
};

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
function userContextToSparkContext(ctx: UserContext): SparkPredictionContext {
  return {
    userInterests: ctx.interests,
    userPrimaryInterests: ctx.primaryInterests,
    userTopicsHappy: ctx.topicsHappy,
    userTopicsAvoid: ctx.topicsAvoid,
    userTopicAvoidances: ctx.topicAvoidances,
    userDebateComfort: ctx.debateComfort,
    userEducationLevel: ctx.educationLevel,
    userIndustry: ctx.industry,
    userAge: ctx.age,
    userGender: ctx.gender,
    userRelationshipStatus: ctx.relationshipStatus,
    userChildren: ctx.children,
    userStudyLocale: ctx.studyLocale,
    userOverseasRegions: ctx.overseasRegions,
    userSeniority: ctx.seniority,
    userFieldOfStudy: ctx.fieldOfStudy,
    userLanguages: ctx.languages,
    userHometownCountry: ctx.hometownCountry,
    userHometownRegionCity: ctx.hometownRegionCity,
    userHometownAffinityOptin: ctx.hometownAffinityOptin,
    userArchetype: ctx.archetype,
    userIntent: ctx.intent,
    userMatchedBefore: ctx.matchedBefore,
    userCuisinePreference: ctx.cuisinePreference,
    userFavoriteRestaurant: ctx.favoriteRestaurant,
    userDialectProfile: ctx.dialectProfile,
  };
}

export function generateSparkPredictions(
  userContext: SparkPredictionContext | UserContext,
  attendee: AttendeeData
): SparkPrediction[] {
  // Convert UserContext to SparkPredictionContext if needed
  const ctx: SparkPredictionContext = 'userInterests' in userContext 
    ? userContext as SparkPredictionContext
    : userContextToSparkContext(userContext as UserContext);
  
  const predictions: SparkPrediction[] = [];
  
  // Priority 1: Interest-based predictions (most interesting and hidden)
  if (ctx.userInterests && attendee.topInterests) {
    const userSet = new Set(ctx.userInterests);
    const commonInterests = attendee.topInterests.filter((interest) =>
      userSet.has(interest)
    );
    
    // Interests are COMMON - many people share common interests
    const interestPredictions = commonInterests
      .map((interest) => sparkPredictions[interest])
      .filter((prediction): prediction is string => !!prediction)
      .slice(0, 3)
      .map(text => ({ text, rarity: 'common' as RarityLevel }));
    
    predictions.push(...interestPredictions);
  }
  
  // Priority 2: Study locale - Overseas experience (RARE - hidden info)
  if (ctx.userStudyLocale === "Overseas" && attendee.studyLocale === "Overseas") {
    predictions.push({ text: "都有海外留学经历", rarity: 'rare' });
  } else if (ctx.userStudyLocale === "Both" && attendee.studyLocale === "Both") {
    predictions.push({ text: "都有海外+国内学习经历", rarity: 'epic' }); // Very rare combination
  } else if (ctx.userStudyLocale && attendee.studyLocale && 
             ctx.userStudyLocale !== attendee.studyLocale) {
    // Different study backgrounds can also be interesting
    if ((ctx.userStudyLocale === "Overseas" && attendee.studyLocale === "Both") ||
        (ctx.userStudyLocale === "Both" && attendee.studyLocale === "Overseas")) {
      predictions.push({ text: "都有国际化视野", rarity: 'rare' });
    }
  }
  
  // Priority 3: Seniority-based predictions (RARE - career stage not obvious)
  if (ctx.userSeniority && attendee.seniority) {
    if (ctx.userSeniority === "Founder" && attendee.seniority === "Founder") {
      predictions.push({ text: "同为创业者", rarity: 'epic' }); // Founders are rare
    } else if (
      (ctx.userSeniority === "Senior" || ctx.userSeniority === "Executive") &&
      (attendee.seniority === "Senior" || attendee.seniority === "Executive")
    ) {
      predictions.push({ text: "都是职场老司机", rarity: 'rare' });
    } else if (
      ctx.userSeniority === "Junior" && attendee.seniority === "Junior"
    ) {
      predictions.push({ text: "都是职场新人", rarity: 'common' });
    } else if (
      ctx.userSeniority === "Mid" && attendee.seniority === "Mid"
    ) {
      predictions.push({ text: "职场中坚力量", rarity: 'common' });
    }
  }
  
  // Priority 4: Relationship status (COMMON - hidden but common)
  if (ctx.userRelationshipStatus && attendee.relationshipStatus) {
    if (ctx.userRelationshipStatus === "Married/Partnered" && 
        attendee.relationshipStatus === "Married/Partnered") {
      predictions.push({ text: "同为有伴一族", rarity: 'common' });
    } else if (ctx.userRelationshipStatus === "Single" && 
               attendee.relationshipStatus === "Single") {
      predictions.push({ text: "同为单身贵族", rarity: 'common' });
    }
  }
  
  // Priority 5: Education level (RARE/EPIC - advanced degrees)
  if (ctx.userEducationLevel && attendee.educationLevel) {
    if (ctx.userEducationLevel === attendee.educationLevel) {
      if (ctx.userEducationLevel === "Doctorate") {
        predictions.push({ text: "同为博士学历", rarity: 'epic' }); // PhDs are rare
      } else if (ctx.userEducationLevel === "Master's") {
        predictions.push({ text: "同为硕士学历", rarity: 'rare' });
      }
    }
  }
  
  // Priority 6: Age similarity (COMMON - life stage alignment)
  if (ctx.userAge && attendee.age) {
    const ageDiff = Math.abs(ctx.userAge - attendee.age);
    if (ageDiff <= 3) {
      predictions.push({ text: "年龄相近", rarity: 'common' });
    }
  }
  
  // Priority 6.5: Gender matching (COMMON - identity connection)
  if (ctx.userGender && attendee.gender && 
      ctx.userGender === attendee.gender &&
      ctx.userGender !== "Prefer not to say") {
    const genderLabels: Record<string, string> = {
      "Woman": "同为女性",
      "Man": "同为男性",
      "Nonbinary": "同为非二元性别"
    };
    
    if (genderLabels[ctx.userGender]) {
      predictions.push({ 
        text: genderLabels[ctx.userGender], 
        rarity: 'common' 
      });
    }
  }
  
  // Priority 6.6: Children/Family status matching (RARE/EPIC - life stage connection)
  if (ctx.userChildren && attendee.children && 
      ctx.userChildren !== "Prefer not to say" &&
      attendee.children !== "Prefer not to say") {
    
    if (ctx.userChildren === "Expecting" && attendee.children === "Expecting") {
      predictions.push({ text: "都在期待新生命", rarity: 'epic' }); // Very specific life stage
    } else if (ctx.userChildren === attendee.children && ctx.userChildren !== "No kids") {
      const childrenLabels: Record<string, { text: string; rarity: RarityLevel }> = {
        "0-5": { text: "都有学龄前孩子", rarity: 'rare' },
        "6-12": { text: "都有小学阶段的孩子", rarity: 'rare' },
        "13-18": { text: "都有青少年孩子", rarity: 'rare' },
        "Adult": { text: "都有成年子女", rarity: 'rare' }
      };
      
      if (childrenLabels[ctx.userChildren]) {
        predictions.push(childrenLabels[ctx.userChildren]);
      }
    } else if (ctx.userChildren === "No kids" && attendee.children === "No kids") {
      predictions.push({ text: "都是丁克一族", rarity: 'common' });
    }
  }
  
  // Priority 6.7: Specific overseas regions matching (RARE - deeper connection than just "Overseas")
  if (ctx.userOverseasRegions && ctx.userOverseasRegions.length > 0 &&
      attendee.overseasRegions && attendee.overseasRegions.length > 0) {
    
    const commonRegions = ctx.userOverseasRegions.filter(region => 
      attendee.overseasRegions!.includes(region)
    );
    
    if (commonRegions.length > 0) {
      const regionLabels: Record<string, string> = {
        "North America": "北美",
        "Europe": "欧洲",
        "East Asia (excl. China)": "东亚",
        "Southeast Asia": "东南亚",
        "Oceania": "大洋洲",
        "South America": "南美",
        "Africa": "非洲",
        "Middle East": "中东"
      };
      
      const firstRegion = commonRegions[0];
      const regionName = regionLabels[firstRegion] || firstRegion;
      
      predictions.push({ 
        text: `都在${regionName}留过学`, 
        rarity: 'rare' 
      });
    }
  }
  
  // Priority 7: Hometown matching (RARE/EPIC - 老乡 connection, default enabled)
  // Only match if both users have opted in (default is true, so most will match)
  const userOptedIn = ctx.userHometownAffinityOptin !== false; // default true
  const attendeeOptedIn = attendee.hometownAffinityOptin !== false; // default true
  
  if (userOptedIn && attendeeOptedIn) {
    // Same city/region - EPIC (very specific)
    if (ctx.userHometownRegionCity && attendee.hometownRegionCity &&
        ctx.userHometownRegionCity === attendee.hometownRegionCity) {
      predictions.push({ 
        text: `老乡！都来自${ctx.userHometownRegionCity}`, 
        rarity: 'epic' 
      });
    }
    // Same country but different cities - RARE
    else if (ctx.userHometownCountry && attendee.hometownCountry &&
             ctx.userHometownCountry === attendee.hometownCountry &&
             ctx.userHometownCountry !== "中国") { // China is too broad to be rare
      const countryLabels: Record<string, string> = {
        "美国": "美国",
        "英国": "英国",
        "加拿大": "加拿大",
        "澳大利亚": "澳大利亚",
        "新加坡": "新加坡",
        "日本": "日本",
        "韩国": "韩国"
      };
      
      const countryName = countryLabels[ctx.userHometownCountry] || ctx.userHometownCountry;
      predictions.push({ 
        text: `都来自${countryName}`, 
        rarity: 'rare' 
      });
    }
  }
  
  // Priority 8: Archetype matching (COMMON - personality alignment)
  if (attendee.archetype) {
    const archetypeMatches: Record<string, { compatible: string[]; text: string; rarity: RarityLevel }> = {
      "探索者": { 
        compatible: ["探索者", "发光体"], 
        text: "都喜欢探索新鲜事物",
        rarity: 'common'
      },
      "讲故事的人": { 
        compatible: ["讲故事的人", "智者"], 
        text: "都擅长分享与倾听",
        rarity: 'common'
      },
      "智者": { 
        compatible: ["智者", "讲故事的人"], 
        text: "都享受深度对话",
        rarity: 'common'
      },
      "发光体": { 
        compatible: ["发光体", "探索者"], 
        text: "都是活力满满的人",
        rarity: 'common'
      },
      "稳定器": { 
        compatible: ["稳定器", "智者"], 
        text: "都是可靠的伙伴",
        rarity: 'common'
      },
    };
    
    // Check if archetypes are compatible
    const userArchetype = Object.keys(archetypeMatches).find(key => 
      archetypeMatches[key].compatible.includes(attendee.archetype!)
    );
    
    if (userArchetype && archetypeMatches[userArchetype]) {
      predictions.push({ 
        text: archetypeMatches[userArchetype].text,
        rarity: archetypeMatches[userArchetype].rarity
      });
    }
  }
  
  // Priority 9: Industry matching (RARE - professional connection, but only if different from obvious info)
  if (ctx.userIndustry && attendee.industry && 
      ctx.userIndustry === attendee.industry &&
      !attendee.industryVisible) { // Only if industry not visible on card front
    
    const industryNames: Record<string, { text: string; rarity: RarityLevel }> = {
      "科技": { text: "都在科技圈", rarity: 'rare' },
      "金融": { text: "都在金融圈", rarity: 'rare' },
      "艺术": { text: "都在艺术领域", rarity: 'rare' },
      "医疗": { text: "都在医疗行业", rarity: 'rare' },
      "教育": { text: "都在教育行业", rarity: 'rare' },
    };
    
    if (industryNames[ctx.userIndustry]) {
      predictions.push({ 
        text: industryNames[ctx.userIndustry].text,
        rarity: industryNames[ctx.userIndustry].rarity
      });
    }
  }
  
  // Priority 10: Epic-level compound matches (multi-dimensional alignment)
  // These require 3+ factors to align - extremely rare
  
  // Triple match: Industry + Education + Study Locale (EPIC)
  if (ctx.userIndustry && attendee.industry &&
      ctx.userEducationLevel && attendee.educationLevel &&
      ctx.userStudyLocale && attendee.studyLocale &&
      ctx.userIndustry === attendee.industry &&
      ctx.userEducationLevel === "Master's" && attendee.educationLevel === "Master's" &&
      ctx.userStudyLocale === "Overseas" && attendee.studyLocale === "Overseas") {
    predictions.push({ 
      text: `同为${ctx.userIndustry}圈的硕士海归`,
      rarity: 'epic'
    });
  }
  
  // 🌟 NEW Epic-level predictions - Ultra-rare combinations
  
  // Creative interdisciplinary background (EPIC)
  if (ctx.userFieldOfStudy && attendee.fieldOfStudy) {
    const creativeFields = ["Arts/Design", "Music", "Film"];
    const techFields = ["CS", "Engineering"];
    const businessFields = ["Business", "Economics"];
    
    const userIsCreative = creativeFields.includes(ctx.userFieldOfStudy);
    const userIsTech = techFields.includes(ctx.userFieldOfStudy);
    const userIsBusiness = businessFields.includes(ctx.userFieldOfStudy);
    
    const attendeeIsCreative = creativeFields.includes(attendee.fieldOfStudy);
    const attendeeIsTech = techFields.includes(attendee.fieldOfStudy);
    const attendeeIsBusiness = businessFields.includes(attendee.fieldOfStudy);
    
    // Creative + Tech crossover
    if ((userIsCreative && attendeeIsTech) || (userIsTech && attendeeIsCreative)) {
      predictions.push({ 
        text: "跨界创意×技术的碰撞",
        rarity: 'epic'
      });
    }
    
    // Creative + Business crossover
    if ((userIsCreative && attendeeIsBusiness) || (userIsBusiness && attendeeIsCreative)) {
      predictions.push({ 
        text: "艺术与商业的融合",
        rarity: 'epic'
      });
    }
  }
  
  // Digital nomad lifestyle (EPIC)
  if (ctx.userInterests && attendee.topInterests) {
    const userHasRemoteWork = ctx.userInterests.some(i => 
      i.includes("远程工作") || i.includes("数字游民") || i.includes("自由职业")
    );
    const attendeeHasRemoteWork = attendee.topInterests.some(i => 
      i.includes("远程工作") || i.includes("数字游民") || i.includes("自由职业")
    );
    
    if (userHasRemoteWork && attendeeHasRemoteWork) {
      predictions.push({ 
        text: "同为数字游民一族",
        rarity: 'epic'
      });
    }
  }
  
  // Social impact orientation (EPIC)
  if (ctx.userInterests && attendee.topInterests) {
    const userHasSocialImpact = ctx.userInterests.some(i => 
      i.includes("公益") || i.includes("社会创新") || i.includes("可持续") || i.includes("环保")
    );
    const attendeeHasSocialImpact = attendee.topInterests.some(i => 
      i.includes("公益") || i.includes("社会创新") || i.includes("可持续") || i.includes("环保")
    );
    
    if (userHasSocialImpact && attendeeHasSocialImpact) {
      predictions.push({ 
        text: "都在做有意义的事",
        rarity: 'epic'
      });
    }
  }
  
  // Artistic creation experience (EPIC)
  if (ctx.userInterests && attendee.topInterests) {
    const artisticInterests = ["绘画", "摄影", "写作", "音乐创作", "设计"];
    
    const userArtisticCount = ctx.userInterests.filter(i => 
      artisticInterests.some(art => i.includes(art))
    ).length;
    
    const attendeeArtisticCount = attendee.topInterests.filter(i => 
      artisticInterests.some(art => i.includes(art))
    ).length;
    
    if (userArtisticCount >= 2 && attendeeArtisticCount >= 2) {
      predictions.push({ 
        text: "同为创作型灵魂",
        rarity: 'epic'
      });
    }
  }
  
  // Career transition journey (EPIC)
  if (ctx.userSeniority === "Founder" && attendee.seniority === "Founder" &&
      ctx.userIndustry && attendee.industry &&
      ctx.userIndustry !== attendee.industry) {
    predictions.push({ 
      text: "都在跨界创业",
      rarity: 'epic'
    });
  }
  
  // Multi-city living experience (EPIC - based on language diversity)
  if (ctx.userLanguages && attendee.languagesComfort) {
    const userLangCount = ctx.userLanguages.length;
    const attendeeLangCount = attendee.languagesComfort.length;
    
    if (userLangCount >= 3 && attendeeLangCount >= 3) {
      predictions.push({ 
        text: "都是多元文化的探索者",
        rarity: 'epic'
      });
    }
  }
  
  // 🎯 NEW PRIORITY FEATURES - Using collected but previously unused data
  
  // Priority 1.5: Topics matching - RARE/EPIC (more specific than interests)
  if (ctx.userTopicsHappy && ctx.userTopicsHappy.length > 0 &&
      attendee.topicsHappy && attendee.topicsHappy.length > 0) {
    
    const commonTopics = ctx.userTopicsHappy.filter(topic => 
      attendee.topicsHappy!.includes(topic)
    );
    
    if (commonTopics.length >= 3) {
      predictions.push({ 
        text: `有${commonTopics.length}个共同想聊的话题`, 
        rarity: 'epic' 
      });
    } else if (commonTopics.length === 2) {
      predictions.push({ 
        text: "有多个共同话题", 
        rarity: 'rare' 
      });
    }
  }
  
  // Priority 0: Topics anti-matching - CRITICAL (prevent disasters early)
  // Check if someone's happy topic is another's avoid topic
  if (ctx.userTopicsHappy && attendee.topicsAvoid) {
    const hasConflict = ctx.userTopicsHappy.some(topic => 
      attendee.topicsAvoid!.includes(topic)
    );
    if (hasConflict) {
      // This is a red flag - reduce match quality by adding a negative indicator
      // We don't add this as a connection point, but it affects overall compatibility
    }
  }
  if (ctx.userTopicsAvoid && attendee.topicsHappy) {
    const hasConflict = ctx.userTopicsAvoid.some(topic => 
      attendee.topicsHappy!.includes(topic)
    );
    if (hasConflict) {
      // Another red flag
    }
  }
  
  // Priority 6.8: Debate comfort alignment - COMMON/RARE (conversation style match)
  if (ctx.userDebateComfort !== undefined && attendee.debateComfort !== undefined) {
    const diff = Math.abs(ctx.userDebateComfort - attendee.debateComfort);
    
    if (diff === 0) {
      predictions.push({ 
        text: "讨论风格完全一致", 
        rarity: 'rare' 
      });
    } else if (diff === 1) {
      predictions.push({ 
        text: "讨论风格相近", 
        rarity: 'rare' 
      });
    } else if (diff === 2) {
      predictions.push({ 
        text: "讨论节奏相仿", 
        rarity: 'common' 
      });
    }
    // diff > 2 means different debate styles - might create tension
  }
  
  // Priority 6.9: Life stage/transition detection - RARE/EPIC
  // Prefer explicit workMode; fall back to inferring from age/children/seniority data
  const detectLifeStage = (age?: number, children?: string, seniority?: string, relationshipStatus?: string, workMode?: string): string | null => {
    // Prefer explicit workMode over inference
    if (workMode) {
      const workModeToStage: Record<string, string> = {
        founder: 'entrepreneur',
        self_employed: 'freelancer',
        employed: 'career_prime',
        student: 'early_career',
        transitioning: 'career_transition',
        caregiver_retired: 'empty_nester',
        successor: 'successor',
      };
      return workModeToStage[workMode] || null;
    }

    if (children === "Expecting") return "expecting_parent";
    if (children === "0-5") return "new_parent";
    if (children === "6-12") return "school_age_parent";
    if (children === "13-18") return "teen_parent";
    if (children === "Adult") return "empty_nester";
    
    if (seniority === "Founder") return "entrepreneur";
    if (age && age >= 25 && age <= 30 && seniority === "Junior") return "early_career";
    if (age && age >= 30 && age <= 35 && (seniority === "Mid" || seniority === "Senior")) return "career_prime";
    if (age && age >= 35 && age <= 45 && seniority === "Senior") return "established_professional";
    
    if (relationshipStatus === "Single" && age && age >= 30) return "single_professional";
    
    return null;
  };
  
  const userStage = detectLifeStage(
    ctx.userAge, 
    ctx.userChildren, 
    ctx.userSeniority,
    ctx.userRelationshipStatus,
    ctx.userWorkMode
  );
  const attendeeStage = detectLifeStage(
    attendee.age, 
    attendee.children, 
    attendee.seniority,
    attendee.relationshipStatus,
    attendee.workMode
  );
  
  if (userStage && attendeeStage && userStage === attendeeStage) {
    const stageLabels: Record<string, { text: string; rarity: RarityLevel }> = {
      "expecting_parent": { text: "都在期待新生命到来", rarity: 'epic' },
      "new_parent": { text: "都在经历新手父母阶段", rarity: 'rare' },
      "school_age_parent": { text: "都有学龄儿童", rarity: 'rare' },
      "teen_parent": { text: "都在应对青春期挑战", rarity: 'rare' },
      "empty_nester": { text: "孩子都已独立", rarity: 'rare' },
      "entrepreneur": { text: "都在创业路上", rarity: 'epic' },
      "freelancer": { text: "都是自由职业者", rarity: 'rare' },
      "early_career": { text: "都在职场起步期", rarity: 'common' },
      "career_prime": { text: "都处于事业黄金期", rarity: 'rare' },
      "career_transition": { text: "都在探索新方向", rarity: 'rare' },
      "established_professional": { text: "都是资深职场人", rarity: 'rare' },
      "single_professional": { text: "都是独立职场人", rarity: 'common' },
      "successor": { text: "都在准备继承家族事业", rarity: 'epic' },
    };
    
    if (stageLabels[userStage]) {
      predictions.push(stageLabels[userStage]);
    }
  }
  
  // Priority 6.10: Enhanced language matching beyond Chinese/English - RARE
  if (ctx.userLanguages && ctx.userLanguages.length > 0 &&
      attendee.languagesComfort && attendee.languagesComfort.length > 0) {
    
    const commonLanguages = ctx.userLanguages.filter(lang => 
      attendee.languagesComfort!.includes(lang)
    );
    
    // Filter out common languages (Chinese, Mandarin, Cantonese, English)
    const specialLanguages = commonLanguages.filter(lang => 
      !["中文", "普通话", "粤语", "Mandarin", "Cantonese", "English", "英语"].includes(lang)
    );
    
    if (specialLanguages.length >= 2) {
      predictions.push({ 
        text: `都会多种语言`, 
        rarity: 'rare' 
      });
    } else if (specialLanguages.length === 1) {
      predictions.push({ 
        text: `都会${specialLanguages[0]}`, 
        rarity: 'rare' 
      });
    }
  }
  
  // Priority 6.11: Communication style matching - COMMON/RARE
  // Derived from archetype + debate comfort + personality traits
  const detectCommunicationStyle = (archetype?: string, debateComfort?: number): string | null => {
    if (!archetype) return null;
    
    // Storytellers: 讲故事的人, 智者 (prefer narrative, sharing experiences)
    if (["讲故事的人", "智者"].includes(archetype)) {
      return debateComfort && debateComfort >= 5 ? "passionate_storyteller" : "gentle_storyteller";
    }
    
    // Listeners: 稳定器, 协调者 (prefer listening, asking questions)
    if (["稳定器", "协调者", "肯定者"].includes(archetype)) {
      return "empathetic_listener";
    }
    
    // Energizers: 发光体, 火花塞, 氛围组 (high energy, expressive)
    if (["发光体", "火花塞", "氛围组"].includes(archetype)) {
      return "energetic_expressive";
    }
    
    // Questioners: 探索者, 挑战者 (curious, probing)
    if (["探索者", "挑战者"].includes(archetype)) {
      return debateComfort && debateComfort >= 6 ? "challenger" : "curious_questioner";
    }
    
    // Connectors: 连接者
    if (archetype === "连接者") {
      return "facilitator";
    }
    
    return null;
  };
  
  const userCommStyle = detectCommunicationStyle(ctx.userArchetype, ctx.userDebateComfort);
  const attendeeCommStyle = detectCommunicationStyle(attendee.archetype, attendee.debateComfort);
  
  if (userCommStyle && attendeeCommStyle) {
    // Same style = easy rapport
    if (userCommStyle === attendeeCommStyle) {
      const styleLabels: Record<string, string> = {
        "passionate_storyteller": "都是热情的分享者",
        "gentle_storyteller": "都善于娓娓道来",
        "empathetic_listener": "都是善解人意的倾听者",
        "energetic_expressive": "都是活力四射的表达者",
        "challenger": "都喜欢思辨讨论",
        "curious_questioner": "都是好奇的提问者",
        "facilitator": "都善于连接他人"
      };
      
      if (styleLabels[userCommStyle]) {
        predictions.push({ 
          text: styleLabels[userCommStyle], 
          rarity: 'common' 
        });
      }
    }
    // Complementary styles = balanced conversation
    else if (
      (userCommStyle.includes("storyteller") && attendeeCommStyle === "empathetic_listener") ||
      (attendeeCommStyle.includes("storyteller") && userCommStyle === "empathetic_listener")
    ) {
      predictions.push({ 
        text: "分享者与倾听者的平衡", 
        rarity: 'rare' 
      });
    }
  }
  
  // 🎯 Intent-based matching - flexible and specific intents
  // Logic: 
  // - Both "flexible" → common (both open-minded, good chemistry)
  // - "flexible" + specific → neutral (no bonus, flexible people adapt)
  // - Same specific intent → rare/epic (strong alignment)
  // - Different specific intents → neutral (no forced mismatch)
  if (ctx.userIntent && ctx.userIntent.length > 0 && 
      attendee.intent && attendee.intent.length > 0) {
    const intentLabels: Record<string, { text: string; rarity: RarityLevel }> = {
      "flexible": { text: "都保持开放心态", rarity: 'common' },
      "networking": { text: "都为职业社交而来", rarity: 'rare' },
      "friends": { text: "都想认识新朋友", rarity: 'rare' },
      "discussion": { text: "都期待深度对话", rarity: 'rare' },
      "fun": { text: "都想轻松玩乐", rarity: 'common' },
      "romance": { text: "都在寻找另一半", rarity: 'epic' }
    };
    
    // Find common intents between user and attendee
    const commonIntents = ctx.userIntent.filter(i => attendee.intent?.includes(i));
    
    // Add connection points for matching intents (prioritize higher rarity)
    const rarityOrder: RarityLevel[] = ['epic', 'rare', 'common'];
    for (const rarity of rarityOrder) {
      for (const intent of commonIntents) {
        if (intentLabels[intent] && intentLabels[intent].rarity === rarity) {
          predictions.push(intentLabels[intent]);
          break; // Only add one intent match to avoid spam
        }
      }
      if (predictions.some(p => commonIntents.some(i => intentLabels[i]?.text === p.text))) break;
    }
  }
  
  // 🎯 Anti-repetition scoring - penalize if matched before
  if (ctx.userMatchedBefore && ctx.userMatchedBefore.includes(attendee.userId)) {
    // This person has been matched with the user before
    // We don't add a negative connection point, but the backend matching algorithm
    // should use this information to lower their overall match score
    // and prioritize fresh connections instead
  }
  
  // 🍜 NEW: Cuisine preference matching - great icebreaker topic
  if (ctx.userCuisinePreference && ctx.userCuisinePreference.length > 0 &&
      attendee.cuisinePreference && attendee.cuisinePreference.length > 0) {
    const commonCuisines = ctx.userCuisinePreference.filter(c => 
      attendee.cuisinePreference?.includes(c)
    );
    
    if (commonCuisines.length > 0) {
      // Use the first common cuisine for the label
      const cuisineLabel = commonCuisines[0];
      predictions.push({
        text: `都爱${cuisineLabel}`,
        rarity: commonCuisines.length >= 2 ? 'rare' : 'common'
      });
    }
  }
  
  // 🍽️ NEW: Favorite restaurant matching - epic connection if same restaurant
  if (ctx.userFavoriteRestaurant && attendee.favoriteRestaurant) {
    // Normalize restaurant names for comparison (remove spaces, lowercase)
    const normalizeRestaurant = (name: string) => name.toLowerCase().replace(/\s+/g, '');
    if (normalizeRestaurant(ctx.userFavoriteRestaurant) === 
        normalizeRestaurant(attendee.favoriteRestaurant)) {
      predictions.push({
        text: `同粉${attendee.favoriteRestaurant}`,
        rarity: 'epic'
      });
    }
  }
  
  // 🗣️ NEW: Dialect matching - 老乡加分 (laoxiang bonus)
  if (ctx.userDialectProfile && ctx.userDialectProfile.length > 0 &&
      attendee.dialectProfile && attendee.dialectProfile.length > 0) {
    const commonDialects = ctx.userDialectProfile.filter(d => 
      attendee.dialectProfile?.includes(d)
    );
    
    if (commonDialects.length > 0) {
      // Same dialect = strong connection (老乡效应)
      const dialectLabel = commonDialects[0];
      const dialectDisplayNames: Record<string, string> = {
        'cantonese': '粤语老乡',
        'hokkien': '闽南老乡',
        'hakka': '客家老乡',
        'teochew': '潮汕老乡',
        'shanghainese': '上海老乡',
        'sichuanese': '川渝老乡',
        'northeastern': '东北老乡',
        'hunan': '湖南老乡'
      };
      predictions.push({
        text: dialectDisplayNames[dialectLabel] || `都说${dialectLabel}`,
        rarity: 'rare'
      });
    } else if (ctx.userDialectProfile.length > 0 && attendee.dialectProfile.length > 0) {
      // Both have dialect backgrounds but different = 移民共鸣
      predictions.push({
        text: '都有方言背景',
        rarity: 'common'
      });
    }
  }
  
  // Sort by rarity (epic > rare > common) and return top 10
  const rarityWeight: Record<RarityLevel, number> = { epic: 3, rare: 2, common: 1 };
  predictions.sort((a, b) => rarityWeight[b.rarity] - rarityWeight[a.rarity]);
  
  return predictions.slice(0, 10);
}

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
