/**
 * Pure resolver for the mini-program API target.
 *
 * WeChat's `envVersion` decides the backend for 体验版 (trial) and 正式版
 * (release) builds. A 开发版 / DevTools preview build (`develop`) keeps
 * whatever `TARO_APP_API_BASE_URL` was baked in at build time — which is why
 * two installs both labelled "开发版" can talk to different backends: CI bakes
 * staging while a local build can bake production from the repo-root `.env`.
 *
 * Keeping this pure lets the build/precedence rules be tested without Taro;
 * `api.ts` supplies the live `envVersion` and the build-time URL.
 */

export const DEFAULT_MINI_PROGRAM_API_BASE_URL = 'http://localhost:5001'
export const STAGING_API_BASE_URL = 'https://staging.joyjoinapp.com'
export const PRODUCTION_API_BASE_URL = 'https://api.joyjoinapp.com'

export type MiniProgramEnvVersion = 'develop' | 'trial' | 'release' | 'unknown'
export type ApiBaseSource = 'env-version' | 'build-time'

export interface ApiBaseInfo {
  /** Normalized base URL without a trailing slash. */
  baseUrl: string
  /** WeChat runtime version bucket that produced this target. */
  envVersion: MiniProgramEnvVersion
  /** Where the URL came from: WeChat envVersion mapping or the baked build env. */
  source: ApiBaseSource
}

export function resolveApiBaseInfo(
  envVersion: string | undefined,
  buildTimeBaseUrl: string | undefined,
): ApiBaseInfo {
  const normalizedBuildUrl = (buildTimeBaseUrl || DEFAULT_MINI_PROGRAM_API_BASE_URL).replace(/\/$/, '')

  if (envVersion === 'trial') {
    return { baseUrl: STAGING_API_BASE_URL, envVersion: 'trial', source: 'env-version' }
  }
  if (envVersion === 'release') {
    return { baseUrl: PRODUCTION_API_BASE_URL, envVersion: 'release', source: 'env-version' }
  }
  if (envVersion === 'develop') {
    return { baseUrl: normalizedBuildUrl, envVersion: 'develop', source: 'build-time' }
  }
  return { baseUrl: normalizedBuildUrl, envVersion: 'unknown', source: 'build-time' }
}
