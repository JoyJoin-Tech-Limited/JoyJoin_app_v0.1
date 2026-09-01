import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuth, type NextStepType } from './useAuth'
import { navigateToMiniProgramNextStep } from '../lib/onboarding/onboardingNavigation'
import { MINI_PROGRAM_ROUTES, nextStepToMiniProgramRoute } from '../lib/onboarding/onboardingRoutes'
import { capturePendingDuoContext } from '../lib/duo/duoContext'

/**
 * Map a server-driven nextStep to the corresponding mini-program page route.
 */
export function nextStepToRoute(step: NextStepType): string {
  return nextStepToMiniProgramRoute(step)
}

/**
 * The set of mini-program page routes that make up the onboarding flow.
 * Used by useAuthGuard to detect whether a page is an onboarding page.
 */
const ONBOARDING_STEPS: NextStepType[] = [
  'onboarding',
  'personality-test',
  'essential-data',
  'extended-data',
  'profile-review',
]

const ONBOARDING_ROUTES = new Set(
  ONBOARDING_STEPS.map((step) => nextStepToRoute(step).replace(/^\//, ''))
)

/**
 * useAuthGuard — redirect to login if not authenticated.
 *
 * For onboarding pages, also validates the user's nextStep matches
 * the current page and redirects to the correct onboarding step if not.
 *
 * Usage: call at the top of any page that requires authentication.
 *
 * @returns { user, isLoading, isAuthenticated } from useAuth
 */
export function useAuthGuard(options?: {
  suspendOnboardingRedirect?: boolean
}) {
  const auth = useAuth()

  useEffect(() => {
    if (auth.isLoading) return

    if (!auth.isAuthenticated) {
      // Cold-start invite fix (spec §G.2): reLaunch drops the current page's
      // query string, so capture the invite context into storage first (it is
      // replayed after login/onboarding via navigateToMiniProgramNextStep) and
      // forward invitationCode to the landing's loggedOut state for referral
      // attribution.
      const currentPages = Taro.getCurrentPages()
      const currentOptions = (currentPages[currentPages.length - 1] as { options?: Record<string, string> } | undefined)?.options ?? {}
      capturePendingDuoContext({
        poolId: currentOptions.id,
        invitationCode: currentOptions.invitationCode,
        duo: currentOptions.duo === '1',
      })
      const loginQuery = currentOptions.invitationCode
        ? `&invitationCode=${encodeURIComponent(currentOptions.invitationCode)}`
        : ''
      Taro.reLaunch({ url: `${MINI_PROGRAM_ROUTES.index}?auth=expired${loginQuery}` })
      return
    }

    // For onboarding pages, verify the user belongs on this page
    const pages = Taro.getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route ?? ''
    const isOnboardingRoute = ONBOARDING_ROUTES.has(currentRoute)

    if (isOnboardingRoute && options?.suspendOnboardingRedirect) {
      return
    }

    if (isOnboardingRoute) {
      // If nextStep is undefined, user has completed onboarding but is stranded
      // on an onboarding page — redirect to discover
      if (!auth.nextStep) {
        Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover })
        return
      }

      const expectedRoute = nextStepToRoute(auth.nextStep)
      // Strip leading slash for comparison since currentRoute doesn't have one
      const expectedRouteBare = expectedRoute.replace(/^\//, '')

      // If user is done with onboarding but on an onboarding page, send to
      // discover — routed through the shared helper so a pending duo/invite
      // context replays to pool-registration instead (spec §C.4-3).
      if (auth.nextStep === 'discover') {
        void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'root' })
        return
      }

      if (currentRoute !== expectedRouteBare) {
        void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'replace' })
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.nextStep, options?.suspendOnboardingRedirect])

  return auth
}
