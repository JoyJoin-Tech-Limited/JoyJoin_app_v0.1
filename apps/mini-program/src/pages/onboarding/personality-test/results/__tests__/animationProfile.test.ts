import { afterEach, describe, expect, it } from 'vitest'
import {
  getAnimationProfile,
  type AnimationProfile,
  type AnimationProfileName,
} from '../resultHelpers'

/**
 * Regression tests for K3 Phase 1+ (2026-08-01): remote-selectable timing
 * profile (`baseline`/`fast`/`dramatic`).
 *
 * Locks in: named profile resolution, the web-sandbox query-param override,
 * and that the dramatic variant's worst-case pacing stays inside its own
 * safety timeout (the flow bails to the static result on overflow).
 */

const BASELINE_KEYS: Array<keyof AnimationProfile> = [
  'slotAnticipationMs',
  'slotSpinMs',
  'slotSpinIntervalMs',
  'slotHoldIntervalMs',
  'slotSlowStepDelays',
  'slotNearMissMs',
  'slotRevealPauseMs',
  'revealSilhouetteMs',
  'revealFillMs',
  'revealGlowMs',
  'bridgeMs',
]

function withQueryParam(name: AnimationProfileName | null, fn: () => void) {
  // design-audit:intentional — jsdom test env; window exists only here, never in WeChat runtime
  const base = window.location.href // design-audit:intentional — jsdom test env
  if (name) {
    window.history.replaceState({}, '', `/?animationProfile=${name}`) // design-audit:intentional — jsdom test env
  } else {
    window.history.replaceState({}, '', '/') // design-audit:intentional — jsdom test env
  }
  try {
    fn()
  } finally {
    window.history.replaceState({}, '', base) // design-audit:intentional — jsdom test env
  }
}

afterEach(() => {
  window.history.replaceState({}, '', '/') // design-audit:intentional — jsdom test env
})

describe('getAnimationProfile', () => {
  it('returns the baseline profile by default', () => {
    const profile = getAnimationProfile()
    expect(profile).toBeDefined()
    expect(profile.slotNearMissMode).toBe('blend')
    expect(profile.slotNearMissProbability).toBe(0.3)
  })

  it('selects the named profile when passed explicitly', () => {
    const fast = getAnimationProfile('fast')
    expect(fast.slotSpinMs).toBeLessThan(getAnimationProfile('baseline').slotSpinMs)

    const dramatic = getAnimationProfile('dramatic')
    expect(dramatic.slotSpinMs).toBeGreaterThan(getAnimationProfile('baseline').slotSpinMs)
    expect(dramatic.slotAnticipationMs).toBeGreaterThan(
      getAnimationProfile('baseline').slotAnticipationMs,
    )
  })

  it('keeps the ethics cap and blend near-miss mode across all variants', () => {
    for (const name of ['baseline', 'fast', 'dramatic'] as AnimationProfileName[]) {
      const profile = getAnimationProfile(name)
      expect(profile.slotNearMissProbability).toBe(0.3)
      expect(profile.slotNearMissMode).toBe('blend')
    }
  })

  it('web-sandbox query param overrides the explicit selection', () => {
    withQueryParam('dramatic', () => {
      expect(getAnimationProfile('baseline').slotAnticipationMs).toBeGreaterThan(1200)
    })
    withQueryParam('fast', () => {
      expect(getAnimationProfile('dramatic').slotSpinMs).toBeLessThan(2000)
    })
  })

  it('ignores unknown sandbox query values', () => {
    withQueryParam(null, () => {
      window.history.replaceState({}, '', '/?animationProfile=superfast') // design-audit:intentional — jsdom test env
      expect(getAnimationProfile('dramatic').slotAnticipationMs).toBeGreaterThan(1200)
    })
  })

  it('dramatic worst-case pacing fits inside its safety timeout', () => {
    const dramatic = getAnimationProfile('dramatic')
    const slowSteps = dramatic.slotSlowStepDelays.reduce((sum, d) => sum + d, 0)
    const worstCase =
      dramatic.slotAnticipationMs +
      dramatic.slotSpinMs +
      slowSteps +
      dramatic.slotNearMissMs +
      dramatic.slotRevealPauseMs +
      dramatic.revealSilhouetteMs +
      dramatic.revealFillMs +
      dramatic.revealGlowMs +
      dramatic.bridgeMs
    expect(worstCase).toBeLessThan(dramatic.flowSafetyTimeoutMs)
  })

  it('profiles are ordered baseline < fast < dramatic by pacing', () => {
    const [baseline, fast, dramatic] = (['baseline', 'fast', 'dramatic'] as AnimationProfileName[]).map(
      (name) => getAnimationProfile(name),
    )
    for (const key of BASELINE_KEYS) {
      const values = [baseline, fast, dramatic].map((p) => {
        const v = p[key]
        return Array.isArray(v) ? (v as number[]).reduce((a, b) => a + b, 0) : (v as number)
      })
      const [b, f, d] = values
      // fast must be snappier than baseline on every pacing key
      expect(f, `${key} fast`).toBeLessThanOrEqual(b)
      // dramatic must be slower than baseline on every pacing key
      expect(d, `${key} dramatic`).toBeGreaterThanOrEqual(b)
    }
  })
})
