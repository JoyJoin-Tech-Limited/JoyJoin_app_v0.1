import { cdnAsset } from './cdnAssets'
import { preloadImagesWithDiagnostics } from './imagePreload'
import { logInfo } from './logger'

/**
 * Smart route-based CDN asset preloading.
 *
 * Strategy:
 *  - Critical: preload on app launch (CDN-only assets)
 *  - Route:    preload when entering a page (assets for current + likely next screens)
 *  - Idle:     preload during downtime (low-priority decorative assets)
 *
 * All preloads are fire-and-forget. Failed preloads are silently ignored —
 * the consumer will retry on render with its own onError fallback.
 *
 * NOTE: Many assets that were previously CDN-only are now bundled locally.
 *  See ASSET_STRATEGY.md for the full local vs CDN map.
 */

// ─── Critical (app launch) ───

/** Personality test intro animation — must be warm before user reaches intro.
 *  Animated WebP cannot be bundled locally (iOS limitation), so we preload
 *  at app launch to eliminate CDN latency on first paint.
 *
 *  ⚠️ These are RAW paths (not cdnAsset-wrapped). Consumers must pass them
 *  to preloadImagesWithDiagnostics or wrap with cdnAsset() themselves. */
export const ONBOARDING_CRITICAL_CDN_ASSETS: string[] = [
  '/assets/personality/xiaoyue/xiaoyue-intro-animated.webp',
  '/assets/personality/xiaoyue/xiaoyue-intro-static.webp',
  '/assets/mascot/xiaoyue-welcome.webp',
]

/** Archetype full-body images — now bundled locally, no CDN preload needed. */
export const ARCHETYPE_GLYPH_CDN_ASSETS: string[] = [
  // Bundled locally via copy config (config/index.ts)
]

// ─── Per-route asset lists ───

const DISCOVER_PRELOADS = [
  // Promo banners now bundled locally
]

const MATCHING_PRELOADS = [
  // Matching heroes now bundled locally
]

const EVENT_DETAIL_PRELOADS = [
  // Xiaoyue event-detail-tip now bundled locally
]

const PERSONALITY_TEST_PRELOADS = [
  // Intro animation assets (already preloaded at app launch, but include
  // here for route-level redundancy + future additions)
  cdnAsset('/assets/personality/xiaoyue/xiaoyue-intro-animated.webp'),
  cdnAsset('/assets/personality/xiaoyue/xiaoyue-intro-static.webp'),
  cdnAsset('/assets/mascot/xiaoyue-welcome.webp'),
]

const ICEBREAKER_PRELOADS = [
  // Backgrounds (~452KB total)
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-auction.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-group-mirror.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-personality-dice.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-quip-battle.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-undercover-word.jpg'),
  // Celebrations (~765KB total)
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-auction-sold.png'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-dice-reveal.png'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-mirror-result.png'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-quip-champion.png'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-undercover-secret.png'),
]

const POOL_REGISTRATION_PRELOADS = [
  ...MATCHING_PRELOADS,
]

const REWARDS_PRELOADS = [
  cdnAsset('/assets/lovart/lovart-rewards-empty-20260423-v1.webp'),
  cdnAsset('/assets/lovart/lovart-rewards-shop-20260423-v1.webp'),
  cdnAsset('/assets/lovart/lovart-rewards-history-20260423-v1.webp'),
]

/** Map of page path → CDN assets to preload when entering that page. */
export const ROUTE_PRELOAD_MAP: Record<string, string[]> = {
  'pages/discover/index': DISCOVER_PRELOADS,
  'pages/index/index': DISCOVER_PRELOADS, // landing → same as discover
  'pages/pool-registration/index': POOL_REGISTRATION_PRELOADS,
  'pages/matching-status/index': MATCHING_PRELOADS,
  'pages/event-detail/index': EVENT_DETAIL_PRELOADS,
  'pages/icebreaker-session/index': ICEBREAKER_PRELOADS,
  'pages/rewards/index': REWARDS_PRELOADS,
  'pages/onboarding/personality-test/index': PERSONALITY_TEST_PRELOADS,
}

// ─── Predictive (preload next likely page) ───

/** Map of page path → routes whose assets should be preloaded when idle. */
export const PREDICTIVE_PRELOAD_MAP: Record<string, string[]> = {
  'pages/discover/index': ['pages/pool-registration/index', 'pages/event-detail/index'],
  'pages/pool-registration/index': ['pages/matching-status/index'],
  'pages/event-detail/index': ['pages/pool-registration/index'],
  'pages/connections/index': ['pages/event-detail/index'],
  'pages/events/index': ['pages/event-detail/index', 'pages/pool-registration/index'],
  'pages/profile/index': ['pages/edit-profile/index'],
}

// ─── Preload API ───

/**
 * Preload CDN assets for a specific route.
 * Fails silently — logs diagnostics in development.
 */
export function preloadRouteAssets(route: string): void {
  const assets = ROUTE_PRELOAD_MAP[route]
  if (!assets || assets.length === 0) return

  // Defer by one tick so we never block first paint or interaction.
  setTimeout(() => {
    void preloadImagesWithDiagnostics(assets, route)
  }, 0)
}

/**
 * Predictively preload assets for likely next pages.
 * Runs during idle time (deferred 500ms) to avoid competing with current page.
 */
export function preloadPredictiveAssets(currentRoute: string): void {
  const nextRoutes = PREDICTIVE_PRELOAD_MAP[currentRoute]
  if (!nextRoutes || nextRoutes.length === 0) return

  const assets = nextRoutes
    .flatMap((r) => ROUTE_PRELOAD_MAP[r] ?? [])
    .filter(Boolean)

  if (assets.length === 0) return

  setTimeout(() => {
    logInfo('[preload] Predictive', { from: currentRoute, nextRoutes, assetCount: assets.length })
    void preloadImagesWithDiagnostics(assets, `predictive:${currentRoute}`)
  }, 500)
}

/**
 * One-shot preload for a custom asset list.
 * Use for one-off preloads (e.g. inside a specific component).
 */
export function preloadCustomAssets(assets: string[], context: string): void {
  if (!assets.length) return
  setTimeout(() => {
    void preloadImagesWithDiagnostics(assets, context)
  }, 0)
}
