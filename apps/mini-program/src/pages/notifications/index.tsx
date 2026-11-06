import { View, Text, ScrollView } from '@tarojs/components'
import { useReachBottom } from '@tarojs/taro'
import { useInfiniteQuery, useQueryClient, type InfiniteData } from '@tanstack/react-query'
import { memo, useCallback, useRef, useState } from 'react'
import {
  getNotifications,
  markNotificationRead,
  type NotificationCountsResponse,
  type NotificationListItem,
  type NotificationListResponse,
} from '@shared/api'
import { apiRequest } from '../../lib/api/api'
import { haptics } from '../../lib/utils/haptics'
import {
  canNavigateNotification,
  navigateFromNotification,
} from '../../lib/navigation/notificationNavigation'
import { showAppToast } from '../../lib/utils/toast'
import XiaoyueEmptyState from '../../components/mascot/XiaoyueEmptyState'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { NOTIFICATION_COUNTS_KEY, useMarkNotificationsAsRead } from '../../hooks/useNotificationCounts'
import './index.scss'

const PAGE_SIZE = 30

type NotificationCategory = 'activities' | 'discover' | 'chat'
type NotificationListData = InfiniteData<NotificationListResponse>

export const NOTIFICATIONS_LIST_QUERY_KEY = ['mini-program', 'notifications', 'list'] as const

const CATEGORY_ORDER: NotificationCategory[] = ['activities', 'discover', 'chat']

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

function updateNotificationReadState(
  current: NotificationListData | undefined,
  shouldMark: (item: NotificationListItem) => boolean,
): NotificationListData | undefined {
  if (!current) return current
  let changed = false
  const pages = current.pages.map((page) => {
    let pageChanged = false
    const items = page.items.map((item) => {
      if (item.isRead || !shouldMark(item)) return item
      pageChanged = true
      changed = true
      return { ...item, isRead: true }
    })
    return pageChanged ? { ...page, items } : page
  })
  return changed ? { ...current, pages } : current
}

interface NotificationRowProps {
  item: NotificationListItem
  opening: boolean
  onOpen: (item: NotificationListItem) => void
}

const NotificationRow = memo(function NotificationRow({ item, opening, onOpen }: NotificationRowProps) {
  const meta = CATEGORY_META[item.category] ?? { emoji: '🔔', label: '通知' }
  const isMapped = canNavigateNotification(item)
  return (
    <View
      className={`notifications-page__row${item.isRead ? '' : ' notifications-page__row--unread'}${isMapped ? ' notifications-page__row--linked' : ''}`}
      hoverClass={isMapped && !opening ? 'notifications-page__row--pressed' : undefined}
      onClick={isMapped ? () => onOpen(item) : undefined}
      role={isMapped ? 'button' : undefined}
      aria-label={isMapped ? `${item.title}，查看详情` : undefined}
      aria-disabled={isMapped ? opening : undefined}
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
      {isMapped ? <View className='notifications-page__row-chevron' aria-hidden='true' /> : null}
    </View>
  )
})

export default function NotificationsPage() {
  const queryClient = useQueryClient()
  const { mutateAsync: markCategoryRead } = useMarkNotificationsAsRead()
  const [pendingCategory, setPendingCategory] = useState<NotificationCategory | null>(null)
  const categoryPendingRef = useRef(false)
  const [openingId, setOpeningId] = useState<string | null>(null)
  const openingRef = useRef(false)

  const handleOpenNotification = useCallback(async (item: NotificationListItem) => {
    if (openingRef.current || !canNavigateNotification(item)) return
    openingRef.current = true
    setOpeningId(item.id)
    haptics('light')

    try {
      let accepted = false
      try {
        accepted = await navigateFromNotification(item)
      } catch {
        showAppToast({ title: '跳转失败，请重试', icon: 'none' })
      }
      if (!accepted) return

      try {
        const result = await markNotificationRead(apiRequest, item.id)
        if (!result.success) throw new Error('Notification read was not confirmed')
      } catch {
        showAppToast({ title: '已打开，暂未标为已读', icon: 'none' })
        return
      }

      queryClient.setQueryData<NotificationListData>(NOTIFICATIONS_LIST_QUERY_KEY, (current) =>
        updateNotificationReadState(current, (candidate) => candidate.id === item.id),
      )
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_COUNTS_KEY })
    } finally {
      openingRef.current = false
      setOpeningId(null)
    }
  }, [queryClient])

  const handleMarkCategory = useCallback(async (category: NotificationCategory) => {
    if (categoryPendingRef.current) return
    categoryPendingRef.current = true
    setPendingCategory(category)
    haptics('light')

    try {
      const result = await markCategoryRead(category)
      if (!result.success) throw new Error('Category read was not confirmed')
      queryClient.setQueryData<NotificationListData>(NOTIFICATIONS_LIST_QUERY_KEY, (current) =>
        updateNotificationReadState(current, (item) => item.category === category),
      )
      queryClient.setQueryData<NotificationCountsResponse>(NOTIFICATION_COUNTS_KEY, (current) => {
        if (!current) return current
        const next = { ...current, [category]: 0 }
        return { ...next, total: next.activities + next.discover + next.chat }
      })
      void queryClient.invalidateQueries({ queryKey: NOTIFICATIONS_LIST_QUERY_KEY })
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_COUNTS_KEY })
    } catch {
      showAppToast({ title: '暂时无法标记，请重试', icon: 'none' })
    } finally {
      categoryPendingRef.current = false
      setPendingCategory(null)
    }
  }, [markCategoryRead, queryClient])

  const query = useInfiniteQuery({
    queryKey: NOTIFICATIONS_LIST_QUERY_KEY,
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
  const categoryActions = CATEGORY_ORDER.filter((category) =>
    items.some((item) => item.category === category),
  )
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
          {categoryActions.length > 0 ? (
            <View className='notifications-page__mark-all' aria-label='按类型全部标为已读'>
              {categoryActions.map((category) => {
                const disabled = pendingCategory !== null
                const pending = pendingCategory === category
                return (
                  <View
                    key={category}
                    className={`notifications-page__mark-all-button${disabled ? ' notifications-page__mark-all-button--disabled' : ''}`}
                    hoverClass={disabled ? undefined : 'notifications-page__mark-all-button--pressed'}
                    onClick={() => {
                      if (!disabled) void handleMarkCategory(category)
                    }}
                    role='button'
                    aria-label={`${CATEGORY_META[category].label}全部已读`}
                    aria-disabled={disabled}
                    aria-busy={pending}
                  >
                    <Text className='notifications-page__mark-all-text'>
                      {pending ? '标记中…' : `${CATEGORY_META[category].label}全部已读`}
                    </Text>
                  </View>
                )
              })}
            </View>
          ) : null}
          <View className='notifications-page__list'>
            {items.map((item) => (
              <NotificationRow
                key={item.id}
                item={item}
                opening={openingId === item.id}
                onOpen={handleOpenNotification}
              />
            ))}
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
