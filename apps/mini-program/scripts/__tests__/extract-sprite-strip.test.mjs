import { describe, expect, it } from 'vitest'
import {
  getContentBBox,
  jaccard,
  rectIntersectionArea,
  stats,
  VERDICT_THRESHOLDS,
} from '../extract-single-row-sprite-strip.mjs'

describe('extract-single-row-sprite-strip pure helpers', () => {
  describe('getContentBBox', () => {
    it('returns null for a fully transparent buffer', () => {
      const buffer = Buffer.alloc(4 * 4 * 4, 0)
      expect(getContentBBox(buffer, 4, 4)).toBeNull()
    })

    it('finds the bounding box of opaque pixels', () => {
      // 4x4 buffer with a 2x2 opaque block at (1,1)
      const buffer = Buffer.alloc(4 * 4 * 4, 0)
      for (let y = 1; y <= 2; y++) {
        for (let x = 1; x <= 2; x++) {
          buffer[(y * 4 + x) * 4 + 3] = 255
        }
      }
      expect(getContentBBox(buffer, 4, 4)).toEqual({ x: 1, y: 1, w: 2, h: 2 })
    })

    it('ignores pixels below the alpha threshold', () => {
      const buffer = Buffer.alloc(4 * 4 * 4, 0)
      buffer[(0 * 4 + 0) * 4 + 3] = 5 // below threshold of 10
      expect(getContentBBox(buffer, 4, 4)).toBeNull()
    })
  })

  describe('rectIntersectionArea', () => {
    it('returns the overlap area for intersecting rectangles', () => {
      const a = { x: 0, y: 0, w: 4, h: 4 }
      const b = { x: 2, y: 2, w: 4, h: 4 }
      expect(rectIntersectionArea(a, b)).toBe(4)
    })

    it('returns 0 for non-intersecting rectangles', () => {
      const a = { x: 0, y: 0, w: 2, h: 2 }
      const b = { x: 4, y: 4, w: 2, h: 2 }
      expect(rectIntersectionArea(a, b)).toBe(0)
    })
  })

  describe('jaccard', () => {
    it('returns 1 for identical rectangles', () => {
      const r = { x: 1, y: 1, w: 4, h: 4 }
      expect(jaccard(r, r)).toBe(1)
    })

    it('returns 0 for disjoint rectangles', () => {
      const a = { x: 0, y: 0, w: 2, h: 2 }
      const b = { x: 4, y: 4, w: 2, h: 2 }
      expect(jaccard(a, b)).toBe(0)
    })

    it('computes the correct index for a 50% overlap', () => {
      // a: 4 area, b: 4 area, intersection: 2, union: 6
      const a = { x: 0, y: 0, w: 2, h: 2 }
      const b = { x: 1, y: 0, w: 2, h: 2 }
      expect(jaccard(a, b)).toBeCloseTo(2 / 6, 6)
    })
  })

  describe('stats', () => {
    it('computes mean, stddev, min, max', () => {
      const result = stats([2, 4, 6, 8])
      expect(result).toEqual({
        mean: '5.0',
        stddev: Math.sqrt(5).toFixed(2),
        min: 2,
        max: 8,
      })
    })
  })

  describe('VERDICT_THRESHOLDS', () => {
    it('has expected pass and warn thresholds', () => {
      expect(VERDICT_THRESHOLDS.passJaccard).toBe(0.85)
      expect(VERDICT_THRESHOLDS.warnJaccard).toBe(0.7)
    })
  })
})
