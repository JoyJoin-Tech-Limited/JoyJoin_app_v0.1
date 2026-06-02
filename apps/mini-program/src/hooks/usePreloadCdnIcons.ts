import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { cdnAsset } from '../lib/utils/cdnAssets'

/**
 * Preload CDN icon assets in the background.
 *
 * Uses Taro.getImageInfo to force the WeChat native image layer to
 * decode and cache the asset before it is rendered. This eliminates
 * pop-in for CDN-loaded icons in latency-sensitive flows (icebreaker).
 *
 * Failed preloads are silently ignored — the Image component will
 * retry on render with its own onError fallback.
 */
export function usePreloadCdnIcons(assetPaths: string[]) {
  useEffect(() => {
    if (!assetPaths.length) return

    // Fire all preloads in parallel; don't block on failures
    Promise.allSettled(
      assetPaths.map((path) =>
        Taro.getImageInfo({ src: cdnAsset(path) }).catch(() => {
          // Silently ignore preload failures
        }),
      ),
    )
  }, [assetPaths])
}

/** Common icebreaker reaction icon CDN paths. */
export const ICEBREAKER_REACTION_ASSETS = [
  '/assets/icons/reaction-icons/reaction-funny.webp',
  '/assets/icons/reaction-icons/reaction-fire.webp',
  '/assets/icons/reaction-icons/reaction-clap.webp',
  '/assets/icons/reaction-icons/reaction-celebrate.webp',
  '/assets/icons/reaction-icons/reaction-rose.webp',
  '/assets/icons/reaction-icons/reaction-think.webp',
  '/assets/icons/reaction-icons/reaction-wow.webp',
]

/** Common icebreaker reveal icon CDN paths. */
export const ICEBREAKER_REVEAL_ASSETS = [
  '/assets/icons/reveal-icons/reveal-same-relationship.webp',
  '/assets/icons/reveal-icons/reveal-same-archetype-band.webp',
  '/assets/icons/reveal-icons/reveal-same-work-industry.webp',
  '/assets/icons/reveal-icons/reveal-exact-archetype.webp',
  '/assets/icons/reveal-icons/reveal-hometown-industry.webp',
]

/** Common achievement badge CDN paths (top 5 most likely). */
export const COMMON_ACHIEVEMENT_ASSETS = [
  '/assets/icons/achievement-badges/achievement-first-answer.webp',
  '/assets/icons/achievement-badges/achievement-quick-thinker.webp',
  '/assets/icons/achievement-badges/achievement-explorer.webp',
  '/assets/icons/achievement-badges/achievement-destined-match.webp',
  '/assets/icons/achievement-badges/achievement-halfway-hero.webp',
]
