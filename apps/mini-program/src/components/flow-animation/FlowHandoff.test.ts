import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileReviewSource = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/profile-review/index.tsx'),
  'utf8',
)
describe('onboarding intro cross-page handoff', () => {
  it('keeps the intro handoff reachable from the completion ceremony', () => {
    const ceremonyComplete = profileReviewSource.indexOf('const handleCeremonyComplete')
    const introSetIndex = profileReviewSource.indexOf('setIntroNextStep(userState.nextStep)')
    const navigateIndex = profileReviewSource.indexOf('await navigateToMiniProgramNextStep(userState.nextStep')

    expect(ceremonyComplete).toBeGreaterThan(-1)
    expect(introSetIndex).toBeGreaterThan(ceremonyComplete)
    // The intro handoff must short-circuit BEFORE the ceremony's direct
    // navigation so the intro flow renders instead of the redirect.
    expect(navigateIndex).toBeGreaterThan(introSetIndex)
  })
})
