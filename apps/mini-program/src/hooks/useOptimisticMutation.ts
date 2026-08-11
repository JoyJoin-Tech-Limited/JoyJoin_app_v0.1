import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { useQueryClient, type QueryKey } from '@tanstack/react-query'
import { evictPersistedQuery, PERSISTED_QUERY_KEYS } from '../lib/api/persistentCache'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import { logError, logInfo } from '../lib/utils/logger'

export interface UseOptimisticMutationOptions<TVariables, TData> {
  /** Server write. The server stays source of truth — optimistic state is
   *  rolled back on failure and invalidated on settle. */
  mutationFn: (vars: TVariables) => Promise<TData>
  /** Query keys whose cache entries are optimistically patched at mutate. */
  queryKeys: QueryKey[]
  /** Pure updater: receives the incoming vars + current cached value,
   *  returns the optimistic value. May return the same object. */
  optimisticUpdate: (vars: TVariables, prev: unknown) => unknown
  /** Optional rollback toast copy; falls back to getErrorMessage('submit-failed').
   *  Return null to suppress the toast (e.g. navigation is the feedback). */
  rollbackMessage?: (error: unknown) => string | null
  /** Extra keys to invalidate on settle (success or failure). Default: none. */
  onSettledInvalidate?: QueryKey[]
}

export interface UseOptimisticMutationResult<TVariables, TData> {
  /** Fire the mutation. Coalesced while one is in-flight for the same
   *  `queryKeys` set; resolves with the (eventual) mutation result. */
  mutate: (vars: TVariables) => Promise<TData>
  isPending: boolean
  isOptimistic: boolean
}

interface SnapshotEntry {
  hadEntry: boolean
  value: unknown
}

/** One snapshot batch per coalesced batch (taken at the idle→in-flight
 *  transition, never per `mutate` call). */
interface BatchSnapshot {
  snapshots: Map<string, SnapshotEntry>
  /** The exact objects this hook wrote per key (identity check for rollback). */
  patched: Map<string, unknown>
  /** C-2: the rollback toast fires at most once per batch — a held re-fire
   *  failure after the first failure must not double-toast. */
  toastShown: boolean
}

interface InFlightEntry<TVariables, TData> {
  running: boolean
  pendingVars: TVariables | null
  heldWaiters: Array<{ resolve: (data: TData) => void; reject: (error: unknown) => void }>
}

/** AC-6: a synchronous throw from mutationFn must behave like a rejected
 *  promise — the settle path owns entry cleanup either way. Without this,
 *  a sync throw would leave the in-flight entry stuck (isPending frozen,
 *  optimistic patch never rolled back, held waiters never settled). */
function captureSyncThrow<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return Promise.resolve(fn())
  } catch (err) {
    return Promise.reject(err)
  }
}

/**
 * Shared optimistic mutation layer: snapshot → optimistic `setQueryData` →
 * rollback on failure (with persisted-cache eviction) → invalidate on settle.
 * Server stays source of truth; the UI feels instant. M3 (compass) and
 * M4 (registration) consume this hook.
 */
