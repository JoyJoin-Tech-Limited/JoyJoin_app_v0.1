import { View, Text, Image } from '@tarojs/components'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
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
import { injectDiscoverShellIntoCache } from '../../lib/prefetchEngine'
import { useAuth } from '../../hooks/useAuth'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import LoadingScreen from '../../components/loading/LoadingScreen'
import PageMorphWrapper from '../../components/ui/PageMorphWrapper'
import Card from '../../components/ui/Card'
import StatusCard from '../../components/ui/StatusCard'
import AiMatchPromoCarousel from '../../components/AiMatchPromoCarousel'
import VirtualList from '../../components/VirtualList'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import OracleCard from '../../components/discover/OracleCard'
import LocationFilterDrawer from '../../components/discover/LocationFilterDrawer'
import CityUnlockBanner from '../../components/discover/CityUnlockBanner'
import CityUnlockFeedCard from '../../components/discover/CityUnlockFeedCard'
import CityPickerSheet from '../../components/discover/CityPickerSheet'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/navigation/tabBarConfig'
import { getTimeGreeting } from '../../lib/utils/timeGreeting'
import {
  getDiscoverSubtitle,
  getDiscoverActionLabel,
} from '../../lib/utils/discoverHeaderCopy'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { discoverAnalytics } from '../../lib/analytics/discoverAnalytics'
import MiniProgramLandingPage from '../index/LandingPage'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────
const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'
const LOCATION_STORAGE_KEY = 'discover_last_location'
const LOCATION_TTL_DAYS = 7

// Measured OracleCard height in rpx. Keep in sync with `.oracle-card` height.
const DISCOVER_CARD_HEIGHT_RPX = 464

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

