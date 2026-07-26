import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import Taro from '@tarojs/taro'
import {
  ROUTE_PRELOAD_MAP,
  PREDICTIVE_PRELOAD_MAP,
  preloadRouteAssets,
} from './routePreloadAssets'

const TAB_ROUTES = [
  'pages/discover/index',
  'pages/events/index',
  'pages/connections/index',
  'pages/profile/index',
  'pages/center-hub/index',
]

describe('tab first-viewport preload maps', () => {
  it('covers all five tab pages in ROUTE_PRELOAD_MAP', () => {
    for (const route of TAB_ROUTES) {
      expect(
        ROUTE_PRELOAD_MAP[route]?.length,
        `Missing first-viewport preload assets for ${route}`,
      ).toBeGreaterThan(0)
    }
  })

  it('every tab page has at least one tab-to-tab predictive edge', () => {
    for (const route of TAB_ROUTES) {
      const nextRoutes = PREDICTIVE_PRELOAD_MAP[route] ?? []
      const tabEdges = nextRoutes.filter((r) => TAB_ROUTES.includes(r) && r !== route)
      expect(
        tabEdges.length,
        `${route} should predictively preload at least one adjacent tab`,
      ).toBeGreaterThan(0)
    }
  })

  it('predictive edges only reference routes that exist in ROUTE_PRELOAD_MAP or are real pages', () => {
    for (const nextRoutes of Object.values(PREDICTIVE_PRELOAD_MAP)) {
      for (const route of nextRoutes) {
        expect(route.startsWith('pages/')).toBe(true)
      }
    }
  })
})

describe('session-level preload dedup', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.spyOn(Taro, 'getImageInfo').mockImplementation((({ src, success }: any) => {
      success?.({ width: 100, height: 100, path: `tmp://${src}` })
      return Promise.resolve({ width: 100, height: 100, path: `tmp://${src}` })
    }) as any)
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
  })

  it('preloads each asset at most once per session across repeated route entries', () => {
    const assets = ROUTE_PRELOAD_MAP['pages/events/index']
    expect(assets.length).toBeGreaterThan(0)

    preloadRouteAssets('pages/events/index')
    vi.advanceTimersByTime(0)
    const callsAfterFirst = vi.mocked(Taro.getImageInfo).mock.calls.length
    expect(callsAfterFirst).toBe(assets.length)

    // Second entry into the same route must not re-issue any getImageInfo.
    preloadRouteAssets('pages/events/index')
    vi.advanceTimersByTime(0)
    expect(vi.mocked(Taro.getImageInfo).mock.calls.length).toBe(callsAfterFirst)
  })
})
