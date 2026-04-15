import Taro from '@tarojs/taro'
import type { AuthUserResponse } from '@shared/api'
import { handleMiniProgramUnauthorized } from './authSession'

const API_BASE_URL = (process.env.TARO_APP_API_BASE_URL ?? 'http://localhost:5000').replace(/\/$/, '')
// Keep requests responsive on mobile networks while still allowing payment and
// auth calls enough time to complete under normal latency.
const REQUEST_TIMEOUT_MS = 15000

export interface ApiError extends Error {
  statusCode?: number
  data?: unknown
  isGenericMessage?: boolean
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
  handleUnauthorized?: boolean
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
