import { QueryClient } from '@tanstack/react-query'
import { STALE_TIME_DEFAULT_MS } from '../utils/uiConstants'

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
