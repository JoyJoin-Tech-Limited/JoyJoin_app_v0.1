import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useRejoinCatchUp } from '../hooks/useRejoinCatchUp'
import { REJOIN_CATCH_UP_CHIP_MS } from '../viewModels/rejoinCatchUpModel'
import type { SocialSessionState } from '@shared/socialIcebreaker'

/**
 * useRejoinCatchUp (sprint icebreaker-polish-p1, contract AC-02a): the two
 * rejoin edges + the ≤4s auto-dismiss + tap dismiss. Duty derivation itself
 * is locked in rejoinCatchUpModel.test.ts.
 */

const UNDERCOVER_DUTY_STATE = {
  phase: 'undercover_word',
  undercoverWordPair: { civilianWord: '火锅', undercoverWord: '麻辣烫', category: '美食' },
  undercoverWordRounds: [{ descriptions: [] }],
  undercoverWordCurrentRound: 1,
  undercoverWordRevealed: false,
} as unknown as SocialSessionState

describe('useRejoinCatchUp', () => {
  beforeEach(() => vi.useFakeTimers())
  afterEach(() => vi.useRealTimers())

  it('fires the chip once on bootstrap when the user owes a duty', () => {
    const { result, rerender } = renderHook(
      ({ session }) => useRejoinCatchUp({ session, currentUserId: 'u1' }),
      { initialProps: { session: UNDERCOVER_DUTY_STATE as SocialSessionState | null } },
    )
    expect(result.current.chipText).toBe('现在：第 2 轮描述中 · 你还没描述')

    // Polls keep arriving with the same logical state (fresh object identity
    // each tick) — the bootstrap edge must not re-fire.
    rerender({ session: { ...UNDERCOVER_DUTY_STATE } as SocialSessionState | null })
    expect(result.current.chipText).toBe('现在：第 2 轮描述中 · 你还没描述')
  })

  it('stays silent on bootstrap when the user owes nothing', () => {
    const { result } = renderHook(() =>
      useRejoinCatchUp({
        session: { phase: 'micro_challenge', currentChallenge: null } as unknown as SocialSessionState,
        currentUserId: 'u1',
      }),
    )
    expect(result.current.chipText).toBeNull()
  })

  it('fires on the away→back edge (leftUserIds drops the user)', () => {
    const awayState = {
      ...UNDERCOVER_DUTY_STATE,
      leftUserIds: ['u1'],
    } as unknown as SocialSessionState
    const backState = {
      ...UNDERCOVER_DUTY_STATE,
      leftUserIds: [],
    } as unknown as SocialSessionState

    const { result, rerender } = renderHook(
      ({ session }) => useRejoinCatchUp({ session, currentUserId: 'u1' }),
      { initialProps: { session: awayState as SocialSessionState | null } },
    )
    // Bootstrap already consumed the first snapshot (chip shown once).
    expect(result.current.chipText).toBe('现在：第 2 轮描述中 · 你还没描述')
    act(() => {
      result.current.dismissChip()
    })
    expect(result.current.chipText).toBeNull()

    // Server reports the user back → the chip re-fires.
    rerender({ session: backState as SocialSessionState | null })
    expect(result.current.chipText).toBe('现在：第 2 轮描述中 · 你还没描述')
  })

  it('flag off (leftUserIds absent) never fires the away edge', () => {
    const noField = { ...UNDERCOVER_DUTY_STATE } as Record<string, unknown>
    delete noField.leftUserIds
    const { result, rerender } = renderHook(
      ({ session }) => useRejoinCatchUp({ session, currentUserId: 'u1' }),
      { initialProps: { session: noField as unknown as SocialSessionState | null } },
    )
    act(() => result.current.dismissChip())
    // Same-shape polls without the field — no edge, no chip.
    rerender({ session: { ...noField } as unknown as SocialSessionState | null })
    expect(result.current.chipText).toBeNull()
  })

  it('auto-dismisses inside the ≤4s window and supports tap dismiss', () => {
    const { result } = renderHook(() =>
      useRejoinCatchUp({ session: UNDERCOVER_DUTY_STATE, currentUserId: 'u1' }),
    )
    expect(result.current.chipText).not.toBeNull()
    act(() => {
      vi.advanceTimersByTime(REJOIN_CATCH_UP_CHIP_MS + 1)
    })
    expect(result.current.chipText).toBeNull()
    expect(REJOIN_CATCH_UP_CHIP_MS).toBeLessThanOrEqual(4000)
  })
})
