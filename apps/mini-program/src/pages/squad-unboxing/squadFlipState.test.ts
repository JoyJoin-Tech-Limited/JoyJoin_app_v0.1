// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import {
  AUTO_ME_FLIP_DELAY_MS,
  FLIP_IN_FLIGHT_GUARD_MS,
  FLIP_NARRATION_DELAY_MS,
  computeUnflippedCount,
  createSquadFlipSession,
  scheduleFlipSettleNarration,
  type CardFlipMeta,
  type SquadFlipSessionDeps,
} from './squadFlipState'
import { BURST_ACTIVE_BUDGET_MS } from './squadDealTiming'

interface Harness {
  deps: SquadFlipSessionDeps
  advance: (ms: number) => void
  tracked: Array<{ eventType: string; payload: Record<string, unknown> }>
  pending: Array<{ cb: () => void; ms: number }>
  flush: () => void
}

/** Manual fake clock + timer queue so ordering assertions are exact. */
function createHarness(start = 1000): Harness {
  let clock = start
  const tracked: Harness['tracked'] = []
  const pending: Harness['pending'] = []
  const deps: SquadFlipSessionDeps = {
    now: () => clock,
    setTimer: (cb, ms) => {
      const entry = { cb, ms }
      pending.push(entry)
      return entry
    },
    clearTimer: (handle) => {
      const index = pending.indexOf(handle as (typeof pending)[number])
      if (index >= 0) pending.splice(index, 1)
    },
    track: (eventType, payload) => tracked.push({ eventType, payload }),
  }
  return {
    deps,
    tracked,
    pending,
    advance: (ms) => {
      clock += ms
    },
    flush: () => {
      const due = pending.splice(0)
      due.forEach(({ cb }) => cb())
    },
  }
}

const metaOf = (index: number, isBestPartner = false): CardFlipMeta => ({ index, isBestPartner })

describe('squadFlipState — flipOne', () => {
  it('flips a face-down card exactly once and tracks method/index/best-partner', () => {
    const { deps, tracked } = createHarness()
    const session = createSquadFlipSession(deps)

    expect(session.flipOne('u2', 'tap', metaOf(2, true))).toEqual({ flipped: true })
    expect(session.flipOne('u2', 'tap', metaOf(2, true))).toEqual({ flipped: false })

    expect(session.getSnapshot().flippedIds.has('u2')).toBe(true)
    expect(session.getSnapshot().flipDelayById.get('u2')).toBe(0)
    expect(tracked).toHaveLength(1)
    expect(tracked[0].eventType).toBe('squad_unboxing_card_flip')
    expect(tracked[0].payload).toEqual({ method: 'tap', index: 2, isBestPartner: true })
  })

  it('arms the in-flight guard so concurrent taps are ignored until settle', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)

    session.flipOne('u1', 'tap', metaOf(0))
    expect(session.isFlipInFlight()).toBe(true)
    harness.advance(FLIP_IN_FLIGHT_GUARD_MS - 1)
    expect(session.isFlipInFlight()).toBe(true)
    harness.advance(1)
    expect(session.isFlipInFlight()).toBe(false)
  })

  it('emits snapshot changes to subscribers and stops after destroy', () => {
    const { deps } = createHarness()
    const session = createSquadFlipSession(deps)
    const listener = vi.fn()
    const unsubscribe = session.subscribe(listener)

    session.flipOne('u1', 'tap', metaOf(0))
    expect(listener).toHaveBeenCalledTimes(1)
    unsubscribe()
    session.flipOne('u2', 'tap', metaOf(1))
    expect(listener).toHaveBeenCalledTimes(1)
  })
})

