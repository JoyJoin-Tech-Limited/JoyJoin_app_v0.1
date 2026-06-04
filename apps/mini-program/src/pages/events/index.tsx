import { CustomWrapper, View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { haptics } from '../../lib/utils/haptics'
import { useState, useEffect, useCallback } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { apiRequest, fetchEventsShell } from '../../lib/api/api'
import { injectEventsShellIntoCache, JOINED_EVENTS_QUERY_KEY } from '../../lib/prefetchEngine'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { queryClient } from '../../lib/api/queryClient'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import Card from '../../components/ui/Card'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import RichListCard from '../../components/RichListCard'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/navigation/tabBarConfig'
import { isLongListRowCount } from '../../lib/utils/longListThreshold'
import { logWarn } from '../../lib/utils/logger'
import { partitionJoinedEventsByDateTime } from './eventPartition'
import './index.scss'

type TabKey = 'upcoming' | 'completed'

function getCountdownText(startTime: string): string {
  const now = new Date()
  const start = new Date(startTime)
  const diff = start.getTime() - now.getTime()
  if (diff < 0) return '进行中'
  const hours = Math.floor(diff / (1000 * 60 * 60))
  if (hours < 24) return `${hours}小时后开始`
  const days = Math.floor(hours / 24)
  return `${days}天后开始`
}

function EventCardSkeleton() {
  return (
    <Card className='events-page__card events-page__card--skeleton'>
      <View className='events-page__skeleton-line events-page__skeleton-line--title' />
      <View className='events-page__skeleton-line events-page__skeleton-line--meta' />
    </Card>
  )
}

export default function EventsPage() {
  const { authLoading, renderGate } = useMiniPageGate()
  const markAsRead = useMarkNotificationsAsRead()
  useCustomTabBarSync({
    selectedIndex: MINI_PROGRAM_TAB_INDEX.events,
    enabled: !authLoading,
  })

  const [canGoBack, setCanGoBack] = useState(false)

  useEffect(() => {
    const timer = setTimeout(() => {
      markAsRead.mutate('activities')
    }, 100)
    return () => clearTimeout(timer)
  }, [markAsRead])

  useEffect(() => {
    const pages = Taro.getCurrentPages()
    setCanGoBack(pages.length > 1)
  }, [])

  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [hasManualTabSelection, setHasManualTabSelection] = useState(false)

  const { data: events = [], isLoading, isFetching } = useQuery<JoinedEventSummary[]>({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: async (): Promise<JoinedEventSummary[]> => {
      // Primary: composite endpoint — 1 request for all Events data.
      try {
        const shell = await fetchEventsShell()
        injectEventsShellIntoCache(queryClient, shell)
        return shell.joinedEvents
      } catch {
        // Composite unavailable — fall back to legacy endpoint.
      }
      return getJoinedEvents(apiRequest)
    },
    enabled: !authLoading,
  })

  const handleRefresh = useCallback(() => {
    haptics('light')
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'joined-events'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/events'] })
    evictPersistedQuery(JOINED_EVENTS_QUERY_KEY)
  }, [])

  usePullDownRefresh(() => {
    handleRefresh()
    setTimeout(() => {
      Taro.stopPullDownRefresh()
    }, 800)
  })

  useEffect(() => {
    if (authLoading || isLoading) {
      return
    }

    if (isLongListRowCount(events.length)) {
      logWarn('[Events] Long joined-events list — see docs/LIST_VIRTUALIZATION.md', {
        count: events.length,
      })
    }
  }, [authLoading, isLoading, events.length])

  const partitionedEvents = partitionJoinedEventsByDateTime(events)
  let resolvedActiveTab = activeTab

  if (!hasManualTabSelection) {
    if (activeTab === 'upcoming' && partitionedEvents.upcoming.length === 0 && partitionedEvents.completed.length > 0) {
      resolvedActiveTab = 'completed'
    } else if (
      activeTab === 'completed'
      && partitionedEvents.completed.length === 0
      && partitionedEvents.upcoming.length > 0
    ) {
      resolvedActiveTab = 'upcoming'
    }
  }

  const displayEvents = resolvedActiveTab === 'upcoming'
    ? partitionedEvents.upcoming
    : partitionedEvents.completed

  const handleTabChange = (tab: TabKey) => {
    haptics('light')
    setHasManualTabSelection(true)
    setActiveTab(tab)
  }

  const handleEventTap = (event: JoinedEventSummary) => {
    Taro.navigateTo({ url: `/pages/event-detail/index?id=${event.id}` })
  }

  const navigateToDiscover = () => {
    Taro.switchTab({ url: '/pages/discover/index' })
  }

  const handleBack = () => {
    Taro.navigateBack({ fail: () => Taro.switchTab({ url: '/pages/profile/index' }) })
  }

  return renderGate(
    <View className='events-page tab-page-enter'>
      <View className='events-page__header'>
        {canGoBack && (
          <View className='events-page__back' onClick={handleBack}>
            <Text className='events-page__back-arrow'>‹</Text>
          </View>
        )}
        <Text className='events-page__title'>我的足迹</Text>
        {canGoBack && <View className='events-page__back-spacer' />}
      </View>

      {/* Tabs */}
      <View className='events-page__tabs'>
        <View
          className={`events-page__tab ${resolvedActiveTab === 'upcoming' ? 'events-page__tab--active' : ''}`}
          hoverClass='events-page__tab--pressed'
          onClick={() => handleTabChange('upcoming')}
        >
          <Text className='events-page__tab-text'>待参加</Text>
        </View>
        <View
          className={`events-page__tab ${resolvedActiveTab === 'completed' ? 'events-page__tab--active' : ''}`}
          hoverClass='events-page__tab--pressed'
          onClick={() => handleTabChange('completed')}
        >
          <Text className='events-page__tab-text'>已完成</Text>
        </View>
      </View>

      {/* D1 — First event celebration hero (Batch D) */}
      {events.length === 1 && resolvedActiveTab === 'upcoming' && (
        <View className='events-page__first-event-hero'>
          <Image
            className='events-page__first-event-hero-img'
            mode='aspectFit'
            src={MILESTONE_BADGES.firstEvent}
            ariaLabel="第一次参加活动"
            lazyLoad
          />
          <Text className='events-page__first-event-hero-title'>第一次活动，期待与你相遇！</Text>
        </View>
      )}

      <ScrollView className='events-page__list' scrollY enhanced showScrollbar={false}>
        {isFetching && !isLoading && (
          <View className='events-page__refresh-indicator' />
        )}
        {isLoading ? (
          <>
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </>
        ) : displayEvents.length > 0 ? (
          <CustomWrapper>
            {displayEvents.map((event, index) => (
              <View key={String(event.id)} className='events-page__card'>
                <RichListCard
                  title={event.title ?? '悦聚活动'}
                  subtitle={event.dateTime ?? '时间待定'}
                  gradient='premium'
                  onClick={() => handleEventTap(event)}
                  index={index}
                >
                  {typeof event.startTime === 'string' && resolvedActiveTab === 'upcoming' && (
                    <View className='events-page__countdown'>
                      <View className='jj-icon-text'>
                        <JoyJoinIcon emoji='⏰' size={20} />
                        <Text className='events-page__countdown-text'>
                          {getCountdownText(event.startTime)}
                        </Text>
                      </View>
                    </View>
                  )}
                </RichListCard>
              </View>
            ))}
          </CustomWrapper>
        ) : (
          <View className='events-page__empty-state'>
            <XiaoyueEmptyState
              emotion='events'
              title='还没有活动'
              subtitle='去发现感兴趣的活动吧'
              actionLabel='去发现'
              onAction={navigateToDiscover}
            />
          </View>
        )}
        <View className='events-page__spacer' />
      </ScrollView>
    </View>
  )
}
