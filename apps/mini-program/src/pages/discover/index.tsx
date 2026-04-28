import { View, Text, ScrollView } from '@tarojs/components'
import { cdnAsset } from '../../lib/cdnAssets'
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
import { apiRequest } from '../../lib/api'
import { useAuth } from '../../hooks/useAuth'
import { useCustomTabBarSync } from '../../hooks/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import LoadingScreen from '../../components/LoadingScreen'
import PageMorphWrapper from '../../components/PageMorphWrapper'
import Card from '../../components/Card'
import StatusCard from '../../components/StatusCard'
import AiMatchPromoCarousel from '../../components/AiMatchPromoCarousel'
import VirtualList from '../../components/VirtualList'
import ArchetypeGlyph from '../../components/ArchetypeGlyph'
import JoyJoinIcon from '../../components/JoyJoinIcon'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/tabBarConfig'
import { openMiniProgramPaymentPage } from '../../lib/paymentEntry'
import MiniProgramLandingPage from '../index/LandingPage'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────
const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'

// Measured PoolCard height in rpx.
// Verified: PoolCard height is stable across devices. Dynamic-height fallback is available if needed.
const DISCOVER_CARD_HEIGHT_RPX = 580

const EVENT_TYPE_LABELS: Record<string, string> = {
  dinner: '饭局',
  drinks: '酒局',
  other: '其他',
}

const STATUS_LABELS: Record<string, string> = {
  open: '报名中',
  filling: '即将满员',
  closed: '已截止',
}

// ─── Helpers ──────────────────────────────────────────────────────

function getEventTypeLabel(eventType?: string): string {
  if (!eventType) return '其他'
  return EVENT_TYPE_LABELS[eventType] ?? '其他'
}

function getStatusLabel(status?: string): string {
  if (!status) return '报名中'
  return STATUS_LABELS[status] ?? status
}

function getStatusModifier(status?: string): string {
  switch (status) {
    case 'open':
      return 'open'
    case 'filling':
      return 'filling'
    case 'closed':
      return 'closed'
    default:
      return 'open'
  }
}

function getFillPercent(current?: number, max?: number): number {
  if (!max || max === 0) return 0
  return Math.min(100, Math.round(((current ?? 0) / max) * 100))
}

function getPoolMomentum(pool: EventPoolSummary, fillPct: number): {
  label: string
  headline: string
  detail: string
  counter: string
} {
  const current = pool.currentParticipants ?? 0
  const max = pool.maxParticipants ?? 0
  const remaining = max > 0 ? Math.max(max - current, 0) : 0

  if (pool.status === 'closed') {
    return {
      label: '报名收尾',
      headline: '这一场正在等成组结果',
      detail: '时间和区域已经锁定，成局后会继续揭晓后续安排。',
      counter: current > 0 ? `${current} 人候局` : '等待下一轮',
    }
  }

  if (current === 0) {
    return {
      label: '新场开局',
      headline: '你来，局就热了',
      detail: '时间和区域先锁定，成局后再揭晓同桌伙伴。',
      counter: '虚位以待',
    }
  }

  if (pool.status === 'filling' || fillPct >= 78) {
    return {
      label: '热度很高',
      headline: '就差临门一脚',
      detail: '这一场正在迅速升温，现在加入更容易跟上同一桌的节奏。',
      counter: remaining > 0 ? `还差 ${remaining} 个席位` : `${current} 人已入池`,
    }
  }

  return {
    label: '慢慢热起来了',
    headline: '已经有人在等这场局',
    detail: '预算和偏好会一起参与匹配，不是只看一个标签硬凑局。',
    counter: max > 0 ? `${current}/${max} 人入池` : `${current} 人已入池`,
  }
}

// ─── Skeleton placeholder (initial loading) ───────────────────────
function PoolCardSkeleton() {
  return (
    <View className='discover-auth__pool-card discover-auth__pool-card--skeleton'>
      <View className='discover-auth__skeleton-line discover-auth__skeleton-line--title' />
      <View className='discover-auth__skeleton-line discover-auth__skeleton-line--meta' />
      <View className='discover-auth__skeleton-line discover-auth__skeleton-line--bar' />
    </View>
  )
}

// ─── Pool card ────────────────────────────────────────────────────
interface PoolCardProps {
  pool: EventPoolSummary
  isRegistered: boolean
  index: number
  onTap: (pool: EventPoolSummary) => void
  animate?: boolean
}

