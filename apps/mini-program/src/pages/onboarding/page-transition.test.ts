import { readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { describe, expect, it } from 'vitest'

const currentDir = path.dirname(fileURLToPath(import.meta.url))

const STYLE_FILES = [
  path.resolve(currentDir, 'personality-test/index.scss'),
  path.resolve(currentDir, 'essential-data/index.scss'),
  path.resolve(currentDir, 'extended-data/index.scss'),
  path.resolve(currentDir, 'profile-review/index.scss'),
] as const

const MIXINS_PATH = path.resolve(currentDir, '../../styles/_mixins.scss')

const PAGE_FILES = [
  {
    filePath: path.resolve(currentDir, 'personality-test/index.tsx'),
    exitClassToken: 'personality-test--exiting',
    guardPauseSnippet: 'if (auth.isLoading || isSubmitting || isPageExiting) {',
  },
  {
    filePath: path.resolve(currentDir, 'essential-data/index.tsx'),
    exitClassToken: 'essential-data--exiting',
    guardPauseSnippet: 'suspendOnboardingRedirect: isSubmitting || isPageExiting',
  },
  {
    filePath: path.resolve(currentDir, 'extended-data/index.tsx'),
    exitClassToken: 'extended-data--exiting',
    guardPauseSnippet: 'suspendOnboardingRedirect: isSubmitting || isPageExiting',
  },
  {
    filePath: path.resolve(currentDir, 'profile-review/index.tsx'),
    exitClassToken: 'profile-review--exiting',
    guardPauseSnippet: 'suspendOnboardingRedirect: isSubmitting || isPageExiting',
  },
] as const

describe('mini-program onboarding page transitions', () => {
  it('reuses the shared onboarding motion mixins across the key onboarding screens', () => {
    STYLE_FILES.forEach((filePath) => {
      const source = readFileSync(filePath, 'utf8')

      expect(source).toContain('@include onboarding-page-exit-transition')
      expect(source).toContain('@include onboarding-stage')
    })
  })

  it('wires an exit state before navigating away from onboarding steps', () => {
    PAGE_FILES.forEach(({ filePath, exitClassToken }) => {
      const source = readFileSync(filePath, 'utf8')

      expect(source).toContain(exitClassToken)
      expect(source).toContain('beforeNavigate: () => setIsPageExiting(true)')
    })
  })

  it('pauses guard-driven redirects while a transition-aware submission is in flight', () => {
    PAGE_FILES.forEach(({ filePath, guardPauseSnippet }) => {
      const source = readFileSync(filePath, 'utf8')

      expect(source).toContain(guardPauseSnippet)
    })
  })

  it('generates per-distance stage keyframes so motion matches onboarding-stage distance', () => {
    const source = readFileSync(MIXINS_PATH, 'utf8')

    expect(source).toContain('@keyframes joy-onboarding-stage-in-#{$stage-id}')
    expect(source).toContain("'18': 18rpx")
    expect(source).toContain("'20': 20rpx")
    expect(source).toContain("'24': 24rpx")
    expect(source).toContain('$onboarding-stage-shift-ids')
  })
})

