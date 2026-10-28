import { beforeEach, describe, expect, it, vi } from 'vitest'

const apiRequestMock = vi.fn((input: unknown) => {
  void input
  return Promise.resolve({ success: true })
})

vi.mock('../api/api', () => ({
  apiRequest: (input: unknown) => apiRequestMock(input as never),
}))

vi.mock('../utils/logger', () => ({
  logWarn: vi.fn(),
}))

import { gatheringRoomAnalytics } from './gatheringRoomAnalytics'

describe('gatheringRoomAnalytics payload identity', () => {
  beforeEach(() => {
    apiRequestMock.mockClear()
  })

  it('sends the real poolId at the top level and keeps groupId in metadata', async () => {
    gatheringRoomAnalytics.track('room_entered', {
      poolId: 'pool-real-001',
      groupId: 'group-001',
      firstVisit: true,
      visitCount: 1,
    })

    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    const request = apiRequestMock.mock.calls[0][0] as unknown as {
      data: {
        poolId?: string
        metadata: Record<string, unknown>
      }
    }
    expect(request.data.poolId).toBe('pool-real-001')
    expect(request.data.metadata.poolId).toBeUndefined()
    expect(request.data.metadata.groupId).toBe('group-001')
    expect(request.data.metadata.firstVisit).toBe(true)
  })

  it('does not fabricate a poolId from groupId when poolId is unavailable', async () => {
    gatheringRoomAnalytics.track('room_entered', { groupId: 'group-only' })

    await vi.waitFor(() => expect(apiRequestMock).toHaveBeenCalledTimes(1))
    const request = apiRequestMock.mock.calls[0][0] as unknown as {
      data: { poolId?: string; metadata: Record<string, unknown> }
    }
    expect(request.data.poolId).toBeUndefined()
    expect(request.data.metadata.groupId).toBe('group-only')
  })
})
