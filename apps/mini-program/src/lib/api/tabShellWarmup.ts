/**
 * Tab-shell warmup (2026-11-25).
 *
 * Problem: each of the four tab pages fetches its own data on mount, so the
 * FIRST visit to a tab paints a skeleton. Tabs the user already opened stay in
 * WeChat's page stack and feel instant — only the first visit is slow.
 *
 * Solution: one idle pass per app launch, ~1.2 s after launch, that fetches the
 * composite shell for every tab and writes it into the TanStack cache under the
 * exact keys the destination page reads. The destination's first render is then
 * real content instead of a skeleton.
 *
 * Safety rules — a warm pass must never damage the page the user is on:
 * - Auth gate: shell endpoints require a session. Without a cached auth user the
 *   pass is skipped entirely, so a warm request can never trigger a 401 logout.
 * - Network gate: skipped on 2g / 3g / none / unknown; a detection failure fails
 *   open (an unknown network must not silently disable the feature).
 * - Per tab: skipped when the key already holds data (page is warm) or is
 *   actively fetching (the page owns it). The same check is repeated AFTER the
 *   response arrives, so a page that starts its own fetch mid-warm always wins
 *   and our payload is discarded instead of written.
 * - Concurrency is capped at 2 and priority-ordered (discover, events,
 *   connections, profile), so the pass cannot crowd out the active page's own
 *   requests.
 * - App hide cancels the queue; every failure is logged and swallowed. A failed
 *   warm writes nothing at all, so the destination page behaves exactly as it
 *   does today.
 *
 * The pass is fire-and-forget: the app shell never awaits it.
 */

import Taro from '@tarojs/taro'
import type { QueryClient } from '@tanstack/react-query'
import type {
  ConnectionsShellResponse,
  DiscoverShellResponse,
  EventsShellResponse,
  ProfileShellResponse,
} from '@shared/api'
import { fetchConnectionsShell, fetchDiscoverShell, fetchEventsShell, fetchProfileShell } from './api'
import { AUTH_QUERY_KEY } from './authSession'
import { queryClient as defaultQueryClient } from './queryClient'
import {
  CONNECTIONS_QUERY_KEY,
  JOINED_EVENTS_QUERY_KEY,
  POOLS_QUERY_KEY,
  PROFILE_SHELL_QUERY_KEY,
  injectConnectionsShellIntoCache,
  injectDiscoverShellIntoCache,
  injectEventsShellIntoCache,
} from '../prefetchEngine'
import { MINI_PROGRAM_TAB_ITEMS } from '../navigation/tabBarConfig'
import { localAsset } from '../utils/cdnAssets'
import { logInfo, logWarn } from '../utils/logger'

export type TabShellWarmupTab = 'discover' | 'events' | 'connections' | 'profile'

export interface TabShellWarmupResult {
  status: 'completed' | 'skipped' | 'cancelled'
  /** Machine-readable reason when `status` is `skipped`. */
  reason?: string
  warmed: TabShellWarmupTab[]
  failed: TabShellWarmupTab[]
}

export interface TabShellWarmupFetchers {
  discover: () => Promise<DiscoverShellResponse>
  events: () => Promise<EventsShellResponse>
  connections: () => Promise<ConnectionsShellResponse>
  profile: () => Promise<ProfileShellResponse>
}

export interface TabShellWarmupOptions {
  /** Defaults to the app-wide singleton query client. */
  queryClient?: QueryClient
  /** Test seam — production always uses the real shell endpoints. */
  fetchers?: Partial<TabShellWarmupFetchers>
  /** Defaults to {@link WARMUP_DELAY_MS}. */
  delayMs?: number
}

const WARMUP_DELAY_MS = 1200
const MAX_CONCURRENT_WARMS = 2
const BLOCKED_NETWORK_TYPES: string[] = ['2g', '3g', 'none', 'unknown']

/** Callback that performs the cache write once the response has landed. */
type TabShellInjection = (queryClient: QueryClient) => void

interface TabShellWarmupTarget {
  tab: TabShellWarmupTab
  /** The page-level key whose presence means "this tab is already warm". */
  primaryKey: readonly unknown[]
  /**
   * Fetch the composite shell and return the cache write to apply. Returning
   * `null` means the response carried no usable payload for this tab.
   */
  load: (fetchers: TabShellWarmupFetchers) => Promise<TabShellInjection | null>
}

const DEFAULT_FETCHERS: TabShellWarmupFetchers = {
  discover: fetchDiscoverShell,
  events: fetchEventsShell,
  connections: fetchConnectionsShell,
  profile: fetchProfileShell,
}

/**
 * Priority order matters: with two workers, the first two entries start
 * immediately and the rest drain in order. `primaryKey` is the key the
 * destination page's own `useQuery` reads (see each `pages/<tab>/index.tsx`).
 */
