import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { PersonalityDiceChallenge, SocialSessionState } from '@shared/socialIcebreaker'
import {
  SENSORY_EVENT_HAPTIC_PATTERNS,
  diffSessionSensoryEvents,
  useSessionSensoryEvents,
  type SessionSensoryEvent,
  type SessionSensoryEventKind,
} from '../hooks/useSessionSensoryEvents'

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

function makeDiceChallenge(userId: string): PersonalityDiceChallenge {
  return {
    userId,
    displayName: userId,
    dominantTrait: 'O',
    challengeTitle: 't',
    challengeBody: 'b',
    challengeEmoji: 'star',
    difficulty: 'easy',
  }
}

const kinds = (events: SessionSensoryEvent[]): SessionSensoryEventKind[] => events.map((event) => event.kind)

describe('diffSessionSensoryEvents transition matrix', () => {
  it('stays silent on the first snapshot (baseline only)', () => {
    expect(diffSessionSensoryEvents(null, makeState(), { currentUserId: 'me' })).toEqual([])
  })

  it('stays silent on identical-content snapshots (new object, same values)', () => {
    const prev = makeState({
      warmupReadyUserIds: ['a', 'b'],
      currentLieDetectiveReveal: {
        targetUserId: 'u2',
        lieIndex: 1,
        voteCount: 3,
        correctVoteCount: 1,
        revealedAt: 123,
      },
    })
    const next = makeState({
      warmupReadyUserIds: ['a', 'b'],
      currentLieDetectiveReveal: {
        targetUserId: 'u2',
        lieIndex: 1,
        voteCount: 3,
        correctVoteCount: 1,
        revealedAt: 123,
      },
    })
    expect(diffSessionSensoryEvents(prev, next, { currentUserId: 'me' })).toEqual([])
  })

  it('re-baselines silently when the session identity changes', () => {
    const prev = makeState()
    const next = makeState({ socialSessionId: 'social_other', currentPhase: 'micro_challenge' })
    expect(diffSessionSensoryEvents(prev, next, { currentUserId: 'me' })).toEqual([])
  })

  it('emits phase_entered on a phase transition', () => {
    const events = diffSessionSensoryEvents(
      makeState({ currentPhase: 'warmup' }),
      makeState({ currentPhase: 'micro_challenge' }),
      { currentUserId: 'me', now: 42 },
    )
    expect(kinds(events)).toEqual(['phase_entered'])
    expect(events[0]).toMatchObject({ phase: 'micro_challenge', at: 42 })
  })

  it('emits recap_started instead of phase_entered when entering recap', () => {
    const events = diffSessionSensoryEvents(
      makeState({ currentPhase: 'group_mirror' }),
      makeState({ currentPhase: 'recap' }),
      { currentUserId: 'me' },
    )
    expect(kinds(events)).toEqual(['recap_started'])
  })

  it('fires reveal_appeared once per boolean reveal transition, with no re-fire while revealed', () => {
    const cases: Array<[keyof SocialSessionState, string]> = [
      ['groupMirrorRevealed', 'group_mirror'],
      ['quipBattleRevealed', 'quip_battle'],
      ['undercoverWordRevealed', 'undercover_word'],
    ]
    for (const [field, source] of cases) {
      const prev = makeState({ currentPhase: 'group_mirror' })
      const revealed = makeState({ currentPhase: 'group_mirror', [field]: true })
      const first = diffSessionSensoryEvents(prev, revealed, { currentUserId: 'me' })
      expect(kinds(first)).toEqual(['reveal_appeared'])
      expect(first[0].source).toBe(source)
      // Same reveal state again → nothing.
      expect(diffSessionSensoryEvents(revealed, makeState({ currentPhase: 'group_mirror', [field]: true }), {})).toEqual([])
    }
  })

  it('fires reveal_appeared for each new lie-detective reveal', () => {
    const revealA = { targetUserId: 'u2', lieIndex: 1, voteCount: 3, correctVoteCount: 1, revealedAt: 100 }
    const revealB = { targetUserId: 'u3', lieIndex: 0, voteCount: 4, correctVoteCount: 2, revealedAt: 200 }
    const base = makeState({ currentPhase: 'lie_detective' })

    const first = diffSessionSensoryEvents(base, makeState({ currentPhase: 'lie_detective', currentLieDetectiveReveal: revealA }), {})
    expect(kinds(first)).toEqual(['reveal_appeared'])

    const second = diffSessionSensoryEvents(
      makeState({ currentPhase: 'lie_detective', currentLieDetectiveReveal: revealA }),
      makeState({ currentPhase: 'lie_detective', currentLieDetectiveReveal: revealB }),
      {},
    )
    expect(kinds(second)).toEqual(['reveal_appeared'])
  })

  it('re-arms the warmup topic reveal per dealt topic', () => {
    const prev = makeState({ currentPhase: 'warmup', currentTopicIndex: 0 })
    const flipped = makeState({ currentPhase: 'warmup', currentTopicIndex: 0, warmupTopicRevealed: true })
    expect(kinds(diffSessionSensoryEvents(prev, flipped, {}))).toEqual(['reveal_appeared'])
    // Same card still revealed → silent.
    expect(diffSessionSensoryEvents(flipped, makeState({ currentPhase: 'warmup', currentTopicIndex: 0, warmupTopicRevealed: true }), {})).toEqual([])
    // Next topic flips → new beat.
    const nextTopic = makeState({ currentPhase: 'warmup', currentTopicIndex: 1, warmupTopicRevealed: true })
    expect(kinds(diffSessionSensoryEvents(flipped, nextTopic, {}))).toEqual(['reveal_appeared'])
  })

  it('fires reveal_appeared when the dice reveal countdown starts', () => {
    const events = diffSessionSensoryEvents(
      makeState({ currentPhase: 'personality_dice' }),
      makeState({ currentPhase: 'personality_dice', diceRevealCountdownEndsAt: 9999 }),
      {},
    )
    expect(kinds(events)).toEqual(['reveal_appeared'])
    expect(events[0].source).toBe('personality_dice')
  })

  it('fires own_turn_started only on the edge where the turn becomes the current user', () => {
    const ctx = { currentUserId: 'me' }
    // Becomes mine → fire.
    const toMe = diffSessionSensoryEvents(
      makeState({ currentPhase: 'warmup', warmupTurnUserId: 'u2' }),
      makeState({ currentPhase: 'warmup', warmupTurnUserId: 'me' }),
      ctx,
    )
    expect(kinds(toMe)).toEqual(['own_turn_started'])
    // Stays mine → silent.
    expect(
      diffSessionSensoryEvents(
        makeState({ currentPhase: 'warmup', warmupTurnUserId: 'me' }),
        makeState({ currentPhase: 'warmup', warmupTurnUserId: 'me' }),
        ctx,
      ),
    ).toEqual([])
    // Becomes someone else's → silent.
    expect(
      diffSessionSensoryEvents(
        makeState({ currentPhase: 'warmup', warmupTurnUserId: 'me' }),
        makeState({ currentPhase: 'warmup', warmupTurnUserId: 'u3' }),
        ctx,
      ),
    ).toEqual([])
    // No viewer context → never personal.
    expect(
      diffSessionSensoryEvents(
        makeState({ currentPhase: 'warmup', warmupTurnUserId: 'u2' }),
        makeState({ currentPhase: 'warmup', warmupTurnUserId: 'me' }),
        {},
      ),
    ).toEqual([])
  })

  it('tracks the lie-detective active player as an own-turn source', () => {
    const players = [
      { userId: 'u1', displayName: 'A', statements: [] },
      { userId: 'me', displayName: 'B', statements: [] },
    ]
    const events = diffSessionSensoryEvents(
      makeState({ currentPhase: 'lie_detective', lieDetectivePlayers: players, currentLieDetectivePlayerIndex: 0 }),
      makeState({ currentPhase: 'lie_detective', lieDetectivePlayers: players, currentLieDetectivePlayerIndex: 1 }),
      { currentUserId: 'me' },
    )
    expect(kinds(events)).toEqual(['own_turn_started'])
  })

  it('tracks the personality-dice active player, but stays silent in choose mode', () => {
    const challenges = [makeDiceChallenge('u1'), makeDiceChallenge('me')]
    const events = diffSessionSensoryEvents(
      makeState({ currentPhase: 'personality_dice', personalityDiceChallenges: challenges, currentDicePlayerIndex: 0 }),
      makeState({ currentPhase: 'personality_dice', personalityDiceChallenges: challenges, currentDicePlayerIndex: 1 }),
      { currentUserId: 'me' },
    )
    expect(kinds(events)).toEqual(['own_turn_started'])

    const chooseMode = diffSessionSensoryEvents(
      makeState({ currentPhase: 'personality_dice', personalityDiceChallenges: challenges, currentDicePlayerIndex: 0, personalityDiceChooseModeEnabled: true }),
      makeState({ currentPhase: 'personality_dice', personalityDiceChallenges: challenges, currentDicePlayerIndex: 1, personalityDiceChooseModeEnabled: true }),
      { currentUserId: 'me' },
    )
    expect(chooseMode).toEqual([])
  })

  it('fires all_ready exactly once when the warmup ready set covers the roster', () => {
    const prev = makeState({ currentPhase: 'warmup', playerCount: 3, warmupReadyUserIds: ['a', 'b'] })
    const covered = makeState({ currentPhase: 'warmup', playerCount: 3, warmupReadyUserIds: ['a', 'b', 'c'] })
    expect(kinds(diffSessionSensoryEvents(prev, covered, {}))).toEqual(['all_ready'])
    // Already covered → no double-fire on the next poll.
    expect(diffSessionSensoryEvents(covered, makeState({ currentPhase: 'warmup', playerCount: 3, warmupReadyUserIds: ['a', 'b', 'c'] }), {})).toEqual([])
  })

  it('never fires all_ready from a stale ready set outside its owning phase', () => {
    const events = diffSessionSensoryEvents(
      makeState({ currentPhase: 'warmup', playerCount: 3, warmupReadyUserIds: ['a', 'b'] }),
      makeState({ currentPhase: 'micro_challenge', playerCount: 3, warmupReadyUserIds: ['a', 'b', 'c'] }),
      {},
    )
    expect(kinds(events)).toEqual(['phase_entered'])
  })

  it('fires all_ready once when diceRevealReadyBy covers the roster in personality_dice', () => {
    const prev = makeState({ currentPhase: 'personality_dice', playerCount: 3, diceRevealReadyBy: ['a', 'b'] })
    const covered = makeState({ currentPhase: 'personality_dice', playerCount: 3, diceRevealReadyBy: ['a', 'b', 'c'] })
    const events = diffSessionSensoryEvents(prev, covered, {})
    expect(kinds(events)).toEqual(['all_ready'])
    expect(events[0].source).toBe('dice_reveal')
    // Already covered → no double-fire on the next poll.
    expect(
      diffSessionSensoryEvents(
        covered,
        makeState({ currentPhase: 'personality_dice', playerCount: 3, diceRevealReadyBy: ['a', 'b', 'c'] }),
        {},
      ),
    ).toEqual([])
    // Phase gate: the same full set in a different phase means nothing.
    const wrongPhase = diffSessionSensoryEvents(
      prev,
      makeState({ currentPhase: 'quip_battle', playerCount: 3, diceRevealReadyBy: ['a', 'b', 'c'] }),
      {},
    )
    expect(kinds(wrongPhase)).toEqual(['phase_entered'])
  })

  it('maps every event kind to a haptic pattern (degradation ladder is config)', () => {
    const expectedKinds: SessionSensoryEventKind[] = [
      'phase_entered',
      'reveal_appeared',
      'own_turn_started',
      'all_ready',
      'recap_started',
    ]
    expect(Object.keys(SENSORY_EVENT_HAPTIC_PATTERNS).sort()).toEqual([...expectedKinds].sort())
    for (const kind of expectedKinds) {
      expect(typeof SENSORY_EVENT_HAPTIC_PATTERNS[kind]).toBe('string')
    }
  })
})

describe('useSessionSensoryEvents hook', () => {
  it('is totally silent while the flag is off, and enabling mid-session bursts nothing', () => {
    const onEvent = vi.fn()
    const baseline = makeState({ currentPhase: 'warmup' })
    const advanced = makeState({ currentPhase: 'micro_challenge' })

    const { rerender } = renderHook(
      ({ session, enabled }) =>
        useSessionSensoryEvents({ session, currentUserId: 'me', enabled, onEvent }),
      { initialProps: { session: baseline as SocialSessionState | null, enabled: false } },
    )

    // Flag off: a real transition arrives → silence.
    rerender({ session: advanced, enabled: false })
    expect(onEvent).not.toHaveBeenCalled()

    // Flag flips on with no new snapshot: baseline was tracked while disabled,
    // so there is no stale burst.
    rerender({ session: advanced, enabled: true })
    expect(onEvent).not.toHaveBeenCalled()

    // Next real transition with the flag on → events flow.
    rerender({ session: makeState({ currentPhase: 'lie_detective' }), enabled: true })
    expect(onEvent).toHaveBeenCalledTimes(1)
    expect(onEvent.mock.calls[0][0]).toMatchObject({ kind: 'phase_entered', phase: 'lie_detective' })
  })

  it('emits nothing when successive polls deliver identical content', () => {
    const onEvent = vi.fn()
    const first = makeState({ currentPhase: 'warmup', warmupReadyUserIds: ['a'] })
    const { rerender } = renderHook(
      ({ session }) => useSessionSensoryEvents({ session, currentUserId: 'me', enabled: true, onEvent }),
      { initialProps: { session: first as SocialSessionState | null } },
    )
    rerender({ session: makeState({ currentPhase: 'warmup', warmupReadyUserIds: ['a'] }) })
    rerender({ session: makeState({ currentPhase: 'warmup', warmupReadyUserIds: ['a'] }) })
    expect(onEvent).not.toHaveBeenCalled()
  })
})
