import { CustomWrapper, View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { haptics } from '../../lib/utils/haptics'
import { useMemo } from 'react'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
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
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import LoadingScreen from '../../components/loading/LoadingScreen'
import PageMorphWrapper from '../../components/ui/PageMorphWrapper'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import RichListCard from '../../components/RichListCard'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { useDeviceTier } from '../../hooks/useDeviceTier'
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

function getCountdownText(startTime: string): string {
  const now = new Date()
  const start = new Date(startTime)
  const diff = start.getTime() - now.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 0) return '进行中'
  if (hours < 24) return `${hours}小时后开始`
  const days = Math.floor(hours / 24)
  return `${days}天后开始`
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
      <View className='center-hub__loading'>
        <Image
          className={`center-hub__loading-mascot${isPrimary ? '' : ' center-hub__loading-mascot--no-animation'}`}
          mode='aspectFit'
          src={getXiaoyueExpressionAsset('homeWelcome')}
        />
        <Text className='center-hub__loading-text'>正在加载你的活动…</Text>
      </View>
    )
  }

  if (isError) {
    return (
      <View className='center-hub__state'>
        <Image
          className={`center-hub__error-mascot${isPrimary ? '' : ' center-hub__error-mascot--no-animation'}`}
          mode='aspectFit'
          src={getXiaoyueExpressionAsset('actionFailure')}
        />
        <Text className='center-hub__state-title'>加载没成功</Text>
        <Text className='center-hub__state-subtitle'>网络不太稳定，下拉刷新试试</Text>
        <Button className='center-hub__cta' onClick={() => { haptics('light'); Taro.reLaunch({ url: '/pages/center-hub/index' }) }}>
          重新加载
        </Button>
      </View>
    )
  }

  // State A: Active matched event
  if (destination.kind === 'matched-event' && events && events.length > 0) {
    const event = events[0]
    const eventDate = formatEventDate(event.dateTime)
    return (
      <View className='center-hub__state'>
        <Text className='center-hub__state-title'>匹配成功</Text>
        <Text className='center-hub__state-subtitle'>你有一场即将开始的活动</Text>
        <View className='center-hub__event-card'>
          <RichListCard
            title={String(event.title ?? '')}
            subtitle={eventDate}
            meta={`${String(event.city ?? '')} · ${String(event.district ?? '')}`}
            gradient='premium'
            onClick={handleNavigate}
          >
            {typeof event.startTime === 'string' && (
              <View className='center-hub__countdown-pill'>
                <Text className='center-hub__countdown-text'>
                  ⏰ {getCountdownText(event.startTime)}
                </Text>
              </View>
            )}
            <View className='center-hub__type-badge'>
              <Text className='center-hub__type-text'>{typeof event.type === 'string' ? event.type : '活动'}</Text>
            </View>
          </RichListCard>
        </View>
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
    )
  }

  // State D: No context — empty
  return (
    <View className='center-hub__state'>
      <XiaoyueEmptyState
        emotion='curious'
        title='去发现'
        subtitle='还没有进行中的活动'
        actionLabel='去探索活动'
        onAction={() => Taro.switchTab({ url: '/pages/discover/index' })}
      />
    </View>
  )
}

export default function CenterHubPage() {
  const { authLoading, renderGate } = useMiniPageGate()

  useCustomTabBarSync({
    enabled: !authLoading,
    tabKey: 'centerHub',
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
            <Image
              className='center-hub__header-mascot'
              src={localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.png')}
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
          />
        </View>
      }
    />
  )
}
