import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo } from 'react'
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
import { haptics } from '../../lib/utils/haptics'
import { localAsset } from '../../lib/utils/cdnAssets'
import { apiRequest } from '../../lib/api/api'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import {
  buildPoolGroupDetailUrl,
  buildSquadUnboxingUrl,
} from '../../lib/navigation/matchingNavigation'
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
    case 'matched-pool-future': {
      let hasRevealed = false
      try {
        hasRevealed = Boolean(Taro.getStorageSync<boolean>(`jj_revealed_${destination.groupId}`))
      } catch {
        hasRevealed = false
      }
      return {
        url: hasRevealed
          ? buildPoolGroupDetailUrl(destination.groupId)
          : buildSquadUnboxingUrl(destination.groupId),
        method: 'navigateTo',
      }
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

function hasActionableRegistrations(registrations?: PoolRegistrationSummary[]): boolean {
  return (registrations ?? []).some(
    (registration) => registration.matchStatus === 'pending' || registration.matchStatus === 'matched'
  )
}

function CenterHubContent({
  registrations,
  events,
  isLoading,
  isError,
}: {
  registrations?: PoolRegistrationSummary[]
  events?: JoinedEventSummary[]
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
        <Text className='center-hub__state-title'>暂时没拿到活动状态</Text>
        <Text className='center-hub__state-subtitle'>可以重新加载，或先去发现页看看可报名的活动</Text>
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
    <View className='center-hub__state center-hub__state--empty'>
      <View className='center-hub__empty-mascot-wrap'>
        <View className='center-hub__empty-halo' />
        <Image
          className='center-hub__empty-mascot'
          src={localAsset('/assets/mascot/xiaoyue-waiting.webp')}
          mode='aspectFit'
        />
        <View className='center-hub__empty-sparkle center-hub__empty-sparkle--1' />
        <View className='center-hub__empty-sparkle center-hub__empty-sparkle--2' />
        <View className='center-hub__empty-sparkle center-hub__empty-sparkle--3' />
      </View>
      <Text className='center-hub__empty-title'>暂无进行中的活动</Text>
      <Text className='center-hub__empty-subtitle'>报名成功后，你的匹配进度和小队揭晓会出现在这里。</Text>
      <View
        className='center-hub__empty-cta'
        hoverClass='center-hub__empty-cta--pressed'
        onClick={() => { haptics('light'); Taro.switchTab({ url: '/pages/discover/index' }) }}
      >
        <Text className='center-hub__empty-cta-text'>去探索活动</Text>
      </View>
      <View className='center-hub__empty-steps'>
        <View className='center-hub__empty-step'>
          <View className='center-hub__empty-step-dot center-hub__empty-step-dot--active' />
          <Text className='center-hub__empty-step-label'>报名成功</Text>
        </View>
        <View className='center-hub__empty-step-arrow' />
        <View className='center-hub__empty-step'>
          <View className='center-hub__empty-step-dot' />
          <Text className='center-hub__empty-step-label'>等待匹配</Text>
        </View>
        <View className='center-hub__empty-step-arrow' />
        <View className='center-hub__empty-step'>
          <View className='center-hub__empty-step-dot' />
          <Text className='center-hub__empty-step-label'>小队揭晓</Text>
        </View>
        <View className='center-hub__empty-step-arrow' />
        <View className='center-hub__empty-step'>
          <View className='center-hub__empty-step-dot center-hub__empty-step-dot--active' />
          <Text className='center-hub__empty-step-label'>确认出席</Text>
        </View>
      </View>
    </View>
  )
}

export default function CenterHubPage() {
  const { authLoading, renderGate } = useMiniPageGate()

  useCustomTabBarSync({
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
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading,
  })

  const canRenderFromRegistrations = hasActionableRegistrations(registrations)
  const isHubLoading = regLoading || (eventsLoading && !canRenderFromRegistrations)
  const isHubError = regError || (eventsError && !canRenderFromRegistrations)

  return renderGate(
    <PageMorphWrapper
      isLoading={authLoading}
      loading={<LoadingScreen message='正在加载你的活动…' />}
      content={
        <View className='center-hub tab-page-enter'>
          <View className='center-hub__header'>
            <Image
              className='center-hub__header-mascot'
              /* change the photo type from png to webp */
              src={localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp')}
              mode='aspectFit'
              lazyLoad
            />
            <Text className='center-hub__title'>进行中</Text>
          </View>
          <CenterHubContent
            registrations={registrations}
            events={events}
            isLoading={isHubLoading}
            isError={isHubError}
          />
        </View>
      }
    />
  )
}
