import { Heart, MessageCircle, AlertCircle, type LucideIcon } from "lucide-react";

export interface InterestOption {
  id: string;
  label: string;
  heat: number;
}

export interface TopicOption {
  id: string;
  label: string;
  heat: number;
}

export interface TopicGroup {
  name: string;
  description: string;
  topics: TopicOption[];
}

export const INTERESTS_OPTIONS: InterestOption[] = [
  { id: "food_dining", label: "美食探店", heat: 82 },
  { id: "travel", label: "说走就走", heat: 75 },
  { id: "city_walk", label: "City Walk", heat: 68 },
  { id: "drinks_bar", label: "喝酒小酌", heat: 62 },
  { id: "music_live", label: "音乐Live", heat: 58 },
  { id: "photography", label: "拍拍拍", heat: 52 },
  { id: "sports_fitness", label: "撸铁运动", heat: 48 },
  { id: "arts_culture", label: "看展看剧", heat: 45 },
  { id: "games_video", label: "打游戏", heat: 42 },
  { id: "pets_animals", label: "吸猫撸狗", heat: 38 },
  { id: "reading_books", label: "看书充电", heat: 35 },
  { id: "tech_gadgets", label: "数码控", heat: 32 },
  { id: "outdoor_adventure", label: "徒步露营", heat: 28 },
  { id: "games_board", label: "桌游卡牌", heat: 25 },
  { id: "entrepreneurship", label: "创业商业", heat: 22 },
  { id: "investing", label: "投资理财", heat: 20 },
  { id: "diy_crafts", label: "手工DIY", heat: 18 },
  { id: "volunteering", label: "志愿公益", heat: 15 },
  { id: "meditation", label: "冥想正念", heat: 12 },
  { id: "languages", label: "语言学习", heat: 10 },
];

export const TOPICS_GROUPS: Record<string, TopicGroup> = {
  casual: {
    name: "聊着玩",
    description: "轻松日常，怎么开心怎么聊",
    topics: [
      { id: "movies_shows", label: "追剧躺平", heat: 68 },
      { id: "music_taste", label: "听歌演唱会", heat: 55 },
      { id: "food_culture", label: "美食安利", heat: 65 },
      { id: "travel_stories", label: "旅行故事", heat: 62 },
      { id: "fashion_trends", label: "潮流时尚", heat: 60 },
      { id: "gossip_entertainment", label: "八卦娱乐", heat: 58 },
      { id: "zodiac_mbti", label: "星座MBTI", heat: 72 },
      { id: "work_rants", label: "职场吐槽", heat: 65 },
      { id: "hobbies_niche", label: "小众爱好", heat: 35 },
    ]
  },
  deep: {
    name: "走心聊",
    description: "认真交流，聊点有深度的",
    topics: [
      { id: "life_philosophy", label: "人生三观", heat: 45 },
      { id: "career_growth", label: "职业发展", heat: 48 },
      { id: "relationships", label: "人际社交", heat: 42 },
      { id: "dating_love", label: "恋爱情感", heat: 52 },
      { id: "mental_health", label: "情绪心理", heat: 38 },
      { id: "startup_ideas", label: "创业想法", heat: 32 },
      { id: "tech_ai", label: "科技AI", heat: 40 },
      { id: "self_growth", label: "自我成长", heat: 44 },
    ]
  },
  sensitive: {
    name: "看情况",
    description: "因人而异，适合熟了再聊",
    topics: [
      { id: "current_events", label: "时事新闻", heat: 28 },
      { id: "politics", label: "政治话题", heat: 15 },
      { id: "social_issues", label: "社会议题", heat: 22 },
      { id: "parenting", label: "育儿经验", heat: 18 },
      { id: "religion", label: "宗教信仰", heat: 12 },
      { id: "money_finance", label: "收入理财", heat: 25 },
    ]
  }
};

export function getInterestLabel(id: string): string {
  const interest = INTERESTS_OPTIONS.find(i => i.id === id);
  return interest?.label || id;
}

export function getTopicLabel(id: string): string {
  for (const group of Object.values(TOPICS_GROUPS)) {
    const topic = group.topics.find(t => t.id === id);
    if (topic) return topic.label;
  }
  return id;
}

export function getAllTopics(): TopicOption[] {
  return Object.values(TOPICS_GROUPS).flatMap(g => g.topics);
}
