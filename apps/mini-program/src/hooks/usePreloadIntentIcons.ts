import { useEffect, useMemo, useRef } from 'react'
import Taro from '@tarojs/taro'
import {
  getIconMapping,
  getLocalIconAssetPath,
} from '@joyjoin/shared/iconSystem'
import { localAsset } from '../lib/utils/cdnAssets'
import { logWarn } from '../lib/utils/logger'

export interface PreloadableIntentOption {
  emoji?: string
}

/**
 * Pre-warm bundled intent icon assets so they render instantly when the
 * user reaches the intent step. Paths are derived from the provided options
 * so new intents don't silently drift out of the preload list.
 *
 * The preload is skipped on very weak networks (2G) where the subpackage
 * download itself is the bottleneck, and guarded by a one-shot flag so it
 * does not re-run on background refetches.
 */
export function usePreloadIntentIcons(
  options: PreloadableIntentOption[],
  enabled: boolean,
) {
  const hasPreloaded = useRef(false)

  const iconPaths = useMemo(() => {
    return options
      .map((option) => {
        const emoji = option.emoji ?? ''
        const mapping = getIconMapping(emoji, 'intent')
        if (!mapping) return ''
        return localAsset(getLocalIconAssetPath(mapping.assetKey, mapping.tier, 1))
      })
      .filter(Boolean) as string[]
  }, [options])

  useEffect(() => {
    if (!enabled || hasPreloaded.current) return

    const preload = async () => {
      try {
        const network = await Taro.getNetworkType()
        // Skip on offline / 2G: subpackage download is the bottleneck, not image decode.
        if (network.networkType === 'none' || network.networkType === '2g') return
      } catch {
        // Best-effort: continue preloading if network detection fails
      }

      for (const url of iconPaths) {
        Taro.getImageInfo({ src: url }).catch((err) => {
          logWarn('[usePreloadIntentIcons] Intent icon preload failed', {
            url,
            error: err?.errMsg ?? String(err),
          })
        })
      }
      hasPreloaded.current = true
    }

    preload()
  }, [enabled, iconPaths])
}
