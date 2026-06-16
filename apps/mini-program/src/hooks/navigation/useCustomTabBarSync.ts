import { useEffect, useMemo, useRef } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import {
  getMyBlindBoxEvents,
  getMyPoolRegistrations,
  type BlindBoxEventSummary,
  type PoolRegistrationSummary,
} from '@shared/api'
import { STALE_TIME_DEFAULT_MS } from '../../lib/utils/uiConstants'
import { apiRequest } from '../../lib/api/api'
import { getMiniProgramCenterState, type CustomTabBarSyncState } from '../../lib/navigation/centerTabRouting'
import { MINI_PROGRAM_TAB_INDEX, type MiniProgramTabKey } from '../../lib/navigation/tabBarConfig'
import { useNotificationCounts } from '../useNotificationCounts'

export interface TabBadgeCounts {
  discover: number
  activities: number
  chat: number
}

/** Native WeChat custom-tab-bar component interface. */
interface NativeCustomTabBar {
  syncState(state: CustomTabBarSyncState & { badges?: TabBadgeCounts }): void
  setSelected(index: number): void
}

interface UseCustomTabBarSyncOptions {
  enabled?: boolean
  /**
   * Which tab this page represents. Each tab page owns its own native
   * tab-bar instance, so the visible page must set its OWN selected index
   * on show — otherwise the freshly-mounted instance keeps its default
   * `selected: 0` and highlights 发现 until the next tap.
   */
  tabKey?: MiniProgramTabKey
  poolRegistrations?: PoolRegistrationSummary[]
  events?: BlindBoxEventSummary[]
}

function getNativeTabBar(page: Taro.PageInstance | null | undefined): NativeCustomTabBar | undefined {
  if (!page) return undefined
  // Bypass Taro.getTabBar: it expects $taroInstances (Taro-managed tab bar only).
  // JoyJoin ships a native WeChat component, so we call getTabBar() directly.
  const tabBar = (page as unknown as { getTabBar(): NativeCustomTabBar | undefined }).getTabBar()
  return tabBar
}

export function useCustomTabBarSync({
  enabled = true,
  tabKey,
  poolRegistrations: providedPoolRegistrations,
  events: providedEvents,
}: UseCustomTabBarSyncOptions) {
  const { data: queriedPoolRegistrations } = useQuery({
    queryKey: ['mini-program', 'my-pool-registrations'],
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: enabled && providedPoolRegistrations === undefined,
    staleTime: STALE_TIME_DEFAULT_MS,
  })

  const { data: queriedEvents } = useQuery({
    queryKey: ['mini-program', 'my-blind-box-events'],
    queryFn: () => getMyBlindBoxEvents(apiRequest),
    enabled: enabled && providedEvents === undefined,
    staleTime: 30_000,
  })

  const { data: notificationCounts } = useNotificationCounts(enabled)

  const poolRegistrations = providedPoolRegistrations ?? queriedPoolRegistrations
  const events = providedEvents ?? queriedEvents

  const badges = useMemo<TabBadgeCounts>(
    () => ({
      discover: notificationCounts?.discover ?? 0,
      activities: notificationCounts?.activities ?? 0,
      chat: notificationCounts?.chat ?? 0,
    }),
    [notificationCounts]
  )

  const centerState = useMemo(
    () => getMiniProgramCenterState(poolRegistrations, events),
    [poolRegistrations, events]
  )

  // Track whether the current page is visible to avoid hidden pages
  // from calling syncState at all during data refetches.
  const isVisibleRef = useRef(false)

  useDidShow(() => {
    isVisibleRef.current = true
    if (!enabled) return
    const page = Taro.getCurrentInstance().page
    const tabBar = getNativeTabBar(page)
    // Authoritatively set THIS page's own selected index on show. useDidShow
    // only fires for the page becoming visible, so it can never race a hidden
    // page — it sets its own index. Without this, a freshly-mounted tab-bar
    // instance keeps its default `selected: 0` and highlights 发现 until the
    // user taps again (the one-tap-lag bug).
    if (tabKey !== undefined) {
      tabBar?.setSelected(MINI_PROGRAM_TAB_INDEX[tabKey])
    }
    // Sync center + badges (never `selected` here — handled above per-page).
    tabBar?.syncState({ center: centerState, badges })
  })

  useDidHide(() => {
    isVisibleRef.current = false
  })

  useEffect(() => {
    if (!enabled) return
    const page = Taro.getCurrentInstance().page
    const tabBar = getNativeTabBar(page)
    if (!isVisibleRef.current) return
    // Only sync center + badges (NOT selected) to prevent hidden pages
    // from overwriting the visible page's tab selection on data update.
    tabBar?.syncState({ center: centerState, badges })
  }, [enabled, centerState, badges])

  return {
    centerState,
    poolRegistrations,
    events,
    notificationCounts,
  }
}
