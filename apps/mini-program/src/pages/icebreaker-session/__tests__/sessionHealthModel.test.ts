import { describe, expect, it } from 'vitest'
import { countMySessionActions } from '../viewModels/sessionHealthModel'

/**
 * Session health model (sprint icebreaker-polish-p1, contract AC-06 补6).
 * myActionCount is derived locally from the final session state — zero new
 * requests. Locks the per-phase contribution mapping.
 */
describe('countMySessionActions', () => {
  it('returns 0 for empty/absent sessions and unknown users', () => {
    expect(countMySessionActions(null, 'u1')).toBe(0)
    expect(countMySessionActions(undefined, 'u1')).toBe(0)
    expect(countMySessionActions({}, 'u1')).toBe(0)
    expect(countMySessionActions({ challengeCompletedBy: ['u1'] }, '')).toBe(0)
  })

  it('counts undercover descriptions across rounds + the vote', () => {
    expect(
      countMySessionActions(
        {
          undercoverWordRounds: [
            { descriptions: [{ userId: 'u1' }, { userId: 'u2' }] },
            { descriptions: [{ userId: 'u1' }] },
          ],
          undercoverWordVotes: [{ voterId: 'u1' }],
        },
        'u1',
      ),
    ).toBe(3)
  })

  it('counts group-mirror answers, quip answers + quip vote', () => {
    expect(
      countMySessionActions(
        {
          groupMirrorAnswers: [{ userId: 'u1' }, { userId: 'u1' }, { userId: 'u2' }],
          quipBattleAnswers: [{ userId: 'u1' }],
          quipBattleVotedUserIds: ['u1', 'u2'],
        },
        'u1',
      ),
    ).toBe(4)
  })

  it('counts lie statements + votes, challenge/dice completions, bids, miniscript, speed rounds', () => {
    expect(
      countMySessionActions(
        {
          lieDetectivePlayers: [{ userId: 'u1', statements: ['a', 'b', 'c'] }],
          votes: [{ voterId: 'u1' }, { voterId: 'u1' }, { voterId: 'u2' }],
          challengeCompletedBy: ['u1'],
          diceCompletedBy: ['u1'],
          dicePassedBy: ['u2'],
          auctionBidHistory: [{ userId: 'u1' }, { userId: 'u1' }, { userId: 'u3' }],
          miniScriptPlayerReady: { u1: true },
          miniScriptVotes: [{ userId: 'u1' }],
          speedFriendingPairs: [
            { userIdA: 'u1', userIdB: 'u2' },
            { userIdA: 'u3', userIdB: 'u1' },
            { userIdA: 'u2', userIdB: 'u3' },
          ],
        },
        'u1',
      ),
    ).toBe(3 + 2 + 1 + 1 + 2 + 1 + 1 + 2)
  })

  it('never counts other users’ contributions', () => {
    expect(
      countMySessionActions(
        {
          undercoverWordRounds: [{ descriptions: [{ userId: 'u2' }] }],
          groupMirrorAnswers: [{ userId: 'u2' }],
          challengeCompletedBy: ['u2'],
          auctionBidHistory: [{ userId: 'u2' }],
        },
        'u1',
      ),
    ).toBe(0)
  })
})
