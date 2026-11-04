import { describe, expect, it, vi } from 'vitest'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import {
  isPhaseConflictError,
  syncPhaseConflictResponse,
  syncSocialActionResponse,
} from '../socialActionSync'

function makeState(): SocialSessionState {
  return {
    socialSessionId: 'social-test',
    icebreakerSessionId: 'test',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: 1,
    sessionStartedAt: 1,
    completedPhases: [],
    warmupReadyUserIds: ['host', 'bot-1', 'bot-2', 'bot-3', 'bot-4', 'bot-5'],
  }
}

describe('syncSocialActionResponse', () => {
  it('applies mutation state without waiting for the reconciliation poll', async () => {
    let finishRefetch: ((result: { isError: boolean }) => void) | undefined
    const refetch = vi.fn(() => new Promise<{ isError: boolean }>((resolve) => {
      finishRefetch = resolve
    }))
    const applyState = vi.fn()

    await syncSocialActionResponse(
      { state: makeState() },
      { applyState, refetch, onSyncError: vi.fn() },
    )

    expect(applyState).toHaveBeenCalledWith(expect.objectContaining({
      warmupReadyUserIds: expect.arrayContaining(['host', 'bot-5']),
    }))
    expect(refetch).toHaveBeenCalledOnce()
    finishRefetch?.({ isError: false })
  })

  it('treats a failed reconciliation poll as a sync warning, not a mutation failure', async () => {
    const onSyncError = vi.fn()

    await syncSocialActionResponse(
      { state: makeState() },
      {
        applyState: vi.fn(),
        refetch: vi.fn().mockRejectedValue(new Error('poll unavailable')),
        onSyncError,
      },
    )
    await Promise.resolve()

    expect(onSyncError).toHaveBeenCalledWith(expect.objectContaining({ message: 'poll unavailable' }))
  })

  it('still waits for a reconciliation poll when a legacy action has no state payload', async () => {
    const applyState = vi.fn()
    const refetch = vi.fn().mockResolvedValue({ isError: false })

    await syncSocialActionResponse(
      { readyCount: 1 },
      { applyState, refetch, onSyncError: vi.fn() },
    )

    expect(applyState).not.toHaveBeenCalled()
    expect(refetch).toHaveBeenCalledOnce()
  })
})

function makeConflictError(state: SocialSessionState | null | undefined) {
  return Object.assign(
    new Error('Phase already advanced by another request: 这一阶段已经推进了，正在同步'),
    {
      statusCode: 409,
      data: {
        error: 'Phase already advanced by another request',
        message: '这一阶段已经推进了，正在同步',
        code: 'PHASE_CONFLICT',
        state,
      },
    },
  )
}

describe('phase conflict (409 PHASE_CONFLICT)', () => {
  it('recognises only a 409 carrying the PHASE_CONFLICT code', () => {
    expect(isPhaseConflictError(makeConflictError(makeState()))).toBe(true)
    expect(isPhaseConflictError(Object.assign(new Error('nope'), {
      statusCode: 409,
      data: { code: 'SOMETHING_ELSE', state: makeState() },
    }))).toBe(false)
    expect(isPhaseConflictError(Object.assign(new Error('nope'), { statusCode: 500 }))).toBe(false)
    expect(isPhaseConflictError(null)).toBe(false)
    expect(isPhaseConflictError('409')).toBe(false)
  })

  it('adopts the authoritative state carried by the 409 instead of failing', async () => {
    const applyState = vi.fn()
    const refetch = vi.fn().mockResolvedValue({ isError: false })

    const handled = await syncPhaseConflictResponse(makeConflictError(makeState()), {
      applyState,
      refetch,
      onSyncError: vi.fn(),
    })

    expect(handled).toBe(true)
    expect(applyState).toHaveBeenCalledWith(expect.objectContaining({
      currentPhase: 'warmup',
      socialSessionId: 'social-test',
    }))
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('falls back to the reconciliation poll when the 409 carries no state', async () => {
    const applyState = vi.fn()
    const refetch = vi.fn().mockResolvedValue({ isError: false })

    const handled = await syncPhaseConflictResponse(makeConflictError(null), {
      applyState,
      refetch,
      onSyncError: vi.fn(),
    })

    expect(handled).toBe(true)
    expect(applyState).not.toHaveBeenCalled()
    expect(refetch).toHaveBeenCalledOnce()
  })

  it('leaves every other failure on the caller\'s error path', async () => {
    const applyState = vi.fn()
    const refetch = vi.fn()

    const handled = await syncPhaseConflictResponse(
      Object.assign(new Error('boom'), { statusCode: 500, data: {} }),
      { applyState, refetch, onSyncError: vi.fn() },
    )

    expect(handled).toBe(false)
    expect(applyState).not.toHaveBeenCalled()
    expect(refetch).not.toHaveBeenCalled()
  })
})

