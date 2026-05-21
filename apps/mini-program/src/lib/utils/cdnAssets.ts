/**
 * CDN asset delivery helper for JoyJoin Mini Program.
 *
 * Set `TARO_APP_CDN_BASE_URL` env var (or in `.env.local`) to serve large
 * assets from CDN instead of bundling them into the WeChat package.
 *
 * Example:
 *   TARO_APP_CDN_BASE_URL=https://joyjoinapp.com/static
 *
 * Production builds MUST have a CDN base URL set. Local dev may fall back
 * to local paths, but a warning is emitted.
 */

const DEFAULT_CDN_BASE_URL = ''

export const CDN_BASE_URL = (
  process.env.TARO_APP_CDN_BASE_URL ?? DEFAULT_CDN_BASE_URL
).replace(/\/$/, '')

const isProductionBuild = process.env.NODE_ENV === 'production'

/** Returns CDN URL if configured, otherwise the local path. */
export function cdnAsset(localPath: string): string {
  if (!CDN_BASE_URL) {
    if (isProductionBuild) {
      throw new Error(
        `[cdnAsset] TARO_APP_CDN_BASE_URL is not set in production build. ` +
          `Asset "${localPath}" cannot resolve. ` +
          `Set TARO_APP_CDN_BASE_URL in apps/mini-program/.env.local and rebuild.`
      )
    }
    // eslint-disable-next-line no-console
    console.warn(
      `[cdnAsset] TARO_APP_CDN_BASE_URL is not set. ` +
        `Asset "${localPath}" will use local path, which may be missing in production.`
    )
    return localPath
  }
  // localPath always starts with /
  return `${CDN_BASE_URL}${localPath}`
}
