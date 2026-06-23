import Taro from '@tarojs/taro'
import { INTENT_FLEXIBLE_OPTION, INTENT_OPTIONS } from '@shared/constants'
import { getIconMapping, getLocalIconAssetPath, CDN_ICON_TIERS } from '@joyjoin/shared/iconSystem'
import spritesheetManifest from '../../assets/mascot/xiaoyue-spritesheet-manifest.json'
import { PERSONALITY_EMOJI_ASSETS } from './personalityEmojiAssets'
import { CEREMONY_HEROES } from '../ceremonyHeroes'
import { MILESTONE_BADGES } from '../milestoneBadges'
import { getXiaoyueExpressionAsset } from '../mascot/xiaoyueExpressions'
import { cdnAsset, localAsset } from './cdnAssets'
import { logInfo } from './logger'
import { preloadImagesWithDiagnostics } from './imagePreload'
import { cacheAssets, clearAssetCacheOnVersionChange } from './persistentAssetCache'
import { ONBOARDING_CRITICAL_CDN_ASSETS } from './routePreloadAssets'

/**
 * Staggered onboarding asset preloader.
 *
 * Runs once at app launch and warms the small, high-impact raster assets the
 * onboarding flow needs before first paint. Heavier bundles are deferred and
 * gated by device capability / network quality so launch is not penalized.
 *
 * Bundles:
 *   - Tier 1 (immediate): intro animation + welcome mascot
 *   - Tier 2 (~400ms): test expressions, personality emoji icons, intent icons,
 *     milestone badge, welcome-back ceremony hero
 *   - Tier 3 (~1200ms): only a curated set of mascot sprite sheets on capable
 *     devices + good networks. Archetype full-body images and the archetype
 *     spritesheet are intentionally omitted here — they are preloaded by the
 *     onboarding subpackage pages when the user actually enters them.
 */

/** Tier 1 — must be warm before personality-test intro renders. */
function getCriticalAssets(): string[] {
  // ONBOARDING_CRITICAL_CDN_ASSETS stores raw root-relative paths; wrap them
  // with cdnAsset() so production builds resolve to the CDN.
  return ONBOARDING_CRITICAL_CDN_ASSETS.map(cdnAsset)
}

/** Tier 2 — expressions and icons used during the test + early onboarding steps. */
function getTestPhaseAssets(): string[] {
  const expressionIds = [
    'testCurious',
    'testListening',
    'testNod',
    'testSurprised',
    'loadingSystem',
    'actionFailure',
    'coachGuide',
    'thanksFeedback',
  ] as const

  return [
    ...expressionIds.map((id) => getXiaoyueExpressionAsset(id)),
    ...Object.values(PERSONALITY_EMOJI_ASSETS),
    ...getIntentIconUrls(),
    MILESTONE_BADGES.quizHalfway,
    CEREMONY_HEROES.welcomeBack,
  ].filter(Boolean)
}

/** Tier 3 — small curated sprite set; skipped on low-end or weak networks. */
function getHeavyAssets(): string[] {
  // Core sprite states most likely to appear during the first session.
  // We deliberately do NOT preload the full 20-sheet manifest here.
  const coreStates: Array<keyof typeof spritesheetManifest.states> = [
    'welcome',
    'idle',
    'coach',
    'loading',
    'listening',
    'thinking',
  ]

  const spriteSheets = coreStates
    .map((state) => spritesheetManifest.states[state]?.sheet)
    .filter(Boolean)
    .map((sheet) => localAsset(`/assets/mascot/${sheet}`))

  return spriteSheets
}

/** Build local URLs for every bundled intent icon. */
function getIntentIconUrls(): string[] {
  const options = [...INTENT_OPTIONS, INTENT_FLEXIBLE_OPTION]
  return options
    .map((option) => {
      const emoji = option.emoji
      if (!emoji) return ''
      const mapping = getIconMapping(emoji, 'intent')
      if (!mapping) return ''
      if (CDN_ICON_TIERS.has(mapping.tier)) return ''
      try {
        return localAsset(getLocalIconAssetPath(mapping.assetKey, mapping.tier, 1))
      } catch {
        return ''
      }
    })
    .filter(Boolean)
}

