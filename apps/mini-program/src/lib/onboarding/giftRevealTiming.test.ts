import { describe, it, expect } from 'vitest'
import {
  GIFT_REVEAL_AFTER_INSIGHT_MS,
  GIFT_REVEAL_CAP_MS,
  GIFT_REVEAL_DEFAULT_MS,
  resolveGiftRevealDelayMs,
} from './giftRevealTiming'

describe('giftRevealTiming — AC-10 WelcomeGiftCard entry timing', () => {
  it('honours the contracted constants (≥1.5s dwell, 10s hard cap)', () => {
    expect(GIFT_REVEAL_AFTER_INSIGHT_MS).toBeGreaterThanOrEqual(1_500)
    expect(GIFT_REVEAL_CAP_MS).toBe(10_000)
  })

  it('waits (null) while the v2 insight sequence is still landing', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: true,
        insightRowsLanded: false,
        isTaglineError: false,
        shouldReduceMotion: false,
        giftCapReached: false,
      }),
    ).toBeNull()
  })

  it('enters ≥1.5s after all v2 insight rows have landed', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: true,
        insightRowsLanded: true,
        isTaglineError: false,
        shouldReduceMotion: false,
        giftCapReached: false,
      }),
    ).toBe(GIFT_REVEAL_AFTER_INSIGHT_MS)
  })

  it('forces entry on the original path once the 10s cap trips', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: true,
        insightRowsLanded: false,
        isTaglineError: false,
        shouldReduceMotion: false,
        giftCapReached: true,
      }),
    ).toBe(GIFT_REVEAL_DEFAULT_MS)
  })

  it('enters immediately on the original path when the tagline query errored', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: true,
        insightRowsLanded: false,
        isTaglineError: true,
        shouldReduceMotion: false,
        giftCapReached: false,
      }),
    ).toBe(GIFT_REVEAL_DEFAULT_MS)
  })

  it('keeps the original 200ms path for the legacy (v1) shape', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: false,
        insightRowsLanded: false,
        isTaglineError: false,
        shouldReduceMotion: false,
        giftCapReached: false,
      }),
    ).toBe(GIFT_REVEAL_DEFAULT_MS)
  })

  it('AC-18: v2Enabled=false forces the legacy 200ms path even with v2 data', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: true,
        insightRowsLanded: false,
        isTaglineError: false,
        shouldReduceMotion: false,
        giftCapReached: false,
        v2Enabled: false,
      }),
    ).toBe(GIFT_REVEAL_DEFAULT_MS)
  })

  it('AC-18: reduced-motion still wins over the flag-off legacy path', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: true,
        insightRowsLanded: false,
        isTaglineError: false,
        shouldReduceMotion: true,
        giftCapReached: false,
        v2Enabled: false,
      }),
    ).toBe(0)
  })

  it('enters immediately for reduced-motion users regardless of insight state', () => {
    expect(
      resolveGiftRevealDelayMs({
        isV2Insight: true,
        insightRowsLanded: false,
        isTaglineError: false,
        shouldReduceMotion: true,
        giftCapReached: false,
      }),
    ).toBe(0)
  })
})
