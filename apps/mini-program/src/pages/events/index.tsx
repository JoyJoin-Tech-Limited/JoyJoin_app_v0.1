import { CustomWrapper, View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh } from '@tarojs/taro'
import { haptics } from '../../lib/utils/haptics'
import { useState, useEffect, useCallback, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { apiRequest, fetchEventsShell } from '../../lib/api/api'
import { injectEventsShellIntoCache, JOINED_EVENTS_QUERY_KEY } from '../../lib/prefetchEngine'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { queryClient } from '../../lib/api/queryClient'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import Card from '../../components/ui/Card'
import StatusCard from '../../components/ui/StatusCard'
import RichListCard from '../../components/RichListCard'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'
import { isLongListRowCount } from '../../lib/utils/longListThreshold'
import { logWarn } from '../../lib/utils/logger'
import { formatEventDateTime, getCountdownText, getJoinedEventStatusLabel } from '../../lib/utils/eventDisplay'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { partitionJoinedEventsByDateTime } from './eventPartition'
import './index.scss'

type TabKey = 'upcoming' | 'completed'

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
    enabled: !authLoading,
    tabKey: 'events',
  })

  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))

  useEffect(() => {
    const timer = setTimeout(() => {
      markAsRead.mutate('activities')
    }, 100)
    return () => clearTimeout(timer)
  }, [markAsRead])

  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [hasManualTabSelection, setHasManualTabSelection] = useState(false)

  useEffect(() => {
    eventsAnalytics.track('events_view')
  }, [])

  const { data: events = [], isLoading, isFetching, isError, refetch } = useQuery<JoinedEventSummary[]>({
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
    eventsAnalytics.track('events_pull_refresh')
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'joined-events'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/events'] })
    evictPersistedQuery(JOINED_EVENTS_QUERY_KEY)
  }, [])

  const pullDownTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  usePullDownRefresh(() => {
    handleRefresh()
    pullDownTimerRef.current = setTimeout(() => {
      Taro.stopPullDownRefresh()
      pullDownTimerRef.current = null
    }, 800)
  })
  useEffect(() => {
    return () => {
      if (pullDownTimerRef.current) {
        clearTimeout(pullDownTimerRef.current)
        pullDownTimerRef.current = null
      }
    }
  }, [])

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
    eventsAnalytics.track('events_tab_switch', { tab })
  }

  const handleEventTap = (event: JoinedEventSummary) => {
    eventsAnalytics.track('events_card_tap', {
      eventId: event.id,
      tab: resolvedActiveTab,
      status: event.status,
    })
    Taro.navigateTo({ url: `/pages/event-detail/index?id=${event.id}` })
  }

  const navigateToDiscover = () => {
    eventsAnalytics.track('events_empty_state_cta_tap')
    Taro.switchTab({ url: '/pages/discover/index' })
  }

  return renderGate(
    <View className={`events-page ${tabEntranceClass}`}>
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
        ) : isError ? (
          <StatusCard
            className='events-page__empty-state'
            tone='error'
            title='加载失败'
            description='网络有点调皮，再试一次吧'
            action={{
              label: '重试',
              onClick: () => refetch(),
              variant: 'primary',
            }}
          />
        ) : displayEvents.length > 0 ? (
          <CustomWrapper>
            {displayEvents.map((event, index) => {
              const statusLabel = getJoinedEventStatusLabel(event.status)
              return (
                <View key={String(event.id)} className='events-page__card'>
                  <RichListCard
                    title={event.title ?? '悦聚活动'}
                    subtitle={formatEventDateTime(event.dateTime)}
                    meta={event.location}
                    ecosystem={statusLabel ? (
                      <View className='events-page__status-chip'>
                        <Text className='events-page__status-chip-text'>{statusLabel}</Text>
                      </View>
                    ) : undefined}
                    gradient={resolvedActiveTab === 'completed' ? 'surface' : 'premium'}
                    onClick={() => handleEventTap(event)}
                    index={index}
                  >
                    {typeof event.dateTime === 'string' && resolvedActiveTab === 'upcoming' && (
                      <View className='events-page__countdown'>
                        <Text className='events-page__countdown-text'>
                          {getCountdownText(event.dateTime)}
                        </Text>
                      </View>
                    )}
                  </RichListCard>
                </View>
              )
            })}
          </CustomWrapper>
        ) : (
          <StatusCard
            className='events-page__empty-state'
            tone='empty'
            heroSrc={cdnAsset('/assets/lovart/lovart-generic-empty.webp')}
            title='还没有活动'
            description='去发现感兴趣的活动吧'
            action={{
              label: '去发现',
              onClick: navigateToDiscover,
              variant: 'primary',
            }}
          />
        )}
        <View className='events-page__spacer' />
      </ScrollView>
    </View>
  )
}
