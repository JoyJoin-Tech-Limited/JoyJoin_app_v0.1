import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { apiRequest, fetchEventsShell } from '../../lib/api/api'
import { injectEventsShellIntoCache } from '../../lib/prefetchEngine'
import { queryClient } from '../../lib/api/queryClient'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import Card from '../../components/ui/Card'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import RichListCard from '../../components/RichListCard'
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

  const { data: events = [], isLoading } = useQuery<JoinedEventSummary[]>({
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
          onClick={() => handleTabChange('upcoming')}
        >
          <Text className='events-page__tab-text'>待参加</Text>
        </View>
        <View
          className={`events-page__tab ${resolvedActiveTab === 'completed' ? 'events-page__tab--active' : ''}`}
          onClick={() => handleTabChange('completed')}
        >
          <Text className='events-page__tab-text'>已完成</Text>
        </View>
      </View>

      <ScrollView className='events-page__list' scrollY enhanced showScrollbar={false}>
        {isLoading ? (
          <>
            <EventCardSkeleton />
            <EventCardSkeleton />
            <EventCardSkeleton />
          </>
        ) : displayEvents.length > 0 ? (
          displayEvents.map((event, index) => (
            <View key={String(event.id)} className='events-page__card'>
              <RichListCard
                title={event.title ?? '悦聚活动'}
                subtitle={event.dateTime ?? '时间待定'}
                gradient='premium'
                onClick={() => handleEventTap(event)}
                index={index}
              >
                {event.startTime && resolvedActiveTab === 'upcoming' && (
                  <View className='events-page__countdown'>
                    <Text className='events-page__countdown-text'>
                      ⏰ {getCountdownText(event.startTime)}
                    </Text>
                  </View>
                )}
              </RichListCard>
            </View>
          ))
        ) : (
          <XiaoyueEmptyState
            emotion='events'
            title='还没有活动'
            subtitle='去发现感兴趣的活动吧'
            actionLabel='去发现'
            onAction={navigateToDiscover}
          />
        )}
        <View className='events-page__spacer' />
      </ScrollView>
    </View>
  )
}
