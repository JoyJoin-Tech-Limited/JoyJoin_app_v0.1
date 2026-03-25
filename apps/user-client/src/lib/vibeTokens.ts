/**
 * vibeTokens.ts
 *
 * Maps the `overallChemistry` value returned by the group analysis API
 * to the visual tokens used in SquadVibePanel and the SquadUnboxingFlow
 * chemistry badge.
 *
 * Shared mapping for chemistry/vibe tokens — new usages should import from
 * here instead of inlining configuration in components.
 */

import type { OverallChemistry } from "@shared/types/groupAnalysis";

export interface VibeTokens {
  /** Primary emoji for the chemistry level */
  emoji: string;
  /** Short, punchy Chinese label shown in the badge */
  label: string;
  /** Longer descriptive Chinese label for the SquadVibePanel header */
  fullLabel: string;
  /** Tailwind gradient classes for the chemistry badge */
  gradientClass: string;
  /** CSS gradient string for the SquadVibePanel background */
  panelGradient: string;
  /** Text colour for content overlaid on panelGradient */
  panelTextColor: string;
}

export const VIBE_TOKENS: Record<OverallChemistry, VibeTokens> = {
  fire: {
    emoji: "🔥",
    label: "超级火花",
    fullLabel: "超高能 · 相性爆表",
    gradientClass: "from-amber-500 to-orange-500",
    panelGradient: "linear-gradient(135deg, #F59E0B, #F97316)",
    panelTextColor: "#fff",
  },
  warm: {
    emoji: "✨",
    label: "暖意融融",
    fullLabel: "温暖 · 很有默契",
    gradientClass: "from-violet-700 to-purple-500",
    panelGradient: "linear-gradient(135deg, #7C3AED, #A855F7)",
    panelTextColor: "#fff",
  },
  mild: {
    emoji: "💬",
    label: "相聊甚欢",
    fullLabel: "平衡 · 各有特色",
    gradientClass: "from-blue-500 to-cyan-500",
    panelGradient: "linear-gradient(135deg, #3B82F6, #06B6D4)",
    panelTextColor: "#fff",
  },
  cold: {
    emoji: "🌱",
    label: "慢慢发现",
    fullLabel: "沉静 · 深度交流",
    gradientClass: "from-green-500 to-emerald-500",
    panelGradient: "linear-gradient(135deg, #10B981, #14B8A6)",
    panelTextColor: "#fff",
  },
};

/** Convenience accessor with fallback to 'warm' for unknown values. */
export function getVibeTokens(chemistry: OverallChemistry | undefined): VibeTokens {
  return chemistry ? VIBE_TOKENS[chemistry] ?? VIBE_TOKENS.warm : VIBE_TOKENS.warm;
}
