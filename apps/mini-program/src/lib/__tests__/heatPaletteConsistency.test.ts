import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'

const SRC_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')

const CANONICAL_HEAT = {
  l1: '#A78BFA',
  l2: '#8B5CF6',
  l3: '#F97316',
} as const

function readSrc(relativePath: string) {
  return readFileSync(path.join(SRC_ROOT, relativePath), 'utf8')
}

function normalize(hex: string) {
  return hex.trim().toUpperCase()
}

describe('heat palette single-source-of-truth', () => {
  it('extended-data HEAT_COLORS matches the canonical palette', () => {
    const tsx = readSrc('pages/onboarding/extended-data/index.tsx')
    const block = tsx.match(/const HEAT_COLORS = \{([\s\S]*?)\} as const/)
    expect(block, 'HEAT_COLORS block not found').toBeTruthy()
    for (const [level, hex] of Object.entries(CANONICAL_HEAT)) {
      const key = level.replace('l', '')
      expect(block![1]).toContain(`${key}: '${normalize(hex)}'`)
    }
  })

  it('extended-data --jj-heat-l1..l3 CSS vars match the canonical palette', () => {
    const scss = readSrc('pages/onboarding/extended-data/index.scss')
    for (const [level, hex] of Object.entries(CANONICAL_HEAT)) {
      expect(scss).toContain(`--jj-heat-${level}: ${normalize(hex)}`)
    }
  })

  it('Chip.scss $chip-heat-l* tokens match the canonical palette', () => {
    const scss = readSrc('components/ui/Chip.scss')
    for (const [level, hex] of Object.entries(CANONICAL_HEAT)) {
      expect(scss.toUpperCase()).toContain(`$CHIP-HEAT-${level.toUpperCase()}: ${normalize(hex)}`)
    }
  })

  it('InterestChipCloud.scss $heat-l* tokens match the canonical palette', () => {
    const scss = readSrc('components/profile/InterestChipCloud.scss')
    for (const [level, hex] of Object.entries(CANONICAL_HEAT)) {
      const pattern = new RegExp(`\\$heat-${level}:\\s*${normalize(hex)}`, 'i')
      expect(scss).toMatch(pattern)
    }
  })
})
