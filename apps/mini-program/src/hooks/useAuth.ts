import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthUserResponse } from '@shared/api'
import { apiRequest, type OnboardingStep } from '../lib/api'
import {
  AUTH_QUERY_KEY,
  bootstrapMiniProgramAuthSession,
  isMiniProgramAuthSessionActivated,
  isUnauthorizedApiError,
} from '../lib/authSession'
import { deriveMiniProgramAuthState } from './authState'

export type NextStepType = OnboardingStep

export type AuthUser = AuthUserResponse

export interface UseAuthResult {
  user: AuthUser | undefined
  isLoading: boolean
  isRefreshing: boolean
  isAuthenticated: boolean
  nextStep: NextStepType | undefined
  refetch: () => Promise<unknown>
}

async function getAuthUser(): Promise<AuthUser | null> {
  try {
    return await apiRequest<AuthUser>({ path: '/api/auth/user' })
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      return null
    }

    throw error
  }
}

/**
 * useAuth — React Query hook for persistent auth state in the mini-program.
 *
 * Mirrors the web client's useAuth() contract:
 *   - Fetches GET /api/auth/user
 *   - Returns user, isLoading, isRefreshing, isAuthenticated, nextStep
 *   - Treats 401/403 as an unauthenticated state instead of a sticky error
 *   - Lets public pages distinguish the initial auth bootstrap from a later
 *     foreground refresh while protected pages can still fail closed
 */
export function useAuth(): UseAuthResult {
  const authSessionActivated = isMiniProgramAuthSessionActivated()
  const { data: user, isLoading, isFetching, refetch } = useQuery<AuthUser | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getAuthUser,
    enabled: authSessionActivated,
    retry: (failureCount, error) => {
      if (isUnauthorizedApiError(error)) return false
      return failureCount < 2
    },
    staleTime: Infinity,
  })

  const authState = deriveMiniProgramAuthState({
    user,
    isLoading,
    isFetching,
  })

  return {
    ...authState,
    refetch,
  }
}

/**
 * Invalidate the auth query to force a fresh GET /api/auth/user on next render.
 * Useful after login, onboarding step submission, or logout.
 */
export function useInvalidateAuth() {
  const queryClient = useQueryClient()
  return () => bootstrapMiniProgramAuthSession(queryClient)
}
