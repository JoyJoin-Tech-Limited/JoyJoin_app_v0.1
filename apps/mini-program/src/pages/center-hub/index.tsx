import { CustomWrapper, View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { haptics } from '../../lib/utils/haptics'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getJoinedEvents,
  getMyPoolRegistrations,
  type JoinedEventSummary,
  type PoolRegistrationSummary,
} from '@shared/api'
import {
  resolveCenterTabDestination,
  type CenterTabDestination,
} from '@joyjoin/shared/centerTabRouting'
import { apiRequest } from '../../lib/api/api'
import { JOINED_EVENTS_QUERY_KEY, REGISTRATIONS_QUERY_KEY } from '../../lib/prefetchEngine'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { buildPoolGroupDetailUrl } from '../../lib/navigation/matchingNavigation'
import Button from '../../components/ui/Button'
import LoadingScreen from '../../components/loading/LoadingScreen'
import PageMorphWrapper from '../../components/ui/PageMorphWrapper'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import RichListCard from '../../components/RichListCard'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { logWarn } from '../../lib/utils/logger'
import { getJoinedEventStatusLabel } from '../../lib/utils/eventDisplay'
import './index.scss'

const EVENTS_LOAD_TIMEOUT_MS = 6_000

/**
 * Map a center-tab destination to the correct navigation action.
 * Hub page CTAs push detail pages via navigateTo; empty states switchTab to discover.
 */
function buildHubNavigationAction(
  destination: CenterTabDestination
): { url: string; method: 'navigateTo' | 'switchTab' } {
  switch (destination.kind) {
    case 'matched-event':
      return {
        url: `/pages/event-detail/index?id=${encodeURIComponent(destination.eventId)}`,
        method: 'navigateTo',
      }
    case 'matched-pool-unlocked':
    case 'matched-pool-future':
      return {
        url: buildPoolGroupDetailUrl(destination.groupId),
        method: 'navigateTo',
      }
    case 'pending-registration':
      return {
        url: `/pages/matching-status/index?registrationId=${encodeURIComponent(destination.registrationId)}`,
        method: 'navigateTo',
      }
    case 'discover':
    case 'empty':
    default:
      return { url: '/pages/discover/index', method: 'switchTab' }
  }
}

function formatEventDate(dateTime?: string | null): string {
  if (!dateTime) return '时间待定'
  const d = new Date(dateTime)
  if (isNaN(d.getTime())) return '时间待定'
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function getCountdownText(dateTime: string): string {
  const now = new Date()
  const start = new Date(dateTime)
  const diff = start.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 0) return '进行中'
  if (hours < 24) return `还有${hours}小时开始`
  const days = Math.floor(hours / 24)
  return `还有${days}天开始`
}

function useOnlineState() {
  const [isOnline, setIsOnline] = useState(true)

  useEffect(() => {
    let cancelled = false
    Taro.getNetworkType({
      success: (res) => {
        if (cancelled) return
        setIsOnline(res.networkType !== 'none')
      },
      fail: () => {
        if (cancelled) return
        setIsOnline(true)
      },
    })

    const handler = (res: Taro.onNetworkStatusChange.CallbackResult) => {
      setIsOnline(res.isConnected && res.networkType !== 'none')
    }
    Taro.onNetworkStatusChange(handler)
    return () => {
      cancelled = true
      Taro.offNetworkStatusChange(handler)
    }
  }, [])

  return isOnline
}

