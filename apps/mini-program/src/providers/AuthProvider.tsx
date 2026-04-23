import { PropsWithChildren, createElement, useRef } from 'react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useDidShow } from '@tarojs/taro'
import {
  AUTH_QUERY_KEY,
  bootstrapMiniProgramAuthSession,
  isMiniProgramAuthSessionActivated,
} from '../lib/authSession'
import { queryClient } from '../lib/queryClient'

const AUTH_REFRESH_THROTTLE_MS = 3000

function AuthRefreshBridge({ children }: PropsWithChildren) {
  const client = useQueryClient()
  const hasSeenInitialShowRef = useRef(false)
  const lastRefreshAtRef = useRef(0)

  useDidShow(() => {
    if (!isMiniProgramAuthSessionActivated()) {
      return
    }

    if (!hasSeenInitialShowRef.current) {
      hasSeenInitialShowRef.current = true
      return
    }

    const authQueryState = client.getQueryState(AUTH_QUERY_KEY)
    if (authQueryState?.fetchStatus === 'fetching') {
      return
    }

    const now = Date.now()
    if (now - lastRefreshAtRef.current < AUTH_REFRESH_THROTTLE_MS) {
      return
    }

    lastRefreshAtRef.current = now
    void bootstrapMiniProgramAuthSession(client)
  })

  return <>{children}</>
}

/**
 * App-level auth/session provider for the mini-program.
 *
 * Keeps the existing React Query setup centralized and refreshes the auth query
 * when the app becomes visible again. The resume refresh is throttled so guest
 * entry pages do not flicker into loading loops in DevTools or during quick
 * foreground/background transitions, while protected pages still revalidate.
 */
export default function AuthProvider({ children }: PropsWithChildren) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(AuthRefreshBridge, null, children)
  )
}
