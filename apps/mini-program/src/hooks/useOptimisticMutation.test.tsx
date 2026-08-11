import { describe, it, expect, vi, beforeEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import type { ReactNode } from 'react'
import Taro from '@tarojs/taro'
import { useOptimisticMutation } from './useOptimisticMutation'
import { evictPersistedQuery, PERSISTED_QUERY_KEYS } from '../lib/api/persistentCache'

// POOLS_QUERY_KEY — a real persisted key so scenario (c) exercises the
// eviction path against the actual PERSISTED_QUERY_KEYS whitelist.
const PLAIN_KEY = ['test', 'count'] as const
const PERSISTED_KEY = ['mini-program', 'event-pools'] as const

vi.mock('../lib/api/persistentCache', async () => {
  const actual = await vi.importActual<typeof import('../lib/api/persistentCache')>('../lib/api/persistentCache')
  return {
    ...actual,
    evictPersistedQuery: vi.fn(),
  }
})

const mockEvictPersistedQuery = vi.mocked(evictPersistedQuery)

interface CountData {
  count: number
}

interface Vars {
  delta: number
}

function deferred<T>() {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}

function createWrapper(queryClient: QueryClient) {
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  }
}

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
}

const bump = (vars: Vars, prev: unknown) => ({
  count: ((prev as CountData | undefined)?.count ?? 0) + vars.delta,
})

