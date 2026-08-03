/**
 * E3 盒子吐卡 burst math — pure functions, unit-testable (same discipline
 * as squad-unboxing's computeFanLayout). Runtime rects come from
 * Taro.createSelectorQuery().boundingClientRect(), which returns
 * post-transform px coordinates (the --short 0.85 stage scale is therefore
 * handled for free).
 */

export interface BurstRect {
  left: number
  top: number
  width: number
  height: number
}

export interface BurstOffset {
  dx: number
  dy: number
}

function rectCenter(rect: BurstRect): { cx: number; cy: number } {
  return {
    cx: rect.left + rect.width / 2,
    cy: rect.top + rect.height / 2,
  }
}

/**
 * Per-seat "from" offsets that place every seat's centre on the box-mouth
 * anchor. Applying translate(dx, dy) to a seat parks it at the mouth;
 * removing the transform lets the CSS transition fly it back to its seat.
 */
export function computeBurstOffsets(
  mouth: BurstRect,
  seats: ReadonlyArray<BurstRect>,
): BurstOffset[] {
  const { cx: mouthCx, cy: mouthCy } = rectCenter(mouth)
  return seats.map((seat) => {
    const { cx, cy } = rectCenter(seat)
    return {
      dx: Math.round(mouthCx - cx),
      dy: Math.round(mouthCy - cy),
    }
  })
}