let hasPreloadedOnboardingAssets = false
const activeTimers: ReturnType<typeof setTimeout>[] = []

function clearPreloadTimers(): void {
  while (activeTimers.length > 0) {
    const timer = activeTimers.pop()
    if (timer != null) clearTimeout(timer)
  }
}

function schedulePreload(assets: string[], context: string, delayMs: number, concurrency?: number): void {
  if (assets.length === 0) return

  const timer = setTimeout(() => {
    const index = activeTimers.indexOf(timer)
    if (index !== -1) activeTimers.splice(index, 1)
    void preloadImagesWithDiagnostics(assets, context, concurrency)
  }, delayMs)
  activeTimers.push(timer)
}

async function shouldSkipPreload(): Promise<{ skip: boolean; reason?: string }> {
  try {
    const { networkType } = await Taro.getNetworkType()
    if (networkType === 'none' || networkType === '2g') {
      return { skip: true, reason: `network:${networkType}` }
    }
  } catch {
    // If we can't detect the network, proceed optimistically.
  }
  return { skip: false }
}

function shouldSkipHeavyTier(): { skip: boolean; reason?: string } {
  try {
    const info = Taro.getSystemInfoSync()
    const benchmark = (info as any).benchmarkLevel
    if (typeof benchmark === 'number' && benchmark > 0 && benchmark <= 15) {
      return { skip: true, reason: `low-end:benchmark-${benchmark}` }
    }
  } catch {
    // Proceed optimistically if system info is unavailable.
  }
  return { skip: false }
}

/**
 * Preload onboarding assets in staggered tiers.
 *
 * Safe to call multiple times — it is a one-shot operation. Respects weak
 * networks by skipping entirely on 2G/offline and defers heavy sprites on
 * low-end devices.
 */
export async function preloadOnboardingAssets(): Promise<void> {
  if (hasPreloadedOnboardingAssets) return
  hasPreloadedOnboardingAssets = true

  // Invalidate stale local cache if app version changed.
  clearAssetCacheOnVersionChange()

  const networkCheck = await shouldSkipPreload()
  if (networkCheck.skip) {
    logInfo('[preloadOnboardingAssets] Skipped — weak or no network', { reason: networkCheck.reason })
    return
  }

  const critical = getCriticalAssets()
  const testPhase = getTestPhaseAssets()
  const heavyCheck = shouldSkipHeavyTier()
  const heavy = heavyCheck.skip ? [] : getHeavyAssets()

  logInfo('[preloadOnboardingAssets] Starting staggered preload', {
    critical: critical.length,
    testPhase: testPhase.length,
    heavy: heavy.length,
    skipHeavyReason: heavyCheck.reason,
  })

  // Tier 1: immediate — small, high-impact intro assets.
  schedulePreload(critical, 'onboarding:critical', 0)

  // Tier 2: defer slightly so the critical bundle goes first.
  schedulePreload(testPhase, 'onboarding:test-phase', 400)

  // Tier 3: heavy sprite sheets — lowest priority, concurrency-limited.
  if (heavy.length > 0) {
    schedulePreload(heavy, 'onboarding:heavy', 1200, 2)
  }

  // Tier 4: persist critical + test phase assets to local storage for zero-network
  // return visits. Runs after warm-preloads have started, deferred so it never
  // competes with first-paint critical path.
  const persistTargets = [...critical, ...testPhase]
  if (persistTargets.length > 0) {
    const timer = setTimeout(() => {
      const idx = activeTimers.indexOf(timer)
      if (idx !== -1) activeTimers.splice(idx, 1)
      void cacheAssets(persistTargets, 2)
    }, 2000)
    activeTimers.push(timer)
  }
}

/**
 * Reset the one-shot guard and cancel pending timers. Intended for tests only.
 */
export function __resetOnboardingPreloadGuard(): void {
  hasPreloadedOnboardingAssets = false
  clearPreloadTimers()
}
