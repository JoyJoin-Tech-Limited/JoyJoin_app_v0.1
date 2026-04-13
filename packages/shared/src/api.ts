import type { LevelConfig, RedeemableItem } from './gamification'

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
  displayNameEn?: string
  description?: string
  price: number
  originalPrice?: number | null
  durationDays?: number
  isActive?: boolean
  isFeatured?: boolean
}

export interface BrowserPaymentIntent {
  h5Url?: string | null
  h5_url?: string | null
}

export interface BrowserPaymentResponse {
  payment?: BrowserPaymentIntent | null
  paymentRedirectUrl?: string | null
  paymentStatus?: 'pending' | 'completed'
}
export type SubscriptionPlanType = 'monthly' | 'quarterly'
export type VipSubscriptionPlanKey = 'vip_monthly' | 'vip_quarterly'
export type SubscriptionPlanIdentifier = SubscriptionPlanType | VipSubscriptionPlanKey

const SUBSCRIPTION_PLAN_IDENTIFIER_MAP: Record<SubscriptionPlanIdentifier, SubscriptionPlanType> = {
  monthly: 'monthly',
  quarterly: 'quarterly',
  vip_monthly: 'monthly',
  vip_quarterly: 'quarterly',
}

interface RawPricingPlan {
  id?: string | number
  planType?: string
  displayName?: string
  name?: string
  displayNameEn?: string
  nameEn?: string
  description?: string
  price?: number | string
  originalPrice?: number | string | null
  durationDays?: number | string
  isActive?: boolean
  isFeatured?: boolean
  [key: string]: unknown
}

export function normalizeSubscriptionPlanType(
  planType: string | null | undefined
): SubscriptionPlanType | null {
  if (typeof planType !== 'string') {
    return null
  }

  const normalized = planType.trim() as SubscriptionPlanIdentifier
  return SUBSCRIPTION_PLAN_IDENTIFIER_MAP[normalized] ?? null
}

export function toVipSubscriptionPlanKey(
  planType: string | null | undefined
): VipSubscriptionPlanKey | null {
  const normalized = normalizeSubscriptionPlanType(planType)
  if (!normalized) {
    return null
  }

  return normalized === 'quarterly' ? 'vip_quarterly' : 'vip_monthly'
}

function pricingPlanMatches(
  plan: Pick<PricingPlan, 'planType'>,
  targetPlanType: string
): boolean {
  const normalizedPlanType = normalizeSubscriptionPlanType(plan.planType)
  const normalizedTargetPlanType = normalizeSubscriptionPlanType(targetPlanType)

  if (normalizedPlanType && normalizedTargetPlanType) {
    return normalizedPlanType === normalizedTargetPlanType
  }

  return plan.planType === targetPlanType
}

export function findPricingPlan(
  pricingPlans: PricingPlan[] | null | undefined,
  targetPlanType: string
): PricingPlan | undefined {
  return pricingPlans?.find((plan) => pricingPlanMatches(plan, targetPlanType))
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

export type UserCouponStatus = 'available' | 'used' | 'expired'

interface RawUserCoupon {
  id?: string
  couponId?: string | null
  coupon_id?: string | null
  code?: string
  discountType?: string
  discount_type?: string
  discountValue?: number | string | null
  discount_value?: number | string | null
  validFrom?: string | null
  valid_from?: string | null
  validUntil?: string | null
  valid_until?: string | null
  isUsed?: boolean
  is_used?: boolean
  usedAt?: string | null
  used_at?: string | null
  source?: string | null
  sourceId?: string | null
  source_id?: string | null
  createdAt?: string | null
  created_at?: string | null
  [key: string]: unknown
}

export interface UserCouponsResponse {
  count: number
  availableCount: number
  coupons: UserCouponSummary[]
}

export interface UserCouponSummary {
  id: string
  couponId?: string | null
  code?: string
  discountType?: string
  discountValue?: number
  validFrom?: string | null
  validUntil?: string | null
  isUsed: boolean
  usedAt?: string | null
  source?: string | null
  sourceId?: string | null
  createdAt?: string | null
  status: UserCouponStatus
  [key: string]: unknown
}

type RawUserCouponsResponse =
  | RawUserCoupon[]
  | {
      count?: unknown
      coupons?: RawUserCoupon[]
    }

function parseNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) {
      return parsed
    }
  }

  return undefined
}

