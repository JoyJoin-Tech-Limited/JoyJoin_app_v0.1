import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import BoxLogoEntryScreen from '../../components/loading/BoxLogoEntryScreen'
import { useAuth } from '../../hooks/useAuth'
import { useAuthGate } from '../../hooks/useAuthGate'
import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboarding/onboardingRoutes'
import { queryClient } from '../../lib/api/queryClient'
import { fetchDiscoverShell, fetchProfileShell, fetchEventsShell, fetchConnectionsShell } from '../../lib/api/api'
import { getPrefetchEngine, injectDiscoverShellIntoCache, injectProfileShellIntoCache, injectEventsShellIntoCache, injectConnectionsShellIntoCache } from '../../lib/prefetchEngine'
import {
  readAnonymousAssessmentSession,
  isAnonymousAssessmentSessionCompleted,
} from '../../lib/auth/anonymousOnboarding'
import { logInfo, logWarn } from '../../lib/utils/logger'
import MiniProgramLandingPage from './LandingPage'
import './index.scss'

export default function Index() {
  const auth = useAuth()
  const hasRedirectedRef = useRef(false)
  const [entryDone, setEntryDone] = useState(false)
  const { isTimedOut, retry, dismiss } = useAuthGate(auth)

  // Unified redirect: authenticated users go to nextStep; guests with an
  // incomplete anonymous assessment go back to the personality test.
  // A single effect prevents race conditions between the two paths.
  useEffect(() => {
    if (auth.isLoading || hasRedirectedRef.current) {
      return
    }

    // Authenticated path takes priority over guest restore.
    if (auth.isAuthenticated && auth.user) {
      hasRedirectedRef.current = true
      logInfo('[Index] Redirecting authenticated user to nextStep', { nextStep: auth.user.nextStep })
      void navigateToMiniProgramNextStep(auth.user.nextStep, { mode: 'root' }).catch((err) => {
        hasRedirectedRef.current = false
        logWarn('[Index] Redirect to nextStep failed', {
          nextStep: auth.user?.nextStep,
          error: err instanceof Error ? err.message : String(err),
        })
      })
      return
    }

    // Guest restore: only if unauthenticated and has an incomplete session.
    const snapshot = readAnonymousAssessmentSession()
    if (!snapshot || isAnonymousAssessmentSessionCompleted(snapshot)) {
      return
    }

    // Re-verify auth hasn't flipped before committing to navigation.
    if (auth.isAuthenticated) {
      return
    }

    hasRedirectedRef.current = true
    logInfo('[Index] Restoring guest to incomplete personality-test session', {
      sessionId: snapshot.sessionId,
      answered: snapshot.result?.totalQuestionsAnswered ?? 0,
    })
    void Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.personalityTest }).catch((err) => {
      hasRedirectedRef.current = false
      logWarn('[Index] Guest restore to personality-test failed', {
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }, [auth.isAuthenticated, auth.isLoading, auth.user])

  // Stage Discover prefetch 1.5 s after entry animation completes (AC-06).
  // The composite endpoint warms cache for all 3 Discover query keys so the
  // screen renders instantly when navigated to, with ≤1 network request.
  useEffect(() => {
    if (!entryDone) return

    const engine = getPrefetchEngine(queryClient)
    engine.stage('discover', async () => {
      const shell = await fetchDiscoverShell()
      injectDiscoverShellIntoCache(queryClient, shell)
    })
    // Stage Profile prefetch 4 s after entry (AC-06).
    engine.stage('profile', async () => {
      const shell = await fetchProfileShell()
      injectProfileShellIntoCache(queryClient, shell)
    }, 4000)
    // Stage Events prefetch 3 s after entry (AC-06).
    engine.stage('events', async () => {
      const shell = await fetchEventsShell()
      injectEventsShellIntoCache(queryClient, shell)
    }, 3000)
    // Stage Connections prefetch 5 s after entry (AC-06).
    engine.stage('connections', async () => {
      const shell = await fetchConnectionsShell()
      injectConnectionsShellIntoCache(queryClient, shell)
    }, 5000)

    return () => {
      // Cancel any pending prefetches if the user is redirected before
      // the staged delays elapse (e.g., auto-login redirect).
      engine.clear()
    }
  }, [entryDone])

  if (!entryDone) {
    return <BoxLogoEntryScreen onComplete={() => setEntryDone(true)} />
  }

  // Auth gate is now expressed as an invisible functional lock on LandingPage
  // CTAs (pointer-events: none + disabled buttons). No visual loading screen.
  // The timeout banner renders inline on LandingPage if auth revalidation
  // exceeds INDEX_GATE_TIMEOUT_MS (4s).
  return (
    <MiniProgramLandingPage
      isAuthLoading={auth.isLoading}
      isAuthTimedOut={isTimedOut}
      onAuthRetry={retry}
      onAuthDismiss={dismiss}
    />
  )
}