function CenterHubContent({
  registrations,
  events,
  isLoading,
  isError,
  onRetry,
  isOnline,
}: {
  registrations?: PoolRegistrationSummary[]
  events?: JoinedEventSummary[]
  isLoading: boolean
  isError: boolean
  onRetry: () => void
  isOnline: boolean
}) {
  const { isPrimary } = useDeviceTier()

  const destination = useMemo(
    () => resolveCenterTabDestination(registrations, events),
    [registrations, events]
  )

  const navAction = useMemo(
    () => buildHubNavigationAction(destination),
    [destination]
  )

  const handleNavigate = () => {
    haptics('light')
    if (navAction.method === 'switchTab') {
      Taro.switchTab({ url: navAction.url })
    } else {
      Taro.navigateTo({ url: navAction.url })
    }
  }

  if (isLoading) {
    return (
      <CustomWrapper>
        <View className='center-hub__loading' role='status' aria-live='polite' aria-busy='true'>
          <Image
            className={`center-hub__loading-mascot${isPrimary ? '' : ' center-hub__loading-mascot--no-animation'}`}
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('homeWelcome')}
            aria-hidden='true'
          />
          <Text className='center-hub__loading-text'>正在加载你的活动…</Text>
        </View>
      </CustomWrapper>
    )
  }

  if (isError) {
    return (
      <CustomWrapper>
        <View className='center-hub__state' role='alert' aria-live='polite'>
          <Image
            className={`center-hub__error-mascot${isPrimary ? '' : ' center-hub__error-mascot--no-animation'}`}
            mode='aspectFit'
            src={getXiaoyueExpressionAsset('actionFailure')}
            aria-hidden='true'
          />
          <Text className='center-hub__state-title'>
            {isOnline ? '加载没成功' : '网络好像断开了'}
          </Text>
          <Text className='center-hub__state-subtitle'>
            {isOnline ? '服务器开小差了，请稍后再试' : '检查网络连接后再刷新吧'}
          </Text>
          <Button
            className='center-hub__cta'
            onClick={() => {
              haptics('light')
              onRetry()
            }}
          >
            {isOnline ? '重新加载' : '刷新看看'}
          </Button>
        </View>
      </CustomWrapper>
    )
  }

  // State A: Active matched event
  if (destination.kind === 'matched-event' && events && events.length > 0) {
    const event = events[0]
    const eventDate = formatEventDate(event.dateTime)
    return (
      <CustomWrapper>
        <View className='center-hub__state'>
          <Text className='center-hub__state-title'>匹配成功</Text>
          <Text className='center-hub__state-subtitle'>你有一场即将开始的活动</Text>
          <View className='center-hub__event-card'>
            <RichListCard
              title={String(event.title ?? '')}
              subtitle={eventDate}
              meta={event.location || '地点待定'}
              gradient='premium'
              onClick={handleNavigate}
            >
              {typeof event.dateTime === 'string' && (
                <View className='center-hub__countdown-pill'>
                  <Text className='center-hub__countdown-text'>
                    {getCountdownText(event.dateTime)}
                  </Text>
                </View>
              )}
              <View className='center-hub__type-badge'>
                <Text className='center-hub__type-text'>
                  {getJoinedEventStatusLabel(event.status)}
                </Text>
              </View>
            </RichListCard>
          </View>
          <Button className='center-hub__cta' onClick={handleNavigate}>
            查看活动详情
          </Button>
        </View>
      </CustomWrapper>
    )
  }

  // State B: Pending registration
  if (destination.kind === 'pending-registration' && registrations && registrations.length > 0) {
    const reg = registrations[0]
    return (
      <CustomWrapper>
        <View className='center-hub__state'>
          <Text className='center-hub__state-title'>匹配中</Text>
          <Text className='center-hub__state-subtitle'>正在为你寻找最合适的玩伴</Text>
          <View className='center-hub__status-card'>
            <RichListCard
              title={reg.poolTitle || '活动报名'}
              subtitle='报名已提交，等待匹配结果'
              gradient='warm'
              onClick={handleNavigate}
            />
          </View>
          <Button className='center-hub__cta' onClick={handleNavigate}>
            查看匹配状态
          </Button>
        </View>
      </CustomWrapper>
    )
  }

  // State C: Matched pool (unlocked or future)
  if (
    (destination.kind === 'matched-pool-unlocked' ||
      destination.kind === 'matched-pool-future') &&
    registrations &&
    registrations.length > 0
  ) {
    const reg = registrations[0]
    const isUnlocked = destination.kind === 'matched-pool-unlocked'
    return (
      <CustomWrapper>
        <View className='center-hub__state'>
          <Text className='center-hub__state-title'>
            {isUnlocked ? '场地已解锁' : '匹配成功'}
          </Text>
          <Text className='center-hub__state-subtitle'>
            {isUnlocked ? '快来查看你的桌友和场地信息' : '活动详情即将揭晓'}
          </Text>
          <View className='center-hub__status-card'>
            <RichListCard
              title={reg.poolTitle || '活动报名'}
              subtitle={isUnlocked
                ? '场地信息已公布，记得准时赴约'
                : '匹配完成，场地信息将在活动前24小时公布'}
              meta={isUnlocked ? '场地已解锁' : '匹配成功'}
              gradient={isUnlocked ? 'fire' : 'cool'}
              onClick={handleNavigate}
            />
          </View>
          <Button className='center-hub__cta' onClick={handleNavigate}>
            {isUnlocked ? '查看这桌详情' : '查看匹配状态'}
          </Button>
        </View>
      </CustomWrapper>
    )
  }

  // State D: No context — empty
  return (
    <CustomWrapper>
      <View className='center-hub__state'>
        <XiaoyueEmptyState
          emotion='curious'
          title='去发现'
          subtitle='还没有进行中的活动，去探索感兴趣的活动吧～'
          actionLabel='去探索活动'
          onAction={() => Taro.switchTab({ url: '/pages/discover/index' })}
        />
      </View>
    </CustomWrapper>
  )
}

