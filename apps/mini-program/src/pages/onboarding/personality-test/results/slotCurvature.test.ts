import { describe, expect, it } from 'vitest'
import {
  buildSlotCardCurvature,
  resolveSlotCurvature3D,
  SLOT_CURVATURE_CLAMP,
  SLOT_CURVATURE_ENABLE_3D,
  SLOT_CURVATURE_OPACITY_PER_STEP,
  SLOT_CURVATURE_ROTATE_DEG_PER_STEP,
  SLOT_CURVATURE_SCALE_PER_STEP,
  SLOT_CURVATURE_WINDOW,
  slotCurvatureEnabledForTier,
} from './slotCurvature'

describe('buildSlotCardCurvature', () => {
  it('returns identity (null) for the active card at n = 0', () => {
    expect(buildSlotCardCurvature(5, 5, 'full', 'spinning')).toBeNull()
    expect(buildSlotCardCurvature(0, 0, 'reduced', 'slowing')).toBeNull()
  })

  it('returns null outside the ±window re-render range', () => {
    expect(buildSlotCardCurvature(9, 5, 'full', 'spinning')).toBeNull() // n = 4
    expect(buildSlotCardCurvature(1, 5, 'full', 'spinning')).toBeNull() // n = -4
    expect(buildSlotCardCurvature(8, 5, 'full', 'spinning')).not.toBeNull() // n = 3
    expect(buildSlotCardCurvature(2, 5, 'full', 'spinning')).not.toBeNull() // n = -3
  })

  it('clamps curvature at the ±2.5 design bound', () => {
    const atWindow = buildSlotCardCurvature(5 + SLOT_CURVATURE_WINDOW, 5, 'full', 'spinning')
    expect(atWindow).not.toBeNull()
    const expectedRotate = SLOT_CURVATURE_CLAMP * SLOT_CURVATURE_ROTATE_DEG_PER_STEP
    const expectedScale = 1 - SLOT_CURVATURE_CLAMP * SLOT_CURVATURE_SCALE_PER_STEP
    const expectedOpacity = 1 - SLOT_CURVATURE_CLAMP * SLOT_CURVATURE_OPACITY_PER_STEP
    expect(atWindow!.transform).toBe(`rotateX(${expectedRotate}deg) scale(${expectedScale})`)
    expect(atWindow!.opacity).toBeCloseTo(expectedOpacity, 3)
  })

  it('falls off monotonically with distance from the active card', () => {
    const near = buildSlotCardCurvature(6, 5, 'full', 'spinning')!
    const mid = buildSlotCardCurvature(7, 5, 'full', 'spinning')!
    const far = buildSlotCardCurvature(8, 5, 'full', 'spinning')!
    expect(near.opacity).toBeGreaterThan(mid.opacity)
    expect(mid.opacity).toBeGreaterThan(far.opacity)

    const scaleOf = (transform: string) => Number(transform.match(/scale\(([\d.]+)\)/)![1])
    expect(scaleOf(near.transform)).toBeGreaterThan(scaleOf(mid.transform))
    expect(scaleOf(mid.transform)).toBeGreaterThan(scaleOf(far.transform))

    const rotateOf = (transform: string) => Number(transform.match(/rotateX\((-?[\d.]+)deg\)/)![1])
    expect(rotateOf(near.transform)).toBeLessThan(rotateOf(mid.transform))
    expect(rotateOf(mid.transform)).toBeLessThan(rotateOf(far.transform))
  })

  it('mirrors negative offsets symmetrically', () => {
    const above = buildSlotCardCurvature(4, 5, 'full', 'spinning')! // n = -1
    const below = buildSlotCardCurvature(6, 5, 'full', 'spinning')! // n = +1
    expect(above.opacity).toBe(below.opacity)
    expect(above.transform).toContain('rotateX(-14deg)')
    expect(below.transform).toContain('rotateX(14deg)')
  })

  it('gates curvature by degradation tier', () => {
    expect(slotCurvatureEnabledForTier('full')).toBe(true)
    expect(slotCurvatureEnabledForTier('reduced')).toBe(true)
    expect(slotCurvatureEnabledForTier('minimal')).toBe(false)
    expect(slotCurvatureEnabledForTier('emergency')).toBe(false)

    expect(buildSlotCardCurvature(6, 5, 'minimal', 'spinning')).toBeNull()
    expect(buildSlotCardCurvature(6, 5, 'emergency', 'spinning')).toBeNull()
    expect(buildSlotCardCurvature(6, 5, 'reduced', 'spinning')).not.toBeNull()
  })

  it('keeps the anticipation intro beat uniformly flat', () => {
    expect(buildSlotCardCurvature(6, 5, 'full', 'anticipation')).toBeNull()
  })

  it('applies curvature through every reel-motion phase including landed', () => {
    for (const phase of ['spinning', 'holding', 'slowing', 'nearMiss', 'landed'] as const) {
      expect(buildSlotCardCurvature(6, 5, 'full', phase)).not.toBeNull()
    }
  })

  it('ships a 2.5D fallback (scale+opacity only) when 3D is disabled', () => {
    const fallback = buildSlotCardCurvature(6, 5, 'full', 'spinning', false)!
    expect(fallback.transform).not.toContain('rotateX')
    expect(fallback.transform).toMatch(/^scale\([\d.]+\)$/)

    const threeD = buildSlotCardCurvature(6, 5, 'full', 'spinning', true)!
    expect(threeD.transform).toContain('rotateX')
    // Same opacity in both modes — the fallback only drops the rotation.
    expect(fallback.opacity).toBe(threeD.opacity)
  })

  it('defaults the 3D switch to the module-level config constant', () => {
    const implicit = buildSlotCardCurvature(6, 5, 'full', 'spinning')!
    const explicit = buildSlotCardCurvature(6, 5, 'full', 'spinning', SLOT_CURVATURE_ENABLE_3D)!
    expect(implicit).toEqual(explicit)
  })
})

describe('resolveSlotCurvature3D (remote kill switch combiner)', () => {
  it('requires BOTH the compile-time constant AND the remote flag for 3D', () => {
    expect(resolveSlotCurvature3D(true)).toBe(SLOT_CURVATURE_ENABLE_3D)
    expect(resolveSlotCurvature3D(false)).toBe(false)
  })

  it('flag OFF produces the byte-identical 2.5D fallback as SLOT_CURVATURE_ENABLE_3D=false', () => {
    const viaFlag = buildSlotCardCurvature(6, 5, 'full', 'spinning', resolveSlotCurvature3D(false))!
    const viaConstant = buildSlotCardCurvature(6, 5, 'full', 'spinning', false)!
    expect(viaFlag).toEqual(viaConstant)
    expect(viaFlag.transform).not.toContain('rotateX')
    expect(viaFlag.transform).toMatch(/^scale\([\d.]+\)$/)
  })

  it('flag ON (default) preserves the full 3D drum when the constant allows it', () => {
    const resolved = resolveSlotCurvature3D(true)
    const viaFlag = buildSlotCardCurvature(6, 5, 'full', 'spinning', resolved)!
    const implicitDefault = buildSlotCardCurvature(6, 5, 'full', 'spinning')!
    expect(viaFlag).toEqual(implicitDefault)
    if (SLOT_CURVATURE_ENABLE_3D) {
      expect(viaFlag.transform).toContain('rotateX')
    }
  })
})
