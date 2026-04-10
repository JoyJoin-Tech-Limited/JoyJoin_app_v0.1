/**
 * Re-export achievement definitions from the shared package.
 *
 * This facade preserves backward-compatible import paths (`@/data/achievements`)
 * while the canonical definitions now live in `packages/shared/src/achievements.ts`.
 *
 * `getRarityStyles` is web-specific (returns Tailwind classes) and stays here.
 */
export {
  type AchievementRarity,
  type Achievement,
  ACHIEVEMENTS,
  getRarityClassName,
  getRarityHapticPattern,
} from "@joyjoin/shared/achievements";

import type { AchievementRarity } from "@joyjoin/shared/achievements";

/** Get Tailwind rarity color classes (web-only). */
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
