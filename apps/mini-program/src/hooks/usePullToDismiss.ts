import { useCallback, useRef } from 'react'

/**
 * usePullToDismiss (2026-08-31) — swipe-down-to-dismiss for bottom-sheet
 * chrome. Extracted from TablemateDetailSheet's inline gesture (handle +
 * hero) so every info-overlay-family sheet shares one implementation.
 *
 * Attach the returned handlers to the NON-scroll chrome only (drag handle,
 * title row, hero) — never to a ScrollView body, where the gesture would
 * fight normal scrolling.
 */
export function usePullToDismiss(onDismiss: () => void): {
  onTouchStart: (event: any) => void
  onTouchEnd: (event: any) => void
} {
  const pullStartYRef = useRef<number | null>(null)

  const onTouchStart = useCallback((event: any) => {
    pullStartYRef.current = event.touches?.[0]?.clientY ?? null
  }, [])

  const onTouchEnd = useCallback(
    (event: any) => {
      const startY = pullStartYRef.current
      pullStartYRef.current = null
      if (startY == null) return
      const endY = event.changedTouches?.[0]?.clientY
      if (typeof endY === 'number' && endY - startY > 60) {
        onDismiss()
      }
    },
    [onDismiss],
  )

  return { onTouchStart, onTouchEnd }
}