function isCouponExpired(validUntil?: string | null): boolean {
  if (!validUntil) {
    return false
  }

  const expiryTime = new Date(validUntil).getTime()
  if (Number.isNaN(expiryTime)) {
    return false
  }

  return expiryTime < Date.now()
}

function normalizeUserCoupon(rawCoupon: RawUserCoupon): UserCouponSummary {
  const validUntil = rawCoupon.validUntil ?? rawCoupon.valid_until ?? null
  const isUsed = Boolean(rawCoupon.isUsed ?? rawCoupon.is_used)
  const status: UserCouponStatus = isUsed
    ? 'used'
    : isCouponExpired(validUntil)
      ? 'expired'
      : 'available'

  return {
    ...rawCoupon,
    id: String(rawCoupon.id ?? ''),
    couponId: rawCoupon.couponId ?? rawCoupon.coupon_id ?? null,
    discountType: rawCoupon.discountType ?? rawCoupon.discount_type,
    discountValue: parseNumber(rawCoupon.discountValue ?? rawCoupon.discount_value),
    validFrom: rawCoupon.validFrom ?? rawCoupon.valid_from ?? null,
    validUntil,
    isUsed,
    usedAt: rawCoupon.usedAt ?? rawCoupon.used_at ?? null,
    source: rawCoupon.source ?? null,
    sourceId: rawCoupon.sourceId ?? rawCoupon.source_id ?? null,
    createdAt: rawCoupon.createdAt ?? rawCoupon.created_at ?? null,
    status,
  }
}

function normalizeUserCouponsResponse(rawResponse: RawUserCouponsResponse): UserCouponsResponse {
  const rawCoupons = Array.isArray(rawResponse)
    ? rawResponse
    : Array.isArray(rawResponse?.coupons)
      ? rawResponse.coupons
      : []

  const coupons = rawCoupons.map(normalizeUserCoupon)
  const availableCount = coupons.filter((coupon) => coupon.status === 'available').length
  const explicitCount = Array.isArray(rawResponse)
    ? undefined
    : parseNumber(rawResponse?.count)

  return {
    count: explicitCount ?? coupons.length,
    availableCount,
    coupons,
  }
}

