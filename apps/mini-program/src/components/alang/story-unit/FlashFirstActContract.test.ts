import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALANG_FIRST_ACT_HIGHLIGHTS } from './AlangFirstActExperience'
import { LIZI_FIRST_ACT_HIGHLIGHTS } from './LiziFirstActExperience'
import { MOMO_FIRST_ACT_HIGHLIGHTS } from './MomoFirstActExperience'
import { SHIQI_FIRST_ACT_HIGHLIGHTS } from './ShiqiFirstActExperience'

const sourceRoot = resolve(process.cwd(), 'src')
const componentRoot = resolve(sourceRoot, 'components/alang/story-unit')
const assetRoot = resolve(sourceRoot, 'pages/alang/assets/ui')

const firstActs = [
  {
    slug: 'alang',
    component: 'AlangFirstActExperience.tsx',
    asset: 'flash-alang-first-act-riverside-v1.jpg',
    objectCode: 'seat-plan',
    gameCode: 'spacing',
    highlights: ALANG_FIRST_ACT_HIGHLIGHTS,
  },
  {
    slug: 'lizi',
    component: 'LiziFirstActExperience.tsx',
    asset: 'flash-lizi-first-act-color-studio-v1.jpg',
    objectCode: 'dry-markers',
    gameCode: 'pairing',
    highlights: LIZI_FIRST_ACT_HIGHLIGHTS,
  },
  {
    slug: 'momo',
    component: 'MomoFirstActExperience.tsx',
    asset: 'flash-momo-first-act-rain-route-v1.jpg',
    objectCode: 'route-book',
    gameCode: 'path',
    highlights: MOMO_FIRST_ACT_HIGHLIGHTS,
  },
  {
    slug: 'shiqi',
    component: 'ShiqiFirstActExperience.tsx',
    asset: 'flash-shiqi-first-act-record-room-v1.jpg',
    objectCode: 'outing-book',
    gameCode: 'overlay',
    highlights: SHIQI_FIRST_ACT_HIGHLIGHTS,
  },
] as const

describe('Flash four-NPC first-act contract', () => {
  it('keeps exactly one NPC plus three environmental highlights per first act', () => {
    for (const firstAct of firstActs) {
      expect(firstAct.highlights, firstAct.slug).toHaveLength(4)
      for (const highlight of firstAct.highlights) expect(highlight.replies).toHaveLength(2)
    }
  })

  it('does not reuse reply copy between NPCs', () => {
    const labels = firstActs.flatMap(({ highlights }) => highlights.flatMap(({ replies }) => replies.map(({ label }) => label)))
    expect(labels).toHaveLength(32)
    expect(new Set(labels).size).toBe(labels.length)
  })

  it('keeps each mini-game on its own server object and interaction code', () => {
    const pairs = firstActs.map(({ component, objectCode, gameCode }) => {
      const source = readFileSync(resolve(componentRoot, component), 'utf8')
      expect(source).toContain(`data-object-code='${objectCode}'`)
      expect(source).toContain(`data-game-code='${gameCode}'`)
      return `${objectCode}/${gameCode}`
    })
    expect(new Set(pairs).size).toBe(firstActs.length)
  })

  it('uses the scene speech bubble as the single polite live region', () => {
    for (const { component } of firstActs) {
      const source = readFileSync(resolve(componentRoot, component), 'utf8')
      expect(source.match(/role='status'/g) ?? [], component).toHaveLength(1)
      expect(source).toContain("aria-live='polite'")
      expect(source).toContain("aria-atomic='true'")
    }
  })

  it('ships the four accepted scenes as compact, decodable JPEG assets', () => {
    let totalBytes = 0
    for (const { asset } of firstActs) {
      const path = resolve(assetRoot, asset)
      const bytes = statSync(path).size
      const header = readFileSync(path).subarray(0, 3)
      totalBytes += bytes
      expect(bytes, `${asset} must fit its 64 KiB scene budget`).toBeLessThanOrEqual(64 * 1024)
      expect([...header]).toEqual([0xff, 0xd8, 0xff])
    }
    expect(totalBytes).toBeLessThanOrEqual(192 * 1024)
  })
})
