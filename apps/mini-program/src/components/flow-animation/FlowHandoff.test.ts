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
describe('onboarding completion inline-ceremony rule (2026-10-30)', () => {
  it('confirms in place and routes directly — no separate ceremony step or duplicate summary', () => {
    expect(profileReviewSource).not.toContain('JoyJoinIntroFlow')
    expect(profileReviewSource).not.toContain('UnboxingCeremony')
    expect(profileReviewSource).not.toContain('ProfileReviewInviteCard')
    expect(profileReviewSource).not.toContain('profile-review__footer-reserve')
    expect(profileReviewSource).toContain('useProfileReviewCompletion')
    expect(profileReviewSource).toContain('profile-review__completion')
  })

  it('bundles the shared flow visuals into the Flow 2 host page', () => {
    // Subpackage WXSS guard (AGENTS §15): the pool-registration page SCSS must
    // @use the shared flow SCSS so the BlindBoxLifecycleFlow rules compile
    // into the page WXSS itself.
    expect(poolRegistrationScss).toContain("@use '../../components/flow-animation/index.scss'")
  })
})
