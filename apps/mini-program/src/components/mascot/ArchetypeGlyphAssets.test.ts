import { describe, expect, it } from 'vitest'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import fs from 'node:fs'

const currentDir = path.dirname(fileURLToPath(import.meta.url))
const componentPath = path.join(currentDir, 'ArchetypeGlyph.tsx')

describe('ArchetypeGlyph asset references', () => {
  it('points to 12 archetype assets via cdnAsset', () => {
    const source = fs.readFileSync(componentPath, 'utf8')
    const assetRefs = Array.from(
      source.matchAll(/cdnAsset\(['"](?<asset>\/assets\/personality\/archetypes\/[^'"]+)['"]\)/g),
      (match) => match.groups?.asset,
    ).filter((asset): asset is string => Boolean(asset))

    expect(assetRefs.length).toBeGreaterThanOrEqual(12)
  })
})
