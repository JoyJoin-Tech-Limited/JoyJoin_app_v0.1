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
  DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES,
  PHASE_CONFIG,
  PHASE_ORDER,
  type AtmosphereMood,
  type SocialSessionState,
  type SocialIcebreakerPhase,
  type LieDetectivePlayer,
  type LieDetectiveVote,
  type LieDetectiveReveal,
  type PersonalityDiceChallenge,
} from '@shared/socialIcebreaker'
import './index.scss'

// ─── Types ────────────────────────────────────────────────────────

type SessionPhase = 'waiting' | SocialIcebreakerPhase | 'ended'

interface IcebreakerSession extends SocialSessionState {
  id: string
  phase: SessionPhase
}

interface SessionParticipant {
  userId: string
  displayName?: string
  archetype?: string
  interests?: string[]
  isHost?: boolean
  isActive?: boolean
  [key: string]: unknown
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

interface SocialPulseCheckResponse {
  voteCount: number
  averageVibe: number
  allVoted: boolean
}

const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; emoji: string; label: string }> = [
  { mood: 'funny', emoji: '😂', label: '搞笑' },
  { mood: 'life', emoji: '☕', label: '生活' },
  { mood: 'relaxed', emoji: '✨', label: '轻松' },
  { mood: 'emotional', emoji: '💫', label: '情感' },
]

const VIBE_OPTIONS: Array<{ vibe: 1 | 2 | 3; emoji: string; label: string }> = [
  { vibe: 1, emoji: '😐', label: '一般' },
  { vibe: 2, emoji: '😊', label: '不错' },
  { vibe: 3, emoji: '🔥', label: '超燃' },
]

const PULSE_PHASE_LABELS: Partial<Record<SocialIcebreakerPhase, string>> = {
  warmup: '🌅 热身结束啦，今晚的开场感觉如何？',
  micro_challenge: '⚡ 挑战完成！大家玩得开心吗？',
  lie_detective: '🕵️ 侦探回合结束，现场温度怎么样？',
  personality_dice: '🎲 骰子挑战结束，大家还在线吗？',
}

// ─── Helpers ──────────────────────────────────────────────────────

function normaliseSession(state: SocialSessionState): IcebreakerSession {
  return {
    ...state,
    id: state.socialSessionId,
    phase: state.currentPhase,
  }
}

function getPhaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case 'waiting':
      return '等待中'
    case 'warmup':
      return '🌅 热身'
    case 'micro_challenge':
      return '⚡ 挑战'
    case 'lie_detective':
      return '🕵️ 谎言侦探'
    case 'personality_dice':
      return '🎲 人格骰子'
    case 'auction':
      return '🎪 拍卖'
    case 'mini_script_beta':
      return '🧪 剧本体验'
    case 'recap':
      return '✨ 回顾'
    case 'ended':
      return '已结束'
    default:
      return phase
  }
}

function getMoodLabel(mood?: AtmosphereMood | null): string {
  switch (mood) {
    case 'funny':
      return '搞笑'
    case 'life':
      return '生活'
    case 'relaxed':
      return '轻松'
    case 'emotional':
      return '情感'
    default:
      return '待选择'
  }
}

