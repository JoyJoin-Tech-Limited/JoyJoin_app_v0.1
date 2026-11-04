import { useCallback, useEffect, useRef, useState } from 'react'
import type { WelcomeCouponResponse } from '@shared/api'
import { resolveWelcomeGiftError, type WelcomeGiftErrorState } from './welcomeGiftError'

interface UseWelcomeGiftClaimOptions {
  enabled: boolean
  claim: () => Promise<WelcomeCouponResponse>
  onError: (error: WelcomeGiftErrorState) => void
}

/**
 * Progressive welcome-gift claim with one live request and identity-checked
 * settlement. Completion/navigation never depends on this hook.
 */
export function useWelcomeGiftClaim({ enabled, claim, onError }: UseWelcomeGiftClaimOptions) {
  const [coupon, setCoupon] = useState<WelcomeCouponResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<WelcomeGiftErrorState | null>(null)
  const [attempt, setAttempt] = useState(0)
  const requestRef = useRef<Promise<WelcomeCouponResponse> | null>(null)
  const mountedRef = useRef(true)
  const claimRef = useRef(claim)
  const onErrorRef = useRef(onError)
  claimRef.current = claim
  onErrorRef.current = onError

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (!enabled || coupon || requestRef.current) return

    setIsLoading(true)
    setError(null)
    const request = claimRef.current()
    requestRef.current = request

    request
      .then((nextCoupon) => {
        if (!mountedRef.current || requestRef.current !== request) return
        setCoupon(nextCoupon)
      })
      .catch((reason) => {
        if (!mountedRef.current || requestRef.current !== request) return
        const giftError = resolveWelcomeGiftError(reason)
        setError(giftError)
        onErrorRef.current(giftError)
      })
      .finally(() => {
        if (requestRef.current !== request) return
        requestRef.current = null
        if (mountedRef.current) setIsLoading(false)
      })
  }, [enabled, coupon, attempt])

  const retry = useCallback(() => {
    if (!enabled || coupon || requestRef.current) return
    setError(null)
    setAttempt((current) => current + 1)
  }, [enabled, coupon])

  return { coupon, isLoading, error, retry }
}
