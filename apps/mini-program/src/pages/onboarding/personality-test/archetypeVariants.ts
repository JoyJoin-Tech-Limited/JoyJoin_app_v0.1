/**
 * Archetype color variant generator for the mini-program share card.
 * Derives 3 palette variants from the canonical archetype HSL color.
 *
 * All output colors use `rgba()` because WeChat WXSS silently drops
 * `hsla()` / `hsl()` functional notation on many base library versions.
 */

import { formatHSLAsRGBA, getArchetypeHSL, type ArchetypeHSL } from '@shared/archetypeColors'

export interface ArchetypeCardVariant {
  name: string
  accentColor: string
  accentSoft: string
  accentStrong: string
  accentBorder: string
  accentGlow: string
  accentSurface: string
}

function hslToCss(h: number, s: number, l: number, a = 1): string {
  return formatHSLAsRGBA({ h, s, l } as ArchetypeHSL, a)
}

function buildVariant(h: number, s: number, l: number): Omit<ArchetypeCardVariant, 'name'> {
  return {
    accentColor: hslToCss(h, s, l),
    accentSoft: hslToCss(h, s, l, 0.12),
    accentStrong: hslToCss(h, s, l, 0.86),
    accentBorder: hslToCss(h, s, l, 0.22),
    accentGlow: hslToCss(h, s, l, 0.26),
    accentSurface: `linear-gradient(160deg, ${hslToCss(h, s, l, 0.08)} 0%, ${hslToCss(h, Math.max(s - 10, 20), Math.min(l + 10, 95), 0.06)} 100%)`,
  }
}

/**
 * Generate 3 color variants for an archetype:
 * 1. Original — canonical color
 * 2. Vivid — higher saturation, slightly lighter (more energetic)
 * 3. Twilight — hue-shifted ±30° for contrast
 */
export function getArchetypeCardVariants(archetypeName: string): ArchetypeCardVariant[] {
  const { h, s, l } = getArchetypeHSL(archetypeName)

  const base = buildVariant(h, s, l)
  const vivid = buildVariant(h, Math.min(s + 15, 100), Math.min(l + 8, 80))
  const twilight = buildVariant((h + 30) % 360, Math.min(s + 5, 100), Math.max(l - 10, 30))

  return [
    { name: '经典', ...base },
    { name: '炫彩', ...vivid },
    { name: '幻夜', ...twilight },
  ]
}