function getVibeSummary(average: number): string {
  if (average >= 2.5) {
    return '🔥 全场已经热起来了'
  }

  if (average >= 1.5) {
    return '😊 大家状态不错，继续保持'
  }

  return '😌 还可以再暖一暖，下一轮继续'
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

function getPhaseGuide(
  session: IcebreakerSession,
  phase: SessionPhase,
  isHost: boolean,
  playerCount: number,
): { title: string; description: string; footnote?: string } | null {
  switch (phase) {
    case 'waiting':
      return {
        title: isHost ? '等大家都进来再开始' : '主持人正在准备开始',
        description: `当前小队已有 ${playerCount} 人加入。`,
        footnote: isHost ? '人齐后可以直接开始第一轮热身。' : '保持页面开启，开始后会自动同步到当前阶段。',
      }
    case 'warmup': {
      const topicCount = session.warmupTopics?.length ?? 0
      const currentIndex = session.currentTopicIndex ?? 0
      const selectedMood = getMoodLabel(session.selectedMood)

      if (topicCount === 0) {
        return {
          title: selectedMood === '待选择' ? '先定今晚的热身氛围' : `今晚先走${selectedMood}路线`,
          description: isHost
            ? '先选一个氛围，小悦会生成对应的热身题目。'
            : '等待主持人选择氛围并生成今晚的热身话题。',
          footnote: isHost ? '选好氛围后，所有题目都会按这个风格生成。' : undefined,
        }
      }

      return {
        title: `第 ${Math.min(currentIndex + 1, topicCount)} 题正在进行`,
        description: `当前是${selectedMood}风格热身，${session.warmupReadyUserIds?.length ?? 0}/${playerCount} 人已准备。`,
        footnote: isHost
          ? '所有人准备好后，你可以切到下一题或直接进入挑战阶段。'
          : '准备好后点“我准备好了”，主持人才可以继续推进。',
      }
    }
    case 'micro_challenge':
      return {
        title: '先用一个小动作把距离拉近',
        description: `${session.challengeCompletedBy?.length ?? 0}/${playerCount} 人已完成这轮挑战。`,
        footnote: isHost
          ? '全部完成或倒计时结束后，就可以切到侦探环节。'
          : '完成后记得点击“我已完成挑战”。',
      }
    case 'lie_detective': {
      const generatedPlayers = session.lieDetectivePlayers?.length ?? 0
      const currentPlayer = session.lieDetectivePlayers?.[session.currentLieDetectivePlayerIndex ?? 0]

      if (generatedPlayers < playerCount) {
        return {
          title: '先让每个人写好三句话',
          description: `当前已生成 ${generatedPlayers}/${playerCount} 份侦探陈述。`,
          footnote: isHost ? '等所有人提交后，就能开启轮流猜谎环节。' : '先生成你的三句话，其他人才看得到这一轮。',
        }
      }

      return {
        title: `现在轮到 ${currentPlayer?.displayName ?? '下一位玩家'}`,
        description: `第 ${(session.currentLieDetectivePlayerIndex ?? 0) + 1}/${session.lieDetectivePlayers?.length ?? playerCount} 位玩家正在被猜。`,
        footnote: isHost ? '揭晓后可以切到下一位玩家。' : '选中你觉得是谎话的一句，猜错也没关系。',
      }
    }
    case 'personality_dice': {
      const challengeCount = session.personalityDiceChallenges?.length ?? 0

      return {
        title: challengeCount > 0 ? '每个人都有一项专属小任务' : '先掷出人格骰子',
        description: challengeCount > 0
          ? `已完成 ${session.diceCompletedBy?.length ?? 0}/${Math.max(challengeCount, playerCount)} 项骰子挑战。`
          : isHost
            ? '系统会按当前到场成员生成一人一题的专属互动挑战。'
            : '等待主持人掷出人格骰子，生成大家各自的任务。',
        footnote: isHost ? '全部完成后就能进入今晚的回顾。' : undefined,
      }
    }
    case 'recap':
    case 'ended':
      return {
        title: '今晚的破冰结果已经汇总',
        description: '回顾共同话题、完成的挑战和那些有意思的瞬间。',
        footnote: '看完就可以返回活动页，继续和大家保持联系。',
      }
    default: {
      if (phase in PHASE_CONFIG) {
        return {
          title: `${PHASE_CONFIG[phase as SocialIcebreakerPhase].name} 进行中`,
          description: '当前阶段暂时使用精简版展示，但服务端状态会继续正常推进。',
        }
      }

      return null
    }
  }
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
  const previousPhaseRef = useRef<SessionPhase | null>(null)
  const shownPulsePromptsRef = useRef<Set<string>>(new Set())
  const pulseHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [showPulseCheck, setShowPulseCheck] = useState(false)
  const [pulsePhaseLabel, setPulsePhaseLabel] = useState('')
  const [pulseAverage, setPulseAverage] = useState<number | null>(null)
  const [selectedPulseVibe, setSelectedPulseVibe] = useState<1 | 2 | 3 | null>(null)

  const clearPulseTimer = useCallback(() => {
    if (pulseHideTimerRef.current) {
      clearTimeout(pulseHideTimerRef.current)
      pulseHideTimerRef.current = null
    }
  }, [])

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
    setShowPulseCheck(false)
    setPulsePhaseLabel('')
    setPulseAverage(null)
    setSelectedPulseVibe(null)
    startAttemptRef.current = null
    previousPhaseRef.current = null
    shownPulsePromptsRef.current.clear()
    clearPulseTimer()
  }, [resolvedSessionId, clearPulseTimer])

  useEffect(() => {
    return () => {
      clearPulseTimer()
    }
  }, [clearPulseTimer])

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

  useEffect(() => {
    if (!session || !socialSessionId) {
      return
    }

    const currentPhase = session.currentPhase as SessionPhase
    const previousPhase = previousPhaseRef.current

    if (previousPhase && previousPhase !== currentPhase) {
      const promptLabel = previousPhase in PULSE_PHASE_LABELS
        ? PULSE_PHASE_LABELS[previousPhase as SocialIcebreakerPhase]
        : undefined
      const promptKey = `${socialSessionId}:${previousPhase}->${currentPhase}`

      if (promptLabel && !shownPulsePromptsRef.current.has(promptKey)) {
        shownPulsePromptsRef.current.add(promptKey)
        clearPulseTimer()
        setPulsePhaseLabel(promptLabel)
        setPulseAverage(null)
        setSelectedPulseVibe(null)
        setShowPulseCheck(true)
        pulseHideTimerRef.current = setTimeout(() => {
          setShowPulseCheck(false)
          setPulseAverage(null)
          setSelectedPulseVibe(null)
          pulseHideTimerRef.current = null
        }, 8000)
      }
    }

    previousPhaseRef.current = currentPhase
  }, [session, socialSessionId, clearPulseTimer])

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

  const enabledPhases = useMemo(() => {
    const source = session?.enabledPhases?.length
      ? session.enabledPhases
      : DEFAULT_SOCIAL_ICEBREAKER_ENABLED_PHASES

    return PHASE_ORDER.filter((candidate) => candidate === 'recap' || source.includes(candidate))
  }, [session?.enabledPhases])

  const phaseGuide = useMemo(() => {
    if (!session) {
      return null
    }

    return getPhaseGuide(session, phase, isHost, playerCount)
  }, [session, phase, isHost, playerCount])

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

  const dismissPulseCheck = useCallback(() => {
    clearPulseTimer()
    setShowPulseCheck(false)
    setPulseAverage(null)
    setSelectedPulseVibe(null)
    setPulsePhaseLabel('')
  }, [clearPulseTimer])

  const handleSubmitPulseCheck = useCallback((vibe: 1 | 2 | 3) => {
    setSelectedPulseVibe(vibe)

    void performSocialAction<SocialPulseCheckResponse>('pulse-check', '/pulse-check', { vibe }).then((response) => {
      if (!response) {
        setSelectedPulseVibe(null)
        return
      }

      clearPulseTimer()
      setPulseAverage(response.averageVibe)
      pulseHideTimerRef.current = setTimeout(() => {
        dismissPulseCheck()
      }, 2400)
    })
  }, [performSocialAction, clearPulseTimer, dismissPulseCheck])

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
      <PhaseProgressRail
        currentPhase={phase}
        enabledPhases={enabledPhases}
        completedPhases={session.completedPhases ?? []}
        isHost={isHost}
      />

      {phaseHeader}

      {phaseGuide ? (
        <PhaseGuideCard
          title={phaseGuide.title}
          description={phaseGuide.description}
          footnote={phaseGuide.footnote}
        />
      ) : null}

      {showPulseCheck && pulsePhaseLabel ? (
        <PulseCheckCard
          label={pulsePhaseLabel}
          selectedVibe={selectedPulseVibe}
          average={pulseAverage}
          isSubmitting={pendingAction === 'pulse-check'}
          onSelect={handleSubmitPulseCheck}
          onSkip={dismissPulseCheck}
        />
      ) : null}

      {participants.length > 0 ? (
        <SessionRosterCard participants={participants} currentUserId={currentUserId} />
      ) : null}

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

