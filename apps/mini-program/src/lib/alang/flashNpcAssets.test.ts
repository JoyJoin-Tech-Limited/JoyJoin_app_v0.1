import { describe, expect, it } from 'vitest'
import { FLASH_NPC_SEEDS } from '@shared/alang/flashCatalog'
import { FLASH_UNIVERSAL_ART, flashNpcAssets, flashTaskCategories, resolveFlashNpcTheme } from './flashNpcAssets'

function hexToRgb(hex: string): [number, number, number] {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ]
}

function luminance([r, g, b]: [number, number, number]): number {
  const channel = (value: number) => {
    const normalized = value / 255
    return normalized <= 0.03928
      ? normalized / 12.92
      : Math.pow((normalized + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b)
}

function contrastRatio(hexA: string, hexB: string): number {
  const luminanceA = luminance(hexToRgb(hexA))
  const luminanceB = luminance(hexToRgb(hexB))
  const [lighter, darker] = luminanceA > luminanceB
    ? [luminanceA, luminanceB]
    : [luminanceB, luminanceA]
  return (lighter + 0.05) / (darker + 0.05)
}

describe('Flash NPC asset registry', () => {
  it('reuses one lightweight city encounter artwork across every animal NPC', () => {
    expect(Object.values(flashNpcAssets).map(({ name, animal, imageSrc }) => ({ name, animal, imageSrc })))
      .toEqual([
        { name: '阿浪', animal: '灰狼', imageSrc: FLASH_UNIVERSAL_ART },
        { name: '栗子', animal: '水獭', imageSrc: FLASH_UNIVERSAL_ART },
        { name: '默默', animal: '兔狲', imageSrc: FLASH_UNIVERSAL_ART },
        { name: '拾柒', animal: '乌鸦', imageSrc: FLASH_UNIVERSAL_ART },
        { name: '阿团', animal: '水豚', imageSrc: FLASH_UNIVERSAL_ART },
      ])
  })

  it('falls back to a character glyph instead of inventing CSS animal art', () => {
    expect(resolveFlashNpcTheme('future-friend', '小栖')).toMatchObject({
      imageSrc: '',
      fallbackGlyph: '小',
    })
  })

  it('keeps the lightweight local visual registry aligned with the canonical NPC colors', () => {
    expect(Object.values(flashNpcAssets).map(({ slug, accent }) => ({ slug, accent })))
      .toEqual(FLASH_NPC_SEEDS.map(({ slug, themeColor }) => ({ slug, accent: themeColor })))
  })

  it('separates decorative task accents from readable badge text at 4.5:1 contrast', () => {
    for (const [category, palette] of Object.entries(flashTaskCategories)) {
      expect(palette.text, `${category} needs a readable text token`).not.toBe(palette.accent)
      expect(
        contrastRatio(palette.text, palette.tint),
        `${category}: ${palette.text} on ${palette.tint}`,
      ).toBeGreaterThanOrEqual(4.5)
    }
  })
})
