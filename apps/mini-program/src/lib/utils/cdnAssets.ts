/**
 * CDN asset delivery helper for JoyJoin Mini Program.
 *
 * Set `TARO_APP_CDN_BASE_URL` env var (or in `.env.local`) to serve large
 * assets from CDN instead of bundling them into the WeChat package.
 *
 * Example:
 *   TARO_APP_CDN_BASE_URL=https://cdn.joyjoinapp.com/static
 *
 * Production builds MUST have a CDN base URL set. Local dev may fall back
 * to local paths, but a warning is emitted.
 */

import { useCallback, useState } from 'react'

const DEFAULT_CDN_BASE_URL = ''

export const CDN_BASE_URL = (
  process.env.TARO_APP_CDN_BASE_URL ?? DEFAULT_CDN_BASE_URL
).replace(/\/$/, '')

const nodeEnv: string = (process.env.NODE_ENV as string | undefined) ?? 'development'
const isProductionBuild = nodeEnv === 'production'
const isTestEnv = nodeEnv === 'test'

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
    // Suppress noisy warnings in test output; local fallback is expected in vitest.
    if (!isTestEnv) {
      // eslint-disable-next-line no-console
      console.warn(
        `[cdnAsset] TARO_APP_CDN_BASE_URL is not set. ` +
          `Asset "${localPath}" will use local path, which may be missing in production.`
      )
    }
    return localPath
  }
  // localPath always starts with /
  return `${CDN_BASE_URL}${localPath}`
}

/**
 * Returns a local asset path for bundled mini-program assets.
 *
 * WeChat Mini Program `<image>` resolves absolute paths `/assets/...` from
 * the project root. Relative paths do not work inside Taro-compiled `<Image>`.
 *
 * Use this when the asset is shipped inside the WeChat package (under
 * `src/assets/...`) and you want to bypass the CDN entirely.
 *
 * The path must start with `/assets/` and the file must exist in
 * `apps/mini-program/src/assets/`.
 */
export function localAsset(localPath: string): string {
  if (!localPath.startsWith('/assets/')) {
    // eslint-disable-next-line no-console
    console.warn(
      `[localAsset] Path "${localPath}" does not start with /assets/. ` +
        `Only assets under src/assets/ should use localAsset().`
    )
  }
  return localPath
}

/**
 * React hook for CDN-first image loading with a local bundled fallback.
 *
 * Use this for assets that are mirrored on the CDN but also copied into the
 * WeChat package as a safety net. The hook starts with `cdnAsset(localPath)`;
 * if that fails, `onError` switches to `localAsset(localPath)`.
 *
 * @returns `{ src, onError, isLocal }` — `isLocal` is true after the CDN
 *   attempt has failed and the local fallback is active.
 */
export function useCdnFirstSrc(localPath: string) {
  const [isLocal, setIsLocal] = useState(false)
  const src = isLocal ? localAsset(localPath) : cdnAsset(localPath)
  const onError = useCallback(() => {
    setIsLocal(true)
  }, [])
  return { src, onError, isLocal }
}
