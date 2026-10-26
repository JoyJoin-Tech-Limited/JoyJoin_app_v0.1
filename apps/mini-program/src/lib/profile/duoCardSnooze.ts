import Taro from '@tarojs/taro'

// P2-4 (2026-10-22, PM memo §7): 72-hour per-pool dismissal snooze for the
// Duo 同桌卡. Storage-backed (survives cold starts) because session-only
// would re-nag within one sitting and permanent would kill the highest-
// intent invite surface; registration windows are short (pools lock 24h
// before the event), so 72h ≈ the pool's remaining life.
const KEY_PREFIX = 'jj_profile_duo_card_dismissed:'
export const DUO_CARD_SNOOZE_MS = 72 * 60 * 60 * 1000

export function isDuoCardSnoozed(poolId: string, now: number = Date.now()): boolean {
  try {
    const value = Taro.getStorageSync(KEY_PREFIX + poolId)
    if (typeof value !== 'number' || !Number.isFinite(value)) return false
    return now - value < DUO_CARD_SNOOZE_MS
  } catch {
    return false
  }
}

export function snoozeDuoCard(poolId: string): void {
  try {
    Taro.setStorageSync(KEY_PREFIX + poolId, Date.now())
  } catch {
    // The card is a nicety — storage failure must never break the page.
  }
}
