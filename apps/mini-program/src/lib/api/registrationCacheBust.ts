import type { QueryClient } from '@tanstack/react-query'
import {
  POOLS_QUERY_KEY,
  JOINED_EVENTS_QUERY_KEY,
  DISCOVER_SHELL_QUERY_KEY,
  EVENTS_SHELL_QUERY_KEY,
  CONNECTIONS_SHELL_QUERY_KEY,
} from '../prefetchEngine'
import { AUTH_QUERY_KEY } from './authSession'
import { evictPersistedQuery } from './persistentCache'

export interface RegistrationCacheBustOptions {
  poolId?: string
}

/**
 * Invalidate all client caches that may contain stale registration/payment state.
 * Call this after any successful registration or payment completion path so that
 * Discover, Events, Profile and shell composites reflect the latest data when the
 * user navigates back.
 */
export async function bustRegistrationCaches(
  queryClient: QueryClient,
  options: RegistrationCacheBustOptions = {},
): Promise<void> {
  const { poolId } = options

  await Promise.allSettled([
    queryClient.invalidateQueries({ queryKey: POOLS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: ['mini-program', 'my-pool-registrations'] }),
    queryClient.invalidateQueries({ queryKey: JOINED_EVENTS_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: DISCOVER_SHELL_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: EVENTS_SHELL_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: CONNECTIONS_SHELL_QUERY_KEY }),
    queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY }),
    ...(poolId
      ? [queryClient.invalidateQueries({ queryKey: ['mini-program', 'event-pool', poolId] })]
      : []),
  ])

  evictPersistedQuery(POOLS_QUERY_KEY)
  evictPersistedQuery(JOINED_EVENTS_QUERY_KEY)
}
