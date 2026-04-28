/**
 * CDN asset delivery helper for JoyJoin Mini Program.
 *
 * Set `TARO_APP_CDN_BASE_URL` env var (or in `.env.local`) to serve large
 * assets from CDN instead of bundling them into the WeChat package.
 *
 * Example:
 *   TARO_APP_CDN_BASE_URL=https://cdn.yuejuapp.com
 *
 * When unset, assets fall back to local paths (dev / self-hosted builds).
 */

const DEFAULT_CDN_BASE_URL = ''

export const CDN_BASE_URL = (
  process.env.TARO_APP_CDN_BASE_URL ?? DEFAULT_CDN_BASE_URL
).replace(/\/$/, '')

/** Returns CDN URL if configured, otherwise the local path. */
export function cdnAsset(localPath: string): string {
  if (!CDN_BASE_URL) return localPath
  // localPath always starts with /
  return `${CDN_BASE_URL}${localPath}`
}
