import { describe, expect, it } from 'vitest'
import {
  buildPersonalityResultSharePath,
  buildPersonalityResultTimelineQuery,
  getResultShareRewardHint,
  RESULT_SHARE_REWARD_HINT,
} from './resultShare'

describe('buildPersonalityResultSharePath', () => {
  it('appends the referral code to the test-intro route when present', () => {
    expect(buildPersonalityResultSharePath('abc123')).toBe(
      '/pages/onboarding/personality-test/index?invitationCode=abc123',
    )
  })

  it('shares exactly as before when no code is available (fail-open)', () => {
    const bare = '/pages/onboarding/personality-test/index'
    expect(buildPersonalityResultSharePath(undefined)).toBe(bare)
    expect(buildPersonalityResultSharePath(null)).toBe(bare)
    expect(buildPersonalityResultSharePath('')).toBe(bare)
    expect(buildPersonalityResultSharePath('   ')).toBe(bare)
  })

  it('trims and encodes the code', () => {
    expect(buildPersonalityResultSharePath('  ab?23  ')).toBe(
      '/pages/onboarding/personality-test/index?invitationCode=ab%3F23',
    )
  })
})

describe('buildPersonalityResultTimelineQuery', () => {
  it('carries the code alongside the source marker', () => {
    expect(buildPersonalityResultTimelineQuery('abc123')).toBe('source=personality-result&invitationCode=abc123')
  })

  it('keeps the legacy query when no code is available', () => {
    expect(buildPersonalityResultTimelineQuery(undefined)).toBe('source=personality-result')
    expect(buildPersonalityResultTimelineQuery('')).toBe('source=personality-result')
  })
})

describe('getResultShareRewardHint', () => {
  it('renders the reward line only when a code exists', () => {
    expect(getResultShareRewardHint('abc123')).toBe(RESULT_SHARE_REWARD_HINT)
  })

  it('renders nothing for anonymous / failed-code sharers', () => {
    expect(getResultShareRewardHint(undefined)).toBe('')
    expect(getResultShareRewardHint(null)).toBe('')
    expect(getResultShareRewardHint('  ')).toBe('')
  })

  it('never promises a specific coupon amount or discount', () => {
    expect(RESULT_SHARE_REWARD_HINT).not.toMatch(/折|×|\d+\s*张|%|元/)
    expect(RESULT_SHARE_REWARD_HINT).toContain('多一张券')
  })

  it('stays inside WeChat-review vocabulary (no banned words)', () => {
    expect(RESULT_SHARE_REWARD_HINT).not.toMatch(/匹配|社交|灵魂|撮合/)
  })
})
