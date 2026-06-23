// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest } from './api'

const { handleUnauthorizedMock, taroRequestMock } = vi.hoisted(() => ({
  handleUnauthorizedMock: vi.fn(),
  taroRequestMock: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    request: taroRequestMock,
    login: vi.fn(),
  },
}))

vi.mock('./authSession', () => ({
  handleMiniProgramUnauthorized: handleUnauthorizedMock,
}))

describe('mini-program api bootstrap', () => {
  beforeEach(() => {
    handleUnauthorizedMock.mockReset()
    taroRequestMock.mockReset()
  })

  it('uses the 5001 local default when no explicit mini-program API base URL is configured', async () => {
    taroRequestMock.mockResolvedValue({
      statusCode: 200,
      data: { sessionId: 'session-1' },
    })

    const result = await apiRequest<{ sessionId: string }>({
      path: '/api/assessment/v4/start',
      method: 'POST',
    })

    expect(result).toEqual({ sessionId: 'session-1' })
    expect(taroRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:5001/api/assessment/v4/start',
      method: 'POST',
      enableCookie: true,
      timeout: 15000,
    }))
  })

  // Guards against regression: transport failures should expose the configured
  // request target instead of collapsing into a page-level generic fallback.
  it('turns transport failures into actionable ApiErrors with the resolved request target', async () => {
    taroRequestMock.mockRejectedValue({
      errMsg: 'request:fail connect ECONNREFUSED 127.0.0.1:5001',
    })

    try {
      await apiRequest({
        path: '/api/assessment/v4/start',
        method: 'POST',
      })
      throw new Error('Expected apiRequest to reject')
    } catch (error) {
      expect(error).toMatchObject({
        isTransportError: true,
        requestUrl: 'http://localhost:5001/api/assessment/v4/start',
        debugMessage: 'request:fail connect ECONNREFUSED 127.0.0.1:5001',
        message: '无法连接到服务，请确认当前 API 地址 http://localhost:5001 可访问，并且服务已经启动',
      })
    }
  })
})