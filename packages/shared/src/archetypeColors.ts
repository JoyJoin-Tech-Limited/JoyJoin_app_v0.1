/**
 * Archetype color mappings for dynamic accent theming.
 *
 * This is the single source of truth for archetype → HSL color mappings
 * consumed by both the web client and the mini-program.
 */

export interface ArchetypeHSL {
  h: number
  s: number
  l: number
}

/**
 * Canonical archetype color definitions.
 *
 * Keys are the Chinese display names used across the product surface.
 */
const CANONICAL_COLORS: Record<string, ArchetypeHSL> = {
  '开心柯基': { h: 43, s: 96, l: 56 },
  '太阳鸡': { h: 50, s: 90, l: 55 },
  '夸夸豚': { h: 340, s: 75, l: 65 },
  '机智狐': { h: 25, s: 95, l: 53 },
  '淡定海豚': { h: 187, s: 85, l: 53 },
  '织网蛛': { h: 220, s: 50, l: 45 },
  '暖心熊': { h: 24, s: 80, l: 50 },
  '灵感章鱼': { h: 271, s: 91, l: 65 },
  '沉思猫头鹰': { h: 260, s: 50, l: 50 },
  '定心大象': { h: 200, s: 30, l: 55 },
  '稳如龟': { h: 150, s: 60, l: 45 },
  '隐身猫': { h: 280, s: 40, l: 55 },
}

/** Combined archetype colors (canonical + any future aliases). */
export const ARCHETYPE_COLORS: Record<string, ArchetypeHSL> = {
  ...CANONICAL_COLORS,
}

/** Default primary accent (purple) when no archetype is determined. */
export const DEFAULT_ACCENT: ArchetypeHSL = { h: 280, s: 45, l: 55 }

/** Minimum confidence threshold for applying archetype color. */
export const MIN_CONFIDENCE_THRESHOLD = 0.35

/**
 * Get archetype HSL values with fallback to default.
 */
export function getArchetypeHSL(archetype: string | null | undefined): ArchetypeHSL {
  if (!archetype) return DEFAULT_ACCENT
  return ARCHETYPE_COLORS[archetype] || DEFAULT_ACCENT
}

/**
 * Format HSL values as a CSS string.
 */
export function formatHSL(hsl: ArchetypeHSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
}