function normalizePricingPlan(rawPlan: RawPricingPlan): PricingPlan | null {
  const price = parseNumber(rawPlan.price)
  if (price === undefined) {
    return null
  }

  const displayName =
    typeof rawPlan.displayName === 'string' && rawPlan.displayName.trim() !== ''
      ? rawPlan.displayName
      : typeof rawPlan.name === 'string' && rawPlan.name.trim() !== ''
        ? rawPlan.name
        : String(rawPlan.planType ?? '')

  return {
    id: String(rawPlan.id ?? rawPlan.planType ?? ''),
    planType: String(rawPlan.planType ?? ''),
    displayName,
    displayNameEn:
      typeof rawPlan.displayNameEn === 'string' && rawPlan.displayNameEn.trim() !== ''
        ? rawPlan.displayNameEn
        : typeof rawPlan.nameEn === 'string' && rawPlan.nameEn.trim() !== ''
          ? rawPlan.nameEn
          : undefined,
    description: typeof rawPlan.description === 'string' ? rawPlan.description : undefined,
    price,
    originalPrice: parseNumber(rawPlan.originalPrice) ?? null,
    durationDays: parseNumber(rawPlan.durationDays),
    isActive: typeof rawPlan.isActive === 'boolean' ? rawPlan.isActive : undefined,
    isFeatured: typeof rawPlan.isFeatured === 'boolean' ? rawPlan.isFeatured : undefined,
  }
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

export interface ReferralStatsResponse {
  referralCode: string
  successfulInvites: number
  platformTotal: number
  inviteLink?: string
}

export interface UserGamificationNextLevelInfo {
  progress?: number
  xpNeeded?: number
}

export interface UserGamificationSummary {
  experiencePoints: number
  joyCoins: number
  currentLevel: number
  levelConfig?: LevelConfig
  nextLevelInfo?: UserGamificationNextLevelInfo | null
  activityStreak?: number
  lastActivityDate?: string | null
  streakFreezeAvailable?: boolean
  eventsAttended?: number
}

export interface GamificationTransaction {
  id: string
  transactionType?: string
  xpAmount?: number
  coinsAmount?: number
  description?: string
  descriptionCn?: string
  createdAt?: string
  [key: string]: unknown
}

export interface RedeemGamificationItemResponse {
  success: boolean
  newCoinsBalance?: number
  redeemedItem?: RedeemableItem
  refunded?: boolean
  message?: string
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

export interface BlindBoxEventSummary {
  id: string
  title?: string
  status?: string
  dateTime?: string
  [key: string]: unknown
}

export function getPricing(api: ApiTransport): Promise<PricingPlan[]> {
  return api<RawPricingPlan[]>({ path: '/api/pricing' }).then((plans) =>
    Array.isArray(plans)
      ? plans.map(normalizePricingPlan).filter((plan): plan is PricingPlan => plan !== null)
      : []
  )
}

export function getUserCoupons(api: ApiTransport): Promise<UserCouponsResponse> {
  return api<RawUserCouponsResponse>({ path: '/api/user/coupons' }).then(normalizeUserCouponsResponse)
}

export function getReferralStats(api: ApiTransport): Promise<ReferralStatsResponse> {
  return api<ReferralStatsResponse>({ path: '/api/referrals/stats' })
}

export function getUserGamificationInfo(api: ApiTransport): Promise<UserGamificationSummary> {
  return api<UserGamificationSummary>({ path: '/api/user/gamification' })
}

export function getUserGamificationHistory(
  api: ApiTransport,
  limit = 20
): Promise<GamificationTransaction[]> {
  const query = limit > 0 ? `?limit=${encodeURIComponent(String(limit))}` : ''
  return api<GamificationTransaction[]>({ path: `/api/user/gamification/history${query}` })
}

export function getRedeemableItems(api: ApiTransport): Promise<RedeemableItem[]> {
  return api<RedeemableItem[]>({ path: '/api/user/gamification/redeemable-items' })
}

export function redeemGamificationItem(
  api: ApiTransport,
  itemId: string
): Promise<RedeemGamificationItemResponse> {
  return api<RedeemGamificationItemResponse>({
    path: '/api/user/gamification/redeem',
    method: 'POST',
    data: { itemId },
  })
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

export function getMyBlindBoxEvents(api: ApiTransport): Promise<BlindBoxEventSummary[]> {
  return api<BlindBoxEventSummary[]>({ path: '/api/my-events' })
}

// ---------------------------------------------------------------------------
// Notification counts API
// ---------------------------------------------------------------------------

export interface NotificationCountsResponse {
  discover: number
  activities: number
  chat: number
  total: number
}

export function getNotificationCounts(
  api: ApiTransport
): Promise<NotificationCountsResponse> {
  return api<NotificationCountsResponse>({ path: '/api/notifications/counts' })
}

export function markNotificationsAsRead(
  api: ApiTransport,
  category: 'discover' | 'activities' | 'chat'
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: '/api/notifications/mark-read',
    method: 'POST',
    data: { category },
  })
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
  birthdate?: string
  currentCity?: string
  hometownRegionCity?: string
  occupationId?: string
  [key: string]: unknown
}

export function submitEssentialData(
  api: ApiTransport,
  data: EssentialDataPayload
): Promise<{ success: boolean }> {
  const { birthYear, birthdate, ...rest } = data
  return api<{ success: boolean }>({
    path: '/api/profile',
    method: 'PATCH',
    data: {
      ...rest,
      ...(birthdate ? { birthdate } : birthYear ? { birthdate: `${birthYear}-01-01` } : {}),
    },
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
    path: '/api/profile-review/complete',
    method: 'POST',
  })
}

// ---------------------------------------------------------------------------
// Event pool discovery & registration API
// ---------------------------------------------------------------------------

export interface EventPoolSummary {
  id: string
  title?: string
  eventType?: string
  city?: string
  district?: string
  dateTime?: string
  status?: string
  description?: string
  maxParticipants?: number
  currentParticipants?: number
  [key: string]: unknown
}

export interface PoolRegistrationSummary {
  id: string
  poolId: string
  matchStatus?: 'pending' | 'matched' | 'completed'
  assignedGroupId?: string | null
  matchScore?: number | null
  registeredAt?: string
  poolTitle?: string
  poolEventType?: string
  poolCity?: string
  poolDistrict?: string
  poolDateTime?: string
  poolStatus?: string
  theme?: string
  subtitle?: string
  themeEmoji?: string
  highlights?: string[]
  vibe?: string
  invitationRole?: 'inviter' | 'invitee' | null
  relatedUserName?: string | null
  [key: string]: unknown
}

export interface PoolGroupMemberSummary {
  userId: string
  displayName?: string
  archetype?: string | null
  topInterests?: string[] | null
  ageLabel?: string | null
  industryNicheLabel?: string | null
  industryCategoryLabel?: string | null
  ageVisible?: boolean | null
  industryVisible?: boolean | null
  gender?: string | null
  educationLevel?: string | null
  hometownRegionCity?: string | null
  hometownAffinityOptin?: boolean | null
  educationVisible?: boolean | null
  relationshipStatus?: string | null
  intent?: string[] | null
  [key: string]: unknown
}

export interface PoolGroupDetailsResponse {
  group: {
    id: string
    groupNumber: number
    memberCount: number
    matchScore?: number | null
    avgPairScore?: number | null
    diversityScore?: number | null
    energyBalance?: number | null
    matchExplanation?: string | null
    venueName?: string | null
    venueAddress?: string | null
    finalDateTime?: string | null
    status?: string
    [key: string]: unknown
  }
  pool: {
    id: string
    title: string
    description?: string | null
    eventType?: string
    city?: string
    district?: string | null
    dateTime?: string
    [key: string]: unknown
  }
  members: PoolGroupMemberSummary[]
}

export interface ConfirmPoolGroupAttendanceResponse {
  success: boolean
  blindBoxEventId: string | null
}

export function getEventPools(api: ApiTransport): Promise<EventPoolSummary[]> {
  return api<EventPoolSummary[]>({ path: '/api/event-pools' })
}

export function getEventPool(
  api: ApiTransport,
  poolId: string
): Promise<EventPoolSummary> {
  return api<EventPoolSummary>({
    path: `/api/event-pools/${encodeURIComponent(poolId)}`,
  })
}

export function getMyPoolRegistrations(
  api: ApiTransport
): Promise<PoolRegistrationSummary[]> {
  return api<PoolRegistrationSummary[]>({ path: '/api/my-pool-registrations' })
}

export function getPoolGroupDetails(
  api: ApiTransport,
  groupId: string
): Promise<PoolGroupDetailsResponse> {
  return api<PoolGroupDetailsResponse>({
    path: `/api/pool-groups/${encodeURIComponent(groupId)}`,
  })
}

export function registerForPool(
  api: ApiTransport,
  poolId: string
): Promise<{ id: string }> {
  return api<{ id: string }>({
    path: `/api/event-pools/${encodeURIComponent(poolId)}/register`,
    method: 'POST',
  })
}

export function cancelPoolRegistration(
  api: ApiTransport,
  registrationId: string
): Promise<void> {
  return api<void>({
    path: `/api/pool-registrations/${encodeURIComponent(registrationId)}`,
    method: 'DELETE',
  })
}

export function confirmPoolGroupAttendance(
  api: ApiTransport,
  groupId: string
): Promise<ConfirmPoolGroupAttendanceResponse> {
  return api<ConfirmPoolGroupAttendanceResponse>({
    path: `/api/pool-groups/${encodeURIComponent(groupId)}/confirm-attendance`,
    method: 'POST',
  })
}
