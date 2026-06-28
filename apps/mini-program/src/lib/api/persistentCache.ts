import type { QueryClient, QueryKey } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import { logInfo, logWarn } from '../utils/logger'
import { POOLS_QUERY_KEY, JOINED_EVENTS_QUERY_KEY } from '../prefetchEngine'

// ─────────────────────────────────────────────────────────────────────────────
// Persistent Query Cache — Tier 2 Offline Support
// ─────────────────────────────────────────────────────────────────────────────
// Hydrates TanStack Query cache from Taro.setStorageSync for selected
// low-volatility query keys. Provides instant cold-start rendering when
// the user returns after WeChat kills the mini-program.
//
// Safety invariants:
// - Only whitelisted query keys are persisted (SCA-02)
// - Cache schema version prevents stale-shape hydration after app updates (REL)
// - 4h TTL limits stale data window (SEC)
// - 75KB total cap prevents storage bloat and startup blocking (SCA)
// - All storage I/O is try/catch wrapped (REL-01)
// - Mutation-triggered eviction removes affected keys (AC-12)
// - Eviction clears the in-flight debounce timer so stale data cannot
//   be resurrected by a pending flush (B1)
// - Storage is cleared on hard logout to prevent cross-user data leakage (B2)
// - Hydration passes original timestamp so RQ knows true data age (P0)
// ─────────────────────────────────────────────────────────────────────────────

const CACHE_SCHEMA_VERSION = 2
const STORAGE_KEY_PREFIX = 'jj_cache_v1_'
const MAX_CACHE_AGE_MS = 4 * 60 * 60 * 1000 // 4 hours
const MAX_CACHE_SIZE_BYTES = 75 * 1024 // 75 KB total (P0 perf: halved from 150KB)
const DEBOUNCE_MS = 2000 // 2s debounce on writes

/** Query keys eligible for persistent caching.
 *  MUST match actual queryKey constants used in hooks/pages. */
export const PERSISTED_QUERY_KEYS: QueryKey[] = [
  POOLS_QUERY_KEY,
  JOINED_EVENTS_QUERY_KEY,
]

/** Pre-serialized whitelist for O(1) lookup in hot subscribe path (P1 perf). */
const PERSISTED_KEY_STRINGS = new Set(
  PERSISTED_QUERY_KEYS.map((k) => JSON.stringify(k))
)

interface CacheEntry {
  data: unknown
  timestamp: number
  schemaVersion: number
}

interface CacheWrapper {
  entries: Record<string, CacheEntry>
  schemaVersion: number
  savedAt: number
}

function getStorageKey(): string {
  return `${STORAGE_KEY_PREFIX}query_cache`
}

function serializeQueryKey(key: QueryKey): string {
  return JSON.stringify(key)
}

/** Rough UTF-8 byte count for mixed content (CJK = 3 bytes).
 *  WeChat storage is byte-oriented, not code-unit oriented. */
function getUtf8ByteLength(str: string): number {
  let byteLength = 0
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    byteLength += code < 0x80 ? 1 : code < 0x800 ? 2 : 3
  }
  return byteLength
}

function isValidCacheEntry(entry: unknown): entry is CacheEntry {
  if (!entry || typeof entry !== 'object') return false
  const e = entry as Record<string, unknown>
  return (
    typeof e.timestamp === 'number' &&
    typeof e.schemaVersion === 'number' &&
    e.schemaVersion === CACHE_SCHEMA_VERSION &&
    'data' in e
  )
}

/** Remove a specific query key from persistent storage and cancel any
 *  in-flight debounced flush for that key. Call from mutation onSuccess. */