describe('squadFlipState — arrival guard auto-me flip (AC-01/17)', () => {
  it('auto-flips the 我 card after AUTO_ME_FLIP_DELAY_MS once the deal settles', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)

    session.notifyDealSettled({
      visibleIds: ['me', 'u1', 'u2'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    expect(session.getSnapshot().flippedIds.has('me')).toBe(false)
    harness.flush()
    expect(session.getSnapshot().flippedIds.has('me')).toBe(true)
    expect(harness.tracked[0].payload).toEqual({ method: 'auto_me', index: 0, isBestPartner: false })
  })

  it('fires instantly (no timer) under reduced-motion / degradation', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)

    session.notifyDealSettled({
      visibleIds: ['me', 'u1'],
      currentUserId: 'me',
      interactive: true,
      instant: true,
    })
    expect(session.getSnapshot().flippedIds.has('me')).toBe(true)
    expect(harness.pending).toHaveLength(0)
  })

  it('never auto-flips on re-entry (non-interactive) or when 我 is already up', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)

    session.notifyDealSettled({
      visibleIds: ['me', 'u1'],
      currentUserId: 'me',
      interactive: false,
      instant: false,
    })
    expect(harness.pending).toHaveLength(0)
    expect(session.getSnapshot().flippedIds.size).toBe(0)

    session.notifyDealSettled({
      visibleIds: ['me', 'u1'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    harness.flush()
    expect(session.getSnapshot().flippedIds.has('me')).toBe(true)
    // Second settle (warm re-arm): 我 is already up → no new timer, no second event.
    const eventsAfterFirst = harness.tracked.length
    session.notifyDealSettled({
      visibleIds: ['me', 'u1'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    expect(harness.pending).toHaveLength(0)
    harness.flush()
    expect(harness.tracked).toHaveLength(eventsAfterFirst)
  })

  it('never auto-flips when the viewer sits beyond the fan cap (A2)', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)

    // The fan shows at most MAX_FAN_CARDS; a viewer outside visibleIds must
    // not get an auto-me flip (index would be -1 and analytics would fire
    // for an invisible card).
    session.notifyDealSettled({
      visibleIds: ['u1', 'u2', 'u3'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    expect(harness.pending).toHaveLength(0)
    harness.flush()
    expect(session.getSnapshot().flippedIds.size).toBe(0)
    expect(harness.tracked).toHaveLength(0)

    // Instant path follows the same guard.
    session.notifyDealSettled({
      visibleIds: ['u1', 'u2', 'u3'],
      currentUserId: 'me',
      interactive: true,
      instant: true,
    })
    expect(session.getSnapshot().flippedIds.size).toBe(0)
    expect(harness.tracked).toHaveLength(0)
  })

  it('destroy cancels a pending auto-me timer', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)

    session.notifyDealSettled({
      visibleIds: ['me'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    expect(harness.pending).toHaveLength(1)
    session.destroy()
    harness.flush()
    expect(session.getSnapshot().flippedIds.size).toBe(0)
  })
})

describe('squadFlipState — reveal-all burst (AC-04/05)', () => {
  it('flips every remaining card with a compressed stagger under the 600ms budget', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)
    session.notifyDealSettled({
      visibleIds: ['me', 'u1', 'u2', 'u3', 'u4', 'u5'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    session.flipOne('me', 'tap', metaOf(0))

    const result = session.flipAll((id) => metaOf(['me', 'u1', 'u2', 'u3', 'u4', 'u5'].indexOf(id)))

    expect(result.flippedNow).toEqual(['u1', 'u2', 'u3', 'u4', 'u5'])
    expect(result.totalMs).toBeLessThanOrEqual(BURST_ACTIVE_BUDGET_MS)
    // Burst stagger: strict roster order, evenly spaced.
    const delays = result.flippedNow.map((id) => result.delayById.get(id)!)
    expect(delays[0]).toBe(0)
    for (let i = 1; i < delays.length; i += 1) {
      expect(delays[i]).toBeGreaterThan(delays[i - 1])
    }
    expect(delays[delays.length - 1] + 340).toBeLessThanOrEqual(BURST_ACTIVE_BUDGET_MS)
    expect(harness.tracked.filter((e) => e.payload.method === 'reveal_all')).toHaveLength(5)
  })

  it('no-ops cleanly when nothing is face-down', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)
    session.notifyDealSettled({
      visibleIds: ['u1'],
      currentUserId: 'me',
      interactive: true,
      instant: true,
    })
    session.flipOne('u1', 'tap', metaOf(0))

    const result = session.flipAll(() => metaOf(0))
    expect(result).toEqual({ flippedNow: [], delayById: new Map(), totalMs: 0 })
  })
})

describe('squadFlipState — all_revealed single-fire (AC-15/16)', () => {
  it('fires once on the manual completion path with tap/reveal-all counts and durationMs', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)
    session.notifyDealSettled({
      visibleIds: ['me', 'u1', 'u2'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    harness.advance(2000)
    session.flipOne('me', 'tap', metaOf(0))
    harness.advance(500)
    session.flipOne('u1', 'tap', metaOf(1))
    session.flipAll((id) => metaOf(['me', 'u1', 'u2'].indexOf(id)))

    const allRevealed = harness.tracked.filter((e) => e.eventType === 'squad_unboxing_all_revealed')
    expect(allRevealed).toHaveLength(1)
    expect(allRevealed[0].payload).toEqual({
      flippedByTap: 2,
      flippedByRevealAll: 1,
      durationMs: 2500,
    })
  })

  it('fires once on the auto-me completion path (me auto-flip completes the set)', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)
    session.notifyDealSettled({
      visibleIds: ['me', 'u1'],
      currentUserId: 'me',
      interactive: true,
      instant: false,
    })
    session.flipOne('u1', 'tap', metaOf(1))
    harness.flush() // auto-me completes the set

    const allRevealed = harness.tracked.filter((e) => e.eventType === 'squad_unboxing_all_revealed')
    expect(allRevealed).toHaveLength(1)
    expect(allRevealed[0].payload.flippedByTap).toBe(1)
  })

  it('never fires on re-entry sessions even if every card ends face-up', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)
    session.notifyDealSettled({
      visibleIds: ['me', 'u1'],
      currentUserId: 'me',
      interactive: false,
      instant: false,
    })
    session.flipOne('me', 'tap', metaOf(0))
    session.flipOne('u1', 'tap', metaOf(1))

    expect(harness.tracked.filter((e) => e.eventType === 'squad_unboxing_all_revealed')).toHaveLength(0)
  })

  it('stays single-fire across extra flips after completion', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)
    session.notifyDealSettled({
      visibleIds: ['u1'],
      currentUserId: 'me',
      interactive: true,
      instant: true,
    })
    session.flipOne('u1', 'tap', metaOf(0))
    session.flipOne('u1', 'tap', metaOf(0))
    session.flipAll(() => metaOf(0))

    expect(harness.tracked.filter((e) => e.eventType === 'squad_unboxing_all_revealed')).toHaveLength(1)
  })
})

