import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')
const variablesSource = readFileSync(resolve(sourceRoot, 'styles/_variables.scss'), 'utf8')
const flashScssSource = readFileSync(resolve(sourceRoot, 'pages/alang/flash.scss'), 'utf8')

function readHexToken(name: string): string {
  const match = variablesSource.match(new RegExp(`\\$${name}:\\s*(#[0-9A-Fa-f]{6})`))
  expect(match, `missing $${name}`).not.toBeNull()
  return match?.[1] ?? '#000000'
}

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

describe('Flash readable color tokens', () => {
  it('keeps small-copy and success-text tokens at 4.5:1 on every Flash light surface', () => {
    const foregrounds = [
      readHexToken('color-text-secondary-on-light'),
      readHexToken('color-text-tertiary-on-light'),
      readHexToken('color-success-text-on-light'),
    ]
    const backgrounds = [
      readHexToken('color-surface'),
      readHexToken('color-bg-warm-to'),
      readHexToken('color-bg-clean'),
      readHexToken('color-bg-tint-purple'),
    ]

    for (const foreground of foregrounds) {
      for (const background of backgrounds) {
        expect(
          contrastRatio(foreground, background),
          `${foreground} on ${background}`,
        ).toBeGreaterThanOrEqual(4.5)
      }
    }
  })

  it('uses the readable semantic tokens instead of decorative base colors for Flash copy', () => {
    expect(flashScssSource).not.toMatch(/\$color-text-secondary(?=[;,)\s])/)
    expect(flashScssSource).not.toMatch(/\$color-text-tertiary(?=[;,)\s])/)
    expect(flashScssSource).not.toMatch(/\$color-success(?=[;,)\s])/)
  })

  it('keeps platform control colors centralized and badge copy on its text palette', () => {
    const preferencesSource = readFileSync(resolve(sourceRoot, 'pages/alang/preferences/index.tsx'), 'utf8')
    const companionSource = readFileSync(resolve(sourceRoot, 'pages/alang/companion/index.tsx'), 'utf8')
    const platformControlSources = [
      companionSource,
      readFileSync(resolve(sourceRoot, 'pages/alang/config/index.tsx'), 'utf8'),
      readFileSync(resolve(sourceRoot, 'pages/alang/debug/index.tsx'), 'utf8'),
    ].join('\n')
    const badgeConsumers = [
      readFileSync(resolve(sourceRoot, 'components/alang/FlashUi.tsx'), 'utf8'),
      readFileSync(resolve(sourceRoot, 'pages/alang/dialogue/index.tsx'), 'utf8'),
      companionSource,
    ].join('\n')

    expect(preferencesSource).not.toContain("color='#")
    expect(platformControlSources).not.toContain("confirmColor: '#")
    expect(badgeConsumers).not.toContain('color: category.accent')
    expect(badgeConsumers.match(/color: category\.text/g)).toHaveLength(3)
  })
})
