import { View, Text, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, usePageScroll, useDidHide, useDidShow } from '@tarojs/taro'
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEventPools,
  getMyPoolRegistrations,
  type EventPoolSummary,
} from '@shared/api'
import {
  shenzhenClusters,
  getDistrictById,
  getClusterById,
  type District,
} from '@shared/districts'
import { FLOW1_ENTRY_COPY } from '@shared/copy/flowAnimationCopy'
import { getOnboardingVoiceLine } from '@shared/copy/onboardingVoice'
import { useAuth } from '../../hooks/useAuth'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import { apiRequest, fetchDiscoverShell } from '../../lib/api/api'
import { loadDiscoverPools } from '../../lib/api/discoverPools'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { injectDiscoverShellIntoCache, POOLS_QUERY_KEY } from '../../lib/prefetchEngine'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { onboardingAnalytics } from '../../lib/onboarding/onboardingAnalytics'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { getDevMockPools } from '../../lib/dev/devPoolMocks'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import { loadBrandDisplayFont } from '../../lib/utils/brandFont'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import { haptics } from '../../lib/utils/haptics'
import { getTimeGreeting } from '../../lib/utils/timeGreeting'
import {
  getDiscoverSubtitle,
} from '../../lib/utils/discoverHeaderCopy'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { shouldRefreshOnShow } from '../../lib/utils/showRefreshGate'
import { logInfo, logWarn } from '../../lib/utils/logger'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import LoadingScreen from '../../components/loading/LoadingScreen'
import PageMorphWrapper from '../../components/ui/PageMorphWrapper'
import StatusCard from '../../components/ui/StatusCard'
import HeroPromoBanner, { type PromoBannerVariant } from '../../components/HeroPromoBanner'
import VirtualList from '../../components/VirtualList'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import OracleCard from '../../components/discover/OracleCard'
import LocationFilterDrawer from '../../components/discover/LocationFilterDrawer'
import CityUnlockFeedCard from '../../components/discover/CityUnlockFeedCard'
import CityPickerSheet from '../../components/discover/CityPickerSheet'
import SingleTestBanner from '../../components/dev/SingleTestBanner'
import AlangDiscoverCard from '../../components/alang/AlangDiscoverCard'
import MiniProgramLandingPage from '../index/LandingPage'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────
const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'
const LOCATION_STORAGE_KEY = 'discover_last_location'
const LOCATION_TTL_DAYS = 7

// Scroll-responsive tab bar collapse thresholds (rpx).
// Hysteresis window: collapse at >200, expand at <160 — prevents flapping
// when the user scrolls slowly around the boundary.
const TAB_BAR_COLLAPSE_THRESHOLD_RPX = 200
const TAB_BAR_EXPAND_THRESHOLD_RPX = 160

// Feature-flag kill switch: disable collapse when false (e.g. rendering issues
// on specific WeChat base-library versions). Default true for the POC.
const COLLAPSIBLE_TAB_BAR_ENABLED = true

// Estimated OracleCard max height in rpx. Keep in sync with `.oracle-card` min-height.
// Last calibrated: 2026-06-19 — DevTools measurement still required before final sign-off.
const DISCOVER_CARD_HEIGHT_RPX = 560

// ─── Promo banner variant assignment ──────────────────────────────
function resolveVariant(userId: string | undefined, hasArchetype: boolean): PromoBannerVariant {
  if (!hasArchetype) return 'C'
  if (!userId) return 'A'
  const hash = userId.split('').reduce((a, c) => a + c.charCodeAt(0), 0)
  return hash % 2 === 0 ? 'A' : 'B'
}

