import { createElement, useCallback, type ReactElement } from 'react'
import LoadingScreen from '../components/LoadingScreen'
import { useAuthGuard } from './useAuthGuard'
import { useLoadingOrchestrator } from './useLoadingOrchestrator'
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
  const { shouldShow } = useLoadingOrchestrator(authLoading)

  const renderGate = useCallback(
    (content: ReactElement, loadingMessage = '小悦正在赶来…'): ReactElement => {
      if (shouldShow) {
        return createElement(LoadingScreen, { message: loadingMessage })
      }

      return content
    },
    [shouldShow],
  )

  return {
    authLoading,
    authUser,
    renderGate,
  }
}