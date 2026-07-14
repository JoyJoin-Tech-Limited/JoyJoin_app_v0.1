import { describe, expect, it } from 'vitest'
import {
  MINI_PROGRAM_ALANG_SUBPACKAGE_PAGES,
  MINI_PROGRAM_ALANG_SUBPACKAGE_ROOT,
  MINI_PROGRAM_FEATURES_SUBPACKAGE_PAGES,
  MINI_PROGRAM_FEATURES_SUBPACKAGE_ROOT,
  MINI_PROGRAM_MAIN_PACKAGE_PAGES,
  MINI_PROGRAM_MATCHING_SUBPACKAGE_PAGES,
  MINI_PROGRAM_MATCHING_SUBPACKAGE_ROOT,
  MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES,
  MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT,
  MINI_PROGRAM_PAGES,
  MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_PAGES,
  MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT,
  MINI_PROGRAM_PRELOAD_RULES,
  MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_PAGES,
  MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_ROOT,
  MINI_PROGRAM_ROUTES,
  MINI_PROGRAM_SUBPACKAGES,
  MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_PAGES,
  MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT,
  nextStepToMiniProgramRoute,
} from './onboardingRoutes'

describe('mini-program onboarding routes', () => {
  // Guards against regression: cold-start should land on the standalone
  // landing entry before the discover tab shell.
  it('keeps index as the cold-start landing entry page', () => {
    expect(MINI_PROGRAM_PAGES[0]).toBe('pages/index/index')
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES[0]).toBe('pages/index/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/discover/index')
  })

  it('retains the canonical events tab page and core pages', () => {
    expect(MINI_PROGRAM_PAGES).toContain('pages/events/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/profile-linked/terms/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/event-detail/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/pool-registration/index')
  })

  it('does not keep removed redirect aliases registered', () => {
    expect(MINI_PROGRAM_PAGES).not.toContain('pages/chats/index')
    expect(MINI_PROGRAM_PAGES).not.toContain('pages/my-events/index')
    expect(MINI_PROGRAM_PAGES).not.toContain('pages/journey/index')
  })

  it('does not duplicate registered page paths', () => {
    expect(new Set(MINI_PROGRAM_PAGES).size).toBe(MINI_PROGRAM_PAGES.length)
  })

  it('moves the onboarding chain into an ordinary subpackage registration', () => {
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/onboarding/onboarding/index')
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/pool-registration/index')
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/profile-linked/edit-profile/index')
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/profile-linked/rewards/index')
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/profile-linked/invite/index')
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/profile-linked/terms/index')
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/alang/event/index')
    // D1: squad-unboxing left the main package — the tap-to-reveal revamp grew
    // the page past the 2 MB zip ceiling.
    expect(MINI_PROGRAM_MAIN_PACKAGE_PAGES).not.toContain('pages/squad-unboxing/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/squad-unboxing/index')
    expect(MINI_PROGRAM_SUBPACKAGES).toEqual([
      {
        root: MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT,
        pages: MINI_PROGRAM_ONBOARDING_SUBPACKAGE_PAGES,
      },
      {
        root: MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_ROOT,
        pages: MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_PAGES,
      },
      {
        root: MINI_PROGRAM_FEATURES_SUBPACKAGE_ROOT,
        pages: MINI_PROGRAM_FEATURES_SUBPACKAGE_PAGES,
      },
      {
        root: MINI_PROGRAM_MATCHING_SUBPACKAGE_ROOT,
        pages: MINI_PROGRAM_MATCHING_SUBPACKAGE_PAGES,
      },
      {
        root: MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT,
        pages: MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_PAGES,
      },
      {
        root: MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT,
        pages: MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_PAGES,
      },
      {
        root: MINI_PROGRAM_ALANG_SUBPACKAGE_ROOT,
        pages: MINI_PROGRAM_ALANG_SUBPACKAGE_PAGES,
      },
    ])
  })

  it('preloads the onboarding subpackage from the landing and login entry pages', () => {
    expect(MINI_PROGRAM_PRELOAD_RULES).toEqual({
      'pages/index/index': {
        network: 'all',
        packages: [MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT],
      },
      'pages/login/index': {
        network: 'all',
        packages: [MINI_PROGRAM_ONBOARDING_SUBPACKAGE_ROOT],
      },
      'pages/event-detail/index': {
        network: 'all',
        packages: [MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT],
      },
      'pages/events/index': {
        network: 'all',
        packages: [
          MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT,
          MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT,
        ],
      },
      'pages/center-hub/index': {
        network: 'all',
        packages: [MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT],
      },
      'pages/matching-status/index': {
        network: 'all',
        packages: [MINI_PROGRAM_SQUAD_UNBOXING_SUBPACKAGE_ROOT],
      },
      'pages/discover/index': {
        network: 'all',
        packages: [
          MINI_PROGRAM_POOL_REGISTRATION_SUBPACKAGE_ROOT,
          MINI_PROGRAM_ALANG_SUBPACKAGE_ROOT,
        ],
      },
      'pages/profile/index': {
        network: 'all',
        packages: [MINI_PROGRAM_PROFILE_LINKED_SUBPACKAGE_ROOT],
      },
    })
  })

  it('maps each server nextStep to the canonical mini-program route', () => {
    expect(nextStepToMiniProgramRoute('onboarding')).toBe(MINI_PROGRAM_ROUTES.personalityTest)
    expect(nextStepToMiniProgramRoute('personality-test')).toBe(MINI_PROGRAM_ROUTES.personalityTest)
    expect(nextStepToMiniProgramRoute('essential-data')).toBe(MINI_PROGRAM_ROUTES.essentialData)
    expect(nextStepToMiniProgramRoute('extended-data')).toBe(MINI_PROGRAM_ROUTES.extendedData)
    expect(nextStepToMiniProgramRoute('profile-review')).toBe(MINI_PROGRAM_ROUTES.profileReview)
    expect(nextStepToMiniProgramRoute('discover')).toBe(MINI_PROGRAM_ROUTES.discover)
    expect(nextStepToMiniProgramRoute(undefined)).toBe(MINI_PROGRAM_ROUTES.discover)
  })

  it('defaults to discover for unknown step strings', () => {
    expect(nextStepToMiniProgramRoute('')).toBe(MINI_PROGRAM_ROUTES.discover)
    expect(nextStepToMiniProgramRoute('unknown-step')).toBe(MINI_PROGRAM_ROUTES.discover)
  })
})
