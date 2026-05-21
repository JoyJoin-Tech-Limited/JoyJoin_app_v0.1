import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const sourceRoot = path.resolve(currentDir, '../..')
const componentPath = path.join(currentDir, 'ArchetypeGlyph.tsx')

describe('ArchetypeGlyph asset references', () => {
  it('points to packaged archetype glyph files that exist', () => {
    const source = fs.readFileSync(componentPath, 'utf8')
    const assetRefs = Array.from(
      source.matchAll(/['"](?<asset>\/assets\/archetypes\/[^'"]+)['"]/g),
      (match) => match.groups?.asset,
    ).filter((asset): asset is string => Boolean(asset))

    expect(assetRefs.length).toBeGreaterThanOrEqual(12)

    for (const asset of assetRefs) {
      const localPath = path.join(sourceRoot, asset.replace(/^\//, ''))
      expect(fs.existsSync(localPath), `${asset} should exist in src/assets`).toBe(true)
    }
  })
})
