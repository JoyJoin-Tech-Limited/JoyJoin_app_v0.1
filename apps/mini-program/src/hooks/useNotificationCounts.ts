import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getNotificationCounts,
  markNotificationsAsRead,
  type NotificationCountsResponse,
} from '@shared/api'
import { apiRequest } from '../lib/api'

const NOTIFICATION_COUNTS_KEY = ['mini-program', 'notification-counts'] as const

export function useNotificationCounts(enabled = true) {
  return useQuery<NotificationCountsResponse>({
    queryKey: NOTIFICATION_COUNTS_KEY,
    queryFn: () => getNotificationCounts(apiRequest),
    enabled,
    refetchInterval: 30_000,
    staleTime: 15_000,
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
