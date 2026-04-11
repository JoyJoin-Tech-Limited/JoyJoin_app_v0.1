import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useState, useCallback } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  getMyPoolRegistrations,
  cancelPoolRegistration,
  type PoolRegistrationSummary,
} from '@shared/api'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useWebSocket } from '../../hooks/useWebSocket'
import { logInfo, logError } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import './index.scss'

// ─── Helpers ──────────────────────────────────────────────────────

/** Format an ISO date string to a user-friendly Chinese date. */
function formatDateTime(dateTime?: string): string {
  if (!dateTime) return '时间待定'
  const d = new Date(dateTime)
  return d.toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Map matchStatus to a display label. */
function getStatusLabel(status?: string): string {
  switch (status) {
    case 'matched':
      return '匹配成功！🎉'
    case 'completed':
      return '活动已完成'
    case 'pending':
    default:
      return '匹配进行中'
  }
}

/** Map vibe to Chinese label. */
function getVibeLabel(vibe?: string): string {
  switch (vibe) {
    case 'playful':
      return '轻松有趣'
    case 'professional':
      return '专业交流'
    case 'creative':
      return '创意满满'
    case 'adventurous':
      return '探索冒险'
    default:
      return vibe ?? ''
  }
}

function getCountdownState(dateTime?: string): { isExpired: boolean; label: string } {
  if (!dateTime) {
    return { isExpired: false, label: '时间待定' }
  }

  const targetTime = new Date(dateTime).getTime()
  if (Number.isNaN(targetTime)) {
    return { isExpired: false, label: '时间待定' }
  }

  const diff = targetTime - Date.now()
  if (diff <= 0) {
    return { isExpired: true, label: '活动时间已到，当前这桌未能成局' }
  }

  const hours = Math.floor(diff / (1000 * 60 * 60))
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))

  if (hours >= 24) {
    const days = Math.floor(hours / 24)
    return { isExpired: false, label: `距离开始还有 ${days} 天` }
  }

  if (hours > 0) {
    return { isExpired: false, label: `距离开始还有 ${hours} 小时 ${minutes} 分钟` }
  }

  return { isExpired: false, label: `距离开始还有 ${Math.max(minutes, 1)} 分钟` }
}

interface SimilarPoolSummary {
  id: string
  title?: string
  eventType?: string
  city?: string
  district?: string | null
  dateTime?: string
  registrationCount?: number
}

// ─── Component ────────────────────────────────────────────────────

