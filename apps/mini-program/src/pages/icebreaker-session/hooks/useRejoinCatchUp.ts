import { useCallback, useEffect, useRef, useState } from 'react'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import {
  REJOIN_CATCH_UP_CHIP_MS,
  resolveRejoinCatchUpText,
} from '../viewModels/rejoinCatchUpModel'

export interface UseRejoinCatchUpArgs {
  session: SocialSessionState | null
  currentUserId: string
}

export interface RejoinCatchUp {
  /** Chip text to render; null when nothing should show. */
  chipText: string | null
  /** Tap dismiss (the chip also auto-dismisses within ≤4s). */
  dismissChip: () => void
}

/**
 * useRejoinCatchUp (sprint icebreaker-polish-p1, contract AC-02a).
 *
 * Fires the ≤4s catch-up chip on two rejoin edges, both gated on the pure
 * `resolveRejoinCatchUpText` derivation (phase chip-eligible AND the user
 * has an outstanding obligation — the chip never fabricates urgency):
 *
 *  1. Away→back edge: the server-owned `leftUserIds` drops the current user
 *     (flag-gated field; absent → the edge never fires, matching the
 *     flag-off rendering rule).
 *  2. Bootstrap: the first live session snapshot after a cold re-entry
 *     (强杀重进) with the phase already past waiting.
 *
 * One-shot per edge; the chip dismisses itself inside
 * REJOIN_CATCH_UP_CHIP_MS (≤4s contract) or on tap.
 */
export function useRejoinCatchUp({ session, currentUserId }: UseRejoinCatchUpArgs): RejoinCatchUp {
  const [chipText, setChipText] = useState<string | null>(null)
  const bootstrappedRef = useRef(false)
  const prevServerAwayRef = useRef<boolean | undefined>(undefined)
  const dismissTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)

  const clearDismissTimer = useCallback(() => {
    if (dismissTimerRef.current) {
      clearTimeout(dismissTimerRef.current)
      dismissTimerRef.current = undefined
    }
  }, [])

  const showChip = useCallback(
    (text: string | null) => {
      if (!text) return
      clearDismissTimer()
      setChipText(text)
      dismissTimerRef.current = setTimeout(() => {
        dismissTimerRef.current = undefined
        setChipText(null)
      }, REJOIN_CATCH_UP_CHIP_MS)
    },
    [clearDismissTimer],
  )

  const dismissChip = useCallback(() => {
    clearDismissTimer()
    setChipText(null)
  }, [clearDismissTimer])

  // Edge 1+2: bootstrap (first live snapshot) and the away→back transition.
  useEffect(() => {
    if (!session) return

    if (!bootstrappedRef.current) {
      bootstrappedRef.current = true
      prevServerAwayRef.current = session.leftUserIds?.includes(currentUserId)
      showChip(resolveRejoinCatchUpText(session, currentUserId))
      return
    }

    const serverAway = session.leftUserIds?.includes(currentUserId)
    if (prevServerAwayRef.current === true && serverAway === false) {
      showChip(resolveRejoinCatchUpText(session, currentUserId))
    }
    prevServerAwayRef.current = serverAway
  }, [session, currentUserId, showChip])

  useEffect(() => clearDismissTimer, [clearDismissTimer])

  return { chipText, dismissChip }
}
