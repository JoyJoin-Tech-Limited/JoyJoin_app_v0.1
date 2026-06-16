import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useEffect, useMemo, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, fetchConnectionsShell } from '../../lib/api/api'
import { injectConnectionsShellIntoCache } from '../../lib/prefetchEngine'
import { queryClient } from '../../lib/api/queryClient'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeFamily } from '@shared/archetypeColors'
import { getEmptyStateMessage } from '@shared/copy/emptyStates'
import { useAuth } from '../../hooks/useAuth'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import ProfileArchetypeHero from '../../components/profile/ProfileArchetypeHero'
import ArchetypeHead from '../../components/mascot/ArchetypeHead'
import Card from '../../components/ui/Card'
import { localAsset } from '../../lib/utils/cdnAssets'
import './index.scss'

// Motion: card press feedback is gated by @media (prefers-reduced-motion: reduce) in index.scss.

interface Connection {
  id: string
  peerName?: string
  peerArchetype?: string
  peerAgeRange?: string | null
  peerCity?: string | null
  peerBio?: string | null
  eventTitle?: string
  sharedEventTitle?: string
  chemistryScore?: number | string
  wechatId?: string
  [key: string]: unknown
}

function formatChemistryScore(score: number | string | undefined): string | null {
  if (score == null || score === '') return null
  const n = typeof score === 'string' ? Number(score) : score
  if (!Number.isFinite(n)) return null
  return `${Math.round(n)}`
}

function buildMutualContext(
  userCity: string | null | undefined,
  userArchetype: string | null | undefined,
  connection: Connection,
): string | null {
  const fragments: string[] = []
  const peerCity = connection.peerCity
  if (userCity && peerCity && userCity.trim() === peerCity.trim()) {
    fragments.push(`同在${peerCity}`)
  }

  const peerArchetype = connection.peerArchetype
  if (userArchetype && peerArchetype) {
    const same = userArchetype === peerArchetype
    if (same) {
      const name = ARCHETYPE_BY_ID[peerArchetype]?.nameCn || peerArchetype
      fragments.push(`同为${name}`)
    } else if (getArchetypeFamily(userArchetype) === getArchetypeFamily(peerArchetype)) {
      fragments.push('原型同频')
    } else {
      fragments.push('原型互补')
    }
  }

  const score = formatChemistryScore(connection.chemistryScore)
  if (score) {
    fragments.push(`默契值 ${score}`)
  }

  return fragments.length > 0 ? fragments.join(' · ') : null
}

export default function ConnectionsPage() {
  const { authLoading, renderGate } = useMiniPageGate()
  const { user } = useAuth()
  const redesignEnabled = user?.features?.profileRedesignEnabled ?? true
  const markAsRead = useMarkNotificationsAsRead()
  const viewTrackedRef = useRef(false)

  useCustomTabBarSync({
    enabled: !authLoading,
    tabKey: 'connections',
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
        return shell.connections as Connection[]
      } catch {
        // Composite unavailable — fall back to legacy endpoint.
      }
      return apiRequest<Connection[]>({ path: '/api/my-connections' })
    },
    enabled: !authLoading,
  })

  useEffect(() => {
    if (viewTrackedRef.current || isLoading || connections.length === 0) return
    viewTrackedRef.current = true
    profileAnalytics.track('connection_card_view', {
      hasBio: connections.some((c) => Boolean(c.peerBio && c.peerBio.trim().length > 0)),
    })
  }, [isLoading, connections])

  const userCity = user?.currentCity
  const userArchetype = user?.archetype

  const connectionItems = useMemo(
    () =>
      connections.map((conn) => ({
        ...conn,
        contextLine: buildMutualContext(userCity, userArchetype, conn),
      })),
    [connections, userCity, userArchetype],
  )

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
          connectionItems.map((conn) => (
            <Card
              key={String(conn.id)}
              className={`connections-page__card ${redesignEnabled ? '' : 'connections-page__card--legacy'}`}
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
              {redesignEnabled ? (
                <ProfileArchetypeHero
                  archetype={conn.peerArchetype}
                  displayName={conn.peerName ?? '悦聚好友'}
                  age={conn.peerAgeRange ?? null}
                  city={conn.peerCity ?? null}
                  bio={conn.peerBio ?? null}
                  contextLine={conn.contextLine}
                  size='sm'
                  showLabel
                />
              ) : (
                <>
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
                          <Image
                            className='connections-page__shared-event-icon'
                            src={localAsset('/assets/icons/ui/icon-calendar.webp')}
                            mode='aspectFit'
                            style={{ width: '20rpx', height: '20rpx' }}
                          />
                          <Text className='connections-page__shared-event-text'>{conn.sharedEventTitle}</Text>
                        </View>
                      </View>
                    ) : null}
                    {conn.eventTitle ? (
                      <Text className='connections-page__card-event'>来自：{conn.eventTitle}</Text>
                    ) : null}
                  </View>
                </>
              )}
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
    </View>,
  )
}
