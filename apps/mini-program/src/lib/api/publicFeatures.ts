import { apiRequest } from './api'

/**
 * Auth-free feature flags for the anonymous onboarding surface.
 * Only booleans that are safe to disclose before login belong here.
 */
export interface PublicFeatureFlags {
  onboardingLoginTimingExperiment?: boolean
}

const CACHE_MS = 60_000
let cache: { at: number; value: PublicFeatureFlags } | null = null

export async function getPublicFeatureFlags(): Promise<PublicFeatureFlags> {
  if (cache && Date.now() - cache.at < CACHE_MS) {
    return cache.value
  }
  const value = await apiRequest<PublicFeatureFlags>({ path: '/api/public/features' })
  cache = { at: Date.now(), value }
  return value
}
