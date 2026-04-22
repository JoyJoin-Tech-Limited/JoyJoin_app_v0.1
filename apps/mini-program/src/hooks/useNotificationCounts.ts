import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotificationCounts,
  markNotificationsAsRead,
  type NotificationCountsResponse,
} from '@shared/api'
import { POLL_NOTIFICATIONS_MS, STALE_TIME_DEFAULT_MS } from '../lib/uiConstants'
import { apiRequest } from '../lib/api'

const NOTIFICATION_COUNTS_KEY = ['mini-program', 'notification-counts'] as const

export function useNotificationCounts(enabled = true) {
  return useQuery<NotificationCountsResponse>({
    queryKey: NOTIFICATION_COUNTS_KEY,
    queryFn: () => getNotificationCounts(apiRequest),
    enabled,
    refetchInterval: POLL_NOTIFICATIONS_MS,
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
