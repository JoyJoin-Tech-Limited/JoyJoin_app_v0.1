import Taro from '@tarojs/taro'

export type HapticType = 'light' | 'medium' | 'heavy' | 'success' | 'warning' | 'slotTick' | 'slotLand' | 'cardReveal'

const HAPTIC_STYLES: Record<Exclude<HapticType, 'warning' | 'slotTick' | 'slotLand' | 'cardReveal'>, 'light' | 'medium' | 'heavy'> = {
  light: 'light',
  medium: 'medium',
  heavy: 'heavy',
  success: 'heavy',
}

const SLOT_HAPTIC_MAP: Record<Extract<HapticType, 'slotTick' | 'slotLand' | 'cardReveal'>, { type: 'light' | 'medium' | 'heavy'; count: number }> = {
  slotTick: { type: 'light', count: 1 },
  slotLand: { type: 'medium', count: 1 },
  cardReveal: { type: 'heavy', count: 2 },
}

type VibrateApi = 'vibrateShort' | 'vibrateLong'

function canUseVibrateApi(apiName: VibrateApi): boolean {
  const api = apiName === 'vibrateShort' ? Taro.vibrateShort : Taro.vibrateLong
  if (typeof api !== 'function') return false

  // Some WeChat/Taro runtime bundles expose vibration but omit canIUse.
  // Feature detection must never make an optional effect block a primary CTA.
  if (typeof Taro.canIUse !== 'function') return true

  try {
    return Taro.canIUse(apiName)
  } catch {
    return true
  }
}

/**
 * Trigger haptic feedback. Silently fails if not supported.
 *
 * Usage:
 *   haptics('light')   // question answer tap
 *   haptics('medium')  // milestone reached
 *   haptics('heavy')   // completion
 *   haptics('success') // step completed successfully
 */
export function haptics(type: HapticType) {
  try {
    if (type === 'warning') {
      if (canUseVibrateApi('vibrateLong')) {
        Taro.vibrateLong()
      } else if (canUseVibrateApi('vibrateShort')) {
        Taro.vibrateShort({ type: 'heavy' })
      }
      return
    }

    if (!canUseVibrateApi('vibrateShort')) return

    if (type === 'slotTick' || type === 'slotLand' || type === 'cardReveal') {
      const config = SLOT_HAPTIC_MAP[type]
      for (let i = 0; i < config.count; i++) {
        Taro.vibrateShort({ type: config.type })
      }
      return
    }

    const style = HAPTIC_STYLES[type]
    Taro.vibrateShort({ type: style })
  } catch {
    // silently ignore
  }
}

// ─── Social-event haptic grammar (icebreaker fluid-UX S1, 2026-08-11) ────────
//
// Five learnable patterns mapped to *social* events (phase entered, your turn,
// action confirmed, group reveal, celebration) — never to raw UI taps; the
// UI-event `HapticType`s above stay untouched. Pattern waveforms live in the
// SOCIAL_HAPTIC_GRAMMAR config map so the playbook §10 ruling-3 degradation
// ladder (merge patterns, never complicate) is a config edit, not a rewrite.

export type SocialHapticPattern =
  | 'socialNudge'
  | 'socialHostNudge'
  | 'socialYourTurn'
  | 'socialConfirm'
  | 'socialReveal'
  | 'socialCelebration'

export type SocialHapticStep =
  | { kind: 'short'; type: 'light' | 'medium' | 'heavy' }
  | { kind: 'long' }
  | { kind: 'gap'; ms: number }

/** Minimum silence between two consecutive pulses so they stay distinguishable
 *  through fabric (squad-unboxing heartbeat precedent: ≥80ms). */
export const SOCIAL_HAPTIC_MIN_GAP_MS = 80

export const SOCIAL_HAPTIC_GRAMMAR: Record<SocialHapticPattern, readonly SocialHapticStep[]> = {
  // Something new — glance when ready. Single mid-weight tap.
  socialNudge: [{ kind: 'short', type: 'medium' }],
  // S7 silent rescue — host-private: two light taps, unmistakable from the
  // group Nudge (single mid tap). Only the host ever feels it; the group
  // never sees a thing.
  socialHostNudge: [
    { kind: 'short', type: 'light' },
    { kind: 'gap', ms: 90 },
    { kind: 'short', type: 'light' },
  ],
  // Your turn — personal, must never be mistakable. Heavy beat, light echo.
  socialYourTurn: [
    { kind: 'short', type: 'heavy' },
    { kind: 'gap', ms: 90 },
    { kind: 'short', type: 'light' },
  ],
  // Confirm — felt in the instant of touch, so eyes never verify.
  socialConfirm: [{ kind: 'short', type: 'light' }],
  // Reveal — the whole group at once. The only long buzz in the grammar.
  socialReveal: [{ kind: 'long' }],
  // Celebration — rare by design (recap arrival). Rising three-pulse cadence.
  socialCelebration: [
    { kind: 'short', type: 'heavy' },
    { kind: 'gap', ms: 90 },
    { kind: 'short', type: 'medium' },
    { kind: 'gap', ms: 120 },
    { kind: 'short', type: 'heavy' },
  ],
}

