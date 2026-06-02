import { useEffect, useRef, useState } from 'react'
import BoxLogoEntryScreen from '../../components/loading/BoxLogoEntryScreen'
import { useAuth } from '../../hooks/useAuth'
import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'
import { queryClient } from '../../lib/api/queryClient'
import { fetchDiscoverShell, fetchProfileShell, fetchEventsShell, fetchConnectionsShell } from '../../lib/api/api'
import { getPrefetchEngine, injectDiscoverShellIntoCache, injectProfileShellIntoCache, injectEventsShellIntoCache, injectConnectionsShellIntoCache } from '../../lib/prefetchEngine'
import MiniProgramLandingPage from './LandingPage'

export default function Index() {
  const auth = useAuth()
  const hasRedirectedRef = useRef(false)
  const [entryDone, setEntryDone] = useState(false)

  // Redirect authenticated users to their next onboarding/app step.
  useEffect(() => {
    if (auth.isLoading || !auth.isAuthenticated || hasRedirectedRef.current || !auth.user) {
      return
    }

    hasRedirectedRef.current = true
    void navigateToMiniProgramNextStep(auth.user.nextStep, { mode: 'root' }).catch(() => {
      hasRedirectedRef.current = false
    })
  }, [auth.isAuthenticated, auth.isLoading, auth.nextStep, auth.user])

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
  }, [entryDone])

  if (!entryDone) {
    return <BoxLogoEntryScreen onComplete={() => setEntryDone(true)} />
  }

  return <MiniProgramLandingPage />
}
