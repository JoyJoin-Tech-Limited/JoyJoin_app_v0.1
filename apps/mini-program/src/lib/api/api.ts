import Taro from '@tarojs/taro'
import type { AuthUserResponse, DiscoverShellResponse, ProfileShellResponse, EventsShellResponse, ConnectionsShellResponse } from '@shared/api'
import { handleMiniProgramUnauthorized } from './authSession'

const DEFAULT_MINI_PROGRAM_API_BASE_URL = 'http://localhost:5001'
const API_BASE_URL = (process.env.TARO_APP_API_BASE_URL ?? DEFAULT_MINI_PROGRAM_API_BASE_URL).replace(/\/$/, '')
// Keep requests responsive on mobile networks while still allowing payment and
// auth calls enough time to complete under normal latency.
const REQUEST_TIMEOUT_MS =
  process.env.NODE_ENV === 'development' ? 5000 : 15000

export interface ApiError extends Error {
  statusCode?: number
  data?: unknown
  isGenericMessage?: boolean
  isTransportError?: boolean
  requestUrl?: string
  debugMessage?: string
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

const SESSION_TOKEN_STORAGE_KEY = 'mj_session_token'

function getSessionToken(): string | null {
  try {
    return Taro.getStorageSync(SESSION_TOKEN_STORAGE_KEY) ?? null
  } catch {
    return null
  }
}

function setSessionToken(token: string): void {
  try {
    Taro.setStorageSync(SESSION_TOKEN_STORAGE_KEY, token)
  } catch {
    // Non-fatal: next request will get a 401 and re-login
  }
}

export function clearSessionToken(): void {
  try {
    Taro.removeStorageSync(SESSION_TOKEN_STORAGE_KEY)
  } catch {
    // Best-effort cleanup
  }
}

export interface ImportedMiniProgramAssessmentAnswer {
  questionId: string
  selectedOption: string
  traitScores?: Record<string, number>
  answeredAt?: string
}

export const DEFAULT_API_ERROR_PREFIX = 'Request failed with status'

function getApiErrorDetails(statusCode: number, data: unknown): {
  message: string
  isGenericMessage: boolean
} {
  if (typeof data === 'object' && data !== null) {
    const errorData = data as Record<string, unknown>

    if ('error' in errorData && typeof errorData.error === 'string') {
      return { message: errorData.error, isGenericMessage: false }
    }

    if ('message' in errorData && typeof errorData.message === 'string') {
      return { message: errorData.message, isGenericMessage: false }
    }
  }

  return {
    message: `${DEFAULT_API_ERROR_PREFIX} ${statusCode}`,
    isGenericMessage: true,
  }
}

function buildApiUrl(path: string): string {
  if (/^https?:\/\//.test(path)) {
    return path
  }

  if (!API_BASE_URL) {
    throw createApiError('TARO_APP_API_BASE_URL is not configured')
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function createApiError(
  message: string,
  statusCode?: number,
  data?: unknown,
  isGenericMessage = false,
  metadata?: Partial<ApiError>,
): ApiError {
  const error = new Error(message) as ApiError
  error.statusCode = statusCode
  error.data = data
  error.isGenericMessage = isGenericMessage
  Object.assign(error, metadata)
  return error
}

function appendCacheBustParam(requestUrl: string): string {
  try {
    const url = new URL(requestUrl)
    url.searchParams.set('_mpcb', Date.now().toString())
    return url.toString()
  } catch {
    const separator = requestUrl.includes('?') ? '&' : '?'
    return requestUrl + separator + '_mpcb=' + Date.now()
  }
}

type MiniProgramRequestResponse = string | TaroGeneral.IAnyObject | ArrayBuffer

async function executeMiniProgramRequest(options: {
  requestUrl: string
  method: HttpMethod
  data?: unknown
}): Promise<Taro.request.SuccessCallbackResult<MiniProgramRequestResponse>> {
  const sessionToken = getSessionToken()

  return Taro.request<MiniProgramRequestResponse>({
    url: options.requestUrl,
    method: options.method,
    data: options.data,
    enableCookie: true,
    timeout: REQUEST_TIMEOUT_MS,
    header: {
      'content-type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
    },
  })
}

function getApiRequestTarget(requestUrl: string): string {
  try {
    return new URL(requestUrl).origin
  } catch {
    return requestUrl
  }
}

function getTransportErrorDebugMessage(error: unknown): string {
  if (error && typeof error === 'object') {
    const errMsg = (error as { errMsg?: unknown }).errMsg
    if (typeof errMsg === 'string' && errMsg.trim() !== '') {
      return errMsg
    }
  }

  if (error instanceof Error && error.message) {
    return error.message
  }

  return 'Unknown transport error'
}

function getTransportErrorMessage(requestUrl: string, error: unknown): string {
  const requestTarget = getApiRequestTarget(requestUrl)
  const normalizedDebugMessage = getTransportErrorDebugMessage(error).toLowerCase()

  if (normalizedDebugMessage.includes('timeout')) {
    return `请求超时，请确认当前 API 地址 ${requestTarget} 可访问，并且服务已启动后重试`
  }

  if (normalizedDebugMessage.includes('domain list')) {
    return `当前 API 地址 ${requestTarget} 不在小程序合法域名白名单中，请检查开发设置或域名配置后重试`
  }

  if (normalizedDebugMessage.includes('ssl') || normalizedDebugMessage.includes('certificate')) {
    return `无法建立安全连接，请确认当前 API 地址 ${requestTarget} 的证书配置后重试`
  }

  return `无法连接到服务，请确认当前 API 地址 ${requestTarget} 可访问，并且服务已经启动`
}

function createTransportApiError(requestUrl: string, error: unknown): ApiError {
  return createApiError(
    getTransportErrorMessage(requestUrl, error),
    undefined,
    error,
    false,
    {
      isTransportError: true,
      requestUrl,
      debugMessage: getTransportErrorDebugMessage(error),
    },
  )
}

const LOCALHOST_DEV_FALLBACK_URL = 'http://localhost:5000'
const IS_DEV = process.env.NODE_ENV === 'development'

function shouldAttemptLocalhostFallback(error: unknown): boolean {
  if (!IS_DEV) return false
  const debugMsg = getTransportErrorDebugMessage(error).toLowerCase()
  return (
    debugMsg.includes('timeout') ||
    debugMsg.includes('refused') ||
    debugMsg.includes('failed') ||
    debugMsg.includes('connection')
  )
}

export async function apiRequest<T>(options: {
  path: string
  method?: HttpMethod
  data?: unknown
  handleUnauthorized?: boolean
}): Promise<T> {
  const requestUrl = buildApiUrl(options.path)
  const method = options.method ?? 'GET'

  let response
  try {
    response = await executeMiniProgramRequest({
      requestUrl,
      method,
      data: options.data,
    })

    // WeChat dev/runtime can surface a cached GET as 304 directly to JS.
    // Retry once with a cache-busting query string so callers still receive data.
    if (response.statusCode === 304 && method === 'GET') {
      response = await executeMiniProgramRequest({
        requestUrl: appendCacheBustParam(requestUrl),
        method,
        data: options.data,
      })
    }
  } catch (error) {
    // Dev-mode fallback: if the configured API URL (e.g. LAN IP) is unreachable,
    // retry once with localhost:5000 before giving up.
    if (
      shouldAttemptLocalhostFallback(error) &&
      !API_BASE_URL.includes('localhost') &&
      !API_BASE_URL.includes('127.0.0.1')
    ) {
      const fallbackUrl = `${LOCALHOST_DEV_FALLBACK_URL}${options.path.startsWith('/') ? options.path : `/${options.path}`}`
      try {
        response = await executeMiniProgramRequest({
          requestUrl: fallbackUrl,
          method,
          data: options.data,
        })

        if (response.statusCode === 304 && method === 'GET') {
          response = await executeMiniProgramRequest({
            requestUrl: appendCacheBustParam(fallbackUrl),
            method,
            data: options.data,
          })
        }
      } catch {
        // Fallback also failed — throw the original error for accurate diagnostics
        throw createTransportApiError(requestUrl, error)
      }
    } else {
      throw createTransportApiError(requestUrl, error)
    }
  }

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return response.data as T
  }

  if (options.handleUnauthorized !== false && response.statusCode === 401) {
    handleMiniProgramUnauthorized({ statusCode: response.statusCode })
  }

  const errorDetails = getApiErrorDetails(response.statusCode, response.data)

  throw createApiError(
    errorDetails.message,
    response.statusCode,
    response.data,
    errorDetails.isGenericMessage
  )
}

export type OnboardingStep = AuthUserResponse['nextStep']
export type UserState = AuthUserResponse

/**
 * Authenticate via WeChat Mini Program login (Taro.login → code2Session).
 * Establishes the authenticated session cookie for the follow-up auth bootstrap.
 * No web OAuth redirect is involved — this is mini-program-only.
 */
export async function authenticateMiniProgramUser(input?: {
  referralCode?: string
}): Promise<void> {
  const payload: Record<string, unknown> = {}
  if (input?.referralCode) {
    payload.referralCode = input.referralCode
  }
  await postMiniProgramWeChatLogin('/api/auth/wechat/login', payload, '无法建立微信登录会话')
}

export async function authenticateMiniProgramUserWithTest(input: {
  testAnswers?: ImportedMiniProgramAssessmentAnswer[]
  anonymousSessionId?: string | null
}): Promise<void> {
  await postMiniProgramWeChatLogin(
    '/api/auth/wechat/login-with-test',
    {
      testAnswers: input.testAnswers ?? [],
      anonymousSessionId: input.anonymousSessionId ?? undefined,
    },
    '无法导入测试结果并建立微信登录会话',
  )
}

/**
 * Fetch the current authenticated user's state, including the server-calculated
 * `nextStep` for driving onboarding/post-login navigation.
 */
export async function getUserState(): Promise<AuthUserResponse> {
  return apiRequest<AuthUserResponse>({ path: '/api/auth/user' })
}

/**
 * Restart onboarding for the current authenticated user.
 * Returns the updated user state with nextStep reset to the beginning.
 */
export async function restartOnboarding(): Promise<AuthUserResponse> {
  return apiRequest<AuthUserResponse>({
    path: '/api/auth/onboarding/restart',
    method: 'POST',
  })
}

async function getMiniProgramLoginCode(): Promise<string> {
  const loginResult = await Taro.login()
  if (!loginResult.code) {
    throw createApiError('微信登录没成功，稍后再试')
  }

  return loginResult.code
}

async function postMiniProgramWeChatLogin(
  path: string,
  payload: Record<string, unknown>,
  fallbackErrorMessage: string,
): Promise<void> {
  const code = await getMiniProgramLoginCode()
  const data = await apiRequest<{
    success?: boolean
    error?: string
    sessionToken?: string
  }>({
    path,
    method: 'POST',
    handleUnauthorized: false,
    data: {
      code,
      ...payload,
    },
  })

  if (!data.success) {
    throw createApiError(data.error || fallbackErrorMessage)
  }

  if (typeof data.sessionToken === 'string' && data.sessionToken.length > 0) {
    setSessionToken(data.sessionToken)
  }
}

/**
 * Fetch the composite Discover shell endpoint.
 * Returns all data needed for Discover (user, pools, registrations) in a single
 * request, cutting TTFB and request overhead vs the previous 3 parallel calls.
 * This is the primary data source for the Discover Predictive Shell pilot.
 */
export async function fetchDiscoverShell(): Promise<DiscoverShellResponse> {
  return apiRequest<DiscoverShellResponse>({ path: '/api/shell/discover' })
}

/**
 * Fetch the composite Profile shell endpoint.
 * Returns all data needed for Profile (user, coupons, stats) in a single
 * request, eliminating the duplicate auth fetch.
 */
export async function fetchProfileShell(): Promise<ProfileShellResponse> {
  return apiRequest<ProfileShellResponse>({ path: '/api/shell/profile' })
}

/**
 * Fetch the composite Events shell endpoint.
 * Returns all data needed for Events (user, joined events, notifications) in a single
 * request, cutting TTFB vs the previous multiple parallel calls.
 */
export async function fetchEventsShell(): Promise<EventsShellResponse> {
  return apiRequest<EventsShellResponse>({ path: '/api/shell/events' })
}

/**
 * Fetch the composite Connections shell endpoint.
 * Returns all data needed for Connections (user, connections, pending requests, notifications)
 * in a single request.
 */
export async function fetchConnectionsShell(): Promise<ConnectionsShellResponse> {
  return apiRequest<ConnectionsShellResponse>({ path: '/api/shell/connections' })
}


