import { describe, expect, it } from 'vitest'
import {
  EMPTY_ALANG_DISTANCE_SMOOTHING_STATE,
  smoothAlangDistance,
} from './distanceSmoothing'

describe('smoothAlangDistance', () => {
  it('shows the first valid distance immediately', () => {
    expect(smoothAlangDistance(EMPTY_ALANG_DISTANCE_SMOOTHING_STATE, 100)).toEqual({
      emaMeters: 100,
      displayMeters: 100,
    })
  })

  it('dampens movement and suppresses sub-metre display jitter', () => {
    const first = smoothAlangDistance(EMPTY_ALANG_DISTANCE_SMOOTHING_STATE, 100)
    const jitter = smoothAlangDistance(first, 99)
    const movement = smoothAlangDistance(jitter, 80)

    expect(jitter.emaMeters).toBeCloseTo(99.65, 5)
    expect(jitter.displayMeters).toBe(100)
    expect(movement.emaMeters).toBeCloseTo(92.7725, 5)
    expect(movement.displayMeters).toBeCloseTo(92.7725, 5)
  })

  it('uses the server-confirmed arrival sample immediately when forced', () => {
    const previous = smoothAlangDistance(EMPTY_ALANG_DISTANCE_SMOOTHING_STATE, 18)
    expect(smoothAlangDistance(previous, 4.2, true)).toEqual({
      emaMeters: 4.2,
      displayMeters: 4.2,
    })
  })
})
