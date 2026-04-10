import { View, Text, Image, Button, Navigator, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useMemo, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getPricing,
  getUserCoupons,
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
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import './index.scss'
import logoImage from '../../assets/box_logo_archetypes.png'
import matchCardImg from '../../assets/match.png'
import dinnerImg from '../../assets/dinner.png'
import continueImg from '../../assets/continue.png'

// ─── Constants ────────────────────────────────────────────────────
const ALL_CLUSTER_ID = '__all__'
const ALL_DISTRICT_ID = '__all__'

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
  onTap: (pool: EventPoolSummary) => void
}

function PoolCard({ pool, isRegistered, onTap }: PoolCardProps) {
  const fillPct = getFillPercent(pool.currentParticipants, pool.maxParticipants)
  const statusMod = getStatusModifier(pool.status)

  return (
    <Card
      className='discover-auth__pool-card'
      onClick={() => onTap(pool)}
    >
      {/* Top row: title + event-type badge */}
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

      {/* Meta: location + date */}
      <View className='discover-auth__pool-meta'>
        <Text className='discover-auth__pool-location'>
          📍 {[pool.city, pool.district].filter(Boolean).join(' · ') || '深圳'}
        </Text>
        <Text className='discover-auth__pool-date'>
          🗓 {pool.dateTime ?? '时间待定'}
        </Text>
      </View>

      {/* Progress bar + status */}
      <View className='discover-auth__pool-footer'>
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
    </Card>
  )
}

// ─── AuthenticatedDiscover ────────────────────────────────────────
function AuthenticatedDiscover() {
  const { user } = useAuth()
  const queryClient = useQueryClient()
  const displayName = (user as any)?.displayName || (user as any)?.nickname || '悦聚用户'

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
        <Card className='discover-auth__action-card' onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}>
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
            {filteredPools.map((pool) => (
              <PoolCard
                key={pool.id}
                pool={pool}
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

function UnauthenticatedLanding() {
  const { data: pricing = [] } = useQuery({
    queryKey: ['mini-program', 'pricing'],
    queryFn: () => getPricing(apiRequest),
  })
  const { data: coupons = { count: 0, coupons: [] } } = useQuery({
    queryKey: ['mini-program', 'coupons'],
    queryFn: () => getUserCoupons(apiRequest),
  })

  const featuredPlan = pricing.find((plan) => plan.planType === 'vip_quarterly') ?? pricing[0]

  return (
    <View className='landing-page'>
      <View className='content-zone'>
        <View className='logo-container'>
          <View className='logo-bg'></View>
          <Image src={logoImage} className='logo-img' mode='aspectFit' />
        </View>

        <View className='hero-cards'>
          <View className='card card-left'>
            <View className='card-img-wrap'>
              <Image src={matchCardImg} className='card-img' mode='aspectFill' />
            </View>
            <View className='card-text'>
              <Text>匹配</Text>
            </View>
          </View>

          <View className='card card-center'>
            <View className='card-img-wrap'>
              <Image src={dinnerImg} className='card-img' mode='aspectFill' />
            </View>
            <View className='card-text'>
              <Text>悦聚</Text>
            </View>
          </View>

          <View className='card card-right'>
            <View className='card-img-wrap'>
              <Image src={continueImg} className='card-img' mode='aspectFill' />
            </View>
            <View className='card-text'>
              <Text>延续</Text>
            </View>
          </View>
        </View>

        <View className='text-content'>
          <Text className='headline'>让对的相遇不再错过</Text>
          <Text className='subtitle'>通过氛围测试，找到你的氛围原型，遇见志同道合的ta</Text>
          <View className='badges'>
            {['🧠 氛围测试', '🎯 算法匹配', '👥 4-6人局'].map((label) => (
              <View key={label} className='badge'>
                <Text>{label}</Text>
              </View>
            ))}
          </View>
        </View>

        <View className='payment-page__summary-card'>
          <Text className='payment-page__summary-label'>当前功能入口</Text>
          <Text className='payment-page__summary-value'>活动权益 / 登录 / Onboarding</Text>
          <Text className='payment-page__summary-note'>
            {featuredPlan ? `推荐方案：${featuredPlan.displayName} · ¥${featuredPlan.price}` : '正在同步支付与优惠信息'}
          </Text>
          <Text className='payment-page__summary-note'>可用优惠：{coupons.count ?? 0} 张</Text>
        </View>
      </View>

      <View className='bottom-zone'>
        <Button className='primary-btn' onClick={() => Taro.navigateTo({ url: '/pages/onboarding/personality-test/index' })} hoverClass='primary-btn-hover'>
          看看我会遇见谁
        </Button>
        <Button className='secondary-btn' onClick={() => Taro.navigateTo({ url: '/pages/blind-box-payment/index' })}>
          查看会员权益
        </Button>
        <Button className='secondary-btn' onClick={() => Taro.navigateTo({ url: '/pages/login/index' })}>
          已有账号？登录
        </Button>
        <View className='legal-text'>
          <Text>我已阅读并同意</Text>
          {/* Temporary combined legal page until separate privacy content lands in mini-program. */}
          <Navigator url='/pages/terms/index' className='link'>《用户协议》</Navigator>
          <Text>和</Text>
          <Navigator url='/pages/terms/index' className='link'>《隐私政策》</Navigator>
        </View>
      </View>
    </View>
  )
}

export default function DiscoverPage() {
  const { isAuthenticated, isLoading } = useAuth()

  if (isLoading) {
    return <LoadingScreen />
  }

  return isAuthenticated ? <AuthenticatedDiscover /> : <UnauthenticatedLanding />
}
