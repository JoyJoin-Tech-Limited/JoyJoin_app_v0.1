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
  venueAssignmentStatus?: string | null
  venueAssignmentReason?: string | null
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
