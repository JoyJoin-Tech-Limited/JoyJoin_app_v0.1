import { describe, expect, it } from 'vitest'
import {
  canShowAuctionBidControls,
  getGenerationRetryDelayMs,
  resolvePersonalityDiceChooseMode,
} from '../viewModels/phaseProgressionModels'

describe('phase progression models', () => {
  it('uses the server-owned personality dice mode over a stale auth feature', () => {
    expect(resolvePersonalityDiceChooseMode(true, false)).toBe(true)
    expect(resolvePersonalityDiceChooseMode(false, true)).toBe(false)
    expect(resolvePersonalityDiceChooseMode(undefined, true)).toBe(true)
  })

  it('retries accepted background generation responses using a bounded delay', () => {
    expect(getGenerationRetryDelayMs({ status: 'generating', retryAfterMs: 1200 })).toBe(1200)
    expect(getGenerationRetryDelayMs({ status: 'generating', retryAfterMs: 99 })).toBe(500)
    expect(getGenerationRetryDelayMs({ status: 'ready' })).toBeNull()
  })

  it('lets the real host bid only in a single-test session', () => {
    expect(canShowAuctionBidControls({ isHost: false, isSingleTest: false })).toBe(true)
    expect(canShowAuctionBidControls({ isHost: true, isSingleTest: true })).toBe(true)
    expect(canShowAuctionBidControls({ isHost: true, isSingleTest: false })).toBe(false)
  })
})
