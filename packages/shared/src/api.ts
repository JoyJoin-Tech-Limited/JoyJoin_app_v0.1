import type { LevelConfig, RedeemableItem } from './gamification'
import {
  getInterestById,
  MACRO_CATEGORY_LABELS,
  validateInterestIds,
  type MacroCategory,
} from './interests'
import type { ProfileTaglineResponse } from './ai/onboarding'
import type { OnboardingNextStep } from './onboarding'
import type { User } from './schema'
import type { GroupAnalysisResponse } from './types/groupAnalysis'
import type { MascotBackstory } from './mascotConfig'
import type { TierDisplayFlags } from './socialIcebreakerTierManifest'
import type { XiaoyueAnalysisPublicResult } from './personality/discovery'
import { z } from 'zod'

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
  wechatOrderId?: string
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
export type EventPackPlanKey = 'pack_3' | 'pack_6'
export type SubscriptionPlanIdentifier = SubscriptionPlanType | VipSubscriptionPlanKey

const EVENT_PACK_PLAN_TYPE_SET = new Set<EventPackPlanKey>(['pack_3', 'pack_6'])

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

export function normalizeSubscriptionPlanType(
  planType: string | null | undefined
): SubscriptionPlanType | null {
  if (typeof planType !== 'string') {
    return null
  }

  const normalized = planType.trim() as SubscriptionPlanIdentifier
  return SUBSCRIPTION_PLAN_IDENTIFIER_MAP[normalized] ?? null
}

export function isEventPackPlanType(
  planType: string | null | undefined
): planType is EventPackPlanKey {
  if (typeof planType !== 'string') {
    return false
  }

  return EVENT_PACK_PLAN_TYPE_SET.has(planType.trim() as EventPackPlanKey)
}

