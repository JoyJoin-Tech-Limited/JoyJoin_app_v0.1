import { describe, expect, it, vi } from 'vitest'
import { flashStoryAnalytics, type FlashStoryAnalyticsEventType } from './flashStoryAnalytics'

const { mockApiRequest, mockLogWarn } = vi.hoisted(() => ({
  mockApiRequest: vi.fn().mockResolvedValue({ success: true }),
  mockLogWarn: vi.fn(),
}))

vi.mock('../api/api', () => ({ apiRequest: mockApiRequest }))
vi.mock('../utils/logger', () => ({ logWarn: mockLogWarn }))

describe('flashStoryAnalytics', () => {
  it('posts only event type and timestamp to the anonymous endpoint', () => {
    flashStoryAnalytics.track('s1-p1-shiqi', 'story_start')

    expect(mockApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      path: '/api/analytics/flash-story',
      method: 'POST',
      handleUnauthorized: false,
      data: {
        unitId: 's1-p1-shiqi',
        eventType: 'story_start',
        timestamp: expect.any(Number),
      },
    }))
    expect(mockApiRequest.mock.calls[0][0].data).not.toHaveProperty('metadata')
  })

  it('accepts exactly the six vertical-slice events', () => {
    const events: FlashStoryAnalyticsEventType[] = [
      'story_start',
      'object_interaction_start',
      'object_complete',
      'story_complete',
      'next_npc_click',
      'exit_before_complete',
    ]

    for (const event of events) expect(() => flashStoryAnalytics.track('s1-p1-shiqi', event)).not.toThrow()
  })

  it('fails open when analytics transport fails', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('offline'))
    expect(() => flashStoryAnalytics.track('s1-p1-shiqi', 'object_complete')).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockLogWarn).toHaveBeenCalled()
  })
})
