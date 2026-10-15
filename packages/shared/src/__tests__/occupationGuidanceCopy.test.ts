import { describe, expect, it } from 'vitest'
import { getOccupationGuidance } from '../occupations'

// WeChat review posture (2026-08-18, 🔴): user-facing copy uses event-booking
// vocabulary (排桌/局/同桌/同频/活动画像). 匹配/社交/灵魂/撮合/AI are banned in
// visible copy — machine identifiers are exempt, but getOccupationGuidance copy
// renders directly on the onboarding profession picker (essential-data page).
const FORBIDDEN_VOCAB = /匹配|社交|灵魂|撮合|AI/
// Broad emoji / pictograph coverage (matches repo guardrail-style checks).
const EMOJI_PATTERN = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}]/u

const ALL_INTENTS = ['networking', 'friends', 'explore', 'fun', 'discussion', 'flexible', ''] as const

describe('getOccupationGuidance — profession-picker copy canon', () => {
  it('returns title/subtitle/matchPreview for every intent including default', () => {
    for (const intent of ALL_INTENTS) {
      const guidance = getOccupationGuidance(intent)
      expect(guidance.title.length).toBeGreaterThan(0)
      expect(guidance.subtitle.length).toBeGreaterThan(0)
      expect(guidance.matchPreview.length).toBeGreaterThan(0)
    }
  })

  it('keeps every field free of review-blocked vocabulary and emoji', () => {
    for (const intent of ALL_INTENTS) {
      const guidance = getOccupationGuidance(intent)
      for (const field of [guidance.title, guidance.subtitle, guidance.matchPreview]) {
        expect(FORBIDDEN_VOCAB.test(field)).toBe(false)
        expect(EMOJI_PATTERN.test(field)).toBe(false)
      }
    }
  })

  it('sells the table payoff in event-booking vocabulary (排/同桌/局)', () => {
    // Locks the 2026-08-18 direction: matchPreview must talk about the table
    // the user will sit at, never about the matching mechanic.
    for (const intent of ALL_INTENTS) {
      const { matchPreview } = getOccupationGuidance(intent)
      expect(/排|同桌|局/.test(matchPreview)).toBe(true)
    }
  })

  it('keeps matchPreview within the one-line hint budget (≤ 30 chars)', () => {
    for (const intent of ALL_INTENTS) {
      const { matchPreview } = getOccupationGuidance(intent)
      expect(matchPreview.length).toBeLessThanOrEqual(30)
    }
  })
})
