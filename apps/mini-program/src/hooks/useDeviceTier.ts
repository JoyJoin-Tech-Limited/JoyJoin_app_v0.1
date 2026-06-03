import Taro from '@tarojs/taro'
import { useMemo } from 'react'

export type DeviceTier = 'primary' | 'degradation'

/**
 * Detect device capability tier for runtime performance gating.
 *
 * Primary tier: 8GB+ RAM, 120Hz, recent SoC (Snapdragon 8 Gen 2+, Dimensity 8200+, A16+)
 * Degradation tier: 4–6GB RAM, 60Hz, older SoC
 *
 * Android: uses `benchmarkLevel` (1 = best, ~50 = worst). Threshold ≥ 30 = degradation.
 * iOS: `benchmarkLevel` is NOT exposed. Uses model name + system version heuristics.
 *
 * Use this to gate heavy animations, particle effects, and aggressive prefetching.
 * Always pair with `prefers-reduced-motion` for accessibility — this hook is for
 * performance, not accessibility.
 */
export function useDeviceTier(): {
  tier: DeviceTier
  benchmarkLevel: number | null
  isPrimary: boolean
  isDegradation: boolean
} {
  return useMemo(() => {
    try {
      const info = Taro.getSystemInfoSync()
      const benchmarkLevel =
        typeof info.benchmarkLevel === 'number' ? info.benchmarkLevel : null

      // Android: benchmarkLevel is available
      if (benchmarkLevel != null) {
        const isDegradation = benchmarkLevel >= 30
        return {
          tier: isDegradation ? 'degradation' : 'primary',
          benchmarkLevel,
          isPrimary: !isDegradation,
          isDegradation,
        }
      }

      // iOS: benchmarkLevel is NOT exposed — use model heuristics
      const model = (info.model ?? '').toLowerCase()
      const system = (info.system ?? '').toLowerCase()

      // iPhone XR and older, or iOS < 15
      const oldModel =
        /iphone\s*(x|8|7|6|se)/.test(model) && !/iphone\s*xs|iphone\s*1[1-9]/.test(model)
      const oldOS = system.startsWith('ios ') && parseFloat(system.replace('ios ', '')) < 15

      const isDegradation = oldModel || oldOS
      return {
        tier: isDegradation ? 'degradation' : 'primary',
        benchmarkLevel: null,
        isPrimary: !isDegradation,
        isDegradation,
      }
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
