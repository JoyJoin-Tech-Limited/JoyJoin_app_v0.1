export type ApiMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface ApiTransportRequest {
  path: string
  method?: ApiMethod
  data?: unknown
}

export type ApiTransport = <T>(request: ApiTransportRequest) => Promise<T>

export interface PricingPlan {
  id: string
  planType: string
  displayName: string
  description?: string
  price: number
  originalPrice?: number | null
}

export interface UserCoupon {
  id?: string
  code?: string
  discountType?: string
  discountValue?: number
}

export interface UserCouponsResponse {
  count?: number
  coupons?: UserCoupon[]
}

export interface CreateMiniProgramPaymentIntentRequest {
  type: string
  planId: string
  openid: string
}

export interface PaymentIntentResponse {
  outTradeNo: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: 'RSA'
  paySign: string
  type: string
}

export interface PaymentStatusResponse {
  status?: string
}

export interface AuthUserSummary {
  id: string
  nickname?: string
  nextStep?: string
  paymentsEnabled?: boolean
  [key: string]: unknown
}

export interface JoinedEventSummary {
  id: string
  title?: string
  dateTime?: string
  [key: string]: unknown
}

export function getPricing(api: ApiTransport): Promise<PricingPlan[]> {
  return api<PricingPlan[]>({ path: '/api/pricing' })
}

export function getUserCoupons(api: ApiTransport): Promise<UserCouponsResponse> {
  return api<UserCouponsResponse>({ path: '/api/user/coupons' })
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

export function getCurrentUser(api: ApiTransport): Promise<AuthUserSummary> {
  return api<AuthUserSummary>({ path: '/api/auth/user' })
}

export function getJoinedEvents(api: ApiTransport): Promise<JoinedEventSummary[]> {
  return api<JoinedEventSummary[]>({ path: '/api/events/joined' })
}
