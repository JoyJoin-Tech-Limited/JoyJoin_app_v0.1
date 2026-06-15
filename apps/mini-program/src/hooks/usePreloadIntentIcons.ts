import { useEffect, useMemo, useRef } from 'react'
import Taro from '@tarojs/taro'
import { INTENT_FLOW_OPTIONS } from '../pages/pool-registration/flowConfig'

/**
 * Pre-warm bundled intent icon assets so they render instantly when the
 * user reaches the intent step. Paths are derived from INTENT_FLOW_OPTIONS
 * so new intents don't silently drift out of the preload list.
 *
 * The preload is skipped on very weak networks (2G) where the subpackage
 * download itself is the bottleneck, and guarded by a one-shot flag so it
 * does not re-run on background refetches.
 */
export function usePreloadIntentIcons(enabled: boolean) {
  const hasPreloaded = useRef(false)

  const iconPaths = useMemo(() => {
    const pathMap: Record<string, string> = {
      '👋': require('../assets/icons/intent-icons/intent-friends.webp') as string,
      '🤝': require('../assets/icons/intent-icons/intent-networking.webp') as string,
      '💬': require('../assets/icons/intent-icons/intent-discussion.webp') as string,
      '🎉': require('../assets/icons/intent-icons/intent-fun.webp') as string,
      '💕': require('../assets/icons/intent-icons/intent-romance.webp') as string,
      '🎲': require('../assets/icons/intent-icons/intent-flexible.webp') as string,
    }
    return INTENT_FLOW_OPTIONS.map((option) => pathMap[option.emoji ?? ''])
      .filter(Boolean) as string[]
  }, [])

  useEffect(() => {
    if (!enabled || hasPreloaded.current) return

    const preload = async () => {
      try {
        const network = await Taro.getNetworkType()
        // Skip on 2G: subpackage download is the bottleneck, not image decode.
        if (network.networkType === '2g') return
      } catch {
        // Best-effort: continue preloading if network detection fails
      }

      hasPreloaded.current = true
      for (const url of iconPaths) {
        Taro.getImageInfo({ src: url }).catch(() => {
          // Silent — local preload is best-effort
        })
      }
    }

    preload()
  }, [enabled, iconPaths])
}
