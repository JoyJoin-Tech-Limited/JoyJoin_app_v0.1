import { useMemo, useState, useCallback, useEffect, useRef, type ReactNode } from 'react'
import { View, Text, ScrollView, Image } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { getErrorMessage } from '@shared/copy/errorBaselines'
import type { AtmosphereMood, SocialIcebreakerPhase, SocialSessionState } from '@shared/socialIcebreaker'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { MiniScriptGenre, MiniScriptStyle, MiniScriptVoteInput } from '@shared/miniscriptStoryFramework'
import { cdnAsset, localAsset } from '../../lib/utils/cdnAssets'
import { apiRequest } from '../../lib/api/api'
import { POLL_SOCIAL_SESSION_MS, TOAST_MEDIUM_MS, TOAST_DEFAULT_MS } from '../../lib/utils/uiConstants'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useAuth } from '../../hooks/useAuth'
import { useResetOnShow } from '../../hooks/useResetOnShow'
import { logInfo, logError } from '../../lib/utils/logger'
import { haptics } from '../../lib/utils/haptics'
import { socialIcebreakerAnalytics } from '../../lib/analytics/socialIcebreakerAnalytics'
import {
  usePreloadCdnIcons,
  SPRITE_SHEET_ASSETS,
  ICEBREAKER_PHASE_EMBLEM_ASSETS,
} from '../../hooks/usePreloadCdnIcons'
import { getMascotDisplayName } from '../../lib/mascot/mascotDisplay'
import OnboardingLoadingShell from '../../components/loading/OnboardingLoadingShell'
import XiaoyueSessionShell from '../../components/mascot/XiaoyueSessionShell'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import {
  FallbackPhaseView,
  RecapPhaseView,
  type SessionPhase,
  WarmupPhaseView,
} from './phaseViews'
import { apiVibeToClient, VIBE_TO_API, type VibeId } from '../../lib/vibeMapping'
import IcebreakerTierSelector from './components/IcebreakerTierSelector'
import IcebreakerTierSheet, { type TierSheetSelection } from './components/IcebreakerTierSheet'
import CustomModeSection from './components/CustomModeSection'
import { AdvanceFuseBanner } from './components/AdvanceFuseBanner'
import { useIcebreakerSessionAnalytics } from './useIcebreakerSessionAnalytics'
import { MicroChallengeHeroView } from './phases/MicroChallengeHeroView'
import { LieDetectiveHeroView } from './phases/LieDetectiveHeroView'
import { PersonalityDiceHeroView } from './phases/PersonalityDiceHeroView'
import { SpeedFriendingHeroView } from './phases/SpeedFriendingHeroView'
import { QuipBattleHeroView } from './phases/QuipBattleHeroView'
import { UndercoverWordHeroView } from './phases/UndercoverWordHeroView'
import { GroupMirrorHeroView } from './phases/GroupMirrorHeroView'
import { AuctionHeroView } from './phases/AuctionHeroView'
import { MiniScriptHeroView } from './phases/MiniScriptHeroView'
import { PhaseIntroOverlay } from './overlays/PhaseIntroOverlay'
import { IcebreakerToolSelector } from './overlays/IcebreakerToolSelector'
import { MiniScriptConfigModal } from './overlays/MiniScriptConfigModal'
import BonusGateOverlay from './overlays/BonusGateOverlay'
import {
  buildSocialPath,
  deriveParticipants,
  getIcebreakerPageErrorText,
  getErrorText,
  getUserArchetype,
  getUserDisplayName,
  getUserInterests,
  normaliseSession,
  type EventSessionDiscovery,
  type SocialRecapResponse,
  type SocialStartResponse,
} from './icebreakerSessionModel'
import {
  HOST_MENU_COACHMARK_STORAGE_KEY,
  resolveHostMenuItems,
  resolveSyncLossVisible,
} from './sessionShellLogic'
import { shouldRetryWarmupTopics } from './viewModels/warmupViewModels'
import './index.scss'

function getPhaseToastText(phase: string): ReactNode {
  const texts: Record<string, ReactNode> = {
    lie_detective: <>真相只有一个！<JoyJoinIcon emoji='🕵️' tier='phase' size={24} /></>,
    auction: <>竞拍开始，准备好你的虚拟币！<JoyJoinIcon emoji='💰' size={24} /></>,
    personality_dice: <>人格骰子，看看今天的运势！<JoyJoinIcon emoji='🎲' tier='phase' size={24} /></>,
    quip_battle: <>接梗大战，接得住吗？<JoyJoinIcon emoji='😏' size={24} /></>,
    undercover_word: <>谁是卧底？小心别暴露！<JoyJoinIcon emoji='🕵️' tier='phase' size={24} /></>,
    speed_friending: <>快速交友，认识新伙伴！<JoyJoinIcon emoji='🤝' size={24} /></>,
    group_mirror: <>团队镜像，看看大家的默契！<JoyJoinIcon emoji='🪞' size={24} /></>,
    recap: <>精彩回顾，今天真开心！<JoyJoinIcon emoji='🎉' tier='reaction' size={24} /></>,
  }
  return texts[phase] || '新阶段开始啦！'
}

// ─── Component ────────────────────────────────────────────────────

// F1: hoisted — a stable reference keeps usePreloadCdnIcons' effect from
// re-firing 31 parallel getImageInfo bridge calls on every render.
const ICEBREAKER_PRELOAD_ASSETS = [...SPRITE_SHEET_ASSETS, ...ICEBREAKER_PHASE_EMBLEM_ASSETS]

// Warmup topic generation is LLM-backed (3s server cap + DB writes) — the
// 5s dev default timeout is too tight, give it headroom.
const TOPICS_REQUEST_TIMEOUT_MS = 12000
const TOPICS_SKIP_RETRY_MAX = 5
const TOPICS_SKIP_RETRY_DELAY_MS = 700
const TOPICS_RECOVERY_RETRY_DELAY_MS = 1200

