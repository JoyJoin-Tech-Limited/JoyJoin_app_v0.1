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
      Taro.getImageInfo({ src: cdnAsset(path) }).catch(() => {
        // Silently ignore preload failures
      }),
    ),
  )
}

/**
 * Hook wrapper around {@link preloadCdnAssets}.
 */
export function usePreloadCdnIcons(assetPaths: string[]) {
  useEffect(() => {
    void preloadCdnAssets(assetPaths)
  }, [assetPaths])
}

/** Archetype glyph CDN paths (used across profile, matching, results). */
export const ARCHETYPE_GLYPH_ASSETS = [
  '/assets/archetypes/archetype-corgi.webp',
  '/assets/archetypes/archetype-rooster.webp',
  '/assets/archetypes/archetype-hamster_praise.webp',
  '/assets/archetypes/archetype-fox.webp',
  '/assets/archetypes/archetype-dolphin_calm.webp',
  '/assets/archetypes/archetype-spider.webp',
  '/assets/archetypes/archetype-koala.webp',
  '/assets/archetypes/archetype-octopus.webp',
  '/assets/archetypes/archetype-owl.webp',
  '/assets/archetypes/archetype-elephant.webp',
  '/assets/archetypes/archetype-turtle.webp',
  '/assets/archetypes/archetype-cat.webp',
]

/** Xiaoyue sprite sheet CDN paths (used in icebreaker sessions). */
export const SPRITE_SHEET_ASSETS = [
  '/assets/mascot/xiaoyue-celebrate.webp',
  '/assets/mascot/xiaoyue-coach.webp',
  '/assets/mascot/xiaoyue-curious.webp',
  '/assets/mascot/xiaoyue-empty.webp',
  '/assets/mascot/xiaoyue-error.webp',
  '/assets/mascot/xiaoyue-idle.webp',
  '/assets/mascot/xiaoyue-intro.webp',
  '/assets/mascot/xiaoyue-listening.webp',
  '/assets/mascot/xiaoyue-loading.webp',
  '/assets/mascot/xiaoyue-neutral.webp',
  '/assets/mascot/xiaoyue-nod.webp',
  '/assets/mascot/xiaoyue-reassure.webp',
  '/assets/mascot/xiaoyue-reveal.webp',
  '/assets/mascot/xiaoyue-success.webp',
  '/assets/mascot/xiaoyue-surprised.webp',
  '/assets/mascot/xiaoyue-thanks.webp',
  '/assets/mascot/xiaoyue-thinking.webp',
  '/assets/mascot/xiaoyue-trust.webp',
  '/assets/mascot/xiaoyue-waiting.webp',
  '/assets/mascot/xiaoyue-welcome.webp',
]

/** Common icebreaker reaction icon CDN paths.
 *  ⚠️ Now locally bundled — these are copied to dist/assets/ by the build.
 *  Preloading from CDN is no longer necessary. */
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
 *  ⚠️ Now locally bundled — these are copied to dist/assets/ by the build.
 *  Preloading from CDN is no longer necessary. */
export const ICEBREAKER_REVEAL_ASSETS = [
  '/assets/icons/reveal-icons/reveal-same-relationship.webp',
  '/assets/icons/reveal-icons/reveal-same-archetype-band.webp',
  '/assets/icons/reveal-icons/reveal-same-work-industry.webp',
  '/assets/icons/reveal-icons/reveal-exact-archetype.webp',
  '/assets/icons/reveal-icons/reveal-hometown-industry.webp',
]

/** Common achievement badge CDN paths (top 5 most likely).
 *  ⚠️ Now locally bundled — these are copied to dist/assets/ by the build.
 *  Preloading from CDN is no longer necessary. */
export const COMMON_ACHIEVEMENT_ASSETS = [
  '/assets/icons/achievement-badges/achievement-first-answer.webp',
  '/assets/icons/achievement-badges/achievement-quick-thinker.webp',
  '/assets/icons/achievement-badges/achievement-explorer.webp',
  '/assets/icons/achievement-badges/achievement-destined-match.webp',
  '/assets/icons/achievement-badges/achievement-halfway-hero.webp',
]
