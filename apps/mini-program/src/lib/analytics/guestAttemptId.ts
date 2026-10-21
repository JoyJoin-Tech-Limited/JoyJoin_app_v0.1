import Taro from '@tarojs/taro'

/**
 * Guest-attempt correlation ID (T46 conversion funnel, 2026-10-20).
 *
 * The `discover` analytics channel never resolves `user_id`/`session_id`
 * (route registration order runs the handler before express-session — see
 * `docs/deliberations/2026-10-20-t46-analytics-gap-audit.md` §5.2). A guest's
 * `login_tap` → `login_success` pair therefore cannot be bridged by userId and
 * must be correlated by a client-generated ID carried in metadata, the same
 * way the icebreaker funnel uses `socialSessionId`.
 *
 * Lifecycle (results-page guest session):
 *   1. `beginGuestAttempt()`  — guest preview card impression = start of a new
 *      attempt; always generates a FRESH id so an abandoned id from a previous
 *      visit is never reused.
 *   2. `getGuestAttemptId()` — read the current id (create-if-missing) for the
 *      card-tap / login-tap events.
 *   3. `consumeGuestAttemptId()` — read + clear on login success (attempt done).
 *
 * Storage is `Taro.setStorageSync` (the mini-program's only cross-navigation
 * store; there is no web-style `sessionStorage`), so the id survives page
 * transitions between tap and success. It carries zero PII — a random
 * `ga_<ts>_<rand>` token only.
 */

const GUEST_ATTEMPT_ID_STORAGE_KEY = 'joyjoin_guest_attempt_id'

// In-memory cache avoids repeated storage round-trips within one JS context
// and guarantees we never hand back a stale id after a clear.
let cachedGuestAttemptId: string | null = null

function generateGuestAttemptId(): string {
  const ts = Date.now().toString(36)
  const rand = Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10)
  return `ga_${ts}_${rand}`
}

function readStoredGuestAttemptId(): string | null {
  try {
    const value = Taro.getStorageSync(GUEST_ATTEMPT_ID_STORAGE_KEY)
    return typeof value === 'string' && value.length > 0 ? value : null
  } catch {
    return null
  }
}

/** Start a new guest attempt — always mint a fresh id and persist it. */
export function beginGuestAttempt(): string {
  const id = generateGuestAttemptId()
  cachedGuestAttemptId = id
  try {
    Taro.setStorageSync(GUEST_ATTEMPT_ID_STORAGE_KEY, id)
  } catch {
    // Non-blocking by design; the in-memory cache still bridges tap→success
    // within the same JS context.
  }
  return id
}

/** Read the current guest-attempt id, creating (and persisting) one if absent. */
export function getGuestAttemptId(): string {
  if (cachedGuestAttemptId) {
    return cachedGuestAttemptId
  }
  const stored = readStoredGuestAttemptId()
  if (stored) {
    cachedGuestAttemptId = stored
    return stored
  }
  return beginGuestAttempt()
}

/** Read the current guest-attempt id, then clear it (attempt complete). */
export function consumeGuestAttemptId(): string {
  const id = getGuestAttemptId()
  cachedGuestAttemptId = null
  try {
    Taro.removeStorageSync(GUEST_ATTEMPT_ID_STORAGE_KEY)
  } catch {
    // Non-blocking by design.
  }
  return id
}
