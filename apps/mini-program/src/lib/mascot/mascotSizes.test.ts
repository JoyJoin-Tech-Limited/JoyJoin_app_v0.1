import { describe, expect, it } from 'vitest'
import { MASCOT_SIZE, MASCOT_SIZE_RPX } from './mascotSizes'

describe('MASCOT_SIZE ramp', () => {
  it('exposes the four canonical sizes on the 8rpx rhythm', () => {
    expect(MASCOT_SIZE).toEqual({
      sm: '96rpx',
      md: '160rpx',
      lg: '200rpx',
      xl: '240rpx',
    })
  })

  it('numeric aliases mirror the string ramp', () => {
    expect(MASCOT_SIZE_RPX.sm).toBe(96)
    expect(MASCOT_SIZE_RPX.md).toBe(160)
    expect(MASCOT_SIZE_RPX.lg).toBe(200)
    expect(MASCOT_SIZE_RPX.xl).toBe(240)
  })

  it('all values are multiples of 8rpx (mini-program spacing rhythm)', () => {
    for (const rpx of Object.values(MASCOT_SIZE_RPX)) {
      expect(rpx % 8).toBe(0)
    }
  })
})
