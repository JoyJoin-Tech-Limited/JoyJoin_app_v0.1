import { QueryClient } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import { STALE_TIME_DEFAULT_MS } from '../utils/uiConstants'
import { logWarn } from '../utils/logger'
import { tryHydratePersistentCache, subscribeToPersistentCache } from './persistentCache'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: STALE_TIME_DEFAULT_MS,
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: false,
    },
  },
})

const HYDRATE_AUTH_STORAGE_KEY = 'mj_auth_cache'

function tryHydrateAuth(): void {
  try {
    const raw = Taro.getStorageSync(HYDRATE_AUTH_STORAGE_KEY)
    if (raw) {
      const user = JSON.parse(raw)
      if (user && typeof user === 'object') {
        queryClient.setQueryData(['mini-program', 'auth-user'], user)
      }
    }
  } catch {
    logWarn('[authHydrate] Failed to hydrate auth from localStorage', { key: HYDRATE_AUTH_STORAGE_KEY })
  }
}

tryHydrateAuth()
tryHydratePersistentCache(queryClient)
subscribeToPersistentCache(queryClient)
