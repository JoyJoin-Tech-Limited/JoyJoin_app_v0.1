import Taro from '@tarojs/taro'
import type { AuthUserResponse } from '@shared/api'
import { handleMiniProgramUnauthorized } from './authSession'

const DEFAULT_MINI_PROGRAM_API_BASE_URL = 'http://localhost:5001'
const API_BASE_URL = (process.env.TARO_APP_API_BASE_URL ?? DEFAULT_MINI_PROGRAM_API_BASE_URL).replace(/\/$/, '')
// Keep requests responsive on mobile networks while still allowing payment and
// auth calls enough time to complete under normal latency.
const REQUEST_TIMEOUT_MS = 15000

export interface ApiError extends Error {
  statusCode?: number
  data?: unknown
  isGenericMessage?: boolean
  isTransportError?: boolean
  requestUrl?: string
  debugMessage?: string
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

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
    throw createTransportApiError(requestUrl, error)
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
export async function authenticateMiniProgramUser(): Promise<void> {
  await postMiniProgramWeChatLogin('/api/auth/wechat/login', {}, '无法建立微信登录会话')
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

async function getMiniProgramLoginCode(): Promise<string> {
  const loginResult = await Taro.login()
  if (!loginResult.code) {
    throw createApiError('微信登录失败，请稍后重试')
  }

  return loginResult.code
}

async function postMiniProgramWeChatLogin(
  path: string,
  payload: Record<string, unknown>,
  fallbackErrorMessage: string,
): Promise<void> {
  const code = await getMiniProgramLoginCode()
  const data = await apiRequest<{ success?: boolean; error?: string }>({
    path,
    method: 'POST',
    data: {
      code,
      ...payload,
    },
  })

  if (!data.success) {
    throw createApiError(data.error || fallbackErrorMessage)
  }
}
