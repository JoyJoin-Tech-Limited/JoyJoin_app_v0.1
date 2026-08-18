import { useEffect, useState, useMemo, useCallback, useRef } from 'react'
import { View, Text, Input } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import { apiRequest } from '../../../lib/api/api'
import { buildSocialPath } from '../icebreakerSessionModel'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'
import { SwipeCard, TapReaction } from '../../../components/gesture'
import { ParticleBurst } from '../../../components/reveal'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { haptics } from '../../../lib/utils/haptics'
import type { AIResponseMeta } from '@shared/types/aiMeta'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

interface QuipBattlePrompt {
  id: string
  promptText: string
  category: string
}

interface QuipBattleAnswer {
  userId: string
  displayName: string
  answerText: string
  promptId: string
}

interface QuipBattleResult {
  promptId: string
  promptText: string
  answers: QuipBattleAnswer[]
  winnerUserId: string
  winnerDisplayName: string
  voteCount: number
}

interface QuipBattleHeroViewProps {
  socialSessionId: string
  isHost: boolean
  prompts?: QuipBattlePrompt[]
  answers?: QuipBattleAnswer[]
  results?: QuipBattleResult[]
  revealed?: boolean
  submittedUserIds?: string[]
  votedUserIds?: string[]
  userId?: string
  playerCount?: number
  onRefresh?: () => void
  onAdvance?: () => void
  isAdvancing?: boolean
  promptsMeta?: AIResponseMeta
}

const REACTIONS = [
  { emoji: '😂', label: '好笑' },
  { emoji: '🔥', label: '绝了' },
  { emoji: '👏', label: '鼓掌' },
  { emoji: '🌹', label: '玫瑰' },
]

export function buildQuipBattleVotingState(stackIndex: number, cardCount: number) {
  const safeCardCount = Math.max(0, cardCount)
  const viewedCount = Math.min(Math.max(0, stackIndex), safeCardCount)
  const displayedCard = safeCardCount === 0
    ? 0
    : Math.min(viewedCount + 1, safeCardCount)

  return {
    canSubmit: viewedCount >= safeCardCount,
    statusText: `卡片 ${displayedCard}/${safeCardCount}`,
    viewedCount,
  }
}

export function buildQuipBattleVotes(voteMap: Record<string, string>) {
  return Object.entries(voteMap).map(([answerId, promptId]) => ({
    answerId,
    promptId,
  }))
}

