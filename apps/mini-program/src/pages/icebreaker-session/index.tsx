import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useAuth } from '../../hooks/useAuth'
import { logInfo, logError } from '../../lib/logger'
import OnboardingLoadingShell from '../../components/OnboardingLoadingShell'
import Card from '../../components/Card'
import Button from '../../components/Button'
import {
  AuctionPhaseView,
  FallbackPhaseView,
  getPhaseLabel,
  LieDetectivePhaseView,
  MicroChallengePhaseView,
  MiniScriptPhaseView,
  PersonalityDicePhaseView,
  RecapPhaseView,
  type SessionPhase,
  WarmupPhaseView,
} from './phaseViews'
import { IcebreakerToolSelector } from './IcebreakerToolSelector'
import { MiniScriptConfigModal } from './MiniScriptConfigModal'
import type { AtmosphereMood, SocialSessionState } from '@shared/socialIcebreaker'
import { PHASE_CONFIG } from '@shared/socialIcebreaker'
import type { MiniScriptGenre, MiniScriptStyle } from '@shared/miniscriptStoryFramework'
import {
  buildSocialPath,
  deriveParticipants,
  getErrorText,
  getUserArchetype,
  getUserDisplayName,
  getUserInterests,
  normaliseSession,
  type EventSessionDiscovery,
  type IcebreakerSession,
  type LegacyIcebreakerSessionDetails,
  type SocialRecapResponse,
  type SocialStartResponse,
} from './icebreakerSessionModel'
import './index.scss'

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
  const [socialSessionId, setSocialSessionId] = useState<string | null>(null)
  const [bootstrapState, setBootstrapState] = useState<SocialSessionState | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
  const [miniScriptModalOpen, setMiniScriptModalOpen] = useState(false)
  const [miniScriptSubmitting, setMiniScriptSubmitting] = useState(false)
  const startAttemptRef = useRef<string | null>(null)

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
    enabled: !!routeEventId && !routeSessionId && !authLoading,
  })

  const resolvedSessionId = routeSessionId || eventSession?.sessionId || ''

  useEffect(() => {
    setSocialSessionId(null)
    setBootstrapState(null)
    setBootstrapError(null)
    setPendingAction(null)
    startAttemptRef.current = null
  }, [resolvedSessionId])

  const {
    data: sessionDetails,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery<LegacyIcebreakerSessionDetails>({
    queryKey: ['mini-program', 'icebreaker-session-details', resolvedSessionId],
    queryFn: () =>
      apiRequest<LegacyIcebreakerSessionDetails>({
        path: `/api/icebreaker/session/${encodeURIComponent(resolvedSessionId)}`,
      }),
    enabled: !!resolvedSessionId && !authLoading,
    staleTime: 0,
  })

  useEffect(() => {
    if (!resolvedSessionId || authLoading || !currentUserId || sessionLoading || sessionError) {
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
        eventType: sessionDetails?.eventType ?? '活动',
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

        const message = getErrorText(error, '无法加入破冰会话')
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
    sessionDetails?.eventType,
  ])

  const socialSessionQuery = useQuery<SocialSessionState>({
    queryKey: ['mini-program', 'social-icebreaker-session', socialSessionId],
    queryFn: () => apiRequest<SocialSessionState>({ path: buildSocialPath(socialSessionId ?? '') }),
    enabled: !!socialSessionId && !authLoading,
    refetchInterval: 3000,
    staleTime: 0,
  })

  const session = useMemo(() => {
    const sourceState = socialSessionQuery.data ?? bootstrapState
    return sourceState ? normaliseSession(sourceState) : null
  }, [socialSessionQuery.data, bootstrapState])

  const phase: SessionPhase = session?.phase ?? 'waiting'
  const hostUserId = session?.hostUserId ?? ''
  const isHost = !!currentUserId && currentUserId === hostUserId
  const participants = session
    ? deriveParticipants(session, sessionDetails?.participants ?? [], hostUserId)
    : []
  const playerCount = session?.playerCount ?? participants.length

  const recapQuery = useQuery<SocialRecapResponse>({
    queryKey: ['mini-program', 'social-icebreaker-recap', socialSessionId],
    queryFn: () => apiRequest<SocialRecapResponse>({ path: buildSocialPath(socialSessionId ?? '', '/recap') }),
    enabled: phase === 'recap' && !!socialSessionId && !authLoading,
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
        const message = getErrorText(error, '操作失败，请稍后重试')
        logError('[IcebreakerSession] Social action failed', {
          socialSessionId,
          actionKey,
          message,
        })
        Taro.showToast({
          title: message.length > 12 ? '操作失败，请稍后重试' : message,
          icon: 'none',
          duration: 2200,
        })
        return null
      } finally {
        setPendingAction((current) => (current === actionKey ? null : current))
      }
    },
    [socialSessionId, pendingAction, socialSessionQuery],
  )

  const handleGenerateTopics = useCallback((mood: AtmosphereMood) => {
    void performSocialAction('topics', '/topics', {
      mood,
      eventType: sessionDetails?.eventType ?? '活动',
      participantCount: Math.max(playerCount, 2),
      avoidTopics: [],
    })
  }, [performSocialAction, sessionDetails?.eventType, playerCount])

  const handleToggleWarmupReady = useCallback(() => {
    const isReady = session?.warmupReadyUserIds?.includes(currentUserId) ?? false
    void performSocialAction('warmup-ready', '/warmup/ready', { ready: !isReady })
  }, [performSocialAction, session?.warmupReadyUserIds, currentUserId])

  const handleNextWarmupTopic = useCallback(() => {
    void performSocialAction('warmup-next-topic', '/warmup/next-topic', {})
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

  const handleCompleteChallenge = useCallback(() => {
    void performSocialAction('micro-complete', '/micro-challenge/complete', {})
  }, [performSocialAction])

  const handleGenerateStatements = useCallback(() => {
    void performSocialAction('lie-generate', '/lie-detective/generate', {
      displayName: currentUserDisplayName,
      archetype: currentUserArchetype,
      interests: currentUserInterests,
    })
  }, [performSocialAction, currentUserDisplayName, currentUserArchetype, currentUserInterests])

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

  const handleCompleteDiceChallenge = useCallback(() => {
    void performSocialAction('dice-complete', '/personality-dice/complete', {})
  }, [performSocialAction])

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

  const handleGoBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/events/index' }),
    })
  }, [])

  const submitMiniScriptGenerate = useCallback(
    async (payload: { style: MiniScriptStyle; genres: MiniScriptGenre[] }) => {
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
          },
        })
        await socialSessionQuery.refetch()
        setMiniScriptModalOpen(false)
        Taro.showToast({ title: '剧本已生成', icon: 'success', duration: 2000 })
      } catch (error) {
        const message = getErrorText(error, '生成失败，请稍后重试')
        logError('[IcebreakerSession] MiniScript generate failed', { socialSessionId, message })
        Taro.showToast({
          title: message.length > 14 ? '生成失败' : message,
          icon: 'none',
          duration: 2200,
        })
      } finally {
        setMiniScriptSubmitting(false)
      }
    },
    [socialSessionId, session, socialSessionQuery],
  )

  const pageError =
    bootstrapError ??
    (eventSessionError ? getErrorText(eventSessionError, '无法创建破冰会话') : null) ??
    (sessionError ? getErrorText(sessionError, '加载破冰信息失败') : null) ??
    (socialSessionQuery.error ? getErrorText(socialSessionQuery.error, '同步破冰状态失败') : null)

  const isBootstrapping = !!resolvedSessionId && !socialSessionId && pendingAction === 'start' && !session

  if (authLoading || eventSessionLoading || sessionLoading || isBootstrapping) {
    return (
      <OnboardingLoadingShell
        stepLabel='同桌游戏'
        title='正在加入破冰会话'
        subtitle='小悦正在对齐活动与同桌状态，马上就能开始。'
        hint='若网络稍慢，多等几秒不会错过开场。'
        xiaoyueExpression='loadingSystem'
      />
    )
  }

  if (!resolvedSessionId || pageError || !session) {
    return (
      <View className='icebreaker icebreaker--error'>
        <View className='icebreaker__error'>
          <Text className='icebreaker__error-icon'>😕</Text>
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
    <View className='icebreaker__header'>
      <View className='icebreaker__phase-badge'>
        <Text className='icebreaker__phase-label'>{getPhaseLabel(phase)}</Text>
      </View>
      {sessionDetails?.eventTitle ? (
        <Text className='icebreaker__player-count'>{sessionDetails.eventTitle}</Text>
      ) : null}
      {playerCount > 0 && (
        <Text className='icebreaker__player-count'>
          👥 {playerCount} 人参与
        </Text>
      )}
      {socialSessionQuery.isRefetching && (
        <View className='icebreaker__offline-badge'>
          <Text className='icebreaker__offline-text'>同步中…</Text>
        </View>
      )}
    </View>
  )

  const hostControls =
    isHost &&
    phase !== 'recap' &&
    phase !== 'ended' &&
    phase !== 'waiting' &&
    phase !== 'auction' && (
    <View className='icebreaker__host-controls'>
      <View className='icebreaker__host-badge'>
        <Text className='icebreaker__host-badge-text'>👑 你是主持人</Text>
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
    'micro_challenge',
    'lie_detective',
    'auction',
    'personality_dice',
    'mini_script',
    'recap',
    'ended',
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
    <ScrollView className='icebreaker' scrollY enhanced showScrollbar={false}>
      {phaseHeader}

      {phase === 'waiting' && (
        <WaitingPhase
          playerCount={playerCount}
          hostName={session?.hostDisplayName}
          isHost={isHost}
          onAdvance={handleAdvancePhase}
        />
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
          onGenerateTopics={handleGenerateTopics}
          onToggleReady={handleToggleWarmupReady}
          onNextTopic={handleNextWarmupTopic}
          isGeneratingTopics={pendingAction === 'topics'}
          isUpdatingReady={pendingAction === 'warmup-ready'}
          isAdvancingTopic={pendingAction === 'warmup-next-topic'}
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
            framework={session.miniScriptFramework}
            phaseStartedAt={session.phaseStartedAt}
            timeoutMinutes={PHASE_CONFIG.mini_script.timeoutMinutes}
            isHost={isHost}
            onAdvance={handleAdvancePhase}
            isAdvancing={pendingAction === 'advance'}
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
          currentUserId={currentUserId}
          isHost={isHost}
          onGenerate={handleGenerateDiceChallenges}
          onComplete={handleCompleteDiceChallenge}
          isGenerating={pendingAction === 'dice-generate'}
          isCompleting={pendingAction === 'dice-complete'}
        />
      )}

      {(phase === 'recap' || phase === 'ended') && session && (
        <RecapPhaseView
          recapData={recapQuery.data?.state?.recapData ?? session.recapData ?? null}
          summary={recapQuery.data?.summary ?? null}
          medals={recapQuery.data?.medals ?? []}
          playerCount={playerCount}
          onLeave={handleGoBack}
        />
      )}

      {!supportedPhases.includes(phase) && session && (
        <FallbackPhaseView phase={phase} isHost={isHost} onAdvance={handleAdvancePhase} />
      )}

      {hostControls}

      <View className='icebreaker__spacer' />
    </ScrollView>
  )
}

function WaitingPhase({
  playerCount,
  hostName,
  isHost,
  onAdvance,
}: {
  playerCount: number
  hostName?: string
  isHost: boolean
  onAdvance: () => void
}) {
  return (
    <View className='icebreaker__waiting'>
      <Card className='icebreaker__waiting-card'>
        <Text className='icebreaker__waiting-emoji'>⏳</Text>
        <Text className='icebreaker__waiting-title'>等待更多玩家加入…</Text>
        <Text className='icebreaker__waiting-count'>
          当前 {playerCount} 人已加入
        </Text>
        {hostName && (
          <Text className='icebreaker__waiting-host'>
            主持人：{hostName}
          </Text>
        )}
      </Card>
      {isHost && (
        <Button variant='primary' className='icebreaker__start-btn' onClick={onAdvance}>
          开始破冰
        </Button>
      )}
    </View>
  )
}
