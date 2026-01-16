/**
 * Semantic Fallback Inference System
 * Handles occupation-adjacent inputs and edge cases with intelligent classification
 * 
 * Use cases:
 * - Incomplete inputs: "farmer", "student"
 * - Lifestyle descriptors: "富二代" (rich second generation)
 * - Vague roles: "freelancer", "entrepreneur"
 * - Non-traditional occupations
 */

export interface SemanticRule {
  patterns: RegExp[];
  classification: {
    category: string;
    segment: string;
    niche?: string;
  };
  confidence: number;
  reasoning: string;
}

/**
 * Semantic classification rules for edge cases
 * Organized by category for maintainability
 */
export const SEMANTIC_FALLBACK_RULES: SemanticRule[] = [
  // ========== Agriculture & Farming ==========
  {
    patterns: [/农民|farmer|种地|务农|农业|种植|养殖/i],
    classification: {
      category: "agriculture",
      segment: "farming",
    },
    confidence: 0.85,
    reasoning: "基于农业相关关键词推断为农业从业者"
  },
  
  // ========== Students & Education ==========
  {
    patterns: [/学生|student|在读|大学生|本科|研究生|硕士|博士|phd/i],
    classification: {
      category: "education",
      segment: "student",
    },
    confidence: 0.90,
    reasoning: "识别为在读学生身份"
  },
  {
    patterns: [/实习生|intern|实习/i],
    classification: {
      category: "education",
      segment: "student",
    },
    confidence: 0.88,
    reasoning: "识别为实习生身份"
  },
  
  // ========== Wealth & Family Business ==========
  {
    patterns: [/富二代|接班|家族企业|继承人|富家/i],
    classification: {
      category: "professional_services",
      segment: "consulting",
    },
    confidence: 0.75,
    reasoning: "识别为家族企业接班人或高净值人群，归类为专业服务相关"
  },
  {
    patterns: [/全职主妇|全职太太|家庭主妇|家庭主夫|housewife|stay.?at.?home/i],
    classification: {
      category: "life_services",
      segment: "household",
    },
    confidence: 0.85,
    reasoning: "识别为全职家庭照护者"
  },
  
  // ========== Freelance & Self-Employed ==========
  {
    patterns: [/自由职业|freelance|自由|独立工作|soho/i],
    classification: {
      category: "professional_services",
      segment: "consulting",
    },
    confidence: 0.70,
    reasoning: "识别为自由职业者，归类为专业服务"
  },
  {
    patterns: [/创业|entrepreneur|创始人|founder|老板|自己当老板/i],
    classification: {
      category: "professional_services",
      segment: "consulting",
    },
    confidence: 0.75,
    reasoning: "识别为创业者或企业创始人"
  },
  
  // ========== Retirement & Career Transition ==========
  {
    patterns: [/退休|retired|退休人员|养老/i],
    classification: {
      category: "life_services",
      segment: "household",
    },
    confidence: 0.85,
    reasoning: "识别为退休人员"
  },
  {
    patterns: [/待业|求职|找工作|job.?seeking|失业|待业中/i],
    classification: {
      category: "professional_services",
      segment: "hr",
    },
    confidence: 0.70,
    reasoning: "识别为职业过渡期或求职状态"
  },
  
  // ========== Service Workers ==========
  {
    patterns: [/快递|外卖|delivery|外卖员|快递员|骑手|rider/i],
    classification: {
      category: "logistics",
      segment: "logistics_mgmt",
    },
    confidence: 0.88,
    reasoning: "识别为物流配送相关从业者"
  },
  {
    patterns: [/司机|driver|网约车|滴滴|出租车|taxi/i],
    classification: {
      category: "logistics",
      segment: "logistics_mgmt",
    },
    confidence: 0.85,
    reasoning: "识别为驾驶员或网约车司机"
  },
  {
    patterns: [/保安|security|guard|门卫/i],
    classification: {
      category: "life_services",
      segment: "hospitality",
    },
    confidence: 0.85,
    reasoning: "识别为安保服务人员"
  },
  {
    patterns: [/清洁工|cleaner|保洁|cleaning/i],
    classification: {
      category: "life_services",
      segment: "household",
    },
    confidence: 0.85,
    reasoning: "识别为清洁服务人员"
  },
  
  // ========== Manual Labor ==========
  {
    patterns: [/工人|worker|打工|劳动者|蓝领/i],
    classification: {
      category: "manufacturing",
      segment: "machinery",
    },
    confidence: 0.70,
    reasoning: "识别为制造业或劳动密集型从业者"
  },
  {
    patterns: [/建筑工|construction|工地|施工/i],
    classification: {
      category: "real_estate",
      segment: "construction",
    },
    confidence: 0.85,
    reasoning: "识别为建筑施工相关从业者"
  },
  
  // ========== Government & Public Service ==========
  {
    patterns: [/公务员|civil.?servant|政府|government|公职/i],
    classification: {
      category: "government",
      segment: "public_service",
    },
    confidence: 0.88,
    reasoning: "识别为政府公务员或公职人员"
  },
  {
    patterns: [/军人|soldier|军队|部队|military/i],
    classification: {
      category: "government",
      segment: "military",
    },
    confidence: 0.90,
    reasoning: "识别为军人或军队从业者"
  },
  
  // ========== Influencers & Content Creators ==========
  {
    patterns: [/网红|influencer|up主|博主|kol/i],
    classification: {
      category: "media_creative",
      segment: "content",
    },
    confidence: 0.80,
    reasoning: "识别为网络内容创作者或影响者"
  },
  {
    patterns: [/主播|streamer|直播|live.?stream/i],
    classification: {
      category: "media_creative",
      segment: "live_streaming",
    },
    confidence: 0.85,
    reasoning: "识别为直播主播或内容创作者"
  },
  
  // ========== Artists & Performers ==========
  {
    patterns: [/演员|actor|actress|表演|演艺/i],
    classification: {
      category: "culture_sports",
      segment: "performing_arts",
    },
    confidence: 0.85,
    reasoning: "识别为演艺人员或表演者"
  },
  {
    patterns: [/歌手|singer|音乐人|musician/i],
    classification: {
      category: "culture_sports",
      segment: "performing_arts",
      niche: "musician",
    },
    confidence: 0.88,
    reasoning: "识别为音乐相关从业者"
  },
  {
    patterns: [/画家|painter|artist|艺术家/i],
    classification: {
      category: "media_creative",
      segment: "design",
    },
    confidence: 0.85,
    reasoning: "识别为艺术创作者"
  },
  
  // ========== Sports & Fitness ==========
  {
    patterns: [/运动员|athlete|体育|sports/i],
    classification: {
      category: "culture_sports",
      segment: "sports",
      niche: "professional_athlete",
    },
    confidence: 0.88,
    reasoning: "识别为运动员或体育从业者"
  },
  {
    patterns: [/教练|coach|健身教练|fitness/i],
    classification: {
      category: "culture_sports",
      segment: "sports",
      niche: "fitness_coach",
    },
    confidence: 0.85,
    reasoning: "识别为教练或健身相关从业者"
  },
  
  // ========== Food & Service Industry ==========
  {
    patterns: [/厨师|chef|cook|烹饪|餐饮/i],
    classification: {
      category: "consumer_retail",
      segment: "food_service",
      niche: "chef",
    },
    confidence: 0.88,
    reasoning: "识别为烹饪或餐饮从业者"
  },
  {
    patterns: [/服务员|waiter|waitress|前台|reception/i],
    classification: {
      category: "life_services",
      segment: "hospitality",
    },
    confidence: 0.85,
    reasoning: "识别为服务行业从业者"
  },
];

/**
 * Apply semantic fallback inference to user input
 * Returns classification if any rule matches, null otherwise
 */
export function applySemanticFallback(
  userInput: string
): {
  category: string;
  segment: string;
  niche?: string;
  confidence: number;
  reasoning: string;
} | null {
  const input = userInput.trim().toLowerCase();
  
  // Try each semantic rule
  for (const rule of SEMANTIC_FALLBACK_RULES) {
    for (const pattern of rule.patterns) {
      if (pattern.test(input)) {
        return {
          ...rule.classification,
          confidence: rule.confidence,
          reasoning: rule.reasoning,
        };
      }
    }
  }
  
  return null;
}

/**
 * Check if input appears to be a lifestyle descriptor or edge case
 * that should use semantic fallback
 */
export function isSemanticEdgeCase(userInput: string): boolean {
  const edgeCasePatterns = [
    /^[^a-z\u4e00-\u9fa5]{0,2}$/i, // Too short (1-2 chars, non-alphanumeric)
    /富二代|学生|农民|退休|待业|求职/,
    /freelance|自由职业|创业|entrepreneur/i,
    /^(the|a|an)\s+/i, // Articles
  ];
  
  return edgeCasePatterns.some(pattern => pattern.test(userInput.trim()));
}
