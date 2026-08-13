import Taro from '@tarojs/taro'
import type { SocialHapticPattern } from './haptics'
import { cdnAsset } from './cdnAssets'

// ─── S9 audio seasoning (2026-08-12) ─────────────────────────────────────────
//
// Delicate sub-1s ticks mirroring the S1 haptic grammar one-to-one (playbook
// §3.1: "haptics carry meaning → visuals are glanceable backup → audio is
// seasoning"). Hard lines: audio NEVER substitutes for a haptic pattern
// (haptics-alone completeness is inviolable, ruling 3); no spatial audio
// (platform impossibility, §4); silent mode loses zero meaning.
//
// The haptic stays the authority: dispatch points fire the haptic FIRST and
// play audio only when socialHaptics returns true (same busy-guard verdict),
// so the two channels can never diverge.

/** Delicate default — layered UNDER the room's ambience, never on top of it. */
export const AUDIO_TRACK_VOLUME = 0.4

/** Sub-1s hard bound for every track (playbook: "delicate sub-1s ticks"). */
export const AUDIO_MAX_TRACK_MS = 800

/**
 * Pattern → track id. ONE config record — re-mapping sound↔pattern is a
 * config edit (playbook ruling-3 philosophy). `socialHostNudge` maps to its
 * own track so the private rescue never sounds like the group Nudge.
 */
export const AUDIO_PATTERN_TRACK: Record<SocialHapticPattern, string> = {
  socialNudge: 'nudge',
  socialHostNudge: 'host-nudge',
  socialYourTurn: 'your-turn',
  socialConfirm: 'confirm',
  socialReveal: 'reveal',
  socialCelebration: 'celebration',
}

/** Track id → CDN asset path (cdnAsset resolves TARO_APP_CDN_BASE_URL). */
export const AUDIO_TRACK_PATHS: Record<string, string> = {
  nudge: '/assets/audio/s1-nudge.wav',
  'host-nudge': '/assets/audio/s1-host-nudge.wav',
  'your-turn': '/assets/audio/s1-your-turn.wav',
  confirm: '/assets/audio/s1-confirm.wav',
  reveal: '/assets/audio/s1-reveal.wav',
  celebration: '/assets/audio/s1-celebration.wav',
}

export interface SessionAudioPlayer {
  /** Preload every track's context once (bounded: exactly one per track). */
  prepare: () => void
  /** Fire one track. Returns false when the player is destroyed or the
   *  bridge threw — never throws into the sensory pipeline. */
  play: (pattern: SocialHapticPattern) => boolean
  /** Tear down every context (session exit / flag-off). */
  destroy: () => void
}

export function createSessionAudioPlayer(): SessionAudioPlayer {
  const contexts = new Map<string, Taro.InnerAudioContext>()
  let destroyed = false

  const ensureContext = (trackId: string): Taro.InnerAudioContext | null => {
    if (destroyed) return null
    const existing = contexts.get(trackId)
    if (existing) return existing
    try {
      const ctx = Taro.createInnerAudioContext()
      ctx.src = cdnAsset(AUDIO_TRACK_PATHS[trackId])
      ctx.volume = AUDIO_TRACK_VOLUME
      contexts.set(trackId, ctx)
      return ctx
    } catch {
      return null
    }
  }

  return {
    prepare: () => {
      for (const trackId of new Set(Object.values(AUDIO_PATTERN_TRACK))) {
        ensureContext(trackId)
      }
    },
    play: (pattern: SocialHapticPattern) => {
      if (destroyed) return false
      const trackId = AUDIO_PATTERN_TRACK[pattern]
      try {
        const ctx = ensureContext(trackId)
        if (!ctx) return false
        // stop() first so rapid re-fires never stack over each other.
        ctx.stop()
        ctx.play()
        return true
      } catch {
        return false
      }
    },
    destroy: () => {
      destroyed = true
      for (const ctx of contexts.values()) {
        try {
          ctx.destroy()
        } catch {
          // ignore — teardown is best-effort
        }
      }
      contexts.clear()
    },
  }
}