function PhaseProgressRail({
  currentPhase,
  enabledPhases,
  completedPhases,
  isHost,
}: {
  currentPhase: SessionPhase
  enabledPhases: SocialIcebreakerPhase[]
  completedPhases: SocialIcebreakerPhase[]
  isHost: boolean
}) {
  return (
    <View className='icebreaker__phase-rail'>
      <View className='icebreaker__phase-rail-inner'>
        {enabledPhases.map((phase) => {
          const config = PHASE_CONFIG[phase]
          const isActive = phase === currentPhase || (currentPhase === 'ended' && phase === 'recap')
          const isCompleted = completedPhases.includes(phase)

          return (
            <View
              key={phase}
              className={
                'icebreaker__phase-chip' +
                (isActive ? ' icebreaker__phase-chip--active' : '') +
                (isCompleted ? ' icebreaker__phase-chip--completed' : '')
              }
            >
              <Text className='icebreaker__phase-chip-emoji'>
                {isCompleted ? '✅' : config.emoji}
              </Text>
              <Text className='icebreaker__phase-chip-text'>{config.name}</Text>
            </View>
          )
        })}
      </View>
      {isHost ? <Text className='icebreaker__phase-rail-host'>👑 主持人</Text> : null}
    </View>
  )
}

function PhaseGuideCard({
  title,
  description,
  footnote,
}: {
  title: string
  description: string
  footnote?: string
}) {
  return (
    <Card className='icebreaker__guide-card'>
      <Text className='icebreaker__guide-title'>{title}</Text>
      <Text className='icebreaker__guide-text'>{description}</Text>
      {footnote ? <Text className='icebreaker__guide-footnote'>{footnote}</Text> : null}
    </Card>
  )
}