export default function MatchingStatusPage() {
  const router = useRouter()
  const registrationId = router.params.registrationId ?? ''
  const queryClient = useQueryClient()
  const { isLoading: authLoading } = useAuthGuard()

  const [isCancelling, setIsCancelling] = useState(false)

  // ── Fetch registration data ─────────────────────────────────────
  const {
    data: registration,
    isLoading,
    error: fetchError,
  } = useQuery<PoolRegistrationSummary | undefined>({
    queryKey: ['mini-program', 'pool-registration', registrationId],
    queryFn: async () => {
      const registrations = await getMyPoolRegistrations(apiRequest)
      return registrations.find((r) => r.id === registrationId)
    },
    enabled: !!registrationId && !authLoading,
    refetchInterval: 30_000, // Poll every 30 s as fallback
  })

  // ── WebSocket live updates ──────────────────────────────────────
  useWebSocket({
    eventTypes: ['POOL_MATCHED', 'EVENT_THEME_TITLE_REVEALED', 'MATCH_PROGRESS_UPDATE'],
    onMessage: (msg) => {
      logInfo('[MatchingStatus] WS message received', { type: msg.type })
      // Invalidate query to refetch fresh data on any relevant WS event
      queryClient.invalidateQueries({
        queryKey: ['mini-program', 'pool-registration', registrationId],
      })
    },
  })

  // ── Cancel registration ─────────────────────────────────────────
  const handleCancel = useCallback(async () => {
    if (!registrationId || isCancelling) return

    try {
      const { confirm } = await Taro.showModal({
        title: '取消报名',
        content: '确定要取消报名吗？取消后可以重新报名。',
        confirmText: '确定取消',
        cancelText: '再想想',
        confirmColor: '#EF4444',
      })
      if (!confirm) return

      setIsCancelling(true)
      logInfo('[MatchingStatus] Cancelling registration', { registrationId })
      await cancelPoolRegistration(apiRequest, registrationId)

      Taro.showToast({ title: '已取消报名', icon: 'success', duration: 2000 })

      // Navigate back after a short delay
      setTimeout(() => {
        Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/events/index' }) })
      }, 1500)
    } catch (err) {
      const message = err instanceof Error ? err.message : '取消失败，请重试'
      logError('[MatchingStatus] Cancel failed', { message })
      Taro.showToast({ title: message, icon: 'none', duration: 3000 })
    } finally {
      setIsCancelling(false)
    }
  }, [registrationId, isCancelling])

  // ── Navigate to squad reveal ────────────────────────────────────
  const handleViewSquad = useCallback(() => {
    if (!registration?.assignedGroupId) return
    Taro.navigateTo({
      url: `/pages/squad-unboxing/index?groupId=${registration.assignedGroupId}`,
    })
  }, [registration?.assignedGroupId])

  // ── Loading state ───────────────────────────────────────────────
  if (authLoading || isLoading) {
    return <LoadingScreen message='加载匹配状态…' />
  }

  // ── Error / not found ───────────────────────────────────────────
  if (fetchError || !registration) {
    return (
      <View className='matching-status'>
        <View className='matching-status__error'>
          <Text className='matching-status__error-icon'>😕</Text>
          <Text className='matching-status__error-text'>
            {fetchError ? '加载匹配信息失败' : '未找到报名记录'}
          </Text>
          <Button
            variant='secondary'
            className='matching-status__error-btn'
            onClick={() => Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/events/index' }) })}
          >
            返回
          </Button>
        </View>
      </View>
    )
  }

  const matchStatus = registration.matchStatus ?? 'pending'
  const countdown = getCountdownState(registration.poolDateTime)
  const isCancelled = registration.poolStatus === 'cancelled'
  const isNoMatchState = matchStatus === 'pending' && countdown.isExpired

  const { data: similarPools = [] } = useQuery<SimilarPoolSummary[]>({
    queryKey: ['mini-program', 'similar-pools', registration.poolCity, registration.poolEventType],
    queryFn: () =>
      apiRequest<SimilarPoolSummary[]>({
        path: `/api/event-pools?city=${encodeURIComponent(registration.poolCity ?? '')}&eventType=${encodeURIComponent(registration.poolEventType ?? '')}`,
      }),
    enabled: isNoMatchState && Boolean(registration.poolCity) && Boolean(registration.poolEventType),
    select: (pools) => pools.filter((pool) => pool.id !== registration.poolId).slice(0, 3),
  })

  const handleBrowsePools = useCallback(() => {
    Taro.switchTab({ url: '/pages/discover/index' })
  }, [])

  const handleRejoinPool = useCallback((poolId: string) => {
    Taro.navigateTo({ url: `/pages/pool-registration/index?id=${poolId}` })
  }, [])

  if (isCancelled) {
    return (
      <View className='matching-status'>
        <Card className='matching-status__special-card'>
          <Text className='matching-status__special-icon'>😔</Text>
          <Text className='matching-status__special-title'>这场活动已取消</Text>
          <Text className='matching-status__special-text'>
            很抱歉，这场活动未能按计划进行。你可以回到发现页，重新挑一场更适合你的局。
          </Text>
          <View className='matching-status__actions'>
            <Button className='matching-status__cta-btn' onClick={handleBrowsePools}>
              去看看别的活动
            </Button>
            <Button
              variant='secondary'
              className='matching-status__secondary-btn'
              onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
            >
              返回我的活动
            </Button>
          </View>
        </Card>
      </View>
    )
  }

  if (isNoMatchState) {
    return (
      <ScrollView className='matching-status' scrollY enhanced showScrollbar={false}>
        <Card className='matching-status__special-card'>
          <Text className='matching-status__special-icon'>🫶</Text>
          <Text className='matching-status__special-title'>这次还没等到合适的一桌</Text>
          <Text className='matching-status__special-text'>
            {countdown.label}。与其勉强凑桌，我们更想把你留给更对味的人。
          </Text>
          <View className='matching-status__actions'>
            <Button className='matching-status__cta-btn' onClick={handleBrowsePools}>
              看看别的活动
            </Button>
            <Button
              variant='secondary'
              className='matching-status__secondary-btn'
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-registration', registrationId] })}
            >
              刷新状态
            </Button>
          </View>
        </Card>

        {similarPools.length > 0 ? (
          <View className='matching-status__similar-section'>
            <Text className='matching-status__similar-title'>附近还有这些局</Text>
            {similarPools.map((pool) => (
              <Card key={pool.id} className='matching-status__similar-card'>
                <Text className='matching-status__similar-name'>{pool.title ?? '推荐活动'}</Text>
                <Text className='matching-status__similar-meta'>
                  {pool.eventType ?? registration.poolEventType}
                  {pool.city ? ` · ${pool.city}` : ''}
                  {pool.district ? ` ${pool.district}` : ''}
                </Text>
                <Text className='matching-status__similar-meta'>
                  {formatDateTime(pool.dateTime)}
                  {typeof pool.registrationCount === 'number' ? ` · 已有 ${pool.registrationCount} 人入座` : ''}
                </Text>
                <Button
                  variant='secondary'
                  className='matching-status__similar-btn'
                  onClick={() => handleRejoinPool(pool.id)}
                >
                  重新报名这场
                </Button>
              </Card>
            ))}
          </View>
        ) : null}

        <View className='matching-status__spacer' />
      </ScrollView>
    )
  }

  return (
    <ScrollView className='matching-status' scrollY enhanced showScrollbar={false}>
      {/* ── Status Header ──────────────────────────────────────── */}
      <View className='matching-status__header'>
        <Text className='matching-status__status-emoji'>
          {matchStatus === 'matched' ? '🎉' : matchStatus === 'completed' ? '✅' : '⏳'}
        </Text>
        <Text className='matching-status__status-title'>
          {getStatusLabel(matchStatus)}
        </Text>
        {matchStatus === 'pending' ? (
          <View className='matching-status__dots'>
            <View className='matching-status__dot matching-status__dot--1' />
            <View className='matching-status__dot matching-status__dot--2' />
            <View className='matching-status__dot matching-status__dot--3' />
          </View>
        ) : null}
        {matchStatus === 'pending' ? (
          <Text className='matching-status__status-hint'>{countdown.label}，等待更多人加入…</Text>
        ) : null}
      </View>

      {/* ── Pool Info Card ─────────────────────────────────────── */}
      <Card className='matching-status__card'>
        <Text className='matching-status__card-title'>
          {registration.poolTitle ?? '活动信息'}
        </Text>

        {registration.poolEventType ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>🎯 类型</Text>
            <Text className='matching-status__info-value'>{registration.poolEventType}</Text>
          </View>
        ) : null}

        {registration.poolDateTime ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>📅 时间</Text>
            <Text className='matching-status__info-value'>
              {formatDateTime(registration.poolDateTime)}
            </Text>
          </View>
        ) : null}

        {registration.poolCity ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>📍 地区</Text>
            <Text className='matching-status__info-value'>
              {registration.poolCity}
              {registration.poolDistrict ? ` · ${registration.poolDistrict}` : ''}
            </Text>
          </View>
        ) : null}

        {registration.matchScore != null ? (
          <View className='matching-status__info-row'>
            <Text className='matching-status__info-label'>💯 匹配分</Text>
            <Text className='matching-status__info-value matching-status__info-value--score'>
              {registration.matchScore}
            </Text>
          </View>
        ) : null}
      </Card>

      {/* ── Theme Reveal Section ───────────────────────────────── */}
      {registration.theme || registration.themeEmoji ? (
        <Card className='matching-status__theme-card'>
          <View className='matching-status__theme-header'>
            {registration.themeEmoji ? (
              <Text className='matching-status__theme-emoji'>{registration.themeEmoji}</Text>
            ) : null}
            <Text className='matching-status__theme-title'>
              {registration.theme ?? '活动主题'}
            </Text>
          </View>

          {registration.subtitle ? (
            <Text className='matching-status__theme-tagline'>{registration.subtitle}</Text>
          ) : null}

          {registration.vibe ? (
            <View className='matching-status__theme-vibe'>
              <Text className='matching-status__theme-vibe-label'>氛围：</Text>
              <Text className='matching-status__theme-vibe-value'>
                {getVibeLabel(registration.vibe)}
              </Text>
            </View>
          ) : null}

          {registration.highlights && registration.highlights.length > 0 ? (
            <View className='matching-status__theme-highlights'>
              {registration.highlights.map((h, i) => (
                <View key={i} className='matching-status__theme-highlight'>
                  <Text className='matching-status__theme-highlight-dot'>•</Text>
                  <Text className='matching-status__theme-highlight-text'>{h}</Text>
                </View>
              ))}
            </View>
          ) : null}
        </Card>
      ) : null}

      {/* ── Actions ────────────────────────────────────────────── */}
      <View className='matching-status__actions'>
        {matchStatus === 'matched' && registration.assignedGroupId ? (
          <Button
            variant='primary'
            className='matching-status__cta-btn'
            onClick={handleViewSquad}
          >
            查看小队
          </Button>
        ) : null}

        {matchStatus === 'matched' && !registration.assignedGroupId ? (
          <Card className='matching-status__loading-card'>
            <Text className='matching-status__loading-title'>正在整理你的小队信息</Text>
            <Text className='matching-status__loading-text'>匹配已经完成，成员卡片和后续破冰入口很快就会出现。</Text>
            <Button
              variant='secondary'
              className='matching-status__secondary-btn'
              onClick={() => void queryClient.invalidateQueries({ queryKey: ['mini-program', 'pool-registration', registrationId] })}
            >
              立即刷新
            </Button>
          </Card>
        ) : null}

        {matchStatus === 'pending' ? (
          <Button
            variant='secondary'
            className='matching-status__cancel-btn'
            onClick={handleCancel}
            disabled={isCancelling}
            loading={isCancelling}
          >
            {isCancelling ? '取消中…' : '取消报名'}
          </Button>
        ) : null}

        {matchStatus === 'completed' ? (
          <Button
            variant='primary'
            className='matching-status__back-btn'
            onClick={() => Taro.switchTab({ url: '/pages/events/index' })}
          >
            查看更多活动
          </Button>
        ) : null}
      </View>

      <View className='matching-status__spacer' />
    </ScrollView>
  )
}
