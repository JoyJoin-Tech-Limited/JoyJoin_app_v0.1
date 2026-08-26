import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileReviewSource = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/profile-review/index.tsx'),
  'utf8',
)
const poolRegistrationScss = readFileSync(
  resolve(process.cwd(), 'src/pages/pool-registration/index.scss'),
  'utf8',
)
describe('onboarding completion single-ceremony rule (PR-5)', () => {
  it('routes every completion through the UnboxingCeremony — no intro branch', () => {
    // The 双仪式 either/or is gone: handleComplete must always mount the
    // ceremony and handleCeremonyComplete must navigate directly.
    expect(profileReviewSource).not.toContain('JoyJoinIntroFlow')
    expect(profileReviewSource).not.toContain('setIntroNextStep')
    expect(profileReviewSource).not.toContain('handleIntroComplete')
    expect(profileReviewSource).not.toContain('shouldShowFlow')
    expect(profileReviewSource).toContain('setShowCeremony(true)')
  })

  it('bundles the shared flow visuals into the Flow 2 host page', () => {
    // Subpackage WXSS guard (AGENTS §15): the pool-registration page SCSS must
    // @use the shared flow SCSS so the BlindBoxLifecycleFlow rules compile
    // into the page WXSS itself.
    expect(poolRegistrationScss).toContain("@use '../../components/flow-animation/index.scss'")
  })
})
