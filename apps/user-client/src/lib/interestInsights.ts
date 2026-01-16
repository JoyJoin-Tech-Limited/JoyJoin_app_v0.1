/**
 * Interest Insights Algorithm
 * Generates personalized insights and statistics from user's selected interests
 */

export interface InterestOption {
  id: string;
  label: string;
  emoji?: string;
  heat: number;
}

export interface InterestData {
  selectedInterests: string[];
  primaryInterests: string[];
  allInterestsOptions: InterestOption[];
  archetype?: string;
}

export interface VibeCategory {
  category: string;
  percentage: number;
  emoji: string;
}

export interface InterestInsights {
  vibePattern: VibeCategory[];
  diversityScore: number; // 0-100
  rarityScore: number; // 0-100, higher = more unique
  topEmoji: string;
  tagline: string; // e.g., "都市探索家 x 美食猎人"
  matchingPotential: number; // estimated % of users with overlap
  funFact: string; // personalized insight
}

/**
 * Interest category mapping based on semantic groups
 */
const INTEREST_CATEGORIES: Record<string, { name: string; emoji: string }> = {
  // 都市探索类
  food_dining: { name: "美食", emoji: "🍜" },
  city_walk: { name: "都市探索", emoji: "🚶" },
  drinks_bar: { name: "夜生活", emoji: "🍷" },
  
  // 文化艺术类
  arts_culture: { name: "文化艺术", emoji: "🎨" },
  photography: { name: "创作", emoji: "📷" },
  music_live: { name: "音乐", emoji: "🎵" },
  
  // 运动健康类
  sports_fitness: { name: "运动健康", emoji: "💪" },
  outdoor_adventure: { name: "户外探险", emoji: "🏕️" },
  
  // 娱乐休闲类
  games_video: { name: "游戏娱乐", emoji: "🎮" },
  games_board: { name: "游戏娱乐", emoji: "🎮" },
  movies: { name: "影视", emoji: "🎬" },
  tv_shows: { name: "影视", emoji: "🎬" },
  
  // 学习成长类
  reading_books: { name: "学习成长", emoji: "📚" },
  tech_gadgets: { name: "科技", emoji: "💻" },
  languages: { name: "学习成长", emoji: "📚" },
  entrepreneurship: { name: "商业创业", emoji: "💡" },
  investing: { name: "商业创业", emoji: "💡" },
  
  // 生活方式类
  travel: { name: "旅行", emoji: "✈️" },
  pets_animals: { name: "生活方式", emoji: "🐱" },
  diy_crafts: { name: "手工", emoji: "✂️" },
  volunteering: { name: "公益", emoji: "🤝" },
  meditation: { name: "身心灵", emoji: "🧘" },
};

/**
 * Generate personalized taglines based on interest combinations
 */
function generateTagline(
  selectedOptions: InterestOption[],
  primaryInterests: string[]
): string {
  const labels = selectedOptions.map(opt => opt.label);
  
  // If we have primary interests, prioritize them
  const primaryLabels = selectedOptions
    .filter(opt => primaryInterests.includes(opt.id))
    .map(opt => opt.label)
    .slice(0, 3);
  
  if (primaryLabels.length >= 2) {
    return primaryLabels.join(" x ");
  }
  
  // Otherwise use top interests by heat
  const topByHeat = selectedOptions
    .sort((a, b) => b.heat - a.heat)
    .slice(0, 3)
    .map(opt => opt.label);
  
  return topByHeat.join(" x ");
}

/**
 * Generate fun facts based on interest combinations
 */
function generateFunFact(
  selectedOptions: InterestOption[],
  rarityScore: number,
  vibePattern: VibeCategory[]
): string {
  const labels = selectedOptions.map(opt => opt.label);
  
  // Rare combination insight
  if (rarityScore > 70 && selectedOptions.length >= 2) {
    const rareCombo = selectedOptions
      .filter(opt => opt.heat < 30)
      .slice(0, 2)
      .map(opt => opt.label);
    
    if (rareCombo.length >= 2) {
      return `只有${Math.floor(100 - rarityScore)}%的用户像你一样同时喜欢${rareCombo[0]}和${rareCombo[1]}！🌟`;
    }
  }
  
  // Diverse interests insight
  if (vibePattern.length >= 4) {
    return `你的兴趣跨越${vibePattern.length}个领域，是个超有趣的多面手！🎯`;
  }
  
  // High heat interests insight
  const hotInterests = selectedOptions.filter(opt => opt.heat > 70);
  if (hotInterests.length >= 2) {
    return `你选的都是超热门兴趣，很容易找到志同道合的朋友！🔥`;
  }
  
  // Unique taste insight
  const uniqueInterests = selectedOptions.filter(opt => opt.heat < 25);
  if (uniqueInterests.length >= 2) {
    return `你的品味很独特，小众爱好者往往能碰撞出更有趣的火花！💎`;
  }
  
  // Default insight
  return `你的兴趣组合很有个性，期待遇见和你一样特别的人！✨`;
}

