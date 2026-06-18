import { PropsWithChildren, createElement, useEffect } from 'react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useDidShow } from '@tarojs/taro'
import { bootstrapMiniProgramAuthSession } from '../lib/api/authSession'
import { queryClient } from '../lib/api/queryClient'
import { logInfo, logWarn } from '../lib/utils/logger'
import { authAnalytics } from '../lib/analytics/authAnalytics'

function AuthRefreshBridge({ children }: PropsWithChildren) {
  const client = useQueryClient()

  // One-time background revalidation on app launch. useAuth now hydrates from
  // storage, so this fetches without blocking the UI.
  useEffect(() => {
    void bootstrapMiniProgramAuthSession(client)
  }, [client])

  useDidShow(() => {
    const startedAt = Date.now()
    logInfo('[Auth] Revalidation started (app foreground)')
    authAnalytics.track('auth_revalidation_started')
    void bootstrapMiniProgramAuthSession(client)
      .then(() => {
        const durationMs = Date.now() - startedAt
        logInfo('[Auth] Revalidation succeeded', { durationMs })
        authAnalytics.track('auth_revalidation_succeeded', { durationMs })
      })
      .catch((err: unknown) => {
        const durationMs = Date.now() - startedAt
        logWarn('[Auth] Revalidation failed', {
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        })
        authAnalytics.track('auth_revalidation_failed', {
          durationMs,
          error: err instanceof Error ? err.message : String(err),
        })
      })
  })

  return <>{children}</>
}

/**
 * App-level auth/session provider for the mini-program.
 *
 * Keeps the existing React Query setup centralized and refreshes the auth query
 * when the app becomes visible again. `useAuth()` treats that foreground
 * revalidation as loading so protected pages fail closed until the session is
 * confirmed.
 */
export default function AuthProvider({ children }: PropsWithChildren) {
  return createElement(
    QueryClientProvider,
    { client: queryClient },
    createElement(AuthRefreshBridge, null, children)
  )
}
