import { useCallback, useEffect, useRef, useState } from 'react'
import Taro from '@tarojs/taro'
import type { QueryClient } from '@tanstack/react-query'
import type {
  AtmosphereMood,
  SocialIcebreakerPhase,
  SocialSessionState,
  SocialTopic,
} from '@shared/socialIcebreaker'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { MiniScriptVoteInput } from '@shared/miniscriptStoryFramework'
import { apiRequest } from '../../../lib/api/api'
import { TOAST_DEFAULT_MS, TOAST_MEDIUM_MS } from '../../../lib/utils/uiConstants'
import { logError, logInfo, logWarn } from '../../../lib/utils/logger'
import { socialHaptics } from '../../../lib/utils/haptics'
import { VIBE_TO_API, type VibeId } from '../../../lib/vibeMapping'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { buildSocialPath, getErrorText } from '../icebreakerSessionModel'
import type { SessionParticipant } from '../phaseUtils'
import { syncSocialActionResponse } from '../socialActionSync'
import {
  classifyTopicsFailure,
  getTopicsServerRetryDelayMs,
  shouldRetryWarmupTopics,
  type TopicsFailureKind,
  type TopicsRecoveryState,
} from '../viewModels/warmupViewModels'
import { getGenerationRetryDelayMs, type GenerationPendingResponse } from '../viewModels/phaseProgressionModels'
import type { TierSheetSelection } from '../components/IcebreakerTierSheet'

// Warmup topic generation is LLM-backed (6s server LLM race + curated-topic
// fallback + DB writes). Anything past ~8s means the request never reached a
// healthy route (gateway 502 / dev-server restart) — fail fast and let the
// patient backoff retry ride through the flap instead of staring at a dead
// shimmer (2026-07-28 502 incident).
const TOPICS_REQUEST_TIMEOUT_MS = 8000
const SKIPPED_ACTION_TOAST_INTERVAL_MS = 1500
const TOPICS_SKIP_RETRY_MAX = 5
const TOPICS_SKIP_RETRY_DELAY_MS = 700
const TOPICS_RECOVERY_RETRY_DELAY_MS = 1200
// Transient 5xx/network failures get this many patient auto-retries (backoff
// ladder lives in warmupViewModels.TOPICS_SERVER_RETRY_BACKOFF_MS) before the
// terminal error card appears.
const TOPICS_SERVER_RETRY_MAX = 3

type WarmupTopicsResponse = {
  topics?: SocialTopic[]
  state?: SocialSessionState
}

type WarmupReadyResponse = {
  readyUserIds: string[]
  readyCount: number
  allReady: boolean
  currentTopicIndex: number
  commonGroundCount: number
  state: SocialSessionState
}

/**
 * useSocialActions — every mutating action the icebreaker session page can
 * fire, extracted from the page (2026-08-12) to keep index.tsx under the
 * harness gate's 1200-line warn limit. Owns the shared action dispatcher
 * (performSocialAction), the warmup-topics generation cluster with its
 * patient backoff retry ladder, the tier-switch flow, and the per-phase
 * handlers. Pure hook: no JSX, no page state except what arrives via args.
 */
export interface UseSocialActionsArgs {
  socialSessionId: string | null
  session: SocialSessionState | null
  participants: SessionParticipant[]
  currentUserId: string
  currentUserDisplayName: string
  currentUserArchetype: string | undefined
  currentUserInterests: string[]
  playerCount: number
  phase: string
  phaseRef: React.MutableRefObject<string>
  isHost: boolean
  syncLost: boolean
  pendingAction: string | null
  setPendingAction: React.Dispatch<React.SetStateAction<string | null>>
  hapticGrammarEnabled: boolean
  applySocialSessionState: (nextState: SocialSessionState) => void
  /** Query refetch — structurally compatible with syncSocialActionResponse's
   *  RefetchResult shape ({ error?, isError? }). */
  refetchSession: () => Promise<{ error?: unknown; isError?: boolean }>
  bootstrapState: SocialSessionState | null
  socialSessionQueryData: SocialSessionState | undefined
  queryClient: QueryClient
  setBootstrapState: (state: SocialSessionState | null) => void
  setIsTierSheetOpen: (open: boolean) => void
  setPendingTierSwitch: (selection: TierSheetSelection | null) => void
  setDismissedSuggestionAt: (value: string | null) => void
}

