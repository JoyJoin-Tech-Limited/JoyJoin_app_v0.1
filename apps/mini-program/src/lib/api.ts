import Taro from '@tarojs/taro'

const API_BASE_URL = (process.env.TARO_APP_API_BASE_URL ?? '').replace(/\/$/, '')
// Keep requests responsive on mobile networks while still allowing payment and
// auth calls enough time to complete under normal latency.
const REQUEST_TIMEOUT_MS = 15000

export interface ApiError extends Error {
  statusCode?: number
  data?: unknown
  isGenericMessage?: boolean
}

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

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
    throw new Error('TARO_APP_API_BASE_URL is not configured')
  }

  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`
}

function createApiError(
  message: string,
  statusCode?: number,
  data?: unknown,
  isGenericMessage = false
): ApiError {
  const error = new Error(message) as ApiError
  error.statusCode = statusCode
  error.data = data
  error.isGenericMessage = isGenericMessage
  return error
}

export async function apiRequest<T>(options: {
  path: string
  method?: HttpMethod
  data?: unknown
}): Promise<T> {
  const response = await Taro.request<T>({
    url: buildApiUrl(options.path),
    method: options.method ?? 'GET',
    data: options.data,
    enableCookie: true,
    timeout: REQUEST_TIMEOUT_MS,
    header: {
      'content-type': 'application/json',
    },
  })

  if (response.statusCode >= 200 && response.statusCode < 300) {
    return response.data
  }

  const errorDetails = getApiErrorDetails(response.statusCode, response.data)

  throw createApiError(
    errorDetails.message,
    response.statusCode,
    response.data,
    errorDetails.isGenericMessage
  )
}

export type OnboardingStep =
  | 'onboarding'
  | 'personality-test'
  | 'essential-data'
  | 'extended-data'
  | 'profile-review'
  | 'guide'
  | 'discover'

export interface UserState {
  id: string
  wechatOpenId: string
  nextStep: OnboardingStep
  // Index signature to accommodate the full user record returned by /api/auth/user
  // without requiring every field to be explicitly typed here.
  [key: string]: unknown
}

/**
 * Authenticate via WeChat Mini Program login (Taro.login → code2Session).
 * Returns the authenticated user and their openid.
 * No web OAuth redirect is involved — this is mini-program-only.
 */
export async function authenticateMiniProgramUser(): Promise<{ user: Record<string, any>; openid: string }> {
  const loginResult = await Taro.login()
  if (!loginResult.code) {
    throw createApiError('微信登录失败，请稍后重试')
  }

  const data = await apiRequest<{ success?: boolean; user?: Record<string, any>; error?: string }>({
    path: '/api/auth/wechat/login',
    method: 'POST',
    data: {
      code: loginResult.code,
    },
  })

  if (!data.success || !data.user?.wechatOpenId) {
    throw createApiError(data.error || '无法建立微信登录会话')
  }

  return {
    user: data.user,
    openid: data.user.wechatOpenId,
  }
}

/**
 * Fetch the current authenticated user's state, including the server-calculated
 * `nextStep` for driving onboarding/post-login navigation.
 */
export async function getUserState(): Promise<UserState> {
  return apiRequest<UserState>({ path: '/api/auth/user' })
}
