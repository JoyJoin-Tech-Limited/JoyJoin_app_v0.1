import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents, type JoinedEventSummary } from '@shared/api'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import './index.scss'

export default function JourneyPage() {
  const { isLoading: authLoading } = useAuthGuard()

  const { data: events = [], isLoading } = useQuery({
    queryKey: ['mini-program', 'journey-events'],
    queryFn: () => getJoinedEvents(apiRequest),
    enabled: !authLoading,
  })

  if (authLoading) {
    return (
      <View className='journey-page'>
        <View className='journey-page__loading'>
          <Text className='journey-page__loading-text'>加载中…</Text>
        </View>
      </View>
    )
  }

  return (
    <View className='journey-page'>
      <View className='journey-page__header'>
        <Text className='journey-page__title'>我的足迹</Text>
        <Text className='journey-page__subtitle'>记录你的每一次悦聚</Text>
      </View>

      <ScrollView className='journey-page__timeline' scrollY enhanced showScrollbar={false}>
        {isLoading ? (
          <View className='journey-page__loading'>
            <Text className='journey-page__loading-text'>正在加载…</Text>
          </View>
        ) : events.length > 0 ? (
          events.map((event, idx) => (
            <View key={String(event.id)} className='journey-page__node'>
              <View className='journey-page__node-line'>
                <View className='journey-page__node-dot' />
                {idx < events.length - 1 ? <View className='journey-page__node-connector' /> : null}
              </View>
              <View
                className='journey-page__node-card'
                onClick={() => Taro.navigateTo({ url: `/pages/event-detail/index?id=${event.id}` })}
              >
                <Text className='journey-page__node-title'>{event.title ?? '悦聚活动'}</Text>
                <Text className='journey-page__node-date'>{event.dateTime ?? ''}</Text>
              </View>
            </View>
          ))
        ) : (
          <View className='journey-page__empty-state'>
            <Text className='journey-page__empty-emoji'>✨</Text>
            <Text className='journey-page__empty-text'>你的足迹从这里开始</Text>
            <Text className='journey-page__empty-hint'>参加活动后，这里会记录你的旅程</Text>
          </View>
        )}
        <View className='journey-page__spacer' />
      </ScrollView>
    </View>
  )
}
