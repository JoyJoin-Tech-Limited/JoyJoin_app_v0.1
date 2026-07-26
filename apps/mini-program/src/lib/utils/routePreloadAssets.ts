import { cdnAsset, localAsset } from './cdnAssets'
import {
  BLIND_BOX_BODY_ASSET,
  BLIND_BOX_INTERIOR_ASSET,
  BLIND_BOX_LID_ASSET,
} from '../mascot/blindBoxAssets'
import { MILESTONE_BADGES } from '../milestoneBadges'
import { getXiaoyueExpressionAsset } from '../mascot/xiaoyueExpressions'
import { getIdentityStageLayerUrl, IDENTITY_STAGE_LAYER_IDS } from '../profile/identityStageAssets'
import { preloadImagesWithDiagnostics } from './imagePreload'
import { cacheAssets } from './persistentAssetCache'
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

const ORACLE_CARD_CORNER_PRELOADS: string[] = [
  // OracleCard / FootprintOracleCard event-type corner vignettes — rendered
  // above the fold on both Discover pool cards and Events footprint cards.
  cdnAsset('/assets/lovart/oraclecard-corner-dining-20260623-v1.webp'),
  cdnAsset('/assets/lovart/oraclecard-corner-drinks-20260623-v1.webp'),
]

const DISCOVER_PRELOADS: string[] = [
  // Discover hero banner is CDN-only; local bundle removed to keep main package
  // under 2 MB. Persistent asset cache reduces repeat network reads.
  cdnAsset('/assets/promo/banner-hero-lovart-v1.webp'),
  ...ORACLE_CARD_CORNER_PRELOADS,
]

// ─── Tab pages (first viewport) ───
// Cross-tab predictive preloading warms the assets a user is most likely to
// see on the next tab they switch to, so a warm tab switch paints instantly
// instead of decoding images on first render.

const EVENTS_TAB_PRELOADS: string[] = [
  ...ORACLE_CARD_CORNER_PRELOADS,
  // Empty-state hero + first-event celebration badge.
  cdnAsset('/assets/lovart/lovart-generic-empty.webp'),
  MILESTONE_BADGES.firstEvent,
]

const CONNECTIONS_TAB_PRELOADS: string[] = [
  // Empty-state mascot + guidance flow icons.
  cdnAsset('/assets/personality/xiaoyue/xiaoyue-connections-empty.webp'),
  cdnAsset('/assets/icons/flow-icons/flow-5.webp'),
  cdnAsset('/assets/icons/flow-icons/flow-6.webp'),
  cdnAsset('/assets/icons/flow-icons/flow-7.webp'),
]

const CENTER_HUB_TAB_PRELOADS: string[] = [
  // Welcome mascot + coach illustration + guidance flow icons.
  getXiaoyueExpressionAsset('homeWelcome'),
  cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp'),
  cdnAsset('/assets/icons/flow-icons/flow-1.webp'),
  cdnAsset('/assets/icons/flow-icons/flow-2.webp'),
  cdnAsset('/assets/icons/flow-icons/flow-3.webp'),
  cdnAsset('/assets/icons/flow-icons/flow-4.webp'),
]

const PROFILE_TAB_PRELOADS: string[] = [
  // HD-2D identity stage scene layers (manifest-driven; empty until art ships).
  ...IDENTITY_STAGE_LAYER_IDS
    .map((layerId) => getIdentityStageLayerUrl(layerId))
    .filter((url): url is string => typeof url === 'string'),
  // Growth-section milestone badges.
  MILESTONE_BADGES.firstEvent,
  MILESTONE_BADGES.streak3,
]

const MATCHING_PRELOADS: string[] = [
  // Matching heroes now bundled locally
]

const EVENT_DETAIL_PRELOADS: string[] = [
  // Xiaoyue event-detail-tip now bundled locally
]

const PERSONALITY_TEST_PRELOADS = [
  // Intro animation assets (already preloaded at app launch, but include
  // here for route-level redundancy + future additions)
  cdnAsset('/assets/personality/xiaoyue/xiaoyue-intro-animated.webp'),
  cdnAsset('/assets/personality/xiaoyue/xiaoyue-intro-static.webp'),
  cdnAsset('/assets/mascot/xiaoyue-welcome.webp'),
]

const SQUAD_UNBOXING_PRELOADS = [
  BLIND_BOX_BODY_ASSET,
  BLIND_BOX_LID_ASSET,
  BLIND_BOX_INTERIOR_ASSET,
  // Composed-hero host (flag-gated in the page; preloading is harmless when off).
  cdnAsset('/assets/lovart/squad/squad-host-xiaoyue.webp'),
]

const ICEBREAKER_PRELOADS = [
  // Backgrounds (~452KB total)
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-auction.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-group-mirror.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-personality-dice.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-quip-battle.jpg'),
  cdnAsset('/assets/lovart/icebreaker/backgrounds/bg-undercover-word.jpg'),
  // Celebrations (~93KB total, WebP)
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-auction-sold.webp'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-dice-reveal.webp'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-mirror-result.webp'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-quip-champion.webp'),
  cdnAsset('/assets/lovart/icebreaker/celebrations/celebration-undercover-secret.webp'),
]

