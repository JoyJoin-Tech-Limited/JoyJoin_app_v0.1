import { beforeEach, describe, expect, it, vi } from 'vitest'
import { trackMiniScriptGameplay } from './miniscriptGameplayAnalytics'

const { mockApiRequest, mockLogWarn } = vi.hoisted(() => ({
  mockApiRequest: vi.fn().mockResolvedValue({ success: true }),
  mockLogWarn: vi.fn(),
}))

vi.mock('../api/api', () => ({ apiRequest: mockApiRequest }))
vi.mock('../utils/logger', () => ({ logWarn: mockLogWarn }))

describe('miniscriptGameplayAnalytics', () => {
  beforeEach(() => vi.clearAllMocks())

  it('posts whitelisted gameplay events to the discover analytics endpoint', () => {
    trackMiniScriptGameplay('miniscript_evidence_presented', { actNo: 2 })

    expect(mockApiRequest).toHaveBeenCalledWith({
      path: '/api/analytics/discover',
      method: 'POST',
      data: {
        eventType: 'miniscript_evidence_presented',
        metadata: { actNo: 2 },
        timestamp: expect.any(Number),
      },
      handleUnauthorized: false,
    })
  })

  it('sends vote round events with no spoiler metadata', () => {
    trackMiniScriptGameplay('miniscript_vote_round1_submitted')
    trackMiniScriptGameplay('miniscript_vote_round2_submitted')

    for (const call of mockApiRequest.mock.calls) {
      const data = (call[0] as { data: Record<string, unknown> }).data
      // SEC-03: never reaction text, motive correctness, or suspect choices.
      expect(JSON.stringify(data)).not.toMatch(
        /reaction|motiveChoice|suspectRoleSlot|correct|who|why/i,
      )
    }
  })

  it('is fail-open: a rejected send logs a warning and never throws', async () => {
    mockApiRequest.mockRejectedValueOnce(new Error('network down'))

    expect(() => trackMiniScriptGameplay('miniscript_clue_drawer_opened', { itemCount: 5 })).not.toThrow()

    await vi.waitFor(() => {
      expect(mockLogWarn).toHaveBeenCalledWith(
        '[MiniScriptAnalytics] event failed; gameplay continues',
        expect.objectContaining({ eventType: 'miniscript_clue_drawer_opened' }),
      )
    })
  })
})
