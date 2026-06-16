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
const CONFIG_PATH = resolve(MINI_PROGRAM_ROOT, 'config', 'index.ts')

/**
 * Regression test: rating face assets must exist for every registered mapping
 * and density. The icon registry generates `/assets/icons/rating-faces/...webp`
 * paths; this test confirms the bundled files are on disk so the component
 * never falls back to emoji due to a missing asset.
 */
describe('RatingFace asset registry', () => {
  it('has bundled WebP assets for every rating face at 1x/2x/3x', () => {
    const missing: string[] = []

    for (const mapping of RATING_FACES_ORDERED) {
      for (const density of [1, 2, 3] as const) {
        const assetPath = getLocalIconAssetPath(
          mapping.assetKey,
          mapping.tier,
          density,
        )
        const fullPath = resolve(SRC_ASSETS_ROOT, '.' + assetPath)
        if (!existsSync(fullPath)) {
          missing.push(assetPath)
        }
      }
    }

    expect(missing).toEqual([])
  })

  it('is declared as a bundled copy pattern in config/index.ts', () => {
    const config = readFileSync(CONFIG_PATH, 'utf-8')
    const hasCopyPattern =
      config.includes("from: 'src/assets/icons/rating-faces'") &&
      config.includes("to: 'dist/assets/icons/rating-faces'")
    expect(hasCopyPattern).toBe(true)
  })
})
