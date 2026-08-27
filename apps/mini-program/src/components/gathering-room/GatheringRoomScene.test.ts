import { describe, expect, it } from 'vitest'
import { seatIndexFor } from './GatheringRoomScene'

describe('gathering room seat map', () => {
  it('maps 3-person groups to a triangle around the table', () => {
    expect([0, 1, 2].map((i) => seatIndexFor(i, 3))).toEqual([1, 2, 4])
  })

  it('keeps the existing 4–6 seat arrangements', () => {
    expect([0, 1, 2, 3].map((i) => seatIndexFor(i, 4))).toEqual([1, 2, 3, 5])
    expect([0, 1, 2, 3, 4].map((i) => seatIndexFor(i, 5))).toEqual([0, 1, 2, 3, 5])
    expect([0, 1, 2, 3, 4, 5].map((i) => seatIndexFor(i, 6))).toEqual([0, 1, 2, 3, 4, 5])
  })

  it('uses door-side standing anchors for 7–8 members', () => {
    expect([0, 1, 2, 3, 4, 5, 6].map((i) => seatIndexFor(i, 7))).toEqual([0, 1, 2, 3, 4, 5, 6])
    expect([0, 1, 2, 3, 4, 5, 6, 7].map((i) => seatIndexFor(i, 8))).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('clamps oversized groups to 8 seats without out-of-range indices', () => {
    const indices = Array.from({ length: 12 }, (_, i) => seatIndexFor(i, 12))
    expect(indices.every((s) => s >= 0 && s <= 7)).toBe(true)
    expect(new Set(indices).size).toBe(8)
  })

  it('does not crash on degenerate 1–2 member groups', () => {
    expect(seatIndexFor(0, 1)).toBeGreaterThanOrEqual(0)
    expect(seatIndexFor(1, 2)).toBeGreaterThanOrEqual(0)
    expect(seatIndexFor(5, 1)).toBeGreaterThanOrEqual(0)
  })
})
