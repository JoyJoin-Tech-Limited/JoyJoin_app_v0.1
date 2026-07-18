import { describe, expect, it } from 'vitest'
import {
  AVATAR3D_AXIS_LOCK_THRESHOLD_PX,
  AVATAR3D_MAX_VELOCITY,
  computeDragYaw,
  computeFlickVelocity,
  computeResetLerp,
  describeAvatarFacing,
  isAvatarDoubleTap,
  isTapGesture,
  nearestFrontYaw,
  normalizeDegrees360,
  normalizeRadians,
  recordYawSample,
  resolveAvatarDragAxis,
  stepYawInertia,
  type YawVelocitySample,
} from './avatar3dGestures'

describe('resolveAvatarDragAxis', () => {
  it('stays pending inside the lock threshold', () => {
    expect(resolveAvatarDragAxis(3, 2)).toBe('pending')
    expect(resolveAvatarDragAxis(AVATAR3D_AXIS_LOCK_THRESHOLD_PX - 1, 0)).toBe('pending')
    expect(resolveAvatarDragAxis(0, AVATAR3D_AXIS_LOCK_THRESHOLD_PX - 1)).toBe('pending')
  })

  it('locks horizontal only when clearly dominant', () => {
    expect(resolveAvatarDragAxis(40, 5)).toBe('horizontal')
    expect(resolveAvatarDragAxis(-40, 5)).toBe('horizontal')
    expect(resolveAvatarDragAxis(12, 11)).toBe('vertical') // not dominant enough
  })

  it('locks vertical so page scroll is never hijacked', () => {
    expect(resolveAvatarDragAxis(4, 40)).toBe('vertical')
    expect(resolveAvatarDragAxis(0, 9)).toBe('vertical')
  })
})

describe('computeDragYaw — continuous 360° yaw', () => {
  it('maps pixels to radians without clamping', () => {
    const yaw = computeDragYaw(0, 210) // half of the 420px full-turn budget
    expect(yaw).toBeCloseTo(Math.PI, 5)
  })

  it('keeps accumulating past multiple full turns (no 5-stop snap)', () => {
    const yaw = computeDragYaw(0, 420 * 2.5)
    expect(yaw).toBeCloseTo(Math.PI * 5, 5)
    expect(normalizeRadians(yaw)).toBeCloseTo(Math.PI, 5)
  })

  it('supports negative drag direction', () => {
    expect(computeDragYaw(1, -420)).toBeCloseTo(1 - Math.PI * 2, 5)
  })
})

describe('normalizeRadians / normalizeDegrees360', () => {
  it('normalizes into (-π, π]', () => {
    expect(normalizeRadians(Math.PI * 3)).toBeCloseTo(Math.PI, 5)
    expect(normalizeRadians(-Math.PI * 2.5)).toBeCloseTo(-Math.PI / 2, 5)
    expect(normalizeRadians(0)).toBe(0)
  })

  it('guards non-finite input', () => {
    expect(normalizeRadians(Number.NaN)).toBe(0)
    expect(normalizeRadians(Number.POSITIVE_INFINITY)).toBe(0)
  })

  it('maps yaw to 0–360 degrees', () => {
    expect(normalizeDegrees360(Math.PI / 2)).toBeCloseTo(90, 5)
    expect(normalizeDegrees360(-Math.PI / 2)).toBeCloseTo(270, 5)
    expect(normalizeDegrees360(Math.PI * 4)).toBeCloseTo(0, 5)
  })
})

describe('flick velocity', () => {
  function samplesFrom(points: Array<[number, number]>): YawVelocitySample[] {
    return points.reduce<YawVelocitySample[]>(
      (samples, [timeMs, yaw]) => recordYawSample(samples, timeMs, yaw),
      [],
    )
  }

  it('estimates release velocity from recent samples', () => {
    const samples = samplesFrom([[0, 0], [50, 0.25], [100, 0.5]])
    const velocity = computeFlickVelocity(samples, 100)
    expect(velocity).toBeCloseTo(5, 1) // 0.5 rad over 0.1 s
  })

  it('returns 0 for a slow careful drag (no accidental fling)', () => {
    const samples = samplesFrom([[0, 0], [500, 0.02], [1000, 0.04]])
    expect(computeFlickVelocity(samples, 1000)).toBe(0)
  })

  it('ignores samples outside the window', () => {
    const samples = samplesFrom([[0, 10], [390, 10], [400, 10.1], [450, 10.2]])
    const velocity = computeFlickVelocity(samples, 450, 50)
    expect(velocity).toBeCloseTo(2, 0)
  })

  it('clamps insane flicks', () => {
    const samples = samplesFrom([[0, 0], [30, 100]])
    expect(computeFlickVelocity(samples, 30)).toBe(AVATAR3D_MAX_VELOCITY)
  })
})

describe('stepYawInertia', () => {
  it('advances yaw and decays velocity', () => {
    const next = stepYawInertia(0, 4, 0.1)
    expect(next.yaw).toBeCloseTo(0.4, 5)
    expect(next.velocity).toBeLessThan(4)
    expect(next.velocity).toBeGreaterThan(0)
    expect(next.settled).toBe(false)
  })

  it('settles below the minimum velocity', () => {
    let state = { yaw: 0, velocity: 2, settled: false }
    for (let i = 0; i < 100 && !state.settled; i++) {
      state = stepYawInertia(state.yaw, state.velocity, 0.05)
    }
    expect(state.settled).toBe(true)
    expect(state.velocity).toBe(0)
  })

  it('handles zero/negative dt safely', () => {
    expect(stepYawInertia(1, 2, 0).yaw).toBe(1)
    expect(stepYawInertia(1, 2, -1).yaw).toBe(1)
  })
})

describe('tap + double tap', () => {
  it('detects taps within slop', () => {
    expect(isTapGesture(3, -4)).toBe(true)
    expect(isTapGesture(30, 0)).toBe(false)
  })

  it('detects double tap inside the window only', () => {
    expect(isAvatarDoubleTap(500, 300)).toBe(true)
    expect(isAvatarDoubleTap(900, 300)).toBe(false)
    expect(isAvatarDoubleTap(500, null)).toBe(false)
  })
})

describe('reset to front', () => {
  it('finds the nearest front yaw even after many turns', () => {
    expect(nearestFrontYaw(Math.PI * 6.1)).toBeCloseTo(Math.PI * 6, 5)
    expect(nearestFrontYaw(-Math.PI * 3.2)).toBeCloseTo(-Math.PI * 4, 5)
    expect(nearestFrontYaw(0.2)).toBe(0)
  })

  it('eases out across steps and completes at 1', () => {
    expect(computeResetLerp(0, 14)).toBe(0)
    expect(computeResetLerp(14, 14)).toBe(1)
    expect(computeResetLerp(7, 14)).toBeGreaterThan(0.5) // ease-out
    expect(computeResetLerp(1, 0)).toBe(1)
  })
})

describe('describeAvatarFacing', () => {
  it('labels the four facings', () => {
    expect(describeAvatarFacing(0)).toBe('正面')
    expect(describeAvatarFacing(Math.PI / 2)).toBe('右侧')
    expect(describeAvatarFacing(Math.PI)).toBe('背面')
    expect(describeAvatarFacing(-Math.PI / 2)).toBe('左侧')
    expect(describeAvatarFacing(Math.PI * 4)).toBe('正面')
  })
})
