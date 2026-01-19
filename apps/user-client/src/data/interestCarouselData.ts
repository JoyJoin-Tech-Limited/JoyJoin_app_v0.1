/**
 * Interest Categories & Topics for Carousel-based Interest Selection
 * 6 categories with optimized topics = 56 total topics (10+8+10+9+10+9)
 * Each topic has 3 heat levels (1, 2, 3) with associated heat values (3, 10, 25)
 */

export const HEAT_LEVELS = {
  0: { heat: 0, label: "未选择", color: "gray" },
  1: { heat: 3, label: "有兴趣", color: "purple" },         // Low interest - minimal heat
  2: { heat: 10, label: "很喜欢", color: "pink" },          // Medium interest - 3x multiplier
  3: { heat: 25, label: "很热爱", color: "orange" },        // High interest - 2.5x multiplier (total 8.3x from base)
} as const;

// Heat progression rationale:
// - Level 1 (3 heat): Base value for showing interest
// - Level 2 (10 heat): Stronger signal (3.3x), indicates deliberate selection
// - Level 3 (25 heat): Maximum passion (2.5x from L2), reserved for top priorities
// This creates a meaningful differentiation where a few level-3 selections
// can outweigh many level-1 selections in matching algorithms

export type HeatLevel = 0 | 1 | 2 | 3;

/**
 * Type guard to validate if a number is a valid HeatLevel
 */
export function isValidHeatLevel(value: number): value is HeatLevel {
  return value === 0 || value === 1 || value === 2 || value === 3;
}

export interface InterestTopic {
  id: string;
  emoji: string;
  label: string;
  fullName: string;
  category: string;
  categoryId: string;
}

export interface InterestCategory {
  id: string;
  name: string;
  emoji: string;
  topics: InterestTopic[];
}