export function evictPersistedQuery(queryKey: QueryKey): void {
  const keyStr = serializeQueryKey(queryKey)
  evictedKeysPendingFlush.add(keyStr)

  // Cancel pending debounce so stale data cannot be written back (B1)
  if (debounceTimer) {
    clearTimeout(debounceTimer)
    debounceTimer = null
  }

  try {
    const storageKey = getStorageKey()
    const raw: unknown = Taro.getStorageSync(storageKey)
    if (!raw || typeof raw !== 'string') return

    const wrapper: CacheWrapper = JSON.parse(raw)
    if (wrapper.entries && typeof wrapper.entries === 'object' && wrapper.entries[keyStr]) {
      delete wrapper.entries[keyStr]
      wrapper.savedAt = Date.now()
      Taro.setStorageSync(storageKey, JSON.stringify(wrapper))
      logInfo('[CacheEvict] Removed key from persistent storage', { key: keyStr })
    }
  } catch (err) {
    logWarn('[CacheEvict] Failed to evict key', {
      key: keyStr,
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/** Clear ALL persisted query cache entries from storage.
 *  Call on hard logout / auth clear (B2). */
export function clearPersistentCache(): void {
  try {
    Taro.removeStorageSync(getStorageKey())
    logInfo('[CacheClear] Persistent cache cleared')
  } catch (err) {
    logWarn('[CacheClear] Failed to clear persistent cache', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

/** Hydrate eligible query data from storage into the QueryClient.
 *  Call once at app cold start before first render. */
export function tryHydratePersistentCache(queryClient: QueryClient): void {
  try {
    const raw: unknown = Taro.getStorageSync(getStorageKey())
    if (!raw || typeof raw !== 'string') {
      logInfo('[CacheHydrate] No persisted cache found')
      return
    }

    let wrapper: CacheWrapper
    try {
      wrapper = JSON.parse(raw)
    } catch {
      logWarn('[CacheHydrate] Invalid JSON in storage, clearing')
      Taro.removeStorageSync(getStorageKey())
      return
    }

    if (
      !wrapper ||
      typeof wrapper !== 'object' ||
      wrapper.schemaVersion !== CACHE_SCHEMA_VERSION ||
      !wrapper.entries ||
      typeof wrapper.entries !== 'object'
    ) {
      logInfo('[CacheHydrate] Malformed wrapper, discarding')
      Taro.removeStorageSync(getStorageKey())
      return
    }

    const now = Date.now()
    let hydratedCount = 0
    let expiredCount = 0

    for (const keyStr of Object.keys(wrapper.entries)) {
      const entry = wrapper.entries[keyStr]
      if (!isValidCacheEntry(entry)) {
        delete wrapper.entries[keyStr]
        continue
      }

      if (now - entry.timestamp > MAX_CACHE_AGE_MS) {
        expiredCount++
        delete wrapper.entries[keyStr]
        continue
      }

      try {
        const queryKey = JSON.parse(keyStr) as QueryKey
        // Pass original timestamp so RQ knows true data age (P0 fix)
        queryClient.setQueryData(queryKey, entry.data, { updatedAt: entry.timestamp })
        hydratedCount++
      } catch {
        // Skip malformed keys silently
      }
    }

    logInfo('[CacheHydrate] Complete', {
      hydrated: hydratedCount,
      expired: expiredCount,
      sizeBytes: raw.length,
    })

    // Clean up expired entries from storage
    if (expiredCount > 0) {
      wrapper.savedAt = now
      Taro.setStorageSync(getStorageKey(), JSON.stringify(wrapper))
    }
  } catch (err) {
    logWarn('[CacheHydrate] Failed to hydrate', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}

// Module-level state for debounce + eviction tracking (W3)
let debounceTimer: ReturnType<typeof setTimeout> | null = null
const evictedKeysPendingFlush = new Set<string>()

/** Subscribe to query cache changes and persist eligible keys to storage.
 *  Writes are debounced by DEBOUNCE_MS to avoid storage churn.
 *  Returns an unsubscribe function (W1). */
export function subscribeToPersistentCache(queryClient: QueryClient): () => void {
  const unsubscribe = queryClient.getQueryCache().subscribe((event) => {
    if (event.type !== 'updated' && event.type !== 'added') return
    const query = event.query
    if (!query) return

    // Only persist successful queries with actual data (S1)
    if (query.state.status !== 'success') return
    if (query.state.data === undefined) return

    const keyStr = serializeQueryKey(query.queryKey)
    if (!PERSISTED_KEY_STRINGS.has(keyStr)) return

    // Debounce writes
    if (debounceTimer) {
      clearTimeout(debounceTimer)
    }
    debounceTimer = setTimeout(() => {
      flushCacheToStorage(queryClient)
    }, DEBOUNCE_MS)
  })

  return unsubscribe
}

function flushCacheToStorage(queryClient: QueryClient): void {
  try {
    const wrapper: CacheWrapper = {
      entries: {},
      schemaVersion: CACHE_SCHEMA_VERSION,
      savedAt: Date.now(),
    }

    PERSISTED_QUERY_KEYS.forEach((persistedKey) => {
      const keyStr = serializeQueryKey(persistedKey)

      // Skip keys that were evicted since the last flush (B1 fix)
      if (evictedKeysPendingFlush.has(keyStr)) {
        evictedKeysPendingFlush.delete(keyStr)
        return
      }

      const data = queryClient.getQueryData(persistedKey)
      if (data === undefined) return
      wrapper.entries[keyStr] = {
        data,
        timestamp: Date.now(),
        schemaVersion: CACHE_SCHEMA_VERSION,
      }
    })

    const payload = JSON.stringify(wrapper)
    const size = getUtf8ByteLength(payload)
    if (size > MAX_CACHE_SIZE_BYTES) {
      logWarn('[CachePersist] Wrapper exceeds size limit, skipping write', {
        size,
        limit: MAX_CACHE_SIZE_BYTES,
      })
      return
    }

    Taro.setStorageSync(getStorageKey(), payload)
    logInfo('[CachePersist] Saved to storage', {
      keys: Object.keys(wrapper.entries).length,
      sizeBytes: size,
    })
  } catch (err) {
    logWarn('[CachePersist] Failed to write cache', {
      error: err instanceof Error ? err.message : String(err),
    })
  }
}
