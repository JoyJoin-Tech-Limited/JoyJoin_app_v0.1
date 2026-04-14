import { describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({
  default: {
    switchTab: vi.fn(),
    redirectTo: vi.fn(),
    reLaunch: vi.fn(),
  },
}))

import { MINI_PROGRAM_ROUTES } from './onboardingRoutes'
import { getMiniProgramRouteNavigationAction } from './onboardingNavigation'

describe('mini-program onboarding navigation decisions', () => {
  it('uses switchTab for tab routes even during onboarding redirects', () => {
    expect(getMiniProgramRouteNavigationAction(MINI_PROGRAM_ROUTES.discover)).toBe('switchTab')
    expect(getMiniProgramRouteNavigationAction(MINI_PROGRAM_ROUTES.profile, 'root')).toBe('switchTab')
  })

  // Guards against regression: server-driven onboarding pages must not try to
  // switchTab into non-tab onboarding screens when following nextStep.
  it('uses replace or root navigation for non-tab onboarding routes', () => {
    expect(getMiniProgramRouteNavigationAction(MINI_PROGRAM_ROUTES.essentialData)).toBe('redirectTo')
    expect(getMiniProgramRouteNavigationAction(MINI_PROGRAM_ROUTES.extendedData, 'root')).toBe('reLaunch')
  })
})