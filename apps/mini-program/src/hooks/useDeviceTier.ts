import Taro from '@tarojs/taro'
import { useMemo } from 'react'

export type DeviceTier = 'primary' | 'degradation'

export interface DeviceTierResult {
  tier: DeviceTier
  benchmarkLevel: number | null
  isPrimary: boolean
  isDegradation: boolean
}

interface SystemInfoLike {
  benchmarkLevel?: number
  model?: string
  system?: string
}

/**
 * WeChat `benchmarkLevel` scale: 1 = low-end, 50 = high-end.
 * Values <= 15 indicate a low-end device that should receive the
 * degradation-tier experience. This threshold is aligned with
 * `useMiniRevealMotion` and the low-end CSS gating in the custom tab bar.
 */
const LOW_END_BENCHMARK_LEVEL = 15

/**
 * Pure helper: resolve device tier from system info.
 * Exported so the decision logic can be unit-tested without mocking Taro.
 */
export function resolveDeviceTier(info: SystemInfoLike): DeviceTierResult {
  const benchmarkLevel =
    typeof info.benchmarkLevel === 'number' ? info.benchmarkLevel : null

  // Android: benchmarkLevel is available. Scale is 1 (low) → 50 (high).
  if (benchmarkLevel != null && benchmarkLevel > 0) {
    const isDegradation = benchmarkLevel <= LOW_END_BENCHMARK_LEVEL
    return {
      tier: isDegradation ? 'degradation' : 'primary',
      benchmarkLevel,
      isPrimary: !isDegradation,
      isDegradation,
    }
  }

  // A value of 0 or missing benchmarkLevel means unsupported/unknown.
  // Use model heuristics when a model is present; otherwise degrade safely.
  if (benchmarkLevel === 0 && !info.model && !info.system) {
    return {
      tier: 'degradation',
      benchmarkLevel: 0,
      isPrimary: false,
      isDegradation: true,
    }
  }

  // iOS / unknown benchmarkLevel: use model name + system version heuristics
  const model = (info.model ?? '').toLowerCase()
  const system = (info.system ?? '').toLowerCase()

  // iPhone X/8/7/6/SE (1st gen) and older → degradation.
  // Exclude modern variants that share a prefix: XR, XS, SE2/SE3/2020/2022.
  const isModernSE = /iphone\s*se.*(2|3|2020|2022|2nd|3rd)/i.test(model)
  const oldModel =
    /iphone\s*(x|8|7|6|6s|se)\b/.test(model) &&
    !/iphone\s*(xr|xs|11|12|13|14|15|16)/.test(model) &&
    !isModernSE
  const oldOS = system.startsWith('ios ') && parseFloat(system.replace('ios ', '')) < 15

  const isDegradation = oldModel || oldOS
  return {
    tier: isDegradation ? 'degradation' : 'primary',
    // Preserve the original value (including 0) so callers can log it.
    benchmarkLevel,
    isPrimary: !isDegradation,
    isDegradation,
  }
}

/**
 * Detect device capability tier for runtime performance gating.
 *
 * Primary tier: 8GB+ RAM, 120Hz, recent SoC (Snapdragon 8 Gen 2+, Dimensity 8200+, A16+)
 * Degradation tier: 4–6GB RAM, 60Hz, older SoC
 *
 * Android: uses `benchmarkLevel` (1 = low-end, 50 = high-end).
 *          Threshold <= LOW_END_BENCHMARK_LEVEL = degradation.
 * iOS: `benchmarkLevel` is NOT exposed. Uses model name + system version heuristics.
 *
 * Use this to gate heavy animations, particle effects, and aggressive prefetching.
 * Always pair with `prefers-reduced-motion` for accessibility — this hook is for
 * performance, not accessibility.
 */
export function useDeviceTier(): DeviceTierResult {
  return useMemo(() => {
    try {
      return resolveDeviceTier(Taro.getSystemInfoSync())
    } catch {
      // Fallback: assume degradation on error to be safe
      return {
        tier: 'degradation',
        benchmarkLevel: null,
        isPrimary: false,
        isDegradation: true,
      }
    }
  }, [])
}
