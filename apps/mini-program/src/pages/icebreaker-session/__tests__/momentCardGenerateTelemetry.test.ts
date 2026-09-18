import { beforeEach, describe, expect, it, vi } from 'vitest'

const { apiRequestMock, logWarnMock } = vi.hoisted(() => ({
  apiRequestMock: vi.fn(),
  logWarnMock: vi.fn(),
}))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: apiRequestMock,
}))

vi.mock('../../../lib/utils/logger', () => ({
  logWarn: logWarnMock,
}))

vi.mock('../icebreakerSessionModel', () => ({
  buildSocialPath: (socialSessionId: string, suffix = '') =>
    `/api/social-icebreaker/${encodeURIComponent(socialSessionId)}${suffix}`,
}))

import {
  emitMomentCardGenerateOnce,
  __resetMomentCardGenerateTelemetryForTests,
} from '../momentCardTelemetry'

describe('emitMomentCardGenerateOnce (Wave 5 T-1, G3 numerator)', () => {
  beforeEach(() => {
    apiRequestMock.mockReset()
    apiRequestMock.mockResolvedValue({ success: true })
    logWarnMock.mockReset()
    __resetMomentCardGenerateTelemetryForTests()
  })

  it('fires the generate event exactly once per session (dedupe across repeat opens)', () => {
    emitMomentCardGenerateOnce('social_abc')
    emitMomentCardGenerateOnce('social_abc')
    emitMomentCardGenerateOnce('social_abc')

    expect(apiRequestMock).toHaveBeenCalledTimes(1)
    expect(apiRequestMock).toHaveBeenCalledWith({
      path: '/api/social-icebreaker/social_abc/moment-card-event',
      method: 'POST',
      data: { action: 'generate' },
    })
  })

  it('emits separately for different sessions', () => {
    emitMomentCardGenerateOnce('social_abc')
    emitMomentCardGenerateOnce('social_def')

    expect(apiRequestMock).toHaveBeenCalledTimes(2)
  })

  it('ignores an empty session id', () => {
    emitMomentCardGenerateOnce('')
    expect(apiRequestMock).not.toHaveBeenCalled()
  })

  it('is fail-open: a rejected POST only logs and the session stays deduped', async () => {
    apiRequestMock.mockRejectedValueOnce(new Error('network down'))

    emitMomentCardGenerateOnce('social_abc')
    // Allow the fire-and-forget promise to settle.
    await new Promise((resolve) => setTimeout(resolve, 0))

    expect(logWarnMock).toHaveBeenCalledTimes(1)
    // A later re-open does not retry — once-per-session semantics hold even
    // on failure (telemetry loss is acceptable; user flow is untouched).
    emitMomentCardGenerateOnce('social_abc')
    expect(apiRequestMock).toHaveBeenCalledTimes(1)
  })
})
