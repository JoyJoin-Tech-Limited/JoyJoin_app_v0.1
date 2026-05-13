/**
 * Canonical brand color constants for TypeScript consumption.
 *
 * ⚠️ Keep in sync with `apps/mini-program/src/styles/_variables.scss`.
 * When updating hex values, update both files to prevent drift.
 */

export const BRAND_COLORS = {
  // Primary anchor
  primary: "#8B5CF6",
  primaryDark: "#7C3AED",
  primaryLight: "#EDE9FE",

  // Secondary / warm accent
  secondary: "#FF6B9D",

  // Semantic particle colors (BondingCloud)
  particleCenter: "#8B5CF6", // Vibrant Purple — AI / magic
  particleWarm: "#FF9B85", // Warm Coral — human warmth
  particleJoy: "#FFD166", // Joy Yellow — energy / delight
  particleCalm: "#A8C5DD", // Sky Blue — trust / calm
  particleGrowth: "#9ACD32", // Fresh Green — growth / connection

  // Bonding factor pill colors
  factorInterest: "#FF9B85",
  factorPersonality: "#8B5CF6",
  factorAi: "#9ACD32",
  factorTopic: "#A8C5DD",
  factorVibe: "#F5B75F",
} as const

export type BrandColorKey = keyof typeof BRAND_COLORS
