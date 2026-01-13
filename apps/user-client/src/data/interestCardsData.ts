export type RiasecType = 'R' | 'I' | 'A' | 'S' | 'E' | 'C';
export type MacroCategory = 'food' | 'entertainment' | 'lifestyle' | 'culture' | 'social';

export interface InterestCard {
  id: string;
  label: string;
  macroCategory: MacroCategory;
  riasec: RiasecType;
  imageUrl: string;
}

export const INTEREST_CARDS: InterestCard[] = [
  // 美食 food (10张)
  { id: 'hotpot', label: '火锅', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/hotpot.jpg' },
  { id: 'bbq', label: '撸串', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/bbq.jpg' },
  { id: 'cantonese', label: '早茶', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/cantonese.jpg' },
  { id: 'japanese', label: '日料', macroCategory: 'food', riasec: 'A', imageUrl: '/images/interests/japanese.jpg' },
  { id: 'western', label: '西餐', macroCategory: 'food', riasec: 'C', imageUrl: '/images/interests/western.jpg' },
  { id: 'dessert', label: '下午茶', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/dessert.jpg' },
  { id: 'coffee', label: '咖啡', macroCategory: 'food', riasec: 'I', imageUrl: '/images/interests/coffee.jpg' },
  { id: 'food_hunting', label: '探店', macroCategory: 'food', riasec: 'E', imageUrl: '/images/interests/food_hunting.jpg' },
  { id: 'dabianlu', label: '打边炉', macroCategory: 'food', riasec: 'S', imageUrl: '/images/interests/dabianlu.jpg' },
  { id: 'private_kitchen', label: '私厨', macroCategory: 'food', riasec: 'E', imageUrl: '/images/interests/private_kitchen.jpg' },

  // 娱乐 entertainment (7张)
  { id: 'script_kill', label: '剧本杀', macroCategory: 'entertainment', riasec: 'I', imageUrl: '/images/interests/script_kill.jpg' },
  { id: 'escape_room', label: '密室', macroCategory: 'entertainment', riasec: 'I', imageUrl: '/images/interests/escape_room.jpg' },
  { id: 'board_games', label: '桌游', macroCategory: 'entertainment', riasec: 'I', imageUrl: '/images/interests/board_games.jpg' },
  { id: 'ktv', label: 'KTV', macroCategory: 'entertainment', riasec: 'S', imageUrl: '/images/interests/ktv.jpg' },
  { id: 'gaming', label: '电竞', macroCategory: 'entertainment', riasec: 'R', imageUrl: '/images/interests/gaming.jpg' },
  { id: 'live_house', label: 'LiveHouse', macroCategory: 'entertainment', riasec: 'A', imageUrl: '/images/interests/live_house.jpg' },
  { id: 'binge_watch', label: '追剧', macroCategory: 'entertainment', riasec: 'C', imageUrl: '/images/interests/binge_watch.jpg' },

  // 生活方式 lifestyle (9张)
  { id: 'hiking', label: '徒步', macroCategory: 'lifestyle', riasec: 'R', imageUrl: '/images/interests/hiking.jpg' },
  { id: 'fitness', label: '健身', macroCategory: 'lifestyle', riasec: 'R', imageUrl: '/images/interests/fitness.jpg' },
  { id: 'camping', label: '露营', macroCategory: 'lifestyle', riasec: 'R', imageUrl: '/images/interests/camping.jpg' },
  { id: 'extreme_sports', label: '极限运动', macroCategory: 'lifestyle', riasec: 'R', imageUrl: '/images/interests/extreme_sports.jpg' },
  { id: 'photography', label: '摄影', macroCategory: 'lifestyle', riasec: 'A', imageUrl: '/images/interests/photography.jpg' },
  { id: 'diy', label: '手作', macroCategory: 'lifestyle', riasec: 'A', imageUrl: '/images/interests/diy.jpg' },
  { id: 'travel', label: '旅行', macroCategory: 'lifestyle', riasec: 'A', imageUrl: '/images/interests/travel.jpg' },
  { id: 'pets', label: '撸猫', macroCategory: 'lifestyle', riasec: 'S', imageUrl: '/images/interests/pets.jpg' },
  { id: 'sailing', label: '海边帆船', macroCategory: 'lifestyle', riasec: 'R', imageUrl: '/images/interests/sailing.jpg' },

  // 文化 culture (7张)
  { id: 'exhibition', label: '看展', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/exhibition.jpg' },
  { id: 'music', label: '玩音乐', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/music.jpg' },
  { id: 'theater', label: '话剧', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/theater.jpg' },
  { id: 'cinema', label: '电影', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/cinema.jpg' },
  { id: 'citywalk', label: 'CityWalk', macroCategory: 'culture', riasec: 'A', imageUrl: '/images/interests/citywalk.jpg' },
  { id: 'standup', label: '脱口秀', macroCategory: 'culture', riasec: 'S', imageUrl: '/images/interests/standup.jpg' },
  { id: 'concert', label: '演唱会', macroCategory: 'culture', riasec: 'S', imageUrl: '/images/interests/concert.jpg' },

  // 社交话题 social (9张)
  { id: 'reading', label: '阅读', macroCategory: 'social', riasec: 'I', imageUrl: '/images/interests/reading.jpg' },
  { id: 'tech', label: '科技', macroCategory: 'social', riasec: 'I', imageUrl: '/images/interests/tech.jpg' },
  { id: 'variety', label: '八卦', macroCategory: 'social', riasec: 'S', imageUrl: '/images/interests/variety.jpg' },
  { id: 'career', label: '搞事业', macroCategory: 'social', riasec: 'E', imageUrl: '/images/interests/career.jpg' },
  { id: 'fashion', label: '穿搭', macroCategory: 'social', riasec: 'C', imageUrl: '/images/interests/fashion.jpg' },
  { id: 'bar', label: '小酒馆', macroCategory: 'social', riasec: 'S', imageUrl: '/images/interests/bar.jpg' },
  { id: 'wine', label: '品酒', macroCategory: 'social', riasec: 'E', imageUrl: '/images/interests/wine.jpg' },
  { id: 'startup', label: '创业圆桌', macroCategory: 'social', riasec: 'E', imageUrl: '/images/interests/startup.jpg' },
  { id: 'language', label: '语言交换', macroCategory: 'social', riasec: 'I', imageUrl: '/images/interests/language.jpg' },
];

export const MACRO_CATEGORY_LABELS: Record<MacroCategory, string> = {
  food: '美食',
  entertainment: '娱乐',
  lifestyle: '生活方式',
  culture: '文化',
  social: '社交话题',
};

export const MACRO_CATEGORY_COLORS: Record<MacroCategory, string> = {
  food: 'from-orange-500 to-red-500',
  entertainment: 'from-purple-500 to-pink-500',
  lifestyle: 'from-green-500 to-teal-500',
  culture: 'from-blue-500 to-indigo-500',
  social: 'from-yellow-500 to-orange-500',
};

export const RIASEC_LABELS: Record<RiasecType, string> = {
  R: '现实型',
  I: '研究型',
  A: '艺术型',
  S: '社交型',
  E: '企业型',
  C: '传统型',
};

export const RIASEC_QUOTAS: Record<RiasecType, number> = {
  R: 3,
  I: 3,
  A: 3,
  S: 4,
  E: 3,
  C: 2,
};

export type SwipeChoice = 'like' | 'skip' | 'love';

export interface SwipeResult {
  cardId: string;
  choice: SwipeChoice;
  reactionTimeMs: number;
}

export interface DimensionScore {
  macroCategory: Record<MacroCategory, number>;
  riasec: Record<RiasecType, number>;
}

export interface DimensionConfirmation {
  macroCategory: Record<MacroCategory, number>;
  riasec: Record<RiasecType, number>;
}

export interface SmartSelectionState {
  scores: DimensionScore;
  confirmations: DimensionConfirmation;
  swipedCardIds: Set<string>;
  results: SwipeResult[];
}

export function initSmartSelectionState(): SmartSelectionState {
  return {
    scores: {
      macroCategory: { food: 0, entertainment: 0, lifestyle: 0, culture: 0, social: 0 },
      riasec: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 },
    },
    confirmations: {
      macroCategory: { food: 0, entertainment: 0, lifestyle: 0, culture: 0, social: 0 },
      riasec: { R: 0, I: 0, A: 0, S: 0, E: 0, C: 0 },
    },
    swipedCardIds: new Set(),
    results: [],
  };
}

export function calculateSwipeScore(choice: SwipeChoice, reactionTimeMs: number): number {
  let baseScore = 0;
  if (choice === 'love') baseScore = 3;
  else if (choice === 'like') baseScore = 1;
  else if (choice === 'skip') baseScore = -0.5;

  let multiplier = 1;
  if (reactionTimeMs < 1000) multiplier = 1.2;
  else if (reactionTimeMs > 3000) multiplier = 0.7;

  return baseScore * multiplier;
}

export function updateSelectionState(
  state: SmartSelectionState,
  card: InterestCard,
  result: SwipeResult
): SmartSelectionState {
  const score = calculateSwipeScore(result.choice, result.reactionTimeMs);
  const isPositive = result.choice === 'like' || result.choice === 'love';

  const newState = { ...state };
  newState.swipedCardIds = new Set(state.swipedCardIds);
  newState.swipedCardIds.add(card.id);
  newState.results = [...state.results, result];

  newState.scores = {
    macroCategory: {
      ...state.scores.macroCategory,
      [card.macroCategory]: state.scores.macroCategory[card.macroCategory] + score,
    },
    riasec: {
      ...state.scores.riasec,
      [card.riasec]: state.scores.riasec[card.riasec] + score,
    },
  };

  if (isPositive) {
    newState.confirmations = {
      macroCategory: {
        ...state.confirmations.macroCategory,
        [card.macroCategory]: state.confirmations.macroCategory[card.macroCategory] + 1,
      },
      riasec: {
        ...state.confirmations.riasec,
        [card.riasec]: state.confirmations.riasec[card.riasec] + 1,
      },
    };
  }

  return newState;
}

export function getNextSmartCard(
  allCards: InterestCard[],
  state: SmartSelectionState
): InterestCard | null {
  const availableCards = allCards.filter(c => !state.swipedCardIds.has(c.id));
  if (availableCards.length === 0) return null;

  const underExploredCategories = (Object.keys(state.confirmations.macroCategory) as MacroCategory[])
    .filter(cat => state.confirmations.macroCategory[cat] < 2);

  const underExploredRiasec = (Object.keys(state.confirmations.riasec) as RiasecType[])
    .filter(r => state.confirmations.riasec[r] < 1);

  let priorityCards = availableCards.filter(card =>
    underExploredCategories.includes(card.macroCategory) ||
    underExploredRiasec.includes(card.riasec)
  );

  if (priorityCards.length === 0) {
    priorityCards = availableCards;
  }

  const randomIndex = Math.floor(Math.random() * priorityCards.length);
  return priorityCards[randomIndex];
}

export function shuffleCards(cards: InterestCard[]): InterestCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function getSmartCardSelection(
  allCards: InterestCard[],
  targetCount: number = 18
): InterestCard[] {
  const selected: InterestCard[] = [];
  const usedIds = new Set<string>();

  const byRiasec: Record<RiasecType, InterestCard[]> = {
    R: [], I: [], A: [], S: [], E: [], C: [],
  };
  for (const card of shuffleCards(allCards)) {
    byRiasec[card.riasec].push(card);
  }

  for (const riasec of Object.keys(RIASEC_QUOTAS) as RiasecType[]) {
    const availablePool = byRiasec[riasec];
    const effectiveQuota = Math.min(RIASEC_QUOTAS[riasec], availablePool.length);
    
    for (let i = 0; i < effectiveQuota; i++) {
      const card = availablePool[i];
      if (card && !usedIds.has(card.id)) {
        selected.push(card);
        usedIds.add(card.id);
      }
    }
  }

  const categoryCount: Record<MacroCategory, number> = {
    food: 0, entertainment: 0, lifestyle: 0, culture: 0, social: 0,
  };
  for (const card of selected) {
    categoryCount[card.macroCategory]++;
  }

  const remaining = shuffleCards(allCards.filter(c => !usedIds.has(c.id)));
  for (const cat of Object.keys(categoryCount) as MacroCategory[]) {
    if (categoryCount[cat] < 2) {
      const needed = 2 - categoryCount[cat];
      const catCards = remaining.filter(c => c.macroCategory === cat && !usedIds.has(c.id));
      for (let i = 0; i < Math.min(needed, catCards.length); i++) {
        selected.push(catCards[i]);
        usedIds.add(catCards[i].id);
        categoryCount[cat]++;
      }
    }
  }

  while (selected.length < targetCount && remaining.length > 0) {
    const card = remaining.find(c => !usedIds.has(c.id));
    if (card) {
      selected.push(card);
      usedIds.add(card.id);
    } else {
      break;
    }
  }

  return shuffleCards(selected).slice(0, targetCount);
}

export function identifyCoreInterests(state: SmartSelectionState): {
  core: MacroCategory[];
  general: MacroCategory[];
} {
  const core: MacroCategory[] = [];
  const general: MacroCategory[] = [];

  for (const cat of Object.keys(state.confirmations.macroCategory) as MacroCategory[]) {
    const confirmCount = state.confirmations.macroCategory[cat];
    if (confirmCount >= 3) {
      core.push(cat);
    } else if (confirmCount >= 1) {
      general.push(cat);
    }
  }

  return { core, general };
}

export function calculateConfidenceScore(state: SmartSelectionState): number {
  const totalSwipes = state.results.length;
  if (totalSwipes === 0) return 0;

  const positiveResults = state.results.filter(r => r.choice === 'like' || r.choice === 'love');
  const positiveCount = positiveResults.length;
  
  if (positiveCount === 0) {
    return Math.min(Math.round((totalSwipes / 18) * 30), 30);
  }

  const categoriesCovered = (Object.values(state.confirmations.macroCategory) as number[])
    .filter(v => v > 0).length;
  const riasecCovered = (Object.values(state.confirmations.riasec) as number[])
    .filter(v => v > 0).length;

  const coverageScore = ((categoriesCovered / 5) * 0.6 + (riasecCovered / 6) * 0.4);
  
  const volumeScore = Math.min(totalSwipes / 16, 1);
  
  const engagementRatio = positiveCount / totalSwipes;
  const engagementScore = Math.min(engagementRatio * 1.5, 1);

  const rawScore = (coverageScore * 0.4 + volumeScore * 0.3 + engagementScore * 0.3) * 100;
  
  return Math.round(Math.min(rawScore, 100));
}
