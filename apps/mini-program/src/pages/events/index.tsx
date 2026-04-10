import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import './index.scss'

type TabKey = 'upcoming' | 'completed'

export default function EventsPage() {
  const { isLoading: authLoading } = useAuthGuard()
  const [activeTab, setActiveTab] = useState<TabKey>('upcoming')

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading,
  })

  if (authLoading) {
    return <LoadingScreen />
  }

  // Simple split: events with a completed/past status vs upcoming
  // (Server doesn't provide explicit status in the current contract, so we show all)
  const displayEvents = events

  const handleEventTap = (event: JoinedEventSummary) => {
    Taro.navigateTo({ url: `/pages/event-detail/index?id=${event.id}` })
  }

  return (
    <View className='events-page'>
      <View className='events-page__header'>
        <Text className='events-page__title'>我的活动</Text>
      </View>

      {/* Tabs */}
      <View className='events-page__tabs'>
        <View
          className={`events-page__tab ${activeTab === 'upcoming' ? 'events-page__tab--active' : ''}`}
          onClick={() => setActiveTab('upcoming')}
        >
          <Text className='events-page__tab-text'>进行中</Text>
        </View>
        <View
          className={`events-page__tab ${activeTab === 'completed' ? 'events-page__tab--active' : ''}`}
          onClick={() => setActiveTab('completed')}
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
              {activeTab === 'upcoming' ? '暂无进行中的活动' : '暂无已完成的活动'}
            </Text>
            <Text className='events-page__empty-hint'>去「发现」页面看看有什么好玩的</Text>
          </Card>
        )}
        <View className='events-page__spacer' />
      </ScrollView>
    </View>
  )
}
