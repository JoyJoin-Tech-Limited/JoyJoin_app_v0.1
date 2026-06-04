import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import { View, Text } from '@tarojs/components'
import BoxLogoEntryScreen from '../../components/loading/BoxLogoEntryScreen'
import LoadingScreen from '../../components/loading/LoadingScreen'
import { useAuth } from '../../hooks/useAuth'
import { useAuthGate } from '../../hooks/useAuthGate'
import { navigateToMiniProgramNextStep } from '../../lib/onboarding/onboardingNavigation'
import { queryClient } from '../../lib/api/queryClient'
import { fetchDiscoverShell, fetchProfileShell, fetchEventsShell, fetchConnectionsShell } from '../../lib/api/api'
import { getPrefetchEngine, injectDiscoverShellIntoCache, injectProfileShellIntoCache, injectEventsShellIntoCache, injectConnectionsShellIntoCache } from '../../lib/prefetchEngine'
import MiniProgramLandingPage from './LandingPage'
import './index.scss'

export default function Index() {
  const auth = useAuth()
  const hasRedirectedRef = useRef(false)
  const [entryDone, setEntryDone] = useState(false)
  const { isTimedOut, retry, dismiss } = useAuthGate(auth)

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

  // While auth is re-validating on cold start (tryHydrateAuth + useDidShow
  // invalidation), gate the landing page behind a loading state so the user
  // cannot race the in-flight revalidation by tapping a CTA. Without this gate,
  // a tap navigates to personality-test / login, and the still-pending redirect
  // then reLaunches to nextStep — leaving the user on the wrong screen with a
  // stale 500 toast from a login attempt that was overridden.
  if (auth.isLoading) {
    return (
      <View className='index-gate'>
        <LoadingScreen message='正在准备你的悦聚…' />
        {isTimedOut ? (
          <View className='index-gate__timeout' role='alert' aria-live='polite'>
            <Text className='index-gate__timeout-text'>网络有点慢，继续等还是？</Text>
            <View className='index-gate__timeout-actions'>
              <View
                className='index-gate__timeout-btn index-gate__timeout-btn--primary'
                hoverClass='index-gate__timeout-btn--hover'
                onClick={retry}
                role='button'
                aria-label='重试验证'
              >
                <Text className='index-gate__timeout-btn-text'>重试</Text>
              </View>
              <View
                className='index-gate__timeout-btn'
                hoverClass='index-gate__timeout-btn--hover'
                onClick={dismiss}
                role='button'
                aria-label='跳过验证继续'
              >
                <Text className='index-gate__timeout-btn-text'>跳过</Text>
              </View>
            </View>
          </View>
        ) : null}
      </View>
    )
  }

  return <MiniProgramLandingPage />
}