describe('squadFlipState — seed + unflipped count', () => {
  it('seeds story-mode face-up sets without analytics or timers', () => {
    const harness = createHarness()
    const session = createSquadFlipSession(harness.deps)

    session.seedFlipped(['me', 'u1'])
    expect(session.getSnapshot().flippedIds.size).toBe(2)
    expect(harness.tracked).toHaveLength(0)
    expect(harness.pending).toHaveLength(0)
    expect(session.isFlipInFlight()).toBe(false)
  })

  it('counts only visible, still face-down cards', () => {
    expect(computeUnflippedCount(['a', 'b', 'c'], new Set(['a']))).toBe(2)
    expect(computeUnflippedCount(['a'], new Set(['a']))).toBe(0)
    expect(computeUnflippedCount([], new Set(['x']))).toBe(0)
    expect(computeUnflippedCount(['a', 'b'], new Set(['x']))).toBe(2)
  })
})

describe('scheduleFlipSettleNarration — one-step beat ordering (AC-02)', () => {
  it('schedules narration AFTER the flip ends — never tap-instant, ≤500ms', () => {
    expect(FLIP_NARRATION_DELAY_MS).toBeGreaterThan(340)
    expect(FLIP_NARRATION_DELAY_MS).toBeLessThanOrEqual(500)

    const harness = createHarness()
    const narrate = vi.fn()
    scheduleFlipSettleNarration(harness.deps, narrate)

    expect(narrate).not.toHaveBeenCalled()
    expect(harness.pending[0].ms).toBe(FLIP_NARRATION_DELAY_MS)
    harness.flush()
    expect(narrate).toHaveBeenCalledTimes(1)
  })

  it('cancel prevents a stale narration from an interrupted flip (REL-04)', () => {
    const harness = createHarness()
    const narrate = vi.fn()
    const cancel = scheduleFlipSettleNarration(harness.deps, narrate)
    cancel()
    harness.flush()
    expect(narrate).not.toHaveBeenCalled()
  })
})
