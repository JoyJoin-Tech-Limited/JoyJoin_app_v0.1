import { useState, useCallback, useEffect, useRef } from 'react'
import { View, Text, ScrollView } from '@tarojs/components'
import Taro, { useRouter } from '@tarojs/taro'
import { useQuery, useMutation } from '@tanstack/react-query'
import { apiRequest } from '../../lib/api'
import { useAuthGuard } from '../../hooks/useAuthGuard'
import { useAuth } from '../../hooks/useAuth'
import { useWebSocket } from '../../hooks/useWebSocket'
import { logInfo, logError } from '../../lib/logger'
import LoadingScreen from '../../components/LoadingScreen'
import Card from '../../components/Card'
import Button from '../../components/Button'
import type { WSMessage } from '@shared/wsEvents'
import type {
  SocialSessionState,
  SocialIcebreakerPhase,
  LieDetectivePlayer,
  LieDetectiveVote,
  LieDetectiveReveal,
} from '@shared/socialIcebreaker'
import './index.scss'

// ─── Types ────────────────────────────────────────────────────────

/**
 * Page-local phase type that includes UI-only states (`waiting`, `ended`)
 * absent from the shared `SocialIcebreakerPhase` union.
 */
type SessionPhase =
  | 'waiting'
  | SocialIcebreakerPhase
  | 'ended'

/**
 * Shape returned by the session GET endpoints.
 * Extends the shared contract with fields the page needs.
 */
interface IcebreakerSession extends SocialSessionState {
  id: string
  eventId: string
  phase: SessionPhase
  [key: string]: unknown
}

interface SessionParticipant {
  userId: string
  displayName?: string
  isHost?: boolean
  isOnline?: boolean
  [key: string]: unknown
}

// ─── Helpers ──────────────────────────────────────────────────────

/** Map a SocialSessionState from the API to our local IcebreakerSession. */
function normaliseSession(raw: Record<string, unknown>): IcebreakerSession {
  return {
    ...raw,
    id: (raw.socialSessionId ?? raw.icebreakerSessionId ?? raw.id ?? '') as string,
    eventId: (raw.eventId ?? '') as string,
    phase: (raw.currentPhase ?? raw.phase ?? 'waiting') as SessionPhase,
  } as IcebreakerSession
}

/** Get a display label for a phase. */
function getPhaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case 'waiting': return '等待中'
    case 'warmup': return '🌅 热身'
    case 'micro_challenge': return '⚡ 挑战'
    case 'lie_detective': return '🕵️ 谎言侦探'
    case 'recap': return '✨ 回顾'
    case 'ended': return '已结束'
    default: return phase
  }
}

/** Build a list of participant-like objects from session state. */
function deriveParticipants(session: IcebreakerSession, hostId?: string): SessionParticipant[] {
  // The server may embed participants in various shapes; normalise
  if (Array.isArray((session as Record<string, unknown>).participants)) {
    return ((session as Record<string, unknown>).participants as SessionParticipant[]).map((p) => ({
      ...p,
      isHost: p.userId === hostId,
    }))
  }

  // Fallback: build a minimal list from lieDetectivePlayers or warmupReadyUserIds
  const ids = new Set<string>()
  session.lieDetectivePlayers?.forEach((p) => ids.add(p.userId))
  session.warmupReadyUserIds?.forEach((id) => ids.add(id))
  if (hostId) ids.add(hostId)

  return Array.from(ids).map((userId) => ({
    userId,
    displayName: session.lieDetectivePlayers?.find((p) => p.userId === userId)?.displayName,
    isHost: userId === hostId,
  }))
}

// ─── Component ────────────────────────────────────────────────────

