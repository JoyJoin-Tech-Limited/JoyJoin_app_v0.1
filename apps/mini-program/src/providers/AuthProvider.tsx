import { PropsWithChildren, createElement } from 'react'
import { QueryClientProvider, useQueryClient } from '@tanstack/react-query'
import { useDidShow } from '@tarojs/taro'
import { bootstrapMiniProgramAuthSession } from '../lib/api/authSession'
import { queryClient } from '../lib/api/queryClient'

function AuthRefreshBridge({ children }: PropsWithChildren) {
  const client = useQueryClient()

  useDidShow(() => {
    void bootstrapMiniProgramAuthSession(client)
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
