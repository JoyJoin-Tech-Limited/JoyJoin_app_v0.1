import { describe, expect, it, vi } from 'vitest'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import { syncSocialActionResponse } from '../socialActionSync'

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

