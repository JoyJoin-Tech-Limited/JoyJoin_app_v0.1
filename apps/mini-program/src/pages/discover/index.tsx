import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getEventPools,
  getMyPoolRegistrations,
  type BlindBoxEventSummary,
  type EventPoolSummary,
  type PoolRegistrationSummary,
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
import Card from '../../components/Card'
import AiMatchPromoCarousel from '../../components/AiMatchPromoCarousel'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/tabBarConfig'
import { openMiniProgramPaymentPage } from '../../lib/paymentEntry'
import MiniProgramLandingPage from '../index/LandingPage'
import './index.scss'

// ─── Constants ────────────────────────────────────────────────────
const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'
const EMPTY_TAB_BAR_POOL_REGISTRATIONS: PoolRegistrationSummary[] = []
const EMPTY_TAB_BAR_EVENTS: BlindBoxEventSummary[] = []

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

/** Resolve a human-readable event-type badge label */
function getEventTypeLabel(eventType?: string): string {
  if (!eventType) return '其他'
  return EVENT_TYPE_LABELS[eventType] ?? '其他'
}

/** Resolve a status badge label */
function getStatusLabel(status?: string): string {
  if (!status) return '报名中'
  return STATUS_LABELS[status] ?? status
}

/** Status → CSS modifier */
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

/** Participant fill percentage clamped 0-100 */
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

// ─── Skeleton placeholder ─────────────────────────────────────────
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
}

