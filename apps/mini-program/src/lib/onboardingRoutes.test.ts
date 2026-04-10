import { describe, expect, it } from 'vitest'
import { MINI_PROGRAM_PAGES, MINI_PROGRAM_ROUTES, nextStepToMiniProgramRoute } from './onboardingRoutes'

describe('mini-program onboarding routes', () => {
  it('keeps discover as the cold-start entry page', () => {
    expect(MINI_PROGRAM_PAGES[0]).toBe('pages/discover/index')
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
