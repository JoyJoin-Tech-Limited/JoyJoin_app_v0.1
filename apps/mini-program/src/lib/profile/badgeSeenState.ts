import Taro from '@tarojs/taro'

// P1-4 (2026-10-22): per-user "seen badge" ledger for the just-unlocked
// ring + success haptic on tab return. Baseline is written on the first
// profile mount (never ring for pre-existing unlocks); later shows diff
// unlocked keys against the ledger, ring the fresh ones, then persist.
const keyFor = (userId: string) => `joyjoin_profile_badges_seen:${userId}`

/** Returns null when the ledger key does not exist yet (→ caller baselines
 *  the current unlocks without ringing), the key list otherwise. */
export function readSeenBadges(userId: string): string[] | null {
  try {
    const value = Taro.getStorageSync(keyFor(userId))
    if (value === '' || value === undefined || value === null) return null
    return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : null
  } catch {
    return null
  }
}

export function writeSeenBadges(userId: string, keys: string[]): void {
  try {
    Taro.setStorageSync(keyFor(userId), keys)
  } catch {
    // The ring is a nicety — storage failure must never break the page.
  }
}
