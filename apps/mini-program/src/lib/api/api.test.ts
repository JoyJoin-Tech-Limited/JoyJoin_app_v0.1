// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { apiRequest, authenticateMiniProgramUserWithTest } from './api'

const { handleUnauthorizedMock, taroRequestMock, taroLoginMock } = vi.hoisted(() => ({
  handleUnauthorizedMock: vi.fn(),
  taroRequestMock: vi.fn(),
  taroLoginMock: vi.fn(),
}))

vi.mock('@tarojs/taro', () => ({
  default: {
    request: taroRequestMock,
    login: taroLoginMock,
  },
}))

vi.mock('./authSession', () => ({
  handleMiniProgramUnauthorized: handleUnauthorizedMock,
}))

describe('mini-program api bootstrap', () => {
  beforeEach(() => {
    handleUnauthorizedMock.mockReset()
    taroRequestMock.mockReset()
    taroLoginMock.mockReset()
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

describe('authenticateMiniProgramUserWithTest referral attribution', () => {
  beforeEach(() => {
    taroRequestMock.mockReset()
    taroLoginMock.mockReset()
    taroLoginMock.mockResolvedValue({ code: 'wx-code-1' })
    taroRequestMock.mockResolvedValue({
      statusCode: 200,
      data: { success: true, sessionToken: 'token-1', isNewUser: true },
    })
  })

  // Guards the 2026-10-09 attribution-leak fix: a guest who arrived via a
  // share link and logs in at the results stage must carry the referral code
  // through to the login-with-test payload (server persists it into
  // session.pendingReferralCode).
  it('forwards referralCode in the login-with-test payload when provided', async () => {
    await authenticateMiniProgramUserWithTest({
      testAnswers: [],
      anonymousSessionId: null,
      referralCode: 'INVITE42',
    })

    expect(taroRequestMock).toHaveBeenCalledWith(expect.objectContaining({
      url: 'http://localhost:5001/api/auth/wechat/login-with-test',
      method: 'POST',
      data: expect.objectContaining({
        code: 'wx-code-1',
        testAnswers: [],
        referralCode: 'INVITE42',
      }),
    }))
  })

  it('keeps referralCode undefined when not provided', async () => {
    await authenticateMiniProgramUserWithTest({
      testAnswers: [],
      anonymousSessionId: 'sess-1',
    })

    const requestOptions = taroRequestMock.mock.calls[0]?.[0] as { data?: Record<string, unknown> }
    expect(requestOptions.data?.anonymousSessionId).toBe('sess-1')
    expect(requestOptions.data?.referralCode).toBeUndefined()
  })

  it('normalizes a blank referralCode to undefined', async () => {
    await authenticateMiniProgramUserWithTest({
      testAnswers: [],
      referralCode: '',
    })

    const requestOptions = taroRequestMock.mock.calls[0]?.[0] as { data?: Record<string, unknown> }
    expect(requestOptions.data?.referralCode).toBeUndefined()
  })
})
