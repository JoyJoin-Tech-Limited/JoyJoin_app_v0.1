import { describe, expect, it, vi } from 'vitest'
import { MINI_PROGRAM_ROUTES } from '../../lib/onboardingRoutes'
import { redirectLegacyJourneyToEvents } from './redirect'

describe('redirectLegacyJourneyToEvents', () => {
  it('switches the legacy journey route into the canonical events tab', async () => {
    const navigator = {
      switchTab: vi.fn().mockResolvedValue(undefined),
      reLaunch: vi.fn(),
    }

    await redirectLegacyJourneyToEvents(navigator)

    expect(navigator.switchTab).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.events })
    expect(navigator.reLaunch).not.toHaveBeenCalled()
  })

  // Guards against regression: the legacy journey entry must still recover into
  // the canonical events tab even if switchTab rejects on first load.
  it('falls back to relaunch when switchTab fails', async () => {
    const navigator = {
      switchTab: vi.fn().mockRejectedValue(new Error('switch failed')),
      reLaunch: vi.fn().mockResolvedValue(undefined),
    }

    await redirectLegacyJourneyToEvents(navigator)

    expect(navigator.switchTab).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.events })
    expect(navigator.reLaunch).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.events })
  })
})