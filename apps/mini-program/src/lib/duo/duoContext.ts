import Taro from '@tarojs/taro'

/**
 * Duo registration (双人成行) client-side context helpers.
 *
 * Two storage concerns:
 *  1. Pending duo/referral context — captured when an unauthenticated invitee is
 *     reLaunched to login (reLaunch drops the page query string), replayed after
 *     login/onboarding completes so the invitee lands back on the right pool.
 *  2. Share timestamps — WeChat gives no share-completion callback, so the share
 *     panel trigger time is stored per pool to restore the "waiting" row on
 *     re-entry. The bound state is ALWAYS server-derived (GET duo-status).
 */

export interface PendingDuoContext {
  poolId?: string
  invitationCode: string
  duo: boolean
  savedAt: number
}

const PENDING_DUO_CONTEXT_KEY = 'jj_pending_duo_context'
/** Context older than this is treated as stale and discarded on read. */
const PENDING_DUO_CONTEXT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000

export function buildDuoSharePath(poolId: string, code: string): string {
  return `/pages/pool-registration/index?id=${encodeURIComponent(poolId)}&invitationCode=${encodeURIComponent(code)}&duo=1`
}

export function buildDuoShareStorageKey(poolId: string): string {
  return `jj_duo_share_${poolId}`
}

export function isPendingDuoContextStale(context: PendingDuoContext, now: number): boolean {
  return now - context.savedAt > PENDING_DUO_CONTEXT_MAX_AGE_MS
}

/**
 * Capture invite params from a page that is about to be dropped by the login
 * reLaunch. Only stores when an invitationCode is present; a pool-less plain
 * referral is still recorded so replay can at least preserve attribution.
 */
export function capturePendingDuoContext(params: {
  poolId?: string
  invitationCode?: string
  duo?: boolean
}): void {
  if (!params.invitationCode) return
  const context: PendingDuoContext = {
    poolId: params.poolId || undefined,
    invitationCode: params.invitationCode,
    duo: params.duo === true,
    savedAt: Date.now(),
  }
  try {
    Taro.setStorageSync(PENDING_DUO_CONTEXT_KEY, context)
  } catch {
    // Non-blocking by design — worst case the invitee lands on discover.
  }
}

function readPendingDuoContext(): PendingDuoContext | null {
  try {
    const raw = Taro.getStorageSync(PENDING_DUO_CONTEXT_KEY)
    if (!raw || typeof raw !== 'object') return null
    const context = raw as PendingDuoContext
    if (typeof context.invitationCode !== 'string' || context.invitationCode === '') return null
    if (typeof context.savedAt !== 'number') return null
    if (isPendingDuoContextStale(context, Date.now())) return null
    return context
  } catch {
    return null
  }
}

/** Read and clear the pending context so it replays exactly once. */
export function consumePendingDuoContext(): PendingDuoContext | null {
  const context = readPendingDuoContext()
  if (context) {
    try {
      Taro.removeStorageSync(PENDING_DUO_CONTEXT_KEY)
    } catch {
      // Best-effort cleanup
    }
  }
  return context
}

export function readDuoShareTimestamp(poolId: string): number | null {
  try {
    const raw = Taro.getStorageSync(buildDuoShareStorageKey(poolId))
    const parsed = typeof raw === 'number' ? raw : Number(raw)
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null
  } catch {
    return null
  }
}

export function writeDuoShareTimestamp(poolId: string, timestamp: number): void {
  try {
    Taro.setStorageSync(buildDuoShareStorageKey(poolId), timestamp)
  } catch {
    // Non-blocking by design
  }
}