const POOL_REGISTRATION_PRELOADS = [
  ...MATCHING_PRELOADS,
  // Pool-registration Step 0 hero — CDN primary with local fallback. Preload both
  // variants since eventType is not known until the page renders.
  cdnAsset('/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp'),
  cdnAsset('/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp'),
  // Puzzle-pile particle — single tinted asset used for the persona pile animation.
  cdnAsset('/assets/lovart/lovart-particle-purple-20260701-v1.webp'),
]

const REWARDS_PRELOADS = [
  cdnAsset('/assets/lovart/lovart-rewards-empty-20260423-v1.webp'),
  cdnAsset('/assets/lovart/lovart-rewards-shop-20260423-v1.webp'),
  cdnAsset('/assets/lovart/lovart-rewards-history-20260423-v1.webp'),
]

/** Map of page path → CDN assets to preload when entering that page. */
export const ROUTE_PRELOAD_MAP: Record<string, string[]> = {
  'pages/discover/index': DISCOVER_PRELOADS,
  'pages/events/index': EVENTS_TAB_PRELOADS,
  'pages/connections/index': CONNECTIONS_TAB_PRELOADS,
  'pages/center-hub/index': CENTER_HUB_TAB_PRELOADS,
  'pages/profile/index': PROFILE_TAB_PRELOADS,
  'pages/index/index': PERSONALITY_TEST_PRELOADS, // landing → personality test is the primary CTA
  'pages/pool-registration/index': POOL_REGISTRATION_PRELOADS,
  'pages/matching-status/index': MATCHING_PRELOADS,
  'pages/event-detail/index': EVENT_DETAIL_PRELOADS,
  'pages/icebreaker-session/index': ICEBREAKER_PRELOADS,
  'pages/profile-linked/rewards/index': REWARDS_PRELOADS,
  'pages/onboarding/personality-test/index': PERSONALITY_TEST_PRELOADS,
  'pages/squad-unboxing/index': SQUAD_UNBOXING_PRELOADS,
}

// ─── Predictive (preload next likely page) ───

/** Map of page path → routes whose assets should be preloaded when idle.
 *  Tab pages include their adjacent tabs so a warm tab switch paints instantly. */
export const PREDICTIVE_PRELOAD_MAP: Record<string, string[]> = {
  'pages/discover/index': [
    'pages/pool-registration/index',
    'pages/event-detail/index',
    'pages/events/index',
    'pages/center-hub/index',
  ],
  'pages/events/index': [
    'pages/event-detail/index',
    'pages/pool-registration/index',
    'pages/discover/index',
    'pages/center-hub/index',
  ],
  'pages/connections/index': ['pages/event-detail/index', 'pages/events/index', 'pages/profile/index'],
  'pages/profile/index': ['pages/profile-linked/edit-profile/index', 'pages/events/index', 'pages/connections/index'],
  'pages/center-hub/index': ['pages/events/index', 'pages/discover/index', 'pages/connections/index'],
  'pages/index/index': ['pages/onboarding/personality-test/index'],
  'pages/pool-registration/index': ['pages/matching-status/index'],
  'pages/matching-status/index': ['pages/squad-unboxing/index'],
  'pages/event-detail/index': ['pages/pool-registration/index'],
}

// ─── Preload API ───

/**
 * Session-level dedup. Cross-tab predictive preloading means the same asset
 * is often listed by several routes; without this, bouncing between tabs
 * re-issues getImageInfo for images that are already warm.
 */
const sessionPreloadedUrls = new Set<string>()

function takeFreshAssets(assets: string[]): string[] {
  const fresh: string[] = []
  for (const url of assets) {
    if (!url || sessionPreloadedUrls.has(url)) continue
    sessionPreloadedUrls.add(url)
    fresh.push(url)
  }
  return fresh
}

/**
 * Preload CDN assets for a specific route.
 * Fails silently — logs diagnostics in development.
 */
export function preloadRouteAssets(route: string): void {
  const assets = takeFreshAssets(ROUTE_PRELOAD_MAP[route] ?? [])
  if (assets.length === 0) return

  // Defer by one tick so we never block first paint or interaction.
  setTimeout(() => {
    void preloadImagesWithDiagnostics(assets, route)
    // Persistent cache in background — return visitors get zero-network reads.
    void cacheAssets(assets, 2)
  }, 0)
}

/**
 * Predictively preload assets for likely next pages.
 * Runs during idle time (deferred 500ms) to avoid competing with current page.
 */
export function preloadPredictiveAssets(currentRoute: string): void {
  const nextRoutes = PREDICTIVE_PRELOAD_MAP[currentRoute]
  if (!nextRoutes || nextRoutes.length === 0) return

  const assets = takeFreshAssets(
    nextRoutes
      .flatMap((r) => ROUTE_PRELOAD_MAP[r] ?? [])
      .filter(Boolean)
  )

  if (assets.length === 0) return

  setTimeout(() => {
    logInfo('[preload] Predictive', { from: currentRoute, nextRoutes, assetCount: assets.length })
    void preloadImagesWithDiagnostics(assets, `predictive:${currentRoute}`)
    void cacheAssets(assets, 2)
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
