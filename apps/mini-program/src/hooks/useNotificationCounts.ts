import { useEffect, useState } from 'react'
import Taro from '@tarojs/taro'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotificationCounts,
  markNotificationsAsRead,
  type NotificationCountsResponse,
} from '@shared/api'
import { POLL_NOTIFICATIONS_MS, STALE_TIME_DEFAULT_MS } from '../lib/utils/uiConstants'
import { apiRequest } from '../lib/api/api'

const NOTIFICATION_COUNTS_KEY = ['mini-program', 'notification-counts'] as const

export function useNotificationCounts(enabled = true) {
  const queryClient = useQueryClient()
  // WeChat backgrounded apps keep JS timers alive only briefly, but
  // TanStack's refetchInterval never auto-pauses (no document.hidden), so an
  // explicit app-lifecycle gate is required. While the app is hidden the
  // interval is disabled entirely; on resume, one silent invalidate refetches
  // immediately (cached badge counts paint synchronously meanwhile).
  const [isAppVisible, setIsAppVisible] = useState(true)

  useEffect(() => {
    const handleAppShow = () => {
      setIsAppVisible(true)
      void queryClient.invalidateQueries({ queryKey: NOTIFICATION_COUNTS_KEY })
    }
    const handleAppHide = () => {
      setIsAppVisible(false)
    }

    Taro.onAppShow(handleAppShow)
    Taro.onAppHide(handleAppHide)
    return () => {
      Taro.offAppShow(handleAppShow)
      Taro.offAppHide(handleAppHide)
    }
  }, [queryClient])

  return useQuery<NotificationCountsResponse>({
    queryKey: NOTIFICATION_COUNTS_KEY,
    queryFn: () => getNotificationCounts(apiRequest),
    enabled,
    refetchInterval: isAppVisible ? POLL_NOTIFICATIONS_MS : false,
    staleTime: STALE_TIME_DEFAULT_MS,
  })
}

export function useMarkNotificationsAsRead() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (category: 'discover' | 'activities' | 'chat') =>
      markNotificationsAsRead(apiRequest, category),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: NOTIFICATION_COUNTS_KEY })
    },
  })
}
