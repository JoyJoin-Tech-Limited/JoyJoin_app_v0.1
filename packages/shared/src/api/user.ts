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
  /**
   * Venue coordinates, joined from the canonical `venues` row. Present only
   * once a venue is assigned AND geocoded; the card uses them for real map
   * navigation and falls back to copying the address when absent.
   */
  venueLatitude?: number
  venueLongitude?: number
  registrationDeadline?: string
  price?: number
  matchedAt?: string
  groupId?: string
  /**
   * When THIS viewer opened the formed table (拆盒), server-owned. Null or
   * absent means the table is still sealed for them, so the Events card offers
   * the ceremony instead of the settled view. A device-local flag used to stand
   * in for this and re-offered the ceremony on every new device.
   */
  revealedAt?: string | null
  finalDateTime?: string
  /** Pool registration ID, present only for pool-based events. */
  registrationId?: string
  /**
   * Group size for pool events. Only meaningful when the user has been matched
   * into a group (i.e. groupId is set).
   */
  groupSize?: number
  /**
   * Match-time table theme (pool events only). Rendered as the theme pill above
   * the card body so a finished table keeps the identity it was formed around.
   */
  theme?: string
  /** Short vibe label for the matched table (e.g. 超高能). */
  themeVibe?: string
  /**
   * Theme tagline (15-25 chars) generated alongside the theme title. Used as
   * the events-card rationale line, which answers "why this theme" with the
   * table's own traits instead of a machine-provenance sentence.
   */
  themeSubtitle?: string
  /**
   * 3-4 short group traits the theme was generated around (e.g. 咖啡脑暴).
   * Rendered as the rationale line when `themeSubtitle` is absent.
   */
  themeHighlights?: string[]
  /** Overall table chemistry score 0-100 (pool events only). */
  matchScore?: number
  /**
   * Archetype ids of the matched table, capped at 6. Powers the 同桌 face row —
   * the viewer is already a member, so no masking is applied.
   */
  memberArchetypes?: string[]
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
  /**
   * True when the user is eligible to submit feedback for this event and has
   * not yet done so (2026-10-16 feedback activation). Drives the 足迹「去评价」
   * pill; server-derived (pool events map registration → canonical event id),
   * absent/false for events where feedback does not apply.
   */
  feedbackPending?: boolean
  [key: string]: unknown
}

/**
 * Feedback lifecycle state for one event + viewer (2026-10-16 feedback
 * activation). Server-computed by `GET /api/events/:eventId/feedback-state`
 * (`lib/feedbackStateResolver.ts` is the single source of truth) — the client
 * never derives this from dateTime itself.
 *   locked     — eligible, but the event is not over yet (opens at dateTime + 3h)
 *   open       — window open, not yet submitted
 *   submitted  — already submitted by this user
 *   ineligible — no eligibility (not matched / refunded / cancelled / collapsed)
 *   closed     — reserved for a future feedback window close
 */
export type EventFeedbackState = 'locked' | 'open' | 'submitted' | 'ineligible' | 'closed'

export interface EventFeedbackStateResponse {
  state: EventFeedbackState
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

/** One notification row in the list page (2026-09-17 notification list). */
export interface NotificationListItem {
  id: string
  category: string
  type: string
  title: string
  message: string | null
  relatedResourceId: string | null
  isRead: boolean
  createdAt: string
}

export interface NotificationListResponse {
  items: NotificationListItem[]
  /** Pass as `before` to fetch the next page; null = no more. */
  nextCursor: string | null
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

/**
 * Per-event feedback lifecycle for the signed-in viewer (2026-10-16 feedback
 * activation). Accepts any of the three event id families — the route
 * canonicalizes internally (events.id / blind_box_events.id / event_pools.id).
 */
export function getEventFeedbackState(
  api: ApiTransport,
  eventId: string,
): Promise<EventFeedbackStateResponse> {
  return api<EventFeedbackStateResponse>({
    path: `/api/events/${encodeURIComponent(eventId)}/feedback-state`,
  })
}

/** @deprecated Use {@link getJoinedEvents} instead — `/api/my-events` has no server handler. */
export function getMyBlindBoxEvents(api: ApiTransport): Promise<BlindBoxEventSummary[]> {
  return api<BlindBoxEventSummary[]>({ path: '/api/my-events' })
}

export function getNotificationCounts(api: ApiTransport): Promise<NotificationCountsResponse> {
  return api<NotificationCountsResponse>({ path: '/api/notifications/counts' })
}

export function getNotifications(
  api: ApiTransport,
  params: { limit?: number; before?: string } = {}
): Promise<NotificationListResponse> {
  const parts: string[] = []
  if (params.limit) parts.push(`limit=${encodeURIComponent(String(params.limit))}`)
  if (params.before) parts.push(`before=${encodeURIComponent(params.before)}`)
  const suffix = parts.length > 0 ? `?${parts.join('&')}` : ''
  return api<NotificationListResponse>({ path: `/api/notifications${suffix}` })
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

export function markNotificationRead(
  api: ApiTransport,
  id: string
): Promise<{ success: boolean }> {
  return api<{ success: boolean }>({
    path: `/api/notifications/${encodeURIComponent(id)}/read`,
    method: 'POST',
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
  /**
   * Coupon validity end (ISO-8601) sourced from the coupon row's
   * `valid_until`; null when the coupon has no expiry configured. Additive
   * (2026-10-09) for the WelcomeGiftCard 有效期至 display — absent on old
   * servers, so consumers must treat it as optional.
   */
  validUntil?: string | null
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
