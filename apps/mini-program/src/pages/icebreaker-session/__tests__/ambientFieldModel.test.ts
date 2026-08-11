import { describe, expect, it } from 'vitest'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import {
  MOOD_FIELD_FRAGMENT_REVEAL,
  MOOD_FIELD_FRAGMENT_WAITING,
  deriveMoodField,
  deriveMoodFieldProgress,
  deriveMoodFieldState,
} from '../viewModels/ambientFieldModel'

function makeState(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_test_1',
    icebreakerSessionId: 'ib_test_1',
    currentPhase: 'warmup',
    hostUserId: 'host-user',
    hostDisplayName: 'Host',
    playerCount: 4,
    phaseStartedAt: 1_000,
    sessionStartedAt: 500,
    completedPhases: [],
    ...overrides,
  }
}

describe('ambientFieldModel — locked copy (spec §5)', () => {
  it('ships the waiting and reveal fragments verbatim, and no active copy', () => {
    expect(MOOD_FIELD_FRAGMENT_WAITING).toBe('先聊着')
    expect(MOOD_FIELD_FRAGMENT_REVEAL).toBe('一起揭晓')

    const active = deriveMoodField(makeState({ currentPhase: 'micro_challenge', challengeCompletedBy: ['a'] }))
    expect(active.state).toBe('active')
    expect(active.fragment).toBeNull()
  })
})

describe('ambientFieldModel — state mapping', () => {
  it('maps pre-game phases to waiting with a full cool field', () => {
    // NB: 'waiting' is a client-only SessionPhase (pre-bootstrap, no session
    // state) — the model only ever sees server phases; phase_selection is the
    // in-session waiting context.
    const model = deriveMoodField(makeState({ currentPhase: 'phase_selection' }))
    expect(model.state).toBe('waiting')
    expect(model.coolOpacity).toBe(1)
    expect(model.warmOpacity).toBe(0)
    expect(model.fragment).toBe(MOOD_FIELD_FRAGMENT_WAITING)
  })

  it('cools to waiting while warmup topics are generating', () => {
    const model = deriveMoodField(
      makeState({ currentPhase: 'warmup', warmupTopicsStatus: 'generating', warmupReadyUserIds: ['a'] }),
    )
    expect(model.state).toBe('waiting')
  })

  it('is active in a playable phase and tightens with participation', () => {
    const early = deriveMoodField(makeState({ currentPhase: 'warmup', warmupReadyUserIds: ['a'] }))
    expect(early.state).toBe('active')
    expect(early.progress).toBe(0.25)
    expect(early.coolOpacity).toBeCloseTo(1 - 0.7 * 0.25, 5)
    expect(early.warmOpacity).toBeCloseTo(0.15 + 0.45 * 0.25, 5)
    expect(early.warmScale).toBeCloseTo(1.12 - 0.12 * 0.25, 5)

    const late = deriveMoodField(makeState({ currentPhase: 'warmup', warmupReadyUserIds: ['a', 'b', 'c'] }))
    expect(late.progress).toBe(0.75)
    // Tightening: warmer and gathered further inward than the early field.
    expect(late.warmOpacity).toBeGreaterThan(early.warmOpacity)
    expect(late.warmScale).toBeLessThan(early.warmScale)
  })

  it('cools back to waiting once the group\'s part is done (progress = 1)', () => {
    const model = deriveMoodField(
      makeState({ currentPhase: 'micro_challenge', challengeCompletedBy: ['a', 'b', 'c', 'd'] }),
    )
    expect(model.state).toBe('waiting')
    expect(model.progress).toBe(1)
  })

  it('treats recap as the connection-achieved steady warm field', () => {
    const model = deriveMoodField(makeState({ currentPhase: 'recap' }))
    expect(model.state).toBe('active')
    expect(model.progress).toBe(1)
    expect(model.warmOpacity).toBeCloseTo(0.6, 5)
  })

  it('lets the reveal bloom win over every other state', () => {
    const fromWaiting = deriveMoodField(makeState({ currentPhase: 'phase_selection' }), { revealActive: true })
    expect(fromWaiting.state).toBe('reveal')
    expect(fromWaiting.warmOpacity).toBe(1)
    expect(fromWaiting.coolOpacity).toBe(0)
    expect(fromWaiting.fragment).toBe(MOOD_FIELD_FRAGMENT_REVEAL)

    const fromActive = deriveMoodField(
      makeState({ currentPhase: 'lie_detective', lieDetectivePlayers: [{ userId: 'u1', displayName: 'A', statements: [] }], votes: [] }),
      { revealActive: true },
    )
    expect(fromActive.state).toBe('reveal')
  })
})