function PulseCheckCard({
  label,
  selectedVibe,
  average,
  isSubmitting,
  onSelect,
  onSkip,
}: {
  label: string
  selectedVibe: 1 | 2 | 3 | null
  average: number | null
  isSubmitting: boolean
  onSelect: (vibe: 1 | 2 | 3) => void
  onSkip: () => void
}) {
  return (
    <Card className='icebreaker__pulse-card'>
      <Text className='icebreaker__pulse-title'>此刻的你感觉怎样？</Text>
      <Text className='icebreaker__pulse-text'>{label}</Text>

      {average === null ? (
        <>
          <View className='icebreaker__pulse-options'>
            {VIBE_OPTIONS.map((option) => (
              <View
                key={option.vibe}
                className={
                  'icebreaker__pulse-option' +
                  (selectedVibe === option.vibe ? ' icebreaker__pulse-option--selected' : '')
                }
                onClick={() => onSelect(option.vibe)}
              >
                <Text className='icebreaker__pulse-option-emoji'>{option.emoji}</Text>
                <Text className='icebreaker__pulse-option-label'>{option.label}</Text>
              </View>
            ))}
          </View>

          <Text className='icebreaker__pulse-summary'>
            {isSubmitting ? '正在记录你的状态…' : '这是给下一环节的快速热度反馈，不会打断流程。'}
          </Text>
          <Text className='icebreaker__pulse-skip' onClick={onSkip}>稍后再说</Text>
        </>
      ) : (
        <Text className='icebreaker__pulse-summary'>{getVibeSummary(average)}</Text>
      )}
    </Card>
  )
}

