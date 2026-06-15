import { useEffect, useMemo, useRef } from 'react'
import Taro from '@tarojs/taro'
import { INTEREST_CATEGORY_EMOJIS } from '@shared/api'

/**
 * Pre-warm bundled interest-category icon assets so they render instantly
 * when the user reaches the interest-heat picker.
 *
 * The preload is skipped on very weak networks (2G) and guarded by a one-shot
 * flag so it does not re-run on background refetches.
 */
export function usePreloadCategoryIcons(enabled: boolean) {
  const hasPreloaded = useRef(false)

  const iconPaths = useMemo(() => {
    const pathMap: Record<string, string> = {
      '🍜': require('../assets/icons/category-icons/category-food.webp') as string,
      '🎮': require('../assets/icons/category-icons/category-entertainment.webp') as string,
      '🌿': require('../assets/icons/category-icons/category-lifestyle.webp') as string,
      '🎭': require('../assets/icons/category-icons/category-culture.webp') as string,
      '👥': require('../assets/icons/category-icons/category-social.webp') as string,
    }
    return Object.values(INTEREST_CATEGORY_EMOJIS)
      .map((emoji) => pathMap[emoji])
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
