import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import type { MyConnection } from '@shared/api'
import { getArchetypeHSL, formatHSL } from '@shared/archetypeColors'
import { apiRequest } from '../../lib/api'
import { useMiniPageGate } from '../../hooks/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import { TOAST_SHORT_MS } from '../../lib/uiConstants'
import Card from '../../components/Card'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/tabBarConfig'
import './index.scss'

function getPeerInitial(name?: string | null) {
  return (name ?? '?')[0]
}

function getPeerDisplayName(conn: MyConnection) {
  return conn.peerDisplayName ?? '悦聚好友'
}

function getEventLabel(conn: MyConnection) {
  return conn.eventType ?? '某次活动'
}

export default function ConnectionsPage() {
  const { authLoading, renderGate } = useMiniPageGate()
  const markAsRead = useMarkNotificationsAsRead()

  useCustomTabBarSync({
    selectedIndex: MINI_PROGRAM_TAB_INDEX.connections,
    enabled: !authLoading,
  })

  useEffect(() => {
    markAsRead.mutate('chat')
  }, [markAsRead])

  const { data: connections = [], isLoading } = useQuery<MyConnection[]>({
    queryKey: ['mini-program', 'connections'],
    queryFn: () => apiRequest<MyConnection[]>({ path: '/api/my-connections' }),
    enabled: !authLoading,
  })

  const handleCopyWechatId = (wechatId?: string | null) => {
    if (!wechatId) return
    void Taro.setClipboardData({ data: wechatId }).then(() => {
      Taro.showToast({ title: '微信号已复制', icon: 'success', duration: TOAST_SHORT_MS })
    })
  }

  return renderGate(
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
              <View
                className='connections-page__card-avatar'
                style={conn.peerArchetype ? { background: formatHSL(getArchetypeHSL(conn.peerArchetype)) } : {}}
              >
                <Text className='connections-page__card-avatar-text'>
                  {getPeerInitial(conn.peerDisplayName)}
                </Text>
              </View>
              <View className='connections-page__card-info'>
                <Text className='connections-page__card-name'>{getPeerDisplayName(conn)}</Text>
                {conn.peerArchetype ? (
                  <Text className='connections-page__card-archetype'>{conn.peerArchetype}</Text>
                ) : null}
                <Text className='connections-page__card-event'>
                  来自：{getEventLabel(conn)}
                </Text>
                {conn.peerWechatId ? (
                  <View
                    className='connections-page__card-wechat'
                    onClick={() => handleCopyWechatId(conn.peerWechatId)}
                  >
                    <Text className='connections-page__card-wechat-label'>微信号</Text>
                    <Text className='connections-page__card-wechat-id'>{conn.peerWechatId}</Text>
                    <Text className='connections-page__card-wechat-action'>复制</Text>
                  </View>
                ) : null}
              </View>
            </Card>
          ))
        ) : (
          <Card className='connections-page__empty-state'>
            <Image
              className='connections-page__empty-hero'
              src='/assets/lovart/lovart-generic-empty.webp'
              mode='aspectFit'
              lazyLoad
            />
            <Text className='connections-page__empty-text'>还没有建立连接</Text>
            <Text className='connections-page__empty-hint'>参加活动后即可与活动伙伴建立连接</Text>
          </Card>
        )}
        <View className='connections-page__spacer' />
      </ScrollView>
    </View>,
  )
}
