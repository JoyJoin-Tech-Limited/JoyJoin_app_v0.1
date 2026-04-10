import { PropsWithChildren, createElement } from 'react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useDidShow } from '@tarojs/taro'
import { queryClient } from '../lib/queryClient'
import { AUTH_QUERY_KEY } from '../hooks/useAuth'

function AuthRefreshBridge({ children }: PropsWithChildren) {
  const client = useQueryClient()

  useDidShow(() => {
    void client.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
  })

  return <>{children}</>
}

/**
 * App-level auth/session provider for the mini-program.
 *
 * Keeps the existing React Query setup centralized and refreshes the auth query
 * when the app becomes visible again so protected pages fail closed.
 */
export default function AuthProvider({ children }: PropsWithChildren) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(AuthRefreshBridge, null, children)
  )
}