export const INTEREST_CATEGORIES: InterestCategory[] = [
  {
    id: "career",
    name: "职场野心",
    emoji: "💼",
    topics: [
      { id: "career_startup", emoji: "🚀", label: "创业（做自己的事）", fullName: "创业（做自己的事）", category: "职场野心", categoryId: "career" },
      { id: "career_side_hustle", emoji: "📈", label: "副业探索", fullName: "副业探索", category: "职场野心", categoryId: "career" },
      { id: "career_investment", emoji: "💹", label: "投资理财", fullName: "投资理财", category: "职场野心", categoryId: "career" },
      { id: "career_business", emoji: "💡", label: "商业思维", fullName: "商业思维", category: "职场野心", categoryId: "career" },
      { id: "career_promotion", emoji: "🎯", label: "职业成长", fullName: "职业成长", category: "职场野心", categoryId: "career" },
      { id: "career_networking", emoji: "🤝", label: "人脉与合作", fullName: "人脉与合作", category: "职场野心", categoryId: "career" },
      { id: "career_data", emoji: "📊", label: "用数据看世界", fullName: "用数据看世界", category: "职场野心", categoryId: "career" },
      { id: "career_product_design", emoji: "🧩", label: "产品与设计交流", fullName: "产品与设计交流", category: "职场野心", categoryId: "career" },
      { id: "career_tech", emoji: "💻", label: "技术交流", fullName: "技术交流", category: "职场野心", categoryId: "career" },
      { id: "career_global", emoji: "🌐", label: "国际视野", fullName: "国际视野", category: "职场野心", categoryId: "career" },
    ],
  },
  {
    id: "philosophy",
    name: "深度思想",
    emoji: "🧠",
    topics: [
      { id: "philosophy_meaning", emoji: "🌟", label: "聊人生（真实经历）", fullName: "聊人生（真实经历）", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_anxiety", emoji: "💭", label: "聊焦虑与情绪", fullName: "聊焦虑与情绪", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_cognition", emoji: "🔍", label: "认知升级", fullName: "认知升级", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_growth", emoji: "🧘", label: "自我成长", fullName: "自我成长", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_relationships", emoji: "💔", label: "人际与亲密关系", fullName: "人际与亲密关系", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_social_issues", emoji: "⚖️", label: "社会与价值观", fullName: "社会与价值观", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_minimalism", emoji: "🍃", label: "极简生活", fullName: "极简生活", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_meditation", emoji: "📿", label: "冥想与正念", fullName: "冥想与正念", category: "深度思想", categoryId: "philosophy" },
    ],
  },
  {
    id: "lifestyle",
    name: "生活方式",
    emoji: "🍜",
    topics: [
      { id: "lifestyle_travel", emoji: "✈️", label: "去旅行", fullName: "去旅行", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_food", emoji: "🍜", label: "吃喝探索", fullName: "吃喝探索", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_sports", emoji: "🏀", label: "运动", fullName: "运动", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_fitness", emoji: "🏃", label: "撸铁健身", fullName: "撸铁健身", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_coffee", emoji: "☕", label: "咖啡", fullName: "咖啡", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_wine", emoji: "🍷", label: "小酌", fullName: "小酌", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_eco", emoji: "🌱", label: "可持续", fullName: "可持续", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_pets", emoji: "🐱", label: "吸猫撸狗", fullName: "吸猫撸狗", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_photography", emoji: "📸", label: "摄影", fullName: "摄影", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_outdoor", emoji: "⛰️", label: "户外", fullName: "户外", category: "生活方式", categoryId: "lifestyle" },
    ],
  },
  {
    id: "culture",
    name: "文化娱乐",
    emoji: "🎬",
    topics: [
      { id: "culture_movies", emoji: "🎬", label: "影视内容", fullName: "影视内容", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_music", emoji: "🎵", label: "音乐", fullName: "音乐", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_books", emoji: "📚", label: "阅读", fullName: "阅读", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_podcast", emoji: "🎧", label: "播客", fullName: "播客", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_games", emoji: "🎮", label: "玩游戏", fullName: "玩游戏", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_script_kill", emoji: "🎲", label: "剧本杀", fullName: "剧本杀", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_memes", emoji: "😂", label: "玩梗", fullName: "玩梗", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_standup", emoji: "🎤", label: "脱口秀", fullName: "脱口秀", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_live", emoji: "🎸", label: "看 Live", fullName: "看 Live", category: "文化娱乐", categoryId: "culture" },
    ],
  },
  {
    id: "city",
    name: "城市探索",
    emoji: "🏙️",
    topics: [
      { id: "city_hidden_gems", emoji: "🗺️", label: "探店", fullName: "探店", category: "城市探索", categoryId: "city" },
      { id: "city_architecture", emoji: "🏛️", label: "建筑美学", fullName: "建筑美学", category: "城市探索", categoryId: "city" },
      { id: "city_evolution", emoji: "🌆", label: "城市记忆", fullName: "城市记忆", category: "城市探索", categoryId: "city" },
      { id: "city_parks", emoji: "🍃", label: "逛公园", fullName: "逛公园", category: "城市探索", categoryId: "city" },
      { id: "city_landmarks", emoji: "🎡", label: "网红打卡", fullName: "网红打卡", category: "城市探索", categoryId: "city" },
      { id: "city_bars", emoji: "🍺", label: "泡酒吧", fullName: "泡酒吧", category: "城市探索", categoryId: "city" },
      { id: "city_metro", emoji: "🚇", label: "地铁文化", fullName: "地铁文化", category: "城市探索", categoryId: "city" },
      { id: "city_exhibition", emoji: "🖼️", label: "看展", fullName: "看展", category: "城市探索", categoryId: "city" },
      { id: "city_community", emoji: "🏘️", label: "社区生活", fullName: "社区生活", category: "城市探索", categoryId: "city" },
      { id: "city_walk", emoji: "🌉", label: "City Walk", fullName: "City Walk", category: "城市探索", categoryId: "city" },
    ],
  },
  {
    id: "tech",
    name: "前沿科技",
    emoji: "🚀",
    topics: [
      { id: "tech_ai", emoji: "🤖", label: "AI 应用", fullName: "AI 应用", category: "前沿科技", categoryId: "tech" },
      { id: "tech_blockchain", emoji: "⛓️", label: "区块链", fullName: "区块链", category: "前沿科技", categoryId: "tech" },
      { id: "tech_vr_ar", emoji: "🥽", label: "VR / AR", fullName: "VR / AR", category: "前沿科技", categoryId: "tech" },
      { id: "tech_robotics", emoji: "🦾", label: "机器人", fullName: "机器人", category: "前沿科技", categoryId: "tech" },
      { id: "tech_space", emoji: "🔭", label: "太空探索", fullName: "太空探索", category: "前沿科技", categoryId: "tech" },
      { id: "tech_biotech", emoji: "🧬", label: "生物科技", fullName: "生物科技", category: "前沿科技", categoryId: "tech" },
      { id: "tech_ev", emoji: "⚡", label: "电动车", fullName: "电动车", category: "前沿科技", categoryId: "tech" },
      { id: "tech_smart_home", emoji: "🏠", label: "智能家居", fullName: "智能家居", category: "前沿科技", categoryId: "tech" },
      { id: "tech_quantum", emoji: "⚛️", label: "量子计算", fullName: "量子计算", category: "前沿科技", categoryId: "tech" },
    ],
  },
];

// Flatten all topics for easy lookup
export const ALL_TOPICS: InterestTopic[] = INTEREST_CATEGORIES.flatMap(
  (category) => category.topics
);

// Helper to get topic by ID
export function getTopicById(id: string): InterestTopic | undefined {
  return ALL_TOPICS.find((topic) => topic.id === id);
}

// Helper to get category by ID
export function getCategoryById(id: string): InterestCategory | undefined {
  return INTEREST_CATEGORIES.find((category) => category.id === id);
}