export default function CenterHubPage() {
  const { authLoading, renderGate } = useMiniPageGate()
  const isOnline = useOnlineState()
  const retryDebounceRef = useRef(false)
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))

  useCustomTabBarSync({
    enabled: !authLoading,
    tabKey: 'centerHub',
  })

  const {
    data: registrations = [],
    isLoading: regLoading,
    isError: regError,
    refetch: refetchRegistrations,
  } = useQuery<PoolRegistrationSummary[]>({
    queryKey: REGISTRATIONS_QUERY_KEY,
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: !authLoading,
  })

  const {
    data: events = [],
    isLoading: eventsLoading,
    isError: eventsError,
    refetch: refetchEvents,
  } = useQuery<JoinedEventSummary[]>({
    queryKey: JOINED_EVENTS_QUERY_KEY,
    queryFn: () =>
      Promise.race([
        getJoinedEvents(apiRequest),
        new Promise<never>((_, reject) => {
          timeoutRef.current = setTimeout(
            () => reject(new Error('events load timeout')),
            EVENTS_LOAD_TIMEOUT_MS,
          )
        }),
      ]),
    enabled: !authLoading,
  })

  const handleRetry = useCallback(() => {
    if (retryDebounceRef.current) return
    retryDebounceRef.current = true
    haptics('light')
    if (!isOnline) {
      Taro.getNetworkType({
        success: (res) => {
          if (res.networkType === 'none') {
            Taro.showToast({ title: '网络未连接', icon: 'none' })
            retryDebounceRef.current = false
            return
          }
          refetchRegistrations()
          refetchEvents()
          retryDebounceRef.current = false
        },
        fail: () => { retryDebounceRef.current = false },
      })
      return
    }
    refetchRegistrations()
    refetchEvents()
    retryDebounceRef.current = false
  }, [isOnline, refetchRegistrations, refetchEvents])

  useEffect(() => {
    if (eventsError) {
      logWarn('[CenterHub] events query error', {
        error: String(eventsError),
        online: isOnline,
      })
    }
  }, [eventsError, isOnline])

  useEffect(() => {
    return () => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current)
        timeoutRef.current = null
      }
    }
  }, [])

  return renderGate(
    <PageMorphWrapper
      isLoading={authLoading}
      loading={<LoadingScreen message='正在加载你的活动…' />}
      content={
        <View className={`center-hub ${tabEntranceClass}`}>
          <View className='center-hub__header'>
            <Image
              className='center-hub__header-mascot'
              src={getXiaoyueExpressionAsset('homeWelcome')}
              mode='aspectFit'
              lazyLoad
            />
            <Text className='center-hub__title'>进行中</Text>
          </View>
          <CenterHubContent
            registrations={registrations}
            events={events}
            isLoading={regLoading || eventsLoading}
            isError={regError || eventsError}
            onRetry={handleRetry}
            isOnline={isOnline}
          />
        </View>
      }
    />
  )
}
