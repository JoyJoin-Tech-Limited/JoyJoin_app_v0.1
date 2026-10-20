/**
 * SwipeCard gesture model (sprint icebreaker-polish-p1, contract AC-03).
 *
 * Pure decision functions extracted from SwipeCard.tsx so the five craft
 * rules are unit-testable without a touch runtime:
 *
 *  1. Direction lock — a gesture only starts tracking once it is clearly
 *     horizontal: |dx| > 1.5 × |dy| (plus a small minimum distance so a
 *     resting finger doesn't jitter the card).
 *  2. Left-edge dead zone — touches beginning within 40rpx of the left
 *     screen edge are ignored entirely (iOS swipe-back lives there).
 *  3. Width caching lives in the component (measured once at mount); this
 *     module owns only the geometry maths.
 */

/** |dx| must exceed 1.5×|dy| before the card follows the finger. */
export const SWIPE_DIRECTION_LOCK_RATIO = 1.5

/** Below this horizontal travel the gesture is noise, not intent. */
export const SWIPE_MIN_TRACK_DISTANCE_PX = 8

/** iOS 右滑返回 owns the leftmost 40rpx — never start a card swipe there. */
export const SWIPE_LEFT_EDGE_DEAD_ZONE_RPX = 40

/** True when the gesture is horizontally dominant enough to track. */
export function isHorizontalSwipeIntent(dx: number, dy: number): boolean {
  return Math.abs(dx) > SWIPE_DIRECTION_LOCK_RATIO * Math.abs(dy)
}

/** True when a fresh gesture may begin tracking (direction lock + min travel). */
export function shouldStartTracking(dx: number, dy: number): boolean {
  return Math.abs(dx) >= SWIPE_MIN_TRACK_DISTANCE_PX && isHorizontalSwipeIntent(dx, dy)
}

/** True when the touch started inside the left-edge dead zone. */
export function isLeftEdgeDeadZone(clientX: number, deadZonePx: number): boolean {
  return clientX <= deadZonePx
}

/** rpx → px for the current viewport (750rpx design width). */
export function swipeRpxToPx(rpx: number, windowWidth: number): number {
  return (rpx * windowWidth) / 750
}
