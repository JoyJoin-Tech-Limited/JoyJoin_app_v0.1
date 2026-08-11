import { describe, expect, it } from 'vitest'
import {
  ATUAN_FIRST_ACT_FOLLOWUPS,
  createAtuanFirstActProgress,
  resolveAtuanFirstActOutcome,
  restoreAtuanFirstActProgress,
  toAtuanFirstActSubmission,
  validateAtuanFirstActSubmission,
} from './atuanFirstAct'

describe('Atuan first-act arrival story', () => {
  it('persists the chosen way of meeting Atuan without replaying user copy', () => {
    const progress = createAtuanFirstActProgress('encounter-1', 'notice_wait')
    const restored = restoreAtuanFirstActProgress('encounter-1', {
      ...progress,
      followupId: 'ask_who',
      benchReached: false,
    })
    expect(restored).toEqual(expect.objectContaining({
      version: 'atuan-first-act-v2',
      approachId: 'notice_wait',
      followupId: 'ask_who',
      benchReached: false,
    }))
  })

  it('gives every follow-up a reviewed relationship outcome', () => {
    const endingIds = new Set(ATUAN_FIRST_ACT_FOLLOWUPS.map((followup) => {
      const progress = {
        ...createAtuanFirstActProgress('encounter-2', 'notice_again'),
        followupId: followup.id,
        benchReached: true,
      }
      return resolveAtuanFirstActOutcome('encounter-2', progress).ending.id
    }))
    expect(endingIds).toEqual(new Set(['felt_seen', 'helped_first', 'shared_the_trip']))
  })

  it('rejects a forged ending and accepts the complete arrival path', () => {
    const progress = {
      ...createAtuanFirstActProgress('encounter-3', 'notice_wait'),
      followupId: 'offer_help' as const,
      benchReached: true,
    }
    const submission = toAtuanFirstActSubmission(progress)
    expect(validateAtuanFirstActSubmission('encounter-3', submission)?.outcome.ending.id).toBe('helped_first')
    expect(validateAtuanFirstActSubmission('encounter-3', { ...submission, endingId: 'felt_seen' })).toBeNull()
  })
})
