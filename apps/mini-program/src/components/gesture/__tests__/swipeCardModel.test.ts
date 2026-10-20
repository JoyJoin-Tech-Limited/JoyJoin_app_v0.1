import { describe, expect, it } from 'vitest'
import {
  SWIPE_DIRECTION_LOCK_RATIO,
  SWIPE_LEFT_EDGE_DEAD_ZONE_RPX,
  SWIPE_MIN_TRACK_DISTANCE_PX,
  isHorizontalSwipeIntent,
  isLeftEdgeDeadZone,
  shouldStartTracking,
  swipeRpxToPx,
} from '../swipeCardModel'

/**
 * SwipeCard gesture model (sprint icebreaker-polish-p1, contract AC-03).
 * Locks the direction lock (|dx| > 1.5×|dy|), the left-edge 40rpx dead
 * zone, and the rpx→px geometry used by the mount-cached card width.
 */
describe('AC-03① direction lock', () => {
  it('tracks only when |dx| exceeds 1.5×|dy|', () => {
    expect(SWIPE_DIRECTION_LOCK_RATIO).toBe(1.5)
    expect(isHorizontalSwipeIntent(31, 20)).toBe(true) // 31 > 30
    expect(isHorizontalSwipeIntent(30, 20)).toBe(false) // boundary is strict
    expect(isHorizontalSwipeIntent(-31, 20)).toBe(true) // leftward counts too
    expect(isHorizontalSwipeIntent(20, 30)).toBe(false) // vertical scroll intent
    expect(isHorizontalSwipeIntent(0, 0)).toBe(false)
  })

  it('requires a minimum horizontal travel before tracking starts', () => {
    expect(shouldStartTracking(SWIPE_MIN_TRACK_DISTANCE_PX, 0)).toBe(true)
    expect(shouldStartTracking(SWIPE_MIN_TRACK_DISTANCE_PX - 1, 0)).toBe(false)
    expect(shouldStartTracking(40, 30)).toBe(false) // far but diagonal
  })
})

describe('AC-03② left-edge dead zone', () => {
  it('ignores touches starting within the 40rpx left edge', () => {
    expect(SWIPE_LEFT_EDGE_DEAD_ZONE_RPX).toBe(40)
    // 375px viewport → 40rpx = 20px
    const deadZonePx = swipeRpxToPx(40, 375)
    expect(deadZonePx).toBe(20)
    expect(isLeftEdgeDeadZone(0, deadZonePx)).toBe(true)
    expect(isLeftEdgeDeadZone(20, deadZonePx)).toBe(true)
    expect(isLeftEdgeDeadZone(21, deadZonePx)).toBe(false)
    expect(isLeftEdgeDeadZone(200, deadZonePx)).toBe(false)
  })

  it('scales the dead zone with the viewport width (750rpx design width)', () => {
    expect(swipeRpxToPx(40, 750)).toBe(40)
    expect(swipeRpxToPx(40, 414)).toBeCloseTo(22.08, 2)
  })
})
