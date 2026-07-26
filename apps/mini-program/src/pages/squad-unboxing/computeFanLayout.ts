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

/**
 * The fan shows at most this many cards; members beyond the cap collapse
 * into a "+N" overflow chip on the last visible card (front AND back) so
 * nobody is silently dropped. Canonical home — previously local to
 * SquadDeckStage; moved here so the controller can bound flip state by the
 * same cap (SCA-01).
 */
export const MAX_FAN_CARDS = 8

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
 *   N=4 → 2+2 · N=5 → 3+2 · N=6 → 3+3 · N=7 → 4+3 · N=8 → 4+4
 *
 * 4-per-row outer rotation is capped at ±5° (was ±7°): a 190×332 card at 7°
 * pokes ~40rpx past its unrotated edge, pushing the row's rotated bounding
 * box to ~756rpx — past the 750rpx viewport, hard-cropping the 4th card at
 * the right edge (G2). At 5° the poke is ~29rpx → bounding box ~733rpx,
 * inside the 750 − 8 allowance. Regression-locked by the viewport-edge
 * invariant test in computeFanLayout.test.ts.
 */
export const FAN_ROTATIONS_BY_ROW_LENGTH: Record<number, readonly number[]> = {
  1: [0],
  2: [-4.5, 4.5],
  // 3-per-row capped at ±5° with the 245rpx wow-pass cards (was ±6° at
  // 216–222rpx): at 6° the rotated bounding box measured ~747rpx — past the
  // 750 − 8 viewport allowance. At 5° it is ~736rpx (viewport-edge
  // invariant test locks this).
  3: [-5, 0, 5],
  4: [-5, -2.5, 2.5, 5],
}

/** Card W×H (rpx) keyed by member count. Matches the locked geometry table.
 *
 * Wow-pass resize (2026-07-24): N≤6 cards widen to the 3-per-row ceiling —
 * 245rpx is the widest a 3-card row can be inside the 686rpx fan content
 * width with 28rpx overlap (3×245 − 2×28 = 679 ≤ 686). N=4 leaves the
 * 4-per-row shape for [2,2] so its cards join the 245 class (+29% width).
 * N=7–8 keep the legacy 190×332 4-per-row shape: a 3-per-row cap there
 * would force three rows and blow the fixed-stage height budget.
 */
export const FAN_CARD_SIZE_BY_COUNT: Record<number, { width: number; height: number }> = {
  1: { width: 245, height: 332 },
  2: { width: 245, height: 332 },
  3: { width: 245, height: 332 },
  4: { width: 245, height: 332 },
  5: { width: 245, height: 332 },
  6: { width: 245, height: 332 },
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
  overlapRpx: number;
  safeInsetRpx: number;
}

/** Clamp any real member count into the modelled 1–8 domain. */
export function clampFanCount(count: number): number {
  if (!Number.isFinite(count)) return 1
  return Math.min(8, Math.max(1, Math.round(count)))
}

/**
 * Row split. N≤3 stays a single row; N=4 splits [2,2] so its cards join the
 * 245rpx 3-per-row width class (2026-07-24 wow pass); N≥5 splits ceil/floor
 * into two rows (ceil on top). No horizontal scroll, no shrink-to-fit.
 */
export function computeFanRows(count: number): number[] {
  const clamped = clampFanCount(count)
  if (clamped <= 3) return [clamped]
  if (clamped === 4) return [2, 2]
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

  // The auto-peek was retired with the tap-to-reveal revamp (2026-07-14):
  // cards land face-down and flip only on a deliberate tap, so there is no
  // centre-card peek target in the layout anymore.

  return {
    count: clamped,
    rows,
    cardWidth: size.width,
    cardHeight: size.height,
    rotations,
    overlapRpx: FAN_OVERLAP_RPX,
    safeInsetRpx: FAN_SAFE_INSET_RPX,
  }
}
