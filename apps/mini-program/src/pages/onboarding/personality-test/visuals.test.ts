import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'
import { getArchetypeSpritesheetLocalPath, getArchetypeSpritesheetCdnPath } from './visuals'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const PAGE_WIRING_EXPECTATIONS = [
  {
    filePath: path.join(currentDir, 'index.tsx'),
    expectedSnippet: 'PERSONALITY_TEST_XIAOYUE_EXPRESSION.introHero',
  },
  {
    filePath: path.resolve(currentDir, '../essential-data/index.tsx'),
    expectedSnippet: "XiaoyueChatBubble",
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

  // Regression guard: slot animation must load spritesheet from local bundle,
  // not from CDN, so the image is guaranteed to match the local manifest.
  it('loads spritesheet from local onboarding subpackage, not CDN', () => {
    const localPath = getArchetypeSpritesheetLocalPath()
    const cdnPath = getArchetypeSpritesheetCdnPath()

    // Local path must always be the on-device subpackage path
    expect(localPath).toMatch(/^\/pages\/onboarding\/assets\/archetypes\/archetype-spritesheet\.webp$/)
    // In dev/test without TARO_APP_CDN_BASE_URL, cdnAsset falls back to the raw path.
    // In production the CDN path starts with https://. Either way, local ≠ CDN.
    expect(cdnPath).not.toBe(localPath)
  })
})
