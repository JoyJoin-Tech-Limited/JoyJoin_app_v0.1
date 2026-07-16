import { describe, expect, it } from 'vitest'
import { PHASE_ACCENTS, getPhaseFoilStyle } from '../phases/phaseAccents'

const PHASES = [
  'warmup',
  'micro_challenge',
  'lie_detective',
  'personality_dice',
  'quip_battle',
  'undercover_word',
  'group_mirror',
  'auction',
  'speed_friending',
  'mini_script',
  'recap',
] as const

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const la = luminance(hexToRgb(hexA))
  const lb = luminance(hexToRgb(hexB))
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

describe('PHASE_ACCENTS registry', () => {
  it('covers every playable phase + recap', () => {
    for (const phase of PHASES) {
      expect(PHASE_ACCENTS[phase], `missing accent for ${phase}`).toBeDefined()
      expect(PHASE_ACCENTS[phase]?.label).toBeTruthy()
    }
  })

  it('accentDeep holds ≥4.5:1 contrast on its tint (small text rule)', () => {
    for (const phase of PHASES) {
      const accent = PHASE_ACCENTS[phase]
      if (!accent) continue
      const ratio = contrastRatio(accent.accentDeep, accent.tint)
      expect(ratio, `${phase}: ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('foil style emits rgba strings (WeChat WXSS drops hsla)', () => {
    for (const phase of PHASES) {
      const foil = getPhaseFoilStyle(phase)
      expect(foil).not.toBeNull()
      expect(foil?.borderColor).toMatch(/^rgba\(/)
      expect(foil?.boxShadow).toContain('rgba(')
      expect(foil?.boxShadow).not.toContain('hsla(')
      expect(foil?.emblemBackground).toMatch(/^rgba\(/)
    }
  })

  it('returns null for unknown phases instead of crashing', () => {
    expect(getPhaseFoilStyle('phase_selection')).toBeNull()
  })
})