function pricingPlanMatches(plan: Pick<PricingPlan, 'planType'>, targetPlanType: string): boolean {
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

export const SENSITIVE_AUTH_USER_FIELD_NAMES = [
  'password',
  'passwordHash',
  'wechatOpenId',
  'wechatSessionKey',
  'sessionKey',
  'session_key',
  'accessToken',
  'access_token',
  'refreshToken',
  'refresh_token',
  'secretKey',
  'secret_key',
  'credential',
  'credentials',
] as const

export type SensitiveAuthUserField = (typeof SENSITIVE_AUTH_USER_FIELD_NAMES)[number]

export type SanitizedAuthUser = Omit<User, SensitiveAuthUserField>

export interface AuthUserResponse extends SanitizedAuthUser {
  nextStep: OnboardingNextStep
  profileEssentialComplete: boolean
  profileExtendedComplete: boolean
  activeAssessmentSessionId: string | null
  paymentsEnabled: boolean
  birthYear?: number | string | null
  age?: number | string | null
  nickname?: string | null
  topInterests?: string[] | null
  primaryInterests?: string[] | null
  interests?: unknown[] | null
  /** Server-resolved mascot display name (China market). */
  mascotDisplayName?: string
  /** Server-resolved mascot backstory / lore. */
  mascotBackstory?: MascotBackstory
  /** Server-resolved tier display flags. */
  tierDisplayFlags?: TierDisplayFlags
  /** Cached Xiaoyue AI analysis (null when not yet computed). */
  xiaoyueAnalysis?: XiaoyueAnalysisPublicResult | null
  /** Match Compass v1 kill-switch — false hides the dashboard entirely. */
  matchCompassEnabled?: boolean
  /** Number of onboarding restarts remaining (capped at 5). */
  restartsRemaining?: number
  /** Feature flags exposed to the client. */
  features?: {
    restartOnboarding?: boolean
    smartProfession?: boolean
    onboardingForceSkip?: boolean
    matchingLiveReveal?: boolean
    socialIcebreakerClientForceEnd?: boolean
    personalityDiceChooseMode?: boolean
    /** When true, the server uses template-driven run plan compilation (3×3 vibe×tier grid +
     *  deep_chat/play_fun/balanced vibes). When false, legacy compileAgentRunPlan() runs unchanged. */
    runPlanTemplatesEnabled?: boolean
  }
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

export type AuthUserSummary = AuthUserResponse

export interface JoinedEventSummary {
  id: string
  title?: string
  dateTime?: string
  location?: string
  status?: string
  description?: string
  [key: string]: unknown
}

export interface BlindBoxEventSummary {
  id: string
  status?: string
  dateTime?: string
  [key: string]: unknown
}

export interface BlindBoxEventDetail {
  id: string
  title?: string
  dateTime?: string
  location?: string
  type?: string
  status?: string
  attendeeCount?: number
  description?: string
  [key: string]: unknown
}

export interface NotificationCountsResponse {
  discover: number
  activities: number
  chat: number
  total: number
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

export function getCurrentUser(api: ApiTransport): Promise<AuthUserResponse> {
  return api<AuthUserResponse>({ path: '/api/auth/user' })
}

/** AI-generated profile insight for review / portrait surfaces (presentation-only). */
export function getProfileTagline(api: ApiTransport): Promise<ProfileTaglineResponse> {
  return api<ProfileTaglineResponse>({ path: '/api/onboarding/profile-tagline' })
}

export interface UserInterestsResponse {
  id?: string
  userId?: string
  totalHeat: number
  totalSelections: number
  categoryHeat: Record<string, number>
  selections: StructuredInterestSelection[]
  topPriorities?: StructuredInterestTopPriority[] | null
  createdAt?: string | null
  updatedAt?: string | null
}

export function getUserInterests(api: ApiTransport): Promise<UserInterestsResponse> {
  return api<UserInterestsResponse>({ path: '/api/user/interests' })
}

export function getJoinedEvents(api: ApiTransport): Promise<JoinedEventSummary[]> {
  return api<JoinedEventSummary[]>({ path: '/api/events/joined' })
}

export function getMyBlindBoxEvents(api: ApiTransport): Promise<BlindBoxEventSummary[]> {
  return api<BlindBoxEventSummary[]>({ path: '/api/my-events' })
}

export function getNotificationCounts(api: ApiTransport): Promise<NotificationCountsResponse> {
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
  /** Xiaoyue commentary for the selected option, shown in the mascot speech bubble */
  commentary?: string
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
  relationshipStatus?: string
  educationLevel?: string
  occupationId?: string
  workMode?: string
  intent?: string[]
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

export type InterestSelectionLevel = 1 | 2 | 3

export interface InterestSelectionDraft {
  topicId: string
  level?: InterestSelectionLevel
}

export interface StructuredInterestSelection {
  topicId: string
  emoji: string
  label: string
  fullName: string
  category: string
  categoryId: MacroCategory
  level: InterestSelectionLevel
  heat: 3 | 10 | 25
}

export interface StructuredInterestTopPriority {
  topicId: string
  label: string
  heat: 25
}

export interface StructuredInterestsPayload {
  totalHeat: number
  totalSelections: number
  categoryHeat: Record<string, number>
  selections: StructuredInterestSelection[]
  topPriorities?: StructuredInterestTopPriority[]
}

export interface InterestsPayload {
  interests: StructuredInterestsPayload
}

export type InterestsPayloadInput =
  | InterestsPayload
  | { interests: StructuredInterestsPayload | string[] | InterestSelectionDraft[] }
  | string[]
  | InterestSelectionDraft[]

const INTEREST_HEAT_BY_LEVEL: Record<InterestSelectionLevel, 3 | 10 | 25> = {
  1: 3,
  2: 10,
  3: 25,
}

export const INTEREST_CATEGORY_EMOJIS: Record<MacroCategory, string> = {
  food: '🍜',
  entertainment: '🎮',
  lifestyle: '🌿',
  culture: '🎭',
  social: '👥',
}

function normalizeInterestSelectionLevel(level: unknown): InterestSelectionLevel {
  return level === 2 || level === 3 ? level : 1
}

function isStructuredInterestsPayload(value: unknown): value is StructuredInterestsPayload {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false
  }

  const payload = value as Partial<StructuredInterestsPayload>
  return (
    typeof payload.totalHeat === 'number' &&
    typeof payload.totalSelections === 'number' &&
    Array.isArray(payload.selections) &&
    typeof payload.categoryHeat === 'object' &&
    payload.categoryHeat !== null &&
    !Array.isArray(payload.categoryHeat)
  )
}

export function buildStructuredInterestsPayload(
  input: Array<string | InterestSelectionDraft>
): StructuredInterestsPayload {
  const selectionLevels = new Map<string, InterestSelectionLevel>()

  for (const item of input) {
    const topicId = typeof item === 'string' ? item : item.topicId
    if (typeof topicId !== 'string' || topicId.trim() === '') {
      continue
    }

    const normalizedTopicId = topicId.trim()
    const level = normalizeInterestSelectionLevel(typeof item === 'string' ? 1 : item.level)
    const currentLevel = selectionLevels.get(normalizedTopicId)
    selectionLevels.set(
      normalizedTopicId,
      currentLevel ? (Math.max(currentLevel, level) as InterestSelectionLevel) : level
    )
  }

  const validation = validateInterestIds(Array.from(selectionLevels.keys()))

  const selections = validation.valid
    .map((topicId) => {
      const definition = getInterestById(topicId)
      if (!definition) {
        return null
      }

      const level = selectionLevels.get(topicId) ?? 1
      const heat = INTEREST_HEAT_BY_LEVEL[level]
      const categoryLabel = MACRO_CATEGORY_LABELS[definition.macroCategory] ?? definition.macroCategory

      return {
        topicId,
        emoji: INTEREST_CATEGORY_EMOJIS[definition.macroCategory] ?? '✨',
        label: definition.label,
        fullName: `${categoryLabel} · ${definition.label}`,
        category: categoryLabel,
        categoryId: definition.macroCategory,
        level,
        heat,
      }
    })
    .filter((item): item is StructuredInterestSelection => item !== null)

  const categoryHeat = selections.reduce<Record<string, number>>((acc, selection) => {
    acc[selection.categoryId] = (acc[selection.categoryId] ?? 0) + selection.heat
    return acc
  }, {})

  const totalHeat = selections.reduce((sum, selection) => sum + selection.heat, 0)
  const topPriorities = selections
    .filter((selection) => selection.level === 3)
    .map((selection) => ({
      topicId: selection.topicId,
      label: selection.label,
      heat: 25 as const,
    }))

  return {
    totalHeat,
    totalSelections: selections.length,
    categoryHeat,
    selections,
    ...(topPriorities.length > 0 ? { topPriorities } : {}),
  }
}

function normalizeInterestsPayloadInput(data: InterestsPayloadInput): InterestsPayload {
  if (Array.isArray(data)) {
    return {
      interests: buildStructuredInterestsPayload(data),
    }
  }

  if (data && typeof data === 'object' && 'interests' in data) {
    const interests = data.interests as unknown

    if (Array.isArray(interests)) {
      return {
        interests: buildStructuredInterestsPayload(interests as Array<string | InterestSelectionDraft>),
      }
    }

    if (isStructuredInterestsPayload(interests)) {
      return { interests }
    }
  }

  throw new Error('Invalid interests payload')
}

export function submitInterests(
  api: ApiTransport,
  data: InterestsPayloadInput
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: '/api/user/interests',
    method: 'POST',
    data: normalizeInterestsPayloadInput(data),
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

export type PoolNarrativePivot = 'rare' | 'present' | 'dominant' | 'empty'
export type PoolUserTypeRarity = 'rare' | 'present' | 'dominant'

export interface EventPoolSummary {
  id: string
  title?: string
  eventType?: string
  city?: string
  district?: string
  dateTime?: string
  status?: string
  description?: string
  /** Normalized participant count for card/progress display. */
  maxParticipants?: number
  /** Normalized current registrations for card/progress display. */
  currentParticipants?: number
  registrationCount?: number
  spotsLeft?: number
  sampleArchetypes?: string[]
  topArchetypes?: Array<{ archetype: string; count: number }>
  accentFamily?: 'warm' | 'cool' | 'fire' | 'calm'
  aiHeadline?: string | null
  hasUserArchetypeMatch?: boolean
  // ── Oracle Card fields (Phase 1) ──
  price?: number | null
  userTypeCount?: number
  userTypeRarity?: PoolUserTypeRarity
  highChemistryCount?: number
  topComplementaryType?: string | null
  narrativePivot?: PoolNarrativePivot
  hoursUntilDeadline?: number
  [key: string]: unknown
}

export interface SimilarPoolSummary {
  id: string
  title?: string
  eventType?: string
  city?: string
  district?: string | null
  dateTime?: string
  registrationCount?: number
}

export interface MyConnection {
  id: string
  eventId: string
  eventType?: string | null
  eventDate?: string | null
  peerId: string
  peerDisplayName?: string | null
  peerArchetype?: string | null
  peerWechatId?: string | null
  connectionReasons?: string[] | null
  nextStepPreference?: string | null
  createdAt?: Date | string | null
}

export type EventThemeVibe = 'playful' | 'professional' | 'creative' | 'adventurous'
export type PoolMatchStatus = 'pending' | 'matched' | 'completed' | 'unmatched'
export type PoolInvitationRole = 'inviter' | 'invitee'
export type PoolGroupStatus = 'confirmed' | 'completed' | 'cancelled'

export interface PoolRegistrationSummary {
  id: string
  poolId: string
  budgetRange?: string[] | null
  preferredLanguages?: string[] | null
  eventIntent?: string[] | null
  matchStatus?: PoolMatchStatus
  assignedGroupId?: string | null
  matchScore?: number | null
  registeredAt?: string | null
  poolTitle?: string | null
  poolEventType?: string | null
  poolCity?: string | null
  poolDistrict?: string | null
  poolDateTime?: string | null
  poolStatus?: string | null
  theme?: string | null
  subtitle?: string | null
  themeEmoji?: string | null
  highlights?: string[] | null
  vibe?: EventThemeVibe | null
  venueName?: string | null
  venueAddress?: string | null
  finalDateTime?: string | null
  invitationRole?: PoolInvitationRole | null
  relatedUserName?: string | null
}

export interface PoolGroupMemberSummary {
  userId: string
  displayName?: string | null
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
}

export interface PoolGroupSummary {
  id: string
  groupNumber: number
  memberCount: number
  matchScore?: number | null
  avgPairScore?: number | null
  diversityScore?: number | null
  energyBalance?: number | null
  matchExplanation?: string | null
  theme?: string | null
  subtitle?: string | null
  vibe?: EventThemeVibe | null
  themeEmoji?: string | null
  highlights?: string[] | null
  venueName?: string | null
  venueAddress?: string | null
  finalDateTime?: string | null
  status?: PoolGroupStatus | null
}

export interface PoolGroupSourceSummary {
  id: string
  title: string
  description?: string | null
  eventType?: string | null
  city?: string | null
  district?: string | null
  dateTime?: string | null
}

export interface PoolGroupDetailsResponse {
  group: PoolGroupSummary
  pool: PoolGroupSourceSummary
  members: PoolGroupMemberSummary[]
}

export interface ConfirmPoolGroupAttendanceResponse {
  success: boolean
  blindBoxEventId: string | null
  attendanceStatus?: 'confirmed'
}

export interface EventPoolRegistrationPayload {
  invitationCode?: string
  budgetRange?: string[]
  preferredLanguages?: string[]
  eventIntent?: string[]
  cuisinePreferences?: string[]
  dietaryRestrictions?: string[]
  tasteIntensity?: string[]
  barThemes?: string[]
  alcoholComfort?: string[] | string
  barBudgetRange?: string[]
}

export interface NormalizedEventPoolRegistrationPayload
  extends Omit<EventPoolRegistrationPayload, 'alcoholComfort'> {
  alcoholComfort?: string[]
}

const EVENT_POOL_REGISTRATION_ARRAY_FIELDS = [
  'budgetRange',
  'preferredLanguages',
  'eventIntent',
  'cuisinePreferences',
  'dietaryRestrictions',
  'tasteIntensity',
  'barThemes',
  'barBudgetRange',
] as const

function normalizeStringArrayInput(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) {
    return undefined
  }

  return value
    .filter((item): item is string => typeof item === 'string')
    .map((item) => item.trim())
    .filter((item) => item.length > 0)
}

function normalizeSingleOrArrayStringInput(value: unknown): string[] | undefined {
  if (typeof value === 'string') {
    const trimmedValue = value.trim()
    return trimmedValue === '' ? [] : [trimmedValue]
  }

  return normalizeStringArrayInput(value)
}

export function normalizeEventPoolRegistrationPayload(
  payload: EventPoolRegistrationPayload | null | undefined
): NormalizedEventPoolRegistrationPayload {
  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return {}
  }

  const normalized: NormalizedEventPoolRegistrationPayload = {}
  const invitationCode =
    typeof payload.invitationCode === 'string' ? payload.invitationCode.trim() : ''

  if (invitationCode !== '') {
    normalized.invitationCode = invitationCode
  }

  for (const field of EVENT_POOL_REGISTRATION_ARRAY_FIELDS) {
    const normalizedValue = normalizeStringArrayInput(payload[field])
    if (normalizedValue !== undefined) {
      normalized[field] = normalizedValue
    }
  }

  const normalizedAlcoholComfort = normalizeSingleOrArrayStringInput(payload.alcoholComfort)
  if (normalizedAlcoholComfort !== undefined) {
    normalized.alcoholComfort = normalizedAlcoholComfort
  }

  return normalized
}

export interface ReverseGeocodeResponse {
  success: boolean
  city?: string
  district?: string
  source?: string
}

export function reverseGeocode(
  api: ApiTransport,
  latitude: number,
  longitude: number
): Promise<ReverseGeocodeResponse> {
  return api<ReverseGeocodeResponse>({
    path: '/api/geo/reverse-geocode',
    method: 'POST',
    data: { latitude, longitude },
  })
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

export function getPoolGroupAnalysis(
  api: ApiTransport,
  groupId: string
): Promise<GroupAnalysisResponse> {
  return api<GroupAnalysisResponse>({
    path: `/api/pool-groups/${encodeURIComponent(groupId)}/analysis`,
  })
}

export function registerForPool(
  api: ApiTransport,
  poolId: string,
  payload?: EventPoolRegistrationPayload
): Promise<{ id: string }> {
  const request: ApiTransportRequest = {
    path: `/api/event-pools/${encodeURIComponent(poolId)}/register`,
    method: 'POST',
  }

  if (payload !== undefined) {
    request.data = normalizeEventPoolRegistrationPayload(payload)
  }

  return api<{ id: string }>(request)
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

// ── Match Compass ──

export type MatchCompassTemperatureBand = 'cold' | 'mild' | 'warm' | 'fire'
export type MatchCompassGenderComposition = 'mixed' | 'female_only' | 'no_pref'

export interface MatchCompassResponse {
  strictness: number
  preferredDistricts: string[] | null
  genderComposition: MatchCompassGenderComposition | null
  acceptPairs: boolean | null
  ageMatchPreference: string | null
  tableVibePreference: string | null
  temperatureBand: MatchCompassTemperatureBand
  temperatureScore: number
  eligibleUserCount: number
  isLocked: boolean
  primaryArchetype: string | null
}

export interface UpdateMatchCompassPreferencesRequest {
  strictness?: number
  preferredDistricts?: string[] | null
  genderComposition?: MatchCompassGenderComposition | null
  acceptPairs?: boolean | null
  ageMatchPreference?: string | null
  tableVibePreference?: string | null
}

export function getMatchCompass(
  api: ApiTransport,
  poolId: string
): Promise<MatchCompassResponse> {
  return api<MatchCompassResponse>({
    path: `/api/match-compass/${encodeURIComponent(poolId)}`,
  })
}

export function updateMatchCompassPreferences(
  api: ApiTransport,
  poolId: string,
  payload: UpdateMatchCompassPreferencesRequest
): Promise<MatchCompassResponse> {
  return api<MatchCompassResponse>({
    path: `/api/match-compass/${encodeURIComponent(poolId)}/preferences`,
    method: 'PATCH',
    data: payload,
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

// ── Occupation search ──

export interface OccupationSearchMatch {
  occupationId: string
  displayName: string
  industryId: string
  confidence: number
}

export interface OccupationSearchResponse {
  query: string
  matches: OccupationSearchMatch[]
  matchSource: 'exact' | 'embedding' | 'none'
}

export function searchOccupation(
  api: ApiTransport,
  query: string
): Promise<OccupationSearchResponse> {
  return api<OccupationSearchResponse>({
    path: '/api/occupation/search',
    method: 'POST',
    data: { query },
  })
}

// ---------------------------------------------------------------------------
// Discover Predictive Shell — composite endpoint schemas
// ---------------------------------------------------------------------------
// Why: Discover currently fires 3 parallel requests.  A single composite
// endpoint cuts TTFB, eliminates request overhead, and lets the mini-program
// prefetch the entire screen payload from the Landing page.
// ---------------------------------------------------------------------------

export const DiscoverShellPoolItemSchema = z.object({
  id: z.string(),
  title: z.string(),
  eventType: z.string(),
  city: z.string(),
  district: z.string().nullable().optional(),
  dateTime: z.string(),
  status: z.string(),
  registrationCount: z.number(),
  currentParticipants: z.number(),
  maxParticipants: z.number(),
  spotsLeft: z.number(),
  sampleArchetypes: z.array(z.string()),
  topArchetypes: z.array(z.object({ archetype: z.string(), count: z.number() })),
  accentFamily: z.enum(['warm', 'cool', 'fire', 'calm']).nullable().optional(),
  aiHeadline: z.string().nullable(),
  hasUserArchetypeMatch: z.boolean(),
  price: z.number().nullable().optional(),
  userTypeCount: z.number().optional(),
  userTypeRarity: z.enum(['rare', 'present', 'dominant']).optional(),
  highChemistryCount: z.number().optional(),
  topComplementaryType: z.string().nullable().optional(),
  narrativePivot: z.enum(['rare', 'present', 'dominant', 'empty']).optional(),
  hoursUntilDeadline: z.number().optional(),
})

export const DiscoverShellQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z.coerce.number().min(1).max(20).optional(),
});

export const DiscoverShellResponseSchema = z.object({
  user: z.object({
    nextStep: z.string(),
    primaryArchetype: z.string().nullable(),
  }),
  pools: z.object({
    items: z.array(DiscoverShellPoolItemSchema),
    hasMore: z.boolean(),
    nextCursor: z.string().optional(),
  }),
  myRegistrations: z.object({
    ids: z.array(z.string()),
    statuses: z.record(z.string(), z.enum(['pending', 'confirmed', 'cancelled'])),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(), // ISO timestamp
  }),
})

export type DiscoverShellPoolItem = z.infer<typeof DiscoverShellPoolItemSchema>
export type DiscoverShellResponse = z.infer<typeof DiscoverShellResponseSchema>

// ── Profile Predictive Shell ────────────────────────────────────────────────

export const ProfileShellResponseSchema = z.object({
  user: z.any(), // AuthUserResponse — validated at runtime by the server
  coupons: z.object({
    count: z.number(),
    availableCount: z.number(),
    coupons: z.array(z.any()),
  }),
  stats: z.object({
    eventsJoined: z.number(),
    connectionsCount: z.number(),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(),
  }),
});

export type ProfileShellResponse = z.infer<typeof ProfileShellResponseSchema>

// ── Events Predictive Shell ─────────────────────────────────────────────────

export const EventsShellResponseSchema = z.object({
  user: z.object({
    nextStep: z.string(),
    primaryArchetype: z.string().nullable(),
  }),
  joinedEvents: z.array(z.any()),
  notifications: z.object({
    discover: z.number(),
    activities: z.number(),
    chat: z.number(),
    total: z.number(),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(),
  }),
});

export type EventsShellResponse = z.infer<typeof EventsShellResponseSchema>

// ── Connections Predictive Shell ────────────────────────────────────────────

export const ConnectionsShellResponseSchema = z.object({
  user: z.object({
    nextStep: z.string(),
    primaryArchetype: z.string().nullable(),
  }),
  connections: z.array(z.any()),
  pendingRequests: z.array(z.any()),
  notifications: z.object({
    discover: z.number(),
    activities: z.number(),
    chat: z.number(),
    total: z.number(),
  }),
  meta: z.object({
    cacheKey: z.string(),
    serverTime: z.string(),
  }),
});

export type ConnectionsShellResponse = z.infer<typeof ConnectionsShellResponseSchema>
