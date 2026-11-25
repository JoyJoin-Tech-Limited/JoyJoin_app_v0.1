import { describe, expect, it, vi } from 'vitest'
import { QueryClient, QueryObserver } from '@tanstack/react-query'
import type {
  ConnectionsShellResponse,
  DiscoverShellResponse,
  EventsShellResponse,
  ProfileShellResponse,
} from '@shared/api'
import {
  CONNECTIONS_QUERY_KEY,
  JOINED_EVENTS_QUERY_KEY,
  POOLS_QUERY_KEY,
  PROFILE_SHELL_QUERY_KEY,
} from '../prefetchEngine'
import { MINI_PROGRAM_TAB_ITEMS } from '../navigation/tabBarConfig'
import type { TabShellWarmupFetchers, TabShellWarmupTab } from './tabShellWarmup'

/**
 * Warm-pass gating contract (2026-11-25).
 *
 * The pass exists to make the first visit to a tab instant, but it must be
 * unable to damage the page the user is currently on. These tests lock:
 *   - network gate (2g/3g/none/unknown) and auth gate
 *   - one pass per launch + in-flight promise guard
 *   - fail-open behaviour (a rejecting fetcher never rejects the pass)
 *   - concurrency cap and priority order
 *   - never writing over a page that is already fetching (before and after the
 *     response lands)
 *   - cancellation on app hide
 *   - best-effort tab-icon warming
 */

const AUTH_KEY = ['mini-program', 'auth-user'] as const

const TAB_ICON_PATHS = MINI_PROGRAM_TAB_ITEMS.flatMap((item) => [
  `/${item.appIconPath}`,
  `/${item.appSelectedIconPath}`,
])

function discoverShell(): DiscoverShellResponse {
  return {
    user: { id: 'user-1' },
    pools: { items: [{ id: 'pool-1' }] },
    myRegistrations: { ids: [], statuses: {} },
  } as unknown as DiscoverShellResponse
}

function eventsShell(): EventsShellResponse {
  return {
    user: { id: 'user-1' },
    joinedEvents: [{ id: 'event-1' }],
    notifications: { total: 2 },
  } as unknown as EventsShellResponse
}

function connectionsShell(): ConnectionsShellResponse {
  return {
    user: { id: 'user-1' },
    connections: [],
    notifications: { total: 2 },
  } as unknown as ConnectionsShellResponse
}

function profileShell(): ProfileShellResponse {
  return {
    user: { id: 'user-1' },
    stats: { eventsJoined: 1 },
    coupons: [],
  } as unknown as ProfileShellResponse
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

interface TaroMock {
  getNetworkType?: unknown
  getImageInfo?: unknown
  onAppHide?: unknown
  onAppShow?: unknown
  offAppHide?: unknown
  offAppShow?: unknown
}

/**
 * `vi.resetModules()` gives every test a fresh copy of the warm-pass module
 * state (one-pass-per-launch flags, lifecycle listeners), and a fresh copy of
 * the Taro mock so per-test overrides cannot leak.
 */
async function loadModule(networkType = '4g') {
  vi.resetModules()
  const taroModule = await import('@tarojs/taro')
  const taro = taroModule.default as unknown as TaroMock
  taro.getNetworkType = vi.fn().mockResolvedValue({ networkType })

  const module = await import('./tabShellWarmup')
  return {
    module,
    taro,
    taroApi: taroModule as unknown as Record<string, ReturnType<typeof vi.fn>>,
  }
}

function createQueryClient(): QueryClient {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: Infinity } },
  })
  client.setQueryData(AUTH_KEY, { id: 'user-1', displayName: 'Tester' })
  return client
}

function createFetchers() {
  const calls: TabShellWarmupTab[] = []
  const fetchers: TabShellWarmupFetchers = {
    discover: () => {
      calls.push('discover')
      return Promise.resolve(discoverShell())
    },
    events: () => {
      calls.push('events')
      return Promise.resolve(eventsShell())
    },
    connections: () => {
      calls.push('connections')
      return Promise.resolve(connectionsShell())
    },
    profile: () => {
      calls.push('profile')
      return Promise.resolve(profileShell())
    },
  }
  return { calls, fetchers }
}

