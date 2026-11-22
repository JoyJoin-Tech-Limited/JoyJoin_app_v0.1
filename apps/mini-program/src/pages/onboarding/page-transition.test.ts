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
    guardPauseSnippet: "if (auth.isLoading || isSubmitting || isPageExiting || phase === 'completing') {",
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
    transitionSnippet: 'useProfileReviewCompletion',
  },
] as const

describe('mini-program onboarding page transitions', () => {
  it('reuses the shared onboarding motion mixins across the key onboarding screens', () => {
    STYLE_FILES.forEach((filePath) => {
      const source = readFileSync(filePath, 'utf8')

      expect(source).toContain('@include onboarding-page-exit-transition')
      expect(source).toContain('@include onboarding-page-enter-transition')
      expect(source).toContain('@include onboarding-stage')
    })
  })

  it('wires an exit state before navigating away from onboarding steps', () => {
    PAGE_FILES.forEach(({ filePath, exitClassToken, ...page }) => {
      const source = readFileSync(filePath, 'utf8')
      const transitionSnippet = 'transitionSnippet' in page
        ? page.transitionSnippet
        : 'beforeNavigate: () => setIsPageExiting(true)'

      expect(source).toContain(exitClassToken)
      expect(source).toContain(transitionSnippet)
    })
  })

  it('pauses guard-driven redirects while a transition-aware submission is in flight', () => {
    PAGE_FILES.forEach(({ filePath, guardPauseSnippet }) => {
      const source = readFileSync(filePath, 'utf8')

      expect(source).toContain(guardPauseSnippet)
    })
  })

  it('locks profile-review to the viewport so the detail and CTA cannot be pushed out', () => {
    const style = readFileSync(path.resolve(currentDir, 'profile-review/index.scss'), 'utf8')
    const view = readFileSync(path.resolve(currentDir, 'profile-review/index.tsx'), 'utf8')

    // P0 regression lock (2026-11-19): a min-height-only flex root sizes to
    // content, so the ScrollView grew instead of scrolling and the CTA moved
    // below the viewport. The root must own a fixed 100dvh shell.
    expect(style).toMatch(/\.profile-review \{[\s\S]*?height:\s*100dvh;[\s\S]*?overflow:\s*hidden;/)
    expect(style).not.toMatch(/(?<!min-)height:\s*100vh/)
    expect(style).toContain('&__scroll {\n    flex: 1;\n    min-height: 0;\n  }')

    // The action bar must be a sibling after the ScrollView, never inside it.
    expect(view.indexOf('</ScrollView>')).toBeLessThan(view.indexOf('profile-review__cta'))
    // The old inline accordion and the flat summary strip are gone; the card
    // face is now chapter-based (小档案 / 想找 / 兴趣热量), with a dog-ear
    // entry into the card-back archive sheet.
    expect(view).not.toContain('isSummaryExpanded')
    expect(view).toContain('profile-review__chapter-title')
    expect(view).toContain('profile-review__heat-list')
    expect(view).toContain('profile-review__archive-entry')
    expect(view).toContain('ProfileArchiveSheet')
    expect(style).toContain('profile-review__archive-entry')
  })

  it('keeps personality completion navigation single-shot', () => {
    const source = readFileSync(
      path.resolve(currentDir, 'personality-test/index.tsx'),
      'utf8',
    )

    expect(source).toContain('const completionNavigationRef = useRef(false)')
    expect(source).toContain('if (completionNavigationRef.current) return')
    expect(source).not.toContain('await invalidateAuth()')
  })

  it('generates per-distance stage keyframes so motion matches onboarding-stage distance', () => {
    const source = readFileSync(MIXINS_PATH, 'utf8')

    expect(source).toContain('@keyframes joy-onboarding-stage-in-#{$stage-id}')
    expect(source).toContain("'16': 16rpx")
    expect(source).toContain("'24': 24rpx")
    expect(source).toContain("'32': 32rpx")
    expect(source).toContain('$onboarding-stage-shift-ids')
  })

  it('generates a shared entrance keyframe for onboarding pages', () => {
    const source = readFileSync(MIXINS_PATH, 'utf8')

    expect(source).toContain('@keyframes joy-onboarding-enter')
    expect(source).toContain('@mixin onboarding-page-enter-transition')
  })
})
