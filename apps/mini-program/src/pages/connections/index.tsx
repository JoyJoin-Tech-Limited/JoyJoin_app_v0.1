import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { apiRequest, fetchConnectionsShell } from '../../lib/api/api'
import { injectConnectionsShellIntoCache } from '../../lib/prefetchEngine'
import { queryClient } from '../../lib/api/queryClient'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import Card from '../../components/ui/Card'
import './index.scss'

interface Connection {
  id: string
  peerName?: string
  peerArchetype?: string
  eventTitle?: string
  sharedEventTitle?: string
  chemistryScore?: number | string
  wechatId?: string
  /** Top 1–2 positive preset tags the peer gave this user (印象标签回流). */
  peerImpressionTags?: string[] | null
  [key: string]: unknown
}

export default function ConnectionsPage() {
  const { authLoading, renderGate } = useMiniPageGate()

  useCustomTabBarSync({
    enabled: !authLoading,
  })

  // Warm own first-viewport assets + adjacent tabs' assets during idle so
  // the next tab switch paints instantly.
  useEffect(() => {
    preloadRouteAssets('pages/connections/index')
    preloadPredictiveAssets('pages/connections/index')
  }, [])

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
    staleTime: 30_000,
  })

  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))

  return renderGate(
    <View className={`connections-page ${tabEntranceClass}`}>

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
              emotion='reassure'
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
                  variant='head'
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
                {Array.isArray(conn.peerImpressionTags) && conn.peerImpressionTags.length > 0 ? (
                  <Text className='connections-page__card-impression'>
                    同桌觉得你：{conn.peerImpressionTags.join('·')}
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
              variant='editorial'
              emotion='curious'
              title='新的连接，从一场活动开始'
              subtitle={'参加活动并完成互动后，\n双向选择的连接会出现在这里。'}
              actionLabel='去探索活动'
              onAction={() => Taro.switchTab({ url: '/pages/discover/index' })}
              size='lg'
            />

            <View className='connections-page__flow-card'>
              <Text className='connections-page__flow-title'>连接建立流程</Text>
              <View className='connections-page__flow-steps'>
                <View className='connections-page__flow-step'>
                  <View className='connections-page__flow-step-icon connections-page__flow-step-icon--active'>
                    <Image className='connections-page__flow-step-img' src={cdnAsset('/assets/icons/flow-icons/flow-5.webp')} mode='aspectFit' />
                  </View>
                  <View className='connections-page__flow-step-content'>
                    <Text className='connections-page__flow-step-title'>参加活动</Text>
                    <Text className='connections-page__flow-step-desc'>参与感兴趣的活动</Text>
                  </View>
                </View>
                <View className='connections-page__flow-connector' aria-hidden='true' />
                <View className='connections-page__flow-step'>
                  <View className='connections-page__flow-step-icon'>
                    <Image className='connections-page__flow-step-img' src={cdnAsset('/assets/icons/flow-icons/flow-6.webp')} mode='aspectFit' />
                  </View>
                  <View className='connections-page__flow-step-content'>
                    <Text className='connections-page__flow-step-title'>完成互动</Text>
                    <Text className='connections-page__flow-step-desc'>扫码互动或交流</Text>
                  </View>
                </View>
                <View className='connections-page__flow-connector' aria-hidden='true' />
                <View className='connections-page__flow-step'>
                  <View className='connections-page__flow-step-icon'>
                    <Image className='connections-page__flow-step-img' src={cdnAsset('/assets/icons/flow-icons/flow-7.webp')} mode='aspectFit' />
                  </View>
                  <View className='connections-page__flow-step-content'>
                    <Text className='connections-page__flow-step-title'>建立连接</Text>
                    <Text className='connections-page__flow-step-desc'>成为活动伙伴</Text>
                  </View>
                </View>
              </View>
            </View>
          </View>
        )}
        <View className='connections-page__spacer' />
      </ScrollView>
    </View>
  )
}