describe('tabShellWarmup network + auth gates', () => {
  it('skips on 3g and unknown networks without touching the network or the cache', async () => {
    for (const networkType of ['3g', 'unknown', '2g', 'none']) {
      const { module, taroApi } = await loadModule(networkType)
      const client = createQueryClient()
      const { calls, fetchers } = createFetchers()

      const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

      expect(result.status).toBe('skipped')
      expect(result.reason).toBe(`network-${networkType}`)
      expect(calls).toEqual([])
      expect(taroApi.getImageInfo).not.toHaveBeenCalled()
      expect(client.getQueryData(POOLS_QUERY_KEY)).toBeUndefined()
      expect(client.getQueryData(PROFILE_SHELL_QUERY_KEY)).toBeUndefined()
    }
  })

  it('fails open when network detection throws', async () => {
    const { module, taro } = await loadModule()
    taro.getNetworkType = vi.fn().mockRejectedValue(new Error('no network info'))
    const client = createQueryClient()
    const { calls, fetchers } = createFetchers()

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(result.status).toBe('completed')
    expect(calls).toHaveLength(4)
  })

  it('skips entirely when no auth user is cached (shells are authenticated)', async () => {
    const { module } = await loadModule()
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { calls, fetchers } = createFetchers()

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(result.status).toBe('skipped')
    expect(result.reason).toBe('unauthenticated')
    expect(calls).toEqual([])
  })
})

describe('tabShellWarmup one pass per launch', () => {
  it('runs once and reuses the in-flight promise', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const gate = deferred<DiscoverShellResponse>()
    const { calls, fetchers } = createFetchers()
    fetchers.discover = () => {
      calls.push('discover')
      return gate.promise
    }

    const first = module.runTabShellWarmup({ queryClient: client, fetchers })
    const second = module.runTabShellWarmup({ queryClient: client, fetchers })
    expect(second).toBe(first)

    gate.resolve(discoverShell())
    await first

    const third = module.runTabShellWarmup({ queryClient: client, fetchers })
    expect(third).toBe(first)
    await third

    expect(calls.filter((tab) => tab === 'discover')).toHaveLength(1)
    expect(calls).toHaveLength(4)
  })
})

describe('tabShellWarmup destination render', () => {
  it('mounts every tab observer with data, no loading state, and no mount fetch', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const { fetchers } = createFetchers()

    await module.runTabShellWarmup({ queryClient: client, fetchers })

    const mountFetches: string[] = []
    const cases: { key: readonly unknown[]; staleTime: number }[] = [
      // staleTime values mirror each page's own useQuery options.
      { key: POOLS_QUERY_KEY, staleTime: 20_000 },
      { key: JOINED_EVENTS_QUERY_KEY, staleTime: 30_000 },
      { key: CONNECTIONS_QUERY_KEY, staleTime: 30_000 },
      { key: PROFILE_SHELL_QUERY_KEY, staleTime: 30_000 },
    ]

    for (const { key, staleTime } of cases) {
      const observer = new QueryObserver(client, {
        queryKey: key,
        staleTime,
        queryFn: () => {
          mountFetches.push(String(key[key.length - 1]))
          return Promise.reject(new Error('a warm mount must not fetch'))
        },
      })
      const unsubscribe = observer.subscribe(() => {})
      const result = observer.getCurrentResult()

      expect(result.isLoading).toBe(false)
      expect(result.data).toBeDefined()
      expect(observer.getCurrentQuery().state.fetchStatus).toBe('idle')
      unsubscribe()
    }

    expect(mountFetches).toEqual([])
  })
})

