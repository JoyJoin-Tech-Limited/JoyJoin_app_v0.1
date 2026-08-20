/**
 * Sequential-Deal timing for the squad-unboxing card fan.
 *
 * Pure, dependency-free helpers extracted from SquadDeckStage so the deal
 * budget (≤600ms wall-clock) can be unit-tested without importing the Taro
 * component tree.
 *
 * Fan geometry (card sizes, rotations, safe-zone) lives in the sibling module
 * computeFanLayout.ts — the flat-row layout helpers that used to live here
 * were deleted with the 2026-07-13 fan revamp.
 */

/**
 * The deal (staggered per-card slide-up + flip face-up) must complete within
 * DEAL_ACTIVE_BUDGET_MS of wall-clock regardless of member count, so the
 * stagger per card compresses as the table grows. A separate anticipation
 * beat (DEAL_ANTICIPATION_MS) plays between the box opening and the first deal.
 */
export const DEAL_ANTICIPATION_MS = 200
export const DEAL_ACTIVE_BUDGET_MS = 600
export const DEAL_CARD_ENTER_MS = 260
export const DEAL_STAGGER_MAX_MS = 150

/**
 * Below this per-card stagger the landing haptics merge into one continuous
 * buzz (N≥6 compresses the stagger to ~68ms). SquadDeckStage skips per-card
 * landing haptics entirely under the threshold; the box-open haptic still
 * carries the moment. At N≤5 the stagger stays ≥ 85ms so every card keeps
 * its own landing tap.
 */
export const DEAL_HAPTIC_MIN_STAGGER_MS = 80

/**
 * Per-card stagger, compressed so the whole deal fits the active budget.
 * The budget is authoritative — the stagger compresses without a floor so
 * the deal can never overrun 600ms, even beyond the product's ≤8-member
 * tables. The max clamp keeps small tables from feeling sluggish. Within
 * the real domain (≤8 members) the stagger stays ≥ 48ms, comfortably above
 * the ~40ms tactile floor.
 */
export function computeDealStaggerMs(count: number): number {
  if (count <= 1) return 0
  const raw = (DEAL_ACTIVE_BUDGET_MS - DEAL_CARD_ENTER_MS) / (count - 1)
  return Math.min(DEAL_STAGGER_MAX_MS, raw)
}

/** Active deal wall-clock (excludes the anticipation beat). Always ≤ budget. */
export function computeDealActiveMs(count: number): number {
  if (count <= 0) return 0
  return DEAL_CARD_ENTER_MS + computeDealStaggerMs(count) * Math.max(0, count - 1)
}

/** Total time from reveal mount until the deal is fully settled. */
export function computeDealTotalMs(count: number): number {
  return DEAL_ANTICIPATION_MS + computeDealActiveMs(count)
}

// ── Tap-to-reveal flip timing (2026-07-14) ──────────────────────────────────
// After the deal settles, cards sit face-down. Flips are deliberate: a tap
// flips one card, the hint chip bursts the rest. The flip animation itself is
// the rotateY transition on the card inner (0.34s in index.scss).

/** The rotateY flip transition duration — mirrors index.scss (0.34s). */
export const FLIP_DURATION_MS = 340

/**
 * The 我 card auto-flips this long after the deal settles — a short beat that
 * demonstrates the flip gesture without focus chrome or narration (AC-01/17).
 */
export const AUTO_ME_FLIP_DELAY_MS = 300

/**
 * Narration for a one-step flip-to-focus beat lands after the flip ends,
 * never tap-instant. Flip (340ms) + a small settle beat, bounded ≤500ms so
 * the bubble never feels detached from the gesture (AC-02).
 */
export const FLIP_NARRATION_DELAY_MS = 400

/**
 * While any flip is in flight, further taps are ignored (no unfocus mid-flip,
 * no double-flip — AC-02/REL-01). Flip duration + a small guard margin.
 */
export const FLIP_IN_FLIGHT_GUARD_MS = 380

/**
 * Peak-end settle breath (2026-07-24): the moment the LAST card lands, the
 * whole stage exhales once (1.0→1.015→1.0) with a success haptic. The breath
 * starts this long after the final flip so the flip (340ms) fully settles
 * first. Motion tiers only — reduced-motion / degradation never play it.
 * Single source of truth for both the page breath effect and the auto-pocket
 * hold (2026-08-19): the fold waits for the breath to finish, never cuts it.
 */
export const SETTLE_BREATH_DELAY_MS = 420
/** Breath exhale duration (1.0→1.015→1.0). */
export const SETTLE_BREATH_DURATION_MS = 480
/** Wall-clock from the final flip until the breath fully exhales. */
export const SETTLE_BREATH_TOTAL_MS = SETTLE_BREATH_DELAY_MS + SETTLE_BREATH_DURATION_MS

/** Reveal-all burst: every remaining card flips within this wall-clock budget. */
export const BURST_ACTIVE_BUDGET_MS = 600
export const BURST_STAGGER_MAX_MS = 120

/**
 * Per-card stagger for the reveal-all burst, compressed so the whole burst
 * fits the active budget regardless of remaining count (same discipline as
 * the deal: the budget is authoritative, the stagger compresses without a
 * floor). Reveal-all covers at most MAX_FAN_CARDS (≤8) visible cards.
 */
export function computeBurstStaggerMs(count: number): number {
  if (count <= 1) return 0
  const raw = (BURST_ACTIVE_BUDGET_MS - FLIP_DURATION_MS) / (count - 1)
  return Math.min(BURST_STAGGER_MAX_MS, raw)
}

/** Total burst wall-clock until the last card's flip has settled. */
export function computeBurstTotalMs(count: number): number {
  if (count <= 0) return 0
  return FLIP_DURATION_MS + computeBurstStaggerMs(count) * Math.max(0, count - 1)
}
