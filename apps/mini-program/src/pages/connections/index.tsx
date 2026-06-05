import { View, Text, ScrollView } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, fetchConnectionsShell } from '../../lib/api/api'
import { injectConnectionsShellIntoCache } from '../../lib/prefetchEngine'
import { queryClient } from '../../lib/api/queryClient'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getEmptyStateMessage } from '@shared/copy/emptyStates'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import Card from '../../components/ui/Card'
import { MINI_PROGRAM_TAB_INDEX } from '../../lib/navigation/tabBarConfig'
import './index.scss'

interface Connection {
  id: string
  peerName?: string
  peerArchetype?: string
  eventTitle?: string
  sharedEventTitle?: string
  chemistryScore?: number | string
  wechatId?: string
  [key: string]: unknown
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

  const { data: connections = [], isLoading, isError, refetch } = useQuery<Connection[]>({
    queryKey: ['mini-program', 'connections'],
    queryFn: async (): Promise<Connection[]> => {
      // Primary: composite endpoint — 1 request for all Connections data.
      try {
        const shell = await fetchConnectionsShell()
        injectConnectionsShellIntoCache(queryClient, shell)
        return shell.connections
      } catch {
        // Composite unavailable — fall back to legacy endpoint.
      }
      return apiRequest<Connection[]>({ path: '/api/my-connections' })
    },
    enabled: !authLoading,
  })

  return renderGate(
    <View className='connections-page tab-page-enter'>
      <View className='connections-page__header'>
        <Text className='connections-page__title'>我的连接</Text>
        <Text className='connections-page__subtitle'>活动后建立的联系</Text>
      </View>

      <ScrollView className='connections-page__list' scrollY enhanced showScrollbar={false}>
        {isLoading ? (
          <View className='connections-page__loading'>
            <XiaoyueEmptyState
              emotion='waiting'
              title='正在加载…'
              subtitle='悦仔正在整理你的连接'
              size='md'
            />
          </View>
        ) : isError ? (
          <View className='connections-page__empty-state'>
            <XiaoyueEmptyState
              emotion='sad'
              title='加载失败'
              subtitle='网络有点调皮，再试一次吧'
              actionLabel='重试'
              onAction={() => refetch()}
              size='md'
            />
          </View>
        ) : connections.length > 0 ? (
          connections.map((conn) => (
            <Card
              key={String(conn.id)}
              className='connections-page__card'
              onClick={() => {
                const actions: string[] = []
                if (conn.wechatId) actions.push(`微信号：${conn.wechatId}`)
                if (conn.peerArchetype) {
                  const archetypeName = ARCHETYPE_BY_ID[conn.peerArchetype]?.nameCn
                  if (archetypeName) actions.push(`原型：${archetypeName}`)
                }
                if (conn.wechatId) actions.push('复制微信号')
                if (actions.length === 0) return
                Taro.showActionSheet({
                  itemList: actions,
                  success: (res) => {
                    if (actions[res.tapIndex] === '复制微信号' && conn.wechatId) {
                      Taro.setClipboardData({ data: conn.wechatId })
                    }
                  },
                })
              }}
            >
              <View className='connections-page__card-avatar'>
                <ArchetypeHead
                  archetype={conn.peerArchetype}
                  size={72}
                  fallbackText={conn.peerName ?? undefined}
                />
              </View>
              <View className='connections-page__card-info'>
                <Text className='connections-page__card-name'>{conn.peerName ?? '悦聚好友'}</Text>
                {conn.peerArchetype ? (
                  <Text className='connections-page__card-archetype'>
                    {ARCHETYPE_BY_ID[conn.peerArchetype]?.nameCn || conn.peerArchetype}
                  </Text>
                ) : null}
                {conn.chemistryScore ? (
                  <View className='connections-page__chemistry-badge'>
                    <Text className='connections-page__chemistry-text'>
                      默契值 {conn.chemistryScore}
                    </Text>
                  </View>
                ) : (
                  <View className='connections-page__chemistry-badge connections-page__chemistry-badge--new'>
                    <Text className='connections-page__chemistry-text'>新连接</Text>
                  </View>
                )}
                {conn.sharedEventTitle ? (
                  <View className='connections-page__shared-event'>
                    <View className='jj-icon-text'>
                      <JoyJoinIcon emoji='📅' size={20} />
                      <Text className='connections-page__shared-event-text'>{conn.sharedEventTitle}</Text>
                    </View>
                  </View>
                ) : null}
                {conn.eventTitle ? (
                  <Text className='connections-page__card-event'>来自：{conn.eventTitle}</Text>
                ) : null}
              </View>
            </Card>
          ))
        ) : (
          <View className='connections-page__empty-state'>
            <XiaoyueEmptyState
              emotion='sad'
              title={getEmptyStateMessage('connections', { includeAction: false })}
              subtitle='参加活动后即可与活动伙伴建立连接'
            />
          </View>
        )}
        <View className='connections-page__spacer' />
      </ScrollView>
    </View>
  )
}