const TAB_SHELL_TARGETS: TabShellWarmupTarget[] = [
  {
    tab: 'discover',
    primaryKey: POOLS_QUERY_KEY,
    load: async (fetchers) => {
      const shell = await fetchers.discover()
      // `loadDiscoverPools` treats an empty composite as "fall back to the
      // canonical /api/event-pools list". Writing an empty pools array would
      // make Discover believe it is warm and skip that fallback entirely.
      if (shell.pools.items.length === 0) return null
      return (queryClient) => injectDiscoverShellIntoCache(queryClient, shell)
    },
  },
  {
    tab: 'events',
    primaryKey: JOINED_EVENTS_QUERY_KEY,
    load: async (fetchers) => {
      const shell = await fetchers.events()
      // Also fills the notification-counts cache and the raw shell key.
      return (queryClient) => injectEventsShellIntoCache(queryClient, shell)
    },
  },
  {
    tab: 'connections',
    primaryKey: CONNECTIONS_QUERY_KEY,
    load: async (fetchers) => {
      const shell = await fetchers.connections()
      // The page reads the envelope (connections + pending reveal), so the
      // helper's `setQueryData(CONNECTIONS_QUERY_KEY, shell)` is the right shape.
      return (queryClient) => injectConnectionsShellIntoCache(queryClient, shell)
    },
  },
  {
    tab: 'profile',
    primaryKey: PROFILE_SHELL_QUERY_KEY,
    load: async (fetchers) => {
      const shell = await fetchers.profile()
      return (queryClient) => {
        // Deliberately NOT `injectProfileShellIntoCache`: that helper overwrites
        // AUTH_QUERY_KEY unconditionally, and a 1.2 s-old shell snapshot must
        // never replace the boot auth response (auth drives onboarding routing).
        // The Profile tab queries this exact key, so warming it alone removes
        // the stats skeleton.
        queryClient.setQueryData(PROFILE_SHELL_QUERY_KEY, shell)
      }
    },
  },
]

/** The eight bundled tab icons: four tabs x (inactive, selected). */
const TAB_ICON_ASSETS: string[] = MINI_PROGRAM_TAB_ITEMS.flatMap((item) => [
  item.appIconPath,
  item.appSelectedIconPath,
])

// ─── Module state: one pass per app launch ─────────────────────────────────

let scheduled = false
let settled = false
let cancelled = false
let scheduledTimer: ReturnType<typeof setTimeout> | null = null
let lifecycleAttached = false
let launchRun: Promise<TabShellWarmupResult> | null = null

function handleAppHide(): void {
  if (cancelled) return
  cancelled = true
  if (scheduledTimer !== null) {
    clearTimeout(scheduledTimer)
    scheduledTimer = null
  }
  logInfo('[tabShellWarmup] Cancelled on app hide', { passStarted: launchRun !== null })
  if (launchRun === null) {
    // The pass never started and nothing re-arms it this launch, so release the
    // lifecycle listeners immediately instead of leaving them for the session.
    settled = true
    detachLifecycle()
  }
}

function handleAppShow(): void {
  // Nothing resumes: the launch pass is one-shot. This handler only exists so
  // the hide listener can be released as soon as the pass has settled.
  if (settled) detachLifecycle()
}

function attachLifecycle(): void {
  if (lifecycleAttached) return
  lifecycleAttached = true
  Taro.onAppHide(handleAppHide)
  Taro.onAppShow(handleAppShow)
}

function detachLifecycle(): void {
  if (!lifecycleAttached) return
  lifecycleAttached = false
  Taro.offAppHide(handleAppHide)
  Taro.offAppShow(handleAppShow)
}

// ─── Gating ────────────────────────────────────────────────────────────────

async function isNetworkAllowed(): Promise<{ allowed: boolean; reason?: string }> {
  if (typeof Taro.getNetworkType !== 'function') {
    return { allowed: true }
  }
  try {
    const { networkType } = await Taro.getNetworkType()
    if (networkType && BLOCKED_NETWORK_TYPES.includes(networkType)) {
      return { allowed: false, reason: `network-${networkType}` }
    }
    return { allowed: true }
  } catch {
    // Fail open — the prefetch engine uses the same convention.
    return { allowed: true }
  }
}

function hasAuthenticatedUser(queryClient: QueryClient): boolean {
  return Boolean(queryClient.getQueryData(AUTH_QUERY_KEY))
}

// ─── Warm work ─────────────────────────────────────────────────────────────

