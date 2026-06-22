import { useEffect, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import {
  getJoinedEvents,
  getMyPoolRegistrations,
  type PoolRegistrationSummary,
  type JoinedEventSummary,
} from '@shared/api'
import { useAuth } from '../useAuth'
import { apiRequest } from '../../lib/api/api'
import {
  JOINED_EVENTS_QUERY_KEY,
  REGISTRATIONS_QUERY_KEY,
} from '../../lib/prefetchEngine'
import { getMiniProgramCenterState } from '../../lib/navigation/centerTabRouting'
import {
  setTabBarBadges,
  setTabBarCenterState,
  type TabBadgeCounts,
} from '../../lib/navigation/tabBarState'
import { useNotificationCounts } from '../useNotificationCounts'

/**
 * Single source of truth for tab-bar chrome data.
 *
 * Mounted once in App.tsx. It owns:
 * - notification-count polling (one interval for the whole app)
 * - observing the shared pool-registrations / joined-events query cache
 * - computing the center button state
 *
 * Per-page `useCustomTabBarSync` only reads the derived state and pushes it
 * to the visible native tab bar instance; it no longer fetches data itself.
 */
export function useTabBarStateBridge(): void {
  const { isAuthenticated } = useAuth()
  const enabled = isAuthenticated

  const { data: notificationCounts } = useNotificationCounts(enabled)

  const { data: poolRegistrations = [] } = useQuery<PoolRegistrationSummary[]>({
    queryKey: REGISTRATIONS_QUERY_KEY,
    queryFn: () => getMyPoolRegistrations(apiRequest),
    enabled,
    staleTime: Infinity,
  })

  const { data: events = [] } = useQuery<JoinedEventSummary[]>({
    queryKey: JOINED_EVENTS_QUERY_KEY,
    queryFn: () => getJoinedEvents(apiRequest),
    enabled,
    staleTime: Infinity,
  })

  const badges = useMemo<TabBadgeCounts>(
    () =>
      enabled
        ? {
            discover: notificationCounts?.discover ?? 0,
            activities: notificationCounts?.activities ?? 0,
            chat: notificationCounts?.chat ?? 0,
          }
        : { discover: 0, activities: 0, chat: 0 },
    [enabled, notificationCounts]
  )

  const centerState = useMemo(
    () => getMiniProgramCenterState(poolRegistrations, events),
    [poolRegistrations, events]
  )

  useEffect(() => {
    setTabBarBadges(badges)
  }, [badges])

  useEffect(() => {
    setTabBarCenterState(centerState)
  }, [centerState])
}
