import { useEffect, useMemo } from 'react'
import Taro, { useDidShow } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import {
  getMyBlindBoxEvents,
  getMyPoolRegistrations,
  type BlindBoxEventSummary,
  type PoolRegistrationSummary,
} from '@shared/api'
import { STALE_TIME_DEFAULT_MS } from '../lib/uiConstants'
import { apiRequest } from '../lib/api'
import { getMiniProgramCenterState, type CustomTabBarSyncState } from '../lib/centerTabRouting'
import { useNotificationCounts } from './useNotificationCounts'

export interface TabBadgeCounts {
  discover: number
  activities: number
  chat: number
}

/** Native WeChat custom-tab-bar component interface (syncState method). */
interface NativeCustomTabBar {
  syncState(state: CustomTabBarSyncState & { badges?: TabBadgeCounts }): void
}

interface UseCustomTabBarSyncOptions {
  selectedIndex: number
  enabled?: boolean
  poolRegistrations?: PoolRegistrationSummary[]
  events?: BlindBoxEventSummary[]
}

export function useCustomTabBarSync({
  selectedIndex,
  enabled = true,
  poolRegistrations: providedPoolRegistrations,
  events: providedEvents,
}: UseCustomTabBarSyncOptions) {
  const page = useMemo(() => Taro.getCurrentInstance().page, [])

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

  const syncState = useMemo<CustomTabBarSyncState & { badges: TabBadgeCounts }>(
    () => ({
      selected: selectedIndex,
      center: getMiniProgramCenterState(poolRegistrations, events),
      badges,
    }),
    [selectedIndex, poolRegistrations, events, badges]
  )

  useDidShow(() => {
    if (!enabled || !page) {
      return
    }

    const tabBar = Taro.getTabBar<NativeCustomTabBar>(page)
    tabBar?.syncState(syncState)
  })

  useEffect(() => {
    if (!enabled || !page) {
      return
    }

    const tabBar = Taro.getTabBar<NativeCustomTabBar>(page)
    tabBar?.syncState(syncState)
  }, [enabled, page, syncState])

  return {
    centerState: syncState.center,
    poolRegistrations,
    events,
    notificationCounts,
  }
}