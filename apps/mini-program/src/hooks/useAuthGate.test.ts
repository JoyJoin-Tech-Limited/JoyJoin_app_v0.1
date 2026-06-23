import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useAuthGate, INDEX_GATE_TIMEOUT_MS } from './useAuthGate'
import type { UseAuthResult } from './useAuth'

import { queryClient } from '../lib/api/queryClient'
import { haptics } from '../lib/utils/haptics'
import { logInfo, logWarn } from '../lib/utils/logger'

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('../lib/api/queryClient', () => ({
  queryClient: {
    invalidateQueries: vi.fn().mockResolvedValue(undefined),
    cancelQueries: vi.fn().mockResolvedValue(undefined),
  },
}))

vi.mock('../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

vi.mock('../lib/utils/logger', () => ({
  logInfo: vi.fn(),
  logWarn: vi.fn(),
}))

// ── Helpers ──────────────────────────────────────────────────────────────────

const mockRefetch = vi.fn().mockResolvedValue(undefined)

function createAuth(overrides: Partial<UseAuthResult> = {}): UseAuthResult {
  return {
    user: undefined,
    isLoading: false,
    isAuthenticated: false,
    nextStep: undefined,
    refetch: mockRefetch,
    ...overrides,
  }
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('useAuthGate', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // AC-5 scenario 1: idle — gate reports loading while auth is in flight
  it('returns isLoading=true, isTimedOut=false when auth is loading (idle gate)', () => {
    const auth = createAuth({ isLoading: true })
    const { result } = renderHook(() => useAuthGate(auth))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isTimedOut).toBe(false)
    expect(result.current.retry).toBeTypeOf('function')
    expect(result.current.dismiss).toBeTypeOf('function')
  })

  // AC-5 scenario 2: loading → timeout — timer flips isTimedOut after 4s
  it('sets isTimedOut=true after INDEX_GATE_TIMEOUT_MS (loading→timeout)', () => {
    const auth = createAuth({ isLoading: true })
    const { result } = renderHook(() => useAuthGate(auth))

    expect(result.current.isTimedOut).toBe(false)

    act(() => {
      vi.advanceTimersByTime(INDEX_GATE_TIMEOUT_MS)
    })

    expect(result.current.isTimedOut).toBe(true)
    expect(logWarn).toHaveBeenCalledWith(
      '[IndexGate] Auth revalidation exceeded visible gate ceiling',
      { timeoutMs: INDEX_GATE_TIMEOUT_MS },
    )
  })

  // AC-5 scenario 3: retry — invalidateQueries + reset isTimedOut
  it('retry calls invalidateQueries, haptics, logInfo, and resets isTimedOut', () => {
    const auth = createAuth({ isLoading: true })
    const { result } = renderHook(() => useAuthGate(auth))

    // Advance to timeout first
    act(() => {
      vi.advanceTimersByTime(INDEX_GATE_TIMEOUT_MS)
    })
    expect(result.current.isTimedOut).toBe(true)

    act(() => {
      result.current.retry()
    })

    expect(haptics).toHaveBeenCalledWith('light')
    expect(logInfo).toHaveBeenCalledWith('[IndexGate] User-initiated retry after gate timeout')
    expect(queryClient.invalidateQueries).toHaveBeenCalledWith({ queryKey: ['mini-program', 'auth-user'] })
    expect(result.current.isTimedOut).toBe(false)
  })

  // AC-5 scenario 4: dismiss — cancelQueries + reset isTimedOut
  it('dismiss calls cancelQueries, haptics, logInfo, and resets isTimedOut', () => {
    const auth = createAuth({ isLoading: true })
    const { result } = renderHook(() => useAuthGate(auth))

    // Advance to timeout first
    act(() => {
      vi.advanceTimersByTime(INDEX_GATE_TIMEOUT_MS)
    })
    expect(result.current.isTimedOut).toBe(true)

    act(() => {
      result.current.dismiss()
    })

    expect(haptics).toHaveBeenCalledWith('light')
    expect(logInfo).toHaveBeenCalledWith('[IndexGate] User dismissed gate — proceeding with cached auth state')
    expect(queryClient.cancelQueries).toHaveBeenCalledWith({ queryKey: ['mini-program', 'auth-user'] })
    expect(result.current.isTimedOut).toBe(false)
  })

  // AC-6: auth===undefined → fail-closed (isLoading=true)
  it('treats auth=undefined as isLoading=true (fail-closed)', () => {
    const { result } = renderHook(() => useAuthGate(undefined))

    expect(result.current.isLoading).toBe(true)
    expect(result.current.isTimedOut).toBe(false)
  })

  // Edge: when auth transitions from loading→loaded, timeout clears
  it('clears timeout and resets isTimedOut when loading ends mid-gate', () => {
    const auth = createAuth({ isLoading: true })
    const { result, rerender } = renderHook(
      (props: { auth: UseAuthResult | undefined }) => useAuthGate(props.auth),
      { initialProps: { auth } },
    )

    // Advance partway through the timeout
    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(result.current.isTimedOut).toBe(false)

    // Auth resolves before the 4s ceiling
    rerender({ auth: createAuth({ isLoading: false }) })

    expect(result.current.isLoading).toBe(false)
    expect(result.current.isTimedOut).toBe(false)

    // Advance past the old timeout — should NOT fire (cleanup ran)
    act(() => {
      vi.advanceTimersByTime(INDEX_GATE_TIMEOUT_MS)
    })
    expect(result.current.isTimedOut).toBe(false)
    // logWarn should only have been called if timeout fired — it did not
    expect(logWarn).not.toHaveBeenCalled()
  })
})
