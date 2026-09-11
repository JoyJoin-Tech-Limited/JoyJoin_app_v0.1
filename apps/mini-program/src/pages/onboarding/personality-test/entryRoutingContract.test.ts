// @vitest-environment node
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const pageSource = readFileSync(new URL('./index.tsx', import.meta.url), 'utf8')
const indexPageSource = readFileSync(new URL('../../index/index.tsx', import.meta.url), 'utf8')

describe('personality test entry routing contract (2026-09-03)', () => {
  it('never redirects a guest with a completed anonymous snapshot straight to results', () => {
    expect(pageSource).not.toContain('hasAnonymousAssessmentResult')
    expect(pageSource).not.toMatch(
      /isAnonymousAssessmentSessionCompleted\(snapshot\)[^)]*\|\|[\s\S]{0,120}personalityTestResults/
    )
  })

  it('keeps the landing guest-restore skipping completed snapshots', () => {
    expect(indexPageSource).toContain('isAnonymousAssessmentSessionCompleted')
  })

  it('starts a fresh session from the intro (handleStart clears stored anonymous state)', () => {
    expect(pageSource).toContain('clearAnonymousAssessmentStorage')
  })

  it('shows an interstitial instead of silently bouncing post-onboarding archetype holders', () => {
    expect(pageSource).toContain('showArchetypeInterstitial')
    expect(pageSource).toContain('PersonalityTestReturnInterstitial')
  })

  it('never shows the interstitial to mid-onboarding users — the legacy instant redirect survives', () => {
    // Guard derivation: any in-flight nextStep other than 'discover' counts
    // as onboarding-in-flight and keeps the redirect.
    expect(pageSource).toContain("auth.nextStep !== 'discover'")
    expect(pageSource).toMatch(/isOnboardingInFlight[\s\S]{0,400}redirectTo\(\{ url: MINI_PROGRAM_ROUTES\.personalityTestResults \}\)/)
  })

  it('never shows the interstitial in restart mode', () => {
    expect(pageSource).toMatch(/showArchetypeInterstitial =[\s\S]{0,200}!isRestartEntry/)
  })

  it('gates the speculative /start prefire while the interstitial is shown', () => {
    expect(pageSource).toMatch(/hasStoredIncompleteSession \|\| sessionId \|\| showArchetypeInterstitial\)/)
  })

  it('re-enters the page in restart mode from the interstitial (same URL as the results page)', () => {
    expect(pageSource).toContain('${MINI_PROGRAM_ROUTES.personalityTest}?mode=restart')
  })
})