export default function IcebreakerSessionPage() {
  const router = useRouter()
  const routeSessionId = router.params.sessionId ?? ''
  const routeEventId = router.params.eventId ?? ''
  const { isLoading: authLoading } = useAuthGuard()
  const { user } = useAuth()
  const currentUser = (user ?? undefined) as Record<string, unknown> | undefined
  const currentUserId = typeof user?.id === 'string' ? user.id : ''
  const currentUserDisplayName = getUserDisplayName(currentUser)
  const currentUserArchetype = getUserArchetype(currentUser)
  const currentUserInterests = getUserInterests(currentUser)
  const features = user?.features
  const [socialSessionId, setSocialSessionId] = useState<string | null>(null)
  const [bootstrapState, setBootstrapState] = useState<SocialSessionState | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [miniScriptModalOpen, setMiniScriptModalOpen] = useState(false)
  const [miniScriptSubmitting, setMiniScriptSubmitting] = useState(false)
  const [dismissedSuggestionAt, setDismissedSuggestionAt] = useState<string | null>(null)
  const [showPhaseIntro, setShowPhaseIntro] = useState(false)
  const [phaseToast, setPhaseToast] = useState<{ visible: boolean; text: ReactNode }>({ visible: false, text: '' })
  const [isTierSheetOpen, setIsTierSheetOpen] = useState(false)
  const [pendingTierSwitch, setPendingTierSwitch] = useState<TierSheetSelection | null>(null)
  // PR1 壳层 transient flags — covered by useResetOnShow for swipe-back safety.
  const [coachmarkShown, setCoachmarkShown] = useState(false)
  const [suggestionOverlayOpen, setSuggestionOverlayOpen] = useState(false)
  const startAttemptRef = useRef<string | null>(null)
  const prevPhaseRef = useRef<SessionPhase>('waiting')
  const coachmarkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const syncLostRef = useRef(false)

  useResetOnShow(setCoachmarkShown, setSuggestionOverlayOpen)

  // Preload CDN-only assets in parallel with session bootstrap.
  // Phase emblems, reactions, reveals, and achievements are CDN tiers.
  usePreloadCdnIcons(ICEBREAKER_PRELOAD_ASSETS)

  const {
    data: eventSession,
    isLoading: eventSessionLoading,
    error: eventSessionError,
  } = useQuery<EventSessionDiscovery | null>({
    queryKey: ['mini-program', 'event-session', routeEventId],
    queryFn: async () => {
      const existing = await apiRequest<EventSessionDiscovery | null>({
        path: `/api/events/${encodeURIComponent(routeEventId)}/session`,
      })

      if (existing?.sessionId) {
        return existing
      }

      return apiRequest<EventSessionDiscovery>({
        path: `/api/events/${encodeURIComponent(routeEventId)}/session`,
        method: 'POST',
      })
    },
    enabled: false,
  })

  const resolvedSessionId = routeSessionId || eventSession?.sessionId || routeEventId || ''

  useEffect(() => {
    setSocialSessionId(null)
    setBootstrapState(null)
    setBootstrapError(null)
    setPendingAction(null)
    startAttemptRef.current = null
  }, [resolvedSessionId])

  // Legacy icebreaker session details API removed; use defaults
  const sessionLoading = false
  const sessionError = null

  useEffect(() => {
    if (!resolvedSessionId || authLoading || !currentUserId) {
      return
    }

    if (socialSessionId || startAttemptRef.current === resolvedSessionId) {
      return
    }

    let cancelled = false
    startAttemptRef.current = resolvedSessionId
    setBootstrapError(null)
    setPendingAction('start')

    void apiRequest<SocialStartResponse>({
      path: '/api/social-icebreaker/start',
      method: 'POST',
      data: {
        sessionId: resolvedSessionId,
        displayName: currentUserDisplayName,
        eventType: '活动',
      },
    })
      .then((response) => {
        if (cancelled) {
          return
        }

        logInfo('[IcebreakerSession] Joined social session', {
          icebreakerSessionId: resolvedSessionId,
          socialSessionId: response.socialSessionId,
        })

        setSocialSessionId(response.socialSessionId)
        setBootstrapState(response.state)
      })
      .catch((error) => {
        if (cancelled) {
          return
        }

        const message = getIcebreakerPageErrorText(error)
        logError('[IcebreakerSession] Failed to join social session', {
          icebreakerSessionId: resolvedSessionId,
          message,
        })

        startAttemptRef.current = null
        setBootstrapError(message)
      })
      .finally(() => {
        if (!cancelled) {
          setPendingAction((current) => (current === 'start' ? null : current))
        }
      })

    return () => {
      cancelled = true
    }
  }, [
    resolvedSessionId,
    authLoading,
    currentUserId,
    sessionLoading,
    sessionError,
    socialSessionId,
    currentUserDisplayName,
  ])

  const socialSessionQuery = useQuery<SocialSessionState>({
    queryKey: ['mini-program', 'social-icebreaker-session', socialSessionId],
    queryFn: () => apiRequest<SocialSessionState>({ path: buildSocialPath(socialSessionId ?? '') }),
    enabled: !!socialSessionId && !authLoading,
    refetchInterval: pendingAction ? false : POLL_SOCIAL_SESSION_MS,
    staleTime: 0,
    // F3: nothing reads isFetching — don't re-render the full tree on every
    // fetch start/settle (2 wasted reconciliations per 3s poll).
    notifyOnChangeProps: ['data', 'isError', 'error'],
  })

  const session = useMemo(() => {
    const sourceState = socialSessionQuery.data ?? bootstrapState
    return sourceState ? normaliseSession(sourceState) : null
  }, [socialSessionQuery.data, bootstrapState])

  const phase: SessionPhase = session?.phase ?? 'waiting'

  // PR1 壳层: suggestion visibility = data-derived suggestion AND an explicit
  // overlay flag (useResetOnShow-covered) so swipe-back never resurrects a stuck card.
  const adaptiveSuggestion =
    session?.xiaoyueAdaptiveSuggestion &&
    dismissedSuggestionAt !== session.xiaoyueAdaptiveSuggestion.generatedAt
      ? session.xiaoyueAdaptiveSuggestion
      : undefined

  useEffect(() => {
    setSuggestionOverlayOpen(!!adaptiveSuggestion)
  }, [adaptiveSuggestion])

  // PR1 壳层: calm-by-default sync-loss. A failed poll with a live session lights
  // the grey dot + fires one reconnect toast per failure edge; recovery auto-clears.
  // (Pre-bootstrap failures still route to the full-page error state via pageError.)
  const syncLost = resolveSyncLossVisible({
    hasSession: !!session,
    isPollError: socialSessionQuery.isError,
  })
  useEffect(() => {
    if (syncLost && !syncLostRef.current) {
      void Taro.showToast({
        title: '连接断了，正在重连…',
        icon: 'none',
        duration: TOAST_MEDIUM_MS,
      })
    }
    syncLostRef.current = syncLost
  }, [syncLost])

  // Xiaoyue phase-transition toast
  useEffect(() => {
    if (phase && phase !== 'warmup' && phase !== 'phase_selection' && prevPhaseRef.current !== 'waiting') {
      const toastText = getPhaseToastText(phase)
      setPhaseToast({ visible: true, text: toastText })
      const timer = setTimeout(() => setPhaseToast({ visible: false, text: '' }), 3000)
      return () => clearTimeout(timer)
    }
  }, [phase])
  const hostUserId = session?.hostUserId ?? ''
  const isHost = !!currentUserId && currentUserId === hostUserId
  const participants = useMemo(
    () => (session ? deriveParticipants(session, [], hostUserId) : []),
    [session, hostUserId]
  )
  const playerCount = session?.playerCount ?? participants.length

  useIcebreakerSessionAnalytics({ session, phase, socialSessionId, playerCount, isHost })

  // Phase intro overlay: trigger when entering a playable phase (not initial load).
  // Future refactor: extract into useSessionPhase() hook to reduce God-component size.
  useEffect(() => {
    const prev = prevPhaseRef.current
    const skipPhases: SessionPhase[] = ['waiting', 'ended', 'phase_selection']
    const isRealTransition = prev !== phase && !skipPhases.includes(phase) && prev !== 'waiting'
    if (isRealTransition) {
      setShowPhaseIntro(true)
    }
    prevPhaseRef.current = phase
  }, [phase, socialSessionId, session, playerCount])


  const recapQuery = useQuery<SocialRecapResponse>({
    queryKey: ['mini-program', 'social-icebreaker-recap', socialSessionId],
    queryFn: () => apiRequest<SocialRecapResponse>({ path: buildSocialPath(socialSessionId ?? '', '/recap') }),
    enabled: (phase === 'recap' || phase === 'ended') && !!socialSessionId && !authLoading,
    staleTime: 0,
  })

  const myVoteIndex = useMemo(() => {
    const currentPlayer = session?.lieDetectivePlayers?.[session.currentLieDetectivePlayerIndex ?? 0]
    if (!currentPlayer || !currentUserId) {
      return null
    }

    return (
      session.votes?.find(
        (vote) => vote.voterId === currentUserId && vote.targetUserId === currentPlayer.userId,
      )?.guessedStatementIndex ?? null
    )
  }, [session, currentUserId])

  const performSocialAction = useCallback(
    async <T,>(
      actionKey: string,
      suffix: string,
      data?: unknown,
      options?: { timeoutMs?: number },
    ): Promise<T | null | undefined> => {
      if (!socialSessionId) {
        return null
      }

      if (pendingAction !== null && pendingAction !== actionKey) {
        // Skipped (another action in flight) — distinct from a real failure
        // so callers don't surface a false error state.
        return undefined
      }

      setPendingAction(actionKey)

      try {
        const response = await apiRequest<T>({
          path: buildSocialPath(socialSessionId, suffix),
          method: 'POST',
          data,
          timeout: options?.timeoutMs,
        })

        await socialSessionQuery.refetch()
        return response
      } catch (error) {
        const message = getErrorText(error, '操作没成功，再试试')
        logError('[IcebreakerSession] Social action failed', {
          socialSessionId,
          actionKey,
          message,
        })
        Taro.showToast({
          title: message.length > 12 ? '操作没成功' : message,
          icon: 'none',
          duration: TOAST_MEDIUM_MS,
        })
        return null
      } finally {
        setPendingAction((current) => (current === actionKey ? null : current))
      }
    },
    [socialSessionId, pendingAction, socialSessionQuery],
  )

  const topicsSkipRetryRef = useRef(0)
  const topicsRetryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const topicsRecoveryRetryCountRef = useRef(0)
  const topicsRecoveryTimerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const generateTopicsRef = useRef<(mood: AtmosphereMood) => void>(() => {})
  const generateTopics = useCallback((mood: AtmosphereMood) => {
    setTopicsError(false)
    void performSocialAction('topics', '/topics', {
      mood,
      eventType: '活动',
      participantCount: Math.max(playerCount, 2),
      avoidTopics: [],
    }, { timeoutMs: TOPICS_REQUEST_TIMEOUT_MS }).then((result) => {
      if (result === null) {
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
        topicsSkipRetryRef.current = 0
        topicsRecoveryRetryCountRef.current = 0
      }
    })
  }, [performSocialAction, playerCount])
  generateTopicsRef.current = generateTopics
  const handleGenerateTopics = useCallback((mood: AtmosphereMood) => {
    topicsSkipRetryRef.current = 0
    topicsRecoveryRetryCountRef.current = 0
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
    void performSocialAction('warmup-ready', '/warmup/ready', { ready: !isReady })
  }, [performSocialAction, session?.warmupReadyUserIds, currentUserId])

  const handleNextWarmupTopic = useCallback(() => {
    void performSocialAction('warmup-next-topic', '/warmup/next-topic', {})
  }, [performSocialAction])

  const handleAssignRoles = useCallback(() => {
    void performSocialAction('miniscript-assign-roles', '/miniscript/assign-roles', {})
  }, [performSocialAction])

  const handleRevealAct = useCallback((targetAct: number) => {
    void performSocialAction('miniscript-reveal-act', '/miniscript/reveal-act', { targetAct })
  }, [performSocialAction])

  const handleVote = useCallback((vote: MiniScriptVoteInput) => {
    void performSocialAction('miniscript-vote', '/miniscript/vote', { vote })
  }, [performSocialAction])

  const handleRevealSolution = useCallback(() => {
    void performSocialAction('miniscript-reveal-solution', '/miniscript/reveal-solution', {})
  }, [performSocialAction])

  const handleMiniScriptReady = useCallback((ready: boolean) => {
    void performSocialAction('miniscript-ready', '/miniscript/ready', { ready })
  }, [performSocialAction])

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
  const handleStallAdvance = useCallback(() => {
    if (!session) {
      return
    }
    socialIcebreakerAnalytics.track(
      'stall_nudge_advance',
      socialSessionId ?? undefined,
      session.icebreakerSessionId,
      session.currentPhase,
      { playerCount },
    )
    void performSocialAction('advance', '/advance', {
      currentPhase: session.currentPhase,
      force: true,
    })
  }, [performSocialAction, session, socialSessionId, playerCount])

  const handleStallDismiss = useCallback(() => {
    if (!session) {
      return
    }
    socialIcebreakerAnalytics.track(
      'stall_nudge_dismiss',
      socialSessionId ?? undefined,
      session.icebreakerSessionId,
      session.currentPhase,
      { playerCount },
    )
    void performSocialAction('stall-dismiss', '/stall-nudge/dismiss', {})
  }, [performSocialAction, session, socialSessionId, playerCount])

  const handleSelectCustomPhase = useCallback(
    async (selectedPhase: SocialIcebreakerPhase) => {
      if (!socialSessionId || !session?.phaseSelectionId) {
        return
      }

      if (pendingAction !== null) {
        return
      }

      setPendingAction('select-phase')

      try {
        await apiRequest({
          path: `/api/social-icebreaker/${socialSessionId}/select-phase`,
          method: 'POST',
          data: { phase: selectedPhase, phaseSelectionId: session.phaseSelectionId },
        })
        await socialSessionQuery.refetch()
      } catch (err: unknown) {
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
        void Taro.showToast({
          title: '选择没成功，再试试',
          icon: 'none',
          duration: 2000,
        })
      } finally {
        setPendingAction(null)
      }
    },
    [socialSessionId, session, socialSessionQuery, pendingAction, playerCount],
  )

  const handleEndCustomSession = useCallback(
    async () => {
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

      setPendingAction('end-session')

      try {
        await apiRequest({
          path: `/api/social-icebreaker/${socialSessionId}/end-session`,
          method: 'POST',
          data: { phaseSelectionId: session.phaseSelectionId },
        })
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
        await socialSessionQuery.refetch()
      } catch (err: unknown) {
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
        void Taro.showToast({
          title: '结束派对没成功，再试试',
          icon: 'none',
          duration: 2000,
        })
      } finally {
        setPendingAction(null)
      }
    },
    [socialSessionId, session, socialSessionQuery, pendingAction, playerCount],
  )

  const [topicsError, setTopicsError] = useState(false)

  useEffect(() => {
    const topicCount = session?.warmupTopics?.length ?? 0
    if (topicCount > 0) {
      setTopicsError(false)
      topicsRecoveryRetryCountRef.current = 0
      return
    }

    if (!shouldRetryWarmupTopics({
      isHost,
      topicsError,
      syncLost,
      topicCount,
      selectedMood: session?.selectedMood,
      pendingAction,
      retryCount: topicsRecoveryRetryCountRef.current,
    })) return

    topicsRecoveryRetryCountRef.current += 1
    topicsRecoveryTimerRef.current = setTimeout(() => {
      topicsRecoveryTimerRef.current = undefined
      generateTopicsRef.current(session!.selectedMood as AtmosphereMood)
    }, TOPICS_RECOVERY_RETRY_DELAY_MS)

    return () => {
      if (topicsRecoveryTimerRef.current) {
        clearTimeout(topicsRecoveryTimerRef.current)
        topicsRecoveryTimerRef.current = undefined
      }
    }
  }, [isHost, pendingAction, session?.selectedMood, session?.warmupTopics?.length, syncLost, topicsError])

  const canChangeTier = (phase === 'waiting' || phase === 'warmup') && isHost

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

      setPendingAction('set-tier')

      try {
        await apiRequest({
          path: `/api/social-icebreaker/${socialSessionId}/set-tier`,
          method: 'POST',
          data: {
            tier,
            vibe: tier === 'custom' ? undefined : VIBE_TO_API[vibe],
          },
        })

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

        await socialSessionQuery.refetch()
        Taro.showToast({
          title: `已切换为${tier === 'custom' ? '自由局' : '新模式'}`,
          icon: 'success',
          duration: TOAST_DEFAULT_MS,
        })
      } catch (err: unknown) {
        logError('[IcebreakerSession] Set tier failed', { error: err })
        void Taro.showToast({
          title: '切换没成功，再试试',
          icon: 'none',
          duration: 2000,
        })
      } finally {
        setPendingAction(null)
      }
    },
    [socialSessionId, session, socialSessionQuery, pendingAction, phase, playerCount],
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
    [session?.eventTier, executeTierSwitch],
  )

  const handleDismissCustomConfirm = useCallback(() => {
    setPendingTierSwitch(null)
  }, [])

  const handleAcceptCustomConfirm = useCallback(() => {
    if (!pendingTierSwitch) return
    const selection = pendingTierSwitch
    setPendingTierSwitch(null)
    void executeTierSwitch(selection.tier, selection.vibe)
  }, [pendingTierSwitch, executeTierSwitch])

  useEffect(() => {
    if (!pendingTierSwitch) return

    const isSwitchingToCustom = pendingTierSwitch.tier === 'custom'
    void Taro.showModal({
      title: isSwitchingToCustom ? '切换为自由局？' : '切换为预设模式？',
      content: isSwitchingToCustom
        ? '切换后将由你手动选择每个环节，当前已生成的环节顺序不会保留。'
        : '切换后系统会自动生成完整环节，自由局下已选择的环节不会保留。',
      confirmText: '确认切换',
      cancelText: '取消',
      success: (res) => {
        if (res.confirm) {
          handleAcceptCustomConfirm()
        } else {
          handleDismissCustomConfirm()
        }
      },
    })
  }, [pendingTierSwitch, handleAcceptCustomConfirm, handleDismissCustomConfirm])

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

  const handleGenerateStatements = useCallback(() => {
    void performSocialAction('lie-generate', '/lie-detective/generate', {
      displayName: currentUserDisplayName,
      archetype: currentUserArchetype,
      interests: currentUserInterests,
    })
  }, [performSocialAction, currentUserDisplayName, currentUserArchetype, currentUserInterests])

  const handleSubmitTags = useCallback(
    (tags: [string, string]) => {
      void performSocialAction('lie-submit-tags', '/lie-detective/submit-tags', { tags })
    },
    [performSocialAction],
  )

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
    [performSocialAction, session],
  )

  const handleNextLieDetectivePlayer = useCallback(() => {
    void performSocialAction('lie-next-player', '/lie-detective/next-player', {})
  }, [performSocialAction])

  const handleGenerateDiceChallenges = useCallback(() => {
    void performSocialAction('dice-generate', '/personality-dice/generate', {
      participants: participants.map((participant) => ({
        userId: participant.userId,
        displayName: participant.displayName ?? '匿名',
        archetype: participant.archetype,
      })),
    })
  }, [performSocialAction, participants])

  const handleCompleteDiceChallenge = useCallback((pass?: boolean) => {
    void performSocialAction('dice-complete', '/personality-dice/complete', { pass: pass === true })
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

  const handleDismissAdaptiveSuggestion = useCallback(() => {
    setDismissedSuggestionAt(session?.xiaoyueAdaptiveSuggestion?.generatedAt ?? 'dismissed')
  }, [session?.xiaoyueAdaptiveSuggestion?.generatedAt])

  // ─── PR1 壳层: host ⋯ menu (all phases) ──────────────────────────────────
  // Items come from the pure resolver (unit-tested in sessionShellLogic.test.ts):
  // waiting/warmup → tier item; all phases except waiting/recap/ended → suggestion.
  const hostMenuItems = useMemo(
    () =>
      resolveHostMenuItems({
        phase,
        isHost,
        tier: session?.eventTier ?? 'glow',
        vibe: apiVibeToClient(session?.vibe),
      }),
    [phase, isHost, session?.eventTier, session?.vibe],
  )

  const handleHostMenuTap = useCallback(async () => {
    if (!isHost || hostMenuItems.length === 0) {
      return
    }
    haptics('light')
    // Host discovered the menu on their own — the one-time coachmark has served its purpose.
    setCoachmarkShown(false)
    socialIcebreakerAnalytics.track(
      'warmup_host_menu_open',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      phase,
      {
        itemCount: hostMenuItems.length,
        items: hostMenuItems.map((item) => item.id).join(','),
      },
    )
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: hostMenuItems.map((item) => item.label),
      })
      const selected = hostMenuItems[tapIndex]
      if (selected?.id === 'change-tier') {
        socialIcebreakerAnalytics.track(
          'warmup_tier_sheet_open',
          socialSessionId ?? undefined,
          session?.icebreakerSessionId,
          phase,
          { source: 'host_menu' },
        )
        setIsTierSheetOpen(true)
      } else if (selected?.id === 'suggestion') {
        handleRequestAdaptiveSuggestion()
      } else if (selected?.id === 'early-end') {
        // PM-locked copy (2026-07-17): next-chapter framing, neutral tone,
        // consequence stated plainly. Analytics: shown/confirm/cancel funnel.
        socialIcebreakerAnalytics.track(
          'early_end_shown',
          socialSessionId ?? undefined,
          session?.icebreakerSessionId,
          phase,
          { playerCount },
        )
        const modalRes = await Taro.showModal({
          title: '提前进入总结？',
          content: '全桌会一起进入今晚的回顾，当前环节将跳过，之后不能再回来。',
          confirmText: '进入总结',
          cancelText: '再玩一会儿',
        })
        if (modalRes.confirm) {
          haptics('medium')
          socialIcebreakerAnalytics.track(
            'early_end_confirm',
            socialSessionId ?? undefined,
            session?.icebreakerSessionId,
            phase,
            { playerCount },
          )
          void performSocialAction('early-end', '/early-end', {})
        } else {
          socialIcebreakerAnalytics.track(
            'early_end_cancel',
            socialSessionId ?? undefined,
            session?.icebreakerSessionId,
            phase,
            { playerCount },
          )
        }
      }
    } catch {
      // User cancelled the action sheet
    }
  }, [isHost, hostMenuItems, socialSessionId, session?.icebreakerSessionId, phase, handleRequestAdaptiveSuggestion, performSocialAction, playerCount])

  const handleAigcFeedbackTap = useCallback(
    (location: 'footer' | 'suggestion' | 'card') => {
      socialIcebreakerAnalytics.track(
        'warmup_aigc_feedback_tap',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        phase,
        { location },
      )
    },
    [socialSessionId, session?.icebreakerSessionId, phase],
  )

  // ─── PR1 壳层: one-time host ⋯ coachmark on first warmup entry ────────────
  // Persisted via storage at first show (truly once-ever), dismissible by tap,
  // auto-dismissed after 6s, and covered by useResetOnShow for swipe-back safety.
  useEffect(() => {
    if (phase !== 'warmup' || !isHost || coachmarkShown) {
      return
    }
    let seen = false
    try {
      seen = Taro.getStorageSync(HOST_MENU_COACHMARK_STORAGE_KEY) === '1'
    } catch {
      seen = false
    }
    if (seen) {
      return
    }
    try {
      Taro.setStorageSync(HOST_MENU_COACHMARK_STORAGE_KEY, '1')
    } catch {
      // Storage full / unavailable — coachmark still shows, persistence is best-effort.
    }
    setCoachmarkShown(true)
  }, [phase, isHost, coachmarkShown])

  useEffect(() => {
    if (!coachmarkShown) {
      return
    }
    coachmarkTimerRef.current = setTimeout(() => setCoachmarkShown(false), 6000)
    return () => {
      if (coachmarkTimerRef.current) {
        clearTimeout(coachmarkTimerRef.current)
        coachmarkTimerRef.current = null
      }
    }
  }, [coachmarkShown])

  const handleDismissCoachmark = useCallback(() => {
    haptics('light')
    setCoachmarkShown(false)
  }, [])

  const handleGoBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/events/index' }),
    })
  }, [])

  // Post-session hook: connections tab at peak warmth (audit C10).
  const handleConnectTap = useCallback(() => {
    haptics('light')
    socialIcebreakerAnalytics.track(
      'recap_connections_tap',
      socialSessionId ?? undefined,
      session?.icebreakerSessionId,
      phase,
      { playerCount },
    )
    Taro.switchTab({ url: '/pages/connections/index' })
  }, [socialSessionId, session?.icebreakerSessionId, phase, playerCount])

  const submitMiniScriptGenerate = useCallback(
    async (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[]; lite?: boolean }) => {
      if (!socialSessionId || !session) {
        return
      }

      setMiniScriptSubmitting(true)
      try {
        await apiRequest({
          path: '/api/miniscript/generate',
          method: 'POST',
          data: {
            socialSessionId,
            playerCount: session.playerCount,
            style: payload.style,
            genres: payload.genres,
            lite: payload.lite,
          },
        })
        await socialSessionQuery.refetch()
        setMiniScriptModalOpen(false)
        Taro.showToast({ title: '剧本已生成', icon: 'success', duration: TOAST_DEFAULT_MS })
      } catch (error) {
        const message = getErrorText(error, '生成没成功')
        logError('[IcebreakerSession] MiniScript generate failed', { socialSessionId, message })
        Taro.showToast({
          title: message.length > 14 ? '生成没成功' : message,
          icon: 'none',
          duration: TOAST_MEDIUM_MS,
        })
      } finally {
        setMiniScriptSubmitting(false)
      }
    },
    [socialSessionId, session, socialSessionQuery],
  )

  // PR1 壳层 (calm-by-default): once a session is live, a failed 3s poll no longer
  // routes to the full-page error — the sync-loss dot + reconnect toast own that state.
  // Poll errors only become pageError when there is no session to render yet.
  const pageError =
    bootstrapError ??
    (eventSessionError ? getIcebreakerPageErrorText(eventSessionError, '无法创建破冰会话') : null) ??
    (sessionError ? getIcebreakerPageErrorText(sessionError, getErrorMessage('load-failed')) : null) ??
    (socialSessionQuery.error && !session ? getIcebreakerPageErrorText(socialSessionQuery.error, getErrorMessage('sync-failed')) : null)

  const isBootstrapping = !!resolvedSessionId && !socialSessionId && pendingAction === 'start' && !session

  // Mid-session expiry: a 410 on the live poll is NOT a sync blip — show the
  // terminal surface instead of the infinite reconnect toast.
  const sessionExpired =
    !!session &&
    !!socialSessionQuery.error &&
    (socialSessionQuery.error as { statusCode?: number }).statusCode === 410

  if (sessionExpired) {
    return (
      <View className='icebreaker icebreaker--error'>
        <View className='icebreaker__error' role='alert'>
          <Image
            className='icebreaker__error-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-empty.webp')}
            mode='widthFix'
            lazyLoad
          />
          <Text className='icebreaker__error-text'>
            这场破冰已经结束了，回忆都帮你留好啦
          </Text>
          <Button variant='primary' className='icebreaker__error-btn' onClick={handleGoBack}>
            回到活动详情
          </Button>
        </View>
      </View>
    )
  }

  if (authLoading || eventSessionLoading || sessionLoading || isBootstrapping) {
    return (
      <OnboardingLoadingShell
        stepLabel='同桌游戏'
        title='正在加入破冰会话'
        subtitle={`${getMascotDisplayName(user)}正在对齐活动与同桌状态，马上就能开始。`}
        hint='若网络稍慢，多等几秒不会错过开场。'
        xiaoyueExpression='loadingSystem'
      />
    )
  }

  if (!resolvedSessionId || pageError || !session) {
    return (
      <View className='icebreaker icebreaker--error'>
        <View className='icebreaker__error' role='alert'>
          <Image
            className='icebreaker__error-hero'
            src={cdnAsset('/assets/lovart/lovart-generic-error.webp')}
            mode='widthFix'
            lazyLoad
          />
          <Text className='icebreaker__error-text'>
            {pageError ?? '无法加入破冰会话'}
          </Text>
          <Button variant='secondary' className='icebreaker__error-btn' onClick={handleGoBack}>
            返回
          </Button>
        </View>
      </View>
    )
  }

  const phaseHeader = (
    <XiaoyueSessionShell
      phase={phase}
      sessionPack={session?.xiaoyueSessionPack}
      adaptiveSuggestion={suggestionOverlayOpen ? adaptiveSuggestion : undefined}
      isHost={isHost}
      syncLost={syncLost}
      showHostMenu={hostMenuItems.length > 0}
      onOpenHostMenu={handleHostMenuTap}
      onDismissSuggestion={handleDismissAdaptiveSuggestion}
      onAigcFeedbackTap={handleAigcFeedbackTap}
    />
  )


  const supportedPhases: SessionPhase[] = [
    'waiting',
    'warmup',
    'phase_selection',
    'micro_challenge',
    'lie_detective',
    'auction',
    'personality_dice',
    'quip_battle',
    'undercover_word',
    'group_mirror',
    'mini_script',
    'recap',
    'ended',
    'speed_friending',
  ]

  const currentPlayer = session.lieDetectivePlayers?.[session.currentLieDetectivePlayerIndex ?? 0]
  const hasGeneratedStatements =
    session.lieDetectivePlayers?.some((player) => player.userId === currentUserId && player.statements.length > 0) ??
    false
  const canMoveToNextPlayer =
    !!currentPlayer &&
    !!session.currentLieDetectiveReveal &&
    (session.currentLieDetectivePlayerIndex ?? 0) < (session.lieDetectivePlayers?.length ?? 0) - 1

  return (
    <ScrollView
      className={`icebreaker${phase === 'warmup' ? ' icebreaker--warmup' : ''}`}
      scrollY={phase !== 'warmup'}
      enhanced
      showScrollbar={false}
      enableFlex={phase === 'warmup'}
    >
      <View className='icebreaker__header-wrap'>
        {phaseHeader}

        {/* PR1 壳层: one-time host ⋯ coachmark — floats below the band's right
            edge, points up at the trigger, never covers the CTA area. */}
        {coachmarkShown && (
          <View
            className='icebreaker__coachmark'
            onClick={handleDismissCoachmark}
            role='button'
            aria-label='知道了'
          >
            <Text className='icebreaker__coachmark-text'>
              {`点 ⋯ 更换模式，或找${getMascotDisplayName(user)}支招`}
            </Text>
            <View className='icebreaker__coachmark-arrow' aria-hidden='true' />
          </View>
        )}
      </View>

      {/* PR1 flow revamp — visible advance fuse (all players) + stall nudge (host) */}
      {phase !== 'warmup' && (
        <AdvanceFuseBanner
          fuseAt={session?.autoAdvanceScheduledAt}
          fuseKind={session?.advanceFuseKind}
          stallNudgeAt={session?.stallNudgeAt}
          isHost={isHost}
          isActing={pendingAction !== null}
          onStallAdvance={handleStallAdvance}
          onStallDismiss={handleStallDismiss}
        />
      )}

      <PhaseIntroOverlay phase={phase} visible={showPhaseIntro} />

      {phaseToast.visible && (
        <View className='icebreaker__phase-toast'>
          <Image
            className='icebreaker__phase-toast-mascot'
            src={cdnAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
            mode='aspectFit'
          />
          <View className='icebreaker__phase-toast-text'>{phaseToast.text}</View>
        </View>
      )}

      {session?.bonusGateOffered && !session?.bonusGateAccepted && !session?.bonusGateDeclined && socialSessionId && (
        <BonusGateOverlay
          socialSessionId={socialSessionId}
          isHost={isHost}
          playerCount={playerCount}
          sentimentMap={session.bonusGatePlayerSentiment}
          currentUserId={currentUserId}
          onResponded={() => socialSessionQuery.refetch()}
        />
      )}

      <View className='icebreaker__phase-shell' key={phase}>
        {phase === 'waiting' && (
          <>
            <WaitingPhase
              playerCount={playerCount}
              hostName={session?.hostDisplayName}
              isHost={isHost}
              currentTier={session?.eventTier ?? 'glow'}
              currentVibe={apiVibeToClient(session?.vibe)}
              canChangeTier={canChangeTier}
              onChangeTier={() => setIsTierSheetOpen(true)}
              onAdvance={handleAdvancePhase}
            />
            {isHost && !session?.xiaoyueSessionPack && (
              <Button
                variant='secondary'
                className='icebreaker__generate-pack-btn'
                onClick={handleGenerateSessionPack}
                disabled={pendingAction !== null}
                loading={pendingAction === 'xiaoyue-pack'}
              >
                {pendingAction === 'xiaoyue-pack' ? '生成中…' : `生成${getMascotDisplayName(user)}开场包`}
              </Button>
            )}
          </>
        )}

        {phase === 'warmup' && session && (
          <WarmupPhaseView
            topics={session.warmupTopics ?? []}
            currentIndex={session.currentTopicIndex ?? 0}
            readyUserIds={session.warmupReadyUserIds ?? []}
            warmupDataReady={session.warmupReadyUserIds !== undefined}
            participants={participants}
            currentUserId={currentUserId}
            selectedMood={session.selectedMood}
            isHost={isHost}
            vibe={apiVibeToClient(session.vibe)}
            archetypeMixText={session.archetypeMixText}
            isCustomMode={session.eventTier === 'custom'}
            currentTier={session.eventTier ?? 'glow'}
            isTestMode={session.isTestModeSkip ?? false}
            runBots={session.runBots ?? false}
            warmupTopicsMeta={session.warmupTopicsMeta}
            socialSessionId={socialSessionId ?? undefined}
            icebreakerSessionId={session.icebreakerSessionId}
            onAigcFeedbackTap={handleAigcFeedbackTap}
            onGenerateTopics={handleGenerateTopics}
            onToggleReady={handleToggleWarmupReady}
            onNextTopic={handleNextWarmupTopic}
            onAdvance={handleAdvancePhase}
            isGeneratingTopics={pendingAction === 'topics'}
            isUpdatingReady={pendingAction === 'warmup-ready'}
            isAdvancingTopic={pendingAction === 'warmup-next-topic'}
            isAdvancing={pendingAction === 'advance'}
            topicsError={topicsError}
            advancePrompt={
              <AdvanceFuseBanner
                fuseAt={session.autoAdvanceScheduledAt}
                fuseKind={session.advanceFuseKind}
                stallNudgeAt={session.stallNudgeAt}
                isHost={isHost}
                isActing={pendingAction !== null}
                onStallAdvance={handleStallAdvance}
                onStallDismiss={handleStallDismiss}
              />
            }
          />
        )}

        {phase === 'phase_selection' && session && (
          <CustomModeSection
            isHost={isHost}
            socialSessionId={socialSessionId}
            session={session}
            playerCount={playerCount}
            pendingAction={pendingAction}
            onSelectPhase={handleSelectCustomPhase}
            onEndSession={handleEndCustomSession}
          />
        )}

        {phase === 'micro_challenge' && session && (
          <MicroChallengeHeroView
            challenge={session.currentChallenge ?? null}
            challengeMeta={session.currentChallengeMeta}
            completedBy={session.challengeCompletedBy ?? []}
            currentUserId={currentUserId}
            playerCount={playerCount}
            phaseStartedAt={session.phaseStartedAt}
            onComplete={handleCompleteChallenge}
            isCompleting={pendingAction === 'micro-complete'}
            isHost={isHost}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
            canAdvance={
              new Set(session.challengeCompletedBy ?? []).size >= playerCount ||
              (!!session.currentChallenge?.durationSeconds &&
                Date.now() >=
                  (session.phaseStartedAt ?? 0) + session.currentChallenge.durationSeconds * 1000)
            }
            advanceDisabledReason='还有小伙伴未完成'
          />
        )}

        {phase === 'lie_detective' && session && (
          <LieDetectiveHeroView
            players={session.lieDetectivePlayers ?? []}
            playerCount={playerCount}
            currentPlayerIndex={session.currentLieDetectivePlayerIndex ?? 0}
            votes={session.votes ?? []}
            reveal={session.currentLieDetectiveReveal ?? null}
            currentUserId={currentUserId}
            myVoteIndex={myVoteIndex}
            onVote={handleCastVote}
            isVoting={pendingAction === 'lie-vote'}
            hasGeneratedStatements={hasGeneratedStatements}
            onGenerateStatements={handleGenerateStatements}
            isGeneratingStatements={pendingAction === 'lie-generate'}
            isHost={isHost}
            canMoveToNextPlayer={canMoveToNextPlayer}
            onNextPlayer={handleNextLieDetectivePlayer}
            isMovingNextPlayer={pendingAction === 'lie-next-player'}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
            lieDetectiveMode={session.lieDetectiveMode ?? 'v1'}
            statementsMeta={session.lieDetectiveStatementsMeta}
            onSubmitTags={handleSubmitTags}
            isSubmittingTags={pendingAction === 'lie-submit-tags'}
          />
        )}

        {phase === 'auction' && session && (
          <AuctionHeroView
            session={session}
            currentUserId={currentUserId}
            isHost={isHost}
            onGenerateLots={handleGenerateAuctionLots}
            onPlaceBid={handleAuctionBid}
            onCloseLot={handleCloseAuctionLot}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
            isGeneratingLots={pendingAction === 'auction-gen'}
            lotsMeta={session.auctionLotsMeta}
            isPlacingBid={pendingAction === 'auction-bid'}
            isClosingLot={pendingAction === 'auction-close'}
          />
        )}

        {phase === 'mini_script' && session && (
          <>
            {isHost && session.enabledPhases?.includes('mini_script') ? (
              <IcebreakerToolSelector onOpenMiniScript={() => setMiniScriptModalOpen(true)} />
            ) : null}
            <MiniScriptHeroView
              session={session}
              currentUserId={currentUserId}
              isHost={isHost}
              playerCount={playerCount}
              onAssignRoles={handleAssignRoles}
              onRevealAct={handleRevealAct}
              onVote={handleVote}
              onRevealSolution={handleRevealSolution}
              onAdvance={handleAdvancePhase}
              onReady={handleMiniScriptReady}
              isAssigningRoles={pendingAction === 'miniscript-assign-roles'}
              isRevealingAct={pendingAction === 'miniscript-reveal-act'}
              isVoting={pendingAction === 'miniscript-vote'}
              isRevealingSolution={pendingAction === 'miniscript-reveal-solution'}
              isAdvancing={pendingAction === 'advance'}
              isSettingReady={pendingAction === 'miniscript-ready'}
            />
            <MiniScriptConfigModal
              open={miniScriptModalOpen}
              onClose={() => setMiniScriptModalOpen(false)}
              isSubmitting={miniScriptSubmitting}
              onSubmit={submitMiniScriptGenerate}
            />
          </>
        )}

        {phase === 'personality_dice' && session && (
          <PersonalityDiceHeroView
            participants={participants}
            challenges={session.personalityDiceChallenges ?? []}
            currentPlayerIndex={session.currentDicePlayerIndex ?? 0}
            completedBy={session.diceCompletedBy ?? []}
            passedBy={session.dicePassedBy ?? []}
            currentUserId={currentUserId}
            isHost={isHost}
            onGenerate={handleGenerateDiceChallenges}
            onComplete={handleCompleteDiceChallenge}
            isGenerating={pendingAction === 'dice-generate'}
            isCompleting={pendingAction === 'dice-complete'}
            chooseModeEnabled={features?.personalityDiceChooseMode ?? false}
            challengeGroups={session.personalityDiceChallengeGroups ?? []}
            selectedOption={session.diceSelectedOption ?? {}}
            onChoose={handleChooseDiceOption}
            isChoosing={pendingAction === 'dice-choose'}
            challengesMeta={session.personalityDiceChallengesMeta}
            onAdvance={handleAdvancePhase}
          />
        )}

        {phase === 'quip_battle' && session && (
          <QuipBattleHeroView
            socialSessionId={socialSessionId || ''}
            isHost={isHost}
            prompts={session.quipBattlePrompts ?? []}
            answers={session.quipBattleAnswers ?? []}
            results={session.quipBattleResults ?? []}
            revealed={session.quipBattleRevealed ?? false}
            submittedUserIds={session.quipBattleSubmittedUserIds ?? []}
            votedUserIds={session.quipBattleVotedUserIds ?? []}
            userId={currentUserId}
            playerCount={playerCount}
            onRefresh={() => socialSessionQuery.refetch()}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
            promptsMeta={session.quipBattlePromptsMeta}
          />
        )}

        {phase === 'undercover_word' && session && (
          <UndercoverWordHeroView
            socialSessionId={socialSessionId || ''}
            isHost={isHost}
            userId={currentUserId}
            pair={session.undercoverWordPair ?? null}
            undercoverUserId={session.undercoverUserId}
            rounds={session.undercoverWordRounds ?? []}
            currentRound={session.undercoverWordCurrentRound ?? 0}
            votes={session.undercoverWordVotes ?? []}
            votedUserIds={session.undercoverWordVotedUserIds ?? []}
            revealed={session.undercoverWordRevealed ?? false}
            results={session.undercoverWordResults ?? null}
            playerCount={playerCount}
            participants={participants}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
            pairMeta={session.undercoverWordPairMeta}
          />
        )}

        {phase === 'group_mirror' && session && (
          <GroupMirrorHeroView
            socialSessionId={socialSessionId || ''}
            isHost={isHost}
            userId={currentUserId}
            questions={session.groupMirrorQuestions ?? []}
            answers={session.groupMirrorAnswers ?? []}
            submittedUserIds={session.groupMirrorSubmittedUserIds ?? []}
            revealed={session.groupMirrorRevealed ?? false}
            results={session.groupMirrorResults ?? []}
            playerCount={playerCount}
            participants={participants}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
            questionsMeta={session.groupMirrorQuestionsMeta}
          />
        )}

        {phase === 'speed_friending' && session && (
          <SpeedFriendingHeroView
            pairs={session.speedFriendingPairs ?? []}
            currentRound={session.speedFriendingCurrentRound ?? 0}
            totalRounds={session.speedFriendingTotalRounds ?? 0}
            roundStartedAt={session.speedFriendingRoundStartedAt}
            allRoundsComplete={session.speedFriendingAllRoundsComplete ?? false}
            participants={participants}
            currentUserId={currentUserId}
            isHost={isHost}
            onNextRound={handleNextSpeedFriendingRound}
            onComplete={handleCompleteSpeedFriending}
            isLoading={pendingAction === 'speed-next' || pendingAction === 'speed-complete'}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
          />
        )}

        {(phase === 'recap' || phase === 'ended') && session && (
          <RecapPhaseView
            recapData={recapQuery.data?.state?.recapData ?? session.recapData ?? null}
            summary={recapQuery.data?.summary ?? null}
            medals={recapQuery.data?.medals ?? []}
            playerCount={playerCount}
            onLeave={handleGoBack}
            onConnectTap={handleConnectTap}
            socialSessionId={socialSessionId}
            recapMeta={recapQuery.data?.meta ?? null}
            phasesCompleted={(session.completedPhases ?? []).filter((p) => p !== 'phase_selection').length}
            isEarlyEnd={session.lastAdvanceTrigger === 'early_end_jump'}
          />
        )}

        {!supportedPhases.includes(phase) && session && (
          <FallbackPhaseView phase={phase} isHost={isHost} onAdvance={handleAdvancePhase} />
        )}
      </View>

      <IcebreakerTierSheet
        isOpen={isTierSheetOpen}
        currentTier={session?.eventTier ?? 'glow'}
        currentVibe={apiVibeToClient(session?.vibe)}
        customEnabled={features?.socialIcebreakerCustomModeEnabled !== false}
        isBusy={pendingAction === 'set-tier'}
        onClose={() => setIsTierSheetOpen(false)}
        onConfirm={handleConfirmTierSwitch}
      />
    </ScrollView>
  )
}

