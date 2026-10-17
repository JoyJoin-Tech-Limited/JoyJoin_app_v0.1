import { useEffect, useState, useCallback } from 'react'
import { RootPortal, View, Text } from '@tarojs/components'
import Button from '../../../components/ui/Button'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import { ParticleBurst } from '../../../components/reveal'
import { TapReaction } from '../../../components/gesture'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import WaitingBeat from '../components/WaitingBeat'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { haptics } from '../../../lib/utils/haptics'
import { getSystemReducedMotion } from '../../../lib/utils/accessibility'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import type { SocialContentStatus } from '@shared/socialIcebreaker'
import { useGeneratingLiveCopy } from '../hooks/useGeneratingLiveCopy'
import { buildGroupMirrorAnswerRows } from '../viewModels/phaseProgressionModels'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

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
  /**
   * Wave 3 (contract AC-07): server-owned generation lifecycle for the
   * questions (`groupMirrorContentStatus`), present only while the
   * `icebreakerContentStatusEnabled` flag is on. Undefined → the waiting
   * state renders the pre-Wave-3 static copy unchanged.
   */
  contentStatus?: SocialContentStatus
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
  answers = [],
  submittedUserIds = [],
  revealed = false,
  results,
  playerCount = 1,
  participants = [],
  onAdvance,
  isAdvancing = false,
  questionsMeta,
  contentStatus,
}: GroupMirrorHeroViewProps) {
  const [submitting, setSubmitting] = useState(false)
  const [revealing, setRevealing] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')

  // Wave 3 (AC-07): live 「悦仔正在出题…」 copy while the server reports the
  // questions as generating (flag-gated field; absent → null → static copy).
  const generatingLiveCopy = useGeneratingLiveCopy('group_mirror', contentStatus)
  const [voteMap, setVoteMap] = useState<Record<string, string>>({})
  // Wave 2 (AC-05): one-question-at-a-time stepper (replaces the 18-button wall).
  const [questionIndex, setQuestionIndex] = useState(0)
  const [selectedReaction, setSelectedReaction] = useState<number | null>(null)
  const [showBurst, setShowBurst] = useState(false)
  const [expandedQuestionId, setExpandedQuestionId] = useState<string | null>(null)

  // One short firework on reveal. The wrapper unmounts after 900ms, leaving
  // only the stable one-sided result cards.
  useEffect(() => {
    if (revealed && results && results.length > 0) {
      const reduced = getSystemReducedMotion()
      if (reduced) {
        setShowBurst(false)
        return
      }
      setShowBurst(true)
      const timer = setTimeout(() => setShowBurst(false), 900)
      return () => clearTimeout(timer)
    } else if (!revealed) {
      setShowBurst(false)
      setExpandedQuestionId(null)
    }
  }, [revealed, results])

  const hasSubmitted = userId ? submittedUserIds.includes(userId) : false
  const allSubmitted = submittedUserIds.length >= playerCount
  // Wave 2 (AC-05): stepper derivations — current question + honest progress.
  const answeredCount = questions.filter((q) => voteMap[q.id]).length
  const currentQuestion =
    questions.length > 0 ? questions[Math.min(questionIndex, questions.length - 1)] : undefined

  // Picking a person records the vote and walks to the next unanswered
  // question (wraps to the last question when everything is answered, so the
  // submit CTA + progress stay on screen).
  const handleVoteOption = useCallback(
    (questionId: string, targetUserId: string) => {
      haptics('light')
      setVoteMap((prev) => ({ ...prev, [questionId]: targetUserId }))
      setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))
    },
    [questions.length],
  )

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

  // Wave 2 (AC-10): fake local counts removed — the row keeps the expressive
  // tap (selection + pulse) without fabricating a per-device tally.
  const handleReact = useCallback((index: number) => {
    setSelectedReaction(index)
  }, [])

  // ── Not generated ──
  if (questions.length === 0) {
    return (
      <View className='group-mirror-hero'>
        <PhaseHeroCard
          phase='group_mirror'
          title='群像镜像'
          prompt='匿名投票，看看大家眼中的彼此'
          statusText={generatingLiveCopy ?? (isHost ? '生成问题后开始投票' : '等待主持人生成问题…')}
          actions={
            isHost ? (
              <Button variant='primary' onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
                {isGenerating ? '生成中…' : '生成问题'}
              </Button>
            ) : undefined
          }
        >
          {!isHost ? <WaitingBeat variant='host' /> : null}
          {error ? <View className='group-mirror-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Revealed ──
  if (revealed && results) {
    return (
      <View className='group-mirror-hero'>
        {showBurst && (
          <View className='group-mirror-hero__burst'>
            <ParticleBurst trigger type='confetti' count={24} />
          </View>
        )}
        {expandedQuestionId ? (
          // Wave 2 (AC-12): RootPortal — the detail backdrop must cover the
          // viewport, not the transform-keeping phase shell box.
          <RootPortal>
            <View
              className='group-mirror-hero__detail-backdrop'
              onClick={() => setExpandedQuestionId(null)}
              aria-label='收起全部回答'
            />
          </RootPortal>
        ) : null}
        <PhaseHeroCard
          phase='group_mirror'
          className={expandedQuestionId ? 'group-mirror-hero__card--detail-open' : undefined}
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
          <View className='group-mirror-hero__results'>
            {results.map((r) => {
              const expanded = expandedQuestionId === r.questionId
              const answerRows = buildGroupMirrorAnswerRows({
                questionId: r.questionId,
                answers,
                participants,
              })
              return (
                <View
                  key={r.questionId}
                  className={`group-mirror-hero__result-item ${
                    expanded ? 'group-mirror-hero__result-item--expanded' : ''
                  }`}
                  onClick={(event) => event.stopPropagation()}
                >
                  <View className='group-mirror-hero__result-question-row'>
                    <View className='group-mirror-hero__result-question-copy'>
                      <Text className='group-mirror-hero__card-question'>{r.questionText}</Text>
                    </View>
                    <Button
                      variant='secondary'
                      onClick={() => setExpandedQuestionId(expanded ? null : r.questionId)}
                    >
                      {expanded ? '收起' : '全部回答'}
                    </Button>
                  </View>
                  <View className='group-mirror-hero__result-winner-row'>
                    <View className='group-mirror-hero__result-winner-copy'>
                      <Text className='group-mirror-hero__card-winner'>
                        {r.topTargetDisplayName}
                      </Text>
                    </View>
                    <Text className='group-mirror-hero__card-votes'>
                      {r.voteCount} / {r.totalVotes} 票
                    </Text>
                  </View>
                  {expanded ? (
                    <View className='group-mirror-hero__answer-list'>
                      {answerRows.map((row, index) => (
                        <View
                          key={`${r.questionId}-${row.targetUserId}-${index}`}
                          className='group-mirror-hero__answer-row'
                        >
                          <Text className='group-mirror-hero__answer-voter'>
                            {row.voterDisplayName}
                          </Text>
                          <View className='group-mirror-hero__answer-target'>
                            <Text>{row.targetDisplayName}</Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  ) : null}
                </View>
              )
            })}
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
        prompt='一次一题，选最符合的人 · 答几题都可以'
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
              reactions={REACTIONS}
              onReact={handleReact}
              selectedIndex={selectedReaction ?? undefined}
            />
          </View>
        )}

        {!hasSubmitted && currentQuestion ? (
          <View className='group-mirror-hero__stepper'>
            {/* Wave 2 (AC-05): one question at a time + honest progress.
                Partial submit is allowed, so the copy never demands 每题都选. */}
            <Text className='group-mirror-hero__stepper-progress'>
              {`第 ${questionIndex + 1}/${questions.length} 题 · 已选 ${answeredCount}/${questions.length}`}
            </Text>
            <View key={currentQuestion.id} className='group-mirror-hero__question-block'>
              <Text className='group-mirror-hero__question-text'>{currentQuestion.questionText}</Text>
              <View className='group-mirror-hero__question-options'>
                {participants.map((p) => (
                  <Button
                    key={p.userId}
                    onClick={() => handleVoteOption(currentQuestion.id, p.userId)}
                    variant={voteMap[currentQuestion.id] === p.userId ? 'primary' : 'secondary'}
                  >
                    {p.displayName}
                  </Button>
                ))}
              </View>
            </View>
            <View className='group-mirror-hero__stepper-nav'>
              {questionIndex > 0 ? (
                <View
                  className='group-mirror-hero__stepper-link'
                  hoverClass='group-mirror-hero__stepper-link--pressed'
                  onClick={() => {
                    haptics('light')
                    setQuestionIndex((index) => Math.max(0, index - 1))
                  }}
                  role='button'
                  aria-label='上一题'
                >
                  <Text className='group-mirror-hero__stepper-link-text'>‹ 上一题</Text>
                </View>
              ) : null}
              {questionIndex < questions.length - 1 ? (
                <View
                  className='group-mirror-hero__stepper-link'
                  hoverClass='group-mirror-hero__stepper-link--pressed'
                  onClick={() => {
                    haptics('light')
                    setQuestionIndex((index) => Math.min(questions.length - 1, index + 1))
                  }}
                  role='button'
                  aria-label='下一题'
                >
                  <Text className='group-mirror-hero__stepper-link-text'>下一题 ›</Text>
                </View>
              ) : null}
            </View>
          </View>
        ) : null}
        <PhaseAigcRow meta={questionsMeta} reason='AI 生成群像镜像问题' />
        {error ? <View className='group-mirror-hero__error' role='alert'><Text>{error}</Text></View> : null}
      </PhaseHeroCard>
    </View>
  )
}
