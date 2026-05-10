import { useQuery, useQueryClient } from '@tanstack/react-query'
import type { AuthUserResponse } from '@shared/api'
import { apiRequest, type OnboardingStep } from '../lib/api/api'
import {
  AUTH_QUERY_KEY,
  bootstrapMiniProgramAuthSession,
  clearAuthStorage,
  isTransportApiError,
  isUnauthorizedApiError,
  persistAuthToStorage,
} from '../lib/api/authSession'
import { deriveMiniProgramAuthState } from './auth/authState'

export type NextStepType = OnboardingStep

export type AuthUser = AuthUserResponse

export interface UseAuthResult {
  user: AuthUser | undefined
  isLoading: boolean
  isAuthenticated: boolean
  nextStep: NextStepType | undefined
  refetch: () => Promise<unknown>
}

const AUTH_REQUEST_TIMEOUT_MS = 8000

async function getAuthUser(): Promise<AuthUser | null> {
  try {
    const authPromise = apiRequest<AuthUser>({ path: '/api/auth/user', handleUnauthorized: false })
    authPromise.catch(() => { /* swallowed — timeout may have already settled the race */ })

    const timeoutPromise = new Promise<never>((_, reject) => {
      setTimeout(() => {
        const err = new Error('auth-request-timeout') as any
        err.isTransportError = true
        reject(err)
      }, AUTH_REQUEST_TIMEOUT_MS)
    })

    const result = await Promise.race([authPromise, timeoutPromise])

    if (result) {
      persistAuthToStorage(result)
    }

    return result
  } catch (error) {
    if (isUnauthorizedApiError(error)) {
      clearAuthStorage()
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
 *   - Returns user, isLoading, isAuthenticated, nextStep
 *   - Treats 401/403 as an unauthenticated state instead of a sticky error
 *   - Fails closed while an auth refresh is in flight so protected pages do not
 *     trust stale cached auth state on foreground resume
 */
export function useAuth(): UseAuthResult {
  const { data: user, isLoading, isFetching, refetch } = useQuery<AuthUser | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getAuthUser,
    retry: (failureCount, error) => {
      if (isUnauthorizedApiError(error)) return false
      if (isTransportApiError(error)) return false
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
