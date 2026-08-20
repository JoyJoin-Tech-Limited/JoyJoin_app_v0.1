export function getPageTitle(eventType?: string | null): string {
  if (eventType === 'bar') return '你的酒局桌友来了'
  if (eventType === 'dining') return '你的饭局桌友来了'
  return '你的桌友来了'
}

/** Flip hold-to-onLoad (2026-07-24 P1): max wait for the front art before
 *  flipping anyway — a card never flips into a skeleton on slow networks. */
export const ART_FLIP_HOLD_TIMEOUT_MS = 1200
/** Bounded re-arms for a held flip that keeps landing inside the in-flight
 *  guard window (review CONCERN-1). */
export const HELD_FLIP_MAX_RETRIES = 3
/** 最佳拍档 heartbeat haptics: the light pulse follows the medium beat. */
export const BEST_PARTNER_HEARTBEAT_GAP_MS = 90
