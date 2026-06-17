import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { apiRequest, fetchConnectionsShell } from '../../lib/api/api'
import { injectConnectionsShellIntoCache, CONNECTIONS_SHELL_QUERY_KEY } from '../../lib/prefetchEngine'
import { queryClient } from '../../lib/api/queryClient'
import { ARCHETYPE_BY_ID } from '@shared/personality/archetypeNames'
import { getArchetypeFamily } from '@shared/archetypeColors'
import { getEmptyStatePrompt, getEmptyStateAction } from '@shared/copy/emptyStates'
import type { ConnectionsShellResponse } from '@shared/api'
import { useAuth } from '../../hooks/useAuth'
import { useMiniPageGate } from '../../hooks/navigation/useMiniPageGate'
import { useCustomTabBarSync } from '../../hooks/navigation/useCustomTabBarSync'
import { consumeTabEntrance } from '../../lib/utils/tabEntranceState'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import { profileAnalytics } from '../../lib/analytics/profileAnalytics'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { haptics } from '../../lib/utils/haptics'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import XiaoyueEmptyState, { type XiaoyueEmptyStateProps } from '../../components/mascot/XiaoyueEmptyState'
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
  const [tabEntranceClass] = useState(() => (consumeTabEntrance() ? 'tab-page-enter' : ''))
  const [isRefresherActive, setIsRefresherActive] = useState(false)
  const [isNavigating, setIsNavigating] = useState(false)
  const actionTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const { isPrimary } = useDeviceTier()
  const markAsRead = useMarkNotificationsAsRead()
  const viewTrackedRef = useRef(false)
  const celebratedRef = useRef(false)

  // Empty-state wrapper should fill the visible page below the custom tab bar.
  // 182rpx matches SCSS `$tab-bar-root-height` (full footprint including center protrusion).
  const TAB_BAR_ROOT_HEIGHT_RPX = 182
  const emptyMinHeightRpx = useMemo(() => {
    try {
      const { windowHeight, screenWidth } = Taro.getSystemInfoSync()
      const rpx = (windowHeight ?? 0) * 750 / (screenWidth || 375)
      return Math.max(0, rpx - TAB_BAR_ROOT_HEIGHT_RPX)
    } catch {
      return undefined
    }
  }, [])

  useCustomTabBarSync({
    enabled: !authLoading,
    tabKey: 'connections',
  })

  useEffect(() => {
    markAsRead.mutate('chat')
  }, [markAsRead])

  const {
    data: shell,
    isLoading,
    isError,
    refetch,
  } = useQuery<ConnectionsShellResponse>({
    queryKey: CONNECTIONS_SHELL_QUERY_KEY,
    queryFn: async (): Promise<ConnectionsShellResponse> => {
      // Primary: composite endpoint — 1 request for all Connections data.
      try {
        const response = await fetchConnectionsShell()
        injectConnectionsShellIntoCache(queryClient, response)
        return response
      } catch {
        // Composite unavailable — fall back to legacy endpoint.
      }
      const connections = await apiRequest<Connection[]>({ path: '/api/my-connections' })
      return {
        user: { nextStep: user?.nextStep ?? 'discover', primaryArchetype: user?.primaryArchetype ?? null },
        connections,
        pendingRequests: [],
        connectionsContext: null,
        notifications: { discover: 0, activities: 0, chat: 0, total: 0 },
        meta: { cacheKey: 'legacy-connections', serverTime: new Date().toISOString() },
      }
    },
    enabled: !authLoading,
  })

  const connections = shell?.connections ?? []
  const connectionsContext = shell?.connectionsContext ?? null

  const handleRefresherRefresh = useCallback(async () => {
    setIsRefresherActive(true)
    await refetch()
    setIsRefresherActive(false)
  }, [refetch])

  const runEmptyStateAction = useCallback(
    (action: () => void, destination: string) => {
      if (isNavigating) return
      setIsNavigating(true)
      haptics('light')
      profileAnalytics.track('connection_empty_state_cta_tap', {
        mode: connectionsContext?.mode ?? 'fallback',
        destination,
      })
      try {
        action()
      } finally {
        // Reset after a short delay so a blocked navigation doesn't permanently disable the CTA.
        if (actionTimeoutRef.current) {
          clearTimeout(actionTimeoutRef.current)
        }
        actionTimeoutRef.current = setTimeout(() => setIsNavigating(false), 800)
      }
    },
    [isNavigating, connectionsContext]
  )

  useEffect(() => {
    return () => {
      if (actionTimeoutRef.current) {
        clearTimeout(actionTimeoutRef.current)
      }
    }
  }, [])

  useEffect(() => {
    if (viewTrackedRef.current || isLoading || connections.length === 0) return
    viewTrackedRef.current = true
    profileAnalytics.track('connection_card_view', {
      hasBio: connections.some((c) => Boolean(c.peerBio && c.peerBio.trim().length > 0)),
    })
  }, [isLoading, connections])

  useEffect(() => {
    if (connectionsContext?.mode !== 'feedback-complete' || celebratedRef.current) return
    celebratedRef.current = true
    haptics('success')
  }, [connectionsContext])

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

  type EmptyStateConfig =
    | {
        emotion: XiaoyueEmptyStateProps['emotion']
        title: string
        subtitle: string
        actionLabel: string
        onAction: () => void
      }
    | {
        emotion: XiaoyueEmptyStateProps['emotion']
        title: string
        subtitle: string
        actionLabel?: undefined
        onAction?: undefined
      }

  const emptyStateConfig = useMemo<EmptyStateConfig>(() => {
    const userArchetype = shell?.user?.primaryArchetype ?? user?.archetype ?? null
    const archetypeName = userArchetype ? ARCHETYPE_BY_ID[userArchetype]?.nameCn ?? null : null

    if (!connectionsContext) {
      return {
        emotion: 'curious',
        title: getEmptyStatePrompt('connections'),
        subtitle: archetypeName
          ? `你的${archetypeName}磁场，正在等待同频伙伴`
          : '参加活动后即可与活动伙伴建立连接',
        actionLabel: '去发现页看看',
        onAction: () => runEmptyStateAction(() => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover }), MINI_PROGRAM_ROUTES.discover),
      }
    }

    switch (connectionsContext.mode) {
      case 'no-events':
        return {
          emotion: 'curious',
          title: '还没有连接呢',
          subtitle: archetypeName
            ? `你的${archetypeName}磁场，正在等待同频伙伴`
            : '先参加一局活动，和志同道合的伙伴建立连接',
          actionLabel: '去发现页看看',
          onAction: () => runEmptyStateAction(() => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover }), MINI_PROGRAM_ROUTES.discover),
        }
      case 'upcoming-event': {
        const eventTitle = connectionsContext.upcomingEventTitle || '下一场活动'
        return {
          emotion: 'waiting',
          title: '活动还在路上',
          subtitle: `「${eventTitle}」结束后回来提交反馈，互相选择的伙伴就会成为连接`,
          actionLabel: '查看我的活动',
          onAction: () => runEmptyStateAction(() => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.events }), MINI_PROGRAM_ROUTES.events),
        }
      }
      case 'feedback-pending': {
        const eventTitle = connectionsContext.nextFeedbackEventTitle || '最近活动'
        const feedbackUrl = `/pages/event-feedback/index?id=${encodeURIComponent(connectionsContext.nextFeedbackEventId || '')}`
        return {
          emotion: 'coaching',
          title: '还差一步，连接就能见面',
          subtitle: `提交「${eventTitle}」的反馈后，你和互相选择的伙伴就会成为连接`,
          actionLabel: '去提交反馈',
          onAction: () => runEmptyStateAction(() => Taro.navigateTo({ url: feedbackUrl }), feedbackUrl),
        }
      }
      case 'feedback-complete':
        return {
          emotion: 'celebration',
          title: '反馈已收到，连接正在生成',
          subtitle: archetypeName
            ? `你的${archetypeName}磁场已就位，互相选择的好友会在这里出现`
            : '互相选择的好友会在这里出现，稍等片刻再来查看',
          actionLabel: '去发现页看看',
          onAction: () => runEmptyStateAction(() => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover }), MINI_PROGRAM_ROUTES.discover),
        }
      default:
        return {
          emotion: 'curious',
          title: getEmptyStatePrompt('connections'),
          subtitle: '参加活动后即可与活动伙伴建立连接',
          actionLabel: '去发现页看看',
          onAction: () => runEmptyStateAction(() => Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover }), MINI_PROGRAM_ROUTES.discover),
        }
    }
  }, [connectionsContext, shell?.user?.primaryArchetype, user?.archetype, runEmptyStateAction])

  const emptyWrapperStyle = emptyMinHeightRpx ? { minHeight: `${emptyMinHeightRpx}rpx` } : undefined

  return renderGate(
    <View className={`connections-page ${tabEntranceClass}`}>
      <ScrollView
        className='connections-page__list'
        scrollY
        enhanced
        showScrollbar={false}
        refresherEnabled
        refresherTriggered={isRefresherActive}
        onRefresherRefresh={handleRefresherRefresh}
      >
        {isLoading ? (
          <View className='connections-page__loading' style={emptyWrapperStyle}>
            <XiaoyueEmptyState
              emotion='waiting'
              title='正在加载…'
              subtitle='悦仔正在整理你的连接'
              size='md'
              disableBreathe={!isPrimary}
            />
          </View>
        ) : isError ? (
          <View className='connections-page__empty-state' style={emptyWrapperStyle}>
            <XiaoyueEmptyState
              emotion='reassure'
              title='加载失败'
              subtitle='网络有点调皮，再试一次吧'
              actionLabel='重试'
              onAction={() => {
                haptics('light')
                void refetch()
              }}
              size='md'
              disableBreathe={!isPrimary}
            />
          </View>
        ) : connections.length > 0 ? (
          connectionItems.map((conn) => (
            <Card
              key={String(conn.id)}
              className={`connections-page__card ${redesignEnabled ? '' : 'connections-page__card--legacy'}`}
              onClick={() => {
                haptics('light')
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
          <View className='connections-page__empty-state' style={emptyWrapperStyle}>
            <XiaoyueEmptyState
              emotion={emptyStateConfig.emotion}
              title={emptyStateConfig.title}
              subtitle={emptyStateConfig.subtitle}
              actionLabel={emptyStateConfig.actionLabel}
              onAction={emptyStateConfig.onAction}
              disabled={isNavigating}
              loading={isNavigating}
              loadingLabel='跳转中…'
              showCelebrationBadge={connectionsContext?.mode === 'feedback-complete'}
              size='md'
              disableBreathe={!isPrimary}
            />
          </View>
        )}
        {connections.length > 0 && <View className='connections-page__spacer' />}
      </ScrollView>
    </View>,
  )
}
