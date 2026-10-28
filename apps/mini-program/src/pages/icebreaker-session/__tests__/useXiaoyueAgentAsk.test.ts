import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'
import { act, renderHook, waitFor } from '@testing-library/react'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import { useXiaoyueAgentAsk } from '../hooks/useXiaoyueAgentAsk'

const api = vi.hoisted(() => ({ request: vi.fn() }))
const analytics = vi.hoisted(() => ({ track: vi.fn() }))

vi.mock('../../../lib/api/api', () => ({
  apiRequest: (...args: unknown[]) => api.request(...args),
}))

vi.mock('../../../lib/analytics/socialIcebreakerAnalytics', () => ({
  socialIcebreakerAnalytics: analytics,
}))

vi.mock('../../../lib/utils/haptics', () => ({ haptics: vi.fn() }))
vi.mock('../../../lib/utils/logger', () => ({ logWarn: vi.fn() }))

function makeSession(overrides: Partial<SocialSessionState> = {}): SocialSessionState {
  return {
    socialSessionId: 'social_agent',
    icebreakerSessionId: 'ib_agent',
    currentPhase: 'warmup',
    hostUserId: 'host',
    hostDisplayName: 'Host',
    playerCount: 6,
    phaseStartedAt: 1,
    sessionStartedAt: 1,
    completedPhases: [],
    warmupTopics: [{ id: 't1', question: 'Q1', mood: 'relaxed', emoji: '' }],
    warmupTopicSetRevision: 1,
    xiaoyueAgent: {
      policy: {
        proactiveDisabled: false,
        ignoredStreak: 0,
        cooldownUntilByKind: {},
        askCount: 1,
        askCountByPhase: { warmup: 1 },
      },
      ask: {
        id: 'ask_hook',
        kind: 'warmup_rotate_topics',
        phase: 'warmup',
        reason: 'topic_stall',
        createdAt: 1,
        baseTopicSetRevision: 1,
        copy: {
          kicker: '悦仔想确认一下',
          question: '这组先聊到这里吗？换一组新话题就好。',
          hint: '你确认后，全桌一起换新',
          cta: '换一组话题卡',
        },
        meta: { generatedAt: '2026-10-26T00:00:00.000Z', fromCache: false, provider: null, fallbackUsed: true },
        status: 'pending',
      },
      agentLlmCallCount: 0,
      agentEstimatedCostYuan: 0,
    },
    ...overrides,
  }
}

const baseProps = {
  session: makeSession(),
  socialSessionId: 'social_agent',
  isHost: true,
}

describe('useXiaoyueAgentAsk — presentation state machine', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    api.request.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('emits agent_ask_shown exactly once for an ask across rerenders/rejoin', async () => {
    const { rerender } = renderHook((props) => useXiaoyueAgentAsk(props), {
      initialProps: baseProps,
    })
    await waitFor(() => expect(analytics.track).toHaveBeenCalledWith(
      'agent_ask_shown',
      'social_agent',
      'ib_agent',
      'warmup',
      expect.objectContaining({ askId: 'ask_hook' }),
    ))
    rerender({ ...baseProps, session: makeSession() })
    rerender({ ...baseProps, session: makeSession() })
    expect(analytics.track.mock.calls.filter(([type]) => type === 'agent_ask_shown')).toHaveLength(1)
  })

  it('never surfaces anything for a non-host or a settled ask', () => {
    const participant = renderHook((props) => useXiaoyueAgentAsk(props), {
      initialProps: { ...baseProps, isHost: false },
    })
    expect(participant.result.current.visible).toBe(false)

    const settled = renderHook((props) => useXiaoyueAgentAsk(props), {
      initialProps: {
        ...baseProps,
        session: makeSession({
          xiaoyueAgent: {
            ...makeSession().xiaoyueAgent!,
            ask: { ...makeSession().xiaoyueAgent!.ask!, status: 'succeeded' as const },
          },
        }),
      },
    })
    expect(settled.result.current.visible).toBe(false)
  })

  it('moves to unknown at the 6s boundary instead of faking success', async () => {
    vi.useFakeTimers()
    api.request.mockImplementation(() => new Promise(() => {}))
    const { result } = renderHook((props) => useXiaoyueAgentAsk(props), {
      initialProps: baseProps,
    })
    act(() => {
      void result.current.accept()
    })
    expect(result.current.view?.stage).toBe('executing')
    await act(async () => {
      vi.advanceTimersByTime(6_001)
    })
    expect(result.current.view?.stage).toBe('unknown')
    expect(result.current.view?.hint).toContain('当前话题保留')
  })

  it('keeps unknown when a succeeded response arrives late and never applies that late snapshot', async () => {
    vi.useFakeTimers()
    let resolveRequest!: (value: any) => void
    api.request.mockImplementation(() => new Promise((resolve) => {
      resolveRequest = resolve
    }))
    const applySessionState = vi.fn()
    const { result } = renderHook((props) => useXiaoyueAgentAsk(props), {
      initialProps: { ...baseProps, applySessionState },
    })
    act(() => {
      void result.current.accept()
    })
    await act(async () => {
      vi.advanceTimersByTime(6_001)
    })
    expect(result.current.view?.stage).toBe('unknown')

    const agent = makeSession().xiaoyueAgent!
    const committed = makeSession({
      warmupTopicSetRevision: 2,
      xiaoyueAgent: {
        ...agent,
        ask: { ...agent.ask!, status: 'succeeded' as const },
      },
    })
    await act(async () => {
      resolveRequest({ status: 'succeeded', topicSetRevision: 2, state: committed })
      await Promise.resolve()
    })

    expect(applySessionState).not.toHaveBeenCalled()
    expect(result.current.view?.stage).toBe('unknown')
    expect(result.current.visible).toBe(true)
    expect(api.request.mock.calls[0][0]).toMatchObject({ timeout: 6_500 })
    await act(async () => {
      vi.advanceTimersByTime(1_000)
    })
    expect(result.current.view?.stage).toBe('unknown')
    expect(result.current.visible).toBe(true)
  })

  it('renders success only from a server-confirmed response and applies its state', async () => {
    const next = makeSession({ warmupTopicSetRevision: 2 })
    api.request.mockResolvedValue({ status: 'succeeded', topicSetRevision: 2, state: next })
    const applySessionState = vi.fn()
    const { result } = renderHook((props) => useXiaoyueAgentAsk(props), {
      initialProps: { ...baseProps, applySessionState },
    })
    await act(async () => {
      await result.current.accept()
    })
    expect(applySessionState).toHaveBeenCalledWith(next)
    expect(result.current.view?.stage).toBe('success')
  })

  it('records ignored as a decision and hides without a cooldown banner', async () => {
    api.request.mockResolvedValue({ status: 'decision_recorded', state: makeSession() })
    const { result } = renderHook((props) => useXiaoyueAgentAsk(props), {
      initialProps: baseProps,
    })
    await act(async () => {
      await result.current.ignore()
    })
    expect(api.request).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ decision: 'ignored' }) }),
    )
  })
})
