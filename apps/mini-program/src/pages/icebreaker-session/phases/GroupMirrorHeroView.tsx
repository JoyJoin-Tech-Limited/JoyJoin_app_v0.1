import { useEffect, useState, useMemo, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'
import { CardFlip, IdentityReveal, ParticleBurst } from '../../../components/reveal'
import { TapReaction } from '../../../components/gesture'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { PHASE_ACCENTS } from './phaseAccents'
import { haptics } from '../../../lib/utils/haptics'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import './GroupMirrorHeroView.scss'

interface GroupMirrorHeroViewProps {
  socialSessionId: string
  isHost: boolean
  userId?: string
  questions?: Array<{ id: string; questionText: string; category: string }>
  answers?: Array<{ userId: string; displayName: string; questionId: string; targetUserId: string; reasonText?: string }>
  submittedUserIds?: string[]
  revealed?: boolean
  results?: Array<{
    questionId: string
    questionText: string
    topTargetUserId: string
    topTargetDisplayName: string
    voteCount: number
    totalVotes: number
  }>
  playerCount?: number
  participants?: Array<{ userId: string; displayName?: string }>
  onAdvance?: () => void
  isAdvancing?: boolean
  questionsMeta?: AIResponseMeta
}

const REACTIONS = [
  { emoji: '👏', label: '鼓掌' },
  { emoji: '🔥', label: '火力' },
  { emoji: '😮', label: '哇哦' },
  { emoji: '🌹', label: '玫瑰' },
]

export function GroupMirrorHeroView({
  socialSessionId,
  isHost,
  userId,
  questions = [],
  answers: _answers = [],
  submittedUserIds = [],
  revealed = false,
  results,
  playerCount = 1,
  participants = [],
  onAdvance,
  isAdvancing = false,
  questionsMeta,
}: GroupMirrorHeroViewProps) {
  const [submitting, setSubmitting] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [voteMap, setVoteMap] = useState<Record<string, string>>({})
  const [showResult, setShowResult] = useState(false)

  const [selectedReaction, setSelectedReaction] = useState<number | null>(null)
  const [reactionCounts, setReactionCounts] = useState<Record<number, number>>({})
  const [flippedMap, setFlippedMap] = useState<Record<string, boolean>>({})
  const [showIdentity, setShowIdentity] = useState(false)
  const [showBurst, setShowBurst] = useState(false)
  const [burstKey, setBurstKey] = useState(0)

  useEffect(() => {
    if (revealed && results && results.length > 0) {
      setShowResult(true)
    }
  }, [revealed, results])

  // Signature wow: mirror flip-sync — result cards half-flip in sync,
  // staggered, then the overall winner spotlight lands.
  // RM: everything lands instantly (no stagger, no burst).
  useEffect(() => {
    if (revealed && results && results.length > 0) {
      const reduced = getSystemReducedMotion()
      if (reduced) {
        const instant: Record<string, boolean> = {}
        results.forEach((r) => {
          instant[r.questionId] = true
        })
        setFlippedMap(instant)
        setShowIdentity(true)
        setShowBurst(false)
        return
      }

      setFlippedMap({})
      setShowIdentity(false)
      setShowBurst(false)

      const timers: ReturnType<typeof setTimeout>[] = []
      results.forEach((r, index) => {
        timers.push(setTimeout(() => {
          setFlippedMap((prev) => ({ ...prev, [r.questionId]: true }))
        }, index * 300))
      })

      const totalDelay = results.length * 300 + 400
      timers.push(setTimeout(() => setShowIdentity(true), totalDelay))
      timers.push(setTimeout(() => {
        setShowBurst(true)
        setBurstKey((k) => k + 1)
      }, totalDelay + 300))

      return () => {
        timers.forEach(clearTimeout)
      }
    } else if (!revealed) {
      setFlippedMap({})
      setShowIdentity(false)
      setShowBurst(false)
    }
  }, [revealed, results])

  const hasSubmitted = userId ? submittedUserIds.includes(userId) : false
  const allSubmitted = submittedUserIds.length >= playerCount

  const overallWinner = useMemo(() => {
    if (!results || results.length === 0) return null
    const agg = new Map<string, { displayName: string; totalVotes: number }>()
    for (const r of results) {
      const existing = agg.get(r.topTargetUserId)
      if (existing) {
        existing.totalVotes += r.voteCount
      } else {
        agg.set(r.topTargetUserId, { displayName: r.topTargetDisplayName, totalVotes: r.voteCount })
      }
    }
    let top: { userId: string; displayName: string; totalVotes: number } | null = null
    for (const [uid, data] of agg) {
      if (!top || data.totalVotes > top.totalVotes) {
        top = { userId: uid, displayName: data.displayName, totalVotes: data.totalVotes }
      }
    }
    return top
  }, [results])

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/group-mirror/generate'), method: 'POST' })
    } catch {
      setError('问题没生成成功')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!userId) return
    const answersToSubmit = questions
      .map((q) => ({ questionId: q.id, targetUserId: voteMap[q.id] }))
      .filter((a) => a.targetUserId)

    if (answersToSubmit.length === 0) {
      setError('先回答一个问题吧')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/group-mirror/submit'),
        method: 'POST',
        data: { answers: answersToSubmit },
      })
    } catch {
      setError('提交没成功，再试一次')
    } finally {
      setSubmitting(false)
    }
  }

  const handleReveal = async () => {
    if (!isHost) return
    setRevealing(true)
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/group-mirror/reveal'), method: 'POST' })
    } catch {
      setError('揭晓遇到小状况')
    } finally {
      setRevealing(false)
    }
  }

  const handleReact = useCallback((index: number) => {
    setSelectedReaction(index)
    setReactionCounts((prev) => ({
      ...prev,
      [index]: (prev[index] ?? 0) + 1,
    }))
  }, [])

  // ── Not generated ──
  if (questions.length === 0) {
    return (
      <View className='group-mirror-hero'>
        <PhaseHeroCard
          phase='group_mirror'
          title='群像镜像'
          prompt='匿名投票，看看大家眼中的彼此'
          statusText={isHost ? '生成问题后开始投票' : '等待主持人生成问题…'}
          actions={
            isHost ? (
              <Button variant='primary' onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
                {isGenerating ? '生成中…' : '生成问题'}
              </Button>
            ) : undefined
          }
        >
          {error ? <View className='group-mirror-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Revealed ──
  if (revealed && results) {
    const topResult = results[0]
    return (
      <View className='group-mirror-hero'>
        <CelebrationOverlay
          visible={showResult}
          frameKey='mirror_result'
          title='群像揭晓'
          subtitle={topResult ? `${topResult.topTargetDisplayName} · ${topResult.voteCount} 票` : undefined}
          autoDismissMs={3000}
          onDismiss={() => setShowResult(false)}
        />
        {showBurst && (
          <View className='group-mirror-hero__burst'>
            <ParticleBurst key={burstKey} trigger={showBurst} type='roses' count={50} spotlightColor={PHASE_ACCENTS.group_mirror?.accent} />
          </View>
        )}
        <PhaseHeroCard
          phase='group_mirror'
          title='群像镜像 · 揭晓'
          statusText='看看大家眼中的彼此'
          actions={
            isHost && onAdvance ? (
              <Button variant='primary' onClick={onAdvance} disabled={isAdvancing} loading={isAdvancing}>
                {isAdvancing ? '切换中…' : '进入下一阶段 ›'}
              </Button>
            ) : undefined
          }
        >
          {overallWinner && (
            <View className='group-mirror-hero__identity'>
              <IdentityReveal
                identity={overallWinner.displayName}
                label='大家眼中的 TA'
                revealed={showIdentity}
                spotlightColor={PHASE_ACCENTS.group_mirror?.accentDeep ?? '#35755C'}
                tone='warm'
                warmAccent='rgba(95, 168, 143, 0.45)'
              />
            </View>
          )}

          <View className='group-mirror-hero__results'>
            {results.map((r) => (
              <View key={r.questionId} className='group-mirror-hero__result-item'>
                <CardFlip
                  front={
                    <View className='group-mirror-hero__card-front'>
                      <Text className='group-mirror-hero__card-question'>{r.questionText}</Text>
                      <Text className='group-mirror-hero__card-hint'>点击揭晓</Text>
                    </View>
                  }
                  back={
                    <View className='group-mirror-hero__card-back'>
                      <Text className='group-mirror-hero__card-winner'>{r.topTargetDisplayName}</Text>
                      <Text className='group-mirror-hero__card-votes'>
                        {r.voteCount} / {r.totalVotes} 票
                      </Text>
                    </View>
                  }
                  flipped={!!flippedMap[r.questionId]}
                  duration={400}
                />
              </View>
            ))}
          </View>
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Voting / submitting ──
  return (
    <View className='group-mirror-hero'>
      <PhaseHeroCard
        phase='group_mirror'
        title='群像镜像'
        prompt='为每个问题选择最符合的人 · 投票是匿名的'
        statusText={
          hasSubmitted
            ? `已提交，等待其他人… ${submittedUserIds.length}/${playerCount}`
            : `已提交 ${submittedUserIds.length}/${playerCount} 人`
        }
        doneCount={submittedUserIds.length}
        totalCount={playerCount}
        actions={
          <>
            {hasSubmitted ? null : (
              <Button variant='primary' onClick={handleSubmit} disabled={submitting}>
                {submitting ? '提交中…' : '提交投票'}
              </Button>
            )}
            {isHost && allSubmitted ? (
              <Button variant='primary' onClick={handleReveal} disabled={revealing}>
                {revealing ? '揭晓中…' : '揭晓结果'}
              </Button>
            ) : null}
          </>
        }
      >
        {!hasSubmitted && !revealed && (
          <View className='group-mirror-hero__reactions'>
            <TapReaction
              reactions={REACTIONS.map((r, i) => ({
                ...r,
                count: reactionCounts[i] ?? 0,
              }))}
              onReact={handleReact}
              selectedIndex={selectedReaction ?? undefined}
            />
          </View>
        )}

        {!hasSubmitted && (
          <View className='group-mirror-hero__questions'>
            {questions.map((q) => (
              <View key={q.id} className='group-mirror-hero__question-block'>
                <Text className='group-mirror-hero__question-text'>{q.questionText}</Text>
                <View className='group-mirror-hero__question-options'>
                  {participants.map((p) => (
                    <Button
                      key={p.userId}
                      onClick={() => {
                        haptics('light')
                        setVoteMap((prev) => ({ ...prev, [q.id]: p.userId }))
                      }}
                      variant={voteMap[q.id] === p.userId ? 'primary' : 'secondary'}
                    >
                      {p.displayName}
                    </Button>
                  ))}
                </View>
              </View>
            ))}
          </View>
        )}
        <PhaseAigcRow meta={questionsMeta} reason='AI 生成群像镜像问题' />
        {error ? <View className='group-mirror-hero__error' role='alert'><Text>{error}</Text></View> : null}
      </PhaseHeroCard>
    </View>
  )
}
