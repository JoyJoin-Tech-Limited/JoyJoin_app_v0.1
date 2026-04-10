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
  const { lastMessage } = useWebSocket({
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
          <Text className='matching-status__status-hint'>等待更多人加入…</Text>
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
