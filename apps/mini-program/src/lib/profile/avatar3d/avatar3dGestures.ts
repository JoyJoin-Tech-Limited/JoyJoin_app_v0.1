/**
 * Pure gesture math for the 3D avatar stage: drag axis locking, continuous yaw,
 * flick inertia, and double-tap detection. No Taro / DOM / GL dependencies so the
 * full interaction model is unit-testable in plain Node.
 */

export type AvatarDragAxis = 'pending' | 'horizontal' | 'vertical'

/** Minimum travel before a gesture commits to an axis (px). */
export const AVATAR3D_AXIS_LOCK_THRESHOLD_PX = 8
/** Horizontal must beat vertical by this ratio to claim the gesture. */
export const AVATAR3D_AXIS_DOMINANCE_RATIO = 1.15
/** Radians of yaw per horizontal pixel dragged — tuned for a 375px-wide stage. */
export const AVATAR3D_RADIANS_PER_PIXEL = (Math.PI * 2) / 420
/** Inertia damping (per second, exponential). */
export const AVATAR3D_INERTIA_DAMPING = 3.4
/** Below this angular velocity (rad/s) the inertia loop settles and stops. */
export const AVATAR3D_INERTIA_MIN_VELOCITY = 0.06
/** Max angular velocity (rad/s) so a hard flick stays controllable. */
export const AVATAR3D_MAX_VELOCITY = 9
/** Two taps within this window (ms) count as a double tap. */
export const AVATAR3D_DOUBLE_TAP_WINDOW_MS = 320
/** Movement budget (px) under which a touch sequence still counts as a tap. */
export const AVATAR3D_TAP_SLOP_PX = 12
/** Velocity samples older than this are ignored for flick estimation. */
export const AVATAR3D_VELOCITY_SAMPLE_WINDOW_MS = 120

/**
 * Decide the gesture axis from accumulated deltas. Returns 'pending' while the
 * gesture is still inside the lock threshold so vertical page scrolls are never
 * hijacked and horizontal drags never scroll the page.
 */
export function resolveAvatarDragAxis(
  deltaX: number,
  deltaY: number,
  thresholdPx: number = AVATAR3D_AXIS_LOCK_THRESHOLD_PX,
  dominanceRatio: number = AVATAR3D_AXIS_DOMINANCE_RATIO,
): AvatarDragAxis {
  const absX = Math.abs(deltaX)
  const absY = Math.abs(deltaY)
  if (Math.max(absX, absY) < thresholdPx) return 'pending'
  return absX > absY * dominanceRatio ? 'horizontal' : 'vertical'
}

/**
 * Yaw for an active horizontal drag. Unbounded and continuous — dragging far
 * enough wraps the model around 360° any number of times (no snapping).
 */
export function computeDragYaw(
  startYaw: number,
  deltaX: number,
  radiansPerPixel: number = AVATAR3D_RADIANS_PER_PIXEL,
): number {
  return startYaw + deltaX * radiansPerPixel
}

/** Normalize any angle into (-π, π]. Display-only; the model keeps raw yaw. */
export function normalizeRadians(angle: number): number {
  if (!Number.isFinite(angle)) return 0
  const twoPi = Math.PI * 2
  let normalized = angle % twoPi
  if (normalized <= -Math.PI) normalized += twoPi
  else if (normalized > Math.PI) normalized -= twoPi
  return normalized
}

/** Normalize to 0–360 for labels/debug readouts. */
export function normalizeDegrees360(yawRadians: number): number {
  const degrees = (normalizeRadians(yawRadians) * 180) / Math.PI
  return (degrees + 360) % 360
}

export interface YawVelocitySample {
  timeMs: number
  yaw: number
}

