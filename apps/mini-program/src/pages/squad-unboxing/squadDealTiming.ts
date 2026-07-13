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
