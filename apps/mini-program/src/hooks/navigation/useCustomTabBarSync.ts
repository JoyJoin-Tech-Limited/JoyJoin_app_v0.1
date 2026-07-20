import { useEffect, useMemo, useRef } from 'react'
import Taro, { useDidShow, useDidHide } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import {
  getJoinedEvents,
  getMyPoolRegistrations,
  type JoinedEventSummary,
  type PoolRegistrationSummary,
} from '@shared/api'
import { STALE_TIME_DEFAULT_MS } from '../../lib/utils/uiConstants'
import { apiRequest } from '../../lib/api/api'
import { getMiniProgramCenterState, type CustomTabBarSyncState } from '../../lib/navigation/centerTabRouting'
import { MINI_PROGRAM_CENTER_HUB_TAB_ITEM, MINI_PROGRAM_TAB_INDEX, MINI_PROGRAM_TAB_ITEMS } from '../../lib/navigation/tabBarConfig'
import { useNotificationCounts } from '../useNotificationCounts'

export interface TabBadgeCounts {
  discover: number
  activities: number
  chat: number
}

/** Native WeChat custom-tab-bar component interface (syncState method). */
interface NativeCustomTabBar {
  setSelected(selected: number): void
  syncState(state: CustomTabBarSyncState & { badges?: TabBadgeCounts }): void
}

interface UseCustomTabBarSyncOptions {
  enabled?: boolean
  poolRegistrations?: PoolRegistrationSummary[]
  events?: JoinedEventSummary[]
}

function getNativeTabBar(page: Taro.PageInstance | null | undefined): NativeCustomTabBar | undefined {
  if (!page) return undefined
  // Bypass Taro.getTabBar: it expects $taroInstances (Taro-managed tab bar only).
  // JoyJoin ships a native WeChat component, so we call getTabBar() directly.
  // Guard: H5 runtime pages do not expose getTabBar().
  const pageWithTabBar = page as unknown as { getTabBar?: () => NativeCustomTabBar | undefined }
  if (typeof pageWithTabBar.getTabBar !== 'function') return undefined
  return pageWithTabBar.getTabBar()
}

const TAB_INDEX_BY_PAGE_PATH = new Map<string, number>([
  ...MINI_PROGRAM_TAB_ITEMS.map((item) => [item.pagePath, MINI_PROGRAM_TAB_INDEX[item.key]] as const),
  [MINI_PROGRAM_CENTER_HUB_TAB_ITEM.pagePath, MINI_PROGRAM_TAB_INDEX.centerHub],
  // Pool registration is a child of Discover; keep the tab bar visible and
  // highlight the Discover tab so users retain top-level navigation context.
  ['subpackages/pool-registration/index', MINI_PROGRAM_TAB_INDEX.discover],
])

function normalizeRoute(route: string | undefined): string {
  return String(route ?? '').replace(/^\//, '').split('?')[0]
}

function getCurrentTabIndex(page: Taro.PageInstance | null | undefined): number | undefined {
  const route = normalizeRoute((page as { route?: string } | null | undefined)?.route)
  return TAB_INDEX_BY_PAGE_PATH.get(route)
}

export function useCustomTabBarSync({
  enabled = true,
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
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
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
    const currentTabIndex = getCurrentTabIndex(page)
    if (currentTabIndex !== undefined) {
      tabBar?.setSelected(currentTabIndex)
    }
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
