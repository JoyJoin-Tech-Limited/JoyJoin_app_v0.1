import { describe, expect, it } from 'vitest'
import {
  buildQuipBattleVotes,
  buildQuipBattleVotingState,
} from '../phases/QuipBattleHeroView'

describe('quip battle voting state', () => {
  it('allows an empty vote set after every answer card has been viewed', () => {
    expect(buildQuipBattleVotingState(18, 18)).toEqual({
      canSubmit: true,
      statusText: '卡片 18/18',
      viewedCount: 18,
    })
  })

  it('keeps submission unavailable while answer cards remain', () => {
    expect(buildQuipBattleVotingState(5, 18)).toEqual({
      canSubmit: false,
      statusText: '卡片 6/18',
      viewedCount: 5,
    })
  })

  it('handles an empty answer stack without inventing progress', () => {
    expect(buildQuipBattleVotingState(0, 0)).toEqual({
      canSubmit: true,
      statusText: '卡片 0/0',
      viewedCount: 0,
    })
  })

  it('keeps every selected answer even when multiple answers share one prompt', () => {
    expect(buildQuipBattleVotes({
      'user-1::prompt-1': 'prompt-1',
      'user-2::prompt-1': 'prompt-1',
    })).toEqual([
      { answerId: 'user-1::prompt-1', promptId: 'prompt-1' },
      { answerId: 'user-2::prompt-1', promptId: 'prompt-1' },
    ])
  })
})
