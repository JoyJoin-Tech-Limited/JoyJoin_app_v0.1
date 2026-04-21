import { createElement, useCallback, type ReactElement } from 'react'
import LoadingScreen from '../components/LoadingScreen'
import { useAuthGuard } from './useAuthGuard'
import type { AuthUser } from './useAuth'

interface UseMiniPageGateOptions {
  suspendOnboardingRedirect?: boolean
}

interface UseMiniPageGateResult {
  authLoading: boolean
  authUser: AuthUser | undefined
  renderGate: (content: ReactElement, loadingMessage?: string) => ReactElement
}

export function useMiniPageGate(
  options?: UseMiniPageGateOptions,
): UseMiniPageGateResult {
  const { isLoading: authLoading, user: authUser } = useAuthGuard(options)

  const renderGate = useCallback(
    (content: ReactElement, loadingMessage = '加载中…'): ReactElement => {
      if (authLoading) {
        return createElement(LoadingScreen, { message: loadingMessage })
      }

      return content
    },
    [authLoading],
  )

  return {
    authLoading,
    authUser,
    renderGate,
  }
}