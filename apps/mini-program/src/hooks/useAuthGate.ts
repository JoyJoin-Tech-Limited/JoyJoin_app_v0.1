import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { queryClient } from '../lib/api/queryClient'
import { AUTH_QUERY_KEY } from '../lib/api/authSession'
import { haptics } from '../lib/utils/haptics'
import { logInfo, logWarn } from '../lib/utils/logger'
import { authAnalytics } from '../lib/analytics/authAnalytics'
import type { UseAuthResult } from './useAuth'

/**
 * Ceiling on the visible auth-revalidation gate. Reduced to 2.5s so the user
 * sees timeout feedback sooner than the 8s `AUTH_REQUEST_TIMEOUT_MS` in
 * useAuth.ts. Once the gate fires, `isTimedOut` stays true until the user
 * explicitly retries or dismisses — the timeout banner does NOT auto-disappear
 * when the underlying auth query eventually fails silently.
 */
export const INDEX_GATE_TIMEOUT_MS = 2_500

export interface UseAuthGateResult {
  /** Whether auth is still loading (fail-closed: true when auth is undefined). */
  isLoading: boolean
  /** Whether the hard timeout ceiling has been exceeded. */
  isTimedOut: boolean
  /** Whether the device is completely offline (networkType === 'none'). */
  isOffline: boolean
  /** Invalidate the auth query and reset the timeout. */
  retry: () => void
  /** Cancel the in-flight auth query and force-resolve with cached state. */
  dismiss: () => void
}

/**
 * Cold-start auth gate for the index landing page.
 *
 * While auth is re-validating on cold start, this hook exposes an `isLoading`
 * flag that gates the landing page behind a loading state, preventing users
 * from racing the in-flight revalidation by tapping a CTA.
 *
 * After `INDEX_GATE_TIMEOUT_MS` (2.5s), `isTimedOut` flips to `true` and stays
 * sticky until auth succeeds or the user explicitly retries/dismisses. Both
 * CTAs emit `haptics('light')` and `logInfo` for observability.
 *
 * @param auth — the return value of `useAuth()`. If `undefined`, treated as
 *   `isLoading: true` (fail-closed, Harness Reliability).
 */
export function useAuthGate(auth: UseAuthResult | undefined): UseAuthGateResult {
  const [gateTimedOut, setGateTimedOut] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const [isOffline, setIsOffline] = useState(false)
  const gateStartedAtRef = useRef<number | null>(null)
  /** Once the gate timer fires, stay in timed-out state until auth succeeds
   *  or the user explicitly retries/dismisses. This prevents the timeout
   *  banner from silently disappearing when the auth query fails at 8s. */
  const timerHasFiredRef = useRef(false)

  // Detect offline state on mount. When completely offline the auth query
  // fails instantly (transport error, no retry), which would make isLoading
  // flip to false before the gate timeout can arm. Detecting offline here
  // gives the LandingPage an explicit signal to show a targeted error UI
  // instead of silently releasing an unguarded CTA.
  useEffect(() => {
    if (typeof Taro.getNetworkType !== 'function') return
    Taro.getNetworkType().then((res) => {
      if (res.networkType === 'none') {
        setIsOffline(true)
      }
    }).catch(() => {
      // Fail open — assume online
    })
  }, [])

  // When offline, release the gate immediately (isLoading = false) so the
  // landing page can render the offline error UI instead of the loading gate.
  const isLoading = !auth || (!dismissed && !isOffline && auth.isLoading)

  // Gate timer with sticky timeout: once the timer fires, isTimedOut stays
  // true until auth resolves successfully (user available) or the user
  // explicitly retries or dismisses. This gives the user a persistent escape
  // hatch instead of a banner that auto-disappears when the query fails.
  useEffect(() => {
    // Once the timer has fired, only clear on auth success or user action.
    if (timerHasFiredRef.current) {
      if (!isLoading && auth?.user) {
        // Auth succeeded — clear timeout state and return to normal
        timerHasFiredRef.current = false
        setGateTimedOut(false)
        gateStartedAtRef.current = null
      }
      // Otherwise stay timed out — the user must tap retry or dismiss.
      return
    }

    if (!isLoading || isOffline) {
      setGateTimedOut(false)
      gateStartedAtRef.current = null
      return
    }

    gateStartedAtRef.current = Date.now()
    const t = setTimeout(() => {
      logWarn('[IndexGate] Auth revalidation exceeded visible gate ceiling', {
        timeoutMs: INDEX_GATE_TIMEOUT_MS,
      })
      authAnalytics.track('gate_timeout', { timeoutMs: INDEX_GATE_TIMEOUT_MS })
      timerHasFiredRef.current = true
      setGateTimedOut(true)
    }, INDEX_GATE_TIMEOUT_MS)

    return () => clearTimeout(t)
  }, [isLoading, isOffline, auth?.user])

  const retry = () => {
    haptics('light')
    logInfo('[IndexGate] User-initiated retry after gate timeout or offline')
    authAnalytics.track('gate_retry')
    // Re-check network when user taps retry after offline state
    if (typeof Taro.getNetworkType === 'function') {
      Taro.getNetworkType().then((res) => {
        if (res.networkType !== 'none') {
          setIsOffline(false)
        }
      }).catch(() => {
        // Fail open
      })
    }
    timerHasFiredRef.current = false
    setDismissed(false)
    setGateTimedOut(false)
    // Re-invalidate the auth query to force a fresh fetch. The gate will
    // re-arm and the timeout effect will reset.
    void queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
  }

  const dismiss = () => {
    haptics('light')
    logInfo('[IndexGate] User dismissed gate — proceeding with cached auth state')
    authAnalytics.track('gate_dismiss')
    timerHasFiredRef.current = false
    setDismissed(true)
    setGateTimedOut(false)
    // Force-resolve the gate: clear the isLoading signal by removing the
    // pending refetch. The cached user (if any) will determine whether
    // LandingPage or a redirect to nextStep renders.
    void queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEY })
  }

  return { isLoading, isTimedOut: gateTimedOut, isOffline, retry, dismiss }
}