// ─── Smart default helpers ────────────────────────────────────────
function readSavedLocation(): { clusterId: string; districtId: string } | null {
  try {
    const raw = Taro.getStorageSync(LOCATION_STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    const ageMs = Date.now() - (parsed.timestamp || 0)
    if (ageMs > LOCATION_TTL_DAYS * 24 * 60 * 60 * 1000) return null
    return { clusterId: parsed.clusterId, districtId: parsed.districtId }
  } catch {
    return null
  }
}

function saveLocation(clusterId: string, districtId: string) {
  Taro.setStorageSync(
    LOCATION_STORAGE_KEY,
    JSON.stringify({ clusterId, districtId, timestamp: Date.now() })
  )
}

function clearLocation() {
  Taro.removeStorageSync(LOCATION_STORAGE_KEY)
}

// PR-9 arrival return-hook: local YYYY-MM-DD stamp so the header tagline can
// yield to the hook card for the whole first-visit day, not just the 6s the
// card is visible.
function arrivalTodayKey(): string {
  const d = new Date()
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

// ─── Skeleton placeholder (initial loading) ───────────────────────
function PoolCardSkeleton() {
  return (
    <View className='oracle-card oracle-card--skeleton'>
      <View className='oracle-card__skeleton-line oracle-card__skeleton-line--hero' />
      <View className='oracle-card__skeleton-line oracle-card__skeleton-line--meta' />
      <View className='oracle-card__skeleton-line oracle-card__skeleton-line--teaser' />
      <View className='oracle-card__skeleton-line oracle-card__skeleton-line--cta' />
    </View>
  )
}

// ─── Pool card (legacy, replaced by OracleCard) ──────────────────
// Old PoolCard component removed — see OracleCard in components/discover/

interface AuthenticatedDiscoverProps {
  selectedCluster: string
  selectedDistrict: string
  onFilterSelect: (clusterId: string, districtId: string) => void
  onOpenDrawer: () => void
  onOpenCityPicker: () => void
}

// ─── AuthenticatedDiscover ────────────────────────────────────────
function AuthenticatedDiscover({
  selectedCluster,
  selectedDistrict,
  onFilterSelect,
  onOpenDrawer,
  onOpenCityPicker,
}: AuthenticatedDiscoverProps) {
  const { user, isLoading: authLoading } = useAuth()
  const queryClient = useQueryClient()
  const displayName = (user as any)?.displayName || (user as any)?.nickname || '悦聚用户'
  const userArchetype = (user as any)?.primaryArchetype || (user as any)?.archetype || null
  const userId = (user as any)?.id as string | undefined
  const cornerStatEnabled = (user as any)?.features?.oracleCardCornerStatEnabled !== false
  const xiaoyueAsset = useMemo(() => getXiaoyueExpressionAsset('homeWelcome'), [])
  const localFallback = useMemo(() => localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp'), [])
  const avatarUrl = (user as any)?.profileImageUrl || (user as any)?.wechatAvatarUrl || xiaoyueAsset

  const [avatarError, setAvatarError] = useState(false)
  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))
  const lastGoodPoolsRef = useRef<EventPoolSummary[]>([])
  // PR-5 first-visit play-mode coachmark: the retired intro flow's explainer
  // content, folded into a one-time card. Signal written by profile-review's
  // handleCeremonyComplete; same storage-keyed self-dismissing pattern as the
  // gathering-room first-visit hint.
  const [showArrivalCoachmark, setShowArrivalCoachmark] = useState(false)
  const arrivalCoachmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // PR-9: true for the rest of the arrival day once the pending signal was
  // consumed (or the seen-date stamp matches today) — the header tagline
  // yields to the hook card's promise for the whole day.
  const [arrivalHookDay, setArrivalHookDay] = useState(false)
  // Set when the pending signal was present, regardless of effect/didShow
  // ordering — read by the step_started funnel event.
  const arrivalFromOnboardingRef = useRef(false)

  // ── Geo detection state ──
  // ── Data fetching ──
  const {
    data: pools = [],
    isLoading: poolsLoading,
    isError: poolsError,
    isFetching: poolsFetching,
  } = useQuery({
    queryKey: ['mini-program', 'event-pools'],
    staleTime: 20 * 1000,
    retry: 2,
    retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 5000),
    queryFn: async (): Promise<EventPoolSummary[]> => {
      try {
        const loadedPools = await loadDiscoverPools({
          fetchShell: fetchDiscoverShell,
          fetchLegacyPools: () => getEventPools(apiRequest),
          onShellLoaded: (shell) => {
            injectDiscoverShellIntoCache(queryClient, shell)
            logInfo('[Discover] Shell loaded', { poolCount: shell.pools.items.length })
            if (shell.pools.items.length === 0) {
              logWarn('[Discover] Shell returned no pools; checking canonical endpoint')
            }
          },
        })
        logInfo('[Discover] Pools ready', { poolCount: loadedPools.length })
        if (loadedPools.length > 0) {
          lastGoodPoolsRef.current = loadedPools
        }
        return loadedPools
      } catch (e) {
        logWarn('[Discover] Pool loading failed', {
          error: e instanceof Error ? e.message : String(e),
        })
        if (lastGoodPoolsRef.current.length > 0) {
          return lastGoodPoolsRef.current
        }
        // Dev-only mock fallback for UI testing without backend.
        // Gated to development so production never serves fake data (AC-12).
        if (process.env.NODE_ENV === 'development') {
          return getDevMockPools()
        }
        throw e
      }
    },
  })

  const {
    data: registrations = [],
    isLoading: isLoadingRegistrations,
  } = useQuery({
    queryKey: ['mini-program', 'my-pool-registrations'],
    staleTime: 20 * 1000,
    queryFn: () => getMyPoolRegistrations(apiRequest),
  })

  // ── Eager font + asset preload ──
  // Load brand font immediately (guard prevents double-load from app.ts).
  // Preload promo banners + predictive assets in background.
  useEffect(() => {
    loadBrandDisplayFont()
    preloadRouteAssets('pages/discover/index')
    preloadPredictiveAssets('pages/discover/index')
  }, [])

  // Refresh data on foreground so registration/payment changes are reflected
  // after the user returns from other pages. Skip the first show (mount) to
  // avoid duplicating the initial query fetch. Staleness-gated so rapid tab
  // switches do not trigger a refetch + re-render burst.
  const hasDidShowRef = useRef(false)
  useDidShow(() => {
    if (!hasDidShowRef.current) {
      hasDidShowRef.current = true
      return
    }
    if (authLoading) return
    if (!shouldRefreshOnShow('discover')) return
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pools'] })
    void queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] })
  })

  // PR-2: 'discover' onboarding-step funnel event. Fires step_started once on
  // the first show after mount only — tab re-entries must not spam the funnel
  // (separate ref from the refresh-skip guard above, which skips first show).
  // PR-9: carries `fromOnboarding: true` when the arrival return-hook signal
  // was pending — the ref covers the case where the coachmark effect already
  // consumed the storage key before this handler ran (order is not guaranteed).
  const discoverStepTrackedRef = useRef(false)
  useDidShow(() => {
    if (discoverStepTrackedRef.current) return
    discoverStepTrackedRef.current = true
    let fromOnboarding = arrivalFromOnboardingRef.current
    if (!fromOnboarding && userId) {
      try {
        fromOnboarding = !!Taro.getStorageSync(`joyjoin_discover_arrival_pending:${userId}`)
      } catch {
        fromOnboarding = false
      }
    }
    onboardingAnalytics.stepStarted('discover', fromOnboarding ? { fromOnboarding: true } : undefined)
  })

  // ── Geo detection effect ──
  // ── GPS auto-filter on first detection ──
  // ── Derived: districts for selected cluster ──
  const visibleDistricts = useMemo<District[]>(() => {
    if (selectedCluster === ALL_CLUSTER_ID) {
      return shenzhenClusters.flatMap((c) => c.districts)
    }
    const cluster = shenzhenClusters.find((c) => c.id === selectedCluster)
    return cluster?.districts ?? []
  }, [selectedCluster])

  // No sticky header with drawer-based filter — hero scrolls away naturally

  // ── Derived: display pool list ──
  // Strategy:
  //   - Manual selection active → strict filter (respect user intent)
  //   - No manual selection → show all pools in server order
  const hasManualFilter = selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID

  const displayPools = useMemo<EventPoolSummary[]>(() => {
    if (hasManualFilter) {
      // Strict filtering mode
      return pools.filter((pool) => {
        if (selectedCluster !== ALL_CLUSTER_ID) {
          const clusterDistricts = shenzhenClusters
            .find((c) => c.id === selectedCluster)
            ?.districts.map((d) => d.name) ?? []
          if (pool.district && !clusterDistricts.includes(pool.district)) {
            return false
          }
        }
        if (selectedDistrict !== ALL_DISTRICT_ID) {
          const district = visibleDistricts.find((d) => d.id === selectedDistrict)
          if (district && pool.district !== district.name) {
            return false
          }
        }
        return true
      })
    }

    // Default mode: show all pools in server order
    return pools
  }, [pools, selectedCluster, selectedDistrict, visibleDistricts, hasManualFilter])

  // ── Empty-state auto-relaxation ──
  // When manual filter returns nothing, automatically fall back to all pools
  // in server order, with a banner explaining the relaxation.
  const isAutoRelaxed = hasManualFilter && displayPools.length === 0 && pools.length > 0
  const visiblePools = useMemo<EventPoolSummary[]>(
    () => (isAutoRelaxed ? pools : displayPools),
    [isAutoRelaxed, pools, displayPools],
  )

  // Track auto-relaxation once per occurrence
  const hasTrackedRelaxRef = useRef(false)
  useEffect(() => {
    if (isAutoRelaxed && !hasTrackedRelaxRef.current) {
      hasTrackedRelaxRef.current = true
      discoverAnalytics.track('filter_auto_relax', undefined, {
        selectedCluster,
        selectedDistrict,
        relaxedPoolCount: visiblePools.length,
      })
    } else if (!isAutoRelaxed) {
      hasTrackedRelaxRef.current = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAutoRelaxed])

  // ── Header copy (computed after data fetch) ──
  const timeGreeting = useMemo(() => getTimeGreeting(displayName), [displayName])
  // PR-9: 悦仔's archetype-voiced return hook for the first-visit coachmark
  // (Tier A); Tier B is the generic echo used by the header subtitle.
  const arrivalHookLine = useMemo(
    () => getOnboardingVoiceLine('discover-arrival', userArchetype),
    [userArchetype],
  )
  const dynamicSubtitle = useMemo(
    () => {
      if (isLoadingRegistrations) return '发现适合你的聚会…'
      // Arrival day: the random tagline yields to the hook card's promise —
      // the header echoes the generic (Tier B) line instead of competing.
      if (arrivalHookDay) return getOnboardingVoiceLine('discover-arrival', null)
      return getDiscoverSubtitle({
        displayName,
        archetype: userArchetype,
        registrationCount: registrations.length,
        openPoolCount: pools.filter((p) => p.status !== 'closed').length,
      })
    },
    [displayName, userArchetype, registrations.length, pools, isLoadingRegistrations, arrivalHookDay],
  )
  // ── Handlers ──
  const openPools = useMemo(
    () => pools.filter((p) => p.status !== 'closed'),
    [pools],
  )

  const bannerVariant = useMemo(
    () => resolveVariant(userId, !!userArchetype),
    [userId, userArchetype],
  )

  // PR-9 funnel-tail close/tap-through events. `auto` fires from the 6s timer
  // (no haptics); `button` is the explicit 知道了 close; `tap_through` is a
  // tap on the card body/anchor — the user followed the pointer toward the
  // 街头盲盒 entry below.
  const handleArrivalCoachmarkClosed = useCallback((reason: 'button' | 'tap_through' | 'auto') => {
    if (reason !== 'auto') haptics('light')
    if (arrivalCoachmarkTimerRef.current) {
      clearTimeout(arrivalCoachmarkTimerRef.current)
      arrivalCoachmarkTimerRef.current = null
    }
    setShowArrivalCoachmark(false)
    onboardingAnalytics.interaction(
      'discover',
      reason === 'tap_through' ? 'arrival_hook_tap_through' : 'arrival_hook_close',
      { fromOnboarding: true, dismissReason: reason },
    )
  }, [])

  // Show the arrival coachmark once: consume the pending flag, write the seen
  // key, and self-dismiss after 6s (or on tap). Storage failures must never
  // affect the feed. PR-9 also stamps the seen date so the header tagline
  // yields to the hook line for the whole arrival day, and reports the
  // hook-card impression into the onboarding funnel tail.
  useEffect(() => {
    if (!userId) return
    try {
      const seenDate = Taro.getStorageSync(`joyjoin_discover_arrival_seen_date:${userId}`)
      if (seenDate === arrivalTodayKey()) setArrivalHookDay(true)
      if (!Taro.getStorageSync(`joyjoin_discover_arrival_pending:${userId}`)) return
      Taro.removeStorageSync(`joyjoin_discover_arrival_pending:${userId}`)
      Taro.setStorageSync(`joyjoin_discover_arrival_seen:${userId}`, true)
      Taro.setStorageSync(`joyjoin_discover_arrival_seen_date:${userId}`, arrivalTodayKey())
    } catch {
      return
    }
    arrivalFromOnboardingRef.current = true
    setArrivalHookDay(true)
    setShowArrivalCoachmark(true)
    onboardingAnalytics.interaction('discover', 'arrival_hook_impression', {
      fromOnboarding: true,
      archetype: userArchetype ?? 'unknown',
    })
    arrivalCoachmarkTimerRef.current = setTimeout(() => {
      arrivalCoachmarkTimerRef.current = null
      handleArrivalCoachmarkClosed('auto')
    }, 6000)
    return () => {
      if (arrivalCoachmarkTimerRef.current) {
        clearTimeout(arrivalCoachmarkTimerRef.current)
        arrivalCoachmarkTimerRef.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId])

  const handlePoolTap = useCallback((pool: EventPoolSummary) => {
    haptics('light')
    Taro.navigateTo({ url: `/pages/pool-registration/index?id=${pool.id}` })
  }, [])

  const handleBannerCtaTap = useCallback(() => {
    if (!userArchetype) {
      Taro.navigateTo({ url: '/pages/onboarding/personality-test/index' })
      return
    }
    const firstOpenPool = openPools[0]
    if (firstOpenPool) {
      Taro.navigateTo({ url: `/pages/pool-registration/index?id=${firstOpenPool.id}` })
    } else {
      Taro.showToast({ title: '暂无开放活动', icon: 'none' })
    }
  }, [userArchetype, openPools])

  // ── Location pill label ──
  const locationPillLabel = useMemo(() => {
    if (selectedDistrict !== ALL_DISTRICT_ID) {
      const district = getDistrictById(selectedDistrict)
      if (district) return district.name
    }
    if (selectedCluster !== ALL_CLUSTER_ID) {
      const cluster = getClusterById(selectedCluster)
      if (cluster) return cluster.displayName
    }
    return '切换区域'
  }, [selectedCluster, selectedDistrict])

  const handleRefresh = useCallback(() => {
    haptics('light')
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pools'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/discover'] })
    evictPersistedQuery(POOLS_QUERY_KEY)
  }, [queryClient])

  // ── Pull-to-refresh ──
  const pullDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  usePullDownRefresh(() => {
    handleRefresh()
    pullDownTimerRef.current = setTimeout(() => {
      Taro.stopPullDownRefresh()
      pullDownTimerRef.current = null
    }, 800)
  })
  useEffect(() => {
    return () => {
      if (pullDownTimerRef.current) {
        clearTimeout(pullDownTimerRef.current)
        pullDownTimerRef.current = null
      }
    }
  }, [])

  const renderPoolCard = useCallback(
    (pool: EventPoolSummary, index: number, hasBeenRendered: boolean) => {
      if (!hasBeenRendered) {
        discoverAnalytics.trackImpression(pool.id, {
          cardVersion: 'oracle_v1',
          accentFamily: pool.accentFamily,
        })
      }
      return (
        <OracleCard
          pool={pool}
          index={index}
          userArchetype={userArchetype}
          cornerStatEnabled={cornerStatEnabled}
          onTap={handlePoolTap}
        />
      )
    },
    [handlePoolTap, userArchetype, cornerStatEnabled]
  )

  const poolKeyExtractor = useCallback(
    (pool: EventPoolSummary) => pool.id,
    []
  )

  // ── Render ──
  return (
    <View className={`discover-auth ${tabEntranceClass}`}>
      {/* Test mode banner — APP_MODE=test only */}
      {(user as any)?.appMode === 'test' && (
        <SingleTestBanner className='discover-auth__test-banner' />
      )}
      {/* Hero promo banner — top of page */}
      <HeroPromoBanner
        className='discover-auth__promo'
        compact
        variant={bannerVariant}
        hasArchetype={!!userArchetype}
        // Server-driven kill switch from auth payload. Defaults to true
        // (banner shown) when the flag is missing or the user object
        // hasn't loaded yet.
        enabled={(user as any)?.features?.promoBannerEnabled ?? true}
        onCtaTap={handleBannerCtaTap}
      />

      {/* Greeting hero */}
      <View className='discover-auth__hero'>
        <View className='discover-auth__hero-avatar'>
          <Image
            className='discover-auth__hero-avatar-img'
            src={avatarError ? localFallback : avatarUrl}
            mode='aspectFill'
            aria-label={(avatarError || (!(user as any)?.profileImageUrl && !(user as any)?.wechatAvatarUrl)) ? '悦仔' : '用户头像'}
            onError={() => setAvatarError(true)}
          />
        </View>
        <View className='discover-auth__hero-text'>
          <View className='discover-auth__greeting-line' aria-label={`${timeGreeting}，今晚想怎么玩？`}>
            <Text className='discover-auth__greeting'>{timeGreeting}！</Text><Text className='discover-auth__greeting-prompt'>今晚想怎么玩？</Text>
          </View>
          <Text className='discover-auth__subtitle'>{dynamicSubtitle}</Text>
        </View>
      </View>

      {/* PR-5 + PR-9 first-visit arrival card (one-time; tap or 6s to dismiss).
          Top half: 悦仔's archetype-voiced return hook echoing the results-page
          promise. Bottom half: the two play-mode explainer lines. The bottom
          anchor arrow points at the 街头盲盒 card below. */}
      {showArrivalCoachmark ? (
        <View
          className='discover-auth__arrival-coachmark'
          onClick={() => handleArrivalCoachmarkClosed('tap_through')}
          hoverClass='discover-auth__arrival-coachmark--pressed'
          role='button'
          aria-label={`${arrivalHookLine}。玩法提示：${FLOW1_ENTRY_COPY.event.title}是同桌小局，${FLOW1_ENTRY_COPY.street.title}一个人也能玩。轻触收起`}
        >
          <View className='discover-auth__arrival-mascot' aria-hidden='true'>
            <Image
              className='discover-auth__arrival-mascot-img'
              src={avatarError ? localFallback : xiaoyueAsset}
              mode='aspectFit'
              onError={() => setAvatarError(true)}
            />
          </View>
          <View className='discover-auth__arrival-body'>
            <Text className='discover-auth__arrival-kicker'>先看看怎么玩</Text>
            <Text className='discover-auth__arrival-title'>{arrivalHookLine}</Text>
            <View className='discover-auth__arrival-row'>
              <Text className='discover-auth__arrival-eyebrow'>{FLOW1_ENTRY_COPY.event.eyebrow}</Text>
              <Text className='discover-auth__arrival-line'>
                {FLOW1_ENTRY_COPY.event.title} · {FLOW1_ENTRY_COPY.event.bannerLine}
              </Text>
            </View>
            <View className='discover-auth__arrival-row'>
              <Text className='discover-auth__arrival-eyebrow'>{FLOW1_ENTRY_COPY.street.eyebrow}</Text>
              <Text className='discover-auth__arrival-line'>
                {FLOW1_ENTRY_COPY.street.title} · {FLOW1_ENTRY_COPY.street.bannerLine}
              </Text>
            </View>
          </View>
          <Text
            className='discover-auth__arrival-dismiss'
            onClick={(e) => {
              e.stopPropagation()
              handleArrivalCoachmarkClosed('button')
            }}
          >
            知道了
          </Text>
          <View className='discover-auth__arrival-anchor' aria-hidden='true' />
        </View>
      ) : null}

      {/* Explore header */}
      <View className='discover-auth__explore-header'>
        <View className='discover-auth__explore-title-row'>
          <Image
            className='discover-auth__explore-mascot'
            src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
            mode='aspectFit'
          />
          <Text className='discover-auth__explore-title'>探索体验</Text>
        </View>
        <View
          className={`discover-auth__location-pill ${selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID ? 'discover-auth__location-pill--active' : ''}`}
          onClick={onOpenDrawer}
          hoverClass='discover-auth__location-pill--hover'
          role='button'
          aria-label={`当前区域: ${hasManualFilter ? '深圳 · ' + locationPillLabel : '深圳 · 切换区域'}, 点击切换`}
        >
          <View className='discover-auth__location-pill-icon-slot' aria-hidden='true'>
            <Image
              className='discover-auth__location-pill-icon'
              src={localAsset('/assets/icons/ui/icon-location.webp')}
              mode='aspectFit'
              lazyLoad={false}
            />
          </View>
          <Text className='discover-auth__location-pill-text'>
            {hasManualFilter ? `深圳 · ${locationPillLabel}` : '深圳 · 切换区域'}
          </Text>
          <View className='discover-auth__location-pill-chevron' aria-hidden='true' />
        </View>
      </View>

      {/* Alang NPC prototype card — server feature flag only */}
      <AlangDiscoverCard />

      {/* Pool listing */}
      <View className={`discover-auth__section${!poolsLoading && (poolsError || visiblePools.length === 0) ? ' discover-auth__section--empty' : ''}`}>
        {poolsFetching && !poolsLoading && (
          <View className='discover-auth__refresh-indicator' />
        )}
        {poolsLoading ? (
          <View className='discover-auth__pool-list'>
            <PoolCardSkeleton />
            <PoolCardSkeleton />
            <PoolCardSkeleton />
          </View>
        ) : poolsError ? (
          <StatusCard
            className='discover-auth__empty-state'
            tone='error'
            heroSrc={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            title='获取列表遇到小状况'
            description='下拉刷新一下就好'
            action={{
              label: '重试',
              onClick: handleRefresh,
              variant: 'primary',
            }}
          />
        ) : visiblePools.length > 0 ? (
          <>
            {isAutoRelaxed && (
              <View className='discover-auth__relaxed-banner'>
                <View className='jj-icon-text'>
                  <Text className='discover-auth__relaxed-banner-text'>这个区域暂时没活动，先看看附近的聚会吧</Text>
                  <JoyJoinIcon emoji='✨' tier='reveal' size={24} />
                </View>
              </View>
            )}
            <VirtualList
              className='discover-auth__pool-list-wrapper'
              listClassName='discover-auth__pool-list'
              items={visiblePools}
              itemHeight={DISCOVER_CARD_HEIGHT_RPX}
              keyExtractor={poolKeyExtractor}
              renderItem={renderPoolCard}
            />
          </>
        ) : (
          <StatusCard
            className='discover-auth__empty-state'
            tone='empty'
            heroSrc={cdnAsset('/assets/lovart/lovart-generic-empty.webp')}
            title='还没有适合你的活动'
            description={
              selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID
                ? '试试切换其他区域'
                : '新活动即将上线，敬请期待'
            }
            action={
              selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID
                ? {
                    label: '清除筛选',
                    onClick: () => onFilterSelect(ALL_CLUSTER_ID, ALL_DISTRICT_ID),
                    variant: 'secondary',
                  }
                : undefined
            }
          />
        )}
        {/* Keep the city entry as the final section beneath activities/empty state. */}
        <CityUnlockFeedCard onSelectCity={onOpenCityPicker} />
      </View>

      <View className='discover-auth__spacer' />
    </View>
  )
}

