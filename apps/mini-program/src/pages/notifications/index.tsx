import { View, Text, ScrollView } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useInfiniteQuery } from '@tanstack/react-query'
import { useEffect, useRef } from 'react'
import { getNotifications, type NotificationListItem } from '@shared/api'
import { apiRequest } from '../../lib/api/api'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { haptics } from '../../lib/utils/haptics'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import './index.scss'

const PAGE_SIZE = 30

const CATEGORY_META: Record<string, { emoji: string; label: string }> = {
  activities: { emoji: '🎉', label: '活动' },
  discover: { emoji: '✨', label: '发现' },
  chat: { emoji: '💬', label: '消息' },
}

function formatRelativeTime(iso: string): string {
  const then = new Date(iso).getTime()
  const diffMs = Date.now() - then
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return '刚刚'
  if (minutes < 60) return `${minutes} 分钟前`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours} 小时前`
  const days = Math.floor(hours / 24)
  if (days === 1) return '昨天'
  if (days < 7) return `${days} 天前`
  const d = new Date(iso)
  return `${d.getMonth() + 1}月${d.getDate()}日`
}

export default function NotificationsPage() {
  const markAsRead = useMarkNotificationsAsRead()
  const markedRef = useRef(false)

  // Leaving the list page clears the tab badges — the list IS the read surface.
  useEffect(() => {
    return () => {
      if (markedRef.current) return
      markedRef.current = true
      void markAsRead.mutate('activities')
      void markAsRead.mutate('discover')
    }
  }, [markAsRead])

  const query = useInfiniteQuery({
    queryKey: ['mini-program', 'notifications', 'list'],
    queryFn: ({ pageParam }) =>
      getNotifications(apiRequest, { limit: PAGE_SIZE, before: pageParam }),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
  })

  useReachBottom(() => {
    if (query.hasNextPage && !query.isFetchingNextPage) {
      void query.fetchNextPage()
    }
  })

  const items: NotificationListItem[] = query.data?.pages.flatMap((p) => p.items) ?? []
  const loading = query.isLoading
  const error = query.isError

  if (loading) {
    return <LoadingScreen message='正在整理你的通知…' />
  }

  return (
    <View className='notifications-page'>
      {error ? (
        <View className='notifications-page__state'>
          <XiaoyueEmptyState emotion='reassure' title='通知没加载出来' subtitle='点下方按钮再试一次' />
          <View
            className='notifications-page__retry'
            hoverClass='notifications-page__retry--active'
            onClick={() => {
              haptics('light')
              void query.refetch()
            }}
            role='button'
            aria-label='重试'
          >
            <Text className='notifications-page__retry-text'>重试</Text>
          </View>
        </View>
      ) : items.length === 0 ? (
        <View className='notifications-page__state'>
          <XiaoyueEmptyState
            emotion='waiting'
            title='都看完啦'
            subtitle='有新的活动消息，悦仔会第一时间告诉你'
          />
        </View>
      ) : (
        <ScrollView className='notifications-page__scroll' scrollY enhanced showScrollbar={false}>
          <View className='notifications-page__list'>
            {items.map((item) => {
              const meta = CATEGORY_META[item.category] ?? { emoji: '🔔', label: '通知' }
              return (
                <View
                  key={item.id}
                  className={`notifications-page__row${item.isRead ? '' : ' notifications-page__row--unread'}`}
                >
                  <View className='notifications-page__row-icon' aria-hidden='true'>
                    <JoyJoinIcon emoji={meta.emoji} tier='category' size={20} />
                  </View>
                  <View className='notifications-page__row-body'>
                    <View className='notifications-page__row-head'>
                      <Text className='notifications-page__row-title'>{item.title}</Text>
                      <Text className='notifications-page__row-time'>
                        {formatRelativeTime(item.createdAt)}
                      </Text>
                    </View>
                    {item.message ? (
                      <Text className='notifications-page__row-message'>{item.message}</Text>
                    ) : null}
                  </View>
                  {!item.isRead ? (
                    <View className='notifications-page__row-dot' aria-hidden='true' />
                  ) : null}
                </View>
              )
            })}
          </View>
          {query.isFetchingNextPage ? (
            <Text className='notifications-page__more'>加载中…</Text>
          ) : !query.hasNextPage ? (
            <Text className='notifications-page__more'>— 没有更早的通知了 —</Text>
          ) : null}
        </ScrollView>
      )}
    </View>
  )
}
