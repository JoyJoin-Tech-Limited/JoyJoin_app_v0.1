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
import { resolveTabIndexForRoute } from '../../lib/navigation/tabBarRouteIndex'
import { setTabBarSelected } from '../../lib/navigation/tabBarState'
import { arbitrateTabIndicators } from '../../lib/navigation/tabIndicatorArbitration'
import { useNotificationCounts } from '../useNotificationCounts'
import { readProfileTabDotCount } from '../../lib/profile/profileTabDot'

export interface TabBadgeCounts {
  discover: number
  activities: number
  chat: number
  // P0-5 (2026-10-22): 我的 tab — pending equipment draws.
  profile: number
}

/** Dot-only indicators (a number would over-signal these slots). */
export interface TabIndicatorDots {
  activities: boolean
  profile: boolean
}

/** Native WeChat custom-tab-bar component interface (syncState method). */
interface NativeCustomTabBar {
  setSelected(selected: number): void
  syncState(state: CustomTabBarSyncState & { badges?: TabBadgeCounts; dots?: TabIndicatorDots }): void
  /**
   * Registers the page's re-tap outcome (scroll to top / silent refresh).
   * Optional: older instances in a warm runtime may not expose it.
   */
  setRetapHandler?(
    handler: (index: number) => { action: string; atTop?: boolean } | void
  ): void
}

