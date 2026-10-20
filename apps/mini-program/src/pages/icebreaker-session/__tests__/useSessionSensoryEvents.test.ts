import { describe, expect, it, vi } from 'vitest'
import { renderHook } from '@testing-library/react'
import type { MiniScriptPresentedEvidence, PersonalityDiceChallenge, SocialSessionState } from '@shared/socialIcebreaker'
import {
  REVEAL_SOURCES,
  REVEAL_SOURCE_HAPTIC_PATTERNS,
  SENSORY_EVENT_HAPTIC_PATTERNS,
  diffSessionSensoryEvents,
  resolveSensoryEventHapticPattern,
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

describe('Wave 3 reveal grading (S7 分级降级 — notification-fatigue ladder)', () => {
  const event = (source: string | undefined): SessionSensoryEvent => ({
    kind: 'reveal_appeared',
    phase: 'warmup',
    source,
    at: 0,
  })

  it('classifies every reveal source in the ladder (ratchet — a new source must be graded here)', () => {
    for (const source of REVEAL_SOURCES) {
      expect(
        REVEAL_SOURCE_HAPTIC_PATTERNS[source.id],
        `reveal source '${source.id}' is missing an explicit grading in REVEAL_SOURCE_HAPTIC_PATTERNS`,
      ).toBeDefined()
    }
  })

  it('degrades pure-information reveals (new topic card, single-player reveal) to a mid-tap Nudge', () => {
    expect(resolveSensoryEventHapticPattern(event('warmup_topic'))).toBe('socialNudge')
    expect(resolveSensoryEventHapticPattern(event('lie_detective'))).toBe('socialNudge')
  })

  it('keeps action-changing reveals (truth / results / group sync) on the group-long Reveal', () => {
    for (const source of ['group_mirror', 'quip_battle', 'undercover_word', 'personality_dice']) {
      expect(resolveSensoryEventHapticPattern(event(source))).toBe('socialReveal')
    }
  })

  it('falls back to the kind map for an unclassified source (never a silent drop)', () => {
    expect(resolveSensoryEventHapticPattern(event('some_future_source'))).toBe(
      SENSORY_EVENT_HAPTIC_PATTERNS.reveal_appeared,
    )
  })

  it('resolves non-reveal kinds straight from the kind map, ignoring the source field', () => {
    expect(
      resolveSensoryEventHapticPattern({ kind: 'own_turn_started', phase: 'warmup', source: 'warmup_topic', at: 0 }),
    ).toBe('socialYourTurn')
    expect(resolveSensoryEventHapticPattern({ kind: 'recap_started', phase: 'recap', at: 0 })).toBe('socialCelebration')
    expect(resolveSensoryEventHapticPattern({ kind: 'phase_entered', phase: 'warmup', at: 0 })).toBe('socialNudge')
    expect(resolveSensoryEventHapticPattern({ kind: 'all_ready', phase: 'warmup', at: 0 })).toBe('socialNudge')
  })
})

describe('Wave 3 mini_script presenter turn source', () => {
  function makeEvidence(
    presentedBy: string,
    presentedAt: number,
    readConfirmedAt?: number,
  ): MiniScriptPresentedEvidence {
    return {
      evidenceId: `e-${presentedBy}-${presentedAt}`,
      targetRoleSlot: 1,
      presentedBy,
      actNo: 1,
      presentedAt,
      ...(readConfirmedAt === undefined ? {} : { readConfirmedAt }),
    }
  }

  it('fires own_turn_started when the latest unconfirmed evidence becomes the viewer\'s to read aloud', () => {
    const events = diffSessionSensoryEvents(
      makeState({ currentPhase: 'mini_script' }),
      makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [makeEvidence('me', 100)] }),
      { currentUserId: 'me' },
    )
    expect(kinds(events)).toEqual(['own_turn_started'])
    expect(events[0].source).toBe('mini_script')
  })

  it('stays silent when the presenter is someone else, and while the floor stays the viewer\'s', () => {
    const ctx = { currentUserId: 'me' }
    // Someone else's presentation → no personal beat.
    expect(
      diffSessionSensoryEvents(
        makeState({ currentPhase: 'mini_script' }),
        makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [makeEvidence('u2', 100)] }),
        ctx,
      ),
    ).toEqual([])
    // Floor stays mine → no re-fire.
    expect(
      diffSessionSensoryEvents(
        makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [makeEvidence('me', 100)] }),
        makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [makeEvidence('me', 100)] }),
        ctx,
      ),
    ).toEqual([])
  })

  it('passes the floor to the newest unconfirmed presenter and back', () => {
    const ctx = { currentUserId: 'me' }
    const mineFirst = makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [makeEvidence('me', 100)] })
    const theirs = makeState({
      currentPhase: 'mini_script',
      miniScriptPresentedEvidence: [makeEvidence('me', 100), makeEvidence('u2', 200)],
    })
    // A newer presentation by u2 takes the floor — no beat for me.
    expect(diffSessionSensoryEvents(mineFirst, theirs, ctx)).toEqual([])
    // …and when I present again after theirs, the floor returns → beat.
    const mineAgain = makeState({
      currentPhase: 'mini_script',
      miniScriptPresentedEvidence: [makeEvidence('me', 100), makeEvidence('u2', 200), makeEvidence('me', 300)],
    })
    expect(kinds(diffSessionSensoryEvents(theirs, mineAgain, ctx))).toEqual(['own_turn_started'])
  })

  it('clears the floor on readConfirmedAt and re-arms for the next presentation', () => {
    const ctx = { currentUserId: 'me' }
    const pending = makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [makeEvidence('me', 100)] })
    const confirmed = makeState({
      currentPhase: 'mini_script',
      miniScriptPresentedEvidence: [makeEvidence('me', 100, 150)],
    })
    // Confirm lands → floor clears; nothing became mine, so no beat.
    expect(diffSessionSensoryEvents(pending, confirmed, ctx)).toEqual([])
    // A new presentation after the confirm → fresh beat.
    const next = makeState({
      currentPhase: 'mini_script',
      miniScriptPresentedEvidence: [makeEvidence('me', 100, 150), makeEvidence('me', 300)],
    })
    expect(kinds(diffSessionSensoryEvents(confirmed, next, ctx))).toEqual(['own_turn_started'])
  })

  it('resolves the floor by max presentedAt among unconfirmed entries, ignoring array order', () => {
    // Defensive: me@300 (unconfirmed) outranks u2@100 (unconfirmed) and
    // u2@200 (confirmed) regardless of array position — a confirmed latest
    // entry must NOT mask a fresher unconfirmed one.
    const next = makeState({
      currentPhase: 'mini_script',
      miniScriptPresentedEvidence: [makeEvidence('me', 300), makeEvidence('u2', 100), makeEvidence('u2', 200, 250)],
    })
    expect(
      kinds(diffSessionSensoryEvents(makeState({ currentPhase: 'mini_script' }), next, { currentUserId: 'me' })),
    ).toEqual(['own_turn_started'])
  })

  it('resolves no turn for pre-V2 sessions and never fires without viewer context', () => {
    expect(
      diffSessionSensoryEvents(
        makeState({ currentPhase: 'mini_script' }),
        makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [] }),
        { currentUserId: 'me' },
      ),
    ).toEqual([])
    expect(
      diffSessionSensoryEvents(
        makeState({ currentPhase: 'mini_script' }),
        makeState({ currentPhase: 'mini_script', miniScriptPresentedEvidence: [makeEvidence('me', 100)] }),
        {},
      ),
    ).toEqual([])
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