export function useOptimisticMutation<TVariables, TData>(
  options: UseOptimisticMutationOptions<TVariables, TData>,
): UseOptimisticMutationResult<TVariables, TData> {
  const queryClient = useQueryClient()
  const { mutationFn, queryKeys, optimisticUpdate, rollbackMessage, onSettledInvalidate } = options

  const [isPending, setIsPending] = useState(false)
  const [isOptimistic, setIsOptimistic] = useState(false)
  const isMountedRef = useRef(true)
  const entriesRef = useRef(new Map<string, InFlightEntry<TVariables, TData>>())
  const persistedKeyStringsRef = useRef(new Set(PERSISTED_QUERY_KEYS.map((key) => JSON.stringify(key))))

  useEffect(() => {
    return () => {
      isMountedRef.current = false
    }
  }, [])

  const mutate = useCallback(
    (vars: TVariables): Promise<TData> => {
      const keysKey = JSON.stringify(queryKeys)
      const entries = entriesRef.current
      let entry = entries.get(keysKey)
      if (!entry) {
        entry = { running: false, pendingVars: null, heldWaiters: [] }
        entries.set(keysKey, entry)
      }

      // AC-4: coalesce — no concurrent mutationFn for the same key set; the
      // latest vars are held and fired after the first request settles.
      if (entry.running) {
        entry.pendingVars = vars
        return new Promise<TData>((resolve, reject) => {
          entry!.heldWaiters.push({ resolve, reject })
        })
      }

      entry.running = true
      if (isMountedRef.current) setIsPending(true)

      // AC-2/2a: snapshot once per batch, patch per key with try/catch — no
      // partial optimistic state; on throw the mutation is not tracked
      // in-flight and the error propagates to the caller.
      let batch: BatchSnapshot
      try {
        batch = snapshotAndPatch(queryKeys, vars)
      } catch (err) {
        entry.running = false
        entriesRef.current.delete(keysKey)
        if (isMountedRef.current) setIsPending(false)
        throw err
      }
      if (isMountedRef.current) setIsOptimistic(true)

      return captureSyncThrow(() => mutationFn(vars)).then(
        (data) => {
          settle({ success: true, batch, entry, keysKey, error: null })
          return data
        },
        (error: unknown) => {
          settle({ success: false, batch, entry, keysKey, error })
          throw error
        },
      )
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mutationFn, queryKeys, optimisticUpdate, onSettledInvalidate, rollbackMessage, queryClient],
  )

  /** Apply the optimistic patch per key (AC-2a: per-key try/catch; on throw
   *  restore the keys already patched in this batch, then propagate). */
  const snapshotAndPatch = (keys: QueryKey[], vars: TVariables): BatchSnapshot => {
    const batch: BatchSnapshot = { snapshots: new Map(), patched: new Map(), toastShown: false }
    for (const qk of keys) {
      const keyStr = JSON.stringify(qk)
      const prev = queryClient.getQueryData(qk)
      batch.snapshots.set(keyStr, { hadEntry: prev !== undefined, value: prev })
      let patched: unknown
      try {
        patched = queryClient.setQueryData(qk, (current) => optimisticUpdate(vars, current))
      } catch (err) {
        restoreBatch(batch, keys)
        throw err
      }
      batch.patched.set(keyStr, patched)
      logInfo('[OptimisticMutation] Applied optimistic update', {
        key: qk,
        hadEntry: prev !== undefined,
      })
    }
    return batch
  }

  /** AC-3a: restore a key only if its current value is still the exact object
   *  this hook patched; otherwise a concurrent mutation owns it — skip. */
  const restoreBatch = (batch: BatchSnapshot, keys: QueryKey[]): void => {
    for (const qk of keys) {
      const keyStr = JSON.stringify(qk)
      if (!batch.patched.has(keyStr)) continue
      const patched = batch.patched.get(keyStr)
      const current = queryClient.getQueryData(qk)
      if (current !== patched) continue
      const snapshot = batch.snapshots.get(keyStr)
      if (snapshot?.hadEntry) {
        queryClient.setQueryData(qk, snapshot.value)
      } else {
        queryClient.removeQueries({ queryKey: qk })
      }
    }
  }

  /** AC-3/3b: on failure restore snapshots FIRST, then evict persisted keys
   *  (eviction cancels the global debounce so no flush can resurrect the
   *  unconfirmed state), then surface the rollback toast. */
  const rollback = (batch: BatchSnapshot, keys: QueryKey[], error: unknown): void => {
    restoreBatch(batch, keys)
    for (const qk of keys) {
      if (persistedKeyStringsRef.current.has(JSON.stringify(qk))) {
        evictPersistedQuery(qk)
      }
    }
    logError('[OptimisticMutation] Rolled back optimistic update', {
      keys,
      message: error instanceof Error ? error.message : 'unknown error',
    })
    if (!isMountedRef.current) return
    // C-2: one toast channel per batch — a held re-fire failure after the
    // first failure must not double-toast (M4 stale-credit case: the second
    // toast would land on the payment page after navigation).
    if (batch.toastShown) return
    batch.toastShown = true
    const message = rollbackMessage ? rollbackMessage(error) : getErrorMessage('submit-failed')
    if (message === null) return
    Taro.showToast({ title: message, icon: 'none' })
  }

  const settle = (args: {
    success: boolean
    error: unknown
    batch: BatchSnapshot
    entry: InFlightEntry<TVariables, TData>
    keysKey: string
  }): void => {
    const { success, error, batch, entry, keysKey } = args
    if (!success) {
      rollback(batch, queryKeys, error)
    }
    // AC-5: invalidate on settle, then optimistic flag drops.
    if (isMountedRef.current) {
      if (onSettledInvalidate && onSettledInvalidate.length > 0) {
        for (const qk of onSettledInvalidate) {
          void queryClient.invalidateQueries({ queryKey: qk })
        }
      }
      setIsOptimistic(false)
    }

    // AC-4: fire the held (latest) vars after settle. AC-4a: cancel the
    // settle-triggered refetch before the fresh optimistic patch so it cannot
    // clobber it.
    const heldVars = entry.pendingVars
    entry.pendingVars = null
    if (heldVars === null) {
      entry.running = false
      entriesRef.current.delete(keysKey)
      if (isMountedRef.current) setIsPending(false)
      return
    }
    if (!isMountedRef.current) {
      // C-1: never reject waiters with null — the unmount path must surface a
      // real error so callers can distinguish it from a silent success.
      rejectWaiters(entry, error ?? new Error('OptimisticMutation: unmounted before settle'))
      return
    }
    for (const qk of queryKeys) {
      void queryClient.cancelQueries({ queryKey: qk })
    }
    let heldBatch: BatchSnapshot
    try {
      heldBatch = snapshotAndPatch(queryKeys, heldVars)
    } catch (patchErr) {
      entry.running = false
      entriesRef.current.delete(keysKey)
      setIsPending(false)
      setIsOptimistic(false)
      rejectWaiters(entry, patchErr)
      return
    }
    setIsOptimistic(true)
    void captureSyncThrow(() => mutationFn(heldVars)).then(
      (heldData) => {
        settle({ success: true, batch: heldBatch, entry, keysKey, error: null })
        resolveWaiters(entry, heldData)
      },
      (heldErr: unknown) => {
        settle({ success: false, batch: heldBatch, entry, keysKey, error: heldErr })
        rejectWaiters(entry, heldErr)
      },
    )
  }

  const resolveWaiters = (entry: InFlightEntry<TVariables, TData>, data: TData): void => {
    for (const waiter of entry.heldWaiters) waiter.resolve(data)
    entry.heldWaiters = []
  }

  const rejectWaiters = (entry: InFlightEntry<TVariables, TData>, error: unknown): void => {
    for (const waiter of entry.heldWaiters) waiter.reject(error)
    entry.heldWaiters = []
  }

  return { mutate, isPending, isOptimistic }
}
