import { describe, expect, it } from 'vitest'
import { getDeepContrastArchetypeColor } from '@shared/archetypeColors'
import { FLOW_BANNER_ARCHETYPES } from '../../lib/utils/flowBannerAssets'

// Chip surface: rgba($flow-surface-primary, 0.94) over the shell's near-white
// $flow-bg-primary — effectively white for contrast purposes.
const CHIP_SURFACE: [number, number, number] = [255, 255, 255]

function parseRgba(input: string): [number, number, number] {
  const match = input.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/)
  if (!match) throw new Error(`not an rgba() color: ${input}`)
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (v: number) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(a: [number, number, number], b: [number, number, number]): number {
  const la = luminance(a)
  const lb = luminance(b)
  const [hi, lo] = la > lb ? [la, lb] : [lb, la]
  return (hi + 0.05) / (lo + 0.05)
}

describe('FlowShell identity chip contrast (AC9)', () => {
  it('covers all 12 flow companion archetypes', () => {
    expect(FLOW_BANNER_ARCHETYPES).toHaveLength(12)
  })

  it('every archetype chip color holds ≥4.5:1 on the chip surface (small text rule)', () => {
    for (const archetype of FLOW_BANNER_ARCHETYPES) {
      const color = getDeepContrastArchetypeColor(archetype)
      const ratio = contrastRatio(parseRgba(color), CHIP_SURFACE)
      expect(ratio, `${archetype}: ${color} → ${ratio.toFixed(2)}:1`).toBeGreaterThanOrEqual(4.5)
    }
  })

  it('emits rgba() strings (WeChat WXSS silently drops hsla)', () => {
    for (const archetype of FLOW_BANNER_ARCHETYPES) {
      expect(getDeepContrastArchetypeColor(archetype)).toMatch(/^rgba\(/)
    }
  })
})
