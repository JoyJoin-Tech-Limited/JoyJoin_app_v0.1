import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackFlashSearchStarted } from './flashSearchAnalytics'

const { mockApiRequest, mockLogWarn } = vi.hoisted(() => ({
  mockApiRequest: vi.fn().mockResolvedValue({ success: true }),
  mockLogWarn: vi.fn(),
}))

vi.mock('../api/api', () => ({ apiRequest: mockApiRequest }))
vi.mock('../utils/logger', () => ({ logWarn: mockLogWarn }))

describe('flashSearchAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts search_started with appearanceId metadata to the discover analytics endpoint', () => {
    trackFlashSearchStarted('appearance-1')

    expect(mockApiRequest).toHaveBeenCalledWith({
      path: '/api/analytics/discover',
      method: 'POST',
      data: {
        eventType: 'flash_search_started',
        metadata: { appearanceId: 'appearance-1' },
        timestamp: expect.any(Number),
      },
      handleUnauthorized: false,
    })
  })

  it('never sends coordinates or user text alongside the shift id', () => {
    trackFlashSearchStarted('appearance-1')

    const call = mockApiRequest.mock.calls[0][0] as { data: Record<string, unknown> }
    expect(JSON.stringify(call.data)).not.toMatch(/latitude|longitude|accuracy|address/i)
  })

  it('ignores empty appearance ids without a network call', () => {
    trackFlashSearchStarted('')

    expect(mockApiRequest).not.toHaveBeenCalled()
  })

  it('is fail-open: a rejected send logs a warning and never throws', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('network down'))

    expect(() => trackFlashSearchStarted('appearance-1')).not.toThrow()

    await vi.waitFor(() => {
      expect(mockLogWarn).toHaveBeenCalledWith(
        '[FlashSearchAnalytics] search_started event failed; search continues',
        expect.objectContaining({ message: 'network down' }),
      )
    })
  })
})