// ─── AuthenticatedDiscover ────────────────────────────────────────
function AuthenticatedDiscover() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const displayName = (user as any)?.displayName || (user as any)?.nickname || '悦聚用户'

  // ── Filter state ──
  const saved = useMemo(() => readSavedLocation(), [])
  const [selectedCluster, setSelectedCluster] = useState<string>(
    saved?.clusterId ?? ALL_CLUSTER_ID
  )
  const [selectedDistrict, setSelectedDistrict] = useState<string>(
    saved?.districtId ?? ALL_DISTRICT_ID
  )
  const [drawerOpen, setDrawerOpen] = useState(false)

  // ── City unlock state ──
  const [showCityPicker, setShowCityPicker] = useState(false)

  // ── Geo detection state ──
  const [detectedClusterId, setDetectedClusterId] = useState<string | null>(null)
  const [geoStatus, setGeoStatus] = useState<'idle' | 'locating' | 'success' | 'denied' | 'error'>('idle')

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
    enabled: typeof window !== 'undefined',
    staleTime: 5 * 60 * 1000,
  })

  const hasCityInterest = myCityInterests.length > 0

  const {
    data: pools = [],
    isLoading: poolsLoading,
    isError: poolsError,
  } = useQuery({
    queryKey: ['mini-program', 'event-pools'],
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
          const now = new Date()
          const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)
          const nextWeek = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000)
          const fmt = (d: Date) => d.toISOString()
          return [
            {
              id: 'mock-pool-1',
              title: '周五微醺夜 · 破冰局',
              eventType: 'dinner',
              city: '深圳',
              district: '南山区',
              dateTime: fmt(tomorrow),
              status: 'open',
              description: '轻松小酌，认识新朋友',
              maxParticipants: 8,
              currentParticipants: 5,
              registrationCount: 5,
              spotsLeft: 3,
              sampleArchetypes: ['corgi', 'rooster', 'fox'],
              topArchetypes: [{ archetype: 'corgi', count: 2 }, { archetype: 'rooster', count: 2 }, { archetype: 'fox', count: 1 }],
              accentFamily: 'warm',
              aiHeadline: '5 人已在局，氛围轻松',
              hasUserArchetypeMatch: true,
              price: 168,
              userTypeCount: 2,
              userTypeRarity: 'present',
              highChemistryCount: 3,
              topComplementaryType: 'rooster',
              narrativePivot: 'present',
              hoursUntilDeadline: 18,
            },
            {
              id: 'mock-pool-2',
              title: '周日户外徒步 · 畅聊局',
              eventType: 'outdoor',
              city: '深圳',
              district: '福田区',
              dateTime: fmt(nextWeek),
              status: 'open',
              description: '梅林山郊野径，新手友好',
              maxParticipants: 12,
              currentParticipants: 2,
              registrationCount: 2,
              spotsLeft: 10,
              sampleArchetypes: ['fox', 'dolphin_calm'],
              topArchetypes: [{ archetype: 'fox', count: 1 }, { archetype: 'dolphin_calm', count: 1 }],
              accentFamily: 'cool',
              aiHeadline: '2 人报名，山野清新',
              hasUserArchetypeMatch: false,
              price: 0,
              userTypeCount: 0,
              userTypeRarity: 'rare',
              highChemistryCount: 1,
              topComplementaryType: null,
              narrativePivot: 'rare',
              hoursUntilDeadline: 120,
            },
            {
              id: 'mock-pool-3',
              title: '全新开局 · 等你点亮',
              eventType: 'coffee',
              city: '深圳',
              district: '南山区',
              dateTime: fmt(tomorrow),
              status: 'open',
              description: '首场咖啡局，期待你的加入',
              maxParticipants: 6,
              currentParticipants: 0,
              registrationCount: 0,
              spotsLeft: 6,
              sampleArchetypes: [],
              topArchetypes: [],
              accentFamily: 'calm',
              aiHeadline: null,
              hasUserArchetypeMatch: false,
              price: 88,
              userTypeCount: 0,
              userTypeRarity: 'rare',
              highChemistryCount: 0,
              topComplementaryType: null,
              narrativePivot: 'empty',
              hoursUntilDeadline: 48,
            },
            {
              id: 'mock-pool-4',
              title: '桌游狂欢夜 · 狂欢局',
              eventType: 'boardgame',
              city: '深圳',
              district: '宝安区',
              dateTime: fmt(tomorrow),
              status: 'filling_fast',
              description: '狼人杀 + 阿瓦隆，高能烧脑',
              maxParticipants: 10,
              currentParticipants: 9,
              registrationCount: 9,
              spotsLeft: 1,
              sampleArchetypes: ['fox', 'spider', 'rooster', 'octopus', 'corgi', 'owl'],
              topArchetypes: [{ archetype: 'fox', count: 3 }, { archetype: 'spider', count: 2 }, { archetype: 'rooster', count: 2 }, { archetype: 'octopus', count: 1 }, { archetype: 'corgi', count: 1 }],
              accentFamily: 'fire',
              aiHeadline: '9 人集结，最后 1 席',
              hasUserArchetypeMatch: true,
              price: 128,
              userTypeCount: 1,
              userTypeRarity: 'present',
              highChemistryCount: 7,
              topComplementaryType: 'fox',
              narrativePivot: 'present',
              hoursUntilDeadline: 6,
            },
          ] as unknown as EventPoolSummary[]
        }
        throw e
      }
    },
  })

  const { data: registrations = [] } = useQuery({
    queryKey: ['mini-program', 'my-pool-registrations'],
    queryFn: () => getMyPoolRegistrations(apiRequest),
  })

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
  const visiblePools = isAutoRelaxed
    ? sortPoolsByProximity(pools, detectedClusterId)
    : displayPools

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
  const archetype = (user as any)?.archetype || (user as any)?.primaryArchetype || null
  const timeGreeting = useMemo(() => getTimeGreeting(displayName), [displayName])
  const xiaoyueAsset = useMemo(() => getXiaoyueExpressionAsset('homeWelcome'), [])
  const dynamicSubtitle = useMemo(
    () =>
      getDiscoverSubtitle({
        displayName,
        archetype,
        registrationCount: registrations.length,
        openPoolCount: pools.filter((p) => p.status !== 'closed').length,
      }),
    [displayName, archetype, registrations.length, pools],
  )
  const primaryAction = useMemo(
    () =>
      getDiscoverActionLabel({
        displayName,
        archetype,
        registrationCount: registrations.length,
        openPoolCount: pools.filter((p) => p.status !== 'closed').length,
      }),
    [displayName, archetype, registrations.length, pools],
  )

  // ── Handlers ──
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

  const handleOpenDrawer = useCallback(() => setDrawerOpen(true), [])
  const handleCloseDrawer = useCallback(() => setDrawerOpen(false), [])

  const handlePoolTap = useCallback((pool: EventPoolSummary) => {
    Taro.navigateTo({ url: `/pages/pool-registration/index?id=${pool.id}` })
  }, [])

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
    return '探索全部'
  }, [selectedCluster, selectedDistrict])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pools'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/discover'] })
  }, [queryClient])

  // ── Pull-to-refresh ──
  usePullDownRefresh(() => {
    handleRefresh()
    setTimeout(() => {
      Taro.stopPullDownRefresh()
    }, 800)
  })

  // ── Render helpers ──
  const userArchetype = (user as any)?.archetype || (user as any)?.primaryArchetype || null

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
      {/* Xiaoyue greeting header */}
      <View className='discover-auth__greeting'>
        <Image
          className='discover-auth__greeting-mascot'
          src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-home-welcome.webp')}
          mode='aspectFit'
          lazyLoad
        />
        <View className='discover-auth__greeting-text'>
          <Text className='discover-auth__greeting-title'>
            {(user as any)?.nickname || (user as any)?.displayName || '朋友'}，今晚想怎么玩？
          </Text>
          <Text className='discover-auth__greeting-subtitle'>
            发现与你契合的社交活动
          </Text>
        </View>
      </View>

      {/* Hero + actions + promo — scroll away naturally */}
      <View className='discover-auth__hero'>
        <View className='discover-auth__hero-left'>
          <View className='discover-auth__hero-mascot'>
            <Image
              className='discover-auth__hero-mascot-img'
              src={xiaoyueAsset}
              mode='aspectFit'
              ariaLabel='悦仔'
            />
          </View>
          <View className='discover-auth__hero-text'>
            <Text className='discover-auth__greeting'>{timeGreeting}</Text>
            <Text className='discover-auth__subtitle'>{dynamicSubtitle}</Text>
          </View>
        </View>

        {/* Location Pill */}
        <View
          className={`discover-auth__location-pill ${selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID ? 'discover-auth__location-pill--active' : ''}`}
          onClick={handleOpenDrawer}
          hoverClass='discover-auth__location-pill--hover'
          aria-role='button'
          aria-label={`当前区域: 深圳 · ${locationPillLabel}, 点击切换`}
        >
          <JoyJoinIcon
            emoji='📍'
            size={24}
            className='discover-auth__location-pill-icon'
          />
          <Text className='discover-auth__location-pill-text'>
            在 深圳 · {locationPillLabel} ▼
          </Text>
        </View>

        {/* Geo status hint — shown when GPS-sorted and not manually filtered */}
        {!hasManualFilter && detectedClusterId && geoStatus === 'success' && (
          <View className='discover-auth__geo-hint'>
            <Text className='discover-auth__geo-hint-text'>
              为你优先展示{getClusterById(detectedClusterId)?.displayName ?? '附近'}的聚会
            </Text>
          </View>
        )}
      </View>

      {primaryAction && (
        <View className='discover-auth__primary-action'>
          <Card
            className='discover-auth__action-card'
            onClick={() => Taro.navigateTo({ url: primaryAction.path })}
          >
            <JoyJoinIcon
              emoji={primaryAction.emoji}
              size={40}
              className='discover-auth__action-emoji'
            />
            <Text className='discover-auth__action-label'>{primaryAction.label}</Text>
          </Card>
        </View>
      )}

      <AiMatchPromoCarousel className='discover-auth__promo' />

      {/* Location Filter Drawer */}
      <LocationFilterDrawer
        open={drawerOpen}
        selectedCluster={selectedCluster}
        selectedDistrict={selectedDistrict}
        onSelect={handleFilterSelect}
        onClose={handleCloseDrawer}
      />

      {/* City unlock banner — shown when user hasn't expressed city interest */}
      {!hasCityInterest && (
        <CityUnlockBanner onSelectCity={() => setShowCityPicker(true)} />
      )}

      {/* Pool listing */}
      <View className='discover-auth__section'>
        <Text className='discover-auth__section-title'>
          活动池 {!poolsLoading && `(${visiblePools.length})`}
        </Text>

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
          />
        ) : visiblePools.length > 0 ? (
          <>
            {isAutoRelaxed && (
              <View className='discover-auth__relaxed-banner'>
                <Text className='discover-auth__relaxed-banner-text'>
                  这个区域暂时没活动，先看看附近的聚会吧 ✨
                </Text>
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
              <CityUnlockFeedCard onSelectCity={() => setShowCityPicker(true)} />
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
          />
        )}
      </View>

      <View className='discover-auth__spacer' />

      {/* City picker bottom sheet */}
      <CityPickerSheet
        visible={showCityPicker}
        onClose={() => setShowCityPicker(false)}
        onSuccess={(city) => {
          setShowCityPicker(false)
          Taro.navigateTo({ url: '/pages/city-unlock/index' })
        }}
      />
    </View>
  )
}

export default function DiscoverPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const markAsRead = useMarkNotificationsAsRead()
  const hasMarkedRef = useRef(false)

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
    <PageMorphWrapper
      isLoading={isLoading}
      loading={<LoadingScreen message='正在探索附近的氛围聚会…' />}
      content={isAuthenticated ? <AuthenticatedDiscover /> : <MiniProgramLandingPage />}
    />
  )
}
