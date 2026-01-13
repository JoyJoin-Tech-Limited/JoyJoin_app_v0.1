export interface InterestCard {
  id: string;
  imageUrl: string;
  label: string;
  macroCategory: 'leisure' | 'food' | 'lifestyle' | 'culture' | 'social';
  microTags: string[];
}

export const INTEREST_CARDS: InterestCard[] = [
  // 休闲娱乐 (leisure) - 9 cards
  { id: 'citywalk', imageUrl: '/images/interests/citywalk.jpg', label: 'CityWalk', macroCategory: 'leisure', microTags: ['城市漫步', '探索'] },
  { id: 'binge_watch', imageUrl: '/images/interests/binge_watch.jpg', label: '追剧', macroCategory: 'leisure', microTags: ['宅家', '追剧'] },
  { id: 'cinema', imageUrl: '/images/interests/cinema.jpg', label: '电影院', macroCategory: 'leisure', microTags: ['电影', '大银幕'] },
  { id: 'board_games', imageUrl: '/images/interests/board_games.jpg', label: '桌游', macroCategory: 'leisure', microTags: ['桌游', '德扑', '社交'] },
  { id: 'script_kill', imageUrl: '/images/interests/script_kill.jpg', label: '剧本杀', macroCategory: 'leisure', microTags: ['剧本杀', '推理'] },
  { id: 'ktv', imageUrl: '/images/interests/ktv.jpg', label: 'KTV', macroCategory: 'leisure', microTags: ['K歌', '麦霸'] },
  { id: 'escape_room', imageUrl: '/images/interests/escape_room.jpg', label: '密室逃脱', macroCategory: 'leisure', microTags: ['密室', '解谜'] },
  { id: 'gaming', imageUrl: '/images/interests/gaming.jpg', label: '电竞游戏', macroCategory: 'leisure', microTags: ['游戏', '电竞', '开黑'] },
  { id: 'live_house', imageUrl: '/images/interests/live_house.jpg', label: 'Live House', macroCategory: 'leisure', microTags: ['现场音乐', 'Live'] },

  // 美食探索 (food) - 8 cards
  { id: 'hotpot', imageUrl: '/images/interests/hotpot.jpg', label: '火锅', macroCategory: 'food', microTags: ['火锅', '串串'] },
  { id: 'japanese', imageUrl: '/images/interests/japanese.jpg', label: '日料', macroCategory: 'food', microTags: ['日料', '寿司', '刺身'] },
  { id: 'cantonese', imageUrl: '/images/interests/cantonese.jpg', label: '粤菜', macroCategory: 'food', microTags: ['粤菜', '早茶', '煲仔饭'] },
  { id: 'western', imageUrl: '/images/interests/western.jpg', label: '西餐', macroCategory: 'food', microTags: ['西餐', '牛排', '意面'] },
  { id: 'bbq', imageUrl: '/images/interests/bbq.jpg', label: '烧烤', macroCategory: 'food', microTags: ['烧烤', '撸串', '夜宵'] },
  { id: 'dessert', imageUrl: '/images/interests/dessert.jpg', label: '甜品', macroCategory: 'food', microTags: ['甜品', '下午茶', '蛋糕'] },
  { id: 'coffee', imageUrl: '/images/interests/coffee.jpg', label: '咖啡馆', macroCategory: 'food', microTags: ['咖啡', '手冲', '精品咖啡'] },
  { id: 'food_hunting', imageUrl: '/images/interests/food_hunting.jpg', label: '探店', macroCategory: 'food', microTags: ['探店', '网红店', '美食'] },

  // 生活方式 (lifestyle) - 8 cards
  { id: 'fitness', imageUrl: '/images/interests/fitness.jpg', label: '健身运动', macroCategory: 'lifestyle', microTags: ['健身', '运动', '撸铁'] },
  { id: 'hiking', imageUrl: '/images/interests/hiking.jpg', label: '户外徒步', macroCategory: 'lifestyle', microTags: ['徒步', '户外', '登山'] },
  { id: 'travel', imageUrl: '/images/interests/travel.jpg', label: '旅行', macroCategory: 'lifestyle', microTags: ['旅行', '出行', '探索'] },
  { id: 'photography', imageUrl: '/images/interests/photography.jpg', label: '摄影', macroCategory: 'lifestyle', microTags: ['摄影', '拍照', '出片'] },
  { id: 'pets', imageUrl: '/images/interests/pets.jpg', label: '养宠物', macroCategory: 'lifestyle', microTags: ['宠物', '撸猫', '撸狗'] },
  { id: 'camping', imageUrl: '/images/interests/camping.jpg', label: '露营野餐', macroCategory: 'lifestyle', microTags: ['露营', '野餐', '户外'] },
  { id: 'extreme_sports', imageUrl: '/images/interests/extreme_sports.jpg', label: '潜水滑雪', macroCategory: 'lifestyle', microTags: ['潜水', '滑雪', '极限运动'] },
  { id: 'diy', imageUrl: '/images/interests/diy.jpg', label: '手作DIY', macroCategory: 'lifestyle', microTags: ['手作', '陶艺', '花艺', '烘焙'] },

  // 文化艺术 (culture) - 8 cards
  { id: 'exhibition', imageUrl: '/images/interests/exhibition.jpg', label: '艺术展览', macroCategory: 'culture', microTags: ['展览', '画廊', '美术馆'] },
  { id: 'reading', imageUrl: '/images/interests/reading.jpg', label: '阅读书店', macroCategory: 'culture', microTags: ['阅读', '书店', '读书会'] },
  { id: 'music', imageUrl: '/images/interests/music.jpg', label: '音乐', macroCategory: 'culture', microTags: ['音乐', '乐器', '音乐节'] },
  { id: 'theater', imageUrl: '/images/interests/theater.jpg', label: '舞台剧话剧', macroCategory: 'culture', microTags: ['话剧', '舞台剧', '戏剧'] },
  { id: 'musical', imageUrl: '/images/interests/musical.jpg', label: '音乐剧', macroCategory: 'culture', microTags: ['音乐剧', '歌舞剧'] },
  { id: 'standup', imageUrl: '/images/interests/standup.jpg', label: '脱口秀', macroCategory: 'culture', microTags: ['脱口秀', '喜剧', '开放麦'] },
  { id: 'concert', imageUrl: '/images/interests/concert.jpg', label: '演唱会', macroCategory: 'culture', microTags: ['演唱会', '音乐节', '现场'] },
  { id: 'market', imageUrl: '/images/interests/market.jpg', label: '市集展会', macroCategory: 'culture', microTags: ['市集', '创意市集', '展会'] },

  // 社交话题 (social) - 4 cards
  { id: 'career', imageUrl: '/images/interests/career.jpg', label: '职场创业', macroCategory: 'social', microTags: ['职场', '创业', '商业'] },
  { id: 'variety', imageUrl: '/images/interests/variety.jpg', label: '综艺八卦', macroCategory: 'social', microTags: ['综艺', '八卦', '娱乐'] },
  { id: 'fashion', imageUrl: '/images/interests/fashion.jpg', label: '时尚穿搭', macroCategory: 'social', microTags: ['时尚', '穿搭', 'OOTD'] },
  { id: 'tech', imageUrl: '/images/interests/tech.jpg', label: '科技数码', macroCategory: 'social', microTags: ['科技', '数码', 'AI'] },
];

