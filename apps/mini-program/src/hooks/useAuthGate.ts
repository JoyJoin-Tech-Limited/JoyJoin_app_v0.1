import { useEffect, useRef, useState } from 'react'
import { queryClient } from '../lib/api/queryClient'
import { AUTH_QUERY_KEY } from '../lib/api/authSession'
import { haptics } from '../lib/utils/haptics'
import { logInfo, logWarn } from '../lib/utils/logger'
import { authAnalytics } from '../lib/analytics/authAnalytics'
import type { UseAuthResult } from './useAuth'

/**
 * Hard ceiling on the visible auth-revalidation gate. Below the 8s
 * `AUTH_REQUEST_TIMEOUT_MS` in useAuth.ts so the gate always releases before
 * the query itself does, giving the user a manual escape hatch (the retry CTA)
 * instead of staring at a loader that may be silently retrying in the
 * background (retry × 8s timeout = up to ~27s worst case).
 */
export const INDEX_GATE_TIMEOUT_MS = 4_000

export interface UseAuthGateResult {
  /** Whether auth is still loading (fail-closed: true when auth is undefined). */
  isLoading: boolean
  /** Whether the hard timeout ceiling has been exceeded. */
  isTimedOut: boolean
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
 * After `INDEX_GATE_TIMEOUT_MS` (4s), `isTimedOut` flips to `true`, allowing
 * the page to surface retry / dismiss CTAs. Both CTAs emit `haptics('light')`
 * and `logInfo` for observability.
 *
 * @param auth — the return value of `useAuth()`. If `undefined`, treated as
 *   `isLoading: true` (fail-closed, Harness Reliability).
 */
export function useAuthGate(auth: UseAuthResult | undefined): UseAuthGateResult {
  const [gateTimedOut, setGateTimedOut] = useState(false)
  const [dismissed, setDismissed] = useState(false)
  const gateStartedAtRef = useRef<number | null>(null)

  const isLoading = !auth || (!dismissed && auth.isLoading)

  // Hard timeout for the visible auth gate. The React Query refetch can take
  // up to ~8s per attempt and retries up to 2x for non-transport errors
  // (worst case ~27s). Rather than let the user wait that long, release the
  // gate at INDEX_GATE_TIMEOUT_MS and show a retry CTA. The underlying
  // refetch continues; the redirect will fire normally if/when it succeeds.
  useEffect(() => {
    if (!isLoading) {
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
      setGateTimedOut(true)
    }, INDEX_GATE_TIMEOUT_MS)

    return () => clearTimeout(t)
  }, [isLoading])

  const retry = () => {
    haptics('light')
    logInfo('[IndexGate] User-initiated retry after gate timeout')
    authAnalytics.track('gate_retry')
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
    setDismissed(true)
    setGateTimedOut(false)
    // Force-resolve the gate: clear the isLoading signal by removing the
    // pending refetch. The cached user (if any) will determine whether
    // LandingPage or a redirect to nextStep renders.
    void queryClient.cancelQueries({ queryKey: AUTH_QUERY_KEY })
  }

  return { isLoading, isTimedOut: gateTimedOut, retry, dismiss }
}