describe('tabShellWarmup fail-open', () => {
  it('keeps warming the other tabs when one shell rejects', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const { fetchers } = createFetchers()
    fetchers.discover = () => Promise.reject(new Error('shell 500'))

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(result.status).toBe('completed')
    expect(result.failed).toEqual(['discover'])
    expect([...result.warmed].sort()).toEqual(['connections', 'events', 'profile'])
    // A failed warm writes nothing: the destination page keeps its own path.
    expect(client.getQueryData(POOLS_QUERY_KEY)).toBeUndefined()
  })

  it('resolves when every shell rejects (never throws)', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const failure = () => Promise.reject(new Error('offline'))
    const fetchers: TabShellWarmupFetchers = {
      discover: failure,
      events: failure,
      connections: failure,
      profile: failure,
    }

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(result.status).toBe('completed')
    expect([...result.failed].sort()).toEqual(['connections', 'discover', 'events', 'profile'])
    expect(result.warmed).toEqual([])
  })
})

describe('tabShellWarmup concurrency', () => {
  it('never exceeds two concurrent shell requests and starts in priority order', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const gates = {
      discover: deferred<DiscoverShellResponse>(),
      events: deferred<EventsShellResponse>(),
      connections: deferred<ConnectionsShellResponse>(),
      profile: deferred<ProfileShellResponse>(),
    }
    const started: TabShellWarmupTab[] = []
    let active = 0
    let maxActive = 0

    const track = <T>(tab: TabShellWarmupTab, promise: Promise<T>): Promise<T> => {
      started.push(tab)
      active += 1
      maxActive = Math.max(maxActive, active)
      return promise.finally(() => {
        active -= 1
      })
    }

    const fetchers: TabShellWarmupFetchers = {
      discover: () => track('discover', gates.discover.promise),
      events: () => track('events', gates.events.promise),
      connections: () => track('connections', gates.connections.promise),
      profile: () => track('profile', gates.profile.promise),
    }

    const run = module.runTabShellWarmup({ queryClient: client, fetchers })
    await flush()

    expect(started).toEqual(['discover', 'events'])
    expect(maxActive).toBe(2)

    gates.discover.resolve(discoverShell())
    await flush()
    expect(started).toEqual(['discover', 'events', 'connections'])
    expect(maxActive).toBe(2)

    gates.events.resolve(eventsShell())
    await flush()
    expect(started).toEqual(['discover', 'events', 'connections', 'profile'])
    expect(maxActive).toBe(2)

    gates.connections.resolve(connectionsShell())
    gates.profile.resolve(profileShell())
    const result = await run

    expect(result.status).toBe('completed')
    expect([...result.warmed].sort()).toEqual(['connections', 'discover', 'events', 'profile'])
    expect(maxActive).toBe(2)
  })
})

describe('tabShellWarmup never fights the active page', () => {
  it('leaves a tab alone when its page is already fetching', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const { calls, fetchers } = createFetchers()

    const pageGate = deferred<{ id: string }[]>()
    const pageFetch = client.fetchQuery({
      queryKey: POOLS_QUERY_KEY,
      queryFn: () => pageGate.promise,
    })

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(calls).not.toContain('discover')
    expect(result.warmed).not.toContain('discover')

    pageGate.resolve([{ id: 'page-owned' }])
    await pageFetch
    expect(client.getQueryData(POOLS_QUERY_KEY)).toEqual([{ id: 'page-owned' }])
  })

  it('discards its own payload when the page starts fetching mid-warm', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const warmGate = deferred<DiscoverShellResponse>()
    const { fetchers } = createFetchers()
    fetchers.discover = () => warmGate.promise

    const run = module.runTabShellWarmup({ queryClient: client, fetchers })
    await flush()

    const pageGate = deferred<{ id: string }[]>()
    const pageFetch = client.fetchQuery({
      queryKey: POOLS_QUERY_KEY,
      queryFn: () => pageGate.promise,
    })

    warmGate.resolve(discoverShell())
    await flush()

    // The page owns the key now: the warm payload was dropped, not written.
    expect(client.getQueryData(POOLS_QUERY_KEY)).toBeUndefined()

    pageGate.resolve([{ id: 'page-owned' }])
    await pageFetch
    await run
    expect(client.getQueryData(POOLS_QUERY_KEY)).toEqual([{ id: 'page-owned' }])
  })

  it('writes page-shaped data under the destination keys and never overwrites auth', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const authBefore = client.getQueryData(AUTH_KEY)
    const { fetchers } = createFetchers()

    await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(client.getQueryData(POOLS_QUERY_KEY)).toEqual(discoverShell().pools.items)
    expect(client.getQueryData(JOINED_EVENTS_QUERY_KEY)).toEqual(eventsShell().joinedEvents)
    expect(client.getQueryData(CONNECTIONS_QUERY_KEY)).toEqual(connectionsShell())
    expect(client.getQueryData(PROFILE_SHELL_QUERY_KEY)).toEqual(profileShell())
    expect(client.getQueryData(AUTH_KEY)).toBe(authBefore)
  })

  it('does not warm Discover from an empty composite (legacy fallback stays live)', async () => {
    const { module } = await loadModule()
    const client = createQueryClient()
    const { fetchers } = createFetchers()
    fetchers.discover = () =>
      Promise.resolve({
        user: { id: 'user-1' },
        pools: { items: [] },
        myRegistrations: { ids: [], statuses: {} },
      } as unknown as DiscoverShellResponse)

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(result.warmed).not.toContain('discover')
    expect(client.getQueryData(POOLS_QUERY_KEY)).toBeUndefined()
  })
})

