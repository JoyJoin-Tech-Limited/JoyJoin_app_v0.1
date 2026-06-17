import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * Shows a transient reaction UI for a fixed duration after a trigger fires.
 * Used for celebratory Xiaoyue bubbles when the user makes a selection.
 *
 * @param durationMs how long the reaction stays visible (default 2200ms)
 * @returns [visible, trigger, hide] — current visibility, a function to start/restart the timer, and a function to hide immediately
 */
export function useReactionTimer(durationMs = 2200): [boolean, () => void, () => void] {
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const hide = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = null
    setVisible(false)
  }, [])

  const trigger = useCallback(() => {
    setVisible(true)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(hide, durationMs)
  }, [durationMs, hide])

  useEffect(() => {
    return hide
  }, [hide])

  return [visible, trigger, hide]
}
