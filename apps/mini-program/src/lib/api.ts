import Taro from '@tarojs/taro'

const API_BASE_URL = (process.env.TARO_APP_API_BASE_URL ?? '').replace(/\/$/, '')
// Keep requests responsive on mobile networks while still allowing payment and
// auth calls enough time to complete under normal latency.
const REQUEST_TIMEOUT_MS = 15000

export interface ApiError extends Error {
  statusCode?: number
  data?: unknown
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

function createApiError(message: string, statusCode?: number, data?: unknown): ApiError {
  const error = new Error(message) as ApiError
  error.statusCode = statusCode
  error.data = data
  return error
}

export async function apiRequest<T>(options: {
  path: string
  method?: 'GET' | 'POST'
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

  const message =
    typeof response.data === 'object' &&
    response.data !== null &&
    'error' in response.data &&
    typeof (response.data as Record<string, unknown>).error === 'string'
      ? String((response.data as Record<string, unknown>).error)
      : `Request failed with status ${response.statusCode}`

  throw createApiError(message, response.statusCode, response.data)
}

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