describe('tabShellWarmup app lifecycle', () => {
  it('clears the scheduled pass when the app hides before it starts', async () => {
    const { module, taroApi } = await loadModule()
    const client = createQueryClient()
    const { calls, fetchers } = createFetchers()

    module.scheduleTabShellWarmup({ queryClient: client, fetchers, delayMs: 5_000 })
    const onHide = taroApi.onAppHide.mock.calls[0]?.[0] as () => void
    expect(typeof onHide).toBe('function')

    onHide()
    await flush()

    expect(calls).toEqual([])
    expect(taroApi.offAppHide).toHaveBeenCalled()
    expect(taroApi.offAppShow).toHaveBeenCalled()
  })

  it('stops the queue when the app hides mid-pass and discards in-flight payloads', async () => {
    const { module, taroApi } = await loadModule()
    const client = createQueryClient()
    const gates = {
      discover: deferred<DiscoverShellResponse>(),
      events: deferred<EventsShellResponse>(),
    }
    const started: TabShellWarmupTab[] = []
    const fetchers: TabShellWarmupFetchers = {
      discover: () => {
        started.push('discover')
        return gates.discover.promise
      },
      events: () => {
        started.push('events')
        return gates.events.promise
      },
      connections: () => {
        started.push('connections')
        return Promise.resolve(connectionsShell())
      },
      profile: () => {
        started.push('profile')
        return Promise.resolve(profileShell())
      },
    }

    module.scheduleTabShellWarmup({ queryClient: client, fetchers, delayMs: 0 })
    await flush()
    expect(started).toEqual(['discover', 'events'])

    const onHide = taroApi.onAppHide.mock.calls[0]?.[0] as () => void
    onHide()

    gates.discover.resolve(discoverShell())
    gates.events.resolve(eventsShell())

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(result.status).toBe('cancelled')
    expect(started).toEqual(['discover', 'events'])
    expect(client.getQueryData(POOLS_QUERY_KEY)).toBeUndefined()
  })
})

describe('tabShellWarmup tab icon warming', () => {
  it('primes all eight bundled tab icons', async () => {
    const { module, taroApi } = await loadModule()
    const client = createQueryClient()
    const { fetchers } = createFetchers()

    await module.runTabShellWarmup({ queryClient: client, fetchers })

    const sources = taroApi.getImageInfo.mock.calls.map(
      (call) => (call[0] as { src: string }).src,
    )
    expect(sources).toHaveLength(8)
    expect([...sources].sort()).toEqual([...TAB_ICON_PATHS].sort())
  })

  it('survives icon decode failures (best-effort only)', async () => {
    const { module, taro } = await loadModule()
    taro.getImageInfo = vi.fn().mockRejectedValue(new Error('decode failed'))
    const client = createQueryClient()
    const { fetchers } = createFetchers()

    const result = await module.runTabShellWarmup({ queryClient: client, fetchers })

    expect(result.status).toBe('completed')
    expect(result.warmed).toHaveLength(4)
  })
})
