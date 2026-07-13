/**
 * "Cascading Hand Fan" revealed-state geometry — the single source of truth
 * for the squad-unboxing card fan.
 *
 * Pure, dependency-free, and unit-tested (same pattern as squadDealTiming.ts).
 * All geometry is computed here as numbers and mirrored into SCSS via the
 * `$fan-card-sizes` / `$fan-rotations` / `$fan-overlap` / `$fan-safe-inset`
 * maps in index.scss. The two are drift-locked by SquadDeckStage.test.ts so
 * the runtime SCSS can never diverge from this module.
 *
 * Zero runtime measurement: no createSelectorQuery anywhere. The fan pose is
 * pure math → SCSS per-(row-length, index) classes. See the locked strategy:
 * docs/deliberations/2026-07-13-squad-unboxing-fan-revamp-locked.md
 */

/** Content width available to the fan (750rpx − 2×32 container padding). */
export const FAN_CONTENT_WIDTH_RPX = 686

/** Horizontal overlap between adjacent cards in a row (negative margin). */
export const FAN_OVERLAP_RPX = 28

/**
 * Right safe-inset on every non-rightmost card. = overlap (28) + rotation
 * poke (20). The covered band on a card is the region its right neighbour
 * overlaps; this inset guarantees that band holds only art/padding, never
 * text. Locked invariant — asserted by the drift-lock test.
 */
export const FAN_SAFE_INSET_RPX = 48

/**
 * Per-card rotation (deg) keyed by the LENGTH of the row the card sits in.
 * Rotation is a function of row length only, so every count decomposes into
 * these four row shapes:
 *   N=4 → one row of 4 · N=5 → 3+2 · N=6 → 3+3 · N=7 → 4+3 · N=8 → 4+4
 */
export const FAN_ROTATIONS_BY_ROW_LENGTH: Record<number, readonly number[]> = {
  1: [0],
  2: [-4.5, 4.5],
  3: [-6, 0, 6],
  4: [-9, -3, 3, 9],
}

/** Card W×H (rpx) keyed by member count. Matches the locked geometry table.
 *
 * Round-3 restructure (2026-07-13): taller 332rpx cards so the info zone can
 * carry a strict 4-row grid (name / archetype / meta / pill) without squeeze.
 * Widths: 3-per-row counts (1–3, 5–6) get wider cards (216–222); 4-per-row
 * counts (4, 7–8) cap at 190 — the widest a 4-card row can be inside the
 * 686rpx fan content width with 28rpx overlap (4×190 − 3×28 = 676 ≤ 686).
 */
export const FAN_CARD_SIZE_BY_COUNT: Record<number, { width: number; height: number }> = {
  1: { width: 216, height: 332 },
  2: { width: 216, height: 332 },
  3: { width: 216, height: 332 },
  4: { width: 190, height: 332 },
  5: { width: 222, height: 332 },
  6: { width: 222, height: 332 },
  7: { width: 190, height: 332 },
  8: { width: 190, height: 332 },
}

export interface FanLayout {
  /** Clamped member count (1–8). */
  count: number
  /** Row lengths, top→bottom. [4] for N=4; [3,2] for N=5; [4,3] for N=7. */
  rows: number[]
  cardWidth: number
  cardHeight: number
  /** Per-card rotation in flattened roster order (top row first). */
  rotations: number[]
  /** Roster index (0-based) of the centre card that auto-peeks. */
  peekIndex: number
  overlapRpx: number
  safeInsetRpx: number
}

/** Clamp any real member count into the modelled 1–8 domain. */
export function clampFanCount(count: number): number {
  if (!Number.isFinite(count)) return 1
  return Math.min(8, Math.max(1, Math.round(count)))
}

/**
 * Row split. N≤4 stays a single row; N≥5 splits ceil/floor into two rows
 * (ceil on top). No horizontal scroll, no shrink-to-fit.
 */
export function computeFanRows(count: number): number[] {
  const clamped = clampFanCount(count)
  if (clamped <= 4) return [clamped]
  return [Math.ceil(clamped / 2), Math.floor(clamped / 2)]
}

/** The full fan layout for a given member count. */
export function computeFanLayout(count: number): FanLayout {
  const clamped = clampFanCount(count)
  const rows = computeFanRows(clamped)
  const size = FAN_CARD_SIZE_BY_COUNT[clamped] ?? FAN_CARD_SIZE_BY_COUNT[8]

  const rotations: number[] = []
  for (const len of rows) {
    const rowRots = FAN_ROTATIONS_BY_ROW_LENGTH[len] ?? FAN_ROTATIONS_BY_ROW_LENGTH[1]
    for (let index = 0; index < len; index += 1) {
      rotations.push(rowRots[index] ?? 0)
    }
  }

  // The auto-peek target is the visual centre of the top row. Because the top
  // row renders first, its centre maps to roster index floor(rows[0] / 2).
  const peekIndex = Math.floor(rows[0] / 2)

  return {
    count: clamped,
    rows,
    cardWidth: size.width,
    cardHeight: size.height,
    rotations,
    peekIndex,
    overlapRpx: FAN_OVERLAP_RPX,
    safeInsetRpx: FAN_SAFE_INSET_RPX,
  }
}
