import { afterEach, describe, expect, it, vi } from 'vitest'

vi.mock('@tarojs/taro', () => ({
  default: {
    switchTab: vi.fn(),
    redirectTo: vi.fn(),
    reLaunch: vi.fn(),
  },
}))

import { MINI_PROGRAM_ROUTES } from './onboardingRoutes'
import {
  getMiniProgramRouteNavigationAction,
  navigateToMiniProgramRoute,
} from './onboardingNavigation'

afterEach(() => {
  vi.useRealTimers()
  vi.clearAllMocks()
})

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

  it('waits for the requested transition delay before navigating', async () => {
    vi.useFakeTimers()
    const redirectTo = vi.fn()

    const navigationPromise = navigateToMiniProgramRoute(MINI_PROGRAM_ROUTES.essentialData, {
      taro: {
        switchTab: vi.fn(),
        redirectTo,
        reLaunch: vi.fn(),
      },
      transition: {
        delayMs: 180,
      },
    })

    expect(redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(179)
    expect(redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await navigationPromise

    expect(redirectTo).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.essentialData })
  })

  it('runs a transition callback before redirecting to the next route', async () => {
    vi.useFakeTimers()
    const beforeNavigate = vi.fn()
    const redirectTo = vi.fn()

    const navigationPromise = navigateToMiniProgramRoute(MINI_PROGRAM_ROUTES.essentialData, {
      taro: {
        switchTab: vi.fn(),
        redirectTo,
        reLaunch: vi.fn(),
      },
      transition: {
        beforeNavigate,
        delayMs: 120,
      },
    })

    expect(beforeNavigate).toHaveBeenCalledTimes(1)
    expect(redirectTo).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(120)
    await navigationPromise

    expect(redirectTo).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.essentialData })
  })

  it('applies the same transition delay before switching tabs', async () => {
    vi.useFakeTimers()
    const switchTab = vi.fn()

    const navigationPromise = navigateToMiniProgramRoute(MINI_PROGRAM_ROUTES.profile, {
      taro: {
        switchTab,
        redirectTo: vi.fn(),
        reLaunch: vi.fn(),
      },
      transition: {
        delayMs: 140,
      },
    })

    expect(switchTab).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(139)
    expect(switchTab).not.toHaveBeenCalled()

    await vi.advanceTimersByTimeAsync(1)
    await navigationPromise

    expect(switchTab).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.profile })
  })
})

