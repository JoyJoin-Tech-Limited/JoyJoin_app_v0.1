import { useMemo, useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useAuth } from '../../hooks/useAuth'
import { logInfo, logError } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import {
  FallbackPhaseView,
  getPhaseLabel,
  LieDetectivePhaseView,
  MicroChallengePhaseView,
  PersonalityDicePhaseView,
  RecapPhaseView,
  type SessionParticipant,
  type SessionPhase,
  WarmupPhaseView,
} from './phaseViews'
import type {
  AtmosphereMood,
  SocialSessionState,
  SocialIcebreakerPhase,
} from '@shared/socialIcebreaker'
import './index.scss'

// ─── Types ────────────────────────────────────────────────────────

interface IcebreakerSession extends SocialSessionState {
  id: string
  phase: SessionPhase
}

interface EventSessionDiscovery {
  sessionId?: string | null
  checkedInCount?: number
  expectedAttendees?: number
  currentPhase?: string | null
}

interface SessionDetailsParticipant {
  userId?: string
  id?: string
  displayName?: string
  nickname?: string
  archetype?: string
  interests?: string[]
  topicsHappy?: string[]
  topicsAvoid?: string[]
  [key: string]: unknown
}

interface LegacyIcebreakerSessionDetails {
  id: string
  eventId: string
  eventType?: string
  eventTitle?: string
  participants?: SessionDetailsParticipant[]
  [key: string]: unknown
}

interface SocialStartResponse {
  socialSessionId: string
  currentPhase: SocialIcebreakerPhase
  hostUserId: string
  hostDisplayName: string
  state: SocialSessionState
}

interface SocialRecapResponse {
  summary?: {
    headline?: string
    moments?: string[]
    closingLine?: string
  }
  medals?: Array<{
    emoji: string
    title: string
    recipientDisplayName: string
    description: string
  }>
  state?: SocialSessionState
}

// ─── Helpers ──────────────────────────────────────────────────────

function normaliseSession(state: SocialSessionState): IcebreakerSession {
  return {
    ...state,
    id: state.socialSessionId,
    phase: state.currentPhase,
  }
}

function getUserDisplayName(user: Record<string, unknown> | undefined): string {
  if (!user) {
    return '参与者'
  }

  if (typeof user.displayName === 'string' && user.displayName.trim() !== '') {
    return user.displayName
  }

  if (typeof user.nickname === 'string' && user.nickname.trim() !== '') {
    return user.nickname
  }

  return '参与者'
}

function getUserArchetype(user: Record<string, unknown> | undefined): string | undefined {
  if (!user) {
    return undefined
  }

  if (typeof user.archetype === 'string' && user.archetype.trim() !== '') {
    return user.archetype
  }

  if (typeof user.primaryArchetype === 'string' && user.primaryArchetype.trim() !== '') {
    return user.primaryArchetype
  }

  return undefined
}

function getUserInterests(user: Record<string, unknown> | undefined): string[] {
  if (!user) {
    return []
  }

  const candidateLists = [user.interestsRankedTop3, user.interests, user.topInterests]

  for (const candidate of candidateLists) {
    if (Array.isArray(candidate)) {
      return candidate.filter((value): value is string => typeof value === 'string' && value.trim() !== '')
    }
  }

  return []
}

function getErrorText(error: unknown, fallback: string): string {
  if (error instanceof Error && error.message.trim() !== '') {
    return error.message
  }

  return fallback
}

function deriveParticipants(
  session: IcebreakerSession,
  roster: SessionDetailsParticipant[],
  hostId?: string
): SessionParticipant[] {
  const rosterByUserId = new Map(
    roster.map((participant) => [participant.userId ?? participant.id ?? '', participant] as const),
  )

  if (session.joinedParticipants && session.joinedParticipants.length > 0) {
    return session.joinedParticipants.map((participant) => {
      const details = rosterByUserId.get(participant.userId)

      return {
        ...details,
        userId: participant.userId,
        displayName: participant.displayName || details?.displayName || details?.nickname,
        archetype: details?.archetype,
        interests: Array.isArray(details?.interests)
          ? details.interests.filter((value): value is string => typeof value === 'string')
          : [],
        isHost: participant.userId === hostId,
        isActive: participant.isActive,
      }
    })
  }

  if (roster.length > 0) {
    return roster.map((participant) => {
      const userId = participant.userId ?? participant.id ?? ''

      return {
        ...participant,
        userId,
        displayName: participant.displayName ?? participant.nickname,
        archetype: participant.archetype,
        interests: Array.isArray(participant.interests)
          ? participant.interests.filter((value): value is string => typeof value === 'string')
          : [],
        isHost: userId === hostId,
      }
    })
  }

  const ids = new Set<string>()
  session.lieDetectivePlayers?.forEach((p) => ids.add(p.userId))
  session.warmupReadyUserIds?.forEach((id) => ids.add(id))
  session.personalityDiceChallenges?.forEach((challenge) => ids.add(challenge.userId))
  if (hostId) ids.add(hostId)

  return Array.from(ids).map((userId) => ({
    userId,
    displayName:
      session.lieDetectivePlayers?.find((p) => p.userId === userId)?.displayName ??
      session.personalityDiceChallenges?.find((challenge) => challenge.userId === userId)?.displayName,
    isHost: userId === hostId,
  }))
}

function buildSocialPath(socialSessionId: string, suffix = ''): string {
  const encodedId = encodeURIComponent(socialSessionId)
  return `/api/social-icebreaker/${encodedId}${suffix}`
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
  const [socialSessionId, setSocialSessionId] = useState<string | null>(null)
  const [bootstrapState, setBootstrapState] = useState<SocialSessionState | null>(null)
  const [bootstrapError, setBootstrapError] = useState<string | null>(null)
  const [pendingAction, setPendingAction] = useState<string | null>(null)
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

  const handleGoBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/events/index' }),
    })
  }, [])

  const pageError =
    bootstrapError ??
    (eventSessionError ? getErrorText(eventSessionError, '无法创建破冰会话') : null) ??
    (sessionError ? getErrorText(sessionError, '加载破冰信息失败') : null) ??
    (socialSessionQuery.error ? getErrorText(socialSessionQuery.error, '同步破冰状态失败') : null)

  const isBootstrapping = !!resolvedSessionId && !socialSessionId && pendingAction === 'start' && !session

  if (authLoading || eventSessionLoading || sessionLoading || isBootstrapping) {
    return <LoadingScreen message='加载破冰游戏…' />
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

  const hostControls = isHost && phase !== 'recap' && phase !== 'ended' && phase !== 'waiting' && (
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
    'personality_dice',
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
