// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const hookSource = readFileSync(new URL('./useWeChatLogin.ts', import.meta.url), 'utf8')

describe('useWeChatLogin navigation handoff', () => {
  // Guards against regression: this hook used to compute a raw route and call
  // reLaunch directly, which breaks when nextStep resolves to a tabBar page.
  it('awaits the route-aware onboarding helper instead of raw reLaunch', () => {
    expect(hookSource).toContain(
      "import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'",
    )
    expect(hookSource).toContain(
      "await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })",
    )
    expect(hookSource).not.toContain('const route = nextStepToMiniProgramRoute(userState.nextStep)')
    expect(hookSource).not.toContain('Taro.reLaunch({ url: route })')
  })

  it('preserves auth bootstrap order before the navigation handoff', () => {
    const authenticateCall = 'await authenticateMiniProgramUser()'
    const getUserStateCall = 'const userState = await getUserState()'
    const seedSessionCall = 'seedMiniProgramAuthSession(userState, queryClient)'
    const navigateCall = "await navigateToMiniProgramNextStep(userState.nextStep, { mode: 'root' })"

    const authenticateIndex = hookSource.indexOf(authenticateCall)
    const getUserStateIndex = hookSource.indexOf(getUserStateCall)
    const seedSessionIndex = hookSource.indexOf(seedSessionCall)
    const navigateIndex = hookSource.indexOf(navigateCall)

    expect(authenticateIndex).toBeGreaterThanOrEqual(0)
    expect(getUserStateIndex).toBeGreaterThan(authenticateIndex)
    expect(seedSessionIndex).toBeGreaterThan(getUserStateIndex)
    expect(navigateIndex).toBeGreaterThan(seedSessionIndex)
  })
})