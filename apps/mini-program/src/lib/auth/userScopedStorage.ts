import Taro from '@tarojs/taro'
import { logInfo } from '../utils/logger'

/**
 * User-scoped storage registry (2026-09-03).
 *
 * Every Taro.setStorageSync key in the mini-program falls into one of two
 * categories:
 *
 *   USER-SCOPED — data that belongs to a specific user account. When the
 *   server says the user no longer exists (401 on /api/auth/user), ALL of
 *   these must be cleared so the next person who opens the app on this
 *   device starts with a truly fresh state.
 *
 *   DEVICE-LEVEL — preferences or flags that are not tied to any user
 *   account (e.g. motion settings, tutorial coachmarks). These survive
 *   account deletion because they describe the device, not the user.
 *
 * RULE: when adding a new Taro.setStorageSync call, add its key to the
 * correct list below. The hard-reset path (clearMiniProgramAuthSession
 * with mode:'hard') iterates USER_SCOPED_KEYS and removes every entry.
 * Keys with dynamic suffixes (e.g. group IDs) use prefix matching.
 */

// ─── User-scoped: exact keys ────────────────────────────────────────────────

/** Auth + session */
const USER_SCOPED_AUTH_KEYS = [
  'mj_auth_cache',           // cached auth user (hydration)
  'mj_session_token',        // X-Session-Token for API auth
] as const

/** Anonymous assessment / onboarding */
const USER_SCOPED_ONBOARDING_KEYS = [
  'joyjoin_v4_assessment_session',
  'joyjoin_v4_presignup_answers',
  'joyjoin_v4_presignup_skipped',
  'joyjoin_pending_onboarding_checkpoint',
  'joyjoin_welcome_back_seen',
  'joyjoin_onboarding_anonymous_id',
] as const

/** Payment */
const USER_SCOPED_PAYMENT_KEYS = [
  'pending_order',
  'pending_order_context',
] as const

/** Duo invites */
const USER_SCOPED_DUO_KEYS = [
  'jj_pending_duo_context',
] as const

/** Legal consent — user-specific (a new user on this device hasn't agreed) */
const USER_SCOPED_LEGAL_KEYS = [
  'joyjoin_legal_accepted_v1',
] as const

/** Analytics session markers */
const USER_SCOPED_ANALYTICS_KEYS = [
  'joyjoin_discover_session_start',
  'joyjoin_onboarding_session_start',
] as const

/** All exact user-scoped keys, flattened. */
export const USER_SCOPED_STORAGE_KEYS: readonly string[] = [
  ...USER_SCOPED_AUTH_KEYS,
  ...USER_SCOPED_ONBOARDING_KEYS,
  ...USER_SCOPED_PAYMENT_KEYS,
  ...USER_SCOPED_DUO_KEYS,
  ...USER_SCOPED_LEGAL_KEYS,
  ...USER_SCOPED_ANALYTICS_KEYS,
]

// ─── User-scoped: prefix keys (dynamic suffixes) ───────────────────────────

/** Keys that carry a dynamic suffix (group ID, user ID, pool ID).
 *  Prefix matching removes all variants. */
const USER_SCOPED_PREFIX_KEYS = [
  'jj_revealed_',             // squad-unboxing reveal flags per group
  'jj_deck_collapsed_',       // squad-unboxing deck collapse per group
  'jj_deck_collapse_hint_',   // squad-unboxing collapse hint per group
  'jj_group_seat_count_',     // group seat vacancy counts
  'jj_persona_pile_played',   // persona snapshot animation played flags
  'jj_flow_seen_',            // flow-animation seen flags per user+kind
  'jj_arrival_pending_',      // arrival migration pending per user
  'jj_arrival_seen_',         // arrival migration seen per user
  'jj_full_pool_dismissed_',  // full-pool banner dismissed per pool
  'jj_duo_share_',            // duo share timestamps per pool
] as const

// ─── Device-level keys (NOT cleared on user reset) ─────────────────────────

/** These survive account deletion — they describe the device, not the user.
 *  Documented here so future contributors know the boundary. */
export const DEVICE_LEVEL_STORAGE_KEYS: readonly string[] = [
  'joyjoin:mini-reveal-motion',      // OS-level reduce-motion override
  'jj_flash_intro_ack',              // flash tutorial acknowledged
  'jj_ib_host_menu_coachmark_seen_v1', // icebreaker host coachmark
  'jj_ms_evidence_hint_seen_v1',     // miniscript evidence hint
  'jj_ms_motive_hint_seen_v1',       // miniscript motive hint
  'jj_flow_street_banner_tapped:v1', // street banner tapped (device-level)
  'joyjoin_cache_meta',              // persistent asset cache metadata
  '__jj_mock_auth_for_devtools__',   // dev-only mock auth
]

// ─── Clear functions ────────────────────────────────────────────────────────

function removeStorageKey(key: string): void {
  try {
    Taro.removeStorageSync(key)
  } catch {
    /* non-critical — key may not exist */
  }
}

function removeStorageByPrefix(prefix: string): void {
  try {
    const info = Taro.getStorageInfoSync()
    const keys: string[] = info?.keys ?? []
    for (const key of keys) {
      if (key.startsWith(prefix)) {
        removeStorageKey(key)
      }
    }
  } catch {
    /* getStorageInfoSync unavailable — prefix keys may survive */
  }
}

/**
 * Clear ALL user-scoped local storage. Called by the hard-reset path when
 * the server confirms the user no longer exists (401) or on explicit logout.
 *
 * After this runs, the app is in a truly fresh state — as if the user had
 * never opened the mini-program on this device.
 */
export function clearAllUserScopedStorage(): void {
  for (const key of USER_SCOPED_STORAGE_KEYS) {
    removeStorageKey(key)
  }
  for (const prefix of USER_SCOPED_PREFIX_KEYS) {
    removeStorageByPrefix(prefix)
  }
  logInfo('[userStorage] Cleared all user-scoped storage keys', {
    exactKeys: USER_SCOPED_STORAGE_KEYS.length,
    prefixKeys: USER_SCOPED_PREFIX_KEYS.length,
  })
}
