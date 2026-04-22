/**
 * Centralized UI constants for the JoyJoin mini-program.
 *
 * This file owns all magic numbers related to:
 * - Toast / feedback timing
 * - Polling intervals
 * - Query stale times
 * - Animation durations
 * - Brand colors (for TS/TSX usage; SCSS tokens live in styles/_variables.scss)
 */

// ─── Toast / Feedback Timing ───
export const TOAST_SHORT_MS = 1800
export const TOAST_DEFAULT_MS = 2000
export const TOAST_MEDIUM_MS = 2200
export const TOAST_LONG_MS = 2500
export const TOAST_ERROR_MS = 2600
export const TOAST_FATAL_MS = 3000

// ─── Polling Intervals ───
export const POLL_PAYMENT_MS = 2000
export const POLL_PAYMENT_MAX_ATTEMPTS = 10
export const POLL_SOCIAL_SESSION_MS = 3000
export const POLL_REGISTRATION_MS = 30_000
export const POLL_NOTIFICATIONS_MS = 30_000
export const POLL_POOL_FILL_MS = 30_000

// ─── Countdown / Time Utilities ───
export const MS_PER_SECOND = 1000
export const MS_PER_MINUTE = 1000 * 60
export const MS_PER_HOUR = 1000 * 60 * 60
export const SECONDS_PER_MINUTE = 60

// ─── Query Stale Times ───
export const STALE_TIME_BRIEF_MS = 5 * 60 * 1000
export const STALE_TIME_GROUP_DETAILS_MS = 60_000
export const STALE_TIME_GROUP_ANALYSIS_MS = MS_PER_MINUTE * 7
export const STALE_TIME_PROFILE_TAGLINE_MS = MS_PER_MINUTE * 30
export const STALE_TIME_AUTH_MS = Infinity
export const STALE_TIME_DEFAULT_MS = 30_000

// ─── Animation Durations ───
export const TRANSITION_DEFAULT_MS = 220
export const SWIPER_INTERVAL_MS = 4200
export const SWIPER_TRANSITION_MS = 420
export const ANALYZING_MIN_DURATION_MS = 1200
export const ANALYZING_SKIP_DELAY_MS = 600

// ─── Currency ───
export const CENTS_PER_YUAN = 100

// ─── Brand Colors (TS/TSX runtime usage) ───
// For SCSS usage, prefer tokens in styles/_variables.scss
export const COLOR_PRIMARY = '#8B5CF6'
export const COLOR_DANGER = '#EF4444'
export const COLOR_ACCENT_PINK = '#FF6B9D'
export const COLOR_TAB_INACTIVE = '#9CA3AF'
export const COLOR_BACKGROUND = '#FAFAFA'
export const COLOR_SURFACE = '#FFFFFF'
export const COLOR_NAVBAR_BG = '#ffffff'
export const COLOR_PRIMARY_LIGHT = '#EDE9FE'

// ─── Tab Bar Config ───
export const TAB_BAR_SELECTED_COLOR = COLOR_PRIMARY
export const TAB_BAR_COLOR = COLOR_TAB_INACTIVE
export const TAB_BAR_BACKGROUND_COLOR = COLOR_SURFACE
