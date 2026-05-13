import { MINI_PROGRAM_PAGE_PATHS } from '../onboarding/onboardingRoutes'

export const MINI_PROGRAM_PUBLIC_AUTH_ROUTES = new Set<string>([
  MINI_PROGRAM_PAGE_PATHS.discover,
  MINI_PROGRAM_PAGE_PATHS.index,
  MINI_PROGRAM_PAGE_PATHS.login,
  MINI_PROGRAM_PAGE_PATHS.personalityTest,
  MINI_PROGRAM_PAGE_PATHS.personalityTestResults,

  MINI_PROGRAM_PAGE_PATHS.terms,
])

export function normalizeMiniProgramRoute(route?: string | null): string {
  return String(route ?? '').replace(/^\//, '').split('?')[0]
}

export function isPublicMiniProgramAuthRoute(route?: string | null): boolean {
  return MINI_PROGRAM_PUBLIC_AUTH_ROUTES.has(normalizeMiniProgramRoute(route))
}

export function shouldRedirectToLoginOnUnauthorized(route?: string | null): boolean {
  const normalizedRoute = normalizeMiniProgramRoute(route)

  if (!normalizedRoute) {
    return false
  }

  return !isPublicMiniProgramAuthRoute(normalizedRoute)
}