export default function IcebreakerSessionPage() {
  const router = useRouter()
  const routeSessionId = router.params.sessionId ?? ''
  const routeEventId = router.params.eventId ?? ''
  const { isLoading: authLoading } = useAuthGuard()
  const { user } = useAuth()
  const currentUserId = user?.id ?? ''

  // ── Resolve session ID from eventId if needed ───────────────────
  const {
    data: eventSession,
    isLoading: eventSessionLoading,
    error: eventSessionError,
  } = useQuery<Record<string, unknown>>({
    queryKey: ['mini-program', 'event-session', routeEventId],
    queryFn: () =>
      apiRequest<Record<string, unknown>>({
        path: `/api/events/${encodeURIComponent(routeEventId)}/session`,
      }),
    enabled: !!routeEventId && !routeSessionId && !authLoading,
  })

  // Determine the effective session ID
  const resolvedSessionId =
    routeSessionId ||
    (eventSession?.socialSessionId as string) ||
    (eventSession?.id as string) ||
    ''

  // ── Fetch session details ───────────────────────────────────────
  const {
    data: rawSession,
    isLoading: sessionLoading,
    error: sessionError,
  } = useQuery<Record<string, unknown>>({
    queryKey: ['mini-program', 'icebreaker-session', resolvedSessionId],
    queryFn: () =>
      apiRequest<Record<string, unknown>>({
        path: `/api/icebreaker/session/${encodeURIComponent(resolvedSessionId)}`,
      }),
    enabled: !!resolvedSessionId && !authLoading,
    // Re-fetch when navigating back in case phase changed
    staleTime: 0,
  })

  // ── Normalise session ───────────────────────────────────────────
  const [session, setSession] = useState<IcebreakerSession | null>(null)

  useEffect(() => {
    if (rawSession) {
      setSession(normaliseSession(rawSession))
      logInfo('[IcebreakerSession] Session loaded', { id: resolvedSessionId })
    }
  }, [rawSession, resolvedSessionId])

  // ── WebSocket ───────────────────────────────────────────────────
  const handleWSMessage = useCallback(
    (message: WSMessage) => {
      logInfo('[IcebreakerSession] WS message', { type: message.type })

      switch (message.type) {
        case 'SOCIAL_PHASE_CHANGED': {
          const data = message.data as Record<string, unknown> | undefined
          if (data) {
            setSession((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                ...(data as Partial<IcebreakerSession>),
                phase: (data.phase ?? prev.phase) as SessionPhase,
                currentPhase: (data.phase ?? prev.currentPhase) as SocialIcebreakerPhase,
              }
            })
          }
          break
        }
        case 'SOCIAL_PULSE_UPDATE': {
          // Pulse updates are informational; store for display if desired
          logInfo('[IcebreakerSession] Pulse update', message.data as Record<string, unknown>)
          break
        }
        case 'SOCIAL_LIE_VOTE_UPDATE': {
          const data = message.data as Record<string, unknown> | undefined
          if (data && session) {
            setSession((prev) => {
              if (!prev) return prev
              return {
                ...prev,
                votes: (data.votes ?? prev.votes) as LieDetectiveVote[] | undefined,
                currentLieDetectiveReveal: data.isRevealed
                  ? ({
                      targetUserId: (prev.lieDetectivePlayers?.[prev.currentLieDetectivePlayerIndex ?? 0]?.userId ?? ''),
                      lieIndex: data.lieIndex as number,
                      voteCount: (data.votes as LieDetectiveVote[] | undefined)?.length ?? 0,
                      correctVoteCount: 0,
                      revealedAt: Date.now(),
                    } satisfies LieDetectiveReveal)
                  : prev.currentLieDetectiveReveal,
              }
            })
          }
          break
        }
        default:
          break
      }
    },
    [session],
  )

  const { send, state: wsState } = useWebSocket({
    eventTypes: [
      'SOCIAL_PHASE_CHANGED',
      'SOCIAL_PULSE_UPDATE',
      'SOCIAL_LIE_VOTE_UPDATE',
    ],
    onMessage: handleWSMessage,
  })

  // ── Derived state ───────────────────────────────────────────────
  const phase: SessionPhase = session?.phase ?? 'waiting'
  const hostUserId = session?.hostUserId ?? ''
  const isHost = !!currentUserId && currentUserId === hostUserId
  const participants = session ? deriveParticipants(session, hostUserId) : []
  const playerCount = session?.playerCount ?? participants.length

  // ── Lie detective local vote state ──────────────────────────────
  const [myVoteIndex, setMyVoteIndex] = useState<number | null>(null)
  const hasVotedRef = useRef(false)

  // Reset vote state on player change
  useEffect(() => {
    setMyVoteIndex(null)
    hasVotedRef.current = false
  }, [session?.currentLieDetectivePlayerIndex])

  // ── Actions ─────────────────────────────────────────────────────

  /** Host advances to the next phase via WS. */
  const handleAdvancePhase = useCallback(() => {
    if (!isHost || !resolvedSessionId) return
    logInfo('[IcebreakerSession] Advancing phase', { sessionId: resolvedSessionId })
    send({
      type: 'SOCIAL_PHASE_ADVANCE',
      sessionId: resolvedSessionId,
      socialSessionId: session?.socialSessionId ?? resolvedSessionId,
    })
  }, [isHost, resolvedSessionId, send, session?.socialSessionId])

  /** Submit a lie-detective vote. */
  const voteMutation = useMutation({
    mutationFn: async (guessedStatementIndex: number) => {
      const targetPlayer =
        session?.lieDetectivePlayers?.[session?.currentLieDetectivePlayerIndex ?? 0]
      if (!targetPlayer) throw new Error('No target player')

      send({
        type: 'SOCIAL_LIE_VOTE',
        sessionId: resolvedSessionId,
        socialSessionId: session?.socialSessionId ?? resolvedSessionId,
        targetUserId: targetPlayer.userId,
        guessedStatementIndex,
      })
    },
    onSuccess: () => {
      logInfo('[IcebreakerSession] Vote submitted')
    },
    onError: (err) => {
      logError('[IcebreakerSession] Vote failed', {
        error: err instanceof Error ? err.message : 'unknown',
      })
      Taro.showToast({ title: '投票失败，请重试', icon: 'none', duration: 2000 })
      // Allow re-vote on failure
      hasVotedRef.current = false
      setMyVoteIndex(null)
    },
  })

  const handleCastVote = useCallback(
    (statementIndex: number) => {
      if (hasVotedRef.current || voteMutation.isPending) return
      hasVotedRef.current = true
      setMyVoteIndex(statementIndex)
      voteMutation.mutate(statementIndex)
    },
    [voteMutation],
  )

  const handleGoBack = useCallback(() => {
    Taro.navigateBack({
      fail: () => Taro.switchTab({ url: '/pages/events/index' }),
    })
  }, [])

  // ── Loading ─────────────────────────────────────────────────────
  if (authLoading || eventSessionLoading || sessionLoading) {
    return <LoadingScreen message='加载破冰游戏…' />
  }

  // ── Error ───────────────────────────────────────────────────────
  if (eventSessionError || sessionError || !session) {
    return (
      <View className='icebreaker icebreaker--error'>
        <View className='icebreaker__error'>
          <Text className='icebreaker__error-icon'>😕</Text>
          <Text className='icebreaker__error-text'>
            {eventSessionError ? '无法加入破冰会话' : '加载破冰游戏失败'}
          </Text>
          <Button variant='secondary' className='icebreaker__error-btn' onClick={handleGoBack}>
            返回
          </Button>
        </View>
      </View>
    )
  }

  // ── Phase header (shared across all phases) ─────────────────────
  const phaseHeader = (
    <View className='icebreaker__header'>
      <View className='icebreaker__phase-badge'>
        <Text className='icebreaker__phase-label'>{getPhaseLabel(phase)}</Text>
      </View>
      {playerCount > 0 && (
        <Text className='icebreaker__player-count'>
          👥 {playerCount} 人参与
        </Text>
      )}
      {wsState !== 'connected' && (
        <View className='icebreaker__offline-badge'>
          <Text className='icebreaker__offline-text'>连接中…</Text>
        </View>
      )}
    </View>
  )

  // ── Host controls ───────────────────────────────────────────────
  const hostControls = isHost && phase !== 'recap' && phase !== 'ended' && phase !== 'waiting' && (
    <View className='icebreaker__host-controls'>
      <View className='icebreaker__host-badge'>
        <Text className='icebreaker__host-badge-text'>👑 你是主持人</Text>
      </View>
      <Button
        variant='primary'
        className='icebreaker__advance-btn'
        onClick={handleAdvancePhase}
      >
        下一阶段
      </Button>
    </View>
  )

  return (
    <ScrollView className='icebreaker' scrollY enhanced showScrollbar={false}>
      {phaseHeader}

      {/* ── Waiting Phase ──────────────────────────────────────── */}
      {phase === 'waiting' && (
        <WaitingPhase
          playerCount={playerCount}
          hostName={session?.hostDisplayName}
          isHost={isHost}
          onAdvance={handleAdvancePhase}
        />
      )}

      {/* ── Warmup Phase ───────────────────────────────────────── */}
      {phase === 'warmup' && session && (
        <WarmupPhaseView
          topics={session.warmupTopics ?? []}
          currentIndex={session.currentTopicIndex ?? 0}
          readyUserIds={session.warmupReadyUserIds ?? []}
          participants={participants}
          currentUserId={currentUserId}
        />
      )}

      {/* ── Micro Challenge Phase ──────────────────────────────── */}
      {phase === 'micro_challenge' && session && (
        <MicroChallengePhaseView
          challenge={session.currentChallenge ?? null}
          completedBy={session.challengeCompletedBy ?? []}
          currentUserId={currentUserId}
        />
      )}

      {/* ── Lie Detective Phase ────────────────────────────────── */}
      {phase === 'lie_detective' && session && (
        <LieDetectivePhaseView
          players={session.lieDetectivePlayers ?? []}
          currentPlayerIndex={session.currentLieDetectivePlayerIndex ?? 0}
          votes={session.votes ?? []}
          reveal={session.currentLieDetectiveReveal ?? null}
          currentUserId={currentUserId}
          myVoteIndex={myVoteIndex}
          onVote={handleCastVote}
          isVoting={voteMutation.isPending}
        />
      )}

      {/* ── Recap Phase ────────────────────────────────────────── */}
      {(phase === 'recap' || phase === 'ended') && session && (
        <RecapPhaseView
          recapData={session.recapData ?? null}
          playerCount={playerCount}
          onLeave={handleGoBack}
        />
      )}

      {hostControls}

      <View className='icebreaker__spacer' />
    </ScrollView>
  )
}

