import { cdnAsset } from './cdnAssets'
import { preloadImagesWithDiagnostics } from './imagePreload'
import { logInfo } from './logger'

/**
 * Smart route-based CDN asset preloading.
 *
 * Strategy:
 *  - Critical: preload on app launch (archetype glyphs, fonts)
 *  - Route:    preload when entering a page (assets for current + likely next screens)
 *  - Idle:     preload during downtime (low-priority decorative assets)
 *
 * All preloads are fire-and-forget. Failed preloads are silently ignored —
 * the consumer will retry on render with its own onError fallback.
 */

// ─── Critical (app launch) ───

/** Archetype glyph CDN paths (used across profile, matching, results). */
export const ARCHETYPE_GLYPH_CDN_ASSETS = [
  cdnAsset('/assets/archetypes/archetype-corgi.webp'),
  cdnAsset('/assets/archetypes/archetype-rooster.webp'),
  cdnAsset('/assets/archetypes/archetype-hamster_praise.webp'),
  cdnAsset('/assets/archetypes/archetype-fox.webp'),
  cdnAsset('/assets/archetypes/archetype-dolphin_calm.webp'),
  cdnAsset('/assets/archetypes/archetype-spider.webp'),
  cdnAsset('/assets/archetypes/archetype-koala.webp'),
  cdnAsset('/assets/archetypes/archetype-octopus.webp'),
  cdnAsset('/assets/archetypes/archetype-owl.webp'),
  cdnAsset('/assets/archetypes/archetype-elephant.webp'),
  cdnAsset('/assets/archetypes/archetype-turtle.webp'),
  cdnAsset('/assets/archetypes/archetype-cat.webp'),
]

// ─── Per-route asset lists ───

const DISCOVER_PRELOADS = [
  cdnAsset('/assets/promo/banner-ai-match-calculated.webp'),
  cdnAsset('/assets/promo/banner-ai-match-same-frequency.webp'),
  cdnAsset('/assets/promo/banner-ai-match-understands-you.webp'),
]

const MATCHING_PRELOADS = [
  cdnAsset('/assets/matching/matching-bg.webp'),
  cdnAsset('/assets/matching/matching-waiting-hero.webp'),
  cdnAsset('/assets/matching/matching-no-match-hero.webp'),
]

const EVENT_DETAIL_PRELOADS = [
  cdnAsset('/assets/personality/xiaoyue/xiaoyue-event-detail-tip.webp'),
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
