import { View, Text, Image } from '@tarojs/components'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { loadBrandDisplayFont } from '../../lib/utils/brandFont'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { haptics } from '../../lib/utils/haptics'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEventPools,
  getMyPoolRegistrations,
  type EventPoolSummary,
  reverseGeocode,
} from '@shared/api'
import {
  shenzhenClusters,
  getDistrictById,
  getClusterById,
  getClusterIdByDistrictName,
  sortPoolsByProximity,
  type District,
} from '@shared/districts'
import { apiRequest, fetchDiscoverShell } from '../../lib/api/api'
import { injectDiscoverShellIntoCache, POOLS_QUERY_KEY } from '../../lib/prefetchEngine'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { useAuth } from '../../hooks/useAuth'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
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
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/navigation/tabBarConfig'
import { getTimeGreeting } from '../../lib/utils/timeGreeting'
import {
  getDiscoverSubtitle,
} from '../../lib/utils/discoverHeaderCopy'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import { getDevMockPools } from '../../lib/dev/devPoolMocks'
import MiniProgramLandingPage from '../index/LandingPage'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────
const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'
const LOCATION_STORAGE_KEY = 'discover_last_location'
const LOCATION_TTL_DAYS = 7

// Measured OracleCard height in rpx. Keep in sync with `.oracle-card` height.
const DISCOVER_CARD_HEIGHT_RPX = 556

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
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const displayName = (user as any)?.displayName || (user as any)?.nickname || '悦聚用户'
  const userArchetype = (user as any)?.primaryArchetype || (user as any)?.archetype || null
  const xiaoyueAsset = useMemo(() => getXiaoyueExpressionAsset('homeWelcome'), [])
  const avatarUrl = (user as any)?.profileImageUrl || (user as any)?.wechatAvatarUrl || xiaoyueAsset

  const [avatarError, setAvatarError] = useState(false)

  // ── Geo detection state ──
  const [detectedClusterId, setDetectedClusterId] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'success' | 'denied' | 'error'>('idle')
  const hasAutoSetFilterRef = useRef(false)

  // ── Data fetching ──
  const {
    data: myCityInterests = [],
  } = useQuery({
    queryKey: ['my-city-interests'],
    queryFn: async () => {
      const res = await apiRequest<{ interests: { city: string }[] }>({
        method: 'GET',
        path: '/api/cities/my-interests',
      })
      return res.interests ?? []
    },
    enabled: process.env.TARO_ENV === 'weapp',
    staleTime: 5 * 60 * 1000,
  })

  const hasCityInterest = myCityInterests.length > 0

  const {
    data: pools = [],
    isLoading: poolsLoading,
    isError: poolsError,
    isFetching: poolsFetching,
  } = useQuery({
    queryKey: ['mini-program', 'event-pools'],
    staleTime: 2 * 60 * 1000,
    queryFn: async (): Promise<EventPoolSummary[]> => {
      // Primary: composite endpoint — 1 request for all Discover data.
      // Why: cuts TTFB and request overhead vs 3 parallel calls.
      try {
        const shell = await fetchDiscoverShell()
        injectDiscoverShellIntoCache(queryClient, shell)
        return shell.pools.items as EventPoolSummary[]
      } catch {
        // Composite unavailable — fall back to legacy 3-request pattern.
      }

      try {
        return await getEventPools(apiRequest)
      } catch (e) {
        // Dev-only mock fallback for UI testing without backend.
        // Gated to development so production never serves fake data (AC-12).
        if (process.env.NODE_ENV === 'development') {
          return getDevMockPools()
        }
        throw e
      }
    },
  })

  const { data: registrations = [] } = useQuery({
    queryKey: ['mini-program', 'my-pool-registrations'],
    staleTime: 2 * 60 * 1000,
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

  // ── Geo detection effect ──
  // Asynchronously detect user location for proximity sorting.
  // Does not block rendering — pools are shown immediately, then re-sorted.
  useEffect(() => {
    // Skip if user has an active manual selection
    if (selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID) {
      return
    }

    let cancelled = false

    async function detectLocation() {
      try {
        setGeoStatus('locating')
        const res = await Taro.getLocation({ type: 'gcj02' })
        if (cancelled) return

        const geo = await reverseGeocode(apiRequest, res.latitude, res.longitude)
        if (cancelled) return

        if (geo.success && geo.district) {
          const clusterId = getClusterIdByDistrictName(geo.district)
          if (clusterId) {
            setDetectedClusterId(clusterId)
            setGeoStatus('success')
            discoverAnalytics.track('geo_detected', undefined, {
              clusterId,
              district: geo.district,
              source: geo.source,
            })
            return
          }
        }
        // District not recognized or API failed — fall through to error state
        setGeoStatus('error')
      } catch (err: any) {
        if (cancelled) return
        // User denied permission or location unavailable
        // WeChat error messages vary by platform/version:
        //   "getLocation:fail auth deny"
        //   "getLocation:fail system permission denied"
        //   "getLocation:fail no permission"
        //   "getLocation:fail timeout"
        const errMsg = String(err?.errMsg ?? err?.message ?? '').toLowerCase()
        const isTimeout = errMsg.includes('timeout')
        const isDenial = !isTimeout && (
          errMsg.includes('deny') ||
          errMsg.includes('auth') ||
          errMsg.includes('permission') ||
          errMsg.includes('no permission')
        )
        setGeoStatus(isDenial ? 'denied' : 'error')
        discoverAnalytics.track('geo_failed', undefined, {
          reason: isDenial ? 'denied' : isTimeout ? 'timeout' : 'error',
          errMsg: err?.errMsg,
        })
      }
    }

    detectLocation()
    return () => {
      cancelled = true
    }
    // apiRequest and discoverAnalytics are stable singletons; selected states drive re-run
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCluster, selectedDistrict])

  // ── GPS auto-filter on first detection ──
  // When GPS first succeeds and no manual filter is active, auto-set the
  // district filter silently. Only runs once per session.
  useEffect(() => {
    if (!detectedClusterId || geoStatus !== 'success') return
    if (hasAutoSetFilterRef.current) return
    if (selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID) return

    hasAutoSetFilterRef.current = true
    onFilterSelect(detectedClusterId, ALL_DISTRICT_ID)
    discoverAnalytics.track('geo_auto_filter', undefined, {
      clusterId: detectedClusterId,
    })
  }, [detectedClusterId, geoStatus, selectedCluster, selectedDistrict, onFilterSelect])

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
  //   - No manual selection → show all pools sorted by proximity to detected cluster
  //   - No GPS / detection failed → show all pools in server order (time-based)
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

    // Relaxed mode: show all pools sorted by proximity
    return sortPoolsByProximity(pools, detectedClusterId)
  }, [pools, selectedCluster, selectedDistrict, visibleDistricts, detectedClusterId, hasManualFilter])

  // ── Empty-state auto-relaxation ──
  // When manual filter returns nothing, automatically fall back to all pools
  // sorted by proximity, with a banner explaining the relaxation.
  const isAutoRelaxed = hasManualFilter && displayPools.length === 0 && pools.length > 0
  const visiblePools = useMemo<EventPoolSummary[]>(
    () => (isAutoRelaxed ? sortPoolsByProximity(pools, detectedClusterId) : displayPools),
    [isAutoRelaxed, pools, detectedClusterId, displayPools],
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
  const dynamicSubtitle = useMemo(
    () =>
      getDiscoverSubtitle({
        displayName,
        archetype: userArchetype,
        registrationCount: registrations.length,
        openPoolCount: pools.filter((p) => p.status !== 'closed').length,
      }),
    [displayName, userArchetype, registrations.length, pools],
  )
  // ── Handlers ──
  const openPools = useMemo(
    () => pools.filter((p) => p.status !== 'closed'),
    [pools],
  )

  const bannerVariant = useMemo(
    () => resolveVariant((user as any)?.id, !!userArchetype),
    [(user as any)?.id, userArchetype],
  )

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
          onTap={handlePoolTap}
        />
      )
    },
    [handlePoolTap, userArchetype]
  )

  const poolKeyExtractor = useCallback(
    (pool: EventPoolSummary) => pool.id,
    []
  )

  // ── Render ──
  return (
    <View className='discover-auth tab-page-enter'>
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
            src={avatarError ? xiaoyueAsset : avatarUrl}
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

      {/* Explore header */}
      <View className='discover-auth__explore-header'>
        <Text className='discover-auth__explore-title'>探索体验</Text>
        <View
          className={`discover-auth__location-pill ${selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID ? 'discover-auth__location-pill--active' : ''}`}
          onClick={onOpenDrawer}
          hoverClass='discover-auth__location-pill--hover'
          role='button'
          aria-label={`当前区域: 深圳 · ${locationPillLabel}, 点击切换`}
        >
          <JoyJoinIcon
            emoji='📍'
            size={24}
            className='discover-auth__location-pill-icon'
          />
          <Text className='discover-auth__location-pill-text'>
            在 深圳 • {locationPillLabel}
          </Text>
          <Text className='discover-auth__location-pill-chevron'>▼</Text>
        </View>
      </View>

      {/* Geo status hint — shown when GPS-sorted and not manually filtered */}
      {!hasManualFilter && detectedClusterId && geoStatus === 'success' && (
        <View className='discover-auth__geo-hint'>
          <Text className='discover-auth__geo-hint-text'>
            为你优先展示{getClusterById(detectedClusterId)?.displayName ?? '附近'}的聚会
          </Text>
        </View>
      )}

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
            {/* City unlock feed card — shown at bottom of pool list */}
            {!hasCityInterest && (
              <CityUnlockFeedCard onSelectCity={onOpenCityPicker} />
            )}
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
      </View>

      <View className='discover-auth__spacer' />
    </View>
  )
}

export default function DiscoverPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const markAsRead = useMarkNotificationsAsRead()
  const hasMarkedRef = useRef(false)

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

  const handleOpenDrawer = useCallback(() => { haptics('light'); setDrawerOpen(true) }, [])
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), [])
  const handleOpenCityPicker = useCallback(() => setShowCityPicker(true), [])
  const handleCloseCityPicker = useCallback(() => setShowCityPicker(false), [])
  const handleCityPickerSuccess = useCallback((city: string) => {
    setShowCityPicker(false)
    Taro.navigateTo({ url: '/pages/city-unlock/index' })
  }, [])

  useCustomTabBarSync({
    selectedIndex: MINI_PROGRAM_TAB_INDEX.discover,
    enabled: isAuthenticated,
  })

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
      />
    </>
  )
}
