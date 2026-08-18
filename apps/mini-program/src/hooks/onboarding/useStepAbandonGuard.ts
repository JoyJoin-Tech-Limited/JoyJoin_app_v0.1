import { useDidHide, useDidShow } from '@tarojs/taro'
import { useCallback, useMemo, useRef } from 'react'
import { createAbandonGuard } from '../../lib/onboarding/abandonGuard'
import { useUnload } from '../useUnload'

/**
 * Fires `onAbandon` when the user leaves the page mid-step (swipe-back,
 * forward nav, app background, unload) — but never after `markCompleted()`,
 * so normal post-submit navigation doesn't false-positive. Idempotent per
 * page visit: useDidHide and the router-change unload shim can both fire for
 * one exit; only the first produces an event. Re-arms on useDidShow (a user
 * who swipes back in and leaves again abandons anew).
 *
 * Analytics-only: the callback must stay fire-and-forget.
 */
export function useStepAbandonGuard(onAbandon: () => void): { markCompleted: () => void } {
  const guardRef = useRef(createAbandonGuard())
  const onAbandonRef = useRef(onAbandon)
  onAbandonRef.current = onAbandon

  const fireAbandon = useCallback(() => {
    if (guardRef.current.shouldTrackAbandon()) {
      onAbandonRef.current()
    }
  }, [])

  useDidShow(() => {
    guardRef.current.reset()
  })
  useDidHide(fireAbandon)
  useUnload(fireAbandon)

  const markCompleted = useCallback(() => {
    guardRef.current.markCompleted()
  }, [])

  return useMemo(() => ({ markCompleted }), [markCompleted])
}
