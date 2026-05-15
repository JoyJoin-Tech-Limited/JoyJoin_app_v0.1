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
 * Extracted from actual archetype illustration body colors via precision
 * pixel sampling (ImageMagick). Updated 2026-04-23 to fix significant
 * hue discrepancies between code tokens and actual artwork.
 *
 * Previous errors corrected:
 * - octopus: was purple (h:271), is pink/salmon (h:3)
 * - koala: was orange (h:24), is gray-lavender (h:247)
 * - owl: was purple (h:260), is brown (h:12)
 * - cat: was purple (h:280), is warm gray (h:52)
 * - hamster_praise: was pink (h:340), is beige (h:27)
 * - turtle: was teal (h:150), is olive green (h:90)
 */
const CANONICAL_COLORS: Record<string, ArchetypeHSL> = {
  'corgi': { h: 25, s: 48, l: 60 },        // #CB9268 warm tan
  'rooster': { h: 38, s: 71, l: 50 },      // #C49538 golden amber
  'hamster_praise': { h: 27, s: 29, l: 78 }, // #D8C6B7 warm beige
  'fox': { h: 26, s: 46, l: 57 },          // #C68E61 warm orange-brown
  'dolphin_calm': { h: 197, s: 63, l: 82 }, // #B8DFEF light sky blue
  'spider': { h: 280, s: 12, l: 36 },      // #62526A muted purple-gray
  'koala': { h: 247, s: 11, l: 70 },       // #ADABBC gray-lavender
  'octopus': { h: 3, s: 40, l: 65 },       // #CB8783 pink/salmon
  'owl': { h: 12, s: 26, l: 35 },          // #714C42 warm brown
  'elephant': { h: 215, s: 34, l: 80 },    // #BCCADE light blue-gray
  'turtle': { h: 90, s: 25, l: 30 },       // #4D613A olive green
  'cat': { h: 52, s: 17, l: 81 },          // #D8D6C7 warm light gray
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
 * Quantized color families for mini-program card theming.
 * Maps 12 archetypes into 4 CSS families to avoid per-card inline style bloat.
 */
export const ARCHETYPE_FAMILY_MAP: Record<string, 'warm' | 'cool' | 'fire' | 'calm'> = {
  'corgi': 'warm',
  'rooster': 'warm',
  'hamster_praise': 'warm',
  'fox': 'cool',
  'dolphin_calm': 'cool',
  'octopus': 'cool',
  'koala': 'fire',
  'spider': 'fire',
  'owl': 'calm',
  'elephant': 'calm',
  'turtle': 'calm',
  'cat': 'calm',
}

/**
 * Get the quantized color family for an archetype.
 */
export function getArchetypeFamily(archetype: string | null | undefined): 'warm' | 'cool' | 'fire' | 'calm' {
  if (!archetype) return 'calm'
  return ARCHETYPE_FAMILY_MAP[archetype] || 'calm'
}

/**
 * Family hex colors for mini-program card theming.
 * Derived from the dominant archetype colors in each family.
 */
export const ARCHETYPE_FAMILY_COLORS: Record<string, string> = {
  warm: '#C79450',
  cool: '#5B8DB8',
  fire: '#D4A843',
  calm: '#6B9E75',
}

/**
 * Family gradient backgrounds for Oracle Card surfaces.
 * Subtle wash of family color on white base.
 */
export const ARCHETYPE_FAMILY_GRADIENTS: Record<string, string> = {
  warm: 'linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(199,148,80,0.06) 100%)',
  cool: 'linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(91,141,184,0.06) 100%)',
  fire: 'linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(212,168,67,0.06) 100%)',
  calm: 'linear-gradient(155deg, rgba(255,255,255,0.98) 0%, rgba(107,158,117,0.06) 100%)',
}

/**
 * Format HSL values as a CSS string.
 */
export function formatHSL(hsl: ArchetypeHSL): string {
  return `hsl(${hsl.h}, ${hsl.s}%, ${hsl.l}%)`
}
