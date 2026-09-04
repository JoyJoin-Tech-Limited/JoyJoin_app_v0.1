import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { cdnAsset } from '../lib/utils/cdnAssets'

/**
 * Imperatively preload a list of CDN asset paths.
 *
 * Uses Taro.getImageInfo to force the WeChat native image layer to
 * decode and cache the asset before it is rendered. This eliminates
 * pop-in for CDN-loaded assets in latency-sensitive flows.
 *
 * Failed preloads are silently ignored — the consumer will retry on
 * render with its own onError fallback.
 */
export function preloadCdnAssets(assetPaths: string[]): Promise<PromiseSettledResult<Taro.getImageInfo.SuccessCallbackResult>[]> {
  if (!assetPaths.length) return Promise.resolve([])

  return Promise.allSettled(
    assetPaths.map((path) =>
      Taro.getImageInfo({ src: cdnAsset(path) }).catch(() => undefined),
    ),
  ) as Promise<PromiseSettledResult<Taro.getImageInfo.SuccessCallbackResult>[]>
}

/**
 * Hook wrapper around {@link preloadCdnAssets}.
 */
export function usePreloadCdnIcons(assetPaths: string[]) {
  useEffect(() => {
    const preload = async () => {
      try {
        const network = await Taro.getNetworkType()
        // Skip on 2G: heavy CDN preloads contend with session bootstrap on weak networks.
        if (network.networkType === '2g') return
      } catch {
        // Best-effort: continue preloading if network detection fails
      }
      void preloadCdnAssets(assetPaths)
    }
    preload()
  }, [assetPaths])
}

/** Archetype full-body images — now bundled locally.
 *  Preloading from CDN is no longer necessary. */
export const ARCHETYPE_GLYPH_ASSETS: string[] = [
  // Bundled locally via copy config (config/index.ts)
]

/** Common icebreaker reaction icon CDN paths.
 *  These are CDN tiers (see CDN_ICON_TIERS); preloading warms the CDN cache. */
export const ICEBREAKER_REACTION_ASSETS = [
  '/assets/icons/reaction-icons/reaction-funny.webp',
  '/assets/icons/reaction-icons/reaction-fire.webp',
  '/assets/icons/reaction-icons/reaction-clap.webp',
  '/assets/icons/reaction-icons/reaction-celebrate.webp',
  '/assets/icons/reaction-icons/reaction-rose.webp',
  '/assets/icons/reaction-icons/reaction-think.webp',
  '/assets/icons/reaction-icons/reaction-wow.webp',
]

/** Common icebreaker reveal icon CDN paths.
 *  These are CDN tiers (see CDN_ICON_TIERS); preloading warms the CDN cache. */
export const ICEBREAKER_REVEAL_ASSETS = [
  '/assets/icons/reveal-icons/reveal-same-relationship.webp',
  '/assets/icons/reveal-icons/reveal-same-archetype-band.webp',
  '/assets/icons/reveal-icons/reveal-same-work-industry.webp',
  '/assets/icons/reveal-icons/reveal-exact-archetype.webp',
  '/assets/icons/reveal-icons/reveal-hometown-industry.webp',
]

/** Common icebreaker phase emblem CDN paths.
 *  These are CDN tiers (see CDN_ICON_TIERS); preloading warms the CDN cache. */
export const ICEBREAKER_PHASE_EMBLEM_ASSETS = [
  '/assets/icons/phase-icons/phase-warmup.webp',
  '/assets/icons/phase-icons/phase-micro-challenge.webp',
  '/assets/icons/phase-icons/phase-lie-detective.webp',
  '/assets/icons/phase-icons/phase-personality-dice.webp',
  '/assets/icons/phase-icons/phase-auction.webp',
  '/assets/icons/phase-icons/phase-mini-script.webp',
  '/assets/icons/phase-icons/phase-quip-battle.webp',
  '/assets/icons/phase-icons/phase-undercover-word.webp',
  '/assets/icons/phase-icons/phase-group-mirror.webp',
  '/assets/icons/phase-icons/phase-speed-friending.webp',
  '/assets/icons/phase-icons/phase-recap.webp',
]

/** Common achievement badge CDN paths (top 5 most likely).
 *  These are CDN tiers (see CDN_ICON_TIERS); preloading warms the CDN cache. */
export const COMMON_ACHIEVEMENT_ASSETS = [
  '/assets/icons/achievement-badges/achievement-first-answer.webp',
  '/assets/icons/achievement-badges/achievement-quick-thinker.webp',
  '/assets/icons/achievement-badges/achievement-explorer.webp',
  '/assets/icons/achievement-badges/achievement-destined-match.webp',
  '/assets/icons/achievement-badges/achievement-halfway-hero.webp',
]
