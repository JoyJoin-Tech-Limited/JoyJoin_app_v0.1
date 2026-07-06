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
import TestModeDisclosure from '../../components/icebreaker/TestModeDisclosure'
import Card from '../../components/ui/Card'
import Button from '../../components/ui/Button'
import JoyJoinIcon from '../../components/ui/JoyJoinIcon'
import {
  AuctionPhaseView,
  FallbackPhaseView,
  LieDetectivePhaseView,
  MicroChallengePhaseView,
  PersonalityDicePhaseView,
  QuipBattlePhaseView,
  UndercoverWordPhaseView,
  GroupMirrorPhaseView,
  RecapPhaseView,
  SpeedFriendingPhaseView,
  type SessionPhase,
  WarmupPhaseView,
} from './phaseViews'
import { apiVibeToClient, VIBE_TO_API, type VibeId } from '../../lib/vibeMapping'
import IcebreakerTierSelector from './components/IcebreakerTierSelector'
import IcebreakerTierSheet, { type TierSheetSelection } from './components/IcebreakerTierSheet'
import CustomModeSection from './components/CustomModeSection'
import { PhaseIntroOverlay } from './overlays/PhaseIntroOverlay'
import { MiniScriptPhaseView } from './phases/MiniScriptPhaseView'
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
import './index.scss'

function getPhaseToastText(phase: string): ReactNode {
  const texts: Record<string, ReactNode> = {
    lie_detective: <>真相只有一个！<JoyJoinIcon emoji='🕵️' tier='phase' size={24} /></>,
    auction: <>竞拍开始，准备好你的虚拟币！<JoyJoinIcon emoji='💰' size={24} /></>,
    personality_dice: <>人格骰子，看看今天的运势！<JoyJoinIcon emoji='🎲' tier='phase' size={24} /></>,
    quip_battle: <>接梗大战，接得住吗？<JoyJoinIcon emoji='😏' size={24} /></>,
    undercover_word: <>谁是卧底？小心别暴露！<JoyJoinIcon emoji='🕵️' tier='phase' size={24} /></>,
    speed_friending: <>快速交友，认识新朋友！<JoyJoinIcon emoji='🤝' size={24} /></>,
    group_mirror: <>团队镜像，看看大家的默契！<JoyJoinIcon emoji='🪞' size={24} /></>,
    recap: <>精彩回顾，今天真开心！<JoyJoinIcon emoji='🎉' tier='reaction' size={24} /></>,
  }
  return texts[phase] || '新阶段开始啦！'
}

