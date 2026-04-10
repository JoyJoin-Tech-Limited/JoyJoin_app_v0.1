import { View, Text, ScrollView } from '@tarojs/components'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import './index.scss'

interface Connection {
  id: string
  peerName?: string
  peerArchetype?: string
  eventTitle?: string
  wechatId?: string
  [key: string]: unknown
}

export default function ConnectionsPage() {
  const { isLoading: authLoading } = useAuthGuard()

  const { data: connections = [], isLoading } = useQuery<Connection[]>({
    queryKey: ['mini-program', 'connections'],
    queryFn: () => apiRequest<Connection[]>({ path: '/api/my-connections' }),
    enabled: !authLoading,
  })

  if (authLoading) {
    return <LoadingScreen />
  }

  return (
    <View className='connections-page'>
      <View className='connections-page__header'>
        <Text className='connections-page__title'>我的连接</Text>
        <Text className='connections-page__subtitle'>活动后建立的联系</Text>
      </View>

      <ScrollView className='connections-page__list' scrollY enhanced showScrollbar={false}>
        {isLoading ? (
          <View className='connections-page__loading'>
            <Text className='connections-page__loading-text'>正在加载…</Text>
          </View>
        ) : connections.length > 0 ? (
          connections.map((conn) => (
            <Card key={String(conn.id)} className='connections-page__card'>
              <View className='connections-page__card-avatar'>
                <Text className='connections-page__card-avatar-text'>
                  {(conn.peerName ?? '?')[0]}
                </Text>
              </View>
              <View className='connections-page__card-info'>
                <Text className='connections-page__card-name'>{conn.peerName ?? '悦聚好友'}</Text>
                {conn.peerArchetype ? (
                  <Text className='connections-page__card-archetype'>{conn.peerArchetype}</Text>
                ) : null}
                {conn.eventTitle ? (
                  <Text className='connections-page__card-event'>来自：{conn.eventTitle}</Text>
                ) : null}
              </View>
            </Card>
          ))
        ) : (
          <Card className='connections-page__empty-state'>
            <Text className='connections-page__empty-emoji'>✨</Text>
            <Text className='connections-page__empty-text'>还没有建立连接</Text>
            <Text className='connections-page__empty-hint'>参加活动后即可与活动伙伴建立连接</Text>
          </Card>
        )}
        <View className='connections-page__spacer' />
      </ScrollView>
    </View>
  )
}
