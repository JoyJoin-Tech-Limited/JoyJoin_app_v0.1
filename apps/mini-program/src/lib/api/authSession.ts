import type { QueryClient } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import type { UserState } from './api'
import { clearSessionToken } from './api'
import { logError, logInfo, logWarn } from '../utils/logger'
import { MINI_PROGRAM_PAGE_PATHS, MINI_PROGRAM_ROUTES } from '../onboarding/onboardingRoutes'
import { queryClient } from './queryClient'
import { MINI_PROGRAM_USER_SCOPED_QUERY_KEY_PREFIXES } from '../auth/authSessionQueryKeys'
import {
  normalizeMiniProgramRoute,
  shouldRedirectToLoginOnUnauthorized,
} from '../auth/authSessionRules'

export const AUTH_QUERY_KEY = ['mini-program', 'auth-user'] as const

const HYDRATE_AUTH_STORAGE_KEY = 'mj_auth_cache'

export function persistAuthToStorage(user: unknown): void {
  try {
    Taro.setStorageSync(HYDRATE_AUTH_STORAGE_KEY, JSON.stringify(user))
  } catch {
    logWarn('[authStorage] Failed to persist auth data to localStorage', { key: HYDRATE_AUTH_STORAGE_KEY })
  }
}

export function clearAuthStorage(): void {
  try {
    Taro.removeStorageSync(HYDRATE_AUTH_STORAGE_KEY)
  } catch {
    logWarn('[authStorage] Failed to clear auth data from localStorage', { key: HYDRATE_AUTH_STORAGE_KEY })
  }
}

type SessionResetMode = 'soft' | 'hard'

let loginRedirectQueued = false

function getClient(client?: QueryClient): QueryClient {
  return client ?? queryClient
}

function clearMiniProgramUserScopedQueries(client: QueryClient): void {
  for (const queryKeyPrefix of MINI_PROGRAM_USER_SCOPED_QUERY_KEY_PREFIXES) {
    client.removeQueries({ queryKey: queryKeyPrefix })
  }
}

function writeAuthSession<TUser extends UserState>(
  user: TUser | null,
  client?: QueryClient,
  mode: SessionResetMode = 'soft',
): void {
  const targetClient = getClient(client)

  if (mode === 'hard') {
    targetClient.clear()
  } else if (user === null) {
    clearMiniProgramUserScopedQueries(targetClient)
  }

  targetClient.setQueryData(AUTH_QUERY_KEY, user)
}

export function bootstrapMiniProgramAuthSession(client?: QueryClient) {
  return getClient(client).invalidateQueries({ queryKey: AUTH_QUERY_KEY })
}

export function seedMiniProgramAuthSession<TUser extends UserState>(
  user: TUser,
  client?: QueryClient,
): void {
  persistAuthToStorage(user)
  writeAuthSession(user, client, 'hard')
}

export function clearMiniProgramAuthSession(options?: {
  queryClient?: QueryClient
  mode?: SessionResetMode
}): void {
  clearAuthStorage()
  writeAuthSession(null, options?.queryClient, options?.mode ?? 'soft')
}

export function getCurrentMiniProgramRoute(): string {
  const pages = Taro.getCurrentPages()
  return normalizeMiniProgramRoute(pages[pages.length - 1]?.route)
}

function queueLoginRedirect(): void {
  if (loginRedirectQueued) {
    return
  }

  loginRedirectQueued = true

  queueMicrotask(() => {
    loginRedirectQueued = false

    if (getCurrentMiniProgramRoute() === MINI_PROGRAM_PAGE_PATHS.login) {
      return
    }

    Taro.reLaunch({ url: MINI_PROGRAM_ROUTES.login })
  })
}

export function handleMiniProgramUnauthorized(options?: {
  queryClient?: QueryClient
  route?: string | null
  statusCode?: number
}): void {
  const route = normalizeMiniProgramRoute(options?.route ?? getCurrentMiniProgramRoute())
  const shouldRedirect = shouldRedirectToLoginOnUnauthorized(route)

  logWarn('[authSession] Unauthorized response received', {
    route,
    statusCode: options?.statusCode,
    shouldRedirect,
  })

  clearMiniProgramAuthSession({
    queryClient: options?.queryClient,
    mode: shouldRedirect ? 'hard' : 'soft',
  })

  clearSessionToken()

  if (!shouldRedirect) {
    return
  }

  logInfo('[authSession] Redirecting to login after auth loss', { route })
  queueLoginRedirect()
}

export function getApiErrorStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') {
    return undefined
  }

  const statusCode = (error as { statusCode?: unknown }).statusCode
  return typeof statusCode === 'number' ? statusCode : undefined
}

export function isUnauthorizedApiError(error: unknown): boolean {
  const statusCode = getApiErrorStatusCode(error)
  return statusCode === 401 || statusCode === 403
}

export function isTransportApiError(error: unknown): boolean {
  if (!error || typeof error !== 'object') {
    return false
  }
  return (error as { isTransportError?: unknown }).isTransportError === true
}
