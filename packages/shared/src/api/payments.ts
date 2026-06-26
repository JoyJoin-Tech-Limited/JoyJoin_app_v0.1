import type { ApiTransport } from './core.js'

export interface BrowserPaymentIntent {
  wechatOrderId?: string
  h5Url?: string | null
  h5_url?: string | null
}

export interface BrowserPaymentResponse {
  payment?: BrowserPaymentIntent | null
  paymentRedirectUrl?: string | null
  paymentStatus?: 'pending' | 'completed'
}

export function getBrowserPaymentLaunchUrl(
  payload: BrowserPaymentIntent | BrowserPaymentResponse | null | undefined
): string | null {
  if (
    payload &&
    typeof payload === 'object' &&
    'paymentRedirectUrl' in payload &&
    typeof payload.paymentRedirectUrl === 'string'
  ) {
    const directUrl = payload.paymentRedirectUrl.trim()
    if (directUrl !== '') {
      return directUrl
    }
  }

  const nestedPayment =
    payload && typeof payload === 'object' && 'payment' in payload
      ? payload.payment
      : payload

  const payment = nestedPayment as BrowserPaymentIntent | null | undefined
  if (!payment || typeof payment !== 'object') {
    return null
  }

  const rawUrl = payment.h5Url ?? payment.h5_url
  if (typeof rawUrl !== 'string') {
    return null
  }

  const trimmedUrl = rawUrl.trim()
  return trimmedUrl !== '' ? trimmedUrl : null
}

export function appendBrowserPaymentReturnUrl(
  launchUrl: string | null | undefined,
  returnUrl: string | null | undefined
): string | null {
  if (typeof launchUrl !== 'string') {
    return null
  }

  const trimmedLaunchUrl = launchUrl.trim()
  if (trimmedLaunchUrl === '') {
    return null
  }

  if (typeof returnUrl !== 'string' || returnUrl.trim() === '') {
    return trimmedLaunchUrl
  }

  const encodedReturnUrl = encodeURIComponent(returnUrl.trim())
  if (/[?&]redirect_url=/.test(trimmedLaunchUrl)) {
    return trimmedLaunchUrl.replace(/([?&])redirect_url=[^&]*/, `$1redirect_url=${encodedReturnUrl}`)
  }

  const separator = trimmedLaunchUrl.includes('?') ? '&' : '?'
  return `${trimmedLaunchUrl}${separator}redirect_url=${encodedReturnUrl}`
}

export interface CreateMiniProgramPaymentIntentRequest {
  type: string
  planId: string
  openid?: string
  couponCode?: string
}

export interface PaymentIntentResponse {
  outTradeNo: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
  type: string
  mock?: boolean
}

export interface PaymentStatusResponse {
  status?: string
}

export interface CouponValidationResponse {
  valid: boolean
  message?: string
  discountAmount?: number
  finalAmount?: number
}

export type PaymentVerificationState = 'polling' | 'paid' | 'pending' | 'failed'

export interface PaymentVerificationDecision {
  status: PaymentVerificationState
  shouldRetry: boolean
  clearPendingOrder: boolean
}

export interface PaymentVerificationStatusDecisionInput {
  remoteStatus?: string | null
  attempt: number
  maxAttempts: number
}

export interface PaymentVerificationErrorDecisionInput {
  attempt: number
  maxAttempts: number
}

function hasExhaustedPaymentVerificationAttempts(input: {
  attempt: number
  maxAttempts: number
}): boolean {
  return input.attempt >= input.maxAttempts
}

export function getPaymentVerificationStatusDecision(
  input: PaymentVerificationStatusDecisionInput
): PaymentVerificationDecision {
  const normalizedRemoteStatus =
    typeof input.remoteStatus === 'string' ? input.remoteStatus.trim().toLowerCase() : undefined

  if (normalizedRemoteStatus === 'completed') {
    return {
      status: 'paid',
      shouldRetry: false,
      clearPendingOrder: false,
    }
  }

  if (normalizedRemoteStatus === 'failed' || normalizedRemoteStatus === 'closed') {
    return {
      status: 'failed',
      shouldRetry: false,
      clearPendingOrder: true,
    }
  }

  if (hasExhaustedPaymentVerificationAttempts(input)) {
    return {
      status: 'pending',
      shouldRetry: false,
      clearPendingOrder: false,
    }
  }

  return {
    status: 'polling',
    shouldRetry: true,
    clearPendingOrder: false,
  }
}

export function getPaymentVerificationErrorDecision(
  input: PaymentVerificationErrorDecisionInput
): PaymentVerificationDecision {
  if (hasExhaustedPaymentVerificationAttempts(input)) {
    return {
      status: 'pending',
      shouldRetry: false,
      clearPendingOrder: false,
    }
  }

  return {
    status: 'polling',
    shouldRetry: true,
    clearPendingOrder: false,
  }
}

export function createMiniProgramPaymentIntent(
  api: ApiTransport,
  data: CreateMiniProgramPaymentIntentRequest
): Promise<PaymentIntentResponse> {
  return api<PaymentIntentResponse>({
    path: '/api/payments/miniprogram/create',
    method: 'POST',
    data,
  })
}

export function getPaymentStatus(
  api: ApiTransport,
  wechatOrderId: string
): Promise<PaymentStatusResponse> {
  return api<PaymentStatusResponse>({
    path: `/api/payments/status/${encodeURIComponent(wechatOrderId)}`,
  })
}
