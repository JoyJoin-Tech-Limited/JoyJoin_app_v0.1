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

/** Hex equivalent of the SCSS `$color-primary` token for runtime APIs (e.g. Taro.showModal). */
export const BRAND_PRIMARY_HEX = '#8B5CF6' as const

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

/**
 * Format HSL + alpha as a CSS `rgba(...)` string.
 *
 * WeChat Mini Program WXSS does NOT support the `hsla()` functional
 * notation — it silently drops the style, leaving alpha surfaces
 * transparent. Use this helper anywhere alpha matters in a mini-program
 * inline style. The web client can keep using `formatHSL` / `hsla`
 * because regular CSS supports both.
 */
export function formatHSLAsRGBA(hsl: ArchetypeHSL, alpha: number): string {
  const { r, g, b } = hslToRgb(hsl)
  const a = Math.max(0, Math.min(1, alpha))
  return `rgba(${r}, ${g}, ${b}, ${a})`
}

function hslToRgb(hsl: ArchetypeHSL): { r: number; g: number; b: number } {
  const h = ((hsl.h % 360) + 360) % 360
  const s = Math.max(0, Math.min(100, hsl.s)) / 100
  const l = Math.max(0, Math.min(100, hsl.l)) / 100
  const c = (1 - Math.abs(2 * l - 1)) * s
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1))
  const m = l - c / 2
  let rPrime = 0
  let gPrime = 0
  let bPrime = 0
  if (h < 60) { rPrime = c; gPrime = x; bPrime = 0 }
  else if (h < 120) { rPrime = x; gPrime = c; bPrime = 0 }
  else if (h < 180) { rPrime = 0; gPrime = c; bPrime = x }
  else if (h < 240) { rPrime = 0; gPrime = x; bPrime = c }
  else if (h < 300) { rPrime = x; gPrime = 0; bPrime = c }
  else { rPrime = c; gPrime = 0; bPrime = x }
  return {
    r: Math.round((rPrime + m) * 255),
    g: Math.round((gPrime + m) * 255),
    b: Math.round((bPrime + m) * 255),
  }
}

/**
 * Return a contrast-safe text variant of an archetype colour.
 *
 * Some canonical archetype colours are very light or desaturated (e.g.
 * hamster_praise beige at l=78, cat grey at s=17). Used as text on light
 * card backgrounds they fail readability. This helper darkens and boosts
 * saturation so the hue family is preserved but WCAG-ish contrast is met.
 *
 * Returns `rgba()` because WeChat WXSS silently drops `hsl()` notation.
 */
export function getContrastSafeArchetypeColor(archetype: string | null | undefined): string {
  const hsl = getArchetypeHSL(archetype)
  const s = Math.min(100, Math.max(hsl.s, 55))
  const l = Math.max(Math.min(hsl.l, 48), 25)
  return formatHSLAsRGBA({ h: hsl.h, s, l } as ArchetypeHSL, 1)
}
