/**
 * Interest Taxonomy System
 * 
 * This module provides:
 * - Canonical interest definitions with versioned taxonomy
 * - Validation and normalization utilities
 * - Builders for card deck and chip list views
 * - Telemetry schema and validation
 */

import { z } from "zod";

// ============ Version Management ============
export const TAXONOMY_VERSION = "2.0.0";

// ============ Type Definitions ============
export type RiasecType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
export type MacroCategory = 'food' | 'play' | 'sports' | 'culture' | 'life' | 'growth';

export interface InterestDefinition {
  id: string;
  label: string;
  macroCategory: MacroCategory;
  riasec: RiasecType;
  imageUrl: string;
  active: boolean;
  synonyms?: string[];
}

// ============ Canonical Interest Taxonomy ============
// v2.0.0 — scene-first taxonomy: every category answers "where / what would we do together?"
export const INTEREST_TAXONOMY: InterestDefinition[] = [
  // 美食小酌 food — 一起吃/喝的场景
  { id: 'hotpot', label: '火锅', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/hotpot.webp', active: true, synonyms: ['涮锅', '火锅店', '打边炉', '港式火锅'] },
  { id: 'bbq', label: '撸串', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/bbq.webp', active: true, synonyms: ['烧烤', '串串'] },
  { id: 'cantonese', label: '早茶', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/cantonese.webp', active: true, synonyms: ['粤式早茶', '茶点'] },
  { id: 'japanese', label: '日料', macroCategory: 'food', riasec: 'A', imageUrl: '/images/interests/japanese.webp', active: true, synonyms: ['日式料理', '寿司'] },
  { id: 'western', label: '西餐', macroCategory: 'food', riasec: 'C', imageUrl: '/images/interests/western.webp', active: true, synonyms: ['法餐', '意餐'] },
  { id: 'dessert', label: '下午茶', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/dessert.webp', active: true, synonyms: ['甜点', '蛋糕', '咖啡'] },
  { id: 'coffee', label: '咖啡', macroCategory: 'food', riasec: 'I', imageUrl: '/images/interests/coffee.webp', active: true, synonyms: ['咖啡馆', '精品咖啡', '下午茶'] },
  { id: 'food_hunting', label: '探店', macroCategory: 'food', riasec: 'E', imageUrl: '/images/interests/food_hunting.webp', active: true, synonyms: ['美食探店', '寻味'] },
  { id: 'private_kitchen', label: '私厨', macroCategory: 'food', riasec: 'E', imageUrl: '/images/interests/private_kitchen.webp', active: true, synonyms: ['私房菜'] },
  { id: 'wine', label: '小酌', macroCategory: 'food', riasec: 'E', imageUrl: '/images/interests/wine.webp', active: true, synonyms: ['红酒', '威士忌', '精酿', '清吧', '小酒馆'] },

  // 聚会玩乐 play — 一群人一起玩/破冰的场景
  { id: 'script_kill', label: '剧本杀', macroCategory: 'play', riasec: 'I', imageUrl: '/images/interests/script_kill.webp', active: true, synonyms: ['推理', '谋杀之谜'] },
  { id: 'escape_room', label: '密室', macroCategory: 'play', riasec: 'I', imageUrl: '/images/interests/escape_room.webp', active: true, synonyms: ['密室逃脱'] },
  { id: 'board_games', label: '桌游', macroCategory: 'play', riasec: 'I', imageUrl: '/images/interests/board_games.webp', active: true, synonyms: ['卡牌游戏'] },
  { id: 'ktv', label: 'KTV', macroCategory: 'play', riasec: 'S', imageUrl: '/images/interests/ktv.webp', active: true, synonyms: ['唱K', '卡拉OK'] },
  { id: 'gaming', label: '电竞', macroCategory: 'play', riasec: 'R', imageUrl: '/images/interests/gaming.webp', active: true, synonyms: ['游戏', '电子游戏', '开黑'] },
  { id: 'live_house', label: 'LiveHouse', macroCategory: 'play', riasec: 'A', imageUrl: '/images/interests/live_house.webp', active: true, synonyms: ['现场演出'] },
  { id: 'bar', label: '小酒馆', macroCategory: 'play', riasec: 'S', imageUrl: '/images/interests/bar.webp', active: true, synonyms: ['酒吧', '清吧', '微醺'] },
  { id: 'werewolf', label: '狼人杀/阿瓦隆', macroCategory: 'play', riasec: 'S', imageUrl: '/images/interests/werewolf.webp', active: true, synonyms: ['狼人杀', '阿瓦隆', '桌游'] },

  // 运动户外 sports — 一起动、分泌多巴胺的场景
  { id: 'hiking', label: '徒步', macroCategory: 'sports', riasec: 'R', imageUrl: '/images/interests/hiking.webp', active: true, synonyms: ['登山', '远足'] },
  { id: 'fitness', label: '健身', macroCategory: 'sports', riasec: 'R', imageUrl: '/images/interests/fitness.webp', active: true, synonyms: ['撸铁', '运动'] },
  { id: 'climbing', label: '攀岩', macroCategory: 'sports', riasec: 'R', imageUrl: '/images/interests/climbing.webp', active: true, synonyms: ['抱石', 'bouldering', '室内攀岩'] },
  { id: 'camping', label: '露营', macroCategory: 'sports', riasec: 'R', imageUrl: '/images/interests/camping.webp', active: true, synonyms: ['野营', '户外露营'] },
  { id: 'extreme_sports', label: '户外冒险', macroCategory: 'sports', riasec: 'R', imageUrl: '/images/interests/extreme_sports.webp', active: true, synonyms: ['滑翔', '跳伞', '漂流'] },
  { id: 'sailing', label: '水上运动', macroCategory: 'sports', riasec: 'R', imageUrl: '/images/interests/sailing.webp', active: true, synonyms: ['帆船', '桨板', '皮划艇', '冲浪'] },
  { id: 'cycling', label: '骑行', macroCategory: 'sports', riasec: 'R', imageUrl: '/images/interests/cycling.webp', active: true, synonyms: ['自行车', '公路车', '骑行'] },

  // 文艺现场 culture — 一起看/体验内容的场景
  { id: 'exhibition', label: '看展', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/exhibition.webp', active: true, synonyms: ['展览', '艺术展'] },
  { id: 'music', label: '玩音乐', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/music.webp', active: true, synonyms: ['乐器', '音乐创作'] },
  { id: 'theater', label: '话剧', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/theater.webp', active: true, synonyms: ['戏剧', '舞台剧'] },
  { id: 'cinema', label: '电影', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/cinema.webp', active: true, synonyms: ['看电影', '影院'] },
  { id: 'flea_market', label: '市集', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/flea_market.webp', active: true, synonyms: ['创意市集', '文创市集', '周末市集'] },
  { id: 'standup', label: '脱口秀', macroCategory: 'culture', riasec: 'S', imageUrl: '/images/interests/standup.webp', active: true, synonyms: ['单口喜剧', '开放麦'] },
  { id: 'concert', label: '演唱会', macroCategory: 'culture', riasec: 'S', imageUrl: '/images/interests/concert.webp', active: true, synonyms: ['音乐会', '现场'] },
  { id: 'binge_watch', label: '追剧', macroCategory: 'culture', riasec: 'C', imageUrl: '/images/interests/binge_watch.webp', active: true, synonyms: ['看剧', '刷剧'] },

  // 生活美学 life — 慢生活、审美、创作、陪伴的场景
  { id: 'photography', label: '摄影', macroCategory: 'life', riasec: 'A', imageUrl: '/images/interests/photography.webp', active: true, synonyms: ['拍照', '街拍'] },
  { id: 'diy', label: '手作', macroCategory: 'life', riasec: 'A', imageUrl: '/images/interests/diy.webp', active: true, synonyms: ['手工', 'DIY'] },
  { id: 'vintage', label: '淘古着', macroCategory: 'life', riasec: 'A', imageUrl: '/images/interests/vintage.webp', active: true, synonyms: ['vintage', '古着', '二手', '中古'] },
  { id: 'travel', label: '旅行', macroCategory: 'life', riasec: 'A', imageUrl: '/images/interests/travel.webp', active: true, synonyms: ['旅游', '出行'] },
  { id: 'pets', label: '宠物', macroCategory: 'life', riasec: 'S', imageUrl: '/images/interests/pets.webp', active: true, synonyms: ['撸猫', '撸狗', '吸猫', '养宠'] },
  { id: 'citywalk', label: 'CityWalk', macroCategory: 'life', riasec: 'A', imageUrl: '/images/interests/citywalk.webp', active: true, synonyms: ['城市漫步', '逛街'] },
  { id: 'fashion', label: '穿搭', macroCategory: 'life', riasec: 'C', imageUrl: '/images/interests/fashion.webp', active: true, synonyms: ['时尚', '潮流'] },
  { id: 'beauty', label: '护肤美妆', macroCategory: 'life', riasec: 'A', imageUrl: '/images/interests/beauty.webp', active: true, synonyms: ['美妆', '护肤', '化妆'] },

  // 思想成长 growth — 一起聊、一起学的场景
  { id: 'reading', label: '阅读', macroCategory: 'growth', riasec: 'I', imageUrl: '/images/interests/reading.webp', active: true, synonyms: ['看书', '读书'] },
  { id: 'tech', label: '科技', macroCategory: 'growth', riasec: 'I', imageUrl: '/images/interests/tech.webp', active: true, synonyms: ['数码', '科技圈'] },
  { id: 'podcasts', label: '播客', macroCategory: 'growth', riasec: 'A', imageUrl: '/images/interests/podcasts.webp', active: true, synonyms: ['小宇宙', 'podcast', '听播客'] },
  { id: 'variety', label: '八卦', macroCategory: 'growth', riasec: 'S', imageUrl: '/images/interests/variety.webp', active: true, synonyms: ['娱乐八卦', '综艺'] },
  { id: 'career', label: '搞事业', macroCategory: 'growth', riasec: 'E', imageUrl: '/images/interests/career.webp', active: true, synonyms: ['职业发展', '工作'] },
  { id: 'startup', label: '创业', macroCategory: 'growth', riasec: 'E', imageUrl: '/images/interests/startup.webp', active: true, synonyms: ['创业圆桌', '商业', '搞钱'] },
  { id: 'language', label: '语言搭子', macroCategory: 'growth', riasec: 'I', imageUrl: '/images/interests/language.webp', active: true, synonyms: ['语言学习', '外语', '语言交换'] },
];

// ============ Lookup Maps (built at module load) ============
const interestById = new Map<string, InterestDefinition>();
const activeInterestIds = new Set<string>();

// Build lookup maps
for (const interest of INTEREST_TAXONOMY) {
  interestById.set(interest.id, interest);
  if (interest.active) {
    activeInterestIds.add(interest.id);
  }
}

// ============ Validation Utilities ============

/**
 * Check if an interest ID exists in the taxonomy
 */
export function isKnownInterestId(id: string): boolean {
  return interestById.has(id);
}

/**
 * Check if an interest ID is active (can be used for new selections)
 */
export function isActiveInterestId(id: string): boolean {
  return activeInterestIds.has(id);
}

/**
 * Get an interest definition by ID
 */
export function getInterestById(id: string): InterestDefinition | undefined {
  return interestById.get(id);
}

/**
 * Get all active interests
 */
export function getActiveInterests(): InterestDefinition[] {
  return INTEREST_TAXONOMY.filter(i => i.active);
}

/**
 * Get interest label by ID (returns ID if not found for backward compatibility)
 */
export function getInterestLabel(id: string): string {
  return interestById.get(id)?.label ?? id;
}

// ============ Validation and Normalization ============

export interface InterestValidationResult {
  valid: string[];
  invalid: string[];
  inactive: string[];
}

/**
 * Validate and filter interest IDs
 * - Returns valid active IDs
 * - Reports invalid and inactive IDs for logging
 */
export function validateInterestIds(
  ids: string[],
  options: { allowInactive?: boolean } = {}
): InterestValidationResult {
  const valid: string[] = [];
  const invalid: string[] = [];
  const inactive: string[] = [];
  const seen = new Set<string>();

  for (const id of ids) {
    // Skip duplicates
    if (seen.has(id)) continue;
    seen.add(id);

    const interest = interestById.get(id);
    if (!interest) {
      invalid.push(id);
    } else if (!interest.active && !options.allowInactive) {
      inactive.push(id);
    } else {
      valid.push(id);
    }
  }

  return { valid, invalid, inactive };
}

// ============ Profile Interest Validation ============

export interface ProfileInterestsInput {
  primaryInterests?: string[];
  interestsTop?: string[];
  topicAvoidances?: string[];
}

export interface NormalizedProfileInterests {
  primaryInterests: string[];
  interestsTop: string[];
  topicAvoidances: string[];
  warnings: string[];
}

/**
 * Normalize and validate profile interests
 * - Deduplicates arrays
 * - Caps primary (≤3) and top (≤7)
 * - Ensures primary ⊆ top
 * - Filters out unknown/inactive IDs
 */
export function normalizeProfileInterests(
  input: ProfileInterestsInput,
  options: { strict?: boolean } = {}
): NormalizedProfileInterests {
  const warnings: string[] = [];

  // Validate and dedupe interestsTop
  const topValidation = validateInterestIds(input.interestsTop ?? [], { allowInactive: !options.strict });
  let interestsTop = topValidation.valid.slice(0, 7);
  
  if (topValidation.invalid.length > 0) {
    warnings.push(`Unknown interest IDs dropped: ${topValidation.invalid.join(', ')}`);
  }
  if (topValidation.inactive.length > 0) {
    warnings.push(`Inactive interest IDs dropped: ${topValidation.inactive.join(', ')}`);
  }

  // Validate and dedupe primaryInterests
  const primaryValidation = validateInterestIds(input.primaryInterests ?? [], { allowInactive: !options.strict });
  let primaryInterests = primaryValidation.valid.slice(0, 3);

  if (primaryValidation.invalid.length > 0) {
    warnings.push(`Unknown primary interest IDs dropped: ${primaryValidation.invalid.join(', ')}`);
  }

  // Ensure primary ⊆ top
  const topSet = new Set(interestsTop);
  const primaryNotInTop = primaryInterests.filter(id => !topSet.has(id));
  
  if (primaryNotInTop.length > 0) {
    // Add missing primary interests to top (if there's room)
    for (const id of primaryNotInTop) {
      if (interestsTop.length < 7) {
        interestsTop.push(id);
        topSet.add(id);
      } else {
        // Can't fit, remove from primary
        primaryInterests = primaryInterests.filter(pid => pid !== id);
        warnings.push(`Primary interest ${id} removed: not in top and top is full`);
      }
    }
  }

  // topicAvoidances don't use the interest taxonomy (they're topic IDs)
  // Just dedupe them
  const topicAvoidances = [...new Set(input.topicAvoidances ?? [])];

  return {
    primaryInterests,
    interestsTop,
    topicAvoidances,
    warnings,
  };
}

// ============ Telemetry Schema ============

export interface InterestTelemetryEvent {
  interestId: string;
  choice: 'like' | 'skip' | 'love';
  reactionTimeMs: number;
  timestamp: string; // ISO 8601
}

export interface InterestsTelemetry {
  version: string;
  events: InterestTelemetryEvent[];
}

// Zod schema for telemetry validation
export const interestTelemetryEventSchema = z.object({
  interestId: z.string().min(1),
  choice: z.enum(['like', 'skip', 'love']),
  reactionTimeMs: z.number().int().min(0).max(300000), // Cap at 5 minutes
  timestamp: z.string().datetime(),
});

export const interestsTelemetrySchema = z.object({
  version: z.string().min(1),
  events: z.array(interestTelemetryEventSchema).max(200), // Cap at 200 events
});

/**
 * Validate and normalize telemetry data
 * - Validates structure
 * - Caps event count
 * - Clamps reaction times
 * - Validates interest IDs
 */
export function validateTelemetry(
  input: unknown
): { valid: boolean; data?: InterestsTelemetry; errors?: string[] } {
  const errors: string[] = [];

  // Parse with Zod
  const parseResult = interestsTelemetrySchema.safeParse(input);
  if (!parseResult.success) {
    return {
      valid: false,
      errors: parseResult.error.errors.map(e => `${e.path.join('.')}: ${e.message}`),
    };
  }

  const telemetry = parseResult.data;

  // Validate interest IDs exist
  const invalidIds: string[] = [];
  for (const event of telemetry.events) {
    if (!isKnownInterestId(event.interestId)) {
      invalidIds.push(event.interestId);
    }
  }

  if (invalidIds.length > 0) {
    errors.push(`Unknown interest IDs in telemetry: ${[...new Set(invalidIds)].join(', ')}`);
  }

  // Filter to valid events and clamp reaction times
  const normalizedEvents: InterestTelemetryEvent[] = telemetry.events
    .filter(e => isKnownInterestId(e.interestId))
    .map(e => ({
      ...e,
      reactionTimeMs: Math.min(Math.max(e.reactionTimeMs, 0), 60000), // Clamp to 1 minute max
    }))
    .slice(0, 200); // Cap at 200

  return {
    valid: errors.length === 0 || normalizedEvents.length > 0,
    data: {
      version: telemetry.version,
      events: normalizedEvents,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============ Card Deck Builder ============

export const RIASEC_QUOTAS: Record<RiasecType, number> = {
  R: 3,
  I: 3,
  A: 3,
  S: 4,
  E: 3,
  C: 2,
};

export const MACRO_CATEGORY_LABELS: Record<MacroCategory, string> = {
  food: '美食小酌',
  play: '聚会玩乐',
  sports: '运动户外',
  culture: '文艺现场',
  life: '生活美学',
  growth: '思想成长',
};

export const RIASEC_LABELS: Record<RiasecType, string> = {
  R: '现实型',
  I: '研究型',
  A: '艺术型',
  S: '社交型',
  E: '企业型',
  C: '传统型',
};

/**
 * Build a card deck for the swipe flow with quotas
 * - Ensures RIASEC diversity
 * - Ensures macro category coverage
 * - Returns shuffled deck
 */
export function buildCardDeck(targetCount: number = 18): InterestDefinition[] {
  const activeInterests = getActiveInterests();
  const selected: InterestDefinition[] = [];
  const usedIds = new Set<string>();

  // Helper to shuffle array
  const shuffle = <T>(arr: T[]): T[] => {
    const shuffled = [...arr];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
  };

  // Group by RIASEC
  const byRiasec: Record<RiasecType, InterestDefinition[]> = {
    R: [], I: [], A: [], S: [], E: [], C: [],
  };
  for (const interest of shuffle(activeInterests)) {
    byRiasec[interest.riasec].push(interest);
  }

  // Fill quotas per RIASEC type
  for (const riasec of Object.keys(RIASEC_QUOTAS) as RiasecType[]) {
    const pool = byRiasec[riasec];
    const quota = Math.min(RIASEC_QUOTAS[riasec], pool.length);
    
    for (let i = 0; i < quota; i++) {
      const interest = pool[i];
      if (interest && !usedIds.has(interest.id)) {
        selected.push(interest);
        usedIds.add(interest.id);
      }
    }
  }

  // Ensure minimum category coverage (at least 2 per category)
  const categoryCount: Record<MacroCategory, number> = {
    food: 0, play: 0, sports: 0, culture: 0, life: 0, growth: 0,
  };
  for (const interest of selected) {
    categoryCount[interest.macroCategory]++;
  }

  const remaining = shuffle(activeInterests.filter(i => !usedIds.has(i.id)));
  for (const cat of Object.keys(categoryCount) as MacroCategory[]) {
    if (categoryCount[cat] < 2) {
      const needed = 2 - categoryCount[cat];
      const catInterests = remaining.filter(i => i.macroCategory === cat);
      for (let i = 0; i < Math.min(needed, catInterests.length); i++) {
        if (!usedIds.has(catInterests[i].id)) {
          selected.push(catInterests[i]);
          usedIds.add(catInterests[i].id);
          categoryCount[cat]++;
        }
      }
    }
  }

  // Fill remaining slots if needed
  while (selected.length < targetCount) {
    const interest = remaining.find(i => !usedIds.has(i.id));
    if (!interest) break;
    selected.push(interest);
    usedIds.add(interest.id);
  }

  return shuffle(selected).slice(0, targetCount);
}

/**
 * Get interests as chips for display (edit/summary views)
 * - Returns all active interests grouped by category
 */
export function getChipListByCategory(): Record<MacroCategory, InterestDefinition[]> {
  const result: Record<MacroCategory, InterestDefinition[]> = {
    food: [],
    play: [],
    sports: [],
    culture: [],
    life: [],
    growth: [],
  };

  for (const interest of getActiveInterests()) {
    result[interest.macroCategory].push(interest);
  }

  return result;
}

// ============ Legacy Field Mapping ============

/**
 * Map legacy interest fields to new canonical format
 * Used for backward compatibility when reading old profiles
 */
export function mapLegacyInterests(profile: {
  interestsRankedTop3?: string[];
  topicsHappy?: string[];
  topicsAvoid?: string[];
  interestFavorite?: string;
  interestsTop?: string[];
  primaryInterests?: string[];
  topicAvoidances?: string[];
}): ProfileInterestsInput {
  // If new fields exist, prefer them
  if (profile.interestsTop && profile.interestsTop.length > 0) {
    return {
      interestsTop: profile.interestsTop,
      primaryInterests: profile.primaryInterests,
      topicAvoidances: profile.topicAvoidances,
    };
  }

  // Map legacy fields
  const interestsTop: string[] = [];
  const primaryInterests: string[] = [];

  // Map interestsRankedTop3 to primaryInterests
  if (profile.interestsRankedTop3 && profile.interestsRankedTop3.length > 0) {
    primaryInterests.push(...profile.interestsRankedTop3.slice(0, 3));
    interestsTop.push(...profile.interestsRankedTop3);
  }

  // Add interestFavorite to primary if not already there
  if (profile.interestFavorite && !primaryInterests.includes(profile.interestFavorite)) {
    if (primaryInterests.length < 3) {
      primaryInterests.push(profile.interestFavorite);
    }
    if (!interestsTop.includes(profile.interestFavorite)) {
      interestsTop.push(profile.interestFavorite);
    }
  }

  // Map legacy topic avoidances
  const topicAvoidances = profile.topicAvoidances ?? profile.topicsAvoid ?? [];

  return {
    interestsTop: [...new Set(interestsTop)],
    primaryInterests: [...new Set(primaryInterests)],
    topicAvoidances: [...new Set(topicAvoidances)],
  };
}
