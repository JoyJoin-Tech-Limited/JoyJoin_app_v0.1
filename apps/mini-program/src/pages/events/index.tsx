import { View, Text, Button } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getJoinedEvents } from '@shared/api'
import { apiRequest } from '../../lib/api'
import './index.scss'

export default function EventsPage() {
  // TODO: Taro adaptation needed for the web page's live sockets, celebration overlays, and browser-only motion details.
  const { data: events = [], isLoading } = useQuery({
    queryKey: ['mini-program', 'joined-events'],
    queryFn: () => getJoinedEvents(apiRequest),
  })

  return (
    <View className='page'>
      <View className='page__placeholder'>
        <Text className='page__title'>活动</Text>
        <Text className='page__subtitle'>
          {isLoading ? '正在加载你的活动…' : `当前已同步 ${events.length} 条活动记录`}
        </Text>
        {events.length > 0 ? (
          <View>
            {events.slice(0, 3).map((event) => (
              <View key={String(event.id)} className='payment-page__summary-card'>
                <Text className='payment-page__summary-label'>{String(event.title ?? '悦聚活动')}</Text>
                <Text className='payment-page__summary-note'>
                  {String(event.dateTime ?? '时间待定')}
                </Text>
              </View>
            ))}
          </View>
        ) : (
          <Button className='profile-page__cta' onClick={() => Taro.redirectTo({ url: '/pages/discover/index' })}>
            去发现页看看
          </Button>
        )}
      </View>
    </View>
  )
}
