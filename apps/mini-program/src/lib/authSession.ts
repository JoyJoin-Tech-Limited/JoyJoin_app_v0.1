import type { QueryClient } from '@tanstack/react-query'
import Taro from '@tarojs/taro'
import type { UserState } from './api'
import { logInfo, logWarn } from './logger'
import { MINI_PROGRAM_PAGE_PATHS, MINI_PROGRAM_ROUTES } from './onboardingRoutes'
import { queryClient } from './queryClient'
import { MINI_PROGRAM_USER_SCOPED_QUERY_KEY_PREFIXES } from './authSessionQueryKeys'
import {
  normalizeMiniProgramRoute,
  shouldRedirectToLoginOnUnauthorized,
} from './authSessionRules'

export const AUTH_QUERY_KEY = ['mini-program', 'auth-user'] as const

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

function writeAuthSession(
  user: (UserState & Record<string, unknown>) | null,
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

export function seedMiniProgramAuthSession(
  user: UserState & Record<string, unknown>,
  client?: QueryClient,
): void {
  writeAuthSession(user, client, 'hard')
}

export function clearMiniProgramAuthSession(options?: {
  queryClient?: QueryClient
  mode?: SessionResetMode
}): void {
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
