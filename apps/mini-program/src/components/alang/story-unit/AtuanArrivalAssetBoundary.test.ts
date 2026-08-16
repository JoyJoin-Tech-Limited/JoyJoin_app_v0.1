import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')
const appRoot = resolve(process.cwd())
const repoRoot = resolve(appRoot, '../..')
const arrivalAssetNames = [
  'flash-atuan-park-clean-v3.jpg',
  'flash-atuan-character-lowpoly-v3.png',
  'flash-atuan-bag-cutout-v2.png',
]

describe('Atuan first-arrival asset ownership', () => {
  it('keeps Alang subpackage assets out of shared main-package components', () => {
    const prelude = readFileSync(resolve(sourceRoot, 'components/alang/story-unit/AtuanArrivalPrelude.tsx'), 'utf8')
    const storyUnit = readFileSync(resolve(sourceRoot, 'components/alang/story-unit/FlashStoryUnit.tsx'), 'utf8')

    expect(prelude).not.toContain('pages/alang/assets')
    expect(storyUnit).not.toContain('pages/alang/assets')
  })

  it('loads the scene and both highlight layers from the Alang dialogue subpackage', () => {
    const dialoguePage = readFileSync(resolve(sourceRoot, 'pages/alang/dialogue/index.tsx'), 'utf8')

    expect(dialoguePage).toContain("../assets/ui/flash-atuan-park-clean-v3.jpg")
    expect(dialoguePage).toContain("../assets/ui/flash-atuan-character-lowpoly-v3.png")
    expect(dialoguePage).toContain("../assets/ui/flash-atuan-bag-cutout-v2.png")
    expect(dialoguePage).toContain('atuanArrivalAssets={{')
  })

  it('keeps every first-arrival asset non-empty and encoded in WeChat-safe formats', () => {
    const assetRoot = resolve(sourceRoot, 'pages/alang/assets/ui')
    let totalBytes = 0
    for (const fileName of arrivalAssetNames) {
      const assetPath = resolve(assetRoot, fileName)
      const assetBytes = statSync(assetPath).size
      totalBytes += assetBytes
      expect(assetBytes, `${fileName} must not be empty`).toBeGreaterThan(12)
      const header = readFileSync(assetPath).subarray(0, 12)
      if (fileName.endsWith('.jpg')) {
        expect([...header.subarray(0, 3)]).toEqual([0xff, 0xd8, 0xff])
      } else if (fileName.endsWith('.png')) {
        expect([...header.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      } else {
        expect(header.subarray(0, 4).toString('ascii')).toBe('RIFF')
        expect(header.subarray(8, 12).toString('ascii')).toBe('WEBP')
      }
    }
    expect(totalBytes, 'High-resolution arrival layers must stay within a 360 KiB subpackage budget').toBeLessThanOrEqual(360 * 1024)
  })

  it('gives the all-absolute Atuan arrival stage a viewport-height fallback chain', () => {
    const flashStyles = readFileSync(resolve(sourceRoot, 'pages/alang/flash.scss'), 'utf8')
    const storyShell = flashStyles.match(/\.flash-dialogue--story\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''
    const storyStage = flashStyles.match(/\.flash-dialogue__story-stage\s*\{([\s\S]*?)\n\}/)?.[1] ?? ''

    expect(storyShell).toContain('min-height: 100vh;')
    expect(storyShell).toContain('height: 100dvh;')
    expect(storyShell).toContain('position: relative;')
    expect(storyShell).not.toMatch(/(?:height|min-height):\s*0;/)
    expect(storyStage).toMatch(/^\s*position:\s*absolute;\s*inset:\s*0;/)
  })

  it('keeps Atuan human-scaled and the conversation copy readable on a phone', () => {
    const flashStyles = readFileSync(resolve(sourceRoot, 'pages/alang/flash.scss'), 'utf8')
    const conversationScene = flashStyles.slice(
      flashStyles.indexOf('.atuan-conversation-scene {'),
      flashStyles.indexOf('.flash-dialogue__story-stage--atuan-first', flashStyles.indexOf('.atuan-conversation-scene {')),
    )
    const conversationPanel = flashStyles.slice(
      flashStyles.lastIndexOf('.flash-dialogue__story-stage--atuan-first'),
      flashStyles.lastIndexOf('.atuan-first-dialogue {'),
    )
    const conversationCopy = flashStyles.slice(flashStyles.lastIndexOf('.atuan-first-dialogue {'))

    expect(flashStyles).toMatch(/&__cutout--atuan\s*\{[^}]*translateX\(112rpx\) scale\(0\.82\)/s)
    expect(conversationScene).toMatch(/&__character\s*\{[^}]*translateX\(112rpx\) scale\(0\.82\)/s)
    expect(conversationScene).toMatch(/&__speech\s*\{[^}]*right:\s*200rpx;[^}]*padding:\s*32rpx;/s)
    expect(conversationScene).toMatch(/&__speech-copy\s*\{[^}]*font-size:\s*\$font-size-md;/s)
    expect(conversationPanel).toContain('max-height: 680rpx;')
    expect(conversationPanel).toMatch(/\.flash-dialogue__choice\s*\{[^}]*min-height:\s*112rpx;/s)
    expect(conversationPanel).toMatch(/\.flash-dialogue__choice-text\s*\{[^}]*font-size:\s*\$font-size-md;/s)
    expect(conversationCopy).toMatch(/&__narration\s*\{[^}]*font-size:\s*\$font-size-base;/s)
    expect(conversationCopy).toMatch(/&__prompt\s*\{[^}]*font-size:\s*\$font-size-base;/s)
  })

  it('uses dark copy tokens for the Atuan result panel on its light surface', () => {
    const flashStyles = readFileSync(resolve(sourceRoot, 'pages/alang/flash.scss'), 'utf8')

    expect(flashStyles).toMatch(/\.flash-dialogue__story-stage--atuan-first \.flash-dialogue__story-panel--result \.flash-dialogue__story-panel-season\s*\{\s*color:\s*\$color-primary-dark;/)
    expect(flashStyles).toMatch(/\.flash-dialogue__story-stage--atuan-first \.flash-dialogue__story-panel--result \.flash-dialogue__story-panel-title\s*\{\s*color:\s*\$color-text-primary-warm;/)
    expect(flashStyles).toMatch(/\.flash-dialogue__story-stage--atuan-first \.flash-dialogue__story-panel--result \.flash-dialogue__story-panel-closing,[\s\S]*?\.flash-dialogue__story-panel-progress\s*\{\s*color:\s*\$color-text-secondary-on-light;/)
  })

  it('keeps every settled-story exit visible without a native result scroller', () => {
    const flashStyles = readFileSync(resolve(sourceRoot, 'pages/alang/flash.scss'), 'utf8')

    expect(flashStyles).toMatch(/\.flash-dialogue__story-panel--result\s*\{[^}]*bottom:\s*calc\(112rpx \+ env\(safe-area-inset-bottom\)\);[^}]*height:\s*auto;[^}]*overflow:\s*hidden;/s)
    expect(flashStyles).not.toMatch(/\.flash-dialogue__story-panel--result \.flash-dialogue__story-panel-scroll\s*\{/)
    expect(flashStyles).toMatch(/\.flash-dialogue__story-result-exit\s*\{[^}]*min-height:\s*88rpx;[^}]*flex:\s*none;/s)
    expect(flashStyles).not.toMatch(/\.flash-dialogue__story-result-exit\s*\{[^}]*(?:position:\s*absolute|bottom:)/s)
    expect(flashStyles).toMatch(/\.flash-dialogue__story-result-exit \.flash-button\s*\{[^}]*width:\s*auto;/s)
  })

  it('keeps first-arrival assets covered by the production package contract', () => {
    const cleanScript = readFileSync(resolve(appRoot, 'scripts/clean-cdn-assets.mjs'), 'utf8')
    const verifyScript = readFileSync(resolve(appRoot, 'scripts/verify-flash-package.mjs'), 'utf8')
    const dialoguePage = readFileSync(resolve(sourceRoot, 'pages/alang/dialogue/index.tsx'), 'utf8')
    const buildConfig = readFileSync(resolve(appRoot, 'config/index.ts'), 'utf8')
    const buildWorkflow = readFileSync(resolve(repoRoot, '.github/workflows/taro-weapp-build.yml'), 'utf8')
    const eventPage = readFileSync(resolve(sourceRoot, 'pages/alang/event/index.tsx'), 'utf8')
    const projectConfig = JSON.parse(
      readFileSync(resolve(appRoot, 'project.config.json'), 'utf8'),
    ) as { packOptions?: { include?: Array<{ type?: string; value?: string }> } }

    for (const fileName of arrivalAssetNames) {
      expect(verifyScript, `${fileName} must be required by the upload verifier`).toContain(fileName)
    }

    expect(cleanScript).toContain('const sourceOnlyAlangUiAssets = new Set([')
    for (const fileName of [
      'flash-atuan-first-arrival-v1.jpg',
      'flash-atuan-character-lowpoly-v3.webp',
      'flash-atuan-park-clean-v2.jpg',
      'flash-atuan-character-cutout-v2.png',
      'flash-alang-dialogue-paper-v1.jpg',
      'flash-lizi-dialogue-paper-v1.jpg',
      'flash-momo-dialogue-paper-v1.jpg',
      'flash-shiqi-dialogue-paper-v1.jpg',
      'flash-atuan-dialogue-paper-v1.jpg',
      'flash-alang-first-act-riverside-v2.jpg',
      'flash-momo-first-act-rain-route-v2.jpg',
      'flash-shiqi-first-act-record-room-v2.jpg',
    ]) {
      expect(cleanScript, `${fileName} must stay out of the upload package`).toContain(`'${fileName}'`)
    }
    expect(cleanScript).toContain('sourceOnlyAlangUiAssets.has(name)')
    expect(cleanScript).not.toContain('runtimeAlangUiWebps')
    expect(cleanScript).not.toContain('bundledAlangUiWebpAssets')
    for (const fileName of [
      'flash-atuan-second-act-pavilion-v1.jpg',
      'flash-atuan-third-act-table-v1.jpg',
    ]) {
      const assetBytes = readFileSync(resolve(sourceRoot, 'pages/alang/assets/ui', fileName))
      expect([...assetBytes.subarray(0, 3)], `${fileName} must be a real JPEG`).toEqual([0xff, 0xd8, 0xff])
      expect(assetBytes.byteLength, `${fileName} must stay within the 150 KiB scene budget`).toBeLessThanOrEqual(150 * 1024)
      expect(dialoguePage, `${fileName} must be the runtime scene import`).toContain(`../assets/ui/${fileName}`)
      expect(verifyScript, `${fileName} must be required by the upload verifier`).toContain(fileName)
    }
    expect(cleanScript).toContain(
      "(name) => name.endsWith('.webp') || sourceOnlyAlangUiAssets.has(name)",
    )
    expect(dialoguePage).not.toContain('flash-atuan-second-act-pavilion-v1.webp')
    expect(dialoguePage).not.toContain('flash-atuan-third-act-table-v1.webp')
    for (const fileName of [
      'flash-alang-first-act-riverside-v3.jpg',
      'flash-lizi-first-act-color-studio-v2.jpg',
      'flash-momo-first-act-rain-route-v3.jpg',
      'flash-shiqi-first-act-record-room-v3.jpg',
    ]) {
      expect(verifyScript, `${fileName} must be required by the upload verifier`).toContain(fileName)
      expect(buildWorkflow, `${fileName} must be required in the compiled package`).toContain(fileName)
    }
    expect(cleanScript).not.toContain('flash-atuan-park-clean-v2.webp')
    expect(verifyScript).toContain('non-collapsing Flash story viewport height chain')
    expect(verifyScript).toContain('anchor the Flash story stage to the viewport shell')
    expect(projectConfig.packOptions?.include).toContainEqual({ type: 'regexp', value: 'pages/alang/assets/.*\\.jpg$' })
    expect(projectConfig.packOptions?.include).toContainEqual({ type: 'regexp', value: 'pages/alang/assets/.*\\.png$' })
    expect(projectConfig.packOptions?.include).toContainEqual({ type: 'regexp', value: 'pages/alang/assets/.*\\.webp$' })
    expect(eventPage).toContain("import standardPaperWorld from '../assets/onboarding/parallel-standard-paper-world-v1.jpg'")
    for (const productionContract of [buildConfig, verifyScript, buildWorkflow]) {
      expect(productionContract).not.toContain('street-blind-box-onboarding-fullscreen-v7')
    }
  })

  it('keeps inspection targets invisible instead of rendering fallback tags', () => {
    const prelude = readFileSync(resolve(sourceRoot, 'components/alang/story-unit/AtuanArrivalPrelude.tsx'), 'utf8')
    expect(prelude).not.toContain('fallback-hotspot-label')
    expect(prelude).not.toContain('查看阿团</Text>')
    expect(prelude).not.toContain('查看纸袋</Text>')
  })
})
