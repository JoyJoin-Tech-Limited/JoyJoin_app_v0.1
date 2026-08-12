import { describe, expect, it } from 'vitest'
import type { WSMessage } from '@shared/wsEvents'
import {
  GROUP_BEAT_DETECTOR_SUPPRESS_MS,
  GROUP_BEAT_HAPTIC_PATTERNS,
  GroupBeatTracker,
  parseSocialGroupBeat,
} from '../viewModels/groupBeatModel'

function beatMessage(overrides: Record<string, unknown> = {}): WSMessage {
  return {
    type: 'SOCIAL_GROUP_BEAT',
    eventId: 'session_1',
    data: {
      sessionId: 'session_1',
      pattern: 'reveal',
      nonce: 'session_1:1000:1',
      sentAt: 1000,
      ...overrides,
    },
    timestamp: new Date(1000).toISOString(),
  } as WSMessage
}

describe('groupBeatModel — parseSocialGroupBeat', () => {
  it('accepts a well-formed beat for this session', () => {
    const beat = parseSocialGroupBeat(beatMessage(), 'session_1')
    expect(beat).toEqual({ sessionId: 'session_1', pattern: 'reveal', nonce: 'session_1:1000:1', sentAt: 1000 })
  })

  it('drops beats scoped to another session', () => {
    expect(parseSocialGroupBeat(beatMessage(), 'session_OTHER')).toBeNull()
    expect(parseSocialGroupBeat(beatMessage({ sessionId: 'session_2' }), 'session_1')).toBeNull()
  })

  it('drops malformed payloads and unknown patterns silently', () => {
    expect(parseSocialGroupBeat(beatMessage({ pattern: 'CONFETTI' }), 'session_1')).toBeNull()
    expect(parseSocialGroupBeat(beatMessage({ nonce: '' }), 'session_1')).toBeNull()
    expect(parseSocialGroupBeat(beatMessage({ nonce: 42 }), 'session_1')).toBeNull()
    expect(parseSocialGroupBeat(beatMessage({ sentAt: 'now' }), 'session_1')).toBeNull()
    expect(parseSocialGroupBeat({ ...beatMessage(), data: null } as unknown as WSMessage, 'session_1')).toBeNull()
    expect(parseSocialGroupBeat({ ...beatMessage(), type: 'ROOM_POKE' } as WSMessage, 'session_1')).toBeNull()
  })
})

describe('groupBeatModel — pattern mapping + nonce dedupe', () => {
  it('maps every beat pattern to an S1 haptic pattern', () => {
    expect(GROUP_BEAT_HAPTIC_PATTERNS).toEqual({
      nudge: 'socialNudge',
      reveal: 'socialReveal',
      celebration: 'socialCelebration',
    })
  })

  it('fires once per nonce and never twice', () => {
    const tracker = new GroupBeatTracker()
    const beat = parseSocialGroupBeat(beatMessage(), 'session_1')!
    expect(tracker.registerBeat(beat, 1000)).toBe('socialReveal')
    // Duplicate delivery / reconnect replay → swallowed.
    expect(tracker.registerBeat(beat, 1100)).toBeNull()
    // A fresh nonce fires again.
    const next = parseSocialGroupBeat(beatMessage({ nonce: 'session_1:2000:2', sentAt: 2000 }), 'session_1')!
    expect(tracker.registerBeat(next, 2000)).toBe('socialReveal')
  })

  it('bounds the nonce memory', () => {
    const tracker = new GroupBeatTracker()
    for (let i = 0; i < 80; i++) {
      tracker.registerBeat(parseSocialGroupBeat(beatMessage({ nonce: `n${i}` }), 'session_1')!, i)
    }
    // After eviction, the oldest nonce could re-fire — the window is 64, far
    // beyond a session's beat count (phases + reveals).
    expect(tracker.registerBeat(parseSocialGroupBeat(beatMessage({ nonce: 'n79' }), 'session_1')!, 100)).toBeNull()
  })

  it('reset() clears nonces and the suppression window for a new session', () => {
    const tracker = new GroupBeatTracker()
    tracker.registerBeat(parseSocialGroupBeat(beatMessage(), 'session_1')!, 10_000)
    expect(tracker.shouldSuppressDetectorFire('socialReveal', 11_000)).toBe(true)

    tracker.reset()
    // Stale suppression from the previous session is gone.
    expect(tracker.shouldSuppressDetectorFire('socialReveal', 11_000)).toBe(false)
    // The old nonce is forgotten — a duplicate delivery of the same beat
    // after reset would fire again (fresh room, fresh bookkeeping).
    const replayed = parseSocialGroupBeat(beatMessage({ sessionId: 'session_2' }), 'session_2')!
    expect(tracker.registerBeat(replayed, 12_000)).toBe('socialReveal')
  })
})

describe('groupBeatModel — detector suppression contract (no double-fire)', () => {
  it('suppresses a same-pattern detector fire inside the window, allows it after', () => {
    const tracker = new GroupBeatTracker()
    tracker.registerBeat(parseSocialGroupBeat(beatMessage(), 'session_1')!, 10_000)

    // Poll delivers the same reveal 3s later → suppressed (the beat buzzed it).
    expect(tracker.shouldSuppressDetectorFire('socialReveal', 13_000)).toBe(true)
    // Beyond the window a fresh detector fire is allowed again.
    expect(tracker.shouldSuppressDetectorFire('socialReveal', 10_000 + GROUP_BEAT_DETECTOR_SUPPRESS_MS + 1)).toBe(false)
  })

  it('suppresses only the matching pattern', () => {
    const tracker = new GroupBeatTracker()
    tracker.registerBeat(parseSocialGroupBeat(beatMessage({ pattern: 'nudge' }), 'session_1')!, 10_000)
    expect(tracker.shouldSuppressDetectorFire('socialNudge', 11_000)).toBe(true)
    expect(tracker.shouldSuppressDetectorFire('socialReveal', 11_000)).toBe(false)
    expect(tracker.shouldSuppressDetectorFire('socialCelebration', 11_000)).toBe(false)
  })

  it('suppresses nothing when no beat ever arrived (WS-down fallback path)', () => {
    const tracker = new GroupBeatTracker()
    expect(tracker.shouldSuppressDetectorFire('socialReveal', 500)).toBe(false)
  })
})
