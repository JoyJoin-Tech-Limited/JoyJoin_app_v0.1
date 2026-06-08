import { useQuery, useQueryClient } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import type { AuthUserResponse } from '@shared/api'
import { apiRequest, type OnboardingStep, type ApiError } from '../lib/api/api'
import {
  AUTH_QUERY_KEY,
  bootstrapMiniProgramAuthSession,
  clearAuthStorage,
  isTransportApiError,
  isUnauthorizedApiError,
  persistAuthToStorage,
} from '../lib/api/authSession'
import { logWarn } from '../lib/utils/logger'
import { deriveMiniProgramAuthState } from './auth/authState'

const MOCK_AUTH_STORAGE_KEY = '__jj_mock_auth_for_devtools__'

const MOCK_AUTH_USER: AuthUser = {
  id: 'dev-test-user',
  displayName: '悦仔测试',
  archetype: 'corgi',
  primaryArchetype: 'corgi',
  nextStep: 'discover',
  hasCompletedOnboarding: true,
} as unknown as AuthUser

function getMockAuthUser(): AuthUser | null {
  try {
    const raw = Taro.getStorageSync(MOCK_AUTH_STORAGE_KEY)
    if (raw === '1') return MOCK_AUTH_USER
    if (!raw) return null
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw
    if (parsed && parsed.id) return parsed as AuthUser
  } catch {
    // ignore
  }
  return null
}

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
    authPromise.catch((err) => {
      // Timeout may have already settled the race, but log the late rejection
      // so ops can diagnose when the server is both slow AND erroring.
      logWarn('[useAuth] Auth request settled after timeout', {
        error: err instanceof Error ? err.message : String(err),
        statusCode: (err as ApiError)?.statusCode,
      })
    })

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
  const mockUser = getMockAuthUser()

  const { data: user, isLoading, isFetching, refetch } = useQuery<AuthUser | null>({
    queryKey: AUTH_QUERY_KEY,
    queryFn: getAuthUser,
    retry: (failureCount, error) => {
      if (isUnauthorizedApiError(error)) return false
      if (isTransportApiError(error)) return false
      return failureCount < 2
    },
    staleTime: Infinity,
    initialData: mockUser ?? undefined,
  })

  const effectiveUser = mockUser ?? user

  const authState = deriveMiniProgramAuthState({
    user: effectiveUser,
    isLoading: mockUser ? false : isLoading,
    isFetching: mockUser ? false : isFetching,
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
