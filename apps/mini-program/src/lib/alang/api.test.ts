import { beforeEach, describe, expect, it, vi } from 'vitest'
import { callDebugMockArrival } from './api'

const mocks = vi.hoisted(() => ({
  apiRequest: vi.fn(),
}))

vi.mock('../api/api', () => ({
  apiRequest: mocks.apiRequest,
}))

vi.mock('@tarojs/taro', () => ({
  default: {},
}))

describe('Alang mini-program API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.apiRequest.mockResolvedValue({
      arrived: true,
      distanceMeters: 2,
      radiusMeters: 5,
      stableCount: 3,
      nodeId: 'arrival-gate',
      stage: 'arrived',
      debug: true,
    })
  })

  it('requests the existing mock-gps endpoint in arrive mode', async () => {
    await callDebugMockArrival('meet-alang')

    expect(mocks.apiRequest).toHaveBeenCalledTimes(1)
    expect(mocks.apiRequest).toHaveBeenCalledWith({
      path: '/api/alang/debug/missions/meet-alang/mock-gps',
      method: 'POST',
      data: { mode: 'arrive' },
    })
  })
})
