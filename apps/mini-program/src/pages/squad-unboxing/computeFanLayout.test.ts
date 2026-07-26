// @vitest-environment node
import { describe, expect, it } from 'vitest'
import {
  FAN_CARD_SIZE_BY_COUNT,
  FAN_CONTENT_WIDTH_RPX,
  FAN_OVERLAP_RPX,
  FAN_ROTATIONS_BY_ROW_LENGTH,
  FAN_SAFE_INSET_RPX,
  MAX_FAN_CARDS,
  clampFanCount,
  computeFanLayout,
  computeFanRows,
} from './computeFanLayout'

// Pure geometry math for the "Cascading Hand Fan". Locked strategy:
// docs/deliberations/2026-07-13-squad-unboxing-fan-revamp-locked.md §1.

describe('computeFanLayout — row split (ceil/floor)', () => {
  it('keeps N≤3 on a single row', () => {
    expect(computeFanRows(1)).toEqual([1])
    expect(computeFanRows(2)).toEqual([2])
    expect(computeFanRows(3)).toEqual([3])
  })

  it('splits N=4 into [2,2] so its cards join the 245rpx width class (2026-07-24 wow pass)', () => {
    expect(computeFanRows(4)).toEqual([2, 2])
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
  it('matches the locked per-count card sizes (2026-07-24 wow pass: N≤6 at the 245rpx 3-per-row ceiling)', () => {
    // 245rpx is the widest a 3-card row can be: 3×245 − 2×28 = 679 ≤ 686.
    expect(computeFanLayout(1).cardWidth).toBe(245)
    expect(computeFanLayout(2).cardWidth).toBe(245)
    expect(computeFanLayout(3).cardWidth).toBe(245)
    expect(computeFanLayout(4).cardWidth).toBe(245)
    expect(computeFanLayout(4).cardHeight).toBe(332)
    expect(computeFanLayout(5).cardWidth).toBe(245)
    expect(computeFanLayout(5).cardHeight).toBe(332)
    expect(computeFanLayout(6).cardWidth).toBe(245)
    // N=7–8 keep the legacy 190rpx 4-per-row shape (stage height budget).
    expect(computeFanLayout(7).cardWidth).toBe(190)
    expect(computeFanLayout(8).cardWidth).toBe(190)
  })

  it('emits the locked rotations per row shape', () => {
    // N=4: [2,2] split (2026-07-24) → two rows of ±4.5.
    expect(computeFanLayout(4).rotations).toEqual([-4.5, 4.5, -4.5, 4.5])
    // N=5: row3 (-5,0,+5 — capped with the 245rpx cards) then row2 (-4.5,+4.5).
    expect(computeFanLayout(5).rotations).toEqual([-5, 0, 5, -4.5, 4.5])
    // N=6: two rows of 3.
    expect(computeFanLayout(6).rotations).toEqual([-5, 0, 5, -5, 0, 5])
    // N=7: row4 (±5, G2-capped) then row3 (±5).
    expect(computeFanLayout(7).rotations).toEqual([-5, -2.5, 2.5, 5, -5, 0, 5])
    // N=8: two rows of 4.
    expect(computeFanLayout(8).rotations).toEqual([-5, -2.5, 2.5, 5, -5, -2.5, 2.5, 5])
  })

  it('emits exactly one rotation per card', () => {
    for (let count = 1; count <= 8; count += 1) {
      expect(computeFanLayout(count).rotations).toHaveLength(count)
    }
  })

  it('rotation magnitudes stay within ±7°', () => {
    for (let count = 1; count <= 8; count += 1) {
      for (const rotation of computeFanLayout(count).rotations) {
        expect(Math.abs(rotation)).toBeLessThanOrEqual(7)
      }
    }
  })

  it('no longer carries an auto-peek target (peek retired with tap-to-reveal)', () => {
    // The centre-card auto-peek was deleted, not commented (MNT-02): cards
    // land face-down and flip only on a deliberate tap.
    const layout = computeFanLayout(4) as unknown as Record<string, unknown>
    expect(layout.peekIndex).toBeUndefined()
    expect('peekIndex' in computeFanLayout(8)).toBe(false)
  })

  it('caps the fan at MAX_FAN_CARDS with the clamp aligned', () => {
    expect(MAX_FAN_CARDS).toBe(8)
    expect(clampFanCount(99)).toBe(MAX_FAN_CARDS)
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

describe('computeFanLayout — viewport-edge invariant (G2 regression)', () => {
  // A W×H card rotated θ° about its bottom-centre pivot extends
  // (W/2)(cosθ−1) + H·sinθ past its unrotated outer edge. The fan's rotated
  // bounding box must never exceed the 750rpx viewport minus an 8rpx
  // allowance — at ±7° the 4-per-row fan measured ~756rpx and the 4th card
  // was hard-cropped at the right edge (N=4, N=7, N=8).
  const VIEWPORT_WIDTH_RPX = 750
  const VIEWPORT_EDGE_ALLOWANCE_RPX = 8

  it('every row shape keeps its rotated bounding box inside the viewport', () => {
    for (let count = 1; count <= 8; count += 1) {
      const { rows, cardWidth, cardHeight, overlapRpx } = computeFanLayout(count)
      for (const len of rows) {
        const rowRotations = FAN_ROTATIONS_BY_ROW_LENGTH[len]
        const rowWidth = cardWidth * len - overlapRpx * (len - 1)
        const theta = (Math.abs(rowRotations[len - 1]) * Math.PI) / 180
        const poke = (cardWidth / 2) * (Math.cos(theta) - 1) + cardHeight * Math.sin(theta)
        const boundingWidth = rowWidth + 2 * poke
        expect(
          boundingWidth,
          `count ${count} row of ${len}: ${boundingWidth.toFixed(1)}rpx`,
        ).toBeLessThanOrEqual(VIEWPORT_WIDTH_RPX - VIEWPORT_EDGE_ALLOWANCE_RPX)
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
