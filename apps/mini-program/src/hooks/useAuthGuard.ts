import { useEffect } from 'react'
import Taro from '@tarojs/taro'
import { useAuth, type NextStepType } from './useAuth'

/**
 * Map a server-driven nextStep to the corresponding mini-program page route.
 */
export function nextStepToRoute(step: NextStepType): string {
  switch (step) {
    case 'onboarding':
      return '/pages/onboarding/onboarding/index'
    case 'personality-test':
      return '/pages/onboarding/personality-test/index'
    case 'essential-data':
      return '/pages/onboarding/essential-data/index'
    case 'extended-data':
      return '/pages/onboarding/extended-data/index'
    case 'profile-review':
      return '/pages/onboarding/profile-review/index'
    case 'discover':
      return '/pages/discover/index'
    case 'guide':
    default:
      return '/pages/discover/index'
  }
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
export function useAuthGuard() {
  const auth = useAuth()

  useEffect(() => {
    if (auth.isLoading) return

    if (!auth.isAuthenticated) {
      Taro.reLaunch({ url: '/pages/login/index' })
      return
    }

    // For onboarding pages, verify the user belongs on this page
    const pages = Taro.getCurrentPages()
    const currentRoute = pages[pages.length - 1]?.route ?? ''

    if (ONBOARDING_ROUTES.has(currentRoute) && auth.nextStep) {
      const expectedRoute = nextStepToRoute(auth.nextStep)
      // Strip leading slash for comparison since currentRoute doesn't have one
      const expectedRouteBare = expectedRoute.replace(/^\//, '')

      // If user is done with onboarding but on an onboarding page, send to discover
      if (auth.nextStep === 'discover' || auth.nextStep === 'guide') {
        Taro.switchTab({ url: '/pages/discover/index' })
        return
      }

      if (currentRoute !== expectedRouteBare) {
        Taro.redirectTo({ url: expectedRoute })
      }
    }
  }, [auth.isLoading, auth.isAuthenticated, auth.nextStep])

  return auth
}
