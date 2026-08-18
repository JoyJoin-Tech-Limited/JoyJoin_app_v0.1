import { afterEach, describe, expect, it, vi } from 'vitest'

/**
 * cdnAsset() contract: raw root-relative paths get the CDN base prepended;
 * already-absolute URLs pass through unchanged (idempotency).
 *
 * Regression lock for the 2026-08-17 double-wrap bug: persistentAssetCache
 * callers hand cacheAssets() cdnAsset()-wrapped URLs, and cacheAsset() wrapped
 * them AGAIN (`https://cdn…/static` + `https://cdn…/static/assets/…`) — every
 * persistent-cache download 404'd on device while renders (single-wrapped)
 * stayed fine.
 */

async function loadCdnAsset(baseUrl?: string) {
  vi.resetModules()
  if (baseUrl === undefined) {
    vi.unstubAllEnvs()
    delete process.env.TARO_APP_CDN_BASE_URL
  } else {
    vi.stubEnv('TARO_APP_CDN_BASE_URL', baseUrl)
  }
  const mod = await import('./cdnAssets')
  return mod.cdnAsset
}

afterEach(() => {
  vi.unstubAllEnvs()
  vi.resetModules()
})

describe('cdnAsset', () => {
  it('prepends the CDN base to raw root-relative paths', async () => {
    const cdnAsset = await loadCdnAsset('https://cdn.example.com/static')
    expect(cdnAsset('/assets/badges/first-event-v1.webp')).toBe(
      'https://cdn.example.com/static/assets/badges/first-event-v1.webp',
    )
  })

  it('never doubles the base on already-wrapped URLs', async () => {
    const cdnAsset = await loadCdnAsset('https://cdn.example.com/static')
    const once = cdnAsset('/assets/badges/first-event-v1.webp')
    expect(cdnAsset(once)).toBe(once)
  })

  it('passes through absolute URLs from any origin unchanged', async () => {
    const cdnAsset = await loadCdnAsset('https://cdn.example.com/static')
    expect(cdnAsset('https://other.example.com/x.webp')).toBe('https://other.example.com/x.webp')
    expect(cdnAsset('http://insecure.example.com/x.webp')).toBe('http://insecure.example.com/x.webp')
  })

  it('returns the raw path when no CDN base is configured', async () => {
    const cdnAsset = await loadCdnAsset(undefined)
    expect(cdnAsset('/assets/badges/first-event-v1.webp')).toBe('/assets/badges/first-event-v1.webp')
  })

  it('still passes absolute URLs through when no CDN base is configured', async () => {
    const cdnAsset = await loadCdnAsset(undefined)
    expect(cdnAsset('https://cdn.example.com/static/x.webp')).toBe(
      'https://cdn.example.com/static/x.webp',
    )
  })
})