export const MACRO_CATEGORY_LABELS: Record<InterestCard['macroCategory'], string> = {
  leisure: '休闲娱乐',
  food: '美食探索',
  lifestyle: '生活方式',
  culture: '文化艺术',
  social: '社交话题',
};

export const MACRO_CATEGORY_COLORS: Record<InterestCard['macroCategory'], string> = {
  leisure: 'from-purple-500 to-pink-500',
  food: 'from-orange-500 to-red-500',
  lifestyle: 'from-green-500 to-teal-500',
  culture: 'from-blue-500 to-indigo-500',
  social: 'from-yellow-500 to-orange-500',
};

export type SwipeChoice = 'like' | 'skip' | 'love';

export interface SwipeResult {
  cardId: string;
  choice: SwipeChoice;
  reactionTimeMs: number;
}

export function shuffleCards(cards: InterestCard[]): InterestCard[] {
  const shuffled = [...cards];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

export function ensureCategoryBalance(cards: InterestCard[], maxPerCategory: number = 4): InterestCard[] {
  const result: InterestCard[] = [];
  const countByCategory: Record<string, number> = {};
  
  for (const card of cards) {
    const count = countByCategory[card.macroCategory] || 0;
    if (count < maxPerCategory) {
      result.push(card);
      countByCategory[card.macroCategory] = count + 1;
    }
  }
  
  return result;
}

export function getSmartCardSelection(allCards: InterestCard[], targetCount: number = 18): InterestCard[] {
  const shuffled = shuffleCards(allCards);
  const balanced = ensureCategoryBalance(shuffled, 4);
  return balanced.slice(0, targetCount);
}
