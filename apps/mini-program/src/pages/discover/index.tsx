import { View, Text, Image, ScrollView } from '@tarojs/components'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import Taro, { useReady, usePullDownRefresh } from '@tarojs/taro'
import React, { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEventPools,
  getMyPoolRegistrations,
  type EventPoolSummary,
} from '@shared/api'
import {
  shenzhenClusters,
  type District,
  heatConfig,
} from '@shared/districts'
import { apiRequest } from '../../lib/api/api'
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

// Measured OracleCard height in rpx. Keep in sync with `.oracle-card` height.
const DISCOVER_CARD_HEIGHT_RPX = 464

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
  const [selectedCluster, setSelectedCluster] = useState<string>(ALL_CLUSTER_ID)
  const [selectedDistrict, setSelectedDistrict] = useState<string>(ALL_DISTRICT_ID)

  // ── Sticky header height ──
  const [stickyHeaderHeight, setStickyHeaderHeight] = useState(0)
  useReady(() => {
    try {
      Taro.createSelectorQuery()
        .select('.discover-auth__sticky-header')
        .boundingClientRect((rect) => {
          const r = Array.isArray(rect) ? rect[0] : rect
          if (r) setStickyHeaderHeight(r.height)
        })
        .exec()
    } catch {
      // ignore measurement errors — VirtualList has fallback gates
    }
  })

  // ── Data fetching ──
  const {
    data: pools = [],
    isLoading: poolsLoading,
    isError: poolsError,
  } = useQuery({
    queryKey: ['mini-program', 'event-pools'],
    queryFn: async () => {
      try {
        return await getEventPools(apiRequest)
      } catch (e) {
        // Fallback: render mock pools when backend is unreachable (dev / preview)
        // NOTE: Set to `true` for WeChat DevTools UI testing without backend.
        // Gate this behind an explicit flag before shipping.
        const MOCK_POOLS_FOR_PREVIEW = true
        if (MOCK_POOLS_FOR_PREVIEW) {
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

  // ── Derived: districts for selected cluster ──
  const visibleDistricts = useMemo<District[]>(() => {
    if (selectedCluster === ALL_CLUSTER_ID) {
      return shenzhenClusters.flatMap((c) => c.districts)
    }
    const cluster = shenzhenClusters.find((c) => c.id === selectedCluster)
    return cluster?.districts ?? []
  }, [selectedCluster])

  // ── Derived: filtered pool list ──
  const filteredPools = useMemo<EventPoolSummary[]>(() => {
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
  }, [pools, selectedCluster, selectedDistrict, visibleDistricts])

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
  const handleClusterTap = useCallback((clusterId: string) => {
    setSelectedCluster(clusterId)
    setSelectedDistrict(ALL_DISTRICT_ID)
  }, [])

  const handleDistrictTap = useCallback((districtId: string) => {
    setSelectedDistrict(districtId)
  }, [])

  const handlePoolTap = useCallback((pool: EventPoolSummary) => {
    Taro.navigateTo({ url: `/pages/pool-registration/index?id=${pool.id}` })
  }, [])

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pools'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] })
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
    <View className='discover-auth'>
      {/* Sticky header: hero + actions + promo + filters */}
      <View className='discover-auth__sticky-header'>
        <View className='discover-auth__hero'>
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

        {/* City / District filter chips */}
        <View className='discover-auth__filter-section'>
          <ScrollView className='discover-auth__chips-row' scrollX enhanced showScrollbar={false}>
            <View className='discover-auth__chips-inner'>
              <View
                className={`discover-auth__chip ${selectedCluster === ALL_CLUSTER_ID ? 'discover-auth__chip--active' : ''}`}
                hoverClass='discover-auth__chip--hover'
                onClick={() => handleClusterTap(ALL_CLUSTER_ID)}
              >
                <Text className='discover-auth__chip-text'>全部</Text>
              </View>
              {shenzhenClusters.map((cluster) => (
                <View
                  key={cluster.id}
                  className={`discover-auth__chip ${selectedCluster === cluster.id ? 'discover-auth__chip--active' : ''}`}
                  hoverClass='discover-auth__chip--hover'
                  onClick={() => handleClusterTap(cluster.id)}
                >
                  <Text className='discover-auth__chip-text'>{cluster.displayName}</Text>
                </View>
              ))}
            </View>
          </ScrollView>

          {visibleDistricts.length > 0 && (
            <ScrollView className='discover-auth__chips-row discover-auth__chips-row--districts' scrollX enhanced showScrollbar={false}>
              <View className='discover-auth__chips-inner'>
                <View
                  className={`discover-auth__chip discover-auth__chip--sm ${selectedDistrict === ALL_DISTRICT_ID ? 'discover-auth__chip--active' : ''}`}
                  hoverClass='discover-auth__chip--hover'
                  onClick={() => handleDistrictTap(ALL_DISTRICT_ID)}
                >
                  <Text className='discover-auth__chip-text'>全部</Text>
                </View>
                {visibleDistricts.map((district) => {
                  const heat = heatConfig[district.heat]
                  return (
                    <View
                      key={district.id}
                      className={`discover-auth__chip discover-auth__chip--sm ${selectedDistrict === district.id ? 'discover-auth__chip--active' : ''}`}
                      hoverClass='discover-auth__chip--hover'
                      onClick={() => handleDistrictTap(district.id)}
                    >
                      <Text className='discover-auth__chip-text'>
                        {district.name}
                        {heat.label ? ` ${heat.label}` : ''}
                      </Text>
                    </View>
                  )
                })}
              </View>
            </ScrollView>
          )}
        </View>
      </View>

      {/* Pool listing */}
      <View className='discover-auth__section'>
        <Text className='discover-auth__section-title'>
          活动池 {!poolsLoading && `(${filteredPools.length})`}
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
            description='下拉刷新一下就好~'
          />
        ) : filteredPools.length > 0 ? (
          <VirtualList
            className='discover-auth__pool-list-wrapper'
            listClassName='discover-auth__pool-list'
            items={filteredPools}
            itemHeight={DISCOVER_CARD_HEIGHT_RPX}
            keyExtractor={poolKeyExtractor}
            renderItem={renderPoolCard}
            headerHeight={stickyHeaderHeight}
          />
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
