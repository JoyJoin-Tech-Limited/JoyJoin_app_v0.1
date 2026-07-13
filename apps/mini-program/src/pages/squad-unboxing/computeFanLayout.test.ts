// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  FAN_CARD_SIZE_BY_COUNT,
  FAN_CONTENT_WIDTH_RPX,
  FAN_OVERLAP_RPX,
  FAN_ROTATIONS_BY_ROW_LENGTH,
  FAN_SAFE_INSET_RPX,
  clampFanCount,
  computeFanLayout,
  computeFanRows,
} from './computeFanLayout'

// Pure geometry math for the "Cascading Hand Fan". Locked strategy:
// docs/deliberations/2026-07-13-squad-unboxing-fan-revamp-locked.md §1.

describe('computeFanLayout — row split (ceil/floor)', () => {
  it('keeps N≤4 on a single row', () => {
    expect(computeFanRows(1)).toEqual([1])
    expect(computeFanRows(2)).toEqual([2])
    expect(computeFanRows(3)).toEqual([3])
    expect(computeFanRows(4)).toEqual([4])
  })

  it('splits N≥5 into two rows with ceil on top', () => {
    expect(computeFanRows(5)).toEqual([3, 2])
    expect(computeFanRows(6)).toEqual([3, 3])
    expect(computeFanRows(7)).toEqual([4, 3])
    expect(computeFanRows(8)).toEqual([4, 4])
  })

  it('row lengths always sum to the clamped count', () => {
    for (let count = 1; count <= 8; count += 1) {
      const rows = computeFanRows(count)
      expect(rows.reduce((sum, len) => sum + len, 0)).toBe(count)
    }
  })
})

describe('computeFanLayout — locked geometry table', () => {
  it('matches the locked per-count card sizes', () => {
    expect(computeFanLayout(4).cardWidth).toBe(190)
    expect(computeFanLayout(4).cardHeight).toBe(332)
    expect(computeFanLayout(5).cardWidth).toBe(222)
    expect(computeFanLayout(5).cardHeight).toBe(332)
    expect(computeFanLayout(6).cardWidth).toBe(222)
    expect(computeFanLayout(7).cardWidth).toBe(190)
    expect(computeFanLayout(8).cardWidth).toBe(190)
  })

  it('emits the locked rotations per row shape', () => {
    // N=4: single row of 4 → -9, -3, +3, +9.
    expect(computeFanLayout(4).rotations).toEqual([-9, -3, 3, 9])
    // N=5: row3 (-6,0,+6) then row2 (-4.5,+4.5).
    expect(computeFanLayout(5).rotations).toEqual([-6, 0, 6, -4.5, 4.5])
    // N=6: two rows of 3.
    expect(computeFanLayout(6).rotations).toEqual([-6, 0, 6, -6, 0, 6])
    // N=7: row4 (±9) then row3 (±6).
    expect(computeFanLayout(7).rotations).toEqual([-9, -3, 3, 9, -6, 0, 6])
    // N=8: two rows of 4.
    expect(computeFanLayout(8).rotations).toEqual([-9, -3, 3, 9, -9, -3, 3, 9])
  })

  it('emits exactly one rotation per card', () => {
    for (let count = 1; count <= 8; count += 1) {
      expect(computeFanLayout(count).rotations).toHaveLength(count)
    }
  })

  it('rotation magnitudes stay within ±9°', () => {
    for (let count = 1; count <= 8; count += 1) {
      for (const rotation of computeFanLayout(count).rotations) {
        expect(Math.abs(rotation)).toBeLessThanOrEqual(9)
      }
    }
  })

  it('places the auto-peek target at the centre of the top row', () => {
    expect(computeFanLayout(4).peekIndex).toBe(2) // floor(4/2)
    expect(computeFanLayout(5).peekIndex).toBe(1) // floor(3/2)
    expect(computeFanLayout(6).peekIndex).toBe(1)
    expect(computeFanLayout(7).peekIndex).toBe(2) // floor(4/2)
    expect(computeFanLayout(8).peekIndex).toBe(2)
  })
})

describe('computeFanLayout — anti-collision safe-zone invariant', () => {
  it('safe inset covers the overlap plus the rotation poke (≥ 48rpx)', () => {
    expect(FAN_SAFE_INSET_RPX).toBeGreaterThanOrEqual(FAN_OVERLAP_RPX + 20)
    expect(FAN_SAFE_INSET_RPX).toBe(48)
    for (let count = 4; count <= 8; count += 1) {
      expect(computeFanLayout(count).safeInsetRpx).toBe(48)
    }
  })

  it('every row fits inside the content width (overlap included)', () => {
    for (let count = 1; count <= 8; count += 1) {
      const { rows, cardWidth, overlapRpx } = computeFanLayout(count)
      for (const len of rows) {
        const rowWidth = cardWidth * len - overlapRpx * (len - 1)
        expect(rowWidth, `count ${count} row of ${len}`).toBeLessThanOrEqual(FAN_CONTENT_WIDTH_RPX)
      }
    }
  })
})

describe('computeFanLayout — clamping + row-shape table', () => {
  it('clamps out-of-domain counts into 1–8', () => {
    expect(clampFanCount(0)).toBe(1)
    expect(clampFanCount(-3)).toBe(1)
    expect(clampFanCount(99)).toBe(8)
    expect(clampFanCount(Number.NaN)).toBe(1)
  })

  it('row-length rotation table is defined for every modelled row shape', () => {
    expect(FAN_ROTATIONS_BY_ROW_LENGTH[1]).toHaveLength(1)
    expect(FAN_ROTATIONS_BY_ROW_LENGTH[2]).toHaveLength(2)
    expect(FAN_ROTATIONS_BY_ROW_LENGTH[3]).toHaveLength(3)
    expect(FAN_ROTATIONS_BY_ROW_LENGTH[4]).toHaveLength(4)
  })

  it('card-size table covers the full 1–8 domain', () => {
    for (let count = 1; count <= 8; count += 1) {
      expect(FAN_CARD_SIZE_BY_COUNT[count]).toBeDefined()
      expect(FAN_CARD_SIZE_BY_COUNT[count].width).toBeGreaterThan(0)
      expect(FAN_CARD_SIZE_BY_COUNT[count].height).toBeGreaterThan(0)
    }
  })
})
