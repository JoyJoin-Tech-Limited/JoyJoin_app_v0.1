import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import {
  SOCIAL_HAPTIC_GRAMMAR,
  SOCIAL_HAPTIC_LONG_PULSE_MS,
  SOCIAL_HAPTIC_MIN_GAP_MS,
  SOCIAL_HAPTIC_SHORT_PULSE_MS,
  planSocialHapticPattern,
  socialHaptics,
  socialHapticPatternDurationMs,
  type SocialHapticPattern,
} from './haptics'

const taroRuntime = vi.hoisted(() => ({
  vibrateShort: vi.fn(),
  vibrateLong: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: taroRuntime,
}))

const ALL_PATTERNS: SocialHapticPattern[] = [
  'socialNudge',
  'socialHostNudge',
  'socialYourTurn',
  'socialConfirm',
  'socialReveal',
  'socialCelebration',
]

// Monotonic fake clock. `vi.useFakeTimers()` re-anchors to the real wall clock
// on every install, so a per-test "+60s" would NOT clear the module-level busy
// window a previous test armed — the next test can start *earlier* than the
// previous busyUntil. An explicit ever-increasing base keeps tests ordered.
let fakeNow = 1_000_000

describe('social haptic grammar (S1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    fakeNow += 120_000
    vi.setSystemTime(fakeNow)
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('defines exactly the six social patterns', () => {
    expect(Object.keys(SOCIAL_HAPTIC_GRAMMAR).sort()).toEqual([...ALL_PATTERNS].sort())
  })

  it('keeps every gap between consecutive pulses at or above the 80ms fabric threshold', () => {
    for (const pattern of ALL_PATTERNS) {
      const pulses = planSocialHapticPattern(pattern)
      for (let i = 1; i < pulses.length; i++) {
        expect(pulses[i].atMs - pulses[i - 1].atMs).toBeGreaterThanOrEqual(SOCIAL_HAPTIC_MIN_GAP_MS)
      }
    }
  })

  it('keeps the six playback plans pairwise distinguishable', () => {
    const signatures = ALL_PATTERNS.map((pattern) =>
      JSON.stringify(
        planSocialHapticPattern(pattern).map((pulse) => [
          pulse.atMs,
          pulse.step.kind,
          pulse.step.kind === 'short' ? pulse.step.type : null,
        ]),
      ),
    )
    expect(new Set(signatures).size).toBe(ALL_PATTERNS.length)
  })

  it('maps Confirm to a single instant light pulse and Reveal to the only long buzz', () => {
    expect(planSocialHapticPattern('socialConfirm')).toEqual([
      { atMs: 0, step: { kind: 'short', type: 'light' } },
    ])
    expect(planSocialHapticPattern('socialReveal')).toEqual([{ atMs: 0, step: { kind: 'long' } }])
    for (const pattern of ALL_PATTERNS) {
      if (pattern === 'socialReveal') continue
      expect(planSocialHapticPattern(pattern).every((pulse) => pulse.step.kind === 'short')).toBe(true)
    }
  })

  it('plays Your-turn as heavy beat then light echo after the gap', () => {
    socialHaptics('socialYourTurn')
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)
    expect(taroRuntime.vibrateShort).toHaveBeenLastCalledWith({ type: 'heavy' })

    vi.advanceTimersByTime(SOCIAL_HAPTIC_MIN_GAP_MS - 1)
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(1000)
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(2)
    expect(taroRuntime.vibrateShort).toHaveBeenLastCalledWith({ type: 'light' })
  })

  it('plays the S7 host Nudge as two light taps — private, never the group Nudge', () => {
    // Double-light signature is pairwise-distinct from every other pattern,
    // most importantly from the group Nudge's single mid tap (S6 beats).
    expect(planSocialHapticPattern('socialHostNudge')).toEqual([
      { atMs: 0, step: { kind: 'short', type: 'light' } },
      { atMs: 90, step: { kind: 'short', type: 'light' } },
    ])
    expect(planSocialHapticPattern('socialHostNudge')).not.toEqual(planSocialHapticPattern('socialNudge'))

    socialHaptics('socialHostNudge')
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)
    expect(taroRuntime.vibrateShort).toHaveBeenLastCalledWith({ type: 'light' })

    vi.advanceTimersByTime(1000)
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(2)
    expect(taroRuntime.vibrateShort).toHaveBeenLastCalledWith({ type: 'light' })
  })

  it('drops a lower-priority pattern requested while another is still playing (busy guard)', () => {
    socialHaptics('socialCelebration')
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)

    // Immediately requested Nudge must be swallowed, not stacked.
    socialHaptics('socialNudge')
    vi.advanceTimersByTime(10)
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)

    // After the busy window expires, patterns fire again.
    vi.setSystemTime(Date.now() + socialHapticPatternDurationMs('socialCelebration') + SOCIAL_HAPTIC_MIN_GAP_MS + 1000)
    socialHaptics('socialNudge')
    expect(taroRuntime.vibrateShort).toHaveBeenLastCalledWith({ type: 'medium' })
  })

  it('lets Reveal preempt a Confirm that armed the busy window milliseconds earlier', () => {
    // The exact Verifier scenario: performSocialAction applies response state
    // (detector queues reveal_appeared) and fires socialConfirm in the same
    // tick — the actor must still feel the group Reveal.
    socialHaptics('socialConfirm')
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(50) // inside Confirm's busy window
    socialHaptics('socialReveal')
    expect(taroRuntime.vibrateLong).toHaveBeenCalledTimes(1)

    // …and the Reveal's own window now covers the full ~400ms physical buzz:
    // a Nudge arriving 100ms into it is dropped, not stacked on top.
    vi.advanceTimersByTime(100)
    socialHaptics('socialNudge')
    vi.advanceTimersByTime(10)
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)
  })

  it('cancels the unsounded pulses of a preempted lower-priority sequence', () => {
    socialHaptics('socialYourTurn') // heavy@0, light@90
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(1)

    vi.advanceTimersByTime(50) // light echo still pending
    socialHaptics('socialCelebration') // preempts
    vi.advanceTimersByTime(1000)

    // The preempted Your-turn light echo must never sound…
    expect(taroRuntime.vibrateShort).not.toHaveBeenCalledWith({ type: 'light' })
    // …while the Celebration cadence completes (its own heavy, medium, heavy).
    expect(taroRuntime.vibrateShort).toHaveBeenCalledWith({ type: 'heavy' })
    expect(taroRuntime.vibrateShort).toHaveBeenCalledWith({ type: 'medium' })
    // Your-turn heavy + Celebration's three pulses; the cancelled light echo
    // is the only pulse that never sounded.
    expect(taroRuntime.vibrateShort).toHaveBeenCalledTimes(4)
  })

  it('counts the physical buzz length in the busy window (vibrateLong ≈ 400ms)', () => {
    expect(socialHapticPatternDurationMs('socialReveal')).toBe(SOCIAL_HAPTIC_LONG_PULSE_MS)
    expect(socialHapticPatternDurationMs('socialConfirm')).toBe(SOCIAL_HAPTIC_SHORT_PULSE_MS)
    expect(socialHapticPatternDurationMs('socialYourTurn')).toBe(90 + SOCIAL_HAPTIC_SHORT_PULSE_MS)
  })

  it('falls back to a heavy short pulse when vibrateLong is unavailable', () => {
    const originalLong = taroRuntime.vibrateLong
    // @ts-expect-error runtime bundles may omit the API entirely
    taroRuntime.vibrateLong = undefined
    try {
      socialHaptics('socialReveal')
      expect(taroRuntime.vibrateShort).toHaveBeenCalledWith({ type: 'heavy' })
    } finally {
      taroRuntime.vibrateLong = originalLong
    }
  })

  it('never throws into the caller when the vibration bridge rejects', () => {
    taroRuntime.vibrateShort.mockImplementationOnce(() => {
      throw new Error('bridge down')
    })
    expect(() => socialHaptics('socialConfirm')).not.toThrow()
  })
})
