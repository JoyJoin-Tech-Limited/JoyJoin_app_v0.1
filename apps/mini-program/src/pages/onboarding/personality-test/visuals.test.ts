import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PAGE_WIRING_EXPECTATIONS = [
  {
    filePath: path.join(currentDir, 'index.tsx'),
    expectedSnippet: 'PERSONALITY_TEST_XIAOYUE_EXPRESSION.introHero',
  },
  {
    filePath: path.resolve(currentDir, '../essential-data/index.tsx'),
    expectedSnippet: "getXiaoyueAsset(intent.length > 0 ? 'pointing' : 'normal')",
  },
  {
    filePath: path.resolve(currentDir, '../extended-data/index.tsx'),
    expectedSnippet: "getXiaoyueAsset('pointing')",
  },
] as const

describe('mini-program onboarding Xiaoyue page wiring', () => {
  it('wires onboarding pages directly to the updated Xiaoyue assets', () => {
    PAGE_WIRING_EXPECTATIONS.forEach(({ filePath, expectedSnippet }) => {
      const source = readFileSync(filePath, 'utf8')

      expect(source).toContain(expectedSnippet)
      expect(source).not.toContain('getOnboardingXiaoyueAsset')
    })
  })

  it('removes the onboarding-only Xiaoyue asset indirection', () => {
    const visualsSource = readFileSync(path.join(currentDir, 'visuals.ts'), 'utf8')

    expect(visualsSource).not.toContain('OnboardingXiaoyueMood')
    expect(visualsSource).not.toContain('getOnboardingXiaoyueAsset')
  })
})