export function useSocialActions(args: UseSocialActionsArgs) {
  const {
    socialSessionId,
    session,
    participants,
    currentUserId,
    currentUserDisplayName,
    currentUserArchetype,
    currentUserInterests,
    playerCount,
    phase,
    phaseRef,
    isHost,
    syncLost,
    pendingAction,
    setPendingAction,
    hapticGrammarEnabled,
    applySocialSessionState,
    refetchSession,
    bootstrapState,
    socialSessionQueryData,
    queryClient,
    setBootstrapState,
    setIsTierSheetOpen,
    setPendingTierSwitch,
    setDismissedSuggestionAt,
  } = args

  const applyWarmupTopicsToLocalState = useCallback((mood: AtmosphereMood, topics: SocialTopic[], nextState?: SocialSessionState) => {
    if (!socialSessionId || topics.length === 0) {
      return
    }

    const baseState = nextState ?? socialSessionQueryData ?? bootstrapState
    if (!baseState) {
      return
    }

    const patchedState: SocialSessionState = {
      ...baseState,
      selectedMood: mood,
      warmupTopics: topics,
      warmupTopicsStatus: 'ready',
      currentTopicIndex: 0,
      // The server is the single writer of the ready set — never hard-reset
      // it locally (2026-07-26: wiping this wiped bot-ready seeding and
      // produced the 5/6 → 0/6 "lying counter" frame).
    }

    setBootstrapState(patchedState)
    queryClient.setQueryData(['mini-program', 'social-icebreaker-session', socialSessionId], patchedState)
  }, [bootstrapState, queryClient, socialSessionId, socialSessionQueryData, setBootstrapState])

  const performSocialAction = useCallback(
    async <T,>(
      actionKey: string,
      suffix: string,
      data?: unknown,
      options?: { timeoutMs?: number; suppressErrorToast?: boolean; onError?: (error: unknown) => void },
    ): Promise<T | null | undefined> => {
      if (!socialSessionId) {
        return null
      }

      if (pendingAction !== null) {
        // Skipped (another action — or a duplicate of this same one — already
        // in flight). Distinct from a real failure so callers don't surface a
        // false error state. Blocking same-key duplicates also closes the
        // parallel-POST vector that could fire two LLM generations at once.
        // Never silent (2026-07-26 死屏 incident): throttled acknowledgement.
        const now = Date.now()
        if (now - skippedActionToastAtRef.current > SKIPPED_ACTION_TOAST_INTERVAL_MS) {
          skippedActionToastAtRef.current = now
          void Taro.showToast({ title: '正在同步，请稍候', icon: 'none', duration: 1500 })
        }
        return undefined
      }

      setPendingAction(actionKey)

      try {
        const response = await apiRequest<T>({
          // Full `/api/...` paths (mini-script family) bypass the session-scoped
          // buildSocialPath alias — those routes live at the top level.
          path: suffix.startsWith('/api/') ? suffix : buildSocialPath(socialSessionId, suffix),
          method: 'POST',
          data,
          timeout: options?.timeoutMs,
        })

        await syncSocialActionResponse(response, {
          applyState: applySocialSessionState,
          refetch: refetchSession,
          onSyncError: (syncError) => {
            logWarn('[IcebreakerSession] Action succeeded but session reconciliation failed', {
              socialSessionId,
              actionKey,
              message: syncError instanceof Error ? syncError.message : String(syncError),
            })
          },
        })
        // S1: Confirm fires on the success path of every mutating action, so
        // a felt "land" replaces visual verification. Flag-gated; failure and
        // skipped-action paths stay silent.
        if (hapticGrammarEnabled) {
          socialHaptics('socialConfirm')
        }
        return response
      } catch (error) {
        const message = getErrorText(error, '操作没成功，再试试')
        logError('[IcebreakerSession] Social action failed', {
          socialSessionId,
          actionKey,
          message,
        })
        // Let the owning flow classify the failure (e.g. topics treats 5xx /
        // network flaps as transient and auto-retries with backoff).
        options?.onError?.(error)
        // Some flows own a persistent error surface (e.g. the topics error
        // card with 重试) — a transient toast on top is double-signalling.
        if (!options?.suppressErrorToast) {
          Taro.showToast({
            title: message.length > 12 ? '操作没成功' : message,
            icon: 'none',
            duration: TOAST_MEDIUM_MS,
          })
        }
        return null
      } finally {
        setPendingAction((current) => (current === actionKey ? null : current))
      }
    },
    [applySocialSessionState, hapticGrammarEnabled, socialSessionId, pendingAction, refetchSession, setPendingAction],
  )

  const skippedActionToastAtRef = useRef(0)
  const topicsSkipRetryRef = useRef(0)
  const topicsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const topicsRecoveryRetryCountRef = useRef(0)
  const topicsRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const generateTopicsRef = useRef<(mood: AtmosphereMood) => void>(() => {})
  // Last mood the host actually requested — retry path survives even when the
  // server never persisted selectedMood (e.g. request died before the write).
  const lastTopicsMoodRef = useRef<AtmosphereMood | undefined>(undefined)
  // 2026-07-28 502 incident — transient 5xx/network failures get a patient
  // backoff auto-retry ladder with visible recovery copy; 4xx goes straight
  // to the terminal error card.
  const [topicsRecovery, setTopicsRecovery] = useState<TopicsRecoveryState | null>(null)
  const topicsFailureKindRef = useRef<TopicsFailureKind>('generic')
  const topicsServerRetryCountRef = useRef(0)
  const [topicsError, setTopicsError] = useState(false)

  const generateTopics = useCallback((mood: AtmosphereMood) => {
    setTopicsError(false)
    lastTopicsMoodRef.current = mood
    void performSocialAction<WarmupTopicsResponse>('topics', '/topics', {
      mood,
      eventType: '活动',
      participantCount: Math.max(playerCount, 2),
      avoidTopics: [],
    }, {
      timeoutMs: TOPICS_REQUEST_TIMEOUT_MS,
      suppressErrorToast: true,
      onError: (error) => {
        topicsFailureKindRef.current = classifyTopicsFailure(error)
      },
    }).then((result) => {
      if (result === null) {
        // Transient server/gateway failure (5xx or bare network/timeout — the
        // route itself never 5xxs, it degrades to curated topics): ride
        // through the restart with a patient backoff ladder + visible
        // recovery state instead of an instant dead-end error card.
        if (
          topicsFailureKindRef.current === 'server'
          && topicsServerRetryCountRef.current < TOPICS_SERVER_RETRY_MAX
        ) {
          topicsServerRetryCountRef.current += 1
          const attempt = topicsServerRetryCountRef.current
          setTopicsRecovery({ attempt, maxAttempts: TOPICS_SERVER_RETRY_MAX })
          logInfo('[IcebreakerSession] Topics request hit a transient failure; auto-retrying with backoff', {
            socialSessionId,
            attempt,
            maxAttempts: TOPICS_SERVER_RETRY_MAX,
          })
          topicsRetryTimerRef.current = setTimeout(
            () => {
              // The host may have moved the session out of warmup
              // during the backoff window — never regenerate topics for a
              // phase that no longer displays them.
              if (phaseRef.current !== 'warmup' && phaseRef.current !== 'waiting') return
              generateTopicsRef.current(mood)
            },
            getTopicsServerRetryDelayMs(attempt),
          )
          return
        }
        // Terminal failure — surface the designed error card (重试 +
        // auto-retry) instead of the old phantom local-fallback deck — the
        // fallback dealt a card the next poll then swapped out, producing an
        // error-toast-plus-card flash and a visible ready-count wipe.
        setTopicsRecovery(null)
        setTopicsError(true)
        topicsSkipRetryRef.current = 0
      } else if (result === undefined) {
        // Skipped because another social action was in flight — the tap would
        // otherwise be lost. Retry briefly until the in-flight action settles.
        if (topicsSkipRetryRef.current < TOPICS_SKIP_RETRY_MAX) {
          topicsSkipRetryRef.current += 1
          topicsRetryTimerRef.current = setTimeout(() => generateTopicsRef.current(mood), TOPICS_SKIP_RETRY_DELAY_MS)
        }
      } else {
        if (Array.isArray(result.topics) && result.topics.length > 0) {
          applyWarmupTopicsToLocalState(mood, result.topics, result.state)
        }
        topicsSkipRetryRef.current = 0
        topicsRecoveryRetryCountRef.current = 0
        topicsServerRetryCountRef.current = 0
        setTopicsRecovery(null)
      }
    })
  }, [applyWarmupTopicsToLocalState, performSocialAction, playerCount, socialSessionId, phaseRef])
  generateTopicsRef.current = generateTopics

  const handleGenerateTopics = useCallback((mood: AtmosphereMood) => {
    topicsSkipRetryRef.current = 0
    topicsRecoveryRetryCountRef.current = 0
    topicsServerRetryCountRef.current = 0
    setTopicsRecovery(null)
    if (topicsRetryTimerRef.current) {
      clearTimeout(topicsRetryTimerRef.current)
      topicsRetryTimerRef.current = undefined
    }
    generateTopicsRef.current(mood)
  }, [])

  useEffect(() => () => {
    if (topicsRetryTimerRef.current) {
      clearTimeout(topicsRetryTimerRef.current)
    }
    if (topicsRecoveryTimerRef.current) {
      clearTimeout(topicsRecoveryTimerRef.current)
    }
  }, [])

  const handleToggleWarmupReady = useCallback(() => {
    const isReady = session?.warmupReadyUserIds?.includes(currentUserId) ?? false
    void performSocialAction<WarmupReadyResponse>('warmup-ready', '/warmup/ready', { ready: !isReady }, { suppressErrorToast: true })
      .then((result) => {
        if (result === null) {
          // Rollback path (the optimistic morph in WarmupPhaseView reverts via
          // the isUpdatingReady effect) — acknowledge warmly and keep the CTA.
          void Taro.showToast({ title: '刚才那一下没传到，再点一次试试', icon: 'none', duration: 2000 })
        }
      })
  }, [performSocialAction, session?.warmupReadyUserIds, currentUserId])

  const handleNextWarmupTopic = useCallback(() => {
    void performSocialAction('warmup-next-topic', '/warmup/next-topic', {})
  }, [performSocialAction])

  const handleAssignRoles = useCallback(() => {
    void performSocialAction('miniscript-assign-roles', '/api/miniscript/assign-roles', {
      socialSessionId,
    })
  }, [performSocialAction, socialSessionId])

  const handleRevealAct = useCallback((targetAct: number) => {
    void performSocialAction('miniscript-reveal-act', '/api/miniscript/reveal-act', {
      socialSessionId,
      targetAct,
    })
  }, [performSocialAction, socialSessionId])

  const handleVote = useCallback((vote: MiniScriptVoteInput) => {
    void performSocialAction('miniscript-vote', '/api/miniscript/vote', {
      socialSessionId,
      vote,
    })
  }, [performSocialAction, socialSessionId])

  const handleRevealSolution = useCallback((onError?: (error: unknown) => void) => {
    // Optional caller-owned error handling (e.g. the mini-script hero view
    // toasts the remaining-vote count on a 400 WAITING_FOR_VOTES instead of
    // the generic action-failed toast).
    void performSocialAction('miniscript-reveal-solution', '/api/miniscript/reveal-solution', {
      socialSessionId,
    }, onError ? { suppressErrorToast: true, onError } : undefined)
  }, [performSocialAction, socialSessionId])

  const handleMiniScriptReady = useCallback((ready: boolean) => {
    void performSocialAction('miniscript-ready', '/api/miniscript/ready', {
      socialSessionId,
      ready,
    })
  }, [performSocialAction, socialSessionId])

  const handleAdvancePhase = useCallback(() => {
    if (!session) {
      return
    }

    logInfo('[IcebreakerSession] Advancing phase', {
      socialSessionId,
      phase: session.currentPhase,
    })

    void performSocialAction('advance', '/advance', {
      currentPhase: session.currentPhase,
    })
  }, [performSocialAction, session, socialSessionId])

  // PR1 flow revamp — stall nudge: host explicitly skips stragglers (force)
  // or suppresses stall automation for the rest of the phase.
  const handleSelectCustomPhase = useCallback(
    (selectedPhase: SocialIcebreakerPhase) => {
      if (!socialSessionId || !session?.phaseSelectionId) {
        return
      }

      if (pendingAction !== null) {
        return
      }

      void performSocialAction<{ state?: SocialSessionState }>(
        'select-phase',
        '/select-phase',
        { phase: selectedPhase, phaseSelectionId: session.phaseSelectionId },
        {
          suppressErrorToast: true,
          onError: (err) => {
            logError('[IcebreakerSession] Select custom phase failed', { socialSessionId, selectedPhase, err })
            socialIcebreakerAnalytics.track(
              'select_phase_failed',
              socialSessionId,
              session?.icebreakerSessionId,
              selectedPhase,
              {
                phaseSelectionId: session?.phaseSelectionId,
                playerCount,
                error: err instanceof Error ? err.message : 'unknown',
              },
            )
          },
        },
      ).then((result) => {
        if (result === null) {
          void Taro.showToast({
            title: '选择没成功，再试试',
            icon: 'none',
            duration: 2000,
          })
        }
      })
    },
    [performSocialAction, socialSessionId, session, pendingAction, playerCount],
  )

  const handleEndCustomSession = useCallback(
    () => {
      if (!socialSessionId || !session?.phaseSelectionId) {
        return
      }

      if (pendingAction !== null) {
        return
      }

      socialIcebreakerAnalytics.track(
        'end_party_tapped',
        socialSessionId,
        session.icebreakerSessionId,
        undefined,
        {
          phaseSelectionId: session.phaseSelectionId,
          playerCount,
          completedCount: session.completedPhases?.length ?? 0,
        },
      )

      void performSocialAction<{ state?: SocialSessionState }>(
        'end-session',
        '/end-session',
        { phaseSelectionId: session.phaseSelectionId },
        {
          suppressErrorToast: true,
          onError: (err) => {
            logError('[IcebreakerSession] End custom session failed', { socialSessionId, err })
            socialIcebreakerAnalytics.track(
              'end_party_failed',
              socialSessionId,
              session?.icebreakerSessionId,
              undefined,
              {
                phaseSelectionId: session?.phaseSelectionId,
                playerCount,
                completedCount: session?.completedPhases?.length ?? 0,
                error: err instanceof Error ? err.message : 'unknown',
              },
            )
          },
        },
      ).then((result) => {
        if (result === null) {
          void Taro.showToast({
            title: '结束派对没成功，再试试',
            icon: 'none',
            duration: 2000,
          })
          return
        }
        if (result) {
          socialIcebreakerAnalytics.track(
            'custom_session_completed',
            socialSessionId,
            session.icebreakerSessionId,
            undefined,
            {
              playerCount,
              completedPhases: session.completedPhases,
            },
          )
        }
      })
    },
    [performSocialAction, socialSessionId, session, pendingAction, playerCount],
  )

  useEffect(() => {
    const topicCount = session?.warmupTopics?.length ?? 0
    if (topicCount > 0) {
      setTopicsError(false)
      setTopicsRecovery(null)
      topicsRecoveryRetryCountRef.current = 0
      topicsServerRetryCountRef.current = 0
      // Topics arrived through polling while a backoff retry was still
      // pending — cancel it so the loaded card never flips back to generating.
      if (topicsRetryTimerRef.current) {
        clearTimeout(topicsRetryTimerRef.current)
        topicsRetryTimerRef.current = undefined
      }
      return
    }

    if (!shouldRetryWarmupTopics({
      isHost,
      topicsError,
      syncLost,
      topicCount,
      selectedMood: session?.selectedMood ?? lastTopicsMoodRef.current,
      pendingAction,
      retryCount: topicsRecoveryRetryCountRef.current,
    })) return

    topicsRecoveryRetryCountRef.current += 1
    topicsRecoveryTimerRef.current = setTimeout(() => {
      topicsRecoveryTimerRef.current = undefined
      const mood = (session?.selectedMood ?? lastTopicsMoodRef.current) as AtmosphereMood | undefined
      if (mood) {
        generateTopicsRef.current(mood)
      }
    }, TOPICS_RECOVERY_RETRY_DELAY_MS)

    return () => {
      if (topicsRecoveryTimerRef.current) {
        clearTimeout(topicsRecoveryTimerRef.current)
        topicsRecoveryTimerRef.current = undefined
      }
    }
  }, [isHost, pendingAction, session?.selectedMood, session?.warmupTopics?.length, syncLost, topicsError])

  const executeTierSwitch = useCallback(
    async (tier: TierMachineId, vibe: VibeId) => {
      if (!socialSessionId || !session || pendingAction !== null) {
        return
      }

      logInfo('[IcebreakerSession] Setting tier', {
        socialSessionId,
        tier,
        vibe,
      })

      const result = await performSocialAction<{ state?: SocialSessionState }>(
        'set-tier',
        '/set-tier',
        {
          tier,
          vibe: tier === 'custom' ? undefined : VIBE_TO_API[vibe],
        },
        {
          suppressErrorToast: true,
          onError: (err) => {
            logError('[IcebreakerSession] Set tier failed', { error: err })
          },
        },
      )

      if (result) {
        socialIcebreakerAnalytics.track(
          'icebreaker_session_tier_changed',
          socialSessionId,
          session.icebreakerSessionId,
          phase,
          {
            fromTier: session.eventTier,
            toTier: tier,
            fromMode: session.eventTier === 'custom' ? 'custom' : 'preset',
            toMode: tier === 'custom' ? 'custom' : 'preset',
            playerCount,
          },
        )
        void Taro.showToast({
          title: `已切换为${tier === 'custom' ? '自由局' : '新模式'}`,
          icon: 'success',
          duration: TOAST_DEFAULT_MS,
        })
        return
      }

      if (result === null) {
        void Taro.showToast({
          title: '切换没成功，再试试',
          icon: 'none',
          duration: 2000,
        })
      }
    },
    [performSocialAction, socialSessionId, session, pendingAction, phase, playerCount],
  )

  const handleConfirmTierSwitch = useCallback(
    (selection: TierSheetSelection) => {
      const currentMode = session?.eventTier === 'custom' ? 'custom' : 'preset'
      const nextMode = selection.tier === 'custom' ? 'custom' : 'preset'
      const needsCustomConfirm = currentMode !== nextMode

      if (needsCustomConfirm) {
        setPendingTierSwitch(selection)
        setIsTierSheetOpen(false)
        return
      }

      setIsTierSheetOpen(false)
      void executeTierSwitch(selection.tier, selection.vibe)
    },
    [session?.eventTier, executeTierSwitch, setIsTierSheetOpen, setPendingTierSwitch],
  )

  const handleCompleteChallenge = useCallback(() => {
    socialIcebreakerAnalytics.track(
      'micro_challenge_completed',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      'micro_challenge',
      { playerCount },
    )
    void performSocialAction('micro-complete', '/micro-challenge/complete', {})
  }, [performSocialAction, socialSessionId, session?.icebreakerSessionId, playerCount])

  const handleNextSpeedFriendingRound = useCallback(() => {
    void performSocialAction('speed-next', '/speed-friending/next-round', {})
  }, [performSocialAction])

  const handleCompleteSpeedFriending = useCallback(() => {
    void performSocialAction('speed-complete', '/speed-friending/complete', {})
  }, [performSocialAction])

  const handleGenerateStatements = useCallback((statements?: string[], lieIndex?: number) => {
    void performSocialAction('lie-generate', '/lie-detective/generate', {
      displayName: currentUserDisplayName,
      archetype: currentUserArchetype,
      interests: currentUserInterests,
      ...(statements && lieIndex ? { statements, lieIndex } : {}),
    })
  }, [performSocialAction, currentUserDisplayName, currentUserArchetype, currentUserInterests])

  const handleGenerateLieStatementFromTag = useCallback(async (tag: string) => {
    const result = await performSocialAction<{ text: string }>(
      'lie-tag-generate',
      '/lie-detective/generate-from-tag',
      { tag, displayName: currentUserDisplayName },
    )
    return result?.text ?? null
  }, [performSocialAction, currentUserDisplayName])

  const handleCastVote = useCallback(
    (statementIndex: number) => {
      const targetPlayer = session?.lieDetectivePlayers?.[session.currentLieDetectivePlayerIndex ?? 0]
      if (!targetPlayer) {
        return
      }

      socialIcebreakerAnalytics.track(
        'lie_vote_cast',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        'lie_detective',
        { playerCount },
      )
      void performSocialAction('lie-vote', '/lie-detective/vote', {
        targetUserId: targetPlayer.userId,
        guessedStatementIndex: statementIndex,
      })
    },
    [performSocialAction, session, socialSessionId, playerCount],
  )

  const handleNextLieDetectivePlayer = useCallback(() => {
    void performSocialAction('lie-next-player', '/lie-detective/next-player', {})
  }, [performSocialAction])

  const diceGenerationRetryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const diceGenerationRetryCountRef = useRef(0)
  const generateDiceChallengesRef = useRef<() => void>(() => {})

  const handleGenerateDiceChallenges = useCallback(() => {
    void performSocialAction<GenerationPendingResponse>('dice-generate', '/personality-dice/generate', {
      participants: participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.displayName ?? '匿名',
        archetype: participant.archetype,
      })),
    }).then((response) => {
      const retryDelay = getGenerationRetryDelayMs(response)
      if (retryDelay === null) {
        diceGenerationRetryCountRef.current = 0
        return
      }
      if (diceGenerationRetryCountRef.current >= 8) {
        diceGenerationRetryCountRef.current = 0
        void Taro.showToast({ title: '生成仍在进行，请稍后再试', icon: 'none', duration: 2000 })
        return
      }
      diceGenerationRetryCountRef.current += 1
      if (diceGenerationRetryTimerRef.current) clearTimeout(diceGenerationRetryTimerRef.current)
      diceGenerationRetryTimerRef.current = setTimeout(() => {
        diceGenerationRetryTimerRef.current = undefined
        if (phaseRef.current !== 'personality_dice') {
          diceGenerationRetryCountRef.current = 0
          return
        }
        generateDiceChallengesRef.current()
      }, retryDelay)
    })
  }, [performSocialAction, participants, phaseRef])
  generateDiceChallengesRef.current = handleGenerateDiceChallenges

  useEffect(() => () => {
    if (diceGenerationRetryTimerRef.current) {
      clearTimeout(diceGenerationRetryTimerRef.current)
      diceGenerationRetryTimerRef.current = undefined
    }
  }, [])

  useEffect(() => {
    if (phase === 'personality_dice') return
    diceGenerationRetryCountRef.current = 0
    if (diceGenerationRetryTimerRef.current) {
      clearTimeout(diceGenerationRetryTimerRef.current)
      diceGenerationRetryTimerRef.current = undefined
    }
  }, [phase])

  const handleCompleteDiceChallenge = useCallback((pass?: boolean) => {
    void performSocialAction('dice-complete', '/personality-dice/complete', { pass: pass === true })
  }, [performSocialAction])

  const handleDiceReady = useCallback((ready: boolean) => {
    void performSocialAction('dice-ready', '/personality-dice/complete', { ready })
  }, [performSocialAction])

  const handleDiceRevealReady = useCallback((ready: boolean) => {
    void performSocialAction('dice-reveal-ready', '/personality-dice/reveal-ready', { ready })
  }, [performSocialAction])

  const handleChooseDiceOption = useCallback((optionIndex: number) => {
    socialIcebreakerAnalytics.track(
      'dice_option_chosen',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      'personality_dice',
      { optionIndex, playerCount },
    )
    void performSocialAction('dice-choose', '/personality-dice/choose', {
      userId: currentUserId,
      optionIndex,
      operationId: `${currentUserId}-choose-${Date.now()}`,
    })
  }, [performSocialAction, currentUserId, socialSessionId, session?.icebreakerSessionId, playerCount])

  const handleGenerateAuctionLots = useCallback(() => {
    void performSocialAction('auction-gen', '/auction/generate-lots', {})
  }, [performSocialAction])

  const handleAuctionBid = useCallback(
    (amount: number) => {
      socialIcebreakerAnalytics.track(
        'auction_bid_placed',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        'auction',
        { amount, playerCount },
      )
      void performSocialAction('auction-bid', '/auction/bid', { amount })
    },
    [performSocialAction, socialSessionId, session?.icebreakerSessionId, playerCount],
  )

  const handleCloseAuctionLot = useCallback(() => {
    void performSocialAction('auction-close', '/auction/close-lot', {})
  }, [performSocialAction])

  const handleGenerateSessionPack = useCallback(() => {
    void performSocialAction('xiaoyue-pack', '/xiaoyue/session-pack', {})
  }, [performSocialAction])

  const handleRequestAdaptiveSuggestion = useCallback(() => {
    void performSocialAction('xiaoyue-suggest', '/xiaoyue/adaptive-suggestion', {})
  }, [performSocialAction])

  const handleDismissAdaptiveSuggestion = useCallback(
    (source: 'tap' | 'auto') => {
      // Funnel semantics: only a MANUAL 知道了 counts as a nudge dismissal;
      // the 8s auto-dismiss just hides the card (the host may still act).
      if (source === 'tap') {
        socialIcebreakerAnalytics.track(
          'stall_nudge_dismiss',
          socialSessionId ?? undefined,
          session?.icebreakerSessionId,
          phase,
          { playerCount },
        )
      }
      setDismissedSuggestionAt(session?.xiaoyueAdaptiveSuggestion?.generatedAt ?? 'dismissed')
    },
    [session?.xiaoyueAdaptiveSuggestion?.generatedAt, session?.icebreakerSessionId, socialSessionId, phase, playerCount, setDismissedSuggestionAt],
  )

  return {
    performSocialAction,
    generateTopics,
    handleGenerateTopics,
    topicsError,
    topicsRecovery,
    lastTopicsMoodRef,
    handleToggleWarmupReady,
    handleNextWarmupTopic,
    handleAssignRoles,
    handleRevealAct,
    handleVote,
    handleRevealSolution,
    handleMiniScriptReady,
    handleAdvancePhase,
    handleSelectCustomPhase,
    handleEndCustomSession,
    executeTierSwitch,
    handleConfirmTierSwitch,
    handleCompleteChallenge,
    handleNextSpeedFriendingRound,
    handleCompleteSpeedFriending,
    handleGenerateStatements,
    handleGenerateLieStatementFromTag,
    handleCastVote,
    handleNextLieDetectivePlayer,
    handleGenerateDiceChallenges,
    handleCompleteDiceChallenge,
    handleDiceReady,
    handleDiceRevealReady,
    handleChooseDiceOption,
    handleGenerateAuctionLots,
    handleAuctionBid,
    handleCloseAuctionLot,
    handleGenerateSessionPack,
    handleRequestAdaptiveSuggestion,
    handleDismissAdaptiveSuggestion,
  }
}
