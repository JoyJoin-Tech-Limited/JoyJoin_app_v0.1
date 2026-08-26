import { beforeEach, describe, expect, it, vi } from 'vitest'
import { flashStoryAnalytics, type FlashStoryAnalyticsEventType } from './flashStoryAnalytics'

const { mockApiRequest, mockLogWarn } = vi.hoisted(() => ({
  mockApiRequest: vi.fn().mockResolvedValue({ success: true }),
  mockLogWarn: vi.fn(),
}))

vi.mock('../api/api', () => ({ apiRequest: mockApiRequest }))
vi.mock('../utils/logger', () => ({ logWarn: mockLogWarn }))

describe('flashStoryAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())
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

  it('accepts exactly the six vertical-slice events plus the seven action-layer events (AC-08)', () => {
    const events: FlashStoryAnalyticsEventType[] = [
      'story_start',
      'object_interaction_start',
      'object_complete',
      'story_complete',
      'next_npc_click',
      'exit_before_complete',
      'action_shown',
      'first_mistake',
      'hint_shown',
      'result_chosen',
      'imprint_revealed',
      'archive_opened',
      'phase_synthesis_completed',
    ]

    for (const event of events) expect(() => flashStoryAnalytics.track('s1-p1-shiqi', event)).not.toThrow()
  })

  it('carries enum-only metadata (template/result ids), never GPS, text or device ids', () => {
    flashStoryAnalytics.track('s1-p1-alang', 'result_chosen', { template: 'spacing', resultId: 'aligned' })

    expect(mockApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        unitId: 's1-p1-alang',
        eventType: 'result_chosen',
        timestamp: expect.any(Number),
        metadata: { template: 'spacing', resultId: 'aligned' },
      },
    }))
  })

  it('drops invalid metadata but still sends the base event (fail-open)', () => {
    flashStoryAnalytics.track('s1-p1-alang', 'first_mistake', { template: 'teleport' as never })

    expect(mockApiRequest).toHaveBeenCalledWith(expect.objectContaining({
      data: {
        unitId: 's1-p1-alang',
        eventType: 'first_mistake',
        timestamp: expect.any(Number),
      },
    }))
    expect(mockApiRequest.mock.calls[0][0].data).not.toHaveProperty('metadata')
  })

  it('fails open when analytics transport fails', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('offline'))
    expect(() => flashStoryAnalytics.track('s1-p1-shiqi', 'object_complete')).not.toThrow()
    await new Promise((resolve) => setTimeout(resolve, 0))
    expect(mockLogWarn).toHaveBeenCalled()
  })
})
