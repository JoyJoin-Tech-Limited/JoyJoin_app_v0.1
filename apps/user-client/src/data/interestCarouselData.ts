/**
 * Interest Categories & Topics for Carousel-based Interest Selection
 * 5 categories × 10 topics each = 50 total topics
 * Each topic has 3 heat levels (1, 2, 3) with associated heat values (3, 10, 25)
 */

export const HEAT_LEVELS = {
  0: { heat: 0, label: "未选择", color: "gray" },
  1: { heat: 3, label: "有点感兴趣", color: "purple" },    // Low interest - minimal heat
  2: { heat: 10, label: "很感兴趣", color: "pink" },        // Medium interest - 3x multiplier
  3: { heat: 25, label: "超级热爱", color: "orange" },      // High interest - 2.5x multiplier (total 8.3x from base)
} as const;

// Heat progression rationale:
// - Level 1 (3 heat): Base value for showing interest
// - Level 2 (10 heat): Stronger signal (3.3x), indicates deliberate selection
// - Level 3 (25 heat): Maximum passion (2.5x from L2), reserved for top priorities
// This creates a meaningful differentiation where a few level-3 selections
// can outweigh many level-1 selections in matching algorithms

export type HeatLevel = 0 | 1 | 2 | 3;

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
      { id: "career_startup", emoji: "🚀", label: "创业", fullName: "创业", category: "职场野心", categoryId: "career" },
      { id: "career_side_hustle", emoji: "📈", label: "副业", fullName: "副业", category: "职场野心", categoryId: "career" },
      { id: "career_business", emoji: "💡", label: "商业", fullName: "商业", category: "职场野心", categoryId: "career" },
      { id: "career_promotion", emoji: "🎯", label: "晋升", fullName: "晋升", category: "职场野心", categoryId: "career" },
      { id: "career_politics", emoji: "🏢", label: "政治", fullName: "政治", category: "职场野心", categoryId: "career" },
      { id: "career_wealth", emoji: "💰", label: "财富", fullName: "财富", category: "职场野心", categoryId: "career" },
      { id: "career_remote", emoji: "🌐", label: "远程", fullName: "远程工作", category: "职场野心", categoryId: "career" },
      { id: "career_ai", emoji: "🤖", label: "AI", fullName: "AI技术", category: "职场野心", categoryId: "career" },
      { id: "career_branding", emoji: "🎓", label: "品牌", fullName: "个人品牌", category: "职场野心", categoryId: "career" },
      { id: "career_management", emoji: "📊", label: "管理", fullName: "管理", category: "职场野心", categoryId: "career" },
    ],
  },
  {
    id: "philosophy",
    name: "深度思想",
    emoji: "🧠",
    topics: [
      { id: "philosophy_meaning", emoji: "🌟", label: "意义", fullName: "人生意义", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_anxiety", emoji: "💭", label: "焦虑", fullName: "焦虑", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_cognition", emoji: "🔍", label: "认知", fullName: "认知升级", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_growth", emoji: "🧘", label: "成长", fullName: "自我成长", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_relationships", emoji: "💔", label: "关系", fullName: "人际关系", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_psychology", emoji: "🧬", label: "心理", fullName: "心理学", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_social_issues", emoji: "⚖️", label: "议题", fullName: "社会议题", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_philosophy", emoji: "🎭", label: "哲学", fullName: "哲学", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_generational", emoji: "🌈", label: "代际", fullName: "代际差异", category: "深度思想", categoryId: "philosophy" },
      { id: "philosophy_meditation", emoji: "📿", label: "冥想", fullName: "冥想正念", category: "深度思想", categoryId: "philosophy" },
    ],
  },
  {
    id: "lifestyle",
    name: "生活方式",
    emoji: "🍜",
    topics: [
      { id: "lifestyle_travel", emoji: "✈️", label: "旅行", fullName: "旅行", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_food", emoji: "🍜", label: "美食", fullName: "美食", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_fitness", emoji: "🏃", label: "健身", fullName: "健身运动", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_home", emoji: "🏡", label: "居家", fullName: "居家生活", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_coffee", emoji: "☕", label: "咖啡", fullName: "咖啡", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_eco", emoji: "🌱", label: "环保", fullName: "环保可持续", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_pets", emoji: "🐱", label: "宠物", fullName: "宠物", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_photography", emoji: "📸", label: "摄影", fullName: "摄影", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_crafts", emoji: "🎨", label: "手作", fullName: "手作DIY", category: "生活方式", categoryId: "lifestyle" },
      { id: "lifestyle_nightlife", emoji: "🌃", label: "夜生活", fullName: "夜生活", category: "生活方式", categoryId: "lifestyle" },
    ],
  },
  {
    id: "culture",
    name: "文化娱乐",
    emoji: "🎬",
    topics: [
      { id: "culture_movies", emoji: "🎬", label: "影视", fullName: "影视剧", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_music", emoji: "🎵", label: "音乐", fullName: "音乐", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_books", emoji: "📚", label: "书籍", fullName: "书籍阅读", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_games", emoji: "🎮", label: "游戏", fullName: "游戏", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_memes", emoji: "😂", label: "梗", fullName: "网络梗", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_standup", emoji: "🎤", label: "脱口秀", fullName: "脱口秀", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_art", emoji: "🖼️", label: "艺术", fullName: "艺术展览", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_shorts", emoji: "📱", label: "短视频", fullName: "短视频", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_theater", emoji: "🎭", label: "戏剧", fullName: "戏剧", category: "文化娱乐", categoryId: "culture" },
      { id: "culture_live", emoji: "🎸", label: "Live", fullName: "现场演出", category: "文化娱乐", categoryId: "culture" },
    ],
  },
  {
    id: "city",
    name: "城市探索",
    emoji: "🏙️",
    topics: [
      { id: "city_hidden_gems", emoji: "🗺️", label: "宝藏", fullName: "宝藏小店", category: "城市探索", categoryId: "city" },
      { id: "city_architecture", emoji: "🏛️", label: "建筑", fullName: "建筑美学", category: "城市探索", categoryId: "city" },
      { id: "city_evolution", emoji: "🌆", label: "变迁", fullName: "城市变迁", category: "城市探索", categoryId: "city" },
      { id: "city_parks", emoji: "🍃", label: "公园", fullName: "公园绿地", category: "城市探索", categoryId: "city" },
      { id: "city_landmarks", emoji: "🎡", label: "打卡", fullName: "网红打卡", category: "城市探索", categoryId: "city" },
      { id: "city_bars", emoji: "🍺", label: "酒吧", fullName: "酒吧探店", category: "城市探索", categoryId: "city" },
      { id: "city_spots", emoji: "📍", label: "地标", fullName: "城市地标", category: "城市探索", categoryId: "city" },
      { id: "city_metro", emoji: "🚇", label: "地铁", fullName: "地铁文化", category: "城市探索", categoryId: "city" },
      { id: "city_community", emoji: "🏘️", label: "社区", fullName: "社区生活", category: "城市探索", categoryId: "city" },
      { id: "city_walk", emoji: "🌉", label: "漫步", fullName: "City Walk", category: "城市探索", categoryId: "city" },
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
