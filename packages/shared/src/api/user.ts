import type { ApiTransport } from './core.js'
import type { LevelConfig, RedeemableItem } from '../gamification.js'
import type { ProfileShellResponse } from '../apiShell.js'
import type { ProfileTaglineResponse } from '../ai/onboarding.js'
import type { StructuredInterestSelection, StructuredInterestTopPriority } from './profile.js'

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

export interface JoinedEventSummary {
  id: string
  title?: string
  dateTime?: string
  location?: string
  status?: string
  description?: string
  eventType?: string
  city?: string
  district?: string
  venueName?: string
  venueAddress?: string
  registrationDeadline?: string
  price?: number
  matchedAt?: string
  groupId?: string
  finalDateTime?: string
  /** Pool registration ID, present only for pool-based events. */
  registrationId?: string
  /**
   * Derived user-facing status that reflects the full matching + venue lifecycle.
   * Prefer this over `status` when rendering event cards.
   */
  displayStatus?:
    | 'pending'
    | 'registered'
    | 'upcoming'
    | 'matched'
    | 'confirmed'
    | 'venue_unlocked'
    | 'completed'
    | 'attended'
    | 'cancelled'
    | 'declined'
    | 'no_show'
  /**
   * Venue assignment state for pool events. Only meaningful when `groupId` is set.
   */
  venueAssignmentStatus?: 'pending' | 'assigned' | 'unassigned' | 'manual_override'
  [key: string]: unknown
}

/** @deprecated Use {@link JoinedEventSummary} + {@link getJoinedEvents} instead — `/api/my-events` has no server handler. */
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

/** @deprecated Use {@link getJoinedEvents} instead — `/api/my-events` has no server handler. */
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

export interface WelcomeCouponResponse {
  id: string
  code: string
  discountType: string
  discountValue: number
  source: string
  isNewlyAwarded: boolean
  createdAt: string
}

/** Claim (or re-fetch) the lifetime welcome coupon awarded on first 入场卡 view. */
export function claimWelcomeCoupon(api: ApiTransport): Promise<WelcomeCouponResponse> {
  return api<WelcomeCouponResponse>({ path: '/api/user/welcome-coupon' })
}

/** Composite profile shell — user, coupons, and stats in one request. */
export function getProfileShell(api: ApiTransport): Promise<ProfileShellResponse> {
  return api<ProfileShellResponse>({ path: '/api/shell/profile' })
}

/** AI-generated profile insight for review / portrait surfaces (presentation-only). */
export function getProfileTagline(api: ApiTransport): Promise<ProfileTaglineResponse> {
  return api<ProfileTaglineResponse>({ path: '/api/onboarding/profile-tagline' })
}
