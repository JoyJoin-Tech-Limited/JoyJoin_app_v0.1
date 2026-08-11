/**
 * S10 gyro-parallax spike (2026-08-11) — pure logic, Taro-free for testability.
 *
 * Time-boxed spike per docs/design/icebreaker-fluid-ux-iteration-plan-20260811.md
 * slice S10 and playbook §10 ruling 7 (locked floors: sustained 60fps on the
 * Gen-Z 8GB baseline, zero new crashes, session battery within normal envelope;
 * any WARN = drop). Findings: docs/design/gyro-parallax-spike-findings-20260811.md
 *
 * Gating is a MODULE-LOCAL constant by design — real flag registration
 * (`icebreakerGyroParallaxEnabled` in apps/server/src/lib/featureFlags.ts)
 * happens only if the spike ships.
 *
 * Sensor note: the playbook names `wx.onGyroscopeData`, but WeChat gyroscope
 * events deliver angular VELOCITY (rad/s), which drifts when integrated. The
 * in-repo precedent (results-page WebGL spike, quarantined 2026-08-11) used
 * `Taro.onDeviceMotionChange` orientation (alpha/beta/gamma), which is the
 * correct absolute-tilt source for parallax. Tilt math + clamp + smoothing
 * follow the personality-card results pattern (`FinalStage.tsx`): ≤8° range,
 * rAF-throttled state updates, 0.15s ease-out CSS transition (see
 * styles/_gyro-parallax-spike.scss).
 */

/** Master gate for the whole spike. Flip to true ONLY for on-device measurement. */
export const GYRO_PARALLAX_SPIKE_ENABLED = false

/** Max card tilt per axis, within the locked ≤10° bound (personality-card precedent uses 8). */
export const GYRO_SPIKE_MAX_TILT_DEG = 8

/** Low-pass smoothing factor applied per sensor tick (matches the 0.15s ease-out transition). */
export const GYRO_SPIKE_SMOOTHING = 0.15

/**
 * POCKET posture (playbook §10 ruling 4: screen-on, face-down or held low).
 * When the device is within this angle of flat (face-up or face-down), the
 * parallax eases back to identity — the flourish is off in POCKET.
 */
export const GYRO_SPIKE_POCKET_FLAT_RAD = 0.35

/** Readings averaged to calibrate the neutral (zero-tilt) pose on listener start. */
export const GYRO_SPIKE_CALIBRATION_SAMPLES = 5

/** A frame is jank when its delta exceeds ~2 frames at 60fps. */
export const GYRO_SPIKE_JANK_BUDGET_MS = 34

/** Dev harness: emit a console summary line at this cadence while parallax runs. */
export const GYRO_SPIKE_JANK_REPORT_INTERVAL_MS = 15000

export interface DeviceOrientationSample {
  /** Radians, [-PI, PI). */
  beta: number
  /** Radians, [-PI/2, PI/2). */
  gamma: number
}

export interface ParallaxTilt {
  rotateX: number
  rotateY: number
}

const RAD_TO_DEG = 180 / Math.PI

/** True when the device is near-flat (face-up on table) or face-down. */
export function isPocketPosture(betaRad: number): boolean {
  const abs = Math.abs(betaRad)
  return abs < GYRO_SPIKE_POCKET_FLAT_RAD || abs > Math.PI - GYRO_SPIKE_POCKET_FLAT_RAD
}

export function clampTiltDeg(deg: number): number {
  const clamped = Math.max(-GYRO_SPIKE_MAX_TILT_DEG, Math.min(GYRO_SPIKE_MAX_TILT_DEG, deg))
  // Normalize -0 so identity poses compare equal to 0.
  return clamped === 0 ? 0 : clamped
}

/**
 * Map a device-orientation sample to a clamped card tilt, relative to the
 * calibrated neutral pose. Pocket posture damps to identity. gamma maps to
 * rotateY (left/right lean), beta-delta maps to rotateX (forward/back lean,
 * sign flipped so leaning the top edge away tips the card's top away).
 */
export function computeParallaxTilt(
  sample: DeviceOrientationSample,
  neutral: DeviceOrientationSample,
): ParallaxTilt {
  if (isPocketPosture(sample.beta)) {
    return { rotateX: 0, rotateY: 0 }
  }
  const deltaBetaDeg = (sample.beta - neutral.beta) * RAD_TO_DEG
  const deltaGammaDeg = (sample.gamma - neutral.gamma) * RAD_TO_DEG
  return {
    rotateX: clampTiltDeg(-deltaBetaDeg * 0.5),
    rotateY: clampTiltDeg(deltaGammaDeg * 0.5),
  }
}

/** One low-pass smoothing step toward the target (called per sensor tick). */
export function smoothTilt(current: ParallaxTilt, target: ParallaxTilt): ParallaxTilt {
  return {
    rotateX: current.rotateX + (target.rotateX - current.rotateX) * GYRO_SPIKE_SMOOTHING,
    rotateY: current.rotateY + (target.rotateY - current.rotateY) * GYRO_SPIKE_SMOOTHING,
  }
}

// ─── Dev-only jank measurement harness ─────────────────────────────────────

export interface JankReport {
  startedAt: number
  frames: number
  jankFrames: number
  worstDeltaMs: number
  /** jankFrames / frames, 0 when no frames sampled. */
  jankRatio: number
}

interface JankMonitorDeps {
  now: () => number
  raf: (cb: () => void) => number
  cancelRaf: (id: number) => void
  onReport?: (report: JankReport) => void
  reportIntervalMs?: number
  budgetMs?: number
}

export interface JankMonitor {
  start: () => void
  stop: () => JankReport
  getReport: () => JankReport
}

/**
 * rAF delta sampler: counts frames whose delta exceeds the 60fps budget while
 * the parallax is active. Field tester reads the periodic console summaries or
 * calls `__JOYJOIN_GYRO_SPIKE__.getReport()` from vConsole on a real device.
 */
export function createJankMonitor(deps: JankMonitorDeps): JankMonitor {
  const budgetMs = deps.budgetMs ?? GYRO_SPIKE_JANK_BUDGET_MS
  const reportIntervalMs = deps.reportIntervalMs ?? GYRO_SPIKE_JANK_REPORT_INTERVAL_MS
  let running = false
  let rafId: number | null = null
  let startedAt = 0
  let lastFrameAt = 0
  let lastReportAt = 0
  let frames = 0
  let jankFrames = 0
  let worstDeltaMs = 0

  const getReport = (): JankReport => ({
    startedAt,
    frames,
    jankFrames,
    worstDeltaMs,
    jankRatio: frames > 0 ? jankFrames / frames : 0,
  })

  const tick = () => {
    if (!running) return
    const now = deps.now()
    if (lastFrameAt > 0) {
      const delta = now - lastFrameAt
      frames += 1
      if (delta > budgetMs) jankFrames += 1
      if (delta > worstDeltaMs) worstDeltaMs = delta
    }
    lastFrameAt = now
    if (now - lastReportAt >= reportIntervalMs) {
      lastReportAt = now
      deps.onReport?.(getReport())
    }
    rafId = deps.raf(tick)
  }

  return {
    start() {
      if (running) return
      running = true
      startedAt = deps.now()
      lastFrameAt = 0
      lastReportAt = startedAt
      frames = 0
      jankFrames = 0
      worstDeltaMs = 0
      rafId = deps.raf(tick)
    },
    stop() {
      running = false
      if (rafId !== null) {
        deps.cancelRaf(rafId)
        rafId = null
      }
      return getReport()
    },
    getReport,
  }
}
