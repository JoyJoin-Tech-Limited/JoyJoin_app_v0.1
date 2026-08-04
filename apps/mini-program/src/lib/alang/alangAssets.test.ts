import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import { ALANG_ASSET_MANIFEST } from './alangAssets'

describe('Alang candidate asset manifest', () => {
  it('keeps every generated scene candidate explicitly awaiting approval', () => {
    for (const asset of Object.values(ALANG_ASSET_MANIFEST)) {
      expect(asset.approvalStatus).toBe('awaiting-approved-art')
      expect(asset.fallbackPath).toMatch(
        /^\/pages\/alang\/assets\/candidates\/.+-candidate\.webp$/,
      )
    }
  })

  it('ships every candidate inside the Alang subpackage', () => {
    for (const asset of Object.values(ALANG_ASSET_MANIFEST)) {
      const sourcePath = resolve(process.cwd(), 'src', asset.fallbackPath.slice(1))
      expect(existsSync(sourcePath), sourcePath).toBe(true)
    }
  })
})
