/**
 * Squad-unboxing "pocket the deck" collapse — the pure, dependency-free state
 * and timing module behind the two-phase card reveal (locked contract:
 * .git/.orchestration/sprints/sprint-contract.squad-unboxing-pocket-deck-20260715.md).
 *
 * This is a PRIMARY phase transition (full-screen fan ⇄ pocketed pill), NOT
 * the optional side toggle retired on 2026-07-13: the fan remains the default
 * revealed state; pocketing is the user's explicit choice to focus the event
 * content, and it is fully reversible (pull-down / tap on the pill).
 *
 * Everything here is deterministic and unit-testable in a node environment:
 * fold order, per-card fold/unfold delays, wall-clock budgets, and storage
 * key builders. Taro storage I/O lives in the controller (same split as the
 * reveal flag); this module never imports Taro.
 */

/**
 * The deck phase machine. `fan` is the default revealed state. `folding` and
 * `unfolding` are transient animation windows; only `fan` and `pocketed` are
 * persisted / survive re-entry.
 */
export type DeckPhase = 'fan' | 'folding' | 'pocketed' | 'unfolding'

// ── Fold timing (cascade INTO the pill) ─────────────────────────────────────
// Cards fold one-by-one toward the pill's vanish point; the 最佳拍档 card
// folds LAST (computeFoldOrder) with a heartbeat haptic + glow pulse.

/** Per-card fold stagger target (~50ms per contract; compresses under the budget). */
export const FOLD_STAGGER_MS = 50
/** Single-card fold transition duration (matches the card's 300ms focus transition). */
export const FOLD_CARD_EXIT_MS = 300
/** The whole cascade must settle within this wall-clock budget. */
export const FOLD_TOTAL_BUDGET_MS = 600
/**
 * Reduced-motion / degradation fold: a plain 150ms opacity crossfade, no
 * cascade movement (AC-06). A small buffer keeps the settle timer behind the
 * last compositor frame.
 */
export const FOLD_SETTLE_INSTANT_MS = 160

// ── Unfold timing (re-fan FROM the pill) ────────────────────────────────────
/** Per-card re-fan stagger — a quicker, utility beat than the emotional fold. */
export const UNFOLD_STAGGER_MS = 40
/** Single-card re-fan transition duration. */
export const UNFOLD_CARD_MS = 260
/** The re-fan must settle within this wall-clock budget. */
export const UNFOLD_TOTAL_BUDGET_MS = 480
/**
 * Frame gap between the stage becoming visible again (cards still at the
 * pocket pose) and the pose release, so WeChat commits the visibility flip
 * before the return transition starts.
 */
export const UNFOLD_RELEASE_MS = 80

/**
 * Heartbeat haptic for the 最佳拍档 fold: two vibrateShort pulses with a
 * ≥80ms stagger (contract non-blocking note). 100ms keeps the two taps
 * distinct without dragging past the card's own fold beat.
 */
export const HEARTBEAT_STAGGER_MS = 100

/**
 * Auto-pocket handoff (2026-08-19): after ALL cards flip face-up in an
 * interactive session, the deck folds itself into the pill so the revealed
 * column regains the viewport (the locked fan column clipped the 桌型诊断
 * chips + the transition line). This is the quiet beat held AFTER the settle
 * breath finishes (SETTLE_BREATH_TOTAL_MS in squadDealTiming) before the
 * fold fires — long enough to read the last card, short enough that the
 * handoff still feels like one gesture. On reduced-motion / degradation
 * tiers (no breath) this is the whole pre-fold wait. The scheduler itself
 * lives in squadAutoPocket.ts; the fold runs the exact manual-collapse path.
 */
export const AUTO_POCKET_DELAY_MS = 500

// ── Storage keys (builders are pure; Taro I/O stays in the controller) ──────
/** Collapsed-phase flag — mirrors the `jj_revealed_${groupId}` pattern. */
export function getDeckCollapseKey(groupId: string): string {
  return `jj_deck_collapsed_${groupId}`
}

/**
 * One-time first-collapse flag. Double duty (contract AC-07/AC-10): gates the
 * `firstCollapse` analytics property AND the one-time Xiaoyue hint bubble.
 */
export function getDeckCollapseHintKey(groupId: string): string {
  return `jj_deck_collapse_hint_${groupId}`
}

/**
 * Fold order: roster order, with the 最佳拍档 card moved to the END so it
 * folds last (the emotional beat of the cascade). Pure reorder — no timing.
 */
export function computeFoldOrder(
  visibleIds: readonly string[],
  bestPartnerUserId: string | null | undefined,
): string[] {
  const order = visibleIds.filter((id) => id !== bestPartnerUserId)
  if (bestPartnerUserId && visibleIds.includes(bestPartnerUserId)) {
    order.push(bestPartnerUserId)
  }
  return order
}

/** Per-card fold stagger, compressed so the cascade never overruns the budget. */
export function computeFoldStaggerMs(count: number): number {
  if (count <= 1) return 0
  const raw = (FOLD_TOTAL_BUDGET_MS - FOLD_CARD_EXIT_MS) / (count - 1)
  return Math.min(FOLD_STAGGER_MS, raw)
}

/**
 * Fold delay per card (ms), keyed by member id, in fold order (最佳拍档 last).
 * The controller hands this to the stage; the stage sets it as each card's
 * transitionDelay while the pocket pose applies.
 */
export function computeFoldDelayById(
  visibleIds: readonly string[],
  bestPartnerUserId: string | null | undefined,
): ReadonlyMap<string, number> {
  const order = computeFoldOrder(visibleIds, bestPartnerUserId)
  const staggerMs = computeFoldStaggerMs(order.length)
  const delays = new Map<string, number>()
  order.forEach((id, index) => delays.set(id, index * staggerMs))
  return delays
}

/** Wall-clock until the last fold transition settles. Always ≤ budget. */
export function computeFoldTotalMs(count: number): number {
  if (count <= 0) return 0
  return FOLD_CARD_EXIT_MS + computeFoldStaggerMs(count) * Math.max(0, count - 1)
}

/** Per-card re-fan stagger, compressed under the unfold budget. */
export function computeUnfoldStaggerMs(count: number): number {
  if (count <= 1) return 0
  const raw = (UNFOLD_TOTAL_BUDGET_MS - UNFOLD_CARD_MS) / (count - 1)
  return Math.min(UNFOLD_STAGGER_MS, raw)
}

/**
 * Unfold delay per card (ms) in roster order — the deck re-fans the way it
 * was dealt. The 最佳拍档 gets no special slot on the way out: the emotional
 * beat belongs to the fold; the re-fan is a fast utility transition.
 */
export function computeUnfoldDelayById(visibleIds: readonly string[]): ReadonlyMap<string, number> {
  const staggerMs = computeUnfoldStaggerMs(visibleIds.length)
  const delays = new Map<string, number>()
  visibleIds.forEach((id, index) => delays.set(id, index * staggerMs))
  return delays
}

/** Wall-clock from pose release until the last re-fan transition settles. */
export function computeUnfoldTotalMs(count: number): number {
  if (count <= 0) return 0
  return UNFOLD_CARD_MS + computeUnfoldStaggerMs(count) * Math.max(0, count - 1)
}