// ─── Component ────────────────────────────────────────────────────

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
  const [showTestModeDisclosure, setShowTestModeDisclosure] = useState(false)
  const [testModeAdvanceError, setTestModeAdvanceError] = useState<string | null>(null)
  const startAttemptRef = useRef<string | null>(null)
  const prevPhaseRef = useRef<SessionPhase>('waiting')
  const customSessionCompletedRef = useRef(false)

  // Preload CDN-only assets in parallel with session bootstrap.
  // Phase emblems, reactions, reveals, and achievements are CDN tiers.
  usePreloadCdnIcons([...SPRITE_SHEET_ASSETS, ...ICEBREAKER_PHASE_EMBLEM_ASSETS])

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
    refetchInterval: POLL_SOCIAL_SESSION_MS,
    staleTime: 0,
  })

  const session = useMemo(() => {
    const sourceState = socialSessionQuery.data ?? bootstrapState
    return sourceState ? normaliseSession(sourceState) : null
  }, [socialSessionQuery.data, bootstrapState])

  const phase: SessionPhase = session?.phase ?? 'waiting'

  // CSS custom properties for challenge-card backgrounds.
  // Primary rendering is via <ChallengeCardBgImage> inside each card.
  // These vars act as a secondary fallback if the Image component fails.
  const bgStyles = useMemo(() => {
    const p = (path: string) => `url(${cdnAsset(path)})`
    const phaseBgMap: Record<string, React.CSSProperties> = {
      undercover_word: { '--bg-undercover-word': p('/assets/lovart/icebreaker/backgrounds/bg-undercover-word.jpg') } as React.CSSProperties,
      group_mirror: { '--bg-group-mirror': p('/assets/lovart/icebreaker/backgrounds/bg-group-mirror.jpg') } as React.CSSProperties,
      quip_battle: { '--bg-quip-battle': p('/assets/lovart/icebreaker/backgrounds/bg-quip-battle.jpg') } as React.CSSProperties,
    }
    return phaseBgMap[phase]
  }, [phase])

  if (session?.eventTier === 'custom' && (phase === 'recap' || phase === 'ended')) {
    customSessionCompletedRef.current = true
  }

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

  // Phase intro overlay: trigger when entering a playable phase (not initial load).
  // Future refactor: extract into useSessionPhase() hook to reduce God-component size.
  useEffect(() => {
    const prev = prevPhaseRef.current
    const skipPhases: SessionPhase[] = ['waiting', 'ended', 'phase_selection']
    const isRealTransition = prev !== phase && !skipPhases.includes(phase) && prev !== 'waiting'
    if (isRealTransition) {
      setShowPhaseIntro(true)
    }
    // Track when the host returns to the custom-mode picker after a real phase.
    if (prev !== phase && phase === 'phase_selection' && prev !== 'waiting' && prev !== 'ended') {
      socialIcebreakerAnalytics.track(
        'phase_picker_returned',
        socialSessionId ?? undefined,
        session?.icebreakerSessionId,
        prev,
        {
          playerCount,
          completedCount: session?.completedPhases?.length ?? 0,
        },
      )
    }
    prevPhaseRef.current = phase
  }, [phase, socialSessionId, session, playerCount])

  // Keep latest session metadata in refs for unmount-time abandonment tracking.
  const customSessionMetaRef = useRef({
    socialSessionId: '',
    icebreakerSessionId: '',
    eventTier: undefined as string | undefined,
    phase: '' as string,
    playerCount: 0,
    completedPhases: [] as string[],
  })
  useEffect(() => {
    customSessionMetaRef.current = {
      socialSessionId: socialSessionId ?? '',
      icebreakerSessionId: session?.icebreakerSessionId ?? '',
      eventTier: session?.eventTier,
      phase,
      playerCount,
      completedPhases: session?.completedPhases ?? [],
    }
  }, [session, socialSessionId, phase, playerCount])

  // Track custom-mode abandonment when the page unmounts without reaching recap/ended.
  useEffect(() => {
    return () => {
      const meta = customSessionMetaRef.current
      if (meta.eventTier === 'custom' && !customSessionCompletedRef.current && meta.socialSessionId) {
        socialIcebreakerAnalytics.track(
          'custom_session_abandoned',
          meta.socialSessionId,
          meta.icebreakerSessionId,
          meta.phase,
          {
            playerCount: meta.playerCount,
            completedPhases: meta.completedPhases,
          },
        )
      }
    }
  }, [])

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
    async <T,>(actionKey: string, suffix: string, data?: unknown): Promise<T | null> => {
      if (!socialSessionId) {
        return null
      }

      if (pendingAction !== null && pendingAction !== actionKey) {
        return null
      }

      setPendingAction(actionKey)

      try {
        const response = await apiRequest<T>({
          path: buildSocialPath(socialSessionId, suffix),
          method: 'POST',
          data,
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

  const handleGenerateTopics = useCallback((mood: AtmosphereMood) => {
    setTopicsError(false)
    void performSocialAction('topics', '/topics', {
      mood,
      eventType: '活动',
      participantCount: Math.max(playerCount, 2),
      avoidTopics: [],
    }).then((result) => {
      if (result === null) {
        setTopicsError(true)
      }
    })
  }, [performSocialAction, playerCount])

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

    // Single-test sessions pause at the test-mode disclosure before recap.
    if (session.isTestModeSkip && session.currentPhase === 'warmup') {
      setTestModeAdvanceError(null)
      setShowTestModeDisclosure(true)
      socialIcebreakerAnalytics.track(
        'icebreaker_test_mode_disclosure_shown',
        socialSessionId ?? undefined,
        session.icebreakerSessionId,
        undefined,
        {
          botCount: session.testModeBots?.length ?? 0,
          playerCount,
        },
      )
      return
    }

    void performSocialAction('advance', '/advance', {
      currentPhase: session.currentPhase,
    })
  }, [performSocialAction, session, socialSessionId, playerCount])

  const handleTestModeContinue = useCallback(async () => {
    if (!session) {
      return
    }

    setTestModeAdvanceError(null)
    const result = await performSocialAction('advance', '/advance', {
      currentPhase: session.currentPhase,
    })
    if (result === null) {
      setTestModeAdvanceError('继续时遇到小问题，点重试再试一次')
    } else {
      setShowTestModeDisclosure(false)
    }
  }, [performSocialAction, session])

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

  const handleHostMenuTap = useCallback(async () => {
    if (!isHost || !(phase === 'waiting' || phase === 'warmup')) {
      return
    }
    haptics('light')
    try {
      const { tapIndex } = await Taro.showActionSheet({
        itemList: ['更换模式'],
      })
      if (tapIndex === 0) {
        setIsTierSheetOpen(true)
      }
    } catch {
      // User cancelled the action sheet
    }
  }, [isHost, phase])

  const handleCompleteChallenge = useCallback(() => {
    void performSocialAction('micro-complete', '/micro-challenge/complete', {})
  }, [performSocialAction])

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
    void performSocialAction('dice-choose', '/personality-dice/choose', {
      userId: currentUserId,
      optionIndex,
      operationId: `${currentUserId}-choose-${Date.now()}`,
    })
  }, [performSocialAction, currentUserId])

  const handleGenerateAuctionLots = useCallback(() => {
    void performSocialAction('auction-gen', '/auction/generate-lots', {})
  }, [performSocialAction])

  const handleAuctionBid = useCallback(
    (amount: number) => {
      void performSocialAction('auction-bid', '/auction/bid', { amount })
    },
    [performSocialAction],
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

  const handleGoBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/events/index' }),
    })
  }, [])

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

  const pageError =
    bootstrapError ??
    (eventSessionError ? getIcebreakerPageErrorText(eventSessionError, '无法创建破冰会话') : null) ??
    (sessionError ? getIcebreakerPageErrorText(sessionError, getErrorMessage('load-failed')) : null) ??
    (socialSessionQuery.error ? getIcebreakerPageErrorText(socialSessionQuery.error, getErrorMessage('sync-failed')) : null)

  const isBootstrapping = !!resolvedSessionId && !socialSessionId && pendingAction === 'start' && !session

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
        <View className='icebreaker__error'>
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

  const adaptiveSuggestion =
    session?.xiaoyueAdaptiveSuggestion &&
    dismissedSuggestionAt !== session.xiaoyueAdaptiveSuggestion.generatedAt
      ? session.xiaoyueAdaptiveSuggestion
      : undefined

  const phaseHeader = (
    <XiaoyueSessionShell
      phase={phase}
      sessionPack={session?.xiaoyueSessionPack}
      adaptiveSuggestion={adaptiveSuggestion}
      playerCount={playerCount}
      isHost={isHost}
      isSyncing={socialSessionQuery.isRefetching}
      eventTitle={undefined}
      onRequestSuggestion={handleRequestAdaptiveSuggestion}
      onDismissSuggestion={handleDismissAdaptiveSuggestion}
    />
  )

  const HOST_CONTROL_HIDDEN_PHASES: SessionPhase[] = [
    'recap',
    'ended',
    'waiting',
    'phase_selection',
    'auction',
    'mini_script',
    'warmup',
    'lie_detective',
    'quip_battle',
    'undercover_word',
    'group_mirror',
    'speed_friending',
  ]

  const hostControls =
    isHost &&
    !HOST_CONTROL_HIDDEN_PHASES.includes(phase) && (
    <View className='icebreaker__host-controls'>
      <View className='icebreaker__host-badge'>
        <View className='icebreaker__host-badge-text'>
          <Image
            className='icebreaker__host-badge-icon'
            src={localAsset('/assets/icons/status-icons/status-crown.webp')}
            lazyLoad
          />
          <Text>你是主持人</Text>
        </View>
      </View>
      <Button
        variant='primary'
        className='icebreaker__advance-btn'
        onClick={handleAdvancePhase}
        disabled={pendingAction !== null}
        loading={pendingAction === 'advance'}
      >
        {pendingAction === 'advance' ? '切换中…' : '下一阶段'}
      </Button>
    </View>
  )

  const supportedPhases: SessionPhase[] = [
    'waiting',
    'warmup',
    'phase_selection',
    'micro_challenge',
    'lie_detective',
    'auction',
    'personality_dice',
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
    <ScrollView className='icebreaker' scrollY enhanced showScrollbar={false} style={bgStyles}>
      <View className='icebreaker__header-wrap'>
        {phaseHeader}

        {isHost && (phase === 'waiting' || phase === 'warmup') && (
          <View className='icebreaker__host-menu' onClick={handleHostMenuTap}>
            <Text className='icebreaker__host-menu-icon'>⋯</Text>
          </View>
        )}
      </View>

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
            participants={participants}
            currentUserId={currentUserId}
            selectedMood={session.selectedMood}
            isHost={isHost}
            vibe={apiVibeToClient(session.vibe)}
            archetypeMixText={session.archetypeMixText}
            isCustomMode={session.eventTier === 'custom'}
            currentTier={session.eventTier ?? 'glow'}
            canChangeTier={canChangeTier}
            onChangeTier={() => setIsTierSheetOpen(true)}
            onGenerateTopics={handleGenerateTopics}
            onToggleReady={handleToggleWarmupReady}
            onNextTopic={handleNextWarmupTopic}
            onAdvance={handleAdvancePhase}
            isGeneratingTopics={pendingAction === 'topics'}
            isUpdatingReady={pendingAction === 'warmup-ready'}
            isAdvancingTopic={pendingAction === 'warmup-next-topic'}
            isAdvancing={pendingAction === 'advance'}
            topicsError={topicsError}
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
          <MicroChallengePhaseView
            challenge={session.currentChallenge ?? null}
            completedBy={session.challengeCompletedBy ?? []}
            currentUserId={currentUserId}
            playerCount={playerCount}
            onComplete={handleCompleteChallenge}
            isCompleting={pendingAction === 'micro-complete'}
          />
        )}

        {phase === 'lie_detective' && session && (
          <LieDetectivePhaseView
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
            onSubmitTags={handleSubmitTags}
            isSubmittingTags={pendingAction === 'lie-submit-tags'}
          />
        )}

        {phase === 'auction' && session && (
          <AuctionPhaseView
            session={session}
            currentUserId={currentUserId}
            isHost={isHost}
            onGenerateLots={handleGenerateAuctionLots}
            onPlaceBid={handleAuctionBid}
            onCloseLot={handleCloseAuctionLot}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
            isGeneratingLots={pendingAction === 'auction-gen'}
            isPlacingBid={pendingAction === 'auction-bid'}
            isClosingLot={pendingAction === 'auction-close'}
          />
        )}

        {phase === 'mini_script' && session && (
          <>
            {isHost && session.enabledPhases?.includes('mini_script') ? (
              <IcebreakerToolSelector onOpenMiniScript={() => setMiniScriptModalOpen(true)} />
            ) : null}
            <MiniScriptPhaseView
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
          <PersonalityDicePhaseView
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
          />
        )}

        {phase === 'quip_battle' && session && (
          <QuipBattlePhaseView
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
          />
        )}

        {phase === 'undercover_word' && session && (
          <UndercoverWordPhaseView
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
          />
        )}

        {phase === 'group_mirror' && session && (
          <GroupMirrorPhaseView
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
          />
        )}

        {phase === 'speed_friending' && session && (
          <SpeedFriendingPhaseView
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
          />
        )}

        {(phase === 'recap' || phase === 'ended') && session && (
          <RecapPhaseView
            recapData={recapQuery.data?.state?.recapData ?? session.recapData ?? null}
            summary={recapQuery.data?.summary ?? null}
            medals={recapQuery.data?.medals ?? []}
            playerCount={playerCount}
            onLeave={handleGoBack}
            socialSessionId={socialSessionId}
            recapMeta={recapQuery.data?.meta ?? null}
          />
        )}

        {!supportedPhases.includes(phase) && session && (
          <FallbackPhaseView phase={phase} isHost={isHost} onAdvance={handleAdvancePhase} />
        )}
      </View>

      {hostControls}

      <View className='icebreaker__spacer' />

      <IcebreakerTierSheet
        isOpen={isTierSheetOpen}
        currentTier={session?.eventTier ?? 'glow'}
        currentVibe={apiVibeToClient(session?.vibe)}
        customEnabled={features?.socialIcebreakerCustomModeEnabled !== false}
        isBusy={pendingAction === 'set-tier'}
        onClose={() => setIsTierSheetOpen(false)}
        onConfirm={handleConfirmTierSwitch}
      />

      {showTestModeDisclosure && (
        <View className='icebreaker__test-mode-overlay' catchMove>
          <TestModeDisclosure
            bots={session?.testModeBots}
            socialSessionId={socialSessionId ?? undefined}
            icebreakerSessionId={session?.icebreakerSessionId}
            onContinue={handleTestModeContinue}
            onRetry={handleTestModeContinue}
            isLoading={pendingAction === 'advance'}
            error={testModeAdvanceError}
          />
        </View>
      )}
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
