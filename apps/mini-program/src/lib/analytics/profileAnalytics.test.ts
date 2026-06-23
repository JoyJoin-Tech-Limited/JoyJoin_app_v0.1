import { describe, expect, it, vi } from 'vitest'

import { profileAnalytics, type ProfileAnalyticsEventType } from './profileAnalytics'

const { mockApiRequest, mockLogWarn } = vi.hoisted(() => ({
  mockApiRequest: vi.fn().mockResolvedValue({ success: true }),
  mockLogWarn: vi.fn(),
}))

vi.mock('../api/api', () => ({
  apiRequest: mockApiRequest,
}))

vi.mock('../utils/logger', () => ({
  logWarn: mockLogWarn,
  logInfo: vi.fn(),
}))

describe('profileAnalytics', () => {
  it('exports a singleton instance', () => {
    expect(profileAnalytics).toBeDefined()
    expect(typeof profileAnalytics.track).toBe('function')
  })

  it('track() POSTs a valid profile event', () => {
    mockApiRequest.mockClear()

    profileAnalytics.track('profile_menu_tap', { menu: 'edit-profile' })

    expect(mockApiRequest).toHaveBeenCalledTimes(1)
    const call = mockApiRequest.mock.calls[0][0]
    expect(call.path).toBe('/api/analytics/profile')
    expect(call.method).toBe('POST')
    expect(call.handleUnauthorized).toBe(false)
    expect(call.data.eventType).toBe('profile_menu_tap')
    expect(call.data.metadata).toEqual({ menu: 'edit-profile' })
    expect(typeof call.data.timestamp).toBe('number')
  })

  it('silent-fails on network error via .catch()', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('network down'))

    profileAnalytics.track('profile_logout_tap')

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockLogWarn).toHaveBeenCalledWith(
      '[ProfileAnalytics] Failed to send profile event',
      { eventType: 'profile_logout_tap', message: 'network down' },
    )
  })

  it('drops invalid metadata shapes client-side', () => {
    mockApiRequest.mockClear()
    mockLogWarn.mockClear()

    profileAnalytics.track('profile_stat_tap', 'not-an-object' as unknown as Record<string, unknown>)

    expect(mockApiRequest).not.toHaveBeenCalled()
    expect(mockLogWarn).toHaveBeenCalled()
  })

  it('accepts all 17 event types without throwing', () => {
    const types: ProfileAnalyticsEventType[] = [
      'profile_stat_tap',
      'profile_archetype_cta_tap',
      'profile_menu_tap',
      'profile_logout_tap',
      'profile_logout_cancel',
      'profile_shell_retry',
      'profile_share_app_message',
      'profile_share_timeline',
      'profile_milestone_impression',
      'profile_milestone_tap',
      'profile_pull_refresh',
      'profile_share_card_generated',
      'profile_share_card_error',
      'profile_view',
      'profile_edit_tap',
      'profile_completion',
      'connection_card_view',
    ]

    for (const type of types) {
      expect(() => profileAnalytics.track(type)).not.toThrow()
    }
  })
})