const PoolCard = React.memo(function PoolCard({
  pool,
  isRegistered,
  index,
  onTap,
  animate = true,
}: PoolCardProps) {
  const fillPct = getFillPercent(pool.currentParticipants, pool.maxParticipants)
  const statusMod = getStatusModifier(pool.status)
  const momentum = getPoolMomentum(pool, fillPct)
  const ctaLabel = isRegistered ? '查看报名进度' : '去填写偏好'

  const accentFamily = pool.accentFamily ?? 'calm'
  const sampleArchetypes = pool.sampleArchetypes ?? []
  const registrationCount = pool.registrationCount ?? 0
  const aiHeadline = pool.aiHeadline
  const hasUserArchetypeMatch = pool.hasUserArchetypeMatch ?? false

  // Show up to 5 unique glyphs; if more registrants exist, show +N badge
  const visibleGlyphs = sampleArchetypes.slice(0, 5)
  const hasMore = registrationCount > visibleGlyphs.length
  const moreCount = hasMore ? registrationCount - visibleGlyphs.length : 0

  const headline = aiHeadline ?? momentum.headline

  return (
    <Card
      className={`discover-auth__pool-card discover-auth__pool-card--live discover-auth__pool-card--accent-${accentFamily}`}
      hoverClass='discover-auth__pool-card--hover'
      style={animate ? { animationDelay: `${Math.min(index, 4) * 60}ms` } : undefined}
      onClick={() => onTap(pool)}
    >
      <View className='discover-auth__pool-topline'>
        <View className='discover-auth__pool-live'>
          <View className='discover-auth__heat-dot' />
          <Text className='discover-auth__pool-live-label'>{momentum.label}</Text>
        </View>
        <Text className='discover-auth__pool-inline-cta'>点击继续</Text>
      </View>

      <View className='discover-auth__pool-header'>
        <Text className='discover-auth__pool-title'>
          {pool.title || '悦聚活动'}
        </Text>
        <View className='discover-auth__pool-badges'>
          {isRegistered && (
            <Text className='discover-auth__badge discover-auth__badge--registered'>
              已报名
            </Text>
          )}
          <Text className='discover-auth__badge discover-auth__badge--type'>
            {getEventTypeLabel(pool.eventType)}
          </Text>
        </View>
      </View>

      {/* Personality palette — social proof */}
      {visibleGlyphs.length > 0 ? (
        <View className='discover-auth__pool-palette'>
          <Text className='discover-auth__pool-palette-label'>
            已有 {registrationCount} 人
          </Text>
          <View className='discover-auth__pool-palette-glyphs'>
            {visibleGlyphs.map((archetype, i) => (
              <ArchetypeGlyph
                key={`${archetype}-${i}`}
                archetype={archetype}
                size={32}
              />
            ))}
            {hasMore && (
              <Text className='discover-auth__pool-palette-more'>+{moreCount}</Text>
            )}
          </View>
          {hasUserArchetypeMatch && (
            <View className='discover-auth__pool-match-badge'>
              <Text>你的同类已加入</Text>
            </View>
          )}
        </View>
      ) : (
        <Text className='discover-auth__pool-palette-label' style={{ marginBottom: '12rpx' }}>
          首批探索者已就位
        </Text>
      )}

      <View className='discover-auth__pool-meta'>
        <Text className='discover-auth__pool-location'>
          📍 {[pool.city, pool.district].filter(Boolean).join(' · ') || '深圳'}
        </Text>
        <Text className='discover-auth__pool-date'>
          🗓 {pool.dateTime ?? '时间待定'}
        </Text>
      </View>

      <View className='discover-auth__pool-signal'>
        <View className='discover-auth__pool-signal-copy'>
          <Text className='discover-auth__pool-signal-title'>{headline}</Text>
          <Text className='discover-auth__pool-signal-desc'>{momentum.detail}</Text>
        </View>
        <Text className='discover-auth__pool-signal-count'>{momentum.counter}</Text>
      </View>

      <View className='discover-auth__progress-block'>
        <View className='discover-auth__progress'>
          <View className='discover-auth__progress-track'>
            <View
              className={`discover-auth__progress-fill discover-auth__progress-fill--${statusMod}`}
              style={{ transform: `scaleX(${fillPct / 100})` }}
            />
          </View>
          <Text className='discover-auth__progress-text'>
            {pool.currentParticipants ?? 0}/{pool.maxParticipants ?? '?'} 人
          </Text>
        </View>
        <Text className={`discover-auth__status discover-auth__status--${statusMod}`}>
          {getStatusLabel(pool.status)}
        </Text>
      </View>

      <View className='discover-auth__pool-footer'>
        <View className='discover-auth__trust-row'>
          <View className='discover-auth__trust-pill'>
            <Text className='discover-auth__trust-pill-text'>偏好参与匹配</Text>
          </View>
          <View className='discover-auth__trust-pill'>
            <Text className='discover-auth__trust-pill-text'>成局后再揭晓桌友</Text>
          </View>
        </View>
        <Text className='discover-auth__pool-action'>{ctaLabel} →</Text>
      </View>
    </Card>
  )
})

