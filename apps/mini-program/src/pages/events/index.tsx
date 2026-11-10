import { CustomWrapper, View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { usePullDownRefresh, useDidShow } from '@tarojs/taro'
import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { haptics } from '../../lib/utils/haptics'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { apiRequest, fetchEventsShell } from '../../lib/api/api'
import { injectEventsShellIntoCache, JOINED_EVENTS_QUERY_KEY } from '../../lib/prefetchEngine'
import { evictPersistedQuery } from '../../lib/api/persistentCache'
import { queryClient } from '../../lib/api/queryClient'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { shouldRefreshOnShow } from '../../lib/utils/showRefreshGate'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import { CountdownTickProvider } from '../../hooks/useCountdownTick'
import Card from '../../components/ui/Card'
import StatusCard from '../../components/ui/StatusCard'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import FootprintOracleCard from '../../components/events/FootprintOracleCard'
import EventStatusTabs, { type EventStatusTabKey } from '../../components/events/EventStatusTabs'
import { MILESTONE_BADGES } from '../../lib/milestoneBadges'
import { isLongListRowCount, MINI_PROGRAM_LONG_LIST_ROW_THRESHOLD } from '../../lib/utils/longListThreshold'
import { logWarn } from '../../lib/utils/logger'
import { eventsAnalytics } from '../../lib/analytics/eventsAnalytics'
import { partitionJoinedEventsByDateTime } from './eventPartition'
import { navigateToEventCard } from '../../lib/utils/eventCardNavigation'
import { isJoinedEventTerminal } from '../../lib/utils/eventDisplay'
import './index.scss'

const FIRST_EVENT_HERO_STATUSES = new Set(['upcoming', 'pending', 'registered', 'matched', 'confirmed', 'venue_unlocked'])

type TabKey = EventStatusTabKey

const EMPTY_STATE_COPY: Record<TabKey, { title: string; description: string }> = {
  ongoing: {
    title: '此刻，还没有进行中的活动',
    description: '活动有进展时，会在这里告诉你。',
  },
  upcoming: {
    title: '还没有待开始的活动',
    description: '有新的安排时，会在这里告诉你。',
  },
  completed: {
    title: '第一段回忆，等你写下',
    description: '活动结束后，可以在这里回看足迹。',
  },
}

function EventCardSkeleton() {
  return (
    <Card className='events-page__card events-page__card--skeleton'>
      <View className='events-page__skeleton-pill' />
      <View className='events-page__skeleton-line events-page__skeleton-line--title' />
      <View className='events-page__skeleton-line events-page__skeleton-line--date' />
      <View className='events-page__skeleton-line events-page__skeleton-line--location' />
      <View className='events-page__skeleton-footer' />
    </Card>
  )
}

export default function EventsPage() {
  const { isDegradation } = useDeviceTier()
  const { authLoading, renderGate } = useMiniPageGate()
  useCustomTabBarSync({
    enabled: !authLoading,
  })

  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))

  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [hasManualTabSelection, setHasManualTabSelection] = useState(false)

  useEffect(() => {
    eventsAnalytics.track('events_view')
  }, [])

  // Warm own first-viewport assets + adjacent tabs' assets during idle so
  // the next tab switch paints instantly.
  useEffect(() => {
    preloadRouteAssets('pages/events/index')
    preloadPredictiveAssets('pages/events/index')
  }, [])

  const hasDidShowRef = useRef(false)
  useDidShow(() => {
    if (!hasDidShowRef.current) {
      hasDidShowRef.current = true
      return
    }
    if (authLoading) return
    // Silent, staleness-gated refresh on re-show — no haptics/analytics,
    // and skip entirely when the last refresh is still fresh (tab switches
    // must feel instant and must not hammer the network).
    if (!shouldRefreshOnShow('events')) return
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'joined-events'] })
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'shell/events'] })
  })

  const { data: events = [], isLoading, isFetching, isError, refetch } = useQuery<JoinedEventSummary[]>({
    queryKey: ['mini-program', 'joined-events'],
    staleTime: 30_000,
    queryFn: async (): Promise<JoinedEventSummary[]> => {
      // Primary: composite endpoint — 1 request for all Events data.
      try {
        const shell = await fetchEventsShell()
        injectEventsShellIntoCache(queryClient, shell)
        return shell.joinedEvents
      } catch (error) {
        // Composite unavailable — fall back to legacy endpoint.
        logWarn('[Events] Shell fetch failed, falling back to legacy endpoint', {
          error: error instanceof Error ? error.message : String(error),
        })
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

  const partitionedEvents = useMemo(() => partitionJoinedEventsByDateTime(events), [events])
  let resolvedActiveTab = activeTab

  if (!hasManualTabSelection) {
    if (partitionedEvents.upcoming.length > 0) {
      resolvedActiveTab = 'upcoming'
    } else if (partitionedEvents.ongoing.length > 0) {
      resolvedActiveTab = 'ongoing'
    } else if (partitionedEvents.completed.length > 0) {
      resolvedActiveTab = 'completed'
    } else {
      resolvedActiveTab = 'upcoming'
    }
  }

  const displayEvents = partitionedEvents[resolvedActiveTab]
  const emptyCopy = EMPTY_STATE_COPY[resolvedActiveTab]
  const firstEvent = events.length === 1 ? events[0] : undefined
  const firstEventStatus = firstEvent?.displayStatus ?? firstEvent?.status ?? ''
  const showFirstEventHero = resolvedActiveTab !== 'completed'
    && firstEvent !== undefined
    && displayEvents[0] === firstEvent
    && !isJoinedEventTerminal(firstEventStatus)
    && FIRST_EVENT_HERO_STATUSES.has(firstEventStatus)

  const handleTabChange = (tab: TabKey) => {
    if (tab === resolvedActiveTab) return
    haptics('light')
    setHasManualTabSelection(true)
    setActiveTab(tab)
    eventsAnalytics.track('events_tab_switch', { tab })
  }

  const handleEventTap = useCallback((event: JoinedEventSummary) => {
    eventsAnalytics.trackCardTap(event, resolvedActiveTab)
    navigateToEventCard(event, { isHistorical: resolvedActiveTab === 'completed' })
  }, [resolvedActiveTab])

  const navigateToDiscover = () => {
    eventsAnalytics.track('events_empty_state_cta_tap')
    Taro.switchTab({ url: '/pages/discover/index' })
  }

  return renderGate(
    <View className={`events-page ${tabEntranceClass}`}>
      <EventStatusTabs activeTab={resolvedActiveTab} onChange={handleTabChange} />

      {/* D1 — First event celebration hero (Batch D): only for an active first event. */}
      {showFirstEventHero && (
        <View className='events-page__first-event-hero'>
          <Image
            className='events-page__first-event-hero-img'
            mode='aspectFit'
            src={MILESTONE_BADGES.firstEvent}
            aria-label='第一次参加活动'
            lazyLoad
          />
          <Text className='events-page__first-event-hero-title'>第一次活动，期待与你相遇！</Text>
        </View>
      )}

      {/* ScrollView exception: this is the events feed list port (see viewport-zero-scroll skill). */}
      <ScrollView className='events-page__list' scrollY enhanced showScrollbar={false}>
        <View className='events-page__list-content'>
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
            <CountdownTickProvider>
              <CustomWrapper>
                {displayEvents.map((event, index) => (
                  <View key={String(event.id)} className='events-page__card'>
                    <FootprintOracleCard
                      event={event}
                      index={index}
                      onClick={handleEventTap}
                      isDegradation={isDegradation}
                      isHistorical={resolvedActiveTab === 'completed'}
                    />
                  </View>
                ))}
              </CustomWrapper>
            </CountdownTickProvider>
          ) : (
            <View className='events-page__empty-state'>
              <XiaoyueEmptyState
                variant='editorial'
                emotion='events'
                title={emptyCopy.title}
                subtitle={emptyCopy.description}
                actionLabel='去发现'
                onAction={navigateToDiscover}
                size='lg'
              />
            </View>
          )}
          <View className='events-page__spacer' />
        </View>
      </ScrollView>
    </View>
  )
}
