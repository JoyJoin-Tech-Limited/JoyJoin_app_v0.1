import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import type { SocialSessionState } from '@shared/socialIcebreaker'
import { apiRequest } from '../../../lib/api/api'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { haptics } from '../../../lib/utils/haptics'
import { logWarn } from '../../../lib/utils/logger'
import {
  XIAOYUE_AGENT_ASK_COPY,
  buildXiaoyueAgentAskViewModel,
  getXiaoyueAgentErrorCode,
  getWarmupTopicSetRevision,
  isTerminalAgentError,
  readXiaoyueAgentSnapshot,
  type XiaoyueAgentAskSnapshot,
  type XiaoyueAgentAskStage,
  type XiaoyueAgentDecisionResponse,
} from '../viewModels/xiaoyueAgentAskModel'

/** Module-level so a rejoin/poll cycle can never re-emit the same shown event. */
const shownAskIds = new Set<string>()

const SLOW_HINT_MS = 4_000
const UNKNOWN_AT_MS = 6_000
const SUCCESS_DWELL_MS = 240
const SUCCESS_EXIT_MS = 120

function buildIdempotencyKey(askId: string): string {
  return `agent_${askId}_${Date.now().toString(36)}`.slice(0, 80)
}

export interface UseXiaoyueAgentAskInput {
  session: SocialSessionState | null | undefined
  socialSessionId: string | null
  isHost: boolean
  offline?: boolean
  applySessionState?: (state: SocialSessionState) => void
  refetchSession?: () => void
  onAigcFeedbackTap?: () => void
}

