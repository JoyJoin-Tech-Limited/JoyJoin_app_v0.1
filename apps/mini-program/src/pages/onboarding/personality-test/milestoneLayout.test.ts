import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const pageStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/personality-test/index.scss'),
  'utf8',
)
const milestoneStyles = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/personality-test/HalfwayMilestone.scss'),
  'utf8',
)

describe('personality test milestone layout', () => {
  it('keeps the halfway hint readable without flex compression', () => {
    const cardBlock = milestoneStyles.match(/&__card\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''
    const textBlock = milestoneStyles.match(/&__text\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''

    expect(cardBlock).toContain('flex: 0 0 auto;')
    expect(textBlock).toContain('padding-top: 8rpx;')
  })

  it('bounds the static mascot to the original avatar slot', () => {
    const mascotBlock = pageStyles.match(/&__mascot-animator\s*\{([\s\S]*?)\n\s*\}/)?.[1] ?? ''

    expect(mascotBlock).toContain('width: 152rpx;')
    expect(mascotBlock).toContain('height: 152rpx;')
  })
})
