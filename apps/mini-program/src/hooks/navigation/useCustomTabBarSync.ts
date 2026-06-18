import { useEffect, useRef } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import {
  getTabBarState,
  setTabBarSelected,
  subscribeTabBarState,
  type TabBarState,
} from '../../lib/navigation/tabBarState'
import { MINI_PROGRAM_TAB_INDEX, type MiniProgramTabKey } from '../../lib/navigation/tabBarConfig'

/** Native WeChat custom-tab-bar component interface. */
interface NativeCustomTabBar {
  syncState(state: Partial<TabBarState>): void
  setSelected(index: number): void
}

interface UseCustomTabBarSyncOptions {
  enabled?: boolean
  /**
   * Which tab this page represents. Each tab page owns its own native
   * tab-bar instance, so the visible page must set its OWN selected index
   * on show — otherwise the freshly-mounted instance keeps its default
   * `selected: 0` and highlights 发现 until the next tap.
   *
   * This update always runs on `useDidShow`, independent of `enabled`,
   * because `useDidShow` never fires again when `enabled` later flips to
   * true while the page is already visible.
   */
  tabKey?: MiniProgramTabKey
}

function getNativeTabBar(page: Taro.PageInstance | null | undefined): NativeCustomTabBar | undefined {
  if (!page) return undefined
  // Bypass Taro.getTabBar: it expects $taroInstances (Taro-managed tab bar only).
  // JoyJoin ships a native WeChat component, so we call getTabBar() directly.
  // H5 runtime does not provide getTabBar; guard to avoid crashing in browser builds.
  const pageWithTabBar = page as unknown as { getTabBar?(): NativeCustomTabBar | undefined }
  if (typeof pageWithTabBar.getTabBar !== 'function') return undefined
  return pageWithTabBar.getTabBar()
}

function syncTabBarState(tabBar: NativeCustomTabBar | undefined, state: TabBarState): void {
  tabBar?.syncState({ center: state.center, badges: state.badges })
}

export function useCustomTabBarSync({
  enabled = true,
  tabKey,
}: UseCustomTabBarSyncOptions) {
  // Track whether the current page is visible to avoid hidden pages
  // from calling syncState at all during data refetches.
  const isVisibleRef = useRef(false)

  useDidShow(() => {
    isVisibleRef.current = true

    const page = Taro.getCurrentInstance().page
    const tabBar = getNativeTabBar(page)

    // Authoritatively set THIS page's own selected index on show. useDidShow
    // only fires for the page becoming visible, so it can never race a hidden
    // page — it sets its own index. Without this, a freshly-mounted tab-bar
    // instance keeps its default `selected: 0` and highlights 发现 until the
    // user taps again (the one-tap-lag bug).
    //
    // This must run regardless of `enabled`: if the page becomes visible while
    // auth is still loading, `enabled` is false and no further useDidShow fires
    // when auth resolves. The selected highlight would stay stuck on 发现.
    if (tabKey !== undefined) {
      const index = MINI_PROGRAM_TAB_INDEX[tabKey]
      setTabBarSelected(index)
      tabBar?.setSelected(index)
    }

    if (!enabled) return

    // Sync the latest chrome state (center + badges) from the app-level bridge.
    syncTabBarState(tabBar, getTabBarState())
  })

  useDidHide(() => {
    isVisibleRef.current = false
  })

  useEffect(() => {
    if (!enabled) return undefined

    // Subscribe to the singleton tab-bar state. While this page is visible,
    // push any badge/center updates to its native tab bar instance.
    return subscribeTabBarState((state) => {
      if (!isVisibleRef.current) return
      const page = Taro.getCurrentInstance().page
      const tabBar = getNativeTabBar(page)
      syncTabBarState(tabBar, state)
    })
  }, [enabled])
}
