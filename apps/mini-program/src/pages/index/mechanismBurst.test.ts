// @vitest-environment node
import { describe, expect, it } from 'vitest'
import { computeBurstOffsets } from './mechanismBurst'

describe('computeBurstOffsets (E3 盒子吐卡)', () => {
  it('places every seat centre on the box-mouth centre', () => {
    const mouth = { left: 187, top: 200, width: 1, height: 1 }
    const seats = [
      { left: 100, top: 400, width: 48, height: 48 },
      { left: 300, top: 400, width: 48, height: 48 },
    ]
    const offsets = computeBurstOffsets(mouth, seats)
    expect(offsets).toHaveLength(2)
    // Seat 1 centre (124, 424) → mouth centre (187.5, 200.5)
    expect(offsets[0]).toEqual({ dx: 64, dy: -223 })
    // Seat 2 centre (324, 424)
    expect(offsets[1]).toEqual({ dx: -136, dy: -223 })
  })

  it('returns zero offsets when a seat is already centred on the mouth', () => {
    const mouth = { left: 100, top: 100, width: 10, height: 10 }
    const seats = [{ left: 95, top: 95, width: 20, height: 20 }]
    expect(computeBurstOffsets(mouth, seats)).toEqual([{ dx: 0, dy: 0 }])
  })

  it('handles an empty seat list', () => {
    expect(computeBurstOffsets({ left: 0, top: 0, width: 2, height: 2 }, [])).toEqual([])
  })
})