// ─── AuthenticatedDiscover ────────────────────────────────────────
function AuthenticatedDiscover() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const displayName = (user as any)?.displayName || (user as any)?.nickname || '悦聚用户'
  const handleOpenPayment = useCallback(() => {
    void openMiniProgramPaymentPage({
      paymentsEnabled: user?.paymentsEnabled,
      currentUserId: user?.id,
      returnTab: 'discover',
    })
  }, [user?.id, user?.paymentsEnabled])

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
    queryFn: () => getEventPools(apiRequest),
  })

  const { data: registrations = [] } = useQuery({
    queryKey: ['mini-program', 'my-pool-registrations'],
    queryFn: () => getMyPoolRegistrations(apiRequest),
  })

  // ── Derived: set of registered pool IDs for O(1) lookup ──
  const registeredPoolIds = useMemo<Set<string>>(
    () => new Set(registrations.map((r) => r.poolId)),
    [registrations],
  )

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
  const renderPoolCard = useCallback(
    (pool: EventPoolSummary, index: number, _hasBeenRendered: boolean) => (
      <PoolCard
        pool={pool}
        index={index}
        isRegistered={registeredPoolIds.has(pool.id)}
        onTap={handlePoolTap}
        animate={index < 6}
      />
    ),
    [registeredPoolIds, handlePoolTap]
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
          <Text className='discover-auth__greeting'>你好，{displayName} 👋</Text>
          <Text className='discover-auth__subtitle'>探索你的下一场悦聚</Text>
        </View>

        <View className='discover-auth__actions'>
          <Card className='discover-auth__action-card' onClick={handleOpenPayment}>
            <JoyJoinIcon emoji='🎁' size={40} className='discover-auth__action-emoji' />
            <Text className='discover-auth__action-label'>开通权益</Text>
          </Card>
          <Card className='discover-auth__action-card' onClick={() => Taro.switchTab({ url: '/pages/events/index' })}>
            <JoyJoinIcon emoji='📅' size={40} className='discover-auth__action-emoji' />
            <Text className='discover-auth__action-label'>我的活动</Text>
          </Card>
          <Card className='discover-auth__action-card' onClick={() => Taro.switchTab({ url: '/pages/connections/index' })}>
            <JoyJoinIcon emoji='🤝' size={40} className='discover-auth__action-emoji' />
            <Text className='discover-auth__action-label'>我的连接</Text>
          </Card>
        </View>

        <AiMatchPromoCarousel className='discover-auth__promo' />

        {/* City / District filter chips */}
        <View className='discover-auth__filter-section'>
          <ScrollView className='discover-auth__chips-row' scrollX enhanced showScrollbar={false}>
            <View className='discover-auth__chips-inner'>
              <Text
                className={`discover-auth__chip ${selectedCluster === ALL_CLUSTER_ID ? 'discover-auth__chip--active' : ''}`}
                onClick={() => handleClusterTap(ALL_CLUSTER_ID)}
              >
                全部
              </Text>
              {shenzhenClusters.map((cluster) => (
                <Text
                  key={cluster.id}
                  className={`discover-auth__chip ${selectedCluster === cluster.id ? 'discover-auth__chip--active' : ''}`}
                  onClick={() => handleClusterTap(cluster.id)}
                >
                  {cluster.displayName}
                </Text>
              ))}
            </View>
          </ScrollView>

          {visibleDistricts.length > 0 && (
            <ScrollView className='discover-auth__chips-row discover-auth__chips-row--districts' scrollX enhanced showScrollbar={false}>
              <View className='discover-auth__chips-inner'>
                <Text
                  className={`discover-auth__chip discover-auth__chip--sm ${selectedDistrict === ALL_DISTRICT_ID ? 'discover-auth__chip--active' : ''}`}
                  onClick={() => handleDistrictTap(ALL_DISTRICT_ID)}
                >
                  全部
                </Text>
                {visibleDistricts.map((district) => {
                  const heat = heatConfig[district.heat]
                  return (
                    <Text
                      key={district.id}
                      className={`discover-auth__chip discover-auth__chip--sm ${selectedDistrict === district.id ? 'discover-auth__chip--active' : ''}`}
                      onClick={() => handleDistrictTap(district.id)}
                    >
                      {district.name}
                      {heat.label ? ` ${heat.label}` : ''}
                    </Text>
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
            title='加载失败'
            description='请下拉刷新重试'
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
            title='暂无可报名的活动'
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
