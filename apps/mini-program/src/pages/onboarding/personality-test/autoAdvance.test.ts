import { describe, expect, it } from 'vitest'
import { AUTO_ADVANCE_AFTER_TYPING_MS, computeAutoAdvanceDelayMs } from './autoAdvance'

const MIN_DISPLAY = 900

describe('computeAutoAdvanceDelayMs', () => {
  it('waits out the min display window when typing finished early', () => {
    const delay = computeAutoAdvanceDelayMs({
      commentaryShownAt: 1000,
      typingDoneAt: 1500,
      minDisplayMs: MIN_DISPLAY,
      now: 1600,
    })
    expect(delay).toBe(1000 + MIN_DISPLAY - 1600)
  })

  it('waits for typing done + 400ms when typing outlasts the min window', () => {
    const delay = computeAutoAdvanceDelayMs({
      commentaryShownAt: 1000,
      typingDoneAt: 4000,
      minDisplayMs: MIN_DISPLAY,
      now: 4000,
    })
    expect(delay).toBe(AUTO_ADVANCE_AFTER_TYPING_MS)
  })

  it('returns 0 when the window has already passed', () => {
    const delay = computeAutoAdvanceDelayMs({
      commentaryShownAt: 1000,
      typingDoneAt: 2000,
      minDisplayMs: MIN_DISPLAY,
      now: 9999,
    })
    expect(delay).toBe(0)
  })

  it('picks the later of the two guards when they straddle now', () => {
    const delay = computeAutoAdvanceDelayMs({
      commentaryShownAt: 0,
      typingDoneAt: 2000,
      minDisplayMs: MIN_DISPLAY,
      now: 1500,
    })
    expect(delay).toBe(2000 + AUTO_ADVANCE_AFTER_TYPING_MS - 1500)
  })
})
