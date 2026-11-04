import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { WelcomeCouponResponse } from '@shared/api'
import { useWelcomeGiftClaim } from './useWelcomeGiftClaim'

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function coupon(id: string): WelcomeCouponResponse {
  return {
    id,
    code: 'WELCOME20',
    discountType: 'fixed_amount',
    discountValue: 2000,
    source: 'profile_review_first_view',
    isNewlyAwarded: false,
    createdAt: '2026-10-30T00:00:00.000Z',
    validUntil: null,
  }
}

describe('useWelcomeGiftClaim', () => {
  it('keeps retries single-flight and lets only the next settled claim own the UI', async () => {
    const first = deferred<WelcomeCouponResponse>()
    const second = deferred<WelcomeCouponResponse>()
    const claim = vi.fn()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)
    const onError = vi.fn()
    const { result } = renderHook(() => useWelcomeGiftClaim({
      enabled: true,
      claim,
      onError,
    }))

    await act(async () => {
      await Promise.resolve()
    })
    expect(claim).toHaveBeenCalledTimes(1)
    expect(result.current.isLoading).toBe(true)

    act(() => {
      result.current.retry()
      result.current.retry()
      result.current.retry()
    })
    expect(claim).toHaveBeenCalledTimes(1)

    await act(async () => {
      first.reject(new Error('offline'))
      await Promise.resolve()
    })
    expect(result.current.isLoading).toBe(false)
    expect(result.current.error?.diagnostics.category).toBe('offline')
    expect(onError).toHaveBeenCalledTimes(1)

    act(() => {
      result.current.retry()
    })
    await act(async () => {
      await Promise.resolve()
    })
    expect(claim).toHaveBeenCalledTimes(2)
    expect(result.current.isLoading).toBe(true)
    expect(result.current.error).toBeNull()

    await act(async () => {
      second.resolve(coupon('latest-coupon'))
      await Promise.resolve()
    })
    expect(result.current.coupon?.id).toBe('latest-coupon')
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)

    act(() => {
      result.current.retry()
    })
    expect(claim).toHaveBeenCalledTimes(2)
  })
})
