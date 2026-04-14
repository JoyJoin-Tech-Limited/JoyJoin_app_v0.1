import { describe, expect, it, vi } from 'vitest'
import { MINI_PROGRAM_ROUTES } from './onboardingRoutes'
import { redirectLegacyEventsEntryToTab } from './eventsTabRedirect'

describe('redirectLegacyEventsEntryToTab', () => {
  it('switches legacy entries into the canonical events tab', async () => {
    const navigator = {
      switchTab: vi.fn().mockResolvedValue(undefined),
      reLaunch: vi.fn(),
    }

    await redirectLegacyEventsEntryToTab(navigator)

    expect(navigator.switchTab).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.events })
    expect(navigator.reLaunch).not.toHaveBeenCalled()
  })

  // Guards against regression: legacy alias recovery must still land on the
  // canonical events tab when switchTab rejects during first-load recovery.
  it('falls back to relaunch when switchTab fails', async () => {
    const navigator = {
      switchTab: vi.fn().mockRejectedValue(new Error('switch failed')),
      reLaunch: vi.fn().mockResolvedValue(undefined),
    }

    await redirectLegacyEventsEntryToTab(navigator)

    expect(navigator.switchTab).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.events })
    expect(navigator.reLaunch).toHaveBeenCalledWith({ url: MINI_PROGRAM_ROUTES.events })
  })
})