async function warmTarget(
  target: TabShellWarmupTarget,
  queryClient: QueryClient,
  fetchers: TabShellWarmupFetchers,
): Promise<'warmed' | 'skipped' | 'failed'> {
  const before = queryClient.getQueryState(target.primaryKey)
  if (before?.data !== undefined) {
    logInfo('[tabShellWarmup] Tab already warm', { tab: target.tab })
    return 'skipped'
  }
  if (before?.fetchStatus === 'fetching') {
    logInfo('[tabShellWarmup] Tab page is already fetching; leaving it alone', { tab: target.tab })
    return 'skipped'
  }

  let injection: TabShellInjection | null
  try {
    injection = await target.load(fetchers)
  } catch (error) {
    logWarn('[tabShellWarmup] Shell fetch failed', {
      tab: target.tab,
      message: error instanceof Error ? error.message : String(error),
    })
    return 'failed'
  }

  if (!injection) {
    logInfo('[tabShellWarmup] Composite returned no usable payload', { tab: target.tab })
    return 'skipped'
  }

  if (cancelled) {
    // App went to the background while the request was in flight: discard the
    // payload rather than writing into a cache nobody is looking at.
    return 'skipped'
  }

  // Re-check after the response landed: the page may have mounted and started
  // its own request in the meantime. Its data is at least as fresh as ours, so
  // losing the race means we drop our payload instead of overwriting.
  const after = queryClient.getQueryState(target.primaryKey)
  if (after?.data !== undefined) {
    logInfo('[tabShellWarmup] Tab became warm during the pass', { tab: target.tab })
    return 'skipped'
  }
  if (after?.fetchStatus === 'fetching') {
    logInfo('[tabShellWarmup] Tab page started fetching; discarding prefetched payload', {
      tab: target.tab,
    })
    return 'skipped'
  }

  try {
    injection(queryClient)
  } catch (error) {
    logWarn('[tabShellWarmup] Cache injection failed', {
      tab: target.tab,
      message: error instanceof Error ? error.message : String(error),
    })
    return 'failed'
  }

  logInfo('[tabShellWarmup] Tab warmed', { tab: target.tab })
  return 'warmed'
}

async function warmTabBarIcons(): Promise<number> {
  let warmed = 0
  for (const assetPath of TAB_ICON_ASSETS) {
    if (cancelled) break
    try {
      // Bundled package assets: this only primes WeChat's native decode cache.
      // The tab bar renders them through <image> regardless of this result.
      await Taro.getImageInfo({ src: localAsset(`/${assetPath}`) })
      warmed += 1
    } catch {
      // Best-effort — a failed decode must never affect the tab bar.
    }
  }
  return warmed
}

async function runQueue(
  queryClient: QueryClient,
  fetchers: TabShellWarmupFetchers,
): Promise<{ warmed: TabShellWarmupTab[]; failed: TabShellWarmupTab[]; cancelled: boolean }> {
  const queue = [...TAB_SHELL_TARGETS]
  const warmed: TabShellWarmupTab[] = []
  const failed: TabShellWarmupTab[] = []

  const worker = async (): Promise<void> => {
    while (!cancelled) {
      const target = queue.shift()
      if (!target) return
      const outcome = await warmTarget(target, queryClient, fetchers)
      if (outcome === 'warmed') warmed.push(target.tab)
      if (outcome === 'failed') failed.push(target.tab)
    }
  }

  const concurrency = Math.min(MAX_CONCURRENT_WARMS, TAB_SHELL_TARGETS.length)
  await Promise.all(Array.from({ length: concurrency }, () => worker()))

  return { warmed, failed, cancelled }
}

async function executePass(options: TabShellWarmupOptions): Promise<TabShellWarmupResult> {
  const queryClient = options.queryClient ?? defaultQueryClient
  const fetchers: TabShellWarmupFetchers = { ...DEFAULT_FETCHERS, ...options.fetchers }

  try {
    if (!hasAuthenticatedUser(queryClient)) {
      logInfo('[tabShellWarmup] Skipped: no cached auth user')
      return { status: 'skipped', reason: 'unauthenticated', warmed: [], failed: [] }
    }

    const network = await isNetworkAllowed()
    if (!network.allowed) {
      logInfo('[tabShellWarmup] Skipped by network gate', { reason: network.reason })
      return { status: 'skipped', reason: network.reason ?? 'network', warmed: [], failed: [] }
    }

    if (cancelled) {
      return { status: 'cancelled', warmed: [], failed: [] }
    }

    const [iconCount, queueResult] = await Promise.all([
      warmTabBarIcons(),
      runQueue(queryClient, fetchers),
    ])

    logInfo('[tabShellWarmup] Pass finished', {
      warmed: queueResult.warmed,
      failed: queueResult.failed,
      icons: iconCount,
      cancelled: queueResult.cancelled,
    })

    return {
      status: queueResult.cancelled ? 'cancelled' : 'completed',
      warmed: queueResult.warmed,
      failed: queueResult.failed,
    }
  } finally {
    settled = true
    detachLifecycle()
  }
}

/**
 * Schedule the one-shot warm pass ~1.2 s after launch.
 *
 * Safe to call more than once: only the first call arms a timer, and the pass
 * itself refuses to run twice per launch.
 */
export function scheduleTabShellWarmup(options: TabShellWarmupOptions = {}): void {
  if (scheduled) return
  scheduled = true
  attachLifecycle()
  scheduledTimer = setTimeout(() => {
    scheduledTimer = null
    void runTabShellWarmup(options)
  }, options.delayMs ?? WARMUP_DELAY_MS)
}

/**
 * Run the warm pass immediately. Production uses {@link scheduleTabShellWarmup};
 * this is the same pass without the delay, and it is idempotent per launch.
 */
export function runTabShellWarmup(
  options: TabShellWarmupOptions = {},
): Promise<TabShellWarmupResult> {
  if (launchRun) return launchRun
  launchRun = executePass(options)
  return launchRun
}
