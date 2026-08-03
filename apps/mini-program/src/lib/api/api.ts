import Taro from '@tarojs/taro'
import type { AuthUserResponse, DiscoverShellResponse, ProfileShellResponse, EventsShellResponse, ConnectionsShellResponse } from '@shared/api'
import { handleMiniProgramUnauthorized } from './authSession'

const DEFAULT_MINI_PROGRAM_API_BASE_URL = 'http://localhost:5001'
const STAGING_API_BASE_URL = 'https://staging.joyjoinapp.com'
const PRODUCTION_API_BASE_URL = 'https://api.joyjoinapp.com'

function resolveApiBaseUrl(): string {
  const buildTimeUrl = (process.env.TARO_APP_API_BASE_URL ?? DEFAULT_MINI_PROGRAM_API_BASE_URL).replace(/\/$/, '')
  try {
    const accountInfo = Taro.getAccountInfoSync()
    const envVersion = accountInfo?.miniProgram?.envVersion
    if (envVersion === 'trial') return STAGING_API_BASE_URL
    if (envVersion === 'release') return PRODUCTION_API_BASE_URL
  } catch {
  }
  return buildTimeUrl
}

const API_BASE_URL = resolveApiBaseUrl()
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

    if (
      'error' in errorData &&
      typeof errorData.error === 'string' &&
      'message' in errorData &&
      typeof errorData.message === 'string' &&
      errorData.message.trim() !== ''
    ) {
      return { message: `${errorData.error}: ${errorData.message}`, isGenericMessage: false }
    }

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
  timeout?: number
  headers?: Record<string, string>
}): Promise<Taro.request.SuccessCallbackResult<MiniProgramRequestResponse>> {
  const sessionToken = getSessionToken()

  return Taro.request<MiniProgramRequestResponse>({
    url: options.requestUrl,
    method: options.method,
    data: options.data,
    enableCookie: true,
    timeout: options.timeout ?? REQUEST_TIMEOUT_MS,
    header: {
      'content-type': 'application/json',
      'Cache-Control': 'no-cache',
      Pragma: 'no-cache',
      ...options.headers,
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
  timeout?: number
  headers?: Record<string, string>
}): Promise<T> {
  const requestUrl = buildApiUrl(options.path)
  const method = options.method ?? 'GET'

  let response
  try {
    response = await executeMiniProgramRequest({
      requestUrl,
      method,
      data: options.data,
      timeout: options.timeout,
      headers: options.headers,
    })

    // WeChat dev/runtime can surface a cached GET as 304 directly to JS.
    // Retry once with a cache-busting query string so callers still receive data.
    if (response.statusCode === 304 && method === 'GET') {
      response = await executeMiniProgramRequest({
        requestUrl: appendCacheBustParam(requestUrl),
        method,
        data: options.data,
        timeout: options.timeout,
        headers: options.headers,
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
          timeout: options.timeout,
          headers: options.headers,
        })

        if (response.statusCode === 304 && method === 'GET') {
          response = await executeMiniProgramRequest({
            requestUrl: appendCacheBustParam(fallbackUrl),
            method,
            data: options.data,
            timeout: options.timeout,
            headers: options.headers,
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
 * Binary POST — for endpoints returning raw bytes (e.g. the animated share
 * clip MP4). Mirrors apiRequest's URL/auth/timeout handling but returns an
 * ArrayBuffer instead of parsed JSON.
 */
export async function apiRequestBinary(options: {
  path: string
  data?: unknown
  timeout?: number
}): Promise<ArrayBuffer> {
  const requestUrl = buildApiUrl(options.path)
  const sessionToken = getSessionToken()

  let response
  try {
    response = await Taro.request<ArrayBuffer>({
      url: requestUrl,
      method: 'POST',
      data: options.data,
      responseType: 'arraybuffer',
      enableCookie: true,
      timeout: options.timeout ?? REQUEST_TIMEOUT_MS,
      header: {
        'content-type': 'application/json',
        'Cache-Control': 'no-cache',
        Pragma: 'no-cache',
        ...(sessionToken ? { 'X-Session-Token': sessionToken } : {}),
      },
    })
  } catch (error) {
    throw createTransportApiError(requestUrl, error)
  }

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return response.data as ArrayBuffer
  }

  // Error bodies arrive as JSON text inside the arraybuffer — decode for the message
  let message = `${DEFAULT_API_ERROR_PREFIX} ${response.statusCode}`
  try {
    const decoded = JSON.parse(new TextDecoder().decode(response.data as ArrayBuffer))
    if (decoded?.message) message = decoded.message
  } catch {
    // keep generic message
  }
  throw createApiError(message, response.statusCode)
}

/**
 * Authenticate via WeChat Mini Program login (Taro.login → code2Session).
 * Establishes the authenticated session cookie for the follow-up auth bootstrap.
 * No web OAuth redirect is involved — this is mini-program-only.
 */
export async function authenticateMiniProgramUser(input?: {
  referralCode?: string
}): Promise<{ isNewUser: boolean }> {
  const payload: Record<string, unknown> = {}
  if (input?.referralCode) {
    payload.referralCode = input.referralCode
  }
  return postMiniProgramWeChatLogin('/api/auth/wechat/login', payload, '无法建立微信登录会话')
}

/**
 * Check whether the current WeChat Mini Program user already has a JoyJoin
 * account, without creating one or establishing a session. Used by the silent
 * auto-login bridge to avoid signing up new users before they reach the
 * personality-test result page.
 */
export async function checkReturningMiniProgramWeChatUser(): Promise<{ exists: boolean }> {
  const code = await getMiniProgramLoginCode()
  const data = await apiRequest<{
    exists?: boolean
    error?: string
  }>({
    path: '/api/auth/wechat/check',
    method: 'POST',
    handleUnauthorized: false,
    data: { code },
  })

  if (typeof data.exists !== 'boolean') {
    throw createApiError('无法检查微信登录状态')
  }

  return { exists: data.exists }
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
/**
 * Authenticate via phone+password (test accounts, not WeChat).
 * Calls POST /api/auth/login and stores the returned sessionToken.
 */
export async function authenticateMiniProgramUserWithPhone(input: {
  phone: string
  password: string
}): Promise<{ user: AuthUserResponse }> {
  const data = await apiRequest<{
    success: boolean
    user: AuthUserResponse
    sessionToken: string
  }>({
    path: '/api/auth/login',
    method: 'POST',
    handleUnauthorized: false,
    data: { phone: input.phone, password: input.password },
  })

  if (!data.success) {
    throw createApiError('手机号或密码错误')
  }

  if (typeof data.sessionToken === 'string' && data.sessionToken.length > 0) {
    setSessionToken(data.sessionToken)
  }

  return { user: data.user }
}

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
): Promise<{ isNewUser: boolean }> {
  const code = await getMiniProgramLoginCode()
  const data = await apiRequest<{
    success?: boolean
    error?: string
    sessionToken?: string
    isNewUser?: boolean
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

  return { isNewUser: data.isNewUser ?? false }
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