// ─── Sub-components ───────────────────────────────────────────────
// Kept in the same file for MVP simplicity; can be extracted later.

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
}: {
  topics: Array<{ question: string; emoji?: string; mood?: string }>
  currentIndex: number
  readyUserIds: string[]
  participants: SessionParticipant[]
  currentUserId: string
}) {
  const currentTopic = topics[currentIndex]
  const isReady = readyUserIds.includes(currentUserId)

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
    </View>
  )
}

function MicroChallengePhaseView({
  challenge,
  completedBy,
  currentUserId,
}: {
  challenge: { title: string; description: string; durationSeconds: number; completionCTA: string; visualHint?: string } | null
  completedBy: string[]
  currentUserId: string
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
    </View>
  )
}

function LieDetectivePhaseView({
  players,
  currentPlayerIndex,
  votes,
  reveal,
  currentUserId,
  myVoteIndex,
  onVote,
  isVoting,
}: {
  players: LieDetectivePlayer[]
  currentPlayerIndex: number
  votes: LieDetectiveVote[]
  reveal: LieDetectiveReveal | null
  currentUserId: string
  myVoteIndex: number | null
  onVote: (index: number) => void
  isVoting: boolean
}) {
  const currentPlayer = players[currentPlayerIndex]
  const isOwnTurn = currentPlayer?.userId === currentUserId
  const hasVoted = myVoteIndex !== null
  const isRevealed = !!reveal

  if (!currentPlayer) {
    return (
      <View className='icebreaker__detective'>
        <Card className='icebreaker__detective-card'>
          <Text className='icebreaker__detective-emoji'>🕵️</Text>
          <Text className='icebreaker__detective-waiting'>
            等待玩家提交陈述…
          </Text>
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
                if (!isOwnTurn && !hasVoted && !isVoting && !isRevealed) {
                  onVote(stmt.index)
                }
              }}
            >
              <View className='icebreaker__statement-header'>
                <Text className='icebreaker__statement-index'>
                  {stmt.index}
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
            <Text className='icebreaker__detective-voted'>✅ 已投票，等待揭晓…</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex === myVoteIndex && (
            <Text className='icebreaker__detective-correct'>🎉 猜对了！</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex !== myVoteIndex && (
            <Text className='icebreaker__detective-wrong'>😅 猜错了</Text>
          )}
        </View>
      )}

      {/* Progress indicator */}
      <Text className='icebreaker__detective-progress'>
        {currentPlayerIndex + 1} / {players.length} 位玩家
      </Text>
    </View>
  )
}

