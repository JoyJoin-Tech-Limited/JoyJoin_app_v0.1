import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  buildPersonalityResultSharePath,
  buildPersonalityResultTimelineQuery,
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

describe('personality result referral boundary', () => {
  it('keeps the share module attribution-only, with no coupon or reward helper/copy', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/lib/referral/resultShare.ts'), 'utf8')

    expect(source).not.toMatch(/getResultShareRewardHint|RESULT_SHARE_REWARD_HINT|多一张券|发券|奖励/)
  })
})
