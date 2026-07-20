import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'

/**
 * PhaseHeroCard accent registry (PR2/PR3 revamp).
 *
 * One accent identity per phase, locked in the 2026-07-17 UIUX review.
 * Family discipline: every accent sits in the shared jewel band (S 45–60%,
 * L 45–55% foil / L 32–40% deep) so all 10 phases harmonize with the
 * JoyJoin purple/pink anchor. `accentDeep` must hold ≥4.5:1 contrast on
 * `tint` — verify in DevTools when adjusting.
 *
 * Foil values are computed as rgba strings here (WeChat WXSS silently drops
 * hsla(); inline style carries computed rgba — TeammateCard precedent).
 */

export interface PhaseAccent {
  /** Foil border + icon/emblem tint (hex). */
  accent: string
  /** Deep variant for small text on `tint` (hex, ≥4.5:1). */
  accentDeep: string
  /** Card tint background (hex). */
  tint: string
  /** Header-rail display name (canonical from phaseRegistry). */
  label: string
}

function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16)
  const g = parseInt(hex.slice(3, 5), 16)
  const b = parseInt(hex.slice(5, 7), 16)
  return `rgba(${r}, ${g}, ${b}, ${alpha})`
}

export const PHASE_ACCENTS: Partial<Record<SocialIcebreakerPhase, PhaseAccent>> = {
  warmup: {
    accent: '#8B5CF6',
    accentDeep: '#7C3AED',
    tint: '#FFFAF4',
    label: '话题卡',
  },
  micro_challenge: {
    accent: '#F2727F',
    accentDeep: '#C23E33', // darkened from #D64F43 — 4.79:1 on tint (#D64F43 was 3.82:1)
    tint: '#FFF3EF',
    label: '挑战',
  },
  lie_detective: {
    accent: '#6E5BA6',
    accentDeep: '#58478C',
    tint: '#F3F0FA',
    label: '谎言侦探',
  },
  personality_dice: {
    accent: '#FF6B9D',
    accentDeep: '#C42E68', // darkened from #D63D75 — 4.83:1 on tint (was 3.98:1)
    tint: '#FFF0F5',
    label: '人格骰子',
  },
  quip_battle: {
    accent: '#F0A030',
    accentDeep: '#9C5F0A', // darkened from #C47A12 — 4.86:1 on tint (was 3.21:1)
    tint: '#FEF7EA',
    label: '机智对决',
  },
  undercover_word: {
    accent: '#E67E22',
    accentDeep: '#A64E0E', // darkened from #C45E12 — 5.07:1 on tint (was 3.81:1)
    tint: '#FCF1E6',
    label: '谁是卧底',
  },
  group_mirror: {
    accent: '#5FA88F',
    accentDeep: '#35755C', // darkened from #3D7F66 — 4.95:1 on tint (was 4.31:1)
    tint: '#EDF6F2',
    label: '群像镜像',
  },
  auction: {
    accent: '#C99A3C',
    accentDeep: '#8A651A', // darkened from #A87F24 — 4.83:1 on tint (was 3.34:1)
    tint: '#FAF4E4',
    label: '拍卖',
  },
  speed_friending: {
    accent: '#5B8DB8',
    accentDeep: '#3D6E9C',
    tint: '#EEF4FA',
    label: '快速交友',
  },
  mini_script: {
    accent: '#C26A8C',
    accentDeep: '#A8486E',
    tint: '#F9EEF2',
    label: '迷你剧本杀',
  },
  recap: {
    accent: '#8B5CF6',
    accentDeep: '#7C3AED',
    tint: '#F5F0FF',
    label: '回顾',
  },
}

export interface PhaseFoilStyle {
  borderColor: string
  boxShadow: string
  background: string
  /** Accent at ~12% alpha — emblem chip / soft fills. */
  emblemBackground: string
  /** Deep accent for small text on the tint. */
  accentDeep: string
}

/**
 * TeammateCard-style foil frame: tinted border + tinted ambient shadow +
 * inset foil edge highlight. Static shape lives in `_phase-hero-card.scss`;
 * only the computed colors ride inline.
 */
export function getPhaseFoilStyle(phase: SocialIcebreakerPhase): PhaseFoilStyle | null {
  const accent = PHASE_ACCENTS[phase]
  if (!accent) return null
  return {
    borderColor: hexToRgba(accent.accent, 0.45),
    boxShadow: `0 8rpx 24rpx ${hexToRgba(accent.accent, 0.16)}, inset 0 0 0 1rpx ${hexToRgba(accent.accentDeep, 0.14)}`,
    background: accent.tint,
    emblemBackground: hexToRgba(accent.accent, 0.12),
    accentDeep: accent.accentDeep,
  }
}