function PoolCard({ pool, isRegistered, index, onTap }: PoolCardProps) {
  const fillPct = getFillPercent(pool.currentParticipants, pool.maxParticipants)
  const statusMod = getStatusModifier(pool.status)
  const momentum = getPoolMomentum(pool, fillPct)
  const ctaLabel = isRegistered ? '查看报名进度' : '去填写偏好'

  return (
    <Card
      className='discover-auth__pool-card discover-auth__pool-card--live'
      hoverClass='discover-auth__pool-card--hover'
      style={{ animationDelay: `${Math.min(index, 4) * 70}ms` }}
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

      <Text className='discover-auth__pool-promise'>时间区域已定 · 成局后再揭晓同桌伙伴</Text>

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
          <Text className='discover-auth__pool-signal-title'>{momentum.headline}</Text>
          <Text className='discover-auth__pool-signal-desc'>{momentum.detail}</Text>
        </View>
        <Text className='discover-auth__pool-signal-count'>{momentum.counter}</Text>
      </View>

      <View className='discover-auth__progress-block'>
        <View className='discover-auth__progress'>
          <View className='discover-auth__progress-track'>
            <View
              className={`discover-auth__progress-fill discover-auth__progress-fill--${statusMod}`}
              style={{ width: `${fillPct}%` }}
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
}

// ─── AuthenticatedDiscover ────────────────────────────────────────
function AuthenticatedDiscover() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const displayName = (user as any)?.displayName || (user as any)?.nickname || '悦聚用户'
  const handleOpenPayment = useCallback(() => {
    void openMiniProgramPaymentPage({
      paymentsEnabled: user?.paymentsEnabled,
      currentUserId: user?.id,
    })
  }, [user?.id, user?.paymentsEnabled])

  // ── Filter state ──
  const [selectedCluster, setSelectedCluster] = useState<string>(ALL_CLUSTER_ID)
  const [selectedDistrict, setSelectedDistrict] = useState<string>(ALL_DISTRICT_ID)

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
      // Cluster filter
      if (selectedCluster !== ALL_CLUSTER_ID) {
        const clusterDistricts = shenzhenClusters
          .find((c) => c.id === selectedCluster)
          ?.districts.map((d) => d.name) ?? []
        if (pool.district && !clusterDistricts.includes(pool.district)) {
          return false
        }
      }
      // District filter
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
    setSelectedDistrict(ALL_DISTRICT_ID) // reset district when cluster changes
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

  // ── Render ──
  return (
    <ScrollView
      className='discover-auth'
      scrollY
      enhanced
      showScrollbar={false}
      refresherEnabled
      refresherTriggered={poolsLoading}
      onRefresherRefresh={handleRefresh}
    >
      {/* Hero greeting */}
      <View className='discover-auth__hero'>
        <Text className='discover-auth__greeting'>你好，{displayName} 👋</Text>
        <Text className='discover-auth__subtitle'>探索你的下一场悦聚</Text>
      </View>

      {/* Quick actions */}
      <View className='discover-auth__actions'>
        <Card className='discover-auth__action-card' onClick={handleOpenPayment}>
          <Text className='discover-auth__action-emoji'>🎁</Text>
          <Text className='discover-auth__action-label'>开通权益</Text>
        </Card>
        <Card className='discover-auth__action-card' onClick={() => Taro.switchTab({ url: '/pages/events/index' })}>
          <Text className='discover-auth__action-emoji'>📅</Text>
          <Text className='discover-auth__action-label'>我的活动</Text>
        </Card>
        <Card className='discover-auth__action-card' onClick={() => Taro.switchTab({ url: '/pages/connections/index' })}>
          <Text className='discover-auth__action-emoji'>🤝</Text>
          <Text className='discover-auth__action-label'>我的连接</Text>
        </Card>
      </View>

      <AiMatchPromoCarousel className='discover-auth__promo' />

      {/* ── City / District filter chips ── */}
      <View className='discover-auth__filter-section'>
        {/* Cluster row */}
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

        {/* District row — shown when a specific cluster is selected or when "全部" shows all districts */}
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

      {/* ── Pool listing ── */}
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
          <Card className='discover-auth__empty-state'>
            <Text className='discover-auth__empty-emoji'>😥</Text>
            <Text className='discover-auth__empty'>加载失败</Text>
            <Text className='discover-auth__empty-hint'>请下拉刷新重试</Text>
          </Card>
        ) : filteredPools.length > 0 ? (
          <View className='discover-auth__pool-list'>
            {filteredPools.map((pool, index) => (
              <PoolCard
                key={pool.id}
                pool={pool}
                index={index}
                isRegistered={registeredPoolIds.has(pool.id)}
                onTap={handlePoolTap}
              />
            ))}
          </View>
        ) : (
          <Card className='discover-auth__empty-state'>
            <Text className='discover-auth__empty-emoji'>✨</Text>
            <Text className='discover-auth__empty'>暂无可报名的活动</Text>
            <Text className='discover-auth__empty-hint'>
              {selectedCluster !== ALL_CLUSTER_ID || selectedDistrict !== ALL_DISTRICT_ID
                ? '试试切换其他区域'
                : '新活动即将上线，敬请期待'}
            </Text>
          </Card>
        )}
      </View>

      <View className='discover-auth__spacer' />
    </ScrollView>
  )
}

export default function DiscoverPage() {
  const { isAuthenticated, isLoading } = useAuth()
  const markAsRead = useMarkNotificationsAsRead()
  const hasMarkedRef = useRef(false)
  const shouldSyncUnauthenticatedDiscoverState = !isLoading && !isAuthenticated

  useCustomTabBarSync({
    selectedIndex: MINI_PROGRAM_TAB_INDEX.discover,
    enabled: !isLoading,
    poolRegistrations: shouldSyncUnauthenticatedDiscoverState
      ? EMPTY_TAB_BAR_POOL_REGISTRATIONS
      : undefined,
    events: shouldSyncUnauthenticatedDiscoverState ? EMPTY_TAB_BAR_EVENTS : undefined,
  })

  useEffect(() => {
    if (!isAuthenticated || hasMarkedRef.current) return
    const timer = setTimeout(() => {
      markAsRead.mutate('discover')
      hasMarkedRef.current = true
    }, 100)
    return () => clearTimeout(timer)
  }, [isAuthenticated, markAsRead])

  if (isLoading) {
    return <LoadingScreen />
  }

  return isAuthenticated ? <AuthenticatedDiscover /> : <MiniProgramLandingPage />
}
