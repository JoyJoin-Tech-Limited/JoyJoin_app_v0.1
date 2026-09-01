import Taro from '@tarojs/taro'
import type { QueryClient } from '@tanstack/react-query'
import type { DiscoverShellResponse, PoolRegistrationSummary, ProfileShellResponse, EventsShellResponse, ConnectionsShellResponse } from '@shared/api'
import { logInfo } from './utils/logger'
import { AUTH_QUERY_KEY } from './api/authSession'
import { getDeviceInfoCompat } from '../lib/utils/systemInfo'

// ─────────────────────────────────────────────────────────────────────────────
// Predictive Shell — client-side prefetch engine
// ─────────────────────────────────────────────────────────────────────────────
// Why composite + prefetch?
// Each tab currently fires multiple parallel requests on mount. By prefetching
// a single composite endpoint from the Landing page, we populate TanStack Query
// cache for all keys before the user navigates. When the user opens a tab,
// data is already warm — ≤1 network request and near-instant meaningful paint.
// ─────────────────────────────────────────────────────────────────────────────

type PrefetchOutcome = 'hit' | 'miss' | 'skip'

/** Cache key for the raw Discover composite response — used for atomic invalidation. */
export const DISCOVER_SHELL_QUERY_KEY = ['mini-program', 'shell/discover'] as const

/** Query keys that existing Discover hooks read from. */
export const POOLS_QUERY_KEY = ['mini-program', 'event-pools'] as const
export const REGISTRATIONS_QUERY_KEY = ['mini-program', 'my-pool-registrations'] as const

/** Cache key for the raw Profile composite response. */
export const PROFILE_SHELL_QUERY_KEY = ['mini-program', 'shell/profile'] as const

/** Query key that existing Profile hooks read from. */
const COUPONS_QUERY_KEY = ['mini-program', 'coupons'] as const

/** Cache key for the raw Events composite response. */
export const EVENTS_SHELL_QUERY_KEY = ['mini-program', 'shell/events'] as const

/** Query keys that existing Events hooks read from. */
export const JOINED_EVENTS_QUERY_KEY = ['mini-program', 'joined-events'] as const
const NOTIFICATION_COUNTS_QUERY_KEY = ['mini-program', 'notification-counts'] as const

/** Cache key for the raw Connections composite response. */
export const CONNECTIONS_SHELL_QUERY_KEY = ['mini-program', 'shell/connections'] as const

/** Query key that existing Connections hooks read from. */
const CONNECTIONS_QUERY_KEY = ['mini-program', 'connections'] as const

/** Device/network gate thresholds (AC-07). */
const MIN_BENCHMARK_LEVEL = 20
const BLOCKED_NETWORK_TYPES = ['2g', 'none']

/**
 * Map composite `myRegistrations` shape to `PoolRegistrationSummary[]` so that
 * the existing `useQuery({ queryKey: ['mini-program', 'my-pool-registrations'] })`
 * hook receives compatible data without refetching.
 */
export function mapRegistrationsToPoolRegistrationSummaries(
  myRegistrations: DiscoverShellResponse['myRegistrations']
): PoolRegistrationSummary[] {
  return myRegistrations.ids.map((id) => ({
    id,
    poolId: id,
    poolStatus: myRegistrations.statuses[id] ?? 'pending',
    matchStatus: (myRegistrations.statuses[id] === 'confirmed' ? 'matched' : 'pending') as PoolRegistrationSummary['matchStatus'],
  }))
}

/**
 * Inject a composite DiscoverShell response into TanStack Query cache under the
 * exact keys used by existing hooks. This is the bridge between the composite
 * endpoint and the existing component layer — no UI file needs to change.
 */
export function injectDiscoverShellIntoCache(
  queryClient: QueryClient,
  shell: DiscoverShellResponse
): void {
  // Auth: only inject if cache is empty. Auth is typically already warm from
  // the app-boot useAuth() fetch; overwriting it with the pruned composite user
  // object would strip fields like displayName that Discover needs.
  const existingAuth = queryClient.getQueryData(AUTH_QUERY_KEY)
  if (!existingAuth) {
    queryClient.setQueryData(AUTH_QUERY_KEY, {
      ...shell.user,
      profileEssentialComplete: true,
      profileExtendedComplete: true,
      activeAssessmentSessionId: null,
      // Intentionally omit paymentsEnabled so the real auth fetch owns it.
      // Prefetch injection must not block payment entry with a hardcoded false.
    })
  }

  // Pools: primary payload — inject directly so OracleCard list renders instantly.
  queryClient.setQueryData(POOLS_QUERY_KEY, shell.pools.items)

  // Registrations: map composite shape to the type expected by existing hooks.
  queryClient.setQueryData(
    REGISTRATIONS_QUERY_KEY,
    mapRegistrationsToPoolRegistrationSummaries(shell.myRegistrations)
  )

  // Raw composite: cached so mutations can invalidate it atomically (AC-13)
  // and so Discover can read from it as a fallback.
  queryClient.setQueryData(DISCOVER_SHELL_QUERY_KEY, shell)
}

/**
 * Inject a composite ProfileShell response into TanStack Query cache under the
 * exact keys used by existing hooks. This bridges the composite endpoint and
 * the Profile page — no UI file needs to change.
 *
 * IMPORTANT: The Profile shell returns a FULL AuthUserResponse (not pruned).
 * We unconditionally inject it into AUTH_QUERY_KEY so that the global useAuth()
 * hook and the Profile page share the same cached data, eliminating the
 * duplicate fetch.
 */
export function injectProfileShellIntoCache(
  queryClient: QueryClient,
  shell: ProfileShellResponse
): void {
  // Auth: unconditional injection. Profile shell returns the FULL auth user
  // response (same shape as GET /api/auth/user), so it's safe to overwrite.
  queryClient.setQueryData(AUTH_QUERY_KEY, shell.user)

  // Coupons: inject directly so Profile stats render instantly.
  queryClient.setQueryData(COUPONS_QUERY_KEY, shell.coupons)

  // Raw composite: cached for atomic invalidation.
  queryClient.setQueryData(PROFILE_SHELL_QUERY_KEY, shell)
}

/**
 * Inject a composite EventsShell response into TanStack Query cache under the
 * exact keys used by existing hooks. Bridges the composite endpoint and the
 * Events page — no UI file needs to change.
 *
 * Auth injection is gated (only if empty) because the Events shell returns a
 * pruned user slice, like Discover. We must not overwrite a full auth cache.
 */
export function injectEventsShellIntoCache(
  queryClient: QueryClient,
  shell: EventsShellResponse
): void {
  // Auth: only inject if cache is empty. Auth is typically warm from app-boot.
  const existingAuth = queryClient.getQueryData(AUTH_QUERY_KEY)
  if (!existingAuth) {
    queryClient.setQueryData(AUTH_QUERY_KEY, {
      ...shell.user,
      profileEssentialComplete: true,
      profileExtendedComplete: true,
      activeAssessmentSessionId: null,
      // Intentionally omit paymentsEnabled so the real auth fetch owns it.
    })
  }

  // Joined events: primary payload — inject directly.
  queryClient.setQueryData(JOINED_EVENTS_QUERY_KEY, shell.joinedEvents)

  // Notification counts: inject so badge counts are correct on mount.
  queryClient.setQueryData(NOTIFICATION_COUNTS_QUERY_KEY, shell.notifications)

  // Raw composite: cached for atomic invalidation.
  queryClient.setQueryData(EVENTS_SHELL_QUERY_KEY, shell)
}

/**
 * Inject a composite ConnectionsShell response into TanStack Query cache.
 *
 * Auth injection is gated (only if empty) because the Connections shell returns
 * a pruned user slice, like Discover.
 */
export function injectConnectionsShellIntoCache(
  queryClient: QueryClient,
  shell: ConnectionsShellResponse
): void {
  // Auth: only inject if cache is empty.
  const existingAuth = queryClient.getQueryData(AUTH_QUERY_KEY)
  if (!existingAuth) {
    queryClient.setQueryData(AUTH_QUERY_KEY, {
      ...shell.user,
      profileEssentialComplete: true,
      profileExtendedComplete: true,
      activeAssessmentSessionId: null,
      // Intentionally omit paymentsEnabled so the real auth fetch owns it.
    })
  }

  // Connections: inject directly so list renders instantly.
  queryClient.setQueryData(CONNECTIONS_QUERY_KEY, shell.connections)

  // Notification counts: inject for badge accuracy.
  queryClient.setQueryData(NOTIFICATION_COUNTS_QUERY_KEY, shell.notifications)

  // Raw composite: cached for atomic invalidation.
  queryClient.setQueryData(CONNECTIONS_SHELL_QUERY_KEY, shell)
}