export function QuipBattleHeroView({
  socialSessionId,
  isHost,
  prompts = [],
  answers = [],
  results = [],
  revealed = false,
  submittedUserIds = [],
  votedUserIds = [],
  userId,
  playerCount = 1,
  onRefresh,
  onAdvance,
  isAdvancing = false,
  promptsMeta,
}: QuipBattleHeroViewProps) {
  const [answerMap, setAnswerMap] = useState<Record<string, string>>({})
  const [voteMap, setVoteMap] = useState<Record<string, string>>({})
  const [submitting, setSubmitting] = useState(false)
  const [voting, setVoting] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [error, setError] = useState('')
  const [showChampion, setShowChampion] = useState(false)
  const [stackIndex, setStackIndex] = useState(0)
  const [burstTrigger, setBurstTrigger] = useState(false)
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [reactionCounts, setReactionCounts] = useState<number[]>([0, 0, 0, 0])
  const [selectedReaction, setSelectedReaction] = useState<number | undefined>()

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current) {
        clearTimeout(burstTimeoutRef.current)
        burstTimeoutRef.current = undefined
      }
    }
  }, [])

  const hasSubmitted = userId ? submittedUserIds.includes(userId) : false
  const hasVoted = userId ? votedUserIds.includes(userId) : false
  const allSubmitted = submittedUserIds.length >= playerCount
  const allVoted = votedUserIds.length >= playerCount

  const championResult = revealed && results.length > 0 ? results[0] : null

  const swipeStack = useMemo(() => {
    const stack: { prompt: QuipBattlePrompt; answer: QuipBattleAnswer }[] = []
    for (const prompt of prompts) {
      const promptAnswers = answers.filter((a) => a.promptId === prompt.id)
      for (const answer of promptAnswers) {
        stack.push({ prompt, answer })
      }
    }
    return stack
  }, [prompts, answers])

  useEffect(() => {
    if (hasSubmitted && allSubmitted && !hasVoted && !revealed) {
      setStackIndex(0)
    }
  }, [hasSubmitted, allSubmitted, hasVoted, revealed])

  useEffect(() => {
    if (revealed && championResult) {
      setShowChampion(true)
    }
  }, [revealed, championResult])

  const handleAnswerChange = (promptId: string, text: string) => {
    setAnswerMap((prev) => ({ ...prev, [promptId]: text.slice(0, 100) }))
  }

  const handleGenerate = async () => {
    setIsGenerating(true)
    setError('')
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/quip-battle/generate'), method: 'POST' })
      onRefresh?.()
    } catch {
      setError('题目没生成成功')
    } finally {
      setIsGenerating(false)
    }
  }

  const handleSubmit = async () => {
    if (!userId) return
    const answersToSubmit = prompts
      .map((p) => ({ promptId: p.id, answerText: answerMap[p.id] || '' }))
      .filter((a) => a.answerText.trim().length > 0)

    if (answersToSubmit.length === 0) {
      setError('先回答一个题目吧')
      return
    }

    setSubmitting(true)
    setError('')
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/quip-battle/submit'),
        method: 'POST',
        data: { answers: answersToSubmit },
      })
      onRefresh?.()
    } catch {
      setError('提交没成功，再试一次')
    } finally {
      setSubmitting(false)
    }
  }

  const handleVote = async () => {
    if (!userId) return
    const votesToSubmit = buildQuipBattleVotes(voteMap)

    setVoting(true)
    setError('')
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/quip-battle/vote'),
        method: 'POST',
        data: { votes: votesToSubmit },
      })
      onRefresh?.()
    } catch {
      setError('投票没成功，再试试')
    } finally {
      setVoting(false)
    }
  }

  const handleReveal = async () => {
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/quip-battle/results'), method: 'GET' })
      onRefresh?.()
    } catch {
      setError('揭晓遇到小状况')
    }
  }

  const handleSwipeRight = useCallback(() => {
    const current = swipeStack[stackIndex]
    if (!current) return
    haptics('light')

    setVoteMap((prev) => ({
      ...prev,
      [`${current.answer.userId}::${current.prompt.id}`]: current.prompt.id,
    }))

    setBurstTrigger(true)
    if (burstTimeoutRef.current) clearTimeout(burstTimeoutRef.current)
    burstTimeoutRef.current = setTimeout(() => setBurstTrigger(false), 300)

    setStackIndex((i) => Math.min(i + 1, swipeStack.length))
  }, [stackIndex, swipeStack])

  const handleSwipeLeft = useCallback(() => {
    setStackIndex((i) => Math.min(i + 1, swipeStack.length))
  }, [swipeStack.length])

  const handleReaction = useCallback((index: number) => {
    setSelectedReaction(index)
    setReactionCounts((prev) => {
      const next = [...prev]
      next[index] = (next[index] || 0) + 1
      return next
    })
  }, [])

  const bestOfAnswers = useMemo(() => {
    if (!revealed || results.length === 0) return []
    const allAnswers: {
      promptText: string
      displayName: string
      answerText: string
      voteCount: number
      isWinner: boolean
    }[] = []
    for (const result of results) {
      for (const answer of result.answers) {
        const isWinner = answer.userId === result.winnerUserId
        allAnswers.push({
          promptText: result.promptText,
          displayName: answer.displayName,
          answerText: answer.answerText,
          voteCount: isWinner ? result.voteCount : 0,
          isWinner,
        })
      }
    }
    return allAnswers
      .sort((a, b) => (b.isWinner ? 1 : 0) - (a.isWinner ? 1 : 0) || b.voteCount - a.voteCount)
      .slice(0, 3)
  }, [revealed, results])

  // ── Phase 1: submit answers ──
  if (!hasSubmitted && !revealed) {
    return (
      <View className='quip-battle-hero'>
        <PhaseHeroCard
          phase='quip_battle'
          title='机智对决'
          prompt='填空造句，秀出你的脑洞 · 答案会对全桌公开'
          statusText={
            prompts.length === 0
              ? isHost
                ? '生成题目后开始作答'
                : '等待主持人生成题目…'
              : `已提交 ${submittedUserIds.length}/${playerCount} 人`
          }
          doneCount={submittedUserIds.length}
          totalCount={playerCount}
          actions={
            <>
              {prompts.length === 0 && isHost ? (
                <Button variant='primary' onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
                  {isGenerating ? '生成中…' : '生成题目'}
                </Button>
              ) : null}
              {prompts.length > 0 ? (
                <Button variant='primary' onClick={handleSubmit} disabled={submitting}>
                  {submitting ? '提交中…' : '提交答案'}
                </Button>
              ) : null}
            </>
          }
        >
          {prompts.length > 0 && (
            <View className='quip-battle-hero__prompts'>
              {prompts.map((prompt, i) => (
                <View key={prompt.id} className='quip-battle-hero__prompt-card'>
                  <Text className='quip-battle-hero__prompt-label'>题目 {i + 1}</Text>
                  <Text className='quip-battle-hero__prompt-text'>{prompt.promptText}</Text>
                  <Input
                    className='quip-battle-hero__input'
                    placeholder='填入你的神回复…'
                    value={answerMap[prompt.id] || ''}
                    onInput={(e) => handleAnswerChange(prompt.id, e.detail.value)}
                    maxlength={100}
                  />
                  <Text className='quip-battle-hero__char-count'>
                    {(answerMap[prompt.id] || '').length}/100
                  </Text>
                </View>
              ))}
            </View>
          )}
          {prompts.length > 0 ? <PhaseAigcRow meta={promptsMeta} reason='AI 生成机智对决题目' /> : null}
          {error ? <View className='quip-battle-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Phase 2: voting (swipe stack) ──
  if (hasSubmitted && allSubmitted && !hasVoted && !revealed) {
    const currentCard = swipeStack[stackIndex]
    const votingState = buildQuipBattleVotingState(stackIndex, swipeStack.length)

    return (
      <View className='quip-battle-hero'>
        <View className='quip-battle-hero__burst'>
          <ParticleBurst trigger={burstTrigger} type='confetti' count={30} fill />
        </View>
        <PhaseHeroCard
          phase='quip_battle'
          title='投票环节'
          prompt='右滑投票，左滑跳过'
          statusText={votingState.statusText}
          doneCount={votingState.viewedCount}
          totalCount={swipeStack.length}
          actions={
            <Button variant='primary' onClick={handleVote} disabled={voting || !votingState.canSubmit}>
              {voting ? '投票中…' : '提交投票'}
            </Button>
          }
        >
          {currentCard ? (
            <View className='quip-battle-hero__stack'>
              <SwipeCard onSwipeRight={handleSwipeRight} onSwipeLeft={handleSwipeLeft} threshold={0.35}>
                <View className='quip-battle-hero__stack-card'>
                  <Text className='quip-battle-hero__stack-prompt'>{currentCard.prompt.promptText}</Text>
                  <Text className='quip-battle-hero__stack-author'>{currentCard.answer.displayName}</Text>
                  <Text className='quip-battle-hero__stack-answer'>“{currentCard.answer.answerText}”</Text>
                </View>
              </SwipeCard>
            </View>
          ) : (
            <Text className='quip-battle-hero__stack-done'>
              所有卡片已浏览，可以提交投票
            </Text>
          )}
          {error ? <View className='quip-battle-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Phase 3: waiting for others ──
  if (hasSubmitted && !allSubmitted && !revealed) {
    return (
      <View className='quip-battle-hero'>
        <PhaseHeroCard
          phase='quip_battle'
          title='等待其他玩家'
          statusText={`已提交 ${submittedUserIds.length}/${playerCount}`}
          doneCount={submittedUserIds.length}
          totalCount={playerCount}
          actions={
            isHost ? (
              <Button variant='secondary' onClick={onRefresh}>刷新状态</Button>
            ) : undefined
          }
        />
      </View>
    )
  }

  if (hasVoted && !revealed) {
    return (
      <View className='quip-battle-hero'>
        <PhaseHeroCard
          phase='quip_battle'
          title='等待投票'
          statusText={`已投票 ${votedUserIds.length}/${playerCount}`}
          doneCount={votedUserIds.length}
          totalCount={playerCount}
          actions={
            isHost && allVoted ? (
              <Button variant='primary' onClick={handleReveal}>揭晓结果</Button>
            ) : undefined
          }
        />
      </View>
    )
  }

  // ── Phase 4: results ──
  if (revealed && results.length > 0) {
    return (
      <View className='quip-battle-hero'>
        <CelebrationOverlay
          visible={showChampion}
          frameKey='quip_champion'
          title='本轮冠军'
          subtitle={championResult ? `${championResult.winnerDisplayName} · ${championResult.voteCount} 票` : undefined}
          autoDismissMs={3000}
          onDismiss={() => setShowChampion(false)}
        />
        <PhaseHeroCard
          phase='quip_battle'
          title='揭晓时刻'
          prompt='看看谁的脑洞最大'
          statusText='本轮结果已揭晓'
          actions={
            isHost && onAdvance ? (
              <Button variant='primary' onClick={onAdvance} disabled={isAdvancing} loading={isAdvancing}>
                {isAdvancing ? '切换中…' : '进入下一阶段 ›'}
              </Button>
            ) : undefined
          }
        >
          <View className='quip-battle-hero__results'>
            {results.map((result, i) => (
              <View key={result.promptId} className='quip-battle-hero__result-card'>
                <Text className='quip-battle-hero__prompt-label'>题目 {i + 1}</Text>
                <Text className='quip-battle-hero__prompt-text'>{result.promptText}</Text>
                {result.answers.map((answer) => {
                  const isWinner = answer.userId === result.winnerUserId
                  return (
                    <View
                      key={answer.userId}
                      className={`quip-battle-hero__answer${isWinner ? ' quip-battle-hero__answer--winner' : ''}`}
                    >
                      {isWinner && <View className='quip-battle-hero__answer-ring' aria-hidden='true' />}
                      <Text className='quip-battle-hero__answer-author'>
                        {answer.displayName}{isWinner ? '（冠军）' : ''}
                      </Text>
                      <Text className='quip-battle-hero__answer-text'>&quot;{answer.answerText}&quot;</Text>
                    </View>
                  )
                })}
                {result.winnerDisplayName ? (
                  <Text className='quip-battle-hero__winner-banner'>
                    最佳回复：{result.winnerDisplayName}（{result.voteCount}票）
                  </Text>
                ) : null}
              </View>
            ))}
          </View>

          {bestOfAnswers.length > 0 && (
            <View className='quip-battle-hero__best-of'>
              <View className='quip-battle-hero__best-of-title-row'>
                <JoyJoinIcon emoji='🏆' size={28} />
                <Text className='quip-battle-hero__best-of-title'>最佳回复 TOP 3</Text>
              </View>
              {bestOfAnswers.map((item, idx) => (
                <View key={`${item.displayName}-${idx}`} className='quip-battle-hero__best-of-card'>
                  <Text className='quip-battle-hero__best-of-rank'>
                    TOP {idx + 1}{item.isWinner ? ' · 冠军' : ''}
                  </Text>
                  <Text className='quip-battle-hero__best-of-author'>{item.displayName}</Text>
                  <Text className='quip-battle-hero__best-of-text'>“{item.answerText}”</Text>
                  <Text className='quip-battle-hero__best-of-votes'>
                    题目：{item.promptText}{item.voteCount > 0 ? ` · ${item.voteCount} 票` : ''}
                  </Text>
                </View>
              ))}
            </View>
          )}

          <View className='quip-battle-hero__reaction-row'>
            <TapReaction
              reactions={REACTIONS.map((r, i) => ({ ...r, count: reactionCounts[i] }))}
              onReact={handleReaction}
              selectedIndex={selectedReaction}
            />
          </View>
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Fallback ──
  return (
    <View className='quip-battle-hero'>
      <PhaseHeroCard
        phase='quip_battle'
        title='机智对决'
        prompt='准备开始…'
        actions={
          isHost && prompts.length === 0 ? (
            <Button variant='primary' onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
              {isGenerating ? '生成中…' : '生成题目'}
            </Button>
          ) : undefined
        }
      />
    </View>
  )
}
