import { describe, expect, it } from 'vitest'
import { MINI_PROGRAM_PAGE_PATHS } from './onboardingRoutes'
import {
  isPublicMiniProgramAuthRoute,
  normalizeMiniProgramRoute,
  shouldRedirectToLoginOnUnauthorized,
} from './authSessionRules'

describe('mini-program auth session route rules', () => {
  // Guards against regression: public entry routes must not force-login on 401.
  it('keeps discover, login, and legal entry routes public', () => {
    expect(isPublicMiniProgramAuthRoute(MINI_PROGRAM_PAGE_PATHS.discover)).toBe(true)
    expect(isPublicMiniProgramAuthRoute(MINI_PROGRAM_PAGE_PATHS.login)).toBe(true)
    expect(isPublicMiniProgramAuthRoute(MINI_PROGRAM_PAGE_PATHS.index)).toBe(true)
    expect(isPublicMiniProgramAuthRoute(MINI_PROGRAM_PAGE_PATHS.terms)).toBe(true)

    expect(shouldRedirectToLoginOnUnauthorized(MINI_PROGRAM_PAGE_PATHS.discover)).toBe(false)
    expect(shouldRedirectToLoginOnUnauthorized(MINI_PROGRAM_PAGE_PATHS.login)).toBe(false)
    expect(shouldRedirectToLoginOnUnauthorized(MINI_PROGRAM_PAGE_PATHS.terms)).toBe(false)
  })

  it('fails closed for protected routes', () => {
    expect(shouldRedirectToLoginOnUnauthorized(MINI_PROGRAM_PAGE_PATHS.profile)).toBe(true)
    expect(shouldRedirectToLoginOnUnauthorized(MINI_PROGRAM_PAGE_PATHS.events)).toBe(true)
    expect(shouldRedirectToLoginOnUnauthorized(MINI_PROGRAM_PAGE_PATHS.blindBoxPayment)).toBe(true)
    expect(shouldRedirectToLoginOnUnauthorized(MINI_PROGRAM_PAGE_PATHS.personalityTest)).toBe(true)
    expect(shouldRedirectToLoginOnUnauthorized('pages/unknown/index')).toBe(true)
  })

  it('normalizes leading slashes and handles startup routes safely', () => {
    expect(normalizeMiniProgramRoute('/pages/discover/index?from=share')).toBe(MINI_PROGRAM_PAGE_PATHS.discover)
    expect(shouldRedirectToLoginOnUnauthorized('/pages/discover/index?from=share')).toBe(false)
    expect(shouldRedirectToLoginOnUnauthorized('/pages/profile/index?tab=overview')).toBe(true)
    expect(shouldRedirectToLoginOnUnauthorized('')).toBe(false)
  })
})
