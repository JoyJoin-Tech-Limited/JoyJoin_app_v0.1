/**
 * Cross-page onboarding asset prefetch (2026-08-18).
 *
 * The profile-review payoff (UnboxingCeremony) needs three CDN blind-box
 * layers the moment it mounts, and the extended-data heat grid wants its
 * first-per-category interest illustrations warm on first paint. Both are
 * warmed during the extended-data submitting gap / idle time instead of at
 * their moment of need.
 *
 * Rules: fire-and-forget (never awaited by the submit path), one-shot per
 * session, silent on failure — the consuming surfaces must render through
 * their normal paths even when prefetch fails.
 */

import Taro from '@tarojs/taro'
import { INTEREST_TAXONOMY } from '@shared/interests'
import {
  BLIND_BOX_BODY_ASSET,
  BLIND_BOX_INTERIOR_ASSET,
  BLIND_BOX_LID_ASSET,
} from '../mascot/blindBoxAssets'
import { getInterestAssetUrl } from './interestAssets'
import { logInfo } from './logger'

let ceremonyPrefetched = false
let interestIllustrationsPrefetched = false

async function isWeakNetwork(): Promise<boolean> {
  try {
    const network = await Taro.getNetworkType()
    return network.networkType === '2g'
  } catch {
    // Best-effort: continue prefetching if network detection fails
    return false
  }
}

/**
 * Warm the three blind-box layers for UnboxingCeremony. No 2G skip: these
 * assets MUST render at the ceremony anyway, so prefetching only moves the
 * same bytes earlier. Call during the extended-data submitting gap.
 */
export async function prefetchCeremonyAssets(): Promise<void> {
  if (ceremonyPrefetched) return
  ceremonyPrefetched = true
  const urls = [BLIND_BOX_BODY_ASSET, BLIND_BOX_LID_ASSET, BLIND_BOX_INTERIOR_ASSET]
  logInfo('[OnboardingPrefetch] Warming ceremony art', { count: urls.length })
  for (const url of urls) {
    Taro.getImageInfo({ src: url }).catch(() => {
      // Silent — ceremony renders via its normal paths when prefetch fails
    })
  }
}

/**
 * Warm the first interest illustration of each of the 6 macro categories so
 * the heat grid's initial view pops without image flash. Progressive
 * enhancement — skipped on 2G. Call once after first contentful render.
 */
export async function prefetchInterestIllustrations(): Promise<void> {
  if (interestIllustrationsPrefetched) return
  interestIllustrationsPrefetched = true
  if (await isWeakNetwork()) return

  const firstPerCategory: string[] = []
  const seen = new Set<string>()
  for (const interest of INTEREST_TAXONOMY) {
    if (!seen.has(interest.macroCategory)) {
      seen.add(interest.macroCategory)
      firstPerCategory.push(interest.id)
    }
  }

  logInfo('[OnboardingPrefetch] Warming interest illustrations', { count: firstPerCategory.length })
  for (const id of firstPerCategory) {
    try {
      await Taro.getImageInfo({ src: getInterestAssetUrl(id) })
    } catch {
      // Silent — the heat card falls back to its existing loading path
    }
  }
}
