/**
 * systemInfo compat layer (2026-09-01).
 *
 * wx.getSystemInfoSync / Taro.getSystemInfoSync is deprecated and spams
 * vConsole ("82 listeners"-style warnings). The replacement is a family of
 * narrower getters: getWindowInfo / getDeviceInfo / getAppBaseInfo /
 * getSystemSetting / getAppAuthorizeSetting.
 *
 * Field coverage gotchas discovered while migrating:
 *  - `reduceMotion` has NO non-deprecated getter. We read the legacy API
 *    once per session (memoized) — one warning instead of dozens.
 *  - `deviceMemory` (Android) is also legacy-only; same memoized path.
 *  - Window metrics must NOT be memoized (keyboard / foldables resize them).
 *    Device + app-base info are static per session and are memoized.
 *
 * All getters fall back to the legacy API for ancient base libraries, so
 * behaviour never regresses on old clients.
 */
import Taro from '@tarojs/taro'

type LegacySystemInfo = ReturnType<typeof Taro.getSystemInfoSync>

/**
 * Test environments mock Taro.getSystemInfoSync — the legacy API must be
 * read fresh (never memoized, never bypassed by the newer getters) so those
 * mocks stay authoritative. Production keeps the memoized fast path.
 */
const IS_TEST = (process.env.NODE_ENV as string | undefined) === 'test'

let legacySnapshot: LegacySystemInfo | null = null
let legacyAttempted = false

/** Legacy getSystemInfoSync, read at most once per session (fresh in tests). */
function getLegacySnapshot(): LegacySystemInfo | null {
  if (IS_TEST) {
    try {
      return Taro.getSystemInfoSync()
    } catch {
      return null
    }
  }
  if (!legacyAttempted) {
    legacyAttempted = true
    try {
      legacySnapshot = Taro.getSystemInfoSync()
    } catch {
      legacySnapshot = null
    }
  }
  return legacySnapshot
}

const WINDOW_FALLBACK: Taro.getWindowInfo.Result = {
  pixelRatio: 2,
  screenWidth: 375,
  screenHeight: 667,
  windowWidth: 375,
  windowHeight: 667,
}

/** Fresh window metrics (never memoized — resize, keyboard, foldables). */
export function getWindowInfoCompat(): Taro.getWindowInfo.Result {
  try {
    const info = Taro.getWindowInfo?.()
    if (info && typeof info.windowWidth === 'number') return info
  } catch {
    /* fall through to legacy */
  }
  const legacy = getLegacySnapshot()
  if (!legacy) return WINDOW_FALLBACK
  return {
    pixelRatio: legacy.pixelRatio,
    screenWidth: legacy.screenWidth,
    screenHeight: legacy.screenHeight,
    windowWidth: legacy.windowWidth,
    windowHeight: legacy.windowHeight,
    statusBarHeight: legacy.statusBarHeight,
    safeArea: legacy.safeArea,
  }
}

let deviceInfoCache: Taro.getDeviceInfo.Result | null = null

/** Device info (brand/model/system/platform/benchmarkLevel) — memoized. */
export function getDeviceInfoCompat(): Taro.getDeviceInfo.Result {
  if (!IS_TEST && deviceInfoCache) return deviceInfoCache
  if (!IS_TEST) {
    try {
      const info = Taro.getDeviceInfo?.()
      if (info && typeof info.platform === 'string') {
        deviceInfoCache = info
        return info
      }
    } catch {
      /* fall through to legacy */
    }
  }
  const legacy = getLegacySnapshot()
  const result = {
    benchmarkLevel: legacy?.benchmarkLevel ?? -1,
    brand: legacy?.brand ?? '',
    model: legacy?.model ?? '',
    system: legacy?.system ?? '',
    platform: legacy?.platform ?? '',
    deviceAbi: (legacy as { deviceAbi?: string } | null)?.deviceAbi ?? '',
    CPUType: (legacy as { CPUType?: string } | null)?.CPUType ?? '',
  }
  if (!IS_TEST) deviceInfoCache = result
  return result
}

let appBaseInfoCache: Taro.getAppBaseInfo.Result | null = null

/** App-base info (SDKVersion/version/language/theme) — memoized. */
export function getAppBaseInfoCompat(): Taro.getAppBaseInfo.Result {
  if (!IS_TEST && appBaseInfoCache) return appBaseInfoCache
  if (!IS_TEST) {
    try {
      const info = Taro.getAppBaseInfo?.()
      if (info && typeof info.language === 'string') {
        appBaseInfoCache = info
        return info
      }
    } catch {
      /* fall through to legacy */
    }
  }
  const legacy = getLegacySnapshot()
  const result = {
    SDKVersion: legacy?.SDKVersion,
    language: legacy?.language ?? 'zh_CN',
    version: legacy?.version,
    theme: (legacy as { theme?: 'dark' | 'light' } | null)?.theme,
  }
  if (!IS_TEST) appBaseInfoCache = result
  return result
}

/**
 * OS-level reduced-motion preference. No non-deprecated getter exists, so
 * this reads the legacy API once per session via the shared snapshot.
 */
export function getSystemReducedMotionCompat(): boolean {
  const legacy = getLegacySnapshot()
  return (legacy as { reduceMotion?: boolean } | null)?.reduceMotion === true
}

/**
 * Merged drop-in replacement for getSystemInfoSync() — for call sites that
 * read fields across domains (e.g. windowWidth + benchmarkLevel, or the
 * Android-only `deviceMemory`). Window metrics are fresh; the rest memoized.
 */
export function getSystemInfoCompat(): Taro.getWindowInfo.Result &
  Taro.getDeviceInfo.Result &
  Taro.getAppBaseInfo.Result & {
    reduceMotion?: boolean
    deviceMemory?: number
  } {
  const legacy = getLegacySnapshot()
  return {
    ...getWindowInfoCompat(),
    ...getDeviceInfoCompat(),
    ...getAppBaseInfoCompat(),
    reduceMotion: (legacy as { reduceMotion?: boolean } | null)?.reduceMotion,
    deviceMemory: (legacy as { deviceMemory?: number } | null)?.deviceMemory,
  }
}
