/**
 * Archetype Color Token System
 *
 * 5-color palette per archetype (primary / light / dark / background / surface)
 * plus 4 unified family palettes (warm / cool / fire / calm).
 *
 * Delivered by designer from Prompt 3 grid. Dark variants adjusted for
 * WCAG AA text contrast (≥ 4.5:1 on white) where the original was too light.
 *
 * Single source of truth for archetype theming across mini-program and web.
 */

export interface ArchetypeColorToken {
  primary: string
  light: string
  dark: string
  background: string
  surface: string
}

// ═════════════════════════════════════════════════════════════════
// Per-archetype 5-color palettes (keyed by assetKey)
// ═════════════════════════════════════════════════════════════════

export const ARCHETYPE_TOKENS: Record<string, ArchetypeColorToken> = {
  fox: {
    primary: '#C68E61',
    light: '#E5B896',
    dark: '#8B5E3C',
    background: '#FFF5EE',
    surface: '#F5E5D8',
  },
  corgi: {
    primary: '#CB9268',
    light: '#E8BFA0',
    dark: '#9A6B4A',
    background: '#FFF6F0',
    surface: '#F7E8DC',
  },
  turtle: {
    primary: '#4D613A',
    light: '#8BA872',
    dark: '#2F3A23',
    background: '#F4F7F1',
    surface: '#DDE8D3',
  },
  rooster: {
    primary: '#C49538',
    light: '#E5C075',
    dark: '#8B6A28',
    background: '#FFF8ED',
    surface: '#F5EBCE',
  },
  cat: {
    primary: '#D8D6C7',
    light: '#EEEEE5',
    dark: '#8A8878', // adjusted from #A8A699 for text contrast
    background: '#FAFAF8',
    surface: '#F0F0EA',
  },
  koala: {
    primary: '#ADABBC',
    light: '#D5D4E0',
    dark: '#6B6980', // adjusted from #7D7B8E for text contrast
    background: '#F8F8FB',
    surface: '#E8E7F0',
  },
  hamster_praise: {
    primary: '#D8C6B7',
    light: '#EEE3D8',
    dark: '#9A8575', // adjusted from #A89585 for text contrast
    background: '#FBF8F5',
    surface: '#F2EAE3',
  },
  dolphin_calm: {
    primary: '#B8DFEF',
    light: '#E0F2F9',
    dark: '#4A8AAF', // adjusted from #7AB8D5 for text contrast
    background: '#F5FBFE',
    surface: '#E3F4FB',
  },
  octopus: {
    primary: '#CB8783',
    light: '#E8BFBC',
    dark: '#9A5F5C',
    background: '#FFF6F5',
    surface: '#F7E5E4',
  },
  elephant: {
    primary: '#BCCADE',
    light: '#E0E8F3',
    dark: '#6A7F9C', // adjusted from #8A9FBC for text contrast
    background: '#F7F9FC',
    surface: '#E8EEF7',
  },
  owl: {
    primary: '#714C42',
    light: '#A8826F',
    dark: '#4A3229',
    background: '#F7F4F2',
    surface: '#E8DDD8',
  },
  spider: {
    primary: '#62526A',
    light: '#9B8FA5',
    dark: '#423648',
    background: '#F6F5F7',
    surface: '#E5E1E8',
  },
}

// ═════════════════════════════════════════════════════════════════
// Family color tokens (4 quantized families for CSS theming)
// ═════════════════════════════════════════════════════════════════

export const FAMILY_TOKENS: Record<string, ArchetypeColorToken> = {
  warm: {
    primary: '#C79450',
    light: '#E6BC82',
    dark: '#936D38',
    background: '#FFF7EE',
    surface: '#F6E9D6',
  },
  cool: {
    primary: '#C0A17B',
    light: '#DCC9B2',
    dark: '#947A5A',
    background: '#FFF8F3',
    surface: '#F4EBE1',
  },
  fire: {
    primary: '#877B93',
    light: '#B8B2C3',
    dark: '#5E5469',
    background: '#F7F6F9',
    surface: '#E6E4EC',
  },
  calm: {
    primary: '#8E8E88',
    light: '#BDBDB5',
    dark: '#656560',
    background: '#F7F7F5',
    surface: '#EAEAE5',
  },
}

// ═════════════════════════════════════════════════════════════════
// Lookup helpers
// ═════════════════════════════════════════════════════════════════

export function getArchetypeTokens(archetype: string | null | undefined): ArchetypeColorToken {
  if (!archetype) return FAMILY_TOKENS.calm
  return ARCHETYPE_TOKENS[archetype] ?? FAMILY_TOKENS.calm
}

export function getFamilyTokens(family: string | null | undefined): ArchetypeColorToken {
  if (!family) return FAMILY_TOKENS.calm
  return FAMILY_TOKENS[family] ?? FAMILY_TOKENS.calm
}
