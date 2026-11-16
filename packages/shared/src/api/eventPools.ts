import { z } from 'zod'
import type { ApiTransport, ApiTransportRequest } from './core.js'
import type { GroupAnalysisResponse } from '../types/groupAnalysis.js'

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
  /**
   * 场地专属优惠 · 池级保底（S2 服务端计算，S5 报名页消费）。
   * true 表示该池建池时已锁定保底场地与有效权益，客户端才可渲染「专属优惠」承诺。
   * 客户端不得自行推测候选场地；缺省 / false 一律视为无承诺。
   */
  hasGuaranteedDeal?: boolean
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

export interface ConnectionSummary {
  id: string
  peerName: string | null
  peerArchetype: string | null
  eventTitle: string | null
  wechatId: string | null
  peerCity: string | null
  peerBio: string | null
  peerAgeRange: string | null
  /**
   * Top 1–2 positive preset impression tags the PEER gave this user in the
   * event-feedback wrapup step (e.g. ['温暖', '会聊天']). Display-only
   * 印象标签回流 on the connections tab (2026-10-16 premium-uplift spec #18).
   * null/empty when the peer left no tags — clients render nothing.
   */
  peerImpressionTags?: string[] | null
}

export type EventThemeVibe = 'playful' | 'professional' | 'creative' | 'adventurous'
export type PoolMatchStatus = 'pending' | 'matched' | 'completed' | 'unmatched'
export type PoolInvitationRole = 'inviter' | 'invitee'
export type PoolGroupStatus = 'confirmed' | 'completed' | 'cancelled'
export type PoolPersonaStateBand = 'seed' | 'glimmer' | 'outline' | 'clear' | 'full'

export interface PoolPersonaDimensionCluster {
  label: string
  count: number
  percentage: number
}

export interface PoolPersonaDimension {
  key: 'archetype' | 'industry' | 'intent' | 'age' | 'gender'
  label: string
  total: number
  disclosed: boolean
  clusters: PoolPersonaDimensionCluster[]
}

export interface PoolPersonaSnapshotResponse {
  stateBand: PoolPersonaStateBand
  totalRegistrants: number
  dimensions: PoolPersonaDimension[]
  thresholds: {
    archetypeTotal: number
    archetypeTopCount: number
    industryTotal: number
    industryClusterMin: number
    intentTotal: number
    intentClusterMin: number
    demographicTotal: number
    demographicClusterMin: number
    fullSheetTotal: number
  }
  latestRegistrationAt: string | null
  snapshotComputedAt: string
  /** The requesting user's archetype, if known, for client-side personalization. */
  userArchetype?: string | null
}

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
  /**
   * Server-computed cancel policy (post-reveal Phase 0, sprint contract AC-9).
   * Derived from the two refund flags × this registration's matchStatus — the
   * client never reads feature flags directly. Server encoding (WS-B): the
   * field is present ONLY when either Phase 0 flag is on and the pool is not
   * a test pool; flags-off responses omit it so legacy clients are
   * unaffected. Absent on legacy servers: clients MUST treat absence as
   * 'refundable' (legacy pre-reveal cancel UX).
   */
  cancelPolicy?: 'refundable' | 'non_refundable' | null
}

