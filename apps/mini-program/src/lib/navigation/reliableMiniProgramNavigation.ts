import Taro from '@tarojs/taro'

const NAVIGATION_TIMEOUT_MS = 5_000
const NAVIGATION_COMMIT_POLL_MS = 100

type NativeRouteOptions = {
  url: string
  success?: (result: unknown) => void
  fail?: (error: unknown) => void
}

type NativeWeChatNavigation = {
  redirectTo?: (options: NativeRouteOptions) => unknown
  reLaunch?: (options: NativeRouteOptions) => unknown
}

type MiniProgramGlobal = typeof globalThis & {
  wx?: NativeWeChatNavigation
}

type NavigationAttemptResult = {
  committed: boolean
  error?: unknown
}

function withNavigationTimeout<T>(operation: Promise<T>, timeoutCode: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(() => reject(new Error(timeoutCode)), NAVIGATION_TIMEOUT_MS)
  })
  return Promise.race([operation, timeout]).finally(() => {
    if (timer) clearTimeout(timer)
  })
}

export function normalizeMiniProgramRoute(routeOrUrl: string): string {
  return routeOrUrl.split('?')[0]?.replace(/^\/+/, '') ?? ''
}

export function getCurrentMiniProgramRoute(): string | null {
  try {
    const pages = Taro.getCurrentPages()
    const route = pages[pages.length - 1]?.route
    return route ? normalizeMiniProgramRoute(route) : null
  } catch {
    return null
  }
}

export function callNativeWeChatNavigation(
  method: 'redirectTo' | 'reLaunch',
  url: string,
): Promise<void> {
  const nativeWx = (globalThis as MiniProgramGlobal).wx
  const navigate = nativeWx?.[method]
  if (typeof navigate !== 'function') {
    return Promise.reject(new Error(`WECHAT_NATIVE_${method.toUpperCase()}_UNAVAILABLE`))
  }

  return new Promise<void>((resolve, reject) => {
    try {
      navigate.call(nativeWx, {
        url,
        success: () => resolve(),
        fail: (error) => reject(error),
      })
    } catch (error) {
      reject(error)
    }
  })
}

async function didLeaveMiniProgramRoute(
  sourceRoute: string | null,
  isSourceMounted: () => boolean,
  trustSuccessWhenRouteUnknown: boolean,
): Promise<boolean> {
  if (!isSourceMounted()) return true
  if (!sourceRoute) return trustSuccessWhenRouteUnknown

  const deadline = Date.now() + NAVIGATION_TIMEOUT_MS
  while (Date.now() < deadline) {
    if (!isSourceMounted()) return true
    const currentRoute = getCurrentMiniProgramRoute()
    if (currentRoute && currentRoute !== sourceRoute) return true
    if (!currentRoute && trustSuccessWhenRouteUnknown) return true
    await new Promise<void>((resolve) => {
      setTimeout(resolve, NAVIGATION_COMMIT_POLL_MS)
    })
  }

  if (!isSourceMounted()) return true
  const settledRoute = getCurrentMiniProgramRoute()
  return settledRoute
    ? settledRoute !== sourceRoute
    : trustSuccessWhenRouteUnknown
}

export function canAttemptNavigationFallback(
  sourceRoute: string | null,
  isSourceMounted: () => boolean,
): boolean {
  if (!isSourceMounted()) return false
  if (!sourceRoute) return true
  const currentRoute = getCurrentMiniProgramRoute()
  return !currentRoute || currentRoute === sourceRoute
}

export async function attemptMiniProgramNavigation(
  navigate: () => Promise<unknown>,
  sourceRoute: string | null,
  isSourceMounted: () => boolean,
  timeoutCode: string,
  trustSuccessWhenRouteUnknown: boolean,
): Promise<NavigationAttemptResult> {
  try {
    await withNavigationTimeout(navigate(), timeoutCode)
  } catch (error) {
    if (!isSourceMounted()) return { committed: true }
    const currentRoute = getCurrentMiniProgramRoute()
    if (sourceRoute && currentRoute && currentRoute !== sourceRoute) {
      return { committed: true }
    }
    return { committed: false, error }
  }

  return {
    committed: await didLeaveMiniProgramRoute(
      sourceRoute,
      isSourceMounted,
      trustSuccessWhenRouteUnknown,
    ),
  }
}
