import Taro from '@tarojs/taro'

/**
 * Pending referral attribution (2026-10-09).
 *
 * A guest can arrive on the landing page via a pool-less share link carrying
 * `?invitationCode=…`, take the personality test anonymously, and only log in
 * at the results stage. The URL param does not survive that journey, so the
 * code is persisted here at landing-mount time and consumed by the results
 * login handoff (useResultsLoginHandoff), which forwards it to
 * POST /api/auth/wechat/login-with-test (server persists it into
 * session.pendingReferralCode for later pool-registration attribution).
 *
 * Distinct from the duo context (lib/duo/duoContext.ts, key
 * `jj_pending_duo_context`): that one preserves pool + duo routing across the
 * login reLaunch; this one is pure referral attribution and carries no pool.
 *
 * Lifetime: survives app restarts until consumed — cleared only after a
 * successful login response, or by the user-scoped storage hard reset.
 */
const PENDING_REFERRAL_CODE_STORAGE_KEY = 'joyjoin_pending_referral_code'

/** Persist an invite code captured from a share-link entry. No-op on empty. */
export function persistPendingReferralCode(code: string | null | undefined): void {
  const trimmed = typeof code === 'string' ? code.trim() : ''
  if (!trimmed) return
  try {
    Taro.setStorageSync(PENDING_REFERRAL_CODE_STORAGE_KEY, trimmed)
  } catch {
    // Non-blocking by design — worst case the attribution is lost.
  }
}

/** Read the stored code ('' when absent/unreadable). Does NOT clear it. */
export function readPendingReferralCode(): string {
  try {
    const raw = Taro.getStorageSync(PENDING_REFERRAL_CODE_STORAGE_KEY)
    return typeof raw === 'string' ? raw.trim() : ''
  } catch {
    return ''
  }
}

/** Clear after the code has been consumed by a successful login. */
export function clearPendingReferralCode(): void {
  try {
    Taro.removeStorageSync(PENDING_REFERRAL_CODE_STORAGE_KEY)
  } catch {
    // Best-effort cleanup — a leftover key only re-sends the same attribution.
  }
}
