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

// ---------------------------------------------------------------------------
// Assessment (personality test) API
// ---------------------------------------------------------------------------

export interface AssessmentQuestion {
  id: string
  text: string
  options: { id: string; text: string; traitScores?: Record<string, number> }[]
  traitKey?: string
  phaseLabel?: string
}

export interface AssessmentStartResponse {
  sessionId: string
  question: AssessmentQuestion
  totalQuestions: number
  currentQuestionIndex: number
  phase?: string
}

export interface AssessmentAnswerResponse {
  question?: AssessmentQuestion | null
  totalQuestions: number
  currentQuestionIndex: number
  isComplete: boolean
  phase?: string
}

export interface AssessmentResultResponse {
  archetype?: string
  archetypeLabel?: string
  confidence?: number
  traitScores?: Record<string, number>
  summary?: string
  [key: string]: unknown
}

export function startAssessment(
  api: ApiTransport,
  data?: { preSignupAnswers?: Record<string, string> }
): Promise<AssessmentStartResponse> {
  return api<AssessmentStartResponse>({
    path: '/api/assessment/v4/start',
    method: 'POST',
    data: data ?? {},
  })
}

export function submitAssessmentAnswer(
  api: ApiTransport,
  sessionId: string,
  data: { questionId: string; optionId: string }
): Promise<AssessmentAnswerResponse> {
  return api<AssessmentAnswerResponse>({
    path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/answer`,
    method: 'POST',
    data,
  })
}

export function skipAssessmentQuestion(
  api: ApiTransport,
  sessionId: string,
  data: { questionId: string }
): Promise<AssessmentAnswerResponse> {
  return api<AssessmentAnswerResponse>({
    path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/skip`,
    method: 'POST',
    data,
  })
}

export function getAssessmentResult(
  api: ApiTransport,
  sessionId: string
): Promise<AssessmentResultResponse> {
  return api<AssessmentResultResponse>({
    path: `/api/assessment/v4/${encodeURIComponent(sessionId)}/result`,
  })
}

// ---------------------------------------------------------------------------
// User profile / onboarding submission API
// ---------------------------------------------------------------------------

export interface EssentialDataPayload {
  displayName?: string
  gender?: string
  birthYear?: number
  currentCity?: string
  hometownRegionCity?: string
  occupationId?: string
  [key: string]: unknown
}

export function submitEssentialData(
  api: ApiTransport,
  data: EssentialDataPayload
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: '/api/user',
    method: 'PATCH',
    data,
  })
}

export interface InterestsPayload {
  interests: string[]
}

export function submitInterests(
  api: ApiTransport,
  data: InterestsPayload
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: '/api/user/interests',
    method: 'POST',
    data,
  })
}

export function completeProfileReview(
  api: ApiTransport
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: '/api/user',
    method: 'PATCH',
    data: { hasSeenProfileReview: true },
  })
}
