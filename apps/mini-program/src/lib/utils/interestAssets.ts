import { getInterestById } from '@shared/interests'
import { cdnAsset } from './cdnAssets'

/**
 * Resolve an interest illustration URL.
 *
 * In production builds with `TARO_APP_CDN_BASE_URL` set, this returns the CDN
 * URL (`/images/interests/{id}.webp`). The canonical `imageUrl` lives in
 * `packages/shared/src/interests.ts` so server and mini-program stay in sync.
 *
 * In local dev without a CDN base URL, `cdnAsset()` falls back to the raw
 * path. Set `TARO_APP_CDN_BASE_URL=https://cdn.joyjoinapp.com/static` in
 * `apps/mini-program/.env.local` to load from the production CDN during dev.
 */
export function getInterestAssetUrl(interestId: string): string {
  const interest = getInterestById(interestId)
  return cdnAsset(interest?.imageUrl ?? `/images/interests/${interestId}.webp`)
}