export interface PoolGroupMemberSummary {
  userId: string
  displayName?: string | null
  avatarUrl?: string | null
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

/**
 * 场地专属优惠 · 小组维度唯一读取模型（S2 服务端装配）。
 * 只有两种形态：discount（统一折扣）/ set_menu（定制套餐）。
 * 规则只有一条「仅限本场活动 · 本桌使用」，由 copy/venueDealCopy.ts 固定输出，
 * 因此这里刻意不含门槛、有效期、每人限用等字段。
 * null 表示本场没有可用权益；读取失败由客户端单独走错误态，不得当作 null 静默。
 */
export interface VenueDealSummary {
  id: string
  kind: 'discount' | 'set_menu'
  /** discount 专用：20 = 8 折，整数 1–90 */
  valueOffPercent?: number
  /** set_menu 专用：一口价（分） */
  setMenuPriceCents?: number
  /** set_menu 专用：划线原价（分），必大于一口价 */
  setMenuOriginalPriceCents?: number
  /** ≤20 字：折扣 = 权益名，套餐 = 套餐名 */
  title: string
  /** ≤20 字：套餐内容一句 */
  description?: string | null
  method: 'show_page' | 'code'
  /** method = code 时必存在，出示页第一焦点 */
  code?: string
  venueName: string
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
  venueAssignmentStatus?: string | null
  venueAssignmentReason?: string | null
  /** 本场专属优惠；venueAssignmentStatus='assigned' 且权益有效时才由服务端返回，否则为 null */
  venueDeal?: VenueDealSummary | null
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
  /** S3：池级保底承诺真值（服务端计算）。缺省/false 一律无承诺。 */
  hasGuaranteedDeal?: boolean
  /** S3：保底绑定是否存在（不论权益当前是否可兑现）。撤销后仍为 true → 「已调整」 */
  hasGuaranteedDealBinding?: boolean
}

export interface PoolGroupDetailsResponse {
  group: PoolGroupSummary
  pool: PoolGroupSourceSummary
  members: PoolGroupMemberSummary[]
  /**
   * Reveal fact for the viewer of this response: when they opened this table,
   * or null while it is still sealed for them. Server-owned so a second device
   * does not re-offer a ceremony that already happened.
   */
  viewer?: { revealedAt: string | null }
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

export const EVENT_POOL_REGISTRATION_ARRAY_FIELDS = [
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

/**
 * Claim the reveal for this viewer. Idempotent on the server: the first call
 * stamps the time, later calls return that same timestamp, so the receipt
 * window cannot be restarted by a retry.
 */
export function markPoolGroupRevealed(
  api: ApiTransport,
  groupId: string
): Promise<{ revealedAt: string | null }> {
  return api<{ revealedAt: string | null }>({
    path: `/api/pool-groups/${encodeURIComponent(groupId)}/reveal`,
    method: 'POST',
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

export interface DuoBindingResponse {
  state: 'bound' | 'unavailable'
  reason?: 'already_bound' | 'partner_taken' | 'expired' | 'pool_mismatch'
}

export interface RegisterForPoolResponse {
  id: string
  /** Additive duo outcome; omitted for non-duo registration and older servers. */
  duoBinding?: DuoBindingResponse
}

export function registerForPool(
  api: ApiTransport,
  poolId: string,
  payload?: EventPoolRegistrationPayload
): Promise<RegisterForPoolResponse> {
  const request: ApiTransportRequest = {
    path: `/api/event-pools/${encodeURIComponent(poolId)}/register`,
    method: 'POST',
  }

  if (payload !== undefined) {
    request.data = normalizeEventPoolRegistrationPayload(payload)
  }

  return api<RegisterForPoolResponse>(request)
}

export interface RegisterWithPaymentResponse {
  paymentId: string
  wechatOrderId: string
  timeStamp: string
  nonceStr: string
  package: string
  signType: string
  paySign: string
  outTradeNo: string
}

export interface RegisterWithPaymentRequest extends EventPoolRegistrationPayload {
  couponCode?: string
}

export function registerForPoolWithPayment(
  api: ApiTransport,
  poolId: string,
  payload?: RegisterWithPaymentRequest
): Promise<RegisterWithPaymentResponse> {
  const normalized = normalizeEventPoolRegistrationPayload(payload)
  const request: ApiTransportRequest = {
    path: `/api/event-pools/${encodeURIComponent(poolId)}/register-with-payment`,
    method: 'POST',
    data: {
      ...normalized,
      couponCode: payload?.couponCode ?? undefined,
    },
  }

  return api<RegisterWithPaymentResponse>(request)
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

/**
 * Release a self-reported RSVP (2026-11-11, D-I1B). Confirming attendance is a
 * commitment, not a one-way switch — the server only accepts this before the
 * event starts and never downgrades an operator-written `late`/`absent`.
 */
export function releasePoolGroupAttendance(
  api: ApiTransport,
  groupId: string
): Promise<ConfirmPoolGroupAttendanceResponse> {
  return api<ConfirmPoolGroupAttendanceResponse>({
    path: `/api/pool-groups/${encodeURIComponent(groupId)}/release-attendance`,
    method: 'POST',
  })
}

export function getPoolPersonaSnapshot(
  api: ApiTransport,
  poolId: string
): Promise<PoolPersonaSnapshotResponse> {
  return api<PoolPersonaSnapshotResponse>({
    path: `/api/event-pools/${encodeURIComponent(poolId)}/persona-snapshot`,
  })
}

/**
 * P1c 游客预告卡 (对标平台 AC-08): guest-safe event preview DTO served by
 * GET /api/event-pools/guest-preview (no auth). Minimal field set, zero PII —
 * `.strict()` turns the schema into a client-server contract guard: any extra
 * key (e.g. a future regression leaking user fields) fails parse loudly.
 */
export const guestEventPreviewItemSchema = z
  .object({
    id: z.string(),
    title: z.string(),
    dateTime: z.string(),
    district: z.string().nullable(),
    eventType: z.string(),
    spotsLeft: z.number().int().min(0),
  })
  .strict()

export type GuestEventPreviewItem = z.infer<typeof guestEventPreviewItemSchema>

export const guestEventPreviewResponseSchema = z.array(guestEventPreviewItemSchema)

/**
 * 撞满后的改签出口（D4, 2026-11-11）。
 *
 * 满员响应里附带的「还有空位的场」：同城、尽量同区、近 7 天内、`spotsLeft > 0`，
 * 最多 3 个。客户端只把它渲染成「换一场」，绝不自动替用户改签。
 */
export interface PoolOverflowAlternative {
  poolId: string
  title: string
  eventType: string | null
  dateTime: string
  city: string | null
  district: string | null
  price: number | null
  spotsLeft: number
}

export const poolOverflowAlternativeSchema = z.object({
  poolId: z.string(),
  title: z.string(),
  eventType: z.string().nullable(),
  dateTime: z.string(),
  city: z.string().nullable(),
  district: z.string().nullable(),
  price: z.number().nullable(),
  spotsLeft: z.number().int().min(0),
})

export const poolOverflowAlternativesSchema = z.array(poolOverflowAlternativeSchema)

export function getGuestEventPreview(
  api: ApiTransport,
  city?: string
): Promise<GuestEventPreviewItem[]> {
  const path =
    typeof city === 'string' && city.trim() !== ''
      ? `/api/event-pools/guest-preview?city=${encodeURIComponent(city.trim())}`
      : '/api/event-pools/guest-preview'
  return api<GuestEventPreviewItem[]>({ path })
}
