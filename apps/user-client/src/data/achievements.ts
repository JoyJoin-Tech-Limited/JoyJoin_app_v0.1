/**
 * Achievement definitions for gamification
 */

export type AchievementRarity = "common" | "rare" | "epic" | "legendary";

export interface Achievement {
  id: string;
  title: string;
  description: string;
  rarity: AchievementRarity;
  emoji: string;
}

export const ACHIEVEMENTS: Record<string, Achievement> = {
  first_answer: {
    id: "first_answer",
    title: "初次回答",
    description: "完成第一道题目",
    rarity: "common",
    emoji: "🎯",
  },
  quick_thinker: {
    id: "quick_thinker",
    title: "快速思考",
    description: "在5秒内回答问题",
    rarity: "rare",
    emoji: "⚡",
  },
  halfway_hero: {
    id: "halfway_hero",
    title: "半程英雄",
    description: "完成50%的进度",
    rarity: "common",
    emoji: "🏃",
  },
  explorer: {
    id: "explorer",
    title: "探索者",
    description: "使用换题功能",
    rarity: "common",
    emoji: "🔍",
  },
  destined_match: {
    id: "destined_match",
    title: "命中注定",
    description: "原型匹配度超过85%",
    rarity: "epic",
    emoji: "✨",
  },
  night_owl: {
    id: "night_owl",
    title: "夜猫子",
    description: "在深夜完成测评",
    rarity: "rare",
    emoji: "🦉",
  },
  perfectionist: {
    id: "perfectionist",
    title: "完美主义",
    description: "比最低要求多回答4道题",
    rarity: "legendary",
    emoji: "💎",
  },
};

/** Get rarity color classes */
export function getRarityStyles(rarity: AchievementRarity): {
  bg: string;
  border: string;
  text: string;
  glow: string;
  progressBg: string;
} {
  switch (rarity) {
    case "common":
      return {
        bg: "bg-gray-100 dark:bg-gray-800",
        border: "border-gray-300 dark:border-gray-600",
        text: "text-gray-700 dark:text-gray-300",
        glow: "",
        progressBg: "bg-gray-300 dark:bg-gray-600",
      };
    case "rare":
      return {
        bg: "bg-blue-50 dark:bg-blue-900/30",
        border: "border-blue-400 dark:border-blue-500",
        text: "text-blue-700 dark:text-blue-300",
        glow: "shadow-blue-500/20",
        progressBg: "bg-blue-400 dark:bg-blue-500",
      };
    case "epic":
      return {
        bg: "bg-purple-50 dark:bg-purple-900/30",
        border: "border-purple-400 dark:border-purple-500",
        text: "text-purple-700 dark:text-purple-300",
        glow: "shadow-purple-500/30",
        progressBg: "bg-purple-400 dark:bg-purple-500",
      };
    case "legendary":
      return {
        bg: "bg-gradient-to-r from-amber-50 to-yellow-50 dark:from-amber-900/30 dark:to-yellow-900/30",
        border: "border-amber-400 dark:border-amber-500",
        text: "text-amber-700 dark:text-amber-300",
        glow: "shadow-amber-500/40 shadow-lg",
        progressBg: "bg-amber-400 dark:bg-amber-500",
      };
  }
}

/** Get haptic pattern based on rarity */
export function getRarityHapticPattern(rarity: AchievementRarity): number[] {
  switch (rarity) {
    case "common":
      return [50];
    case "rare":
      return [50, 30, 50];
    case "epic":
      return [50, 30, 50, 30, 80];
    case "legendary":
      return [80, 40, 80, 40, 160];
  }
}
