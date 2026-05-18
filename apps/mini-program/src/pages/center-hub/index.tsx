import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getMyBlindBoxEvents,
  getMyPoolRegistrations,
  type BlindBoxEventSummary,
  type PoolRegistrationSummary,
} from '@shared/api'
import {
  resolveCenterTabDestination,
  type CenterTabDestination,
} from '@joyjoin/shared/centerTabRouting'
import { apiRequest } from '../../lib/api/api'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { buildPoolGroupDetailUrl } from '../../lib/navigation/matchingNavigation'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/navigation/tabBarConfig'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingScreen from '../../components/loading/LoadingScreen'
import PageMorphWrapper from '../../components/ui/PageMorphWrapper'
import './index.scss'

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
  return d.toLocaleString('zh-CN', {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function CenterHubContent({
  registrations,
  events,
  isLoading,
  isError,
}: {
  registrations?: PoolRegistrationSummary[]
  events?: BlindBoxEventSummary[]
  isLoading: boolean
  isError: boolean
}) {
  const destination = useMemo(
    () => resolveCenterTabDestination(registrations, events),
    [registrations, events]
  )

  const navAction = useMemo(
    () => buildHubNavigationAction(destination),
    [destination]
  )

  const handleNavigate = () => {
    if (navAction.method === 'switchTab') {
      Taro.switchTab({ url: navAction.url })
    } else {
      Taro.navigateTo({ url: navAction.url })
    }
  }

  if (isLoading) {
    return (
      <View className='center-hub__loading'>
        <Text className='center-hub__loading-text'>正在加载…</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <View className='center-hub__state'>
        <Text className='center-hub__state-title'>加载没成功</Text>
        <Text className='center-hub__state-subtitle'>网络不太稳定，下拉刷新试试</Text>
        <Button className='center-hub__cta' onClick={() => window.location.reload?.()}>
          重新加载
        </Button>
      </View>
    )
  }

  // State A: Active matched event
  if (destination.kind === 'matched-event' && events && events.length > 0) {
    const event = events[0]
    const eventDate = useMemo(() => formatEventDate(event.dateTime), [event.dateTime])
    return (
      <View className='center-hub__state'>
        <Text className='center-hub__state-title'>匹配成功</Text>
        <Text className='center-hub__state-subtitle'>你有一场即将开始的活动</Text>
        <Card className='center-hub__event-card' onClick={handleNavigate}>
          <Text className='center-hub__event-title'>{String(event.title ?? '')}</Text>
          <Text className='center-hub__event-meta'>{eventDate}</Text>
          <Text className='center-hub__event-location'>
            {String(event.city ?? '')} · {String(event.district ?? '')}
          </Text>
        </Card>
        <Button className='center-hub__cta' onClick={handleNavigate}>
          查看活动详情
        </Button>
      </View>
    )
  }

  // State B: Pending registration
  if (destination.kind === 'pending-registration' && registrations && registrations.length > 0) {
    const reg = registrations[0]
    return (
      <View className='center-hub__state'>
        <Text className='center-hub__state-title'>匹配中</Text>
        <Text className='center-hub__state-subtitle'>正在为你寻找最合适的玩伴</Text>
        <Card className='center-hub__status-card'>
          <Text className='center-hub__status-pool'>{reg.poolTitle || '活动报名'}</Text>
          <Text className='center-hub__status-text'>报名已提交，等待匹配结果</Text>
        </Card>
        <Button className='center-hub__cta' onClick={handleNavigate}>
          查看匹配状态
        </Button>
      </View>
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
      <View className='center-hub__state'>
        <Text className='center-hub__state-title'>
          {isUnlocked ? '场地已解锁' : '匹配成功'}
        </Text>
        <Text className='center-hub__state-subtitle'>
          {isUnlocked ? '快来查看你的桌友和场地信息' : '活动详情即将揭晓'}
        </Text>
        <Card className='center-hub__status-card'>
          <Text className='center-hub__status-pool'>{reg.poolTitle || '活动报名'}</Text>
          <Text className='center-hub__status-text'>
            {isUnlocked
              ? '场地信息已公布，记得准时赴约'
              : '匹配完成，场地信息将在活动前24小时公布'}
          </Text>
        </Card>
        <Button className='center-hub__cta' onClick={handleNavigate}>
          {isUnlocked ? '查看这桌详情' : '查看匹配状态'}
        </Button>
      </View>
    )
  }

  // State D: No context — empty
  return (
    <View className='center-hub__state'>
      <Text className='center-hub__state-title'>去发现</Text>
      <Text className='center-hub__state-subtitle'>还没有进行中的活动</Text>
      <View className='center-hub__empty-art' aria-label='空状态插画'>
        <Image
          className='center-hub__empty-img'
          src='/assets/empty-state/center-empty-illustration.webp'
          mode='aspectFit'
          lazyLoad
        />
      </View>
      <Button
        className='center-hub__cta'
        onClick={() => Taro.switchTab({ url: '/pages/discover/index' })}
      >
        去探索活动
      </Button>
    </View>
  )
}

export default function CenterHubPage() {
  const { authLoading, renderGate } = useMiniPageGate()

  useCustomTabBarSync({
    selectedIndex: MINI_PROGRAM_TAB_INDEX.centerHub,
    enabled: !authLoading,
  })

  const {
    data: registrations = [],
    isLoading: regLoading,
    isError: regError,
  } = useQuery({
    queryKey: ['mini-program', 'my-pool-registrations'],
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled: !authLoading,
  })

  const {
    data: events = [],
    isLoading: eventsLoading,
    isError: eventsError,
  } = useQuery({
    queryKey: ['mini-program', 'my-blind-box-events'],
    queryFn: () => getMyBlindBoxEvents(apiRequest),
    enabled: !authLoading,
  })

  return renderGate(
    <PageMorphWrapper
      isLoading={authLoading}
      loading={<LoadingScreen message='正在加载你的活动…' />}
      content={
        <View className='center-hub tab-page-enter'>
          <View className='center-hub__header'>
            <Text className='center-hub__title'>进行中</Text>
          </View>
          <CenterHubContent
            registrations={registrations}
            events={events}
            isLoading={regLoading || eventsLoading}
            isError={regError || eventsError}
          />
        </View>
      }
    />
  )
}
