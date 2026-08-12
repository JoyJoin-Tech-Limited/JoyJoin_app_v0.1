import { readFileSync, statSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const sourceRoot = resolve(process.cwd(), 'src')
const appRoot = resolve(process.cwd())
const arrivalAssetNames = [
  'flash-atuan-park-clean-v2.jpg',
  'flash-atuan-character-cutout-v2.png',
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

    expect(dialoguePage).toContain("../assets/ui/flash-atuan-park-clean-v2.jpg")
    expect(dialoguePage).toContain("../assets/ui/flash-atuan-character-cutout-v2.png")
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
      } else {
        expect([...header.subarray(0, 8)]).toEqual([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
      }
    }
    expect(totalBytes, 'WeChat-safe arrival images must stay within the 64 KiB scene budget').toBeLessThanOrEqual(64 * 1024)
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

  it('keeps first-arrival assets covered by the production package contract', () => {
    const cleanScript = readFileSync(resolve(appRoot, 'scripts/clean-cdn-assets.mjs'), 'utf8')
    const verifyScript = readFileSync(resolve(appRoot, 'scripts/verify-flash-package.mjs'), 'utf8')
    const projectConfig = JSON.parse(
      readFileSync(resolve(appRoot, 'project.config.json'), 'utf8'),
    ) as { packOptions?: { include?: Array<{ type?: string; value?: string }> } }

    for (const fileName of arrivalAssetNames) {
      expect(verifyScript, `${fileName} must be required by the upload verifier`).toContain(fileName)
    }

    expect(cleanScript).not.toContain('flash-atuan-park-clean-v2.webp')
    expect(verifyScript).toContain('non-collapsing Flash story viewport height chain')
    expect(verifyScript).toContain('anchor the Flash story stage to the viewport shell')
    expect(projectConfig.packOptions?.include).toContainEqual({ type: 'regexp', value: 'pages/alang/assets/.*\\.jpg$' })
    expect(projectConfig.packOptions?.include).toContainEqual({ type: 'regexp', value: 'pages/alang/assets/.*\\.png$' })
  })

  it('keeps inspection targets invisible instead of rendering fallback tags', () => {
    const prelude = readFileSync(resolve(sourceRoot, 'components/alang/story-unit/AtuanArrivalPrelude.tsx'), 'utf8')
    expect(prelude).not.toContain('fallback-hotspot-label')
    expect(prelude).not.toContain('查看阿团</Text>')
    expect(prelude).not.toContain('查看纸袋</Text>')
  })
})