export function useXiaoyueAgentAsk({
  session,
  socialSessionId,
  isHost,
  offline = false,
  applySessionState,
  refetchSession,
  onAigcFeedbackTap,
}: UseXiaoyueAgentAskInput) {
  const snapshot = useMemo(() => (isHost ? readXiaoyueAgentSnapshot(session) : null), [isHost, session])
  const ask = snapshot?.ask
  const [stage, setStage] = useState<XiaoyueAgentAskStage>('pending')
  const [visible, setVisible] = useState(false)
  const [slow, setSlow] = useState(false)
  const [exiting, setExiting] = useState(false)
  const stageRef = useRef<XiaoyueAgentAskStage>('pending')
  const idempotencyKeyRef = useRef<string | null>(null)
  const acceptInFlightRef = useRef(false)
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([])
  const currentAskIdRef = useRef<string | null>(null)

  const clearTimers = useCallback(() => {
    for (const timer of timersRef.current) clearTimeout(timer)
    timersRef.current = []
  }, [])

  const setStageSafe = useCallback((next: XiaoyueAgentAskStage) => {
    stageRef.current = next
    setStage(next)
  }, [])

  const hide = useCallback((delay = 0) => {
    if (delay > 0) {
      const timer = setTimeout(() => setVisible(false), delay)
      timersRef.current.push(timer)
      return
    }
    setVisible(false)
  }, [])

  // Derive visibility from the server Ask. Only a real open/failed card is
  // actionable; succeeded/ignored/expired/closed never resurrect on rejoin.
  useEffect(() => {
    if (!ask) {
      setVisible(false)
      currentAskIdRef.current = null
      idempotencyKeyRef.current = null
      return
    }
    const isNewAsk = currentAskIdRef.current !== ask.id
    if (isNewAsk) {
      currentAskIdRef.current = ask.id
      idempotencyKeyRef.current = ask.action?.idempotencyKey ?? null
      clearTimers()
      setSlow(false)
      setExiting(false)
      const nextStage: XiaoyueAgentAskStage =
        ask.status === 'failed'
          ? 'failed'
          : ask.status === 'unknown'
            ? 'unknown'
            : 'pending'
      setStageSafe(nextStage)
    }
    if (ask.status === 'pending' || ask.status === 'failed' || ask.status === 'unknown') {
      setVisible(true)
    } else if (ask.status === 'succeeded' || ask.status === 'ignored' || ask.status === 'expired' || ask.status === 'closed_session' || ask.status === 'action_failed_dismissed') {
      // Server already settled; the local success animation owns its own exit.
      if (stageRef.current !== 'success') setVisible(false)
    }
  }, [ask, clearTimers, setStageSafe])

  // First foreground-visible render only, once per askId across rejoin/poll.
  useEffect(() => {
    if (!visible || !ask || !socialSessionId || ask.status !== 'pending') return
    if (shownAskIds.has(ask.id)) return
    shownAskIds.add(ask.id)
    socialIcebreakerAnalytics.track(
      'agent_ask_shown',
      socialSessionId,
      session?.icebreakerSessionId,
      ask.phase,
      { askId: ask.id, kind: ask.kind, reason: ask.reason },
    )
    if (stageRef.current === 'pending') haptics('light')
  }, [ask, session?.icebreakerSessionId, socialSessionId, visible])

  useEffect(() => () => clearTimers(), [clearTimers])

  const recordDecision = useCallback(
    async (decision: 'ignored' | 'closed_session' | 'action_failed_dismissed') => {
      if (!ask || !socialSessionId) return
      try {
        const response = await apiRequest<XiaoyueAgentDecisionResponse>({
          path: `/api/social-icebreaker/${socialSessionId}/xiaoyue/agent/decision`,
          method: 'POST',
          data: { askId: ask.id, decision },
        })
        if (response.state) applySessionState?.(response.state)
        socialIcebreakerAnalytics.track(
          'agent_ask_decision',
          socialSessionId,
          session?.icebreakerSessionId,
          ask.phase,
          { askId: ask.id, decision },
        )
      } catch (error) {
        logWarn('[XiaoyueAgentAsk] decision failed', {
          askId: ask.id,
          decision,
          code: getXiaoyueAgentErrorCode(error),
        })
      } finally {
        setExiting(true)
        hide(120)
      }
    },
    [applySessionState, ask, session?.icebreakerSessionId, socialSessionId],
  )

  const accept = useCallback(async () => {
    if (!ask || !socialSessionId || acceptInFlightRef.current) return
    if (stageRef.current === 'executing' || stageRef.current === 'success') return
    acceptInFlightRef.current = true
    clearTimers()
    setExiting(false)
    setSlow(false)
    setStageSafe('executing')

    if (!idempotencyKeyRef.current) {
      idempotencyKeyRef.current = buildIdempotencyKey(ask.id)
    }
    const idempotencyKey = idempotencyKeyRef.current
    const startedAt = Date.now()

    const slowTimer = setTimeout(() => setSlow(true), SLOW_HINT_MS)
    const unknownTimer = setTimeout(() => {
      if (stageRef.current === 'executing') setStageSafe('unknown')
    }, UNKNOWN_AT_MS)
    timersRef.current.push(slowTimer, unknownTimer)

    try {
      const response = await apiRequest<XiaoyueAgentDecisionResponse>({
        path: `/api/social-icebreaker/${socialSessionId}/xiaoyue/agent/decision`,
        method: 'POST',
        data: { askId: ask.id, decision: 'accepted', idempotencyKey },
        timeout: 12_000,
      })
      if (response.state) applySessionState?.(response.state)
      socialIcebreakerAnalytics.track(
        'agent_action_result',
        socialSessionId,
        session?.icebreakerSessionId,
        ask.phase,
        {
          askId: ask.id,
          result: response.status,
          latencyMs: Date.now() - startedAt,
          ...(response.topicSetRevision !== undefined
            ? { resultRevision: response.topicSetRevision }
            : {}),
        },
      )

      if (response.status === 'succeeded') {
        setStageSafe('success')
        const dwell = setTimeout(() => {
          setExiting(true)
          const exit = setTimeout(() => setVisible(false), SUCCESS_EXIT_MS)
          timersRef.current.push(exit)
        }, SUCCESS_DWELL_MS)
        timersRef.current.push(dwell)
      } else if (response.status === 'unknown') {
        setStageSafe('unknown')
      } else {
        setStageSafe('failed')
      }
    } catch (error) {
      const code = getXiaoyueAgentErrorCode(error)
      socialIcebreakerAnalytics.track(
        'agent_action_result',
        socialSessionId,
        session?.icebreakerSessionId,
        ask.phase,
        {
          askId: ask.id,
          result: 'failed',
          errorCode: code ?? 'TRANSPORT_ERROR',
          latencyMs: Date.now() - startedAt,
        },
      )
      if (isTerminalAgentError(error)) {
        setExiting(true)
        hide(120)
      } else {
        setStageSafe(stageRef.current === 'unknown' ? 'unknown' : 'failed')
      }
    } finally {
      acceptInFlightRef.current = false
    }
  }, [applySessionState, ask, clearTimers, hide, session?.icebreakerSessionId, setStageSafe, socialSessionId])

  const ignore = useCallback(() => {
    void recordDecision('ignored')
  }, [recordDecision])

  const closeSession = useCallback(async () => {
    await recordDecision('closed_session')
    void Taro.showToast({ title: XIAOYUE_AGENT_ASK_COPY.closedToast, icon: 'none', duration: 2_000 })
  }, [recordDecision])

  const dismissFailure = useCallback(() => {
    void recordDecision('action_failed_dismissed')
  }, [recordDecision])

  const reopenPolicy = useCallback(async () => {
    if (!socialSessionId) return
    try {
      const response = await apiRequest<XiaoyueAgentDecisionResponse>({
        path: `/api/social-icebreaker/${socialSessionId}/xiaoyue/agent/policy`,
        method: 'POST',
        data: { proactiveEnabled: true },
      })
      if (response.state) applySessionState?.(response.state)
      socialIcebreakerAnalytics.track(
        'agent_policy_changed',
        socialSessionId,
        session?.icebreakerSessionId,
        'warmup',
        { proactiveEnabled: true },
      )
      void Taro.showToast({ title: '已重新开启主动提示', icon: 'none', duration: 2_000 })
    } catch (error) {
      logWarn('[XiaoyueAgentAsk] reopen policy failed', {
        code: getXiaoyueAgentErrorCode(error),
      })
    }
  }, [applySessionState, session?.icebreakerSessionId, socialSessionId])

  const resync = useCallback(() => {
    const previousRevision = getWarmupTopicSetRevision(session)
    refetchSession?.()
    if (ask) haptics('light')
    void previousRevision
    void accept()
  }, [accept, ask, refetchSession, session])

  const view = ask
    ? buildXiaoyueAgentAskViewModel({
        ask,
        stage: stage === 'offline' ? 'pending' : stage,
        slow,
        offline,
        exiting,
        animateIn: true,
      })
    : null

  return {
    ask: ask as XiaoyueAgentAskSnapshot | undefined,
    view,
    visible: visible && !!view && !!socialSessionId,
    proactiveDisabled: snapshot?.proactiveDisabled === true,
    accept,
    ignore,
    closeSession,
    dismissFailure,
    retry: accept,
    resync,
    reopenPolicy,
    onAigcFeedbackTap,
  }
}

export default useXiaoyueAgentAsk
