import { describe, expect, it, vi } from 'vitest'
import {
  GYRO_PARALLAX_SPIKE_ENABLED,
  GYRO_SPIKE_CALIBRATION_SAMPLES,
  GYRO_SPIKE_JANK_BUDGET_MS,
  GYRO_SPIKE_MAX_TILT_DEG,
  clampTiltDeg,
  computeParallaxTilt,
  createJankMonitor,
  isPocketPosture,
  smoothTilt,
} from '../spike/gyroParallax'

const DEG = Math.PI / 180

describe('S10 gyro-parallax spike — gating', () => {
  it('ships dark: the module-local spike flag defaults to false', () => {
    expect(GYRO_PARALLAX_SPIKE_ENABLED).toBe(false)
  })

  it('stays within the locked ≤10° tilt bound', () => {
    expect(GYRO_SPIKE_MAX_TILT_DEG).toBeLessThanOrEqual(10)
  })
})

describe('isPocketPosture', () => {
  it('treats face-up-flat and face-down as POCKET (parallax off)', () => {
    expect(isPocketPosture(0)).toBe(true)
    expect(isPocketPosture(10 * DEG)).toBe(true)
    expect(isPocketPosture(Math.PI)).toBe(true)
    expect(isPocketPosture(-Math.PI + 0.1)).toBe(true)
  })

  it('treats a raised phone as active', () => {
    expect(isPocketPosture(60 * DEG)).toBe(false)
    expect(isPocketPosture(-90 * DEG)).toBe(false)
  })
})

describe('computeParallaxTilt', () => {
  const neutral = { beta: 60 * DEG, gamma: 0 }

  it('returns identity at the neutral pose', () => {
    expect(computeParallaxTilt(neutral, neutral)).toEqual({ rotateX: 0, rotateY: 0 })
  })

  it('damps to identity in POCKET posture regardless of neutral', () => {
    expect(computeParallaxTilt({ beta: 0, gamma: 0 }, neutral)).toEqual({ rotateX: 0, rotateY: 0 })
  })

  it('maps gamma delta to rotateY and beta delta to (inverted) rotateX', () => {
    const tilt = computeParallaxTilt({ beta: 60 * DEG, gamma: 10 * DEG }, neutral)
    expect(tilt.rotateY).toBeCloseTo(5)
    expect(tilt.rotateX).toBeCloseTo(0)
    const tiltBack = computeParallaxTilt({ beta: 70 * DEG, gamma: 0 }, neutral)
    expect(tiltBack.rotateX).toBeCloseTo(-5)
  })

  it('clamps both axes to the max tilt', () => {
    const tilt = computeParallaxTilt({ beta: -80 * DEG, gamma: 89 * DEG }, neutral)
    expect(tilt.rotateX).toBe(GYRO_SPIKE_MAX_TILT_DEG)
    expect(tilt.rotateY).toBe(GYRO_SPIKE_MAX_TILT_DEG)
    expect(clampTiltDeg(-999)).toBe(-GYRO_SPIKE_MAX_TILT_DEG)
  })
})

describe('smoothTilt', () => {
  it('moves a fraction of the way toward the target per tick', () => {
    const next = smoothTilt({ rotateX: 0, rotateY: 0 }, { rotateX: 8, rotateY: -8 })
    expect(next.rotateX).toBeGreaterThan(0)
    expect(next.rotateX).toBeLessThan(8)
    expect(next.rotateY).toBeLessThan(0)
    expect(next.rotateY).toBeGreaterThan(-8)
  })
})

describe('createJankMonitor', () => {
  function createHarness() {
    let now = 0
    const callbacks = new Map<number, () => void>()
    let nextId = 1
    const monitor = createJankMonitor({
      now: () => now,
      raf: (cb) => {
        const id = nextId++
        callbacks.set(id, cb)
        return id
      },
      cancelRaf: (id) => {
        callbacks.delete(id)
      },
    })
    /** Advance the fake clock and flush one scheduled rAF. */
    const step = (deltaMs: number) => {
      now += deltaMs
      const pending = [...callbacks.values()]
      callbacks.clear()
      pending.forEach((cb) => cb())
    }
    return { monitor, step }
  }

  it('counts frames over the budget as jank', () => {
    const { monitor, step } = createHarness()
    monitor.start()
    step(16.7) // first sample establishes the baseline
    step(16.7) // clean frame
    step(50) // jank (> 34ms budget)
    step(16.7) // clean frame
    const report = monitor.stop()
    expect(report.frames).toBe(3)
    expect(report.jankFrames).toBe(1)
    expect(report.worstDeltaMs).toBeCloseTo(50)
    expect(report.jankRatio).toBeCloseTo(1 / 3)
  })

  it('stop() cancels the loop and is idempotent', () => {
    const { monitor, step } = createHarness()
    monitor.start()
    step(16.7)
    monitor.stop()
    const framesAtStop = monitor.getReport().frames
    step(16.7)
    step(16.7)
    expect(monitor.getReport().frames).toBe(framesAtStop)
  })

  it('emits periodic reports while running', () => {
    let now = 0
    const onReport = vi.fn()
    const callbacks = new Map<number, () => void>()
    let nextId = 1
    const monitor = createJankMonitor({
      now: () => now,
      raf: (cb) => {
        const id = nextId++
        callbacks.set(id, cb)
        return id
      },
      cancelRaf: (id) => {
        callbacks.delete(id)
      },
      onReport,
      reportIntervalMs: 100,
    })
    monitor.start()
    for (let i = 0; i < 10; i++) {
      now += 16.7
      const pending = [...callbacks.values()]
      callbacks.clear()
      pending.forEach((cb) => cb())
    }
    expect(onReport).toHaveBeenCalled()
    expect(onReport.mock.calls[0][0].frames).toBeGreaterThan(0)
    monitor.stop()
  })
})

describe('calibration constant', () => {
  it('averages a small, sane number of samples', () => {
    expect(GYRO_SPIKE_CALIBRATION_SAMPLES).toBeGreaterThanOrEqual(3)
    expect(GYRO_SPIKE_CALIBRATION_SAMPLES).toBeLessThanOrEqual(30)
  })

  it('jank budget is ~2 frames at 60fps', () => {
    expect(GYRO_SPIKE_JANK_BUDGET_MS).toBeGreaterThanOrEqual(32)
    expect(GYRO_SPIKE_JANK_BUDGET_MS).toBeLessThanOrEqual(50)
  })
})