interface UseCustomTabBarSyncOptions {
  enabled?: boolean
  poolRegistrations?: PoolRegistrationSummary[]
  events?: JoinedEventSummary[]
  /**
   * P0-5: live pending-equipment-draw count from the profile page. When
   * omitted (other tabs), the count falls back to the storage value the
   * profile page last wrote — no extra fetch on non-profile tabs.
   */
  profileBadgeCount?: number
  /**
   * What a re-tap of the tab the user is already on should do. The chrome
   * guarantees the haptic and the analytics event; the page owns the outcome
   * because only it knows its scroll owner (page scroll vs ScrollView) and
   * which query a silent refresh should invalidate.
   */
  onRetap?: (index: number) => { action: string; atTop?: boolean } | void
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

/**
 * Bounded retry schedule for the route-truth highlight push. The first attempt
 * is synchronous; the rest exist because `page.getTabBar()` can legitimately be
 * undefined during the first frames of a `switchTab` transition, and dropping
 * that one call is what used to leave a tab unlit until the user tapped twice.
 */
const SELECTED_RETRY_DELAYS_MS = [0, 16, 64, 160, 400] as const

function getCurrentTabIndex(page: Taro.PageInstance | null | undefined): number | undefined {
  return resolveTabIndexForRoute((page as { route?: string } | null | undefined)?.route)
}

export function useCustomTabBarSync({
  enabled = true,
  poolRegistrations: providedPoolRegistrations,
  events: providedEvents,
  profileBadgeCount,
  onRetap,
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

  const rawCenterState = useMemo(
    () => getMiniProgramCenterState(poolRegistrations, events),
    [poolRegistrations, events]
  )

  // Badge arbitration (2026-11-19): at most two indicators, at most one of them
  // a number, 发现 never badged. Raw counts are inputs, not what gets rendered —
  // see tabIndicatorArbitration.ts for the product rules.
  const indicators = useMemo(
    () =>
      arbitrateTabIndicators({
        chat: notificationCounts?.chat ?? 0,
        center: rawCenterState.showBadge,
        activities: (notificationCounts?.activities ?? 0) > 0,
        profile: (profileBadgeCount ?? readProfileTabDotCount()) > 0,
      }),
    [notificationCounts, profileBadgeCount, rawCenterState.showBadge]
  )

  // Only the numbered slot carries a count; the other slots are dots so the
  // bar does not read as a scoreboard.
  const badges = useMemo<TabBadgeCounts>(
    () => ({
      discover: 0,
      activities: 0,
      chat: indicators.chat,
      profile: 0,
    }),
    [indicators.chat]
  )

  const dots = useMemo<TabIndicatorDots>(
    () => ({ activities: indicators.activities, profile: indicators.profile }),
    [indicators.activities, indicators.profile]
  )

  const centerState = useMemo(
    () => ({ ...rawCenterState, showBadge: indicators.center }),
    [rawCenterState, indicators.center]
  )

  // Track whether the current page is visible to avoid hidden pages
  // from calling syncState at all during data refetches.
  const isVisibleRef = useRef(false)
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pageRetryRef = useRef(0)

  // The handler is stable for the life of the page but must read the latest
  // closure, so the option lives in a ref and the registered function never
  // changes identity (re-registering on every render would be pure churn).
  const onRetapRef = useRef(onRetap)
  onRetapRef.current = onRetap
  const retapHandlerRef = useRef((index: number) => onRetapRef.current?.(index))

  function clearRetryTimer() {
    if (retryTimerRef.current !== null) {
      clearTimeout(retryTimerRef.current)
      retryTimerRef.current = null
    }
  }

  /**
   * Publishes route truth for THIS page's tab-bar instance.
   *
   * Deliberately independent of `enabled`: `enabled` describes data readiness
   * (auth/queries), but the active highlight is not data. It must be correct on
   * the first frame even while center/badges are still loading, otherwise the
   * only writer of `selected` is lost and nothing ever corrects the instance.
   */
  function publishSelectedIndex() {
    const page = Taro.getCurrentInstance().page
    if (!page) {
      // `getCurrentInstance().page` is assigned by Taro's ONSHOW handler and can
      // be momentarily missing on a cold page. Retry a bounded number of times
      // so this cannot become another silently dropped single shot.
      if (pageRetryRef.current >= SELECTED_RETRY_DELAYS_MS.length) return
      const delay = SELECTED_RETRY_DELAYS_MS[pageRetryRef.current]
      pageRetryRef.current += 1
      clearRetryTimer()
      retryTimerRef.current = setTimeout(publishSelectedIndex, delay)
      return
    }

    const index = getCurrentTabIndex(page)
    if (index === undefined) {
      // A non-tab route has no highlight to publish (the bar is hidden there).
      pageRetryRef.current = 0
      return
    }
    pageRetryRef.current = 0
    const targetIndex: number = index

    // Recorded projection only. `tabBarState.selected` is written for
    // diagnostics and tests; no production code reads it back, because the
    // native component is a separate JS module that pulls rather than
    // subscribes. Do not treat it as a fallback source without wiring a reader.
    setTabBarSelected(targetIndex)

    clearRetryTimer()
    let attempt = 0
    function tryPush() {
      if (!isVisibleRef.current) return
      // A late retry must never push this page's index into whichever page is
      // current by then — that would also stamp the wrong instance's
      // `_lastPushAt`, disabling its `show` backstop.
      if (Taro.getCurrentInstance().page !== page) return
      const tabBar = getNativeTabBar(page)
      if (tabBar && typeof tabBar.setSelected === 'function') {
        tabBar.setSelected(targetIndex)
        // Registered on every publish: the native instance is re-created per
        // page, so a handler registered once at mount would not survive.
        if (typeof tabBar.setRetapHandler === 'function') {
          tabBar.setRetapHandler(retapHandlerRef.current)
        }
        return
      }
      attempt += 1
      if (attempt >= SELECTED_RETRY_DELAYS_MS.length) return
      retryTimerRef.current = setTimeout(tryPush, SELECTED_RETRY_DELAYS_MS[attempt])
    }
    tryPush()
  }

  useDidShow(() => {
    isVisibleRef.current = true
    pageRetryRef.current = 0
    publishSelectedIndex()
    // Center + badges are data; they may legitimately wait for `enabled`.
    if (!enabled) return
    getNativeTabBar(Taro.getCurrentInstance().page)?.syncState({ center: centerState, badges, dots })
  })

  useDidHide(() => {
    isVisibleRef.current = false
    // A retry that lands after the page hides would write selection for a page
    // the user is no longer looking at.
    clearRetryTimer()
  })

  useEffect(() => clearRetryTimer, [])

  useEffect(() => {
    if (!enabled) return
    const page = Taro.getCurrentInstance().page
    const tabBar = getNativeTabBar(page)
    if (!isVisibleRef.current) return
    // Only sync center + badges (NOT selected) to prevent hidden pages
    // from overwriting the visible page's tab selection on data update.
    // Selection is published once per show by publishSelectedIndex() above;
    // it must never ride along with data updates.
    tabBar?.syncState({ center: centerState, badges, dots })
  }, [enabled, centerState, badges, dots])

  return {
    centerState,
    poolRegistrations,
    events,
    notificationCounts,
  }
}
