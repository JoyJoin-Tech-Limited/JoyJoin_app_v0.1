import { useQuery, useQueryClient } from '@tanstack/react-query'
import { apiRequest, type UserState, type OnboardingStep } from '../lib/api'

export type NextStepType = OnboardingStep

/**
 * Auth user state returned by GET /api/auth/user, extended with helper fields.
 */
export interface AuthUser extends UserState {
  profileEssentialComplete?: boolean
  profileExtendedComplete?: boolean
  hasCompletedPersonalityTest?: boolean
  hasCompletedInterestsCarousel?: boolean
  hasSeenProfileReview?: boolean
  activeAssessmentSessionId?: string | null
  paymentsEnabled?: boolean
  displayName?: string
  nickname?: string
  archetype?: string
  gender?: string
  birthYear?: number
}

export interface UseAuthResult {
  user: AuthUser | undefined
  isLoading: boolean
  isAuthenticated: boolean
  nextStep: NextStepType | undefined
  refetch: () => Promise<unknown>
}

export const AUTH_QUERY_KEY = ['mini-program', 'auth-user'] as const

/**
 * useAuth — React Query hook for persistent auth state in the mini-program.
 *
 * Mirrors the web client's useAuth() contract:
 *   - Fetches GET /api/auth/user
 *   - Returns user, isLoading, isAuthenticated, nextStep
 *   - Does NOT retry on 401/403 (treats as unauthenticated)
 */
export function useAuth(): UseAuthResult {
  const { data: user, isLoading, isError, refetch } = useQuery<AuthUser>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: () => apiRequest<AuthUser>({ path: '/api/auth/user' }),
    retry: (failureCount, error: any) => {
      if (error?.statusCode === 401 || error?.statusCode === 403) return false
      return failureCount < 2
    },
    staleTime: Infinity,
  })

  const isAuthenticated = !!user && !isError
  const actualIsLoading = isLoading && !isError

  return {
    user: isError ? undefined : user,
    isLoading: actualIsLoading,
    isAuthenticated,
    nextStep: user?.nextStep,
    refetch,
  }
}

/**
 * Invalidate the auth query to force a fresh GET /api/auth/user on next render.
 * Useful after login, onboarding step submission, or logout.
 */
export function useInvalidateAuth() {
  const queryClient = useQueryClient()
  return () => queryClient.invalidateQueries({ queryKey: AUTH_QUERY_KEY })
}
