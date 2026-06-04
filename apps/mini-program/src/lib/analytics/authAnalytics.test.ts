import { describe, expect, it, vi } from 'vitest'

const { mockApiRequest, mockLogWarn } = vi.hoisted(() => ({
  mockApiRequest: vi.fn().mockResolvedValue({ success: true }),
  mockLogWarn: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    getStorageSync: vi.fn(),
    setStorageSync: vi.fn(),
  },
}))

vi.mock('../api/api', () => ({
  apiRequest: mockApiRequest,
}))

vi.mock('../utils/logger', () => ({
  logWarn: mockLogWarn,
  logInfo: vi.fn(),
}))

import { authAnalytics, type AuthAnalyticsEventType } from './authAnalytics'

describe('authAnalytics', () => {
  it('exports a singleton instance', () => {
    expect(authAnalytics).toBeDefined()
    expect(typeof authAnalytics.track).toBe('function')
  })

  it('track() POSTs to /api/analytics/auth with eventType, metadata, timestamp', () => {
    mockApiRequest.mockClear()

    authAnalytics.track('auth_revalidation_started')

    expect(mockApiRequest).toHaveBeenCalledTimes(1)
    const call = mockApiRequest.mock.calls[0][0]
    expect(call.path).toBe('/api/analytics/auth')
    expect(call.method).toBe('POST')
    expect(call.handleUnauthorized).toBe(false)
    expect(call.data.eventType).toBe('auth_revalidation_started')
    expect(typeof call.data.timestamp).toBe('number')
  })

  it('track() passes metadata through', () => {
    mockApiRequest.mockClear()

    authAnalytics.track('gate_timeout', { timeoutMs: 4000 })

    expect(mockApiRequest).toHaveBeenCalledTimes(1)
    const call = mockApiRequest.mock.calls[0][0]
    expect(call.data.eventType).toBe('gate_timeout')
    expect(call.data.metadata).toEqual({ timeoutMs: 4000 })
  })

  it('silent-fails on network error via .catch()', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('network down'))

    authAnalytics.track('gate_retry')

    await new Promise((resolve) => setTimeout(resolve, 10))

    expect(mockLogWarn).toHaveBeenCalledWith(
      '[AuthAnalytics] Failed to send auth event',
      { eventType: 'gate_retry', message: 'network down' },
    )
  })

  it('accepts all 6 event types without throwing', () => {
    const types: AuthAnalyticsEventType[] = [
      'auth_revalidation_started',
      'auth_revalidation_succeeded',
      'auth_revalidation_failed',
      'gate_timeout',
      'gate_retry',
      'gate_dismiss',
    ]

    for (const type of types) {
      expect(() => authAnalytics.track(type)).not.toThrow()
    }
  })
})
