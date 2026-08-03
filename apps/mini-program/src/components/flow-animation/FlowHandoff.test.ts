import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

const profileReviewSource = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/profile-review/index.tsx'),
  'utf8',
)
const profileReviewScss = readFileSync(
  resolve(process.cwd(), 'src/pages/onboarding/profile-review/index.scss'),
  'utf8',
)
const poolRegistrationScss = readFileSync(
  resolve(process.cwd(), 'src/pages/pool-registration/index.scss'),
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

  it('bundles the shared flow visuals into every independently mounted page', () => {
    // Subpackage WXSS guard (AGENTS §15): the page SCSS must @use the shared
    // flow SCSS so the rules compile into the page WXSS itself — a
    // component-level import alone can be chunked into an unreachable file.
    expect(profileReviewScss).toContain("@use '../../../components/flow-animation/index.scss'")
    expect(poolRegistrationScss).toContain("@use '../../components/flow-animation/index.scss'")
  })
})