export type SocialHapticPulse = {
  /** Delay from pattern start (ms). */
  atMs: number
  step: Exclude<SocialHapticStep, { kind: 'gap' }>
}

/**
 * Pattern priorities for the busy guard. A higher-priority pattern PREEMPTS a
 * lower-priority sequence still playing (its unsounded pulses are cancelled);
 * equal-or-lower priority requests are dropped. Group-moment patterns outrank
 * personal ones, and Confirm ranks last — it is instant feedback, so a user's
 * own tap must never mask the Reveal that tap triggered. Config-level per
 * playbook §10 ruling-3 philosophy.
 */
export const SOCIAL_HAPTIC_PRIORITY: Record<SocialHapticPattern, number> = {
  socialCelebration: 4,
  socialReveal: 3,
  socialYourTurn: 2,
  socialNudge: 1,
  socialHostNudge: 1,
  socialConfirm: 0,
}

/** Physical buzz lengths (ms) the busy window must cover: WeChat vibrateLong
 *  runs ~400ms; a vibrateShort tap is a brief tick. Schedule delays alone
 *  understate occupancy — a Nudge 100ms into a 400ms Reveal would physically
 *  overlap without these. */
export const SOCIAL_HAPTIC_LONG_PULSE_MS = 400
export const SOCIAL_HAPTIC_SHORT_PULSE_MS = 30

/** Flatten a grammar pattern into timed pulses (pure — unit-testable without timers). */
export function planSocialHapticPattern(pattern: SocialHapticPattern): SocialHapticPulse[] {
  const pulses: SocialHapticPulse[] = []
  let atMs = 0
  for (const step of SOCIAL_HAPTIC_GRAMMAR[pattern]) {
    if (step.kind === 'gap') {
      atMs += step.ms
    } else {
      pulses.push({ atMs, step })
    }
  }
  return pulses
}

/** Total physical occupancy of a pattern (ms): schedule span PLUS the
 *  physical buzz length of the trailing pulse(s). */
export function socialHapticPatternDurationMs(pattern: SocialHapticPattern): number {
  const pulses = planSocialHapticPattern(pattern)
  let duration = 0
  for (const pulse of pulses) {
    const pulseEnd = pulse.atMs + (pulse.step.kind === 'long' ? SOCIAL_HAPTIC_LONG_PULSE_MS : SOCIAL_HAPTIC_SHORT_PULSE_MS)
    if (pulseEnd > duration) duration = pulseEnd
  }
  return duration
}

// Overlapping sequences merge into an undecodable buzz, so pattern requests
// are arbitrated by SOCIAL_HAPTIC_PRIORITY (haptic-fatigue guard; minimum
// re-fire discipline per iteration-plan §6 risks).
let socialHapticsBusyUntil = 0
let socialHapticsPlayingPriority = -1
let socialHapticsPendingTimers: Array<ReturnType<typeof setTimeout>> = []

function fireSocialHapticStep(step: SocialHapticPulse['step']): void {
  if (step.kind === 'long') {
    if (canUseVibrateApi('vibrateLong')) {
      Taro.vibrateLong()
    } else if (canUseVibrateApi('vibrateShort')) {
      Taro.vibrateShort({ type: 'heavy' })
    }
    return
  }
  if (!canUseVibrateApi('vibrateShort')) return
  Taro.vibrateShort({ type: step.type })
}

/**
 * Fire one social-grammar pattern. Silently no-ops when the vibration APIs are
 * unavailable. While another pattern is still playing, equal-or-lower priority
 * requests are dropped and higher-priority requests preempt (cancelling the
 * current sequence's unsounded pulses). Callers gate on the
 * icebreakerHapticGrammarEnabled feature flag — this function does not.
 */
export function socialHaptics(pattern: SocialHapticPattern): void {
  try {
    const now = Date.now()
    const priority = SOCIAL_HAPTIC_PRIORITY[pattern]
    if (now < socialHapticsBusyUntil && priority <= socialHapticsPlayingPriority) return

    // Preemption: cancel the lower-priority sequence's unsounded pulses.
    for (const timer of socialHapticsPendingTimers) {
      clearTimeout(timer)
    }
    socialHapticsPendingTimers = []

    const pulses = planSocialHapticPattern(pattern)
    if (pulses.length === 0) return

    socialHapticsBusyUntil = now + socialHapticPatternDurationMs(pattern) + SOCIAL_HAPTIC_MIN_GAP_MS
    socialHapticsPlayingPriority = priority

    for (const pulse of pulses) {
      if (pulse.atMs === 0) {
        fireSocialHapticStep(pulse.step)
      } else {
        const timer = setTimeout(() => {
          try {
            fireSocialHapticStep(pulse.step)
          } catch {
            // silently ignore
          }
        }, pulse.atMs)
        socialHapticsPendingTimers.push(timer)
      }
    }
  } catch {
    // silently ignore
  }
}
