import { looksLikeOfflineError } from '../../../lib/utils/offlineDetection'

export type WelcomeGiftErrorCategory = 'offline' | 'timeout' | 'http' | 'unknown'

export interface WelcomeGiftDiagnostics {
  category: WelcomeGiftErrorCategory
  statusCode?: number
  code?: string
}

export interface WelcomeGiftErrorState {
  diagnostics: WelcomeGiftDiagnostics
  message: string
  retryable: boolean
}

function readErrorRecord(error: unknown): Record<string, unknown> {
  return typeof error === 'object' && error !== null
    ? error as Record<string, unknown>
    : {}
}

function readSafeCode(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Z0-9_]{1,64}$/.test(value)
    ? value
    : undefined
}

/** Maps transport/API failures to a small analytics-safe diagnostic contract. */
export function resolveWelcomeGiftError(error: unknown): WelcomeGiftErrorState {
  const record = readErrorRecord(error)
  const data = readErrorRecord(record.data)
  const code = readSafeCode(data.code)
  const rawStatus = Number(record.statusCode)
  const statusCode = Number.isInteger(rawStatus) && rawStatus >= 400 && rawStatus <= 599
    ? rawStatus
    : undefined
  const rawMessage = error instanceof Error ? error.message : ''

  let category: WelcomeGiftErrorCategory = 'unknown'
  if (/timeout|timed out|超时/i.test(rawMessage)) {
    category = 'timeout'
  } else if (record.isTransportError === true || looksLikeOfflineError(error)) {
    category = 'offline'
  } else if (statusCode !== undefined) {
    category = 'http'
  }

  const diagnostics: WelcomeGiftDiagnostics = { category }
  if (statusCode !== undefined) diagnostics.statusCode = statusCode
  if (code) diagnostics.code = code

  const notConfigured = code === 'WELCOME_COUPON_NOT_FOUND'
  const message = category === 'offline'
    ? '网络不太稳定，见面礼可稍后重试；不影响进入发现'
    : notConfigured
      ? '见面礼暂未配置，不影响进入发现'
      : '见面礼暂时没领到，可重试；不影响进入发现'

  return {
    diagnostics,
    message,
    retryable: !notConfigured,
  }
}
