export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  rarity: AchievementRarity;
  icon: string;
}

export const RARITY_CONFIG: Record<AchievementRarity, {
  label: string;
  badgeClass: string;
  accent: string;
  iconBg: string;
  sparkleCount: number;
}> = {
  common: {
    label: "普通",
    badgeClass: "bg-slate-100 text-slate-700 border border-slate-200",
    accent: "from-slate-50 to-white",
    iconBg: "bg-slate-200",
    sparkleCount: 0,
  },
  rare: {
    label: "稀有",
    badgeClass: "bg-blue-100 text-blue-700 border border-blue-200",
    accent: "from-blue-50 to-white",
    iconBg: "bg-blue-100",
    sparkleCount: 1,
  },
  epic: {
    label: "史诗",
    badgeClass: "bg-purple-100 text-purple-800 border border-purple-200",
    accent: "from-purple-50 to-white",
    iconBg: "bg-purple-100",
    sparkleCount: 3,
  },
  legendary: {
    label: "传说",
    badgeClass: "bg-amber-100 text-amber-800 border border-amber-200",
    accent: "from-amber-50 to-white",
    iconBg: "bg-amber-100",
    sparkleCount: 6,
  },
};

export const ACHIEVEMENTS: Achievement[] = [
  {
    id: "guide_completed",
    title: "完成小悦引导",
    description: "看完引导流程，准备开始社交冒险",
    rarity: "common",
    icon: "📖",
  },
  {
    id: "personality_started",
    title: "探索你的社交DNA",
    description: "开始新版性格测评",
    rarity: "common",
    icon: "🚀",
  },
  {
    id: "first_answer",
    title: "第一步勇气",
    description: "提交了第 1 道题的答案",
    rarity: "rare",
    icon: "🎯",
  },
  {
    id: "five_answers",
    title: "专注探索",
    description: "坚持回答 5 道题，离结果更近一步",
    rarity: "epic",
    icon: "🌟",
  },
  {
    id: "test_completed",
    title: "社交原型解锁",
    description: "完成了性格测评，获得专属原型",
    rarity: "legendary",
    icon: "🏅",
  },
  {
    id: "profile_viewed",
    title: "成就收藏家",
    description: "查看成就合集，规划下一步目标",
    rarity: "rare",
    icon: "🎖️",
  },
];

export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find((achievement) => achievement.id === id);
}
