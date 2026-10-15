/**
 * WelcomeGiftCard reveal-timing decision (sprint entry-card-insight-v2, AC-10 / D7).
 *
 * The emotional peak (悦仔的观察 rows) must land before the commercial element
 * (见面礼). This pure helper is the single decision point for when the gift
 * card may enter:
 *
 *  - v2 insight shape: ≥1.5s after all insight rows landed.
 *  - hard cap: never later than 10s after `isRevealReady` (forced entry).
 *  - tagline query error (retry UI): immediate original-path entry (200ms).
 *  - old (v1) shape: original-path entry (200ms) — behaviour unchanged.
 *  - reduced-motion: immediate entry (existing immediate effect handles it).
 */

/** ≥1.5s dwell between the last insight row landing and the gift entering. */
export const GIFT_REVEAL_AFTER_INSIGHT_MS = 1_500

/** Hard cap: the gift must enter no later than this long after isRevealReady. */
export const GIFT_REVEAL_CAP_MS = 10_000

/** Original-path delay (pre-v2 behaviour): 200ms after the coupon commits. */
export const GIFT_REVEAL_DEFAULT_MS = 200

export interface GiftRevealTimingInput {
  /** True when the tagline response carries the v2 `lines` shape. */
  isV2Insight: boolean
  /** True once every insight row (observation + LLM rows) has landed. */
  insightRowsLanded: boolean
  /** True when the tagline query errored and the retry UI is showing. */
  isTaglineError: boolean
  /** OS-level reduced-motion preference. */
  shouldReduceMotion: boolean
  /** True once the 10s post-reveal hard cap has tripped. */
  giftCapReached: boolean
  /**
   * AC-18 kill-switch: `features.entryCardInsightV2Enabled` from
   * /api/auth/user. When explicitly false, the gift keeps the legacy 200ms
   * original-path timing regardless of the response shape.
   */
  v2Enabled?: boolean
}

/**
 * Resolve the delay (ms) before the gift card may become visible.
 * Returns `null` when the gift must keep waiting for the insight sequence.
 */
export function resolveGiftRevealDelayMs(input: GiftRevealTimingInput): number | null {
  if (input.shouldReduceMotion) {
    return 0
  }

  if (input.v2Enabled === false) {
    return GIFT_REVEAL_DEFAULT_MS
  }

  if (input.isTaglineError) {
    return GIFT_REVEAL_DEFAULT_MS
  }

  if (!input.isV2Insight) {
    return GIFT_REVEAL_DEFAULT_MS
  }

  if (input.insightRowsLanded) {
    return GIFT_REVEAL_AFTER_INSIGHT_MS
  }

  if (input.giftCapReached) {
    return GIFT_REVEAL_DEFAULT_MS
  }

  return null
}
