import { describe, expect, it } from 'vitest'
import {
  buildGroupMirrorAnswerRows,
  canChoosePersonalityDiceOption,
  getPersonalityDiceCountdownSeconds,
  getGenerationRetryDelayMs,
  resolveAuctionRoleControls,
  resolvePersonalityDiceChooseMode,
} from '../viewModels/phaseProgressionModels'

describe('phase progression models', () => {
  it('uses the server-owned personality dice mode over a stale auth feature', () => {
    expect(resolvePersonalityDiceChooseMode(true, false)).toBe(true)
    expect(resolvePersonalityDiceChooseMode(false, true)).toBe(false)
    expect(resolvePersonalityDiceChooseMode(undefined, true)).toBe(true)
  })

  it('allows personality-dice reselection until ready, but not while locked or pending', () => {
    expect(canChoosePersonalityDiceOption(false, false, 0, 2)).toBe(true)
    expect(canChoosePersonalityDiceOption(true, false, 0, 2)).toBe(false)
    expect(canChoosePersonalityDiceOption(false, true, 0, 2)).toBe(false)
    expect(canChoosePersonalityDiceOption(false, false, 2, 2)).toBe(false)
  })

  it('counts down three synchronized seconds before revealing personality-dice choices', () => {
    expect(getPersonalityDiceCountdownSeconds(4_000, 1_000)).toBe(3)
    expect(getPersonalityDiceCountdownSeconds(4_000, 3_001)).toBe(1)
    expect(getPersonalityDiceCountdownSeconds(4_000, 4_000)).toBe(0)
  })

  it('retries accepted background generation responses using a bounded delay', () => {
    expect(getGenerationRetryDelayMs({ status: 'generating', retryAfterMs: 1200 })).toBe(1200)
    expect(getGenerationRetryDelayMs({ status: 'generating', retryAfterMs: 99 })).toBe(500)
    expect(getGenerationRetryDelayMs({ status: 'ready' })).toBeNull()
  })

  it('lets a single-test host switch between host and guest role controls', () => {
    expect(resolveAuctionRoleControls({ isHost: true, isSingleTest: true, previewRole: 'host' })).toEqual({
      canBid: false,
      canHostControl: true,
    })
    expect(resolveAuctionRoleControls({ isHost: true, isSingleTest: true, previewRole: 'guest' })).toEqual({
      canBid: true,
      canHostControl: false,
    })
    expect(resolveAuctionRoleControls({ isHost: false, isSingleTest: false, previewRole: 'host' })).toEqual({
      canBid: true,
      canHostControl: false,
    })
  })

  it('builds Group Mirror detail rows with voter and selected member identities', () => {
    expect(buildGroupMirrorAnswerRows({
      questionId: 'q1',
      answers: [
        {
          userId: 'voter-1',
          displayName: 'Alice',
          questionId: 'q1',
          targetUserId: 'member-2',
        },
        {
          userId: 'voter-2',
          displayName: 'Bob',
          questionId: 'q2',
          targetUserId: 'member-1',
        },
      ],
      participants: [
        { userId: 'member-1', displayName: 'Carol' },
        { userId: 'member-2', displayName: 'Dylan' },
      ],
    })).toEqual([
      {
        voterDisplayName: 'Alice',
        targetDisplayName: 'Dylan',
        targetUserId: 'member-2',
      },
    ])
  })
})
