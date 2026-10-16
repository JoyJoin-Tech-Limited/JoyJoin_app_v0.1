import { describe, it, expect } from 'vitest'
import {
  POOL_ICEBREAKER_LEAD_IN_MS,
  POOL_ICEBREAKER_TAIL_MS,
  isWithinPoolIcebreakerWindow,
} from './eventLiveWindow'

// 2026-10-16 fix: pool 进入破冰 was gated on a status set the server never
// writes for pools (see eventLiveWindow.ts). The window is now time-based; these
// tests pin the boundaries so a future refactor cannot silently widen or
// invert the interval.
const EVENT_START = '2026-11-01T19:00:00+08:00'
const startMs = new Date(EVENT_START).getTime()

const pool = (dateTime: string | null = EVENT_START, status = 'matched') => ({ status, dateTime })

describe('isWithinPoolIcebreakerWindow (2026-10-16)', () => {
  it('opens exactly 1h before the event start (inclusive)', () => {
    expect(isWithinPoolIcebreakerWindow(pool(), startMs - POOL_ICEBREAKER_LEAD_IN_MS)).toBe(true)
    expect(isWithinPoolIcebreakerWindow(pool(), startMs - POOL_ICEBREAKER_LEAD_IN_MS - 60_000)).toBe(false)
  })

  it('stays open through the event and closes exactly at +3h (inclusive)', () => {
    expect(isWithinPoolIcebreakerWindow(pool(), startMs)).toBe(true)
    expect(isWithinPoolIcebreakerWindow(pool(), startMs + POOL_ICEBREAKER_TAIL_MS)).toBe(true)
    expect(isWithinPoolIcebreakerWindow(pool(), startMs + POOL_ICEBREAKER_TAIL_MS + 60_000)).toBe(false)
  })

  it('aligns the tail with the +3h feedback boundary', () => {
    // Same instant: icebreaker closed, feedback open — the bar hands over.
    const tailEdge = startMs + POOL_ICEBREAKER_TAIL_MS
    expect(isWithinPoolIcebreakerWindow(pool(), tailEdge)).toBe(true)
    expect(isWithinPoolIcebreakerWindow(pool(), tailEdge + 1)).toBe(false)
  })

  it('never opens for cancelled or archived pools, even inside the clock window', () => {
    expect(isWithinPoolIcebreakerWindow(pool(EVENT_START, 'cancelled'), startMs)).toBe(false)
    expect(isWithinPoolIcebreakerWindow(pool(EVENT_START, 'archived'), startMs)).toBe(false)
  })

  it('does not require a matched status — group resolution decides that', () => {
    // Test pools stay `active` while a single-test group exists (D10), and the
    // production gate is the resolvable groupId, not the pool status.
    expect(isWithinPoolIcebreakerWindow(pool(EVENT_START, 'active'), startMs)).toBe(true)
    expect(isWithinPoolIcebreakerWindow(pool(EVENT_START, 'matching'), startMs)).toBe(true)
    expect(isWithinPoolIcebreakerWindow(pool(EVENT_START, 'completed'), startMs)).toBe(true)
  })

  it('fails closed on a missing, empty or unparseable dateTime', () => {
    expect(isWithinPoolIcebreakerWindow({ status: 'matched' }, startMs)).toBe(false)
    expect(isWithinPoolIcebreakerWindow(pool(null), startMs)).toBe(false)
    expect(isWithinPoolIcebreakerWindow(pool('not-a-date'), startMs)).toBe(false)
  })

  it('fails closed on a missing status', () => {
    expect(isWithinPoolIcebreakerWindow({ dateTime: EVENT_START }, startMs)).toBe(false)
  })
})
