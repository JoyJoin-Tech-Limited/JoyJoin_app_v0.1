import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuth, type NextStepType } from './useAuth'
import { navigateToMiniProgramNextStep } from '../lib/onboardingNavigation'
import { MINI_PROGRAM_ROUTES, nextStepToMiniProgramRoute } from '../lib/onboardingRoutes'

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
  const isGuardLoading = auth.isLoading || auth.isRefreshing

  useEffect(() => {
    if (isGuardLoading) return

    if (!auth.isAuthenticated) {
      Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.login })
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

      // If user is done with onboarding but on an onboarding page, send to discover
      if (auth.nextStep === 'discover' || auth.nextStep === 'guide') {
        Taro.switchTab({ url: MINI_PROGRAM_ROUTES.discover })
        return
      }

      if (currentRoute !== expectedRouteBare) {
        void navigateToMiniProgramNextStep(auth.nextStep, { mode: 'replace' })
      }
    }
  }, [auth.isAuthenticated, auth.nextStep, isGuardLoading, options?.suspendOnboardingRedirect])

  return {
    ...auth,
    isLoading: isGuardLoading,
  }
}