function SessionRosterCard({
  participants,
  currentUserId,
}: {
  participants: SessionParticipant[]
  currentUserId: string
}) {
  const activeCount = participants.filter((participant) => participant.isActive).length

  return (
    <Card className='icebreaker__roster-card'>
      <View className='icebreaker__roster-head'>
        <Text className='icebreaker__roster-title'>当前小队</Text>
        <Text className='icebreaker__roster-meta'>在线 {activeCount} / {participants.length}</Text>
      </View>

      <View className='icebreaker__roster-list'>
        {participants.map((participant) => (
          <View
            key={participant.userId}
            className={
              'icebreaker__roster-pill' +
              (participant.isActive ? ' icebreaker__roster-pill--active' : '') +
              (participant.userId === currentUserId ? ' icebreaker__roster-pill--me' : '')
            }
          >
            <Text className='icebreaker__roster-name'>
              {participant.displayName ?? '匿名'}
            </Text>
            {participant.isHost ? <Text className='icebreaker__roster-badge'>👑</Text> : null}
            {participant.userId === currentUserId ? <Text className='icebreaker__roster-badge'>我</Text> : null}
            {participant.isActive ? <Text className='icebreaker__roster-badge'>在线</Text> : null}
          </View>
        ))}
      </View>
    </Card>
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

function WarmupPhaseView({
  topics,
  currentIndex,
  readyUserIds,
  participants,
  currentUserId,
  selectedMood,
  isHost,
  onGenerateTopics,
  onToggleReady,
  onNextTopic,
  isGeneratingTopics,
  isUpdatingReady,
  isAdvancingTopic,
}: {
  topics: Array<{ question: string; emoji?: string; mood?: string }>
  currentIndex: number
  readyUserIds: string[]
  participants: SessionParticipant[]
  currentUserId: string
  selectedMood?: AtmosphereMood
  isHost: boolean
  onGenerateTopics: (mood: AtmosphereMood) => void
  onToggleReady: () => void
  onNextTopic: () => void
  isGeneratingTopics: boolean
  isUpdatingReady: boolean
  isAdvancingTopic: boolean
}) {
  const currentTopic = topics[currentIndex]
  const isReady = readyUserIds.includes(currentUserId)
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  const moodLabel = getMoodLabel(selectedMood)

  return (
    <View className='icebreaker__warmup'>
      {currentTopic ? (
        <Card className='icebreaker__warmup-card'>
          <Text className='icebreaker__warmup-emoji'>
            {currentTopic.emoji ?? '🌅'}
          </Text>
          <Text className='icebreaker__warmup-question'>
            {currentTopic.question}
          </Text>
          <Text className='icebreaker__warmup-index'>
            {currentIndex + 1} / {topics.length}
          </Text>
          {selectedMood ? (
            <Text className='icebreaker__warmup-mood'>今晚氛围 · {moodLabel}</Text>
          ) : null}
        </Card>
      ) : (
        <Card className='icebreaker__warmup-card'>
          <Text className='icebreaker__warmup-emoji'>🌅</Text>
          <Text className='icebreaker__warmup-question'>
            热身话题准备中…
          </Text>
        </Card>
      )}

      {/* Participant ready status */}
      <View className='icebreaker__warmup-status'>
        <Text className='icebreaker__warmup-ready-count'>
          ✅ {readyUserIds.length} / {participants.length} 人已准备
        </Text>
        {isReady && (
          <Text className='icebreaker__warmup-ready-badge'>你已准备</Text>
        )}
      </View>

      {/* Participants list */}
      {participants.length > 0 && (
        <View className='icebreaker__participants'>
          {participants.map((p) => (
            <View
              key={p.userId}
              className={
                'icebreaker__participant' +
                (readyUserIds.includes(p.userId) ? ' icebreaker__participant--ready' : '')
              }
            >
              <Text className='icebreaker__participant-name'>
                {p.displayName ?? '匿名'}
              </Text>
              {p.isHost && (
                <Text className='icebreaker__participant-host'>👑</Text>
              )}
              {readyUserIds.includes(p.userId) && (
                <Text className='icebreaker__participant-check'>✅</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View className='icebreaker__action-stack'>
        {!currentTopic ? (
          isHost ? (
            <>
              <View className='icebreaker__mood-grid'>
                {MOOD_OPTIONS.map((option) => (
                  <View
                    key={option.mood}
                    className={
                      'icebreaker__mood-option' +
                      (selectedMood === option.mood ? ' icebreaker__mood-option--active' : '') +
                      (isGeneratingTopics ? ' icebreaker__mood-option--disabled' : '')
                    }
                    onClick={() => {
                      if (!isGeneratingTopics) {
                        onGenerateTopics(option.mood)
                      }
                    }}
                  >
                    <Text className='icebreaker__mood-option-emoji'>{option.emoji}</Text>
                    <Text className='icebreaker__mood-option-label'>{option.label}</Text>
                  </View>
                ))}
              </View>
              <Text className='icebreaker__helper-text'>
                {isGeneratingTopics ? '小悦正在根据你选的氛围出题…' : '先选一个氛围，小悦会生成这一轮的热身题目。'}
              </Text>
            </>
          ) : (
            <Text className='icebreaker__helper-text'>
              {selectedMood
                ? `主持人选择了${moodLabel}氛围，正在生成热身话题…`
                : '等待主持人选择今晚的热身氛围…'}
            </Text>
          )
        ) : (
          <>
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              className='icebreaker__action-btn'
              onClick={onToggleReady}
              disabled={isUpdatingReady}
              loading={isUpdatingReady}
            >
              {isUpdatingReady ? '提交中…' : isReady ? '取消准备' : '我准备好了'}
            </Button>

            {isHost && everyoneReady && currentIndex < topics.length - 1 ? (
              <Button
                variant='secondary'
                className='icebreaker__action-btn'
                onClick={onNextTopic}
                disabled={isAdvancingTopic}
                loading={isAdvancingTopic}
              >
                {isAdvancingTopic ? '切换中…' : '切换下一题'}
              </Button>
            ) : null}

            {isHost && everyoneReady && currentIndex >= topics.length - 1 ? (
              <Text className='icebreaker__helper-text'>所有热身已完成，可以使用下方按钮进入下一阶段。</Text>
            ) : null}

            {!isHost && !everyoneReady ? (
              <Text className='icebreaker__helper-text'>大家都准备好后，主持人才可以推进下一步。</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

function MicroChallengePhaseView({
  challenge,
  completedBy,
  currentUserId,
  playerCount,
  onComplete,
  isCompleting,
}: {
  challenge: { title: string; description: string; durationSeconds: number; completionCTA: string; visualHint?: string } | null
  completedBy: string[]
  currentUserId: string
  playerCount: number
  onComplete: () => void
  isCompleting: boolean
}) {
  const hasCompleted = completedBy.includes(currentUserId)

  return (
    <View className='icebreaker__challenge'>
      {challenge ? (
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>⚡</Text>
          <Text className='icebreaker__challenge-title'>{challenge.title}</Text>
          <Text className='icebreaker__challenge-desc'>{challenge.description}</Text>
          {challenge.visualHint && (
            <Text className='icebreaker__challenge-hint'>💡 {challenge.visualHint}</Text>
          )}
          <View className='icebreaker__challenge-meta'>
            <Text className='icebreaker__challenge-duration'>
              ⏱ {challenge.durationSeconds}秒
            </Text>
            <Text className='icebreaker__challenge-completed'>
              ✅ {completedBy.length} 人已完成
            </Text>
          </View>
          {hasCompleted && (
            <View className='icebreaker__challenge-done-badge'>
              <Text className='icebreaker__challenge-done-text'>
                你已完成！
              </Text>
            </View>
          )}
        </Card>
      ) : (
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>⚡</Text>
          <Text className='icebreaker__challenge-title'>挑战准备中…</Text>
        </Card>
      )}

      <View className='icebreaker__action-stack'>
        {!hasCompleted ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onComplete}
            disabled={isCompleting}
            loading={isCompleting}
          >
            {isCompleting ? '提交中…' : challenge?.completionCTA ?? '我已完成挑战'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>已记录你的完成状态，等待其他玩家完成或主持人推进下一阶段。</Text>
        )}

        <Text className='icebreaker__helper-text'>已完成 {completedBy.length} / {playerCount} 人</Text>
      </View>
    </View>
  )
}

function LieDetectivePhaseView({
  players,
  playerCount,
  currentPlayerIndex,
  votes,
  reveal,
  currentUserId,
  myVoteIndex,
  onVote,
  isVoting,
  hasGeneratedStatements,
  onGenerateStatements,
  isGeneratingStatements,
  isHost,
  canMoveToNextPlayer,
  onNextPlayer,
  isMovingNextPlayer,
}: {
  players: LieDetectivePlayer[]
  playerCount: number
  currentPlayerIndex: number
  votes: LieDetectiveVote[]
  reveal: LieDetectiveReveal | null
  currentUserId: string
  myVoteIndex: number | null
  onVote: (index: number) => void
  isVoting: boolean
  hasGeneratedStatements: boolean
  onGenerateStatements: () => void
  isGeneratingStatements: boolean
  isHost: boolean
  canMoveToNextPlayer: boolean
  onNextPlayer: () => void
  isMovingNextPlayer: boolean
}) {
  const everyoneGenerated = playerCount > 0 && players.length >= playerCount
  const currentPlayer = players[currentPlayerIndex]
  const isOwnTurn = currentPlayer?.userId === currentUserId
  const hasVoted = myVoteIndex !== null
  const isRevealed = !!reveal

  if (!everyoneGenerated) {
    return (
      <View className='icebreaker__detective'>
        <Card className='icebreaker__detective-card'>
          <Text className='icebreaker__detective-emoji'>🕵️</Text>
          <Text className='icebreaker__detective-waiting'>
            等待所有玩家提交陈述…
          </Text>
          <Text className='icebreaker__detective-hint'>
            当前已提交 {players.length} / {playerCount} 人
          </Text>
        </Card>

        <View className='icebreaker__action-stack'>
          {!hasGeneratedStatements ? (
            <Button
              variant='primary'
              className='icebreaker__action-btn'
              onClick={onGenerateStatements}
              disabled={isGeneratingStatements}
              loading={isGeneratingStatements}
            >
              {isGeneratingStatements ? '生成中…' : '生成我的三句话'}
            </Button>
          ) : (
            <Text className='icebreaker__helper-text'>你的陈述已提交，等待其他玩家完成。</Text>
          )}
        </View>
      </View>
    )
  }

  if (!currentPlayer) {
    return (
      <View className='icebreaker__detective'>
        <Card className='icebreaker__detective-card'>
          <Text className='icebreaker__detective-emoji'>🕵️</Text>
          <Text className='icebreaker__detective-waiting'>等待侦探回合开启…</Text>
        </Card>
      </View>
    )
  }

  return (
    <View className='icebreaker__detective'>
      <Card className='icebreaker__detective-card'>
        <Text className='icebreaker__detective-emoji'>🕵️</Text>
        <Text className='icebreaker__detective-player'>
          {currentPlayer.displayName} 的回合
        </Text>
        <Text className='icebreaker__detective-hint'>
          {isOwnTurn
            ? '其他人正在猜测你的谎言…'
            : '哪句是谎言？点击你的答案'}
        </Text>
      </Card>

      {/* Statements */}
      <View className='icebreaker__detective-statements'>
        {currentPlayer.statements.map((stmt) => {
          const isSelected = myVoteIndex === stmt.index
          const isLie = isRevealed && reveal?.lieIndex === stmt.index
          // Count votes for this statement (only shown after reveal)
          const voteCount = isRevealed
            ? votes.filter(
                (v) => v.targetUserId === currentPlayer.userId && v.guessedStatementIndex === stmt.index,
              ).length
            : 0

          let cardModifier = ''
          if (isRevealed && isLie) cardModifier = ' icebreaker__statement--lie'
          else if (isRevealed && !isLie) cardModifier = ' icebreaker__statement--truth'
          else if (isSelected) cardModifier = ' icebreaker__statement--selected'

          return (
            <View
              key={stmt.index}
              className={'icebreaker__statement' + cardModifier}
              onClick={() => {
                if (!isOwnTurn && !isVoting && !isRevealed) {
                  onVote(stmt.index)
                }
              }}
            >
              <View className='icebreaker__statement-header'>
                <Text className='icebreaker__statement-index'>
                  {stmt.index + 1}
                </Text>
                {isRevealed && isLie && (
                  <Text className='icebreaker__statement-tag icebreaker__statement-tag--lie'>
                    谎言
                  </Text>
                )}
                {isRevealed && !isLie && (
                  <Text className='icebreaker__statement-tag icebreaker__statement-tag--truth'>
                    真话
                  </Text>
                )}
              </View>
              <Text className='icebreaker__statement-text'>{stmt.text}</Text>
              {isRevealed && (
                <Text className='icebreaker__statement-votes'>
                  {voteCount} 人选择
                </Text>
              )}
            </View>
          )
        })}
      </View>

      {/* Vote status */}
      {!isOwnTurn && (
        <View className='icebreaker__detective-status'>
          {hasVoted && !isRevealed && (
            <Text className='icebreaker__detective-voted'>✅ 已提交猜测，再次点击可修改答案</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex === myVoteIndex && (
            <Text className='icebreaker__detective-correct'>🎉 猜对了！</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex !== myVoteIndex && (
            <Text className='icebreaker__detective-wrong'>😅 猜错了</Text>
          )}
        </View>
      )}

      {isOwnTurn && !isRevealed ? (
        <Text className='icebreaker__helper-text'>轮到你被猜测啦，等其他玩家投票完成后会自动揭晓。</Text>
      ) : null}

      <View className='icebreaker__action-stack'>
        {!hasGeneratedStatements ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onGenerateStatements}
            disabled={isGeneratingStatements}
            loading={isGeneratingStatements}
          >
            {isGeneratingStatements ? '生成中…' : '生成我的三句话'}
          </Button>
        ) : null}

        {isHost && canMoveToNextPlayer ? (
          <Button
            variant='secondary'
            className='icebreaker__action-btn'
            onClick={onNextPlayer}
            disabled={isMovingNextPlayer}
            loading={isMovingNextPlayer}
          >
            {isMovingNextPlayer ? '切换中…' : '下一位玩家'}
          </Button>
        ) : null}

        {isHost && isRevealed && !canMoveToNextPlayer ? (
          <Text className='icebreaker__helper-text'>所有侦探回合已完成，可以进入下一阶段。</Text>
        ) : null}
      </View>

      <Text className='icebreaker__detective-progress'>
        {currentPlayerIndex + 1} / {players.length} 位玩家
      </Text>
    </View>
  )
}

function PersonalityDicePhaseView({
  participants,
  challenges,
  currentPlayerIndex,
  completedBy,
  currentUserId,
  isHost,
  onGenerate,
  onComplete,
  isGenerating,
  isCompleting,
}: {
  participants: SessionParticipant[]
  challenges: PersonalityDiceChallenge[]
  currentPlayerIndex: number
  completedBy: string[]
  currentUserId: string
  isHost: boolean
  onGenerate: () => void
  onComplete: () => void
  isGenerating: boolean
  isCompleting: boolean
}) {
  const currentChallenge = challenges[currentPlayerIndex] ?? null
  const allCompleted = challenges.length > 0 && completedBy.length >= challenges.length
  const isMyChallenge = currentChallenge?.userId === currentUserId
  const hasCompleted = completedBy.includes(currentUserId)

  if (challenges.length === 0) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>🎲</Text>
          <Text className='icebreaker__challenge-title'>人格骰子</Text>
          <Text className='icebreaker__challenge-desc'>
            掷出命运骰子，为每位玩家生成一个专属挑战。
          </Text>
        </Card>

        <View className='icebreaker__action-stack'>
          {isHost ? (
            <Button
              variant='primary'
              className='icebreaker__action-btn'
              onClick={onGenerate}
              disabled={isGenerating}
              loading={isGenerating}
            >
              {isGenerating ? '生成中…' : '掷出人格骰子'}
            </Button>
          ) : (
            <Text className='icebreaker__helper-text'>等待主持人掷出人格骰子…</Text>
          )}
        </View>
      </View>
    )
  }

  if (allCompleted) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>🎲</Text>
          <Text className='icebreaker__challenge-title'>人格骰子完成</Text>
          <Text className='icebreaker__challenge-desc'>
            {participants.length} 位玩家都完成了自己的专属挑战。
          </Text>
        </Card>
        <Text className='icebreaker__helper-text'>主持人现在可以进入回顾阶段。</Text>
      </View>
    )
  }

  return (
    <View className='icebreaker__challenge'>
      <Card className='icebreaker__challenge-card'>
        <Text className='icebreaker__challenge-emoji'>{currentChallenge?.challengeEmoji ?? '🎲'}</Text>
        <Text className='icebreaker__challenge-title'>
          {currentChallenge?.displayName ?? '玩家'} 的挑战
        </Text>
        <Text className='icebreaker__challenge-desc'>
          {currentChallenge?.challengeTitle ?? '挑战准备中'}
        </Text>
        {currentChallenge?.challengeBody ? (
          <Text className='icebreaker__challenge-hint'>{currentChallenge.challengeBody}</Text>
        ) : null}
        <View className='icebreaker__challenge-meta'>
          <Text className='icebreaker__challenge-duration'>
            {currentPlayerIndex + 1} / {challenges.length}
          </Text>
          <Text className='icebreaker__challenge-completed'>
            ✅ {completedBy.length} 人已完成
          </Text>
        </View>
      </Card>

      <View className='icebreaker__action-stack'>
        {isMyChallenge && !hasCompleted ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onComplete}
            disabled={isCompleting}
            loading={isCompleting}
          >
            {isCompleting ? '提交中…' : '我完成了挑战'}
          </Button>
        ) : null}

        {isMyChallenge && hasCompleted ? (
          <Text className='icebreaker__helper-text'>已记录你的挑战完成状态，等待其他玩家完成。</Text>
        ) : null}

        {!isMyChallenge ? (
          <Text className='icebreaker__helper-text'>等待 {currentChallenge?.displayName ?? '当前玩家'} 完成挑战…</Text>
        ) : null}
      </View>
    </View>
  )
}

function FallbackPhaseView({
  phase,
  isHost,
  onAdvance,
}: {
  phase: SessionPhase
  isHost: boolean
  onAdvance: () => void
}) {
  return (
    <View className='icebreaker__challenge'>
      <Card className='icebreaker__challenge-card'>
        <Text className='icebreaker__challenge-emoji'>🧩</Text>
        <Text className='icebreaker__challenge-title'>{getPhaseLabel(phase)}</Text>
        <Text className='icebreaker__challenge-desc'>这个阶段暂时使用精简版展示。</Text>
      </Card>

      {isHost ? (
        <Button variant='primary' className='icebreaker__action-btn' onClick={onAdvance}>
          继续下一步
        </Button>
      ) : (
        <Text className='icebreaker__helper-text'>等待主持人推进当前阶段。</Text>
      )}
    </View>
  )
}

function RecapPhaseView({
  recapData,
  summary,
  medals,
  playerCount,
  onLeave,
}: {
  recapData: {
    topicsDiscussed: string[]
    challengesCompleted: number
    lieDetectiveWinner?: string
    funMoments: string[]
  } | null
  summary: {
    headline?: string
    moments?: string[]
    closingLine?: string
  } | null
  medals: Array<{
    emoji: string
    title: string
    recipientDisplayName: string
    description: string
  }>
  playerCount: number
  onLeave: () => void
}) {
  const recapMoments = summary?.moments ?? recapData?.funMoments ?? []

  return (
    <View className='icebreaker__recap'>
      <Card className='icebreaker__recap-card'>
        <Text className='icebreaker__recap-emoji'>✨</Text>
        <Text className='icebreaker__recap-title'>破冰回顾</Text>
        {summary?.headline ? (
          <Text className='icebreaker__recap-subtitle'>{summary.headline}</Text>
        ) : null}
        <Text className='icebreaker__recap-subtitle'>
          今晚 {playerCount} 人一起度过了愉快的破冰时光！
        </Text>
        {summary?.closingLine ? (
          <Text className='icebreaker__recap-subtitle'>{summary.closingLine}</Text>
        ) : null}
      </Card>

      {(recapData || medals.length > 0 || recapMoments.length > 0) && (
        <View className='icebreaker__recap-details'>
          {medals.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>🏅 今晚奖项</Text>
              {medals.map((medal) => (
                <Text key={`${medal.title}-${medal.recipientDisplayName}`} className='icebreaker__recap-item'>
                  {medal.emoji} {medal.title} · {medal.recipientDisplayName} · {medal.description}
                </Text>
              ))}
            </Card>
          )}

          {recapData?.topicsDiscussed.length ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                💬 讨论话题
              </Text>
              {recapData.topicsDiscussed.map((topic, i) => (
                <Text key={i} className='icebreaker__recap-item'>
                  • {topic}
                </Text>
              ))}
            </Card>
          ) : null}

          {(recapData?.challengesCompleted ?? 0) > 0 ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                ⚡ 完成挑战
              </Text>
              <Text className='icebreaker__recap-stat'>
                {recapData?.challengesCompleted} 个挑战
              </Text>
            </Card>
          ) : null}

          {recapData?.lieDetectiveWinner ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                🕵️ 最佳侦探
              </Text>
              <Text className='icebreaker__recap-stat'>
                🏆 {recapData.lieDetectiveWinner}
              </Text>
            </Card>
          ) : null}

          {recapMoments.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                😂 精彩瞬间
              </Text>
              {recapMoments.map((moment, i) => (
                <Text key={i} className='icebreaker__recap-item'>
                  • {moment}
                </Text>
              ))}
            </Card>
          )}
        </View>
      )}

      {!recapData && (
        <Card className='icebreaker__recap-section'>
          <Text className='icebreaker__recap-section-title'>
            感谢参与今晚的破冰！
          </Text>
          <Text className='icebreaker__recap-item'>
            希望你和新朋友们建立了更深的连接 🎉
          </Text>
        </Card>
      )}

      <Button variant='primary' className='icebreaker__recap-leave-btn' onClick={onLeave}>
        返回活动
      </Button>
    </View>
  )
}