describe('useOptimisticMutation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('(a) success: applies the optimistic patch synchronously and invalidates on settle', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })
    const invalidateSpy = vi.spyOn(queryClient, 'invalidateQueries')
    const server = deferred<CountData>()
    const mutationFn = vi.fn(() => server.promise)

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
          onSettledInvalidate: [['test', 'other']],
        }),
      { wrapper: createWrapper(queryClient) },
    )

    // Patch applies synchronously at mutate() — before any await.
    let mutatePromise!: Promise<CountData>
    act(() => {
      mutatePromise = result.current.mutate({ delta: 5 })
    })
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 6 })
    expect(mutationFn).toHaveBeenCalledWith({ delta: 5 })

    await act(async () => {
      server.resolve({ count: 6 })
    })
    await expect(mutatePromise).resolves.toEqual({ count: 6 })

    await waitFor(() => {
      expect(result.current.isOptimistic).toBe(false)
      expect(result.current.isPending).toBe(false)
    })
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ['test', 'other'] })
  })

  it('(b) failure: rollback restores the snapshot', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })
    const server = deferred<CountData>()
    const mutationFn = vi.fn(() => server.promise)

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutatePromise!: Promise<CountData>
    act(() => {
      mutatePromise = result.current.mutate({ delta: 5 })
    })
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 6 })

    const rejection = expect(mutatePromise).rejects.toThrow('boom')
    await act(async () => {
      server.reject(new Error('boom'))
    })
    await rejection

    await waitFor(() => {
      expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 1 })
      expect(result.current.isOptimistic).toBe(false)
      expect(result.current.isPending).toBe(false)
    })
  })

  it('(c) failure with persisted key: evictPersistedQuery is called', async () => {    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PERSISTED_KEY, { count: 1 })
    const server = deferred<CountData>()
    const mutationFn = vi.fn(() => server.promise)

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PERSISTED_KEY],
          optimisticUpdate: bump,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutatePromise!: Promise<CountData>
    act(() => {
      mutatePromise = result.current.mutate({ delta: 1 })
    })
    const rejection = expect(mutatePromise).rejects.toThrow('boom')
    await act(async () => {
      server.reject(new Error('boom'))
    })
    await rejection

    await waitFor(() => {
      expect(mockEvictPersistedQuery).toHaveBeenCalledWith(PERSISTED_KEY)
      expect(queryClient.getQueryData<CountData>(PERSISTED_KEY)).toEqual({ count: 1 })
    })
    expect(PERSISTED_QUERY_KEYS).toContainEqual(PERSISTED_KEY)
  })

  it('(d) dedupe: coalesced mutate holds latest vars and refires after settle (call count = 2, final args = vars2)', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })
    const first = deferred<CountData>()
    const second = deferred<CountData>()
    const mutationFn = vi
      .fn<() => Promise<CountData>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let firstCall!: Promise<CountData>
    let secondCall!: Promise<CountData>
    act(() => {
      firstCall = result.current.mutate({ delta: 1 })
    })
    // Second call while in-flight: coalesced — no concurrent mutationFn.
    act(() => {
      secondCall = result.current.mutate({ delta: 2 })
    })
    expect(mutationFn).toHaveBeenCalledTimes(1)
    expect(mutationFn).toHaveBeenNthCalledWith(1, { delta: 1 })
    // Latest vars patch on top of the first optimistic state.
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 2 })

    await act(async () => {
      first.resolve({ count: 2 })
    })
    await expect(firstCall).resolves.toEqual({ count: 2 })

    // After the first request settles, the held (latest) vars fire.
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(2)
    })
    expect(mutationFn).toHaveBeenNthCalledWith(2, { delta: 2 })
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 4 })

    await act(async () => {
      second.resolve({ count: 4 })
    })
    await expect(secondCall).resolves.toEqual({ count: 4 })
  })

  it('(e) rollback toast: rollbackMessage wins over the shared fallback', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })

    const failServer = deferred<CountData>()
    const mutationFn = vi.fn(() => failServer.promise)
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
          rollbackMessage: (error) => `回滚提示: ${error instanceof Error ? error.message : 'unknown'}`,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutatePromise!: Promise<CountData>
    act(() => {
      mutatePromise = result.current.mutate({ delta: 5 })
    })
    const rejection = expect(mutatePromise).rejects.toThrow('boom')
    await act(async () => {
      failServer.reject(new Error('boom'))
    })
    await rejection

    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith({ title: '回滚提示: boom', icon: 'none' })
    })
  })

  it('(e) rollback toast: falls back to getErrorMessage("submit-failed")', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })

    const failServer = deferred<CountData>()
    const mutationFn = vi.fn(() => failServer.promise)
    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutatePromise!: Promise<CountData>
    act(() => {
      mutatePromise = result.current.mutate({ delta: 5 })
    })
    const rejection = expect(mutatePromise).rejects.toThrow('boom')
    await act(async () => {
      failServer.reject(new Error('boom'))
    })
    await rejection

    await waitFor(() => {
      expect(Taro.showToast).toHaveBeenCalledWith({ title: '提交没成功，再试一次', icon: 'none' })
    })
  })

  it('(f) AC-2a: optimisticUpdate throw — no cache write, not tracked in-flight, error propagated', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })
    const mutationFn = vi.fn<() => Promise<CountData>>()

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: () => {
            throw new Error('updater exploded')
          },
        }),
      { wrapper: createWrapper(queryClient) },
    )

    act(() => {
      expect(() => result.current.mutate({ delta: 1 })).toThrow('updater exploded')
    })

    expect(mutationFn).not.toHaveBeenCalled()
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 1 })
    expect(result.current.isOptimistic).toBe(false)
    expect(result.current.isPending).toBe(false)
  })

  it('(g) AC-3a identity-check: rollback skips a key owned by a concurrent writer', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })
    const server = deferred<CountData>()
    const mutationFn = vi.fn(() => server.promise)

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let mutatePromise!: Promise<CountData>
    act(() => {
      mutatePromise = result.current.mutate({ delta: 5 })
    })
    // Optimistic patch applied.
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 6 })

    // A concurrent writer replaces the value before the failure settles.
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 100 })

    const rejection = expect(mutatePromise).rejects.toThrow('boom')
    await act(async () => {
      server.reject(new Error('boom'))
    })
    await rejection

    // Rollback skipped this key — the concurrent writer's value survives.
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 100 })
  })

  it('(h) AC-4a: cancelQueries fires for every key before the held refire', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })
    const cancelSpy = vi.spyOn(queryClient, 'cancelQueries')
    const first = deferred<CountData>()
    const second = deferred<CountData>()
    const mutationFn = vi
      .fn<() => Promise<CountData>>()
      .mockReturnValueOnce(first.promise)
      .mockReturnValueOnce(second.promise)

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
          onSettledInvalidate: [PLAIN_KEY],
        }),
      { wrapper: createWrapper(queryClient) },
    )

    let firstCall!: Promise<CountData>
    act(() => {
      firstCall = result.current.mutate({ delta: 1 })
    })
    // Coalesced — held vars fire after the first settle.
    act(() => {
      void result.current.mutate({ delta: 2 })
    })

    await act(async () => {
      first.resolve({ count: 2 })
    })
    await expect(firstCall).resolves.toEqual({ count: 2 })

    // Held refire happened (call 2), with cancelQueries before it.
    await waitFor(() => {
      expect(mutationFn).toHaveBeenCalledTimes(2)
    })
    expect(cancelSpy).toHaveBeenCalledWith({ queryKey: PLAIN_KEY })
    const firstCancelOrder = cancelSpy.mock.invocationCallOrder[0]
    const heldFireOrder = mutationFn.mock.invocationCallOrder[1]
    expect(firstCancelOrder).toBeLessThan(heldFireOrder)

    await act(async () => {
      second.resolve({ count: 4 })
    })
  })

  it('(i) AC-6: sync-throwing mutationFn — rejection (no sync throw), entry not stuck, rollback runs', async () => {
    const queryClient = makeQueryClient()
    queryClient.setQueryData<CountData>(PLAIN_KEY, { count: 1 })
    const mutationFn = vi.fn<() => Promise<CountData>>(() => {
      throw new Error('sync boom')
    })

    const { result } = renderHook(
      () =>
        useOptimisticMutation<Vars, CountData>({
          mutationFn,
          queryKeys: [PLAIN_KEY],
          optimisticUpdate: bump,
        }),
      { wrapper: createWrapper(queryClient) },
    )

    // Must NOT throw synchronously — the throw flows through the rejection path.
    let mutatePromise!: Promise<CountData>
    act(() => {
      mutatePromise = result.current.mutate({ delta: 5 })
    })
    // Optimistic patch applied before the rejection settles.
    expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 6 })

    const rejection = expect(mutatePromise).rejects.toThrow('sync boom')
    await rejection

    // Rollback restored the snapshot; flags reset — nothing stuck in-flight.
    await waitFor(() => {
      expect(queryClient.getQueryData<CountData>(PLAIN_KEY)).toEqual({ count: 1 })
      expect(result.current.isOptimistic).toBe(false)
      expect(result.current.isPending).toBe(false)
    })
    expect(Taro.showToast).toHaveBeenCalledWith({ title: '提交没成功，再试一次', icon: 'none' })

    // Entry not stuck: a fresh mutate after the failure runs a new request.
    const server = deferred<CountData>()
    mutationFn.mockReturnValueOnce(server.promise)
    let retryPromise!: Promise<CountData>
    act(() => {
      retryPromise = result.current.mutate({ delta: 2 })
    })
    expect(mutationFn).toHaveBeenCalledTimes(2)
    await act(async () => {
      server.resolve({ count: 3 })
    })
    await expect(retryPromise).resolves.toEqual({ count: 3 })
  })
})