/** Record a yaw sample, keeping only the recent window used for flick velocity. */
export function recordYawSample(
  samples: YawVelocitySample[],
  timeMs: number,
  yaw: number,
  windowMs: number = AVATAR3D_VELOCITY_SAMPLE_WINDOW_MS,
): YawVelocitySample[] {
  const next = samples.filter((sample) => timeMs - sample.timeMs <= windowMs)
  next.push({ timeMs, yaw })
  return next
}

/**
 * Estimate release velocity (rad/s) from recent yaw samples. Returns 0 when
 * there is not enough motion — a slow careful drag must not fling the model.
 */
export function computeFlickVelocity(
  samples: YawVelocitySample[],
  nowMs: number,
  windowMs: number = AVATAR3D_VELOCITY_SAMPLE_WINDOW_MS,
): number {
  const recent = samples.filter((sample) => nowMs - sample.timeMs <= windowMs)
  if (recent.length < 2) return 0
  const first = recent[0]
  const last = recent[recent.length - 1]
  const dt = (last.timeMs - first.timeMs) / 1000
  if (dt <= 0.001) return 0
  const velocity = (last.yaw - first.yaw) / dt
  if (!Number.isFinite(velocity)) return 0
  return Math.max(-AVATAR3D_MAX_VELOCITY, Math.min(AVATAR3D_MAX_VELOCITY, velocity))
}

export interface YawInertiaState {
  yaw: number
  velocity: number
  /** True once velocity decayed below the settle threshold. */
  settled: boolean
}

/** Advance inertia by `dtSeconds` with exponential damping. */
export function stepYawInertia(
  yaw: number,
  velocity: number,
  dtSeconds: number,
  dampingPerSecond: number = AVATAR3D_INERTIA_DAMPING,
): YawInertiaState {
  if (dtSeconds <= 0 || !Number.isFinite(dtSeconds)) {
    return { yaw, velocity, settled: Math.abs(velocity) < AVATAR3D_INERTIA_MIN_VELOCITY }
  }
  const decayed = velocity * Math.exp(-dampingPerSecond * dtSeconds)
  const nextVelocity = Math.abs(decayed) < AVATAR3D_INERTIA_MIN_VELOCITY ? 0 : decayed
  const nextYaw = yaw + velocity * dtSeconds
  return { yaw: nextYaw, velocity: nextVelocity, settled: nextVelocity === 0 }
}

/** True when the whole touch sequence stayed inside tap slop. */
export function isTapGesture(totalDeltaX: number, totalDeltaY: number, slopPx: number = AVATAR3D_TAP_SLOP_PX): boolean {
  return Math.abs(totalDeltaX) <= slopPx && Math.abs(totalDeltaY) <= slopPx
}

/** Double-tap detector state helper — pure timestamp comparison. */
export function isAvatarDoubleTap(
  tapTimeMs: number,
  previousTapTimeMs: number | null,
  windowMs: number = AVATAR3D_DOUBLE_TAP_WINDOW_MS,
): boolean {
  return previousTapTimeMs !== null && tapTimeMs - previousTapTimeMs <= windowMs
}

/**
 * The yaw of the nearest canonical front pose (multiple of 2π) so "回正" spins
 * back the short way even after many full turns.
 */
export function nearestFrontYaw(yaw: number): number {
  const twoPi = Math.PI * 2
  return Math.round(yaw / twoPi) * twoPi
}

/** Damped interpolation factor for the reset-to-front animation. */
export function computeResetLerp(step: number, totalSteps: number): number {
  if (totalSteps <= 0) return 1
  const t = Math.min(1, Math.max(0, step / totalSteps))
  // ease-out cubic so the return feels settled, not mechanical
  return 1 - Math.pow(1 - t, 3)
}

/** Coarse facing label for aria + debug readouts. */
export function describeAvatarFacing(yawRadians: number): string {
  const degrees = normalizeDegrees360(yawRadians)
  if (degrees >= 315 || degrees < 45) return '正面'
  if (degrees >= 45 && degrees < 135) return '右侧'
  if (degrees >= 135 && degrees < 225) return '背面'
  return '左侧'
}
