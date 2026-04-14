import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useCustomTabBarSync } from '../../hooks/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/tabBarConfig'
import { partitionJoinedEventsByDateTime } from './eventPartition'
import './index.scss'

type TabKey = 'upcoming' | 'completed'

export default function EventsPage() {
  const { isLoading: authLoading } = useAuthGuard()
  const markAsRead = useMarkNotificationsAsRead()
  useCustomTabBarSync({
    selectedIndex: MINI_PROGRAM_TAB_INDEX.events,
    enabled: !authLoading,
  })

  useEffect(() => {
    const timer = setTimeout(() => {
      markAsRead.mutate('activities')
    }, 100)
    return () => clearTimeout(timer)
  }, [markAsRead])

  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')
  const [hasManualTabSelection, setHasManualTabSelection] = useState(false)

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading,
  })

  if (authLoading) {
    return <LoadingScreen />
  }

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

  return (
    <View className='events-page'>
      <View className='events-page__header'>
        <Text className='events-page__title'>我的足迹</Text>
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
          <View className='events-page__loading'>
            <Text className='events-page__loading-text'>正在加载活动…</Text>
          </View>
        ) : displayEvents.length > 0 ? (
          displayEvents.map((event) => (
            <Card
              key={String(event.id)}
              className='events-page__card'
              onClick={() => handleEventTap(event)}
            >
              <View className='events-page__card-header'>
                <Text className='events-page__card-title'>{event.title ?? '悦聚活动'}</Text>
              </View>
              <Text className='events-page__card-date'>{event.dateTime ?? '时间待定'}</Text>
            </Card>
          ))
        ) : (
          <Card className='events-page__empty-state'>
            <Text className='events-page__empty-emoji'>✨</Text>
            <Text className='events-page__empty-text'>
              {resolvedActiveTab === 'upcoming' ? '暂无待参加的活动' : '暂无已完成的活动'}
            </Text>
            <Text className='events-page__empty-hint'>去「发现」页面看看有什么好玩的</Text>
          </Card>
        )}
        <View className='events-page__spacer' />
      </ScrollView>
    </View>
  )
}
