import type { DegradationTier } from '../../../../lib/utils/frameBudget'
import type { SlotPhase } from './resultHelpers'

/**
 * WS-5 fake-3D drum (2026-09-02, locked plan) — pure curvature math for the
 * slot reel. All curvature lives per-card (inline transform/opacity) plus a
 * viewport `perspective`; the track's inline translateY stays the SOLE
 * transform on the track itself. No CSS custom properties, no rAF — cards
 * recompute once per displayIndex tick via the SlotCard memo window.
 */

/** Cards further than this from displayIndex stay static flat (no re-render). */
export const SLOT_CURVATURE_WINDOW = 3
/** Curvature falloff clamps at ±2.5 cards so edge cards never fully vanish. */
export const SLOT_CURVATURE_CLAMP = 2.5
/** Degrees of rotateX per card-step from centre (design-locked). */
export const SLOT_CURVATURE_ROTATE_DEG_PER_STEP = 14
/** Scale falloff per card-step (design-locked). */
export const SLOT_CURVATURE_SCALE_PER_STEP = 0.07
/** Opacity falloff per card-step (design-locked). */
export const SLOT_CURVATURE_OPACITY_PER_STEP = 0.28

/**
 * 2.5D FALLBACK SWITCH — WeChat's webview can flatten
 * `transform-style: preserve-3d` on some runtime versions, which collapses
 * the drum's rotateX curvature. Flip this ONE constant to `false` to ship
 * the 2.5D fallback (scale + opacity falloff only, no rotateX): SlotStage
 * also reads this constant to drop the
 * `personality-results__slot-viewport--3d` perspective/preserve-3d class,
 * so the fallback ships without any SCSS rewrite.
 */
export const SLOT_CURVATURE_ENABLE_3D = true

/**
 * Remote kill switch combiner (2026-09-02, `personalitySlotCurvatureEnabled`
 * DB-backed feature flag): 3D curvature requires BOTH the compile-time
 * master switch above AND the server-driven flag. When the flag is off, the
 * drum flattens to the 2.5D fallback (scale + opacity falloff only) —
 * byte-identical to the SLOT_CURVATURE_ENABLE_3D=false path, no release
 * needed. SlotStage resolves this once and passes the result into
 * buildSlotCardCurvature + the viewport `--3d` class gate.
 */
export function resolveSlotCurvature3D(remoteCurvatureEnabled: boolean): boolean {
  return SLOT_CURVATURE_ENABLE_3D && remoteCurvatureEnabled
}

/** Tier gate: curvature + land flip run on full/reduced only. */
export function slotCurvatureEnabledForTier(tier: DegradationTier): boolean {
  return tier === 'full' || tier === 'reduced'
}

export interface SlotCardCurvatureStyle {
  transform: string
  opacity: number
}

/** Keep setData payloads stable across ticks (no float noise). */
function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}

/**
 * Compute the per-card drum curvature for a reel position.
 *
 * Returns `null` (no inline curvature — the card's class styles own its
 * transform/opacity) when:
 *  - the tier gate is off (minimal/emergency → today's flat behaviour),
 *  - the phase is `anticipation` (the intro dim beat stays uniform),
 *  - the card IS the active card (n = 0 → identity; class styles + the
 *    land-flip animation own it), or
 *  - the card is outside the ±SLOT_CURVATURE_WINDOW re-render window.
 */
export function buildSlotCardCurvature(
  index: number,
  displayIndex: number,
  tier: DegradationTier,
  phase: SlotPhase,
  enable3D: boolean = SLOT_CURVATURE_ENABLE_3D,
): SlotCardCurvatureStyle | null {
  if (!slotCurvatureEnabledForTier(tier)) return null
  if (phase === 'anticipation') return null

  const n = index - displayIndex
  if (n === 0) return null
  if (Math.abs(n) > SLOT_CURVATURE_WINDOW) return null

  const clamped = Math.max(-SLOT_CURVATURE_CLAMP, Math.min(SLOT_CURVATURE_CLAMP, n))
  const magnitude = Math.abs(clamped)
  const scale = round3(1 - magnitude * SLOT_CURVATURE_SCALE_PER_STEP)
  const opacity = round3(1 - magnitude * SLOT_CURVATURE_OPACITY_PER_STEP)
  const rotateDeg = round3(clamped * SLOT_CURVATURE_ROTATE_DEG_PER_STEP)

  return {
    transform: enable3D
      ? `rotateX(${rotateDeg}deg) scale(${scale})`
      : `scale(${scale})`,
    opacity,
  }
}