function RecapPhaseView({
  recapData,
  playerCount,
  onLeave,
}: {
  recapData: {
    topicsDiscussed: string[]
    challengesCompleted: number
    lieDetectiveWinner?: string
    funMoments: string[]
  } | null
  playerCount: number
  onLeave: () => void
}) {
  return (
    <View className='icebreaker__recap'>
      <Card className='icebreaker__recap-card'>
        <Text className='icebreaker__recap-emoji'>✨</Text>
        <Text className='icebreaker__recap-title'>破冰回顾</Text>
        <Text className='icebreaker__recap-subtitle'>
          今晚 {playerCount} 人一起度过了愉快的破冰时光！
        </Text>
      </Card>

      {recapData && (
        <View className='icebreaker__recap-details'>
          {recapData.topicsDiscussed.length > 0 && (
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
          )}

          {recapData.challengesCompleted > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                ⚡ 完成挑战
              </Text>
              <Text className='icebreaker__recap-stat'>
                {recapData.challengesCompleted} 个挑战
              </Text>
            </Card>
          )}

          {recapData.lieDetectiveWinner && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                🕵️ 最佳侦探
              </Text>
              <Text className='icebreaker__recap-stat'>
                🏆 {recapData.lieDetectiveWinner}
              </Text>
            </Card>
          )}

          {recapData.funMoments.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                😂 精彩瞬间
              </Text>
              {recapData.funMoments.map((moment, i) => (
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
