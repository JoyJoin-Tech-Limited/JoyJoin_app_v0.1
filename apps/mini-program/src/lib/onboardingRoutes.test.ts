import { describe, expect, it } from 'vitest'
import { MINI_PROGRAM_PAGES, MINI_PROGRAM_ROUTES, nextStepToMiniProgramRoute } from './onboardingRoutes'

describe('mini-program onboarding routes', () => {
  // Guards against regression: cold-start should land on the standalone
  // landing entry before the discover tab shell.
  it('keeps index as the cold-start landing entry page', () => {
    expect(MINI_PROGRAM_PAGES[0]).toBe('pages/index/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/discover/index')
  })

  it('retains the canonical events tab page and both legacy events aliases', () => {
    expect(MINI_PROGRAM_PAGES).toContain('pages/events/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/terms/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/event-detail/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/pool-registration/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/my-events/index')
    expect(MINI_PROGRAM_PAGES).toContain('pages/journey/index')
  })

  it('does not keep the removed chats redirect alias registered', () => {
    expect(MINI_PROGRAM_PAGES).not.toContain('pages/chats/index')
  })

  it('maps each server nextStep to the canonical mini-program route', () => {
    expect(nextStepToMiniProgramRoute('onboarding')).toBe(MINI_PROGRAM_ROUTES.onboarding)
    expect(nextStepToMiniProgramRoute('personality-test')).toBe(MINI_PROGRAM_ROUTES.personalityTest)
    expect(nextStepToMiniProgramRoute('essential-data')).toBe(MINI_PROGRAM_ROUTES.essentialData)
    expect(nextStepToMiniProgramRoute('extended-data')).toBe(MINI_PROGRAM_ROUTES.extendedData)
    expect(nextStepToMiniProgramRoute('profile-review')).toBe(MINI_PROGRAM_ROUTES.profileReview)
    expect(nextStepToMiniProgramRoute('guide')).toBe(MINI_PROGRAM_ROUTES.discover)
    expect(nextStepToMiniProgramRoute('discover')).toBe(MINI_PROGRAM_ROUTES.discover)
    expect(nextStepToMiniProgramRoute(undefined)).toBe(MINI_PROGRAM_ROUTES.discover)
  })

  it('defaults to discover for unknown step strings', () => {
    expect(nextStepToMiniProgramRoute('')).toBe(MINI_PROGRAM_ROUTES.discover)
    expect(nextStepToMiniProgramRoute('unknown-step')).toBe(MINI_PROGRAM_ROUTES.discover)
  })
})