export default function DiscoverPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const markAsRead = useMarkNotificationsAsRead()
  const hasMarkedRef = useRef(false)

  // ── Discover-only scroll-responsive tab bar collapse ──
  // Collapses the native custom tab bar as the user scrolls down the feed,
  // and restores it when leaving the page. Gated by reduced motion and
  // low-end device tier (benchmarkLevel <= 15).
  const collapsedRef = useRef(false)
  const windowWidthRef = useRef(375)
  const motionGateRef = useRef({ reduceMotion: false, lowEnd: false })
  const tabBarRef = useRef<{ setCollapsed?: (c: boolean) => void } | null>(null)
  // Cache last known scroll position so useDidShow can apply the correct
  // collapse state synchronously, avoiding even a 1-frame expanded flash.
  const lastScrollTopRpxRef = useRef(0)

  const setTabBarCollapsed = useCallback((collapsed: boolean) => {
    try {
      const tabBar = tabBarRef.current ?? (Taro.getCurrentInstance().page as any)?.getTabBar?.()
      if (tabBar && typeof tabBar.setCollapsed === 'function') {
        tabBar.setCollapsed(collapsed)
      }
    } catch {
      // Gracefully ignore if the tab bar instance is detached or unavailable.
    }
  }, [])

  /** Hide/show the native tab bar when a bottom sheet is open. */
  const setTabBarSheetOpen = useCallback((open: boolean) => {
    try {
      const tabBar = tabBarRef.current ?? (Taro.getCurrentInstance().page as any)?.getTabBar?.()
      if (tabBar && typeof tabBar.setSheetOpen === 'function') {
        tabBar.setSheetOpen(open)
      }
    } catch {
      // Gracefully ignore if the tab bar instance is detached or unavailable.
    }
  }, [])

  /** Track collapse/expand transitions for operational visibility. */
  const trackTabBarTransition = useCallback((collapsed: boolean, scrollTopRpx: number) => {
    try {
      wx.reportAnalytics(collapsed ? 'tab_bar_collapsed' : 'tab_bar_expanded', {
        scroll_top_rpx: Math.round(scrollTopRpx),
        trigger: 'scroll',
      })
    } catch {
      // Analytics are non-critical.
    }
  }, [])

  useEffect(() => {
    try {
      const info = Taro.getSystemInfoSync() as any
      windowWidthRef.current = info.windowWidth || 375
      motionGateRef.current = {
        reduceMotion: !!info.reduceMotion,
        lowEnd: typeof info.benchmarkLevel === 'number' && info.benchmarkLevel <= 15,
      }
      tabBarRef.current = (Taro.getCurrentInstance().page as any)?.getTabBar?.() || null
    } catch {
      windowWidthRef.current = 375
      motionGateRef.current = { reduceMotion: false, lowEnd: false }
      tabBarRef.current = null
    }
    // Ensure the tab bar starts expanded when Discover mounts.
    collapsedRef.current = false
    setTabBarCollapsed(false)
  }, [setTabBarCollapsed])

  usePageScroll(({ scrollTop }) => {
    if (!COLLAPSIBLE_TAB_BAR_ENABLED || motionGateRef.current.reduceMotion || motionGateRef.current.lowEnd) return
    const scrollTopRpx = scrollTop * (750 / windowWidthRef.current)
    lastScrollTopRpxRef.current = scrollTopRpx
    if (collapsedRef.current) {
      if (scrollTopRpx <= TAB_BAR_EXPAND_THRESHOLD_RPX) {
        collapsedRef.current = false
        setTabBarCollapsed(false)
        trackTabBarTransition(false, scrollTopRpx)
      }
    } else {
      if (scrollTopRpx > TAB_BAR_COLLAPSE_THRESHOLD_RPX) {
        collapsedRef.current = true
        setTabBarCollapsed(true)
        trackTabBarTransition(true, scrollTopRpx)
      }
    }
  })

  useDidShow(() => {
    if (!COLLAPSIBLE_TAB_BAR_ENABLED || motionGateRef.current.reduceMotion || motionGateRef.current.lowEnd) return
    // Apply the last known scroll position synchronously to avoid even a
    // 1-frame expanded flash. The async query below refines this.
    const cachedRpx = lastScrollTopRpxRef.current
    const shouldCollapse = cachedRpx > TAB_BAR_COLLAPSE_THRESHOLD_RPX
    if (shouldCollapse !== collapsedRef.current) {
      collapsedRef.current = shouldCollapse
      setTabBarCollapsed(shouldCollapse)
    }
    // Async refinement: read the actual viewport scroll position and correct
    // if the cached value was stale.
    try {
      const query = Taro.createSelectorQuery()
      query.selectViewport().scrollOffset((res) => {
        if (!res || typeof res.scrollTop !== 'number') return
        const scrollTopRpx = res.scrollTop * (750 / windowWidthRef.current)
        const refined = scrollTopRpx > TAB_BAR_COLLAPSE_THRESHOLD_RPX
        if (refined !== collapsedRef.current) {
          collapsedRef.current = refined
          setTabBarCollapsed(refined)
          trackTabBarTransition(refined, scrollTopRpx)
        }
      }).exec()
    } catch {
      // Default to expanded if query fails.
      collapsedRef.current = false
      setTabBarCollapsed(false)
    }
  })

  useDidHide(() => {
    // Always restore the expanded tab bar when the user leaves Discover so
    // other non-collapse-wired tabs (Events, Connections, Profile, Center-Hub)
    // never inherit a collapsed bar.
    collapsedRef.current = false
    setTabBarCollapsed(false)
    // Also restore tab bar if a sheet was left open (e.g. switchTab while
    // a bottom sheet was visible). The sheet state persists across tab
    // switches via React state; closing the sheets here ensures clean
    // re-entry.
    setTabBarSheetOpen(false)
    setDrawerOpen(false)
    setShowCityPicker(false)
  })

  // ── Location filter state (lifted from AuthenticatedDiscover to render modals at root level) ──
  const saved = useMemo(() => readSavedLocation(), [])
  const [selectedCluster, setSelectedCluster] = useState<string>(
    saved?.clusterId ?? ALL_CLUSTER_ID
  )
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    saved?.districtId ?? ALL_DISTRICT_ID
  )
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [showCityPicker, setShowCityPicker] = useState(false)
  const [lastSelectedCity, setLastSelectedCity] = useState<string | null>(null)

  const handleFilterSelect = useCallback(
    (clusterId: string, districtId: string) => {
      setSelectedCluster(clusterId)
      setSelectedDistrict(districtId)
      if (clusterId === ALL_CLUSTER_ID && districtId === ALL_DISTRICT_ID) {
        clearLocation()
      } else {
        saveLocation(clusterId, districtId)
      }
    },
    []
  )

  const handleOpenDrawer = useCallback(() => {
    haptics('light')
    setDrawerOpen(true)
    setTabBarSheetOpen(true)
  }, [setTabBarSheetOpen])
  const handleCloseDrawer = useCallback(() => {
    setDrawerOpen(false)
    setTabBarSheetOpen(false)
  }, [setTabBarSheetOpen])
  const handleOpenCityPicker = useCallback(() => {
    setShowCityPicker(true)
    setTabBarSheetOpen(true)
  }, [setTabBarSheetOpen])
  const handleCloseCityPicker = useCallback(() => {
    setShowCityPicker(false)
    setTabBarSheetOpen(false)
  }, [setTabBarSheetOpen])
  const handleCityPickerSuccess = useCallback((city: string) => {
    setLastSelectedCity(city)
    setShowCityPicker(false)
    setTabBarSheetOpen(false)
    Taro.navigateTo({ url: '/pages/city-unlock/index' })
  }, [setTabBarSheetOpen])

  useCustomTabBarSync({
    enabled: isAuthenticated,
  })

  // Unauthenticated users should see the dedicated landing page (non-tab)
  // rather than the landing component embedded inside the Discover tab,
  // which incorrectly shows the tab bar and misses landing-specific styles.
  useEffect(() => {
    if (isLoading || isAuthenticated) return
    Taro.redirectTo({ url: MINI_PROGRAM_ROUTES.index }).catch((err) => {
      logWarn('[Discover] Redirect to landing failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }, [isLoading, isAuthenticated])

  useEffect(() => {
    if (!isAuthenticated || hasMarkedRef.current) return
    const timer = setTimeout(() => {
      markAsRead.mutate('discover')
      hasMarkedRef.current = true
    }, 100)
    return () => clearTimeout(timer)
  }, [isAuthenticated, markAsRead])

  return (
    <>
      <PageMorphWrapper
        isLoading={isLoading}
        loading={<LoadingScreen message='正在探索附近的氛围聚会…' />}
        content={isAuthenticated ? (
          <AuthenticatedDiscover
            selectedCluster={selectedCluster}
            selectedDistrict={selectedDistrict}
            onFilterSelect={handleFilterSelect}
            onOpenDrawer={handleOpenDrawer}
            onOpenCityPicker={handleOpenCityPicker}
          />
        ) : <MiniProgramLandingPage />}
      />
      {/* Modals rendered at root level to avoid PageMorphWrapper stacking-context bugs */}
      <LocationFilterDrawer
        open={drawerOpen}
        selectedCluster={selectedCluster}
        selectedDistrict={selectedDistrict}
        onSelect={handleFilterSelect}
        onClose={handleCloseDrawer}
      />
      <CityPickerSheet
        visible={showCityPicker}
        onClose={handleCloseCityPicker}
        onSuccess={handleCityPickerSuccess}
        initialSelectedCity={lastSelectedCity}
      />
    </>
  )
}
