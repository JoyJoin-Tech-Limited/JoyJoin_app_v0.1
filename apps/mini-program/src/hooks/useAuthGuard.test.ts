import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

import { describe, expect, it } from 'vitest'

const hookPath = resolve(dirname(fileURLToPath(import.meta.url)), 'useAuthGuard.ts')

describe('useAuthGuard', () => {
  it('skips onboarding nextStep redirects while suspendOnboardingRedirect is true', () => {
    const source = readFileSync(hookPath, 'utf8')

    expect(source).toContain('if (isOnboardingRoute && options?.suspendOnboardingRedirect)')
    // Guard must run before the onboarding nextStep navigation branch (imports also mention navigateToMiniProgramNextStep).
    expect(source).toMatch(
      /if \(isOnboardingRoute && options\?\.suspendOnboardingRedirect\)\s*\{\s*return\s*\}[\s\S]*?navigateToMiniProgramNextStep/,
    )
  })
})
