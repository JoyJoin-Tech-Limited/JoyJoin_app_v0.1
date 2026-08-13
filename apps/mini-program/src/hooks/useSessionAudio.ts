import { useCallback, useEffect, useRef } from 'react'
import type { SocialHapticPattern } from '../lib/utils/haptics'
import { createSessionAudioPlayer, type SessionAudioPlayer } from '../lib/utils/sessionAudio'

// ─── S9 audio seasoning — session hook (2026-08-12) ──────────────────────────
//
// Owns the player lifecycle: created + preloaded when the flag is on, torn
// down on unmount/flag-off. The page's haptic dispatch points play audio via
// playPattern AFTER the haptic fired (socialHaptics returns the busy-guard
// verdict) — this hook never decides WHAT to play, only HOW.

export interface UseSessionAudioResult {
  /** Play the mirroring track for a pattern. Returns whether audio played. */
  playPattern: (pattern: SocialHapticPattern) => boolean
}

export function useSessionAudio(enabled: boolean): UseSessionAudioResult {
  const playerRef = useRef<SessionAudioPlayer | null>(null)

  useEffect(() => {
    if (!enabled) return
    const player = createSessionAudioPlayer()
    player.prepare()
    playerRef.current = player
    return () => {
      player.destroy()
      playerRef.current = null
    }
  }, [enabled])

  const playPattern = useCallback((pattern: SocialHapticPattern): boolean => {
    return playerRef.current?.play(pattern) ?? false
  }, [])

  return { playPattern }
}