/**
 * Calculate diversity score based on category spread
 */
function calculateDiversityScore(vibePattern: VibeCategory[]): number {
  if (vibePattern.length === 0) return 0;
  
  // More categories = higher diversity
  const categoryBonus = Math.min(vibePattern.length * 15, 60);
  
  // More balanced distribution = higher diversity
  const maxPercentage = Math.max(...vibePattern.map(v => v.percentage));
  const balanceScore = (100 - maxPercentage) * 0.4;
  
  return Math.min(Math.round(categoryBonus + balanceScore), 100);
}

/**
 * Calculate rarity score based on heat values
 */
function calculateRarityScore(selectedOptions: InterestOption[]): number {
  if (selectedOptions.length === 0) return 0;
  
  // Lower average heat = more rare
  const avgHeat = selectedOptions.reduce((sum, opt) => sum + opt.heat, 0) / selectedOptions.length;
  
  // Invert: low heat (10) = high rarity (90), high heat (80) = low rarity (20)
  const rarityScore = 100 - avgHeat;
  
  return Math.max(0, Math.min(100, Math.round(rarityScore)));
}

/**
 * Estimate matching potential based on heat values
 */
function calculateMatchingPotential(selectedOptions: InterestOption[]): number {
  if (selectedOptions.length === 0) return 0;
  
  // Higher average heat = higher matching potential
  const avgHeat = selectedOptions.reduce((sum, opt) => sum + opt.heat, 0) / selectedOptions.length;
  
  // Heat is already a percentage-like value, use it directly with some adjustment
  const potential = Math.min(avgHeat + 10, 95);
  
  return Math.round(potential);
}

/**
 * Generate vibe pattern from selected interests
 */
function generateVibePattern(selectedOptions: InterestOption[]): VibeCategory[] {
  if (selectedOptions.length === 0) return [];
  
  // Group by category
  const categoryMap = new Map<string, { count: number; emoji: string }>();
  
  selectedOptions.forEach(opt => {
    const category = INTEREST_CATEGORIES[opt.id];
    if (category) {
      const existing = categoryMap.get(category.name);
      if (existing) {
        existing.count++;
      } else {
        categoryMap.set(category.name, { count: 1, emoji: category.emoji });
      }
    }
  });
  
  // Convert to percentages
  const total = selectedOptions.length;
  const vibePattern: VibeCategory[] = Array.from(categoryMap.entries())
    .map(([category, data]) => ({
      category,
      percentage: Math.round((data.count / total) * 100),
      emoji: data.emoji,
    }))
    .sort((a, b) => b.percentage - a.percentage);
  
  return vibePattern;
}

/**
 * Main function to generate interest insights
 */
export function generateInterestInsights(data: InterestData): InterestInsights {
  // Get selected interest objects
  const selectedOptions = data.allInterestsOptions.filter(opt =>
    data.selectedInterests.includes(opt.id)
  );
  
  if (selectedOptions.length === 0) {
    return {
      vibePattern: [],
      diversityScore: 0,
      rarityScore: 0,
      topEmoji: "✨",
      tagline: "还没选择兴趣",
      matchingPotential: 0,
      funFact: "选择几个兴趣，解锁专属洞察！",
    };
  }
  
  // Generate vibe pattern
  const vibePattern = generateVibePattern(selectedOptions);
  
  // Calculate scores
  const diversityScore = calculateDiversityScore(vibePattern);
  const rarityScore = calculateRarityScore(selectedOptions);
  const matchingPotential = calculateMatchingPotential(selectedOptions);
  
  // Get top emoji from most popular category or first primary interest
  const topEmoji = vibePattern.length > 0 
    ? vibePattern[0].emoji 
    : selectedOptions[0]?.emoji || "✨";
  
  // Generate tagline
  const tagline = generateTagline(selectedOptions, data.primaryInterests);
  
  // Generate fun fact
  const funFact = generateFunFact(selectedOptions, rarityScore, vibePattern);
  
  return {
    vibePattern,
    diversityScore,
    rarityScore,
    topEmoji,
    tagline,
    matchingPotential,
    funFact,
  };
}
