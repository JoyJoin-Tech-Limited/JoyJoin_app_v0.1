import type { SocialGroupBeatData, SocialGroupBeatPattern, WSMessage } from '@shared/wsEvents'
import type { SocialHapticPattern } from '../../../lib/utils/haptics'

// ─── S6 group beats — client model (2026-08-12) ─────────────────────────────
//
// Pure/testable core of the mini-program side: payload validation, nonce
// dedupe, and the detector-suppression contract with the S1 poll fallback.
// Ruling 6: beats are state-free ("fire pattern X now"); the 3s poll remains
// the sole state truth; WS-down degrades to poll-detected beats — late,
// never missing.

/** Beat pattern → S1 haptic pattern. One record — re-mapping is config. */
export const GROUP_BEAT_HAPTIC_PATTERNS: Record<SocialGroupBeatPattern, SocialHapticPattern> = {
  nudge: 'socialNudge',
  reveal: 'socialReveal',
  celebration: 'socialCelebration',
}

/** Same-pattern detector suppression window (ms). Two full poll cycles
 *  (2 × 3000ms) plus margin: a poll-delivered transition that a beat already
 *  announced inside this window does not fire a second haptic. */
export const GROUP_BEAT_DETECTOR_SUPPRESS_MS = 6500

  /** Bounded nonce memory — a session emits O(phases + reveals) beats. */
  const MAX_SEEN_NONCES = 64

/** Validate a raw WS message as a beat for this session. Anything malformed,
 *  out-of-scope, or carrying an unknown pattern is dropped silently — beats
 *  are best-effort sensory triggers, never correctness. */
export function parseSocialGroupBeat(
  message: WSMessage,
  expectedSessionId: string,
): SocialGroupBeatData | null {
  if (message.type !== 'SOCIAL_GROUP_BEAT') return null
  const data = message.data as Partial<SocialGroupBeatData> | null | undefined
  if (!data || typeof data !== 'object') return null
  if (data.sessionId !== expectedSessionId) return null
  if (data.pattern !== 'nudge' && data.pattern !== 'reveal' && data.pattern !== 'celebration') {
    return null
  }
  if (typeof data.nonce !== 'string' || data.nonce.length === 0) return null
  if (typeof data.sentAt !== 'number' || !Number.isFinite(data.sentAt)) return null
  return data as SocialGroupBeatData
}

/** Bounded nonce dedupe + same-pattern suppression bookkeeping for the
 *  beat↔detector double-fire contract. */
export class GroupBeatTracker {
  private seenNonces: string[] = []
  private lastBeatAtByPattern = new Map<SocialHapticPattern, number>()

  /**
   * Register an incoming beat. Returns the haptic pattern to fire, or null
   * when the nonce was already seen (duplicate delivery / reconnect replay).
   */
  registerBeat(beat: SocialGroupBeatData, now = Date.now()): SocialHapticPattern | null {
    if (this.seenNonces.includes(beat.nonce)) return null
    this.seenNonces.push(beat.nonce)
    if (this.seenNonces.length > MAX_SEEN_NONCES) {
      this.seenNonces.splice(0, this.seenNonces.length - MAX_SEEN_NONCES)
    }
    const pattern = GROUP_BEAT_HAPTIC_PATTERNS[beat.pattern]
    this.lastBeatAtByPattern.set(pattern, now)
    return pattern
  }

  /**
   * Detector-suppression contract: when a same-pattern group beat fired
   * within the window, the S1 poll detector's haptic for the matching sensory
   * event is suppressed (the beat already buzzed this moment). Only haptics
   * are suppressed — the S2 reveal bloom still keys off the detector.
   */
  shouldSuppressDetectorFire(pattern: SocialHapticPattern, now = Date.now()): boolean {
    const lastBeatAt = this.lastBeatAtByPattern.get(pattern)
    if (lastBeatAt === undefined) return false
    return now - lastBeatAt < GROUP_BEAT_DETECTOR_SUPPRESS_MS
  }

  /** Clear all bookkeeping — call when the page binds a different session so
   *  a stale session's nonces/suppression window can never leak into the new
   *  room. */
  reset(): void {
    this.seenNonces = []
    this.lastBeatAtByPattern.clear()
  }
}
