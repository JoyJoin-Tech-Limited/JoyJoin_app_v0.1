import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
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
    asset: 'flash-alang-first-act-riverside-v3.jpg',
    objectCode: 'seat-plan',
    gameCode: 'spacing',
    highlights: ALANG_FIRST_ACT_HIGHLIGHTS,
  },
  {
    slug: 'lizi',
    component: 'LiziFirstActExperience.tsx',
    asset: 'flash-lizi-first-act-color-studio-v2.jpg',
    objectCode: 'dry-markers',
    gameCode: 'pairing',
    highlights: LIZI_FIRST_ACT_HIGHLIGHTS,
  },
  {
    slug: 'momo',
    component: 'MomoFirstActExperience.tsx',
    asset: 'flash-momo-first-act-rain-route-v3.jpg',
    objectCode: 'route-book',
    gameCode: 'path',
    highlights: MOMO_FIRST_ACT_HIGHLIGHTS,
  },
  {
    slug: 'shiqi',
    component: 'ShiqiFirstActExperience.tsx',
    asset: 'flash-shiqi-first-act-record-room-v3.jpg',
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
    const sharedGame = readFileSync(resolve(sourceRoot, 'pages/alang/atuan-cards/index.tsx'), 'utf8')
    const pairs = firstActs.map(({ slug, component, objectCode, gameCode }) => {
      const source = readFileSync(resolve(componentRoot, component), 'utf8')
      expect(source).toContain(`objectCode: '${objectCode}'`)
      expect(sharedGame).toContain(`${slug}: {`)
      return `${objectCode}/${gameCode}`
    })
    expect(new Set(pairs).size).toBe(firstActs.length)
  })

  it('uses the scene speech bubble as the single polite live region', () => {
    const templateSource = readFileSync(resolve(componentRoot, 'FirstActAtuanTemplateExperience.tsx'), 'utf8')
    expect(templateSource).toContain("aria-live='polite'")
    expect(templateSource).toContain('<FirstActDialogueChrome')
    for (const { slug, component } of firstActs) {
      const source = readFileSync(resolve(componentRoot, component), 'utf8')
      expect(source).toContain('<FirstActAtuanTemplateExperience')
    }
  })

  it('routes all four corrected NPCs through the Atuan state template', () => {
    const templateSource = readFileSync(resolve(componentRoot, 'FirstActAtuanTemplateExperience.tsx'), 'utf8')
    expect(templateSource).toContain("const primaryHighlights = config.highlights.slice(0, 3)")
    expect(templateSource).toContain('const revealedHighlight = config.highlights[3]')
    expect(templateSource).toContain('<FirstActHighlightOverlay')
    expect(templateSource).toContain('<FirstActDialogueChrome')
    expect(templateSource).toContain("'object' | 'followup' | 'conversation'")
    expect(templateSource).toContain('config.objectExploration.details')
    expect(templateSource).toContain('config.objectExploration.followUps')
    expect(templateSource).toContain('testIdPrefix={`${config.npcSlug}-object`}')
    for (const { slug, component } of firstActs) {
      const source = readFileSync(resolve(componentRoot, component), 'utf8')
      expect(source, component).toContain('FirstActAtuanTemplateExperience')
      expect(source, component).toContain('<FirstActAtuanTemplateExperience')
      expect(source, component).toContain('objectExploration: {')
      expect(source, component).toContain('followUps: [')
    }
  })

  it('gives every added internal object its own visual grammar', () => {
    const objectStyles = readFileSync(resolve(componentRoot, 'FirstActAtuanTemplateExperience.scss'), 'utf8')
    expect(objectStyles).toContain('&--alang-one')
    expect(objectStyles).toContain('&--lizi-one')
    expect(objectStyles).toContain('&--momo-one')
    expect(objectStyles).toContain('&--shiqi-one')
    expect(objectStyles).toContain('border-left: 4rpx dashed')
    expect(objectStyles).toContain('transform: rotate(68deg)')
    expect(objectStyles).toContain('background: rgba($color-surface, 0.54)')
  })

  it('locks the shared non-game chrome to Atuan conversation dimensions', () => {
    const chromeStyles = readFileSync(resolve(componentRoot, 'FirstActDialogueChrome.scss'), 'utf8')
    expect(chromeStyles).toMatch(/&__speech\s*\{[\s\S]*?top:\s*48rpx;[\s\S]*?right:\s*200rpx;[\s\S]*?left:\s*24rpx;[\s\S]*?padding:\s*32rpx;/)
    expect(chromeStyles).toMatch(/&__panel\s*\{[\s\S]*?max-height:\s*680rpx;[\s\S]*?padding:\s*32rpx;/)
    expect(chromeStyles).toMatch(/&__choice\s*\{[\s\S]*?min-height:\s*112rpx;/)
  })

  it('ships the four accepted scenes as sharp, WeChat-safe image assets', async () => {
    const assetRegistry = readFileSync(resolve(sourceRoot, 'lib/alang/flashNpcAssets.ts'), 'utf8')
    let totalBytes = 0
    for (const { asset } of firstActs) {
      const path = resolve(assetRoot, asset)
      const bytes = statSync(path).size
      const header = readFileSync(path).subarray(0, 12)
      const metadata = await sharp(path).metadata()
      totalBytes += bytes
      expect(metadata.width, `${asset} must stay close to Atuan's 941px scene baseline`).toBeGreaterThanOrEqual(850)
      expect(bytes, `${asset} must fit its 220 KiB scene budget`).toBeLessThanOrEqual(220 * 1024)
      if (asset.endsWith('.webp')) {
        expect(bytes, `${asset} must retain enough detail to avoid the previous over-compressed blur`).toBeGreaterThanOrEqual(120 * 1024)
        expect(header.toString('ascii', 0, 4)).toBe('RIFF')
        expect(header.toString('ascii', 8, 12)).toBe('WEBP')
        expect(metadata.format).toBe('webp')
      } else {
        expect([...header.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
        expect(metadata.format).toBe('jpeg')
      }
      expect(assetRegistry, `${asset} must be the active runtime scene`).toContain(asset)
    }
    const liziMetadata = await sharp(resolve(assetRoot, 'flash-lizi-first-act-color-studio-v2.jpg')).metadata()
    expect(liziMetadata).toEqual(expect.objectContaining({ width: 941, height: 1672 }))
    expect(totalBytes).toBeLessThanOrEqual(600 * 1024)
  })
})
