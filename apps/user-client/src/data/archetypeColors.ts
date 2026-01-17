/**
 * Archetype color mappings for dynamic accent theming
 * HSL values: [hue, saturation%, lightness%]
 */

export interface ArchetypeHSL {
  h: number;
  s: number;
  l: number;
}

/**
 * Canonical archetype color definitions
 * Order matches backend ARCHETYPE_NAMES from apps/server/src/archetypeConfig.ts
 */
const CANONICAL_COLORS: Record<string, ArchetypeHSL> = {
  "开心柯基": { h: 43, s: 96, l: 56 },   // amber
  "太阳鸡": { h: 50, s: 90, l: 55 },     // yellow
  "夸夸豚": { h: 340, s: 75, l: 65 },    // pink
  "机智狐": { h: 25, s: 95, l: 53 },     // orange
  "淡定海豚": { h: 187, s: 85, l: 53 },  // cyan
  "织网蛛": { h: 220, s: 50, l: 45 },    // blue-gray
  "暖心熊": { h: 24, s: 80, l: 50 },     // warm brown
  "灵感章鱼": { h: 271, s: 91, l: 65 },  // purple
  "沉思猫头鹰": { h: 260, s: 50, l: 50 }, // deep purple
  "定心大象": { h: 200, s: 30, l: 55 },  // gray-blue
  "稳如龟": { h: 150, s: 60, l: 45 },    // green
  "隐身猫": { h: 280, s: 40, l: 55 },    // muted purple
};

/** Archetype name aliases (maps shortened/variant names to canonical names) */
const ARCHETYPE_ALIASES: Record<string, string> = {
  // No aliases needed - all names match backend canonical names
};

/** Combined archetype colors with aliases resolved */
export const ARCHETYPE_COLORS: Record<string, ArchetypeHSL> = {
  ...CANONICAL_COLORS,
  // Add alias entries pointing to same HSL values
  ...Object.fromEntries(
    Object.entries(ARCHETYPE_ALIASES).map(([alias, canonical]) => [
      alias,
      CANONICAL_COLORS[canonical],
    ])
  ),
};

/** Default primary color (purple) when no archetype is determined */
export const DEFAULT_ACCENT: ArchetypeHSL = { h: 280, s: 45, l: 55 };

/** Minimum confidence threshold for applying archetype color */
export const MIN_CONFIDENCE_THRESHOLD = 0.35;

/**
 * Get archetype HSL values with fallback to default
 */
export function getArchetypeHSL(archetype: string | null | undefined): ArchetypeHSL {
  if (!archetype) return DEFAULT_ACCENT;
  return ARCHETYPE_COLORS[archetype] || DEFAULT_ACCENT;
}

/**
 * Format HSL values as CSS string
 */
export function formatHSL(hsl: ArchetypeHSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`;
}