describe('ambientFieldModel — progress extractors', () => {
  it('counts lie-detective votes for the current target only', () => {
    const players = [
      { userId: 'u1', displayName: 'A', statements: [] },
      { userId: 'u2', displayName: 'B', statements: [] },
    ]
    const votes = [
      { voterId: 'a', targetUserId: 'u2', guessedStatementIndex: 0 },
      { voterId: 'b', targetUserId: 'u2', guessedStatementIndex: 1 },
      { voterId: 'c', targetUserId: 'u1', guessedStatementIndex: 2 },
    ]
    const progress = deriveMoodFieldProgress(
      makeState({ currentPhase: 'lie_detective', lieDetectivePlayers: players, currentLieDetectivePlayerIndex: 1, votes }),
    )
    expect(progress).toBe(0.5)
  })

  it('unions dice completions and passes without double-counting', () => {
    const progress = deriveMoodFieldProgress(
      makeState({ currentPhase: 'personality_dice', diceCompletedBy: ['a', 'b'], dicePassedBy: ['b', 'c'] }),
    )
    expect(progress).toBe(0.75)
  })

  it('takes the stronger of quip-battle submissions and votes', () => {
    const progress = deriveMoodFieldProgress(
      makeState({ currentPhase: 'quip_battle', quipBattleSubmittedUserIds: ['a', 'b', 'c'], quipBattleVotedUserIds: ['a'] }),
    )
    expect(progress).toBe(0.75)
  })

  it('tracks auction lots closed and speed-friending rounds', () => {
    const auction = deriveMoodFieldProgress(
      makeState({
        currentPhase: 'auction',
        auctionLots: [{ id: 'l1' }, { id: 'l2' }] as never,
        auctionCurrentLotIndex: 1,
      }),
    )
    expect(auction).toBe(0.5)
    const auctionClosed = deriveMoodFieldProgress(
      makeState({ currentPhase: 'auction', auctionLots: [{ id: 'l1' }] as never, auctionAllLotsClosed: true }),
    )
    expect(auctionClosed).toBe(1)

    const speed = deriveMoodFieldProgress(
      makeState({ currentPhase: 'speed_friending', speedFriendingCurrentRound: 2, speedFriendingTotalRounds: 4 }),
    )
    expect(speed).toBe(0.5)
    const speedDone = deriveMoodFieldProgress(
      makeState({ currentPhase: 'speed_friending', speedFriendingAllRoundsComplete: true }),
    )
    expect(speedDone).toBe(1)
  })

  it('yields 0 for phases without an accumulable signal and never throws on sparse state', () => {
    expect(deriveMoodFieldProgress(makeState({ currentPhase: 'mini_script' }))).toBe(0)
    // playerCount 0 / missing arrays must not produce NaN or a throw.
    expect(deriveMoodFieldProgress(makeState({ currentPhase: 'warmup', playerCount: 0 }))).toBe(0)
    expect(() => deriveMoodField(makeState({ currentPhase: 'lie_detective' }))).not.toThrow()
  })

  it('keeps every layer value inside its bounds across the whole progress sweep', () => {
    for (let done = 0; done <= 6; done++) {
      const model = deriveMoodField(
        makeState({ currentPhase: 'micro_challenge', playerCount: 4, challengeCompletedBy: Array.from({ length: done }, (_, i) => `u${i}`) }),
      )
      expect(model.coolOpacity).toBeGreaterThanOrEqual(0)
      expect(model.coolOpacity).toBeLessThanOrEqual(1)
      expect(model.warmOpacity).toBeGreaterThanOrEqual(0)
      expect(model.warmOpacity).toBeLessThanOrEqual(1)
      expect(model.warmScale).toBeGreaterThanOrEqual(1)
      expect(model.warmScale).toBeLessThanOrEqual(1.12)
      expect(model.progress).toBeGreaterThanOrEqual(0)
      expect(model.progress).toBeLessThanOrEqual(1)
    }
  })
})

describe('ambientFieldModel — deriveMoodFieldState precedence', () => {
  it('orders reveal > explicit waiting > all-done waiting > active', () => {
    const base = makeState({ currentPhase: 'phase_selection' })
    expect(deriveMoodFieldState(base, 0, { revealActive: true })).toBe('reveal')
    expect(deriveMoodFieldState(base, 0)).toBe('waiting')
    expect(deriveMoodFieldState(makeState({ currentPhase: 'group_mirror' }), 1)).toBe('waiting')
    expect(deriveMoodFieldState(makeState({ currentPhase: 'group_mirror' }), 0.4)).toBe('active')
  })
})
