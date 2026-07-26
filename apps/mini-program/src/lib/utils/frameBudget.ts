import Taro from '@tarojs/taro'

export type DegradationTier = 'full' | 'reduced' | 'minimal' | 'emergency'

interface FrameBudgetResult {
  tier: DegradationTier
  avgFps: number
  droppedFrames: number
}

const TIER_THRESHOLDS = {
  full: 55,      // 55+ fps sustained
  reduced: 30,   // 30-55 fps
  minimal: 15,   // 15-30 fps
  emergency: 0,  // <15 fps
}

/**
 * Measure frame budget during a short observation window.
 * Returns the appropriate degradation tier based on observed FPS.
 *
 * Usage: call during slot spin phase to decide effects for reveal/bridge/result.
 */
export function measureFrameBudget(durationMs = 1000): Promise<FrameBudgetResult> {
  return new Promise((resolve) => {
    const frameTimes: number[] = []
    let lastTime = 0
    let rafId: number | undefined

    const requestNextFrame = (callback: (timestamp: number) => void) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taroRequest = (Taro as any).requestAnimationFrame
      if (typeof taroRequest === 'function') {
        return taroRequest.call(Taro, callback) as number
      }

      const globalRequest = globalThis.requestAnimationFrame
      return typeof globalRequest === 'function' ? globalRequest(callback) : undefined
    }

    const cancelFrame = (id: number) => {
      // Taro's cancellation API returns void, so nullish coalescing would also
      // invoke the browser fallback after a successful Taro cancellation.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const taroCancel = (Taro as any).cancelAnimationFrame
      if (typeof taroCancel === 'function') {
        taroCancel.call(Taro, id)
        return
      }

      const globalCancel = globalThis.cancelAnimationFrame
      if (typeof globalCancel === 'function') globalCancel(id)
    }

    const collect = (timestamp: number) => {
      if (lastTime > 0) {
        const delta = timestamp - lastTime
        frameTimes.push(delta)
      }
      lastTime = timestamp
      rafId = requestNextFrame(collect)
    }

    rafId = requestNextFrame(collect)

    setTimeout(() => {
      if (rafId !== undefined) {
        cancelFrame(rafId)
      }

      if (frameTimes.length < 3) {
        resolve({ tier: 'full', avgFps: 60, droppedFrames: 0 })
        return
      }

      // Filter outliers (e.g., long pauses from backgrounding)
      const validFrames = frameTimes.filter((t) => t < 100)
      const avgDelta = validFrames.reduce((a, b) => a + b, 0) / validFrames.length
      const avgFps = Math.round(1000 / avgDelta)

      // Count dropped frames (frame time > 33ms = <30fps)
      const droppedFrames = validFrames.filter((t) => t > 33).length

      let tier: DegradationTier
      if (avgFps >= TIER_THRESHOLDS.full) {
        tier = 'full'
      } else if (avgFps >= TIER_THRESHOLDS.reduced) {
        tier = 'reduced'
      } else if (avgFps >= TIER_THRESHOLDS.minimal) {
        tier = 'minimal'
      } else {
        tier = 'emergency'
      }

      resolve({ tier, avgFps, droppedFrames })
    }, durationMs)
  })
}

/**
 * Quick RAM-based tier check (no frame measurement).
 * Use when rAF is unavailable or as a pre-check.
 */
export function getRamBasedTier(): DegradationTier {
  try {
    const info = Taro.getSystemInfoSync()
    const ram = (info as { deviceMemory?: number }).deviceMemory || 4
    if (ram >= 4) return 'full'
    if (ram >= 3) return 'reduced'
    if (ram >= 2) return 'minimal'
    return 'emergency'
  } catch {
    return 'full'
  }
}

/**
 * Combine frame budget + RAM for final tier.
 * Frame budget takes precedence if available; RAM is the fallback.
 */
export async function getDegradationTier(): Promise<DegradationTier> {
  const ramTier = getRamBasedTier()
  if (ramTier === 'emergency') return 'emergency'

  try {
    const frameResult = await measureFrameBudget(800)
    // Use the more conservative of the two
    const tiers: DegradationTier[] = ['full', 'reduced', 'minimal', 'emergency']
    const ramIndex = tiers.indexOf(ramTier)
    const frameIndex = tiers.indexOf(frameResult.tier)
    return tiers[Math.max(ramIndex, frameIndex)]
  } catch {
    return ramTier
  }
}
