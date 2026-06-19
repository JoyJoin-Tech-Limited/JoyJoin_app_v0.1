import Taro from '@tarojs/taro'
import { cdnAsset } from './cdnAssets'
import { logInfo, logWarn } from './logger'

let _cacheDir: string | null = null
function getCacheDir(): string {
  if (!_cacheDir) {
    try {
      _cacheDir = `${wx.env.USER_DATA_PATH}/joyjoin-cache/`
    } catch {
      _cacheDir = '/tmp/joyjoin-cache/'
    }
  }
  return _cacheDir
}
const CACHE_META_KEY = 'joyjoin_cache_meta'

interface CacheMeta {
  version: string
  cachedAt: Record<string, number>
}

let dirInitialized = false

function ensureDir(): void {
  if (dirInitialized) return
  try {
    Taro.getFileSystemManager().mkdirSync(getCacheDir(), true)
    dirInitialized = true
  } catch {}
}

function cacheKey(assetPath: string): string {
  let hash = 5381
  for (let i = 0; i < assetPath.length; i++) {
    hash = ((hash << 5) + hash) + assetPath.charCodeAt(i)
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

function localFilePath(assetPath: string): string {
  return `${getCacheDir()}${cacheKey(assetPath)}`
}

export function isCachedLocally(assetPath: string): boolean {
  try {
    const fs = Taro.getFileSystemManager()
    fs.accessSync(localFilePath(assetPath))
    return true
  } catch {
    return false
  }
}

export function getCachedPath(assetPath: string): string | null {
  try {
    const fs = Taro.getFileSystemManager()
    const lp = localFilePath(assetPath)
    fs.accessSync(lp)
    return lp
  } catch {
    return null
  }
}

export function cachedCdnUrl(assetPath: string): string {
  return getCachedPath(assetPath) ?? cdnAsset(assetPath)
}

export async function cacheAsset(assetPath: string): Promise<boolean> {
  const cdnUrl = cdnAsset(assetPath)
  if (!cdnUrl || cdnUrl === assetPath) return false

  const lp = localFilePath(assetPath)
  try {
    Taro.getFileSystemManager().accessSync(lp)
    return true
  } catch {}

  try {
    ensureDir()
    const res = await Taro.downloadFile({ url: cdnUrl })
    if (res.statusCode !== 200) {
      logWarn('[persistentCache] Download failed', { assetPath, status: res.statusCode })
      return false
    }
    Taro.getFileSystemManager().saveFileSync(res.tempFilePath, lp)
    logInfo('[persistentCache] Cached', { assetPath })
    return true
  } catch (err: unknown) {
    const msg = err && typeof err === 'object' && 'errMsg' in err
      ? (err as { errMsg: string }).errMsg
      : String(err)
    logWarn('[persistentCache] Failed to cache', { assetPath, err: msg })
    return false
  }
}

export async function cacheAssets(
  paths: string[],
  concurrency = 3,
): Promise<{ total: number; cached: number; failed: number }> {
  const uncached = paths.filter((p) => !isCachedLocally(p))
  if (uncached.length === 0) return { total: paths.length, cached: 0, failed: 0 }

  logInfo('[persistentCache] Starting batch', { total: paths.length, toDownload: uncached.length })

  let cached = 0
  let failed = 0
  let idx = 0
  let running = 0

  return new Promise((resolve) => {
    const next = () => {
      while (running < concurrency && idx < uncached.length) {
        const i = idx++
        running++
        cacheAsset(uncached[i]).then((ok) => {
          if (ok) cached++
          else failed++
          running--
          next()
        })
      }
      if (running === 0 && idx >= uncached.length) {
        logInfo('[persistentCache] Batch done', { cached, failed })
        resolve({ total: paths.length, cached, failed })
      }
    }
    next()
  })
}

export function clearAssetCache(): void {
  try {
    const fs = Taro.getFileSystemManager()
    fs.rmdirSync(getCacheDir(), true)
    dirInitialized = false
    logInfo('[persistentCache] Cleared')
  } catch {}
}

export function clearAssetCacheOnVersionChange(): void {
  try {
    const accountInfo = Taro.getAccountInfoSync()
    const appVersion = accountInfo?.miniProgram?.version ?? 'dev'
    const metaStr = Taro.getStorageSync(CACHE_META_KEY)
    let meta: CacheMeta | null = null
    try {
      meta = metaStr ? JSON.parse(metaStr) : null
    } catch {}
    if (meta && meta.version !== appVersion) {
      clearAssetCache()
      logInfo('[persistentCache] Version changed, cache cleared', {
        old: meta.version,
        new: appVersion,
      })
    }
    Taro.setStorageSync(
      CACHE_META_KEY,
      JSON.stringify({ version: appVersion, cachedAt: {} }),
    )
  } catch {}
}
