import { act, render } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import type { PoolGroupMemberSummary } from '@shared/api'
import SquadDeckStage from './SquadDeckStage'
import { computeDealTotalMs } from './squadDealTiming'
import {
  computeUnflippedCount,
  createSquadFlipSession,
  type SquadFlipSessionDeps,
} from './squadFlipState'

// A1 (QA RISK-1): if the app is backgrounded mid-deal, the deal timers never
// fire and — before the fix — the resetSignal re-entry path force-settled the
// deck WITHOUT notifying the controller. The flip session then kept
// visibleIds=[] / interactive=false, so the hint chip no-oped, all_revealed
// never fired, and the 我 auto-flip was skipped. These tests pin the
// recovery: an interrupted deal that gets force-settled must seed the
// session exactly once (instant=true), and the session must then behave
// like a normal interactive session (chip works, all_revealed fires).

vi.mock('@tarojs/components', () => ({
  View: (props: Record<string, unknown>) => <div {...props} />,
  Text: (props: Record<string, unknown>) => <span {...props} />,
}))

vi.mock('../../lib/utils/haptics', () => ({
  haptics: vi.fn(),
}))

// Keep the test focused on the deck stage's settle logic — the card itself is
// locked by source assertions in TeammateCard.test.ts.
vi.mock('./TeammateCard', () => ({
  default: () => <div data-testid='teammate-card' />,
}))

const members = [
  { userId: 'me', displayName: '我' },
  { userId: 'u1', displayName: '豆沙' },
  { userId: 'u2', displayName: '阿浪' },
] as unknown as PoolGroupMemberSummary[]

function buildProps(overrides: Partial<Parameters<typeof SquadDeckStage>[0]> = {}) {
  return {
    members,
    currentUserId: 'me',
    viewerPairByMemberId: new Map(),
    focusedIndex: -1,
    reduceMotion: false,
    isDegradation: false,
    resetSignal: 0,
    flippedIds: new Set<string>(),
    flipDelayById: new Map<string, number>(),
    bestPartnerUserId: null,
    allRevealed: false,
    interactive: true,
    onDealSettled: vi.fn(),
    onCardTap: vi.fn(),
    onCardLongPress: vi.fn(),
    deckPhase: 'fan' as const,
    foldDelayById: new Map<string, number>(),
    unfoldDelayById: new Map<string, number>(),
    onFoldSettled: vi.fn(),
    onUnfoldSettled: vi.fn(),
    ...overrides,
  }
}

describe('SquadDeckStage — interrupted-deal recovery (A1)', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('seeds the controller exactly once when an interrupted deal is force-settled by resetSignal', () => {
    const props = buildProps()
    const view = render(<SquadDeckStage {...props} />)

    // Mid-flight: the anticipation beat has not even elapsed, so the deal has
    // definitely not settled.
    act(() => {
      vi.advanceTimersByTime(50)
    })
    expect(props.onDealSettled).not.toHaveBeenCalled()

    // Swipe-back re-entry force-settles the deck — the interrupted deal must
    // now seed the flip session (instant=true recovery path).
    act(() => {
      view.rerender(<SquadDeckStage {...props} resetSignal={1} />)
    })
    expect(props.onDealSettled).toHaveBeenCalledTimes(1)
    expect(props.onDealSettled).toHaveBeenCalledWith(true)

    // A later warm re-entry must NOT re-notify.
    act(() => {
      view.rerender(<SquadDeckStage {...props} resetSignal={2} />)
    })
    expect(props.onDealSettled).toHaveBeenCalledTimes(1)
  })

  it('does not re-notify on resetSignal when the deal already settled normally', () => {
    const props = buildProps()
    const view = render(<SquadDeckStage {...props} />)

    act(() => {
      vi.advanceTimersByTime(computeDealTotalMs(members.length) + 10)
    })
    expect(props.onDealSettled).toHaveBeenCalledTimes(1)
    expect(props.onDealSettled).toHaveBeenCalledWith(false)

    act(() => {
      view.rerender(<SquadDeckStage {...props} resetSignal={1} />)
    })
    expect(props.onDealSettled).toHaveBeenCalledTimes(1)
  })

  it('the recovered session behaves like a normal interactive session (chip works, all_revealed fires)', () => {
    // Session-level proof of the downstream fix: a session seeded by the
    // recovery path (notifyDealSettled with instant=true, as SquadDeckStage
    // now calls it) supports flipAll (the chip) and fires all_revealed.
    const tracked: Array<{ eventType: string; payload: Record<string, unknown> }> = []
    const deps: SquadFlipSessionDeps = {
      now: () => Date.now(),
      setTimer: (cb, ms) => setTimeout(cb, ms),
      clearTimer: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
      track: (eventType, payload) => tracked.push({ eventType, payload }),
    }
    const session = createSquadFlipSession(deps)

    // Recovery-path settle (instant=true, interactive session).
    session.notifyDealSettled({
      visibleIds: members.map((m) => m.userId),
      currentUserId: 'me',
      bestPartnerUserId: null,
      interactive: true,
      instant: true,
    })

    // The 我 card auto-flipped instantly; the rest remain face-down — the
    // hint chip count is live.
    const visibleIds = members.map((m) => m.userId)
    let snapshot = session.getSnapshot()
    expect(snapshot.flippedIds.has('me')).toBe(true)
    expect(computeUnflippedCount(visibleIds, snapshot.flippedIds)).toBe(2)

    // Chip tap → reveal-all burst completes the set and fires all_revealed.
    const result = session.flipAll((id) => ({
      index: visibleIds.indexOf(id),
      isBestPartner: false,
    }))
    expect(result.flippedNow).toEqual(['u1', 'u2'])
    snapshot = session.getSnapshot()
    expect(computeUnflippedCount(visibleIds, snapshot.flippedIds)).toBe(0)

    const allRevealed = tracked.filter((e) => e.eventType === 'squad_unboxing_all_revealed')
    expect(allRevealed).toHaveLength(1)
    expect(allRevealed[0].payload.flippedByRevealAll).toBe(2)
  })
})
