import { createElement, useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { useAuthGuard } from '../useAuthGuard'
import { useLoadingOrchestrator } from '../useLoadingOrchestrator'
import type { AuthUser } from '../useAuth'

const MINI_PAGE_GATE_TIMEOUT_MS = 4000

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
  const [forceReleased, setForceReleased] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Safety net: if auth loading hangs (e.g., request never resolves after
  // background→foreground), force-release the gate after a ceiling so the
  // user isn't trapped on "悦仔正在赶来…" forever.
  useEffect(() => {
    if (authLoading && !forceReleased) {
      timerRef.current = setTimeout(() => {
        setForceReleased(true)
      }, MINI_PAGE_GATE_TIMEOUT_MS)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [authLoading, forceReleased])

  // Reset force-release when auth settles so the next loading spell is gated
  useEffect(() => {
    if (!authLoading && forceReleased) {
      setForceReleased(false)
    }
  }, [authLoading, forceReleased])

  const gated = shouldShow && !forceReleased

  const renderGate = useCallback(
    (content: ReactElement, loadingMessage = `${DEFAULT_MASCOT_DISPLAY_NAME}正在赶来…`): ReactElement => {
      if (gated) {
        return createElement(LoadingScreen, { message: loadingMessage })
      }

      return content
    },
    [gated],
  )

  return {
    authLoading,
    authUser,
    renderGate,
  }
}