import { useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
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
import { preloadRouteAssets, preloadPredictiveAssets } from '../../lib/utils/routePreloadAssets'
import MiniProgramLandingPage from './LandingPage'
import './index.scss'

/** Steps that mean the user is still in the onboarding flow. */
const ONBOARDING_STEPS: readonly string[] = [
  'onboarding',
  'personality-test',
  'essential-data',
  'extended-data',
  'profile-review',
]

function shouldShowWelcomeBack(user: NonNullable<ReturnType<typeof useAuth>['user']>): boolean {
  const hasRestarts = (user.restartsRemaining ?? 0) > 0
  const isFeatureEnabled = user.features?.restartOnboarding === true
  const isMidOnboarding = ONBOARDING_STEPS.includes(user.nextStep ?? '')
  const alreadySeen = (() => {
    try {
      return Taro.getStorageSync('joyjoin_welcome_back_seen') != null
    } catch {
      return false
    }
  })()

  return isMidOnboarding && isFeatureEnabled && hasRestarts && !alreadySeen
}

/**
 * Timeout for the launch-level network check. If the check takes longer than
 * this, treat as online (fail-open) so the redirect effect doesn't stall.
 * WeChat's Taro.getNetworkType usually resolves within 50ms, so this is a
 * safety ceiling for edge cases (old devices, OS throttling, etc.).
 */
const LAUNCH_NETWORK_CHECK_TIMEOUT_MS = 2_000

export default function Index() {
  const auth = useAuth()
  const hasRedirectedRef = useRef(false)
  const [entryDone, setEntryDone] = useState(false)
  const [launchOffline, setLaunchOffline] = useState<boolean | null>(null)
  const { isTimedOut, isOffline, retry, dismiss, isLoading: isGateChecking } = useAuthGate(auth)

  // Unified redirect: authenticated users go to nextStep; guests with an
  // incomplete anonymous assessment go back to the personality test.
  // A single effect prevents race conditions between the two paths.
  // Preload personality test assets immediately — the landing page's primary
  // CTA leads directly to the personality test intro, so warming the intro
  // animated WebP + mascot expressions here eliminates any decode delay.
  useEffect(() => {
    preloadRouteAssets('pages/index/index')
    preloadPredictiveAssets('pages/index/index')
  }, [])

  useEffect(() => {
    // Network gate: wait for launch-level check before deciding redirect so
    // a cached user isn't sent to nextStep before we know connectivity state.
    // The authenticated path has its own network check below, but the guest
    // restore path would fire unchecked.
    if (auth.isLoading || hasRedirectedRef.current || launchOffline === null) {
      return
    }

    // Authenticated path takes priority over guest restore.
    if (auth.isAuthenticated && auth.user) {
      // Network gate: if completely offline, stay on landing page so the
      // offline banner renders instead of a dead loading screen after
      // redirect. This prevents cached users from being silently dumped
      // into discover/onboarding with no network.
      if (typeof Taro.getNetworkType !== 'function') {
        doAuthenticatedRedirect(auth.user!)
      } else {
        Taro.getNetworkType().then(({ networkType }) => {
          if (networkType === 'none' || hasRedirectedRef.current) return
          doAuthenticatedRedirect(auth.user!)
        }).catch(() => {
          if (hasRedirectedRef.current) return
          // Fail open — network type unknown, proceed with redirect.
          doAuthenticatedRedirect(auth.user!)
        })
      }
      return
    }

    // Guest restore: only if unauthenticated and has an incomplete session.
    // Skip when offline — redirecting would dump the user into a personality
    // test that can't load any questions.
    if (launchOffline === true) {
      return
    }

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
  }, [auth.isAuthenticated, auth.isLoading, auth.user, launchOffline])

  /** Perform authenticated redirect with all guards applied. Extracted so
      the network check above can share it between success and fail-open paths. */
  function doAuthenticatedRedirect(user: NonNullable<typeof auth.user>): void {
    hasRedirectedRef.current = true

    if (shouldShowWelcomeBack(user)) {
      logInfo('[Index] Redirecting returning user to welcome-back screen', {
        nextStep: user.nextStep,
        restartsRemaining: user.restartsRemaining,
      })
      void Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.welcomeBack }).catch((err) => {
        logWarn('[Index] Redirect to welcome-back failed; falling back to nextStep', {
          nextStep: user?.nextStep,
          error: err instanceof Error ? err.message : String(err),
        })
        void navigateToMiniProgramNextStep(user?.nextStep, { mode: 'root' }).catch(
          (fallbackErr) => {
            logWarn('[Index] Fallback redirect to nextStep also failed', {
              nextStep: user?.nextStep,
              error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
            })
          },
        )
      })
      return
    }

    logInfo('[Index] Skipping welcome-back (already seen or not eligible)', {
      nextStep: user.nextStep,
      restartsRemaining: user.restartsRemaining,
      featureEnabled: user.features?.restartOnboarding,
    })

    logInfo('[Index] Redirecting authenticated user to nextStep', { nextStep: user.nextStep })
    void navigateToMiniProgramNextStep(user.nextStep, { mode: 'root' }).catch((err) => {
      hasRedirectedRef.current = false
      logWarn('[Index] Redirect to nextStep failed', {
        nextStep: user?.nextStep,
        error: err instanceof Error ? err.message : String(err),
      })
    })
  }

  // Launch-level network check. Runs independently from the auth-gate check
  // so offline feedback appears during the BoxLogoEntryScreen animation rather
  // than only after it completes and LandingPage mounts.
  useEffect(() => {
    if (typeof Taro.getNetworkType !== 'function') {
      setLaunchOffline(false)
      return
    }

    const timer = setTimeout(() => {
      // Fail-open: if the native API hangs, assume online.
      setLaunchOffline(false)
    }, LAUNCH_NETWORK_CHECK_TIMEOUT_MS)

    Taro.getNetworkType().then((res) => {
      clearTimeout(timer)
      setLaunchOffline(res.networkType === 'none')
    }).catch(() => {
      clearTimeout(timer)
      setLaunchOffline(false)
    })

    return () => clearTimeout(timer)
  }, [])

  // Derived offline state: combines auth-gate offline detection with
  // launch-level detection. Either layer being offline = combined offline.
  const combinedOffline = isOffline || launchOffline === true

  // -- BoxLogoEntryScreen props --
  // When launchLevel check is still in-flight (null), show status text.
  // When the check resolves to offline, abort the entry animation early.
  const abortEntry = launchOffline === true
  const entryStatusText = launchOffline === null ? '正在检查网络…' : undefined

  // Wrapped retry that re-checks launch-level network state in addition to
  // the auth-gate retry, keeping both layers in sync.
  const handleRetry = () => {
    retry()
    if (typeof Taro.getNetworkType !== 'function') {
      setLaunchOffline(false)
      return
    }
    Taro.getNetworkType().then((res) => {
      setLaunchOffline(res.networkType === 'none')
    }).catch(() => {
      setLaunchOffline(false)
    })
  }

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
    return (
      <BoxLogoEntryScreen
        onComplete={() => setEntryDone(true)}
        abort={abortEntry}
        statusText={entryStatusText}
      />
    )
  }

  // Auth gate is now expressed as an invisible functional lock on LandingPage
  // CTAs (pointer-events: none + disabled buttons). No visual loading screen.
  // The timeout banner renders inline on LandingPage if auth revalidation
  // exceeds INDEX_GATE_TIMEOUT_MS (4s).
  return (
    <MiniProgramLandingPage
      isAuthLoading={isGateChecking}
      isAuthTimedOut={isTimedOut}
      isOffline={combinedOffline}
      onAuthRetry={handleRetry}
      onAuthDismiss={dismiss}
      userNextStep={auth.user?.nextStep ?? null}
    />
  )
}