function WaitingPhase({
  playerCount,
  hostName,
  isHost,
  currentTier,
  currentVibe,
  canChangeTier,
  onChangeTier,
  onAdvance,
}: {
  playerCount: number
  hostName?: string
  isHost: boolean
  currentTier: TierMachineId
  currentVibe?: VibeId
  canChangeTier: boolean
  onChangeTier: () => void
  onAdvance: () => void
}) {
  return (
    <View className='icebreaker__waiting'>
      <Card className='icebreaker__waiting-card'>
        <Image
          src={localAsset('/assets/icons/status-icons/status-waiting.webp')}
          style={{ width: '80rpx', height: '80rpx' }}
          lazyLoad
          className='icebreaker__waiting-emoji'
        />
        <Text className='icebreaker__waiting-title'>等待更多玩家加入…</Text>
        <Text className='icebreaker__waiting-count'>
          当前 {playerCount} 人已加入
        </Text>
        {hostName && (
          <Text className='icebreaker__waiting-host'>
            主持人：{hostName}
          </Text>
        )}
        <View className='icebreaker__waiting-tier'>
          <IcebreakerTierSelector
            currentTier={currentTier}
            currentVibe={currentVibe}
            isHost={isHost}
            canChange={canChangeTier}
            disabledHint='热身已开始，模式不可更换'
            onChangeRequest={onChangeTier}
          />
        </View>
      </Card>
      {isHost && (
        <Button variant='primary' className='icebreaker__start-btn' onClick={onAdvance}>
          开始破冰
        </Button>
      )}
    </View>
  )
}