interface PrefetchGateResult {
  shouldRun: boolean
  reason?: string
}

/**
 * Gating checks for the prefetch engine (AC-07, AC-11).
 * Skips prefetch when user is unauthenticated, on 2g networks, or on
 * low-end devices (benchmarkLevel < 20).
 */
async function checkPrefetchGate(queryClient: QueryClient): Promise<PrefetchGateResult> {
  // Auth gate (AC-11)
  const authUser = queryClient.getQueryData(AUTH_QUERY_KEY)
  if (!authUser) {
    return { shouldRun: false, reason: 'unauthenticated' }
  }

  // Network gate (AC-07)
  try {
    const { networkType } = await Taro.getNetworkType()
    if (BLOCKED_NETWORK_TYPES.includes(networkType)) {
      return { shouldRun: false, reason: `network-${networkType}` }
    }
  } catch {
    // Fail open if network type cannot be determined.
  }

  // Device tier gate (AC-07)
  try {
    const info = getDeviceInfoCompat()
    if (typeof info.benchmarkLevel === 'number' && info.benchmarkLevel < MIN_BENCHMARK_LEVEL) {
      return { shouldRun: false, reason: `benchmark-${info.benchmarkLevel}` }
    }
  } catch {
    // Fail open if system info cannot be read.
  }

  return { shouldRun: true }
}

function logPrefetchOutcome(name: string, outcome: PrefetchOutcome, reason?: string): void {
  logInfo('prefetch.discover', { name, outcome, reason })
}

/**
 * PrefetchEngine — reusable client-side prefetch module for the mini-program.
 *
 * Core responsibilities:
 * 1. Stage prefetch requests with named triggers.
 * 2. Gate on network type + device tier + auth state.
 * 3. Inject response into queryClient under correct keys.
 * 4. Never throw — all failures are silent (REL-03).
 * 5. Log outcome for observability (OBS-02).
 */
export class PrefetchEngine {
  private queryClient: QueryClient
  private timers = new Map<string, ReturnType<typeof setTimeout>>()

  constructor(queryClient: QueryClient) {
    this.queryClient = queryClient
  }

  /**
   * Stage a named prefetch to run after a delay.
   * The delay starts from the call site (e.g., post-animation completion).
   * Duplicate staging for the same name cancels the previous timer.
   */
  stage(name: string, factory: () => Promise<void>, delayMs = 1500): void {
    this.clear(name)

    const timer = setTimeout(() => {
      void this.run(name, factory)
    }, delayMs)

    this.timers.set(name, timer)
  }

  /**
   * Run a prefetch immediately, respecting gates.
   * All errors are swallowed and logged as 'miss' (REL-03).
   */
  async run(name: string, factory: () => Promise<void>): Promise<void> {
    const gate = await checkPrefetchGate(this.queryClient)
    if (!gate.shouldRun) {
      logPrefetchOutcome(name, 'skip', gate.reason)
      return
    }

    try {
      await factory()
      logPrefetchOutcome(name, 'hit')
    } catch {
      // Silent failure — prefetch must never throw or block navigation.
      logPrefetchOutcome(name, 'miss')
    }
  }

  /** Cancel a staged prefetch by name, or all if no name is given. */
  clear(name?: string): void {
    if (name) {
      const timer = this.timers.get(name)
      if (timer) {
        clearTimeout(timer)
        this.timers.delete(name)
      }
    } else {
      for (const timer of this.timers.values()) {
        clearTimeout(timer)
      }
      this.timers.clear()
    }
  }
}

let globalEngine: PrefetchEngine | null = null

/** Get or create the singleton PrefetchEngine instance. */
export function getPrefetchEngine(queryClient: QueryClient): PrefetchEngine {
  if (!globalEngine) {
    globalEngine = new PrefetchEngine(queryClient)
  }
  return globalEngine
}
