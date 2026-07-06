import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  RATING_FACES_ORDERED,
  getLocalIconAssetPath,
} from '@joyjoin/shared/iconSystem'

// From apps/mini-program/src/components/ui/__tests__ go up to the mini-program root,
// then into src/assets.
const MINI_PROGRAM_ROOT = resolve(__dirname, '../../../..')
const SRC_ASSETS_ROOT = resolve(MINI_PROGRAM_ROOT, 'src')
const MANIFEST_PATH = resolve(MINI_PROGRAM_ROOT, 'scripts', 'cdn-asset-manifest.json')

/**
 * Regression test: rating face assets must exist for every registered mapping
 * at 1x. The icon registry generates `/assets/icons/rating-faces/...webp`
 * paths; this test confirms the source files are on disk so the CDN upload
 * pipeline can serve them.
 */
describe('RatingFace asset registry', () => {
  it('has source WebP assets for every rating face at 1x (bare filename)', () => {
    const missing: string[] = []

    for (const mapping of RATING_FACES_ORDERED) {
      const assetPath = getLocalIconAssetPath(
        mapping.assetKey,
        mapping.tier,
        1,
      )
      const fullPath = resolve(SRC_ASSETS_ROOT, '.' + assetPath)
      if (!existsSync(fullPath)) {
        missing.push(assetPath)
      }
    }

    expect(missing).toEqual([])
  })

  it('is declared in the CDN asset manifest', () => {
    const manifest = JSON.parse(readFileSync(MANIFEST_PATH, 'utf-8'))
    const assetPaths = new Set(manifest.assets.map((a: { cdnPath: string }) => a.cdnPath))

    for (const mapping of RATING_FACES_ORDERED) {
      const assetPath = getLocalIconAssetPath(mapping.assetKey, mapping.tier, 1)
      expect(assetPaths.has(assetPath.slice(1))).toBe(true)
    }
  })
})
