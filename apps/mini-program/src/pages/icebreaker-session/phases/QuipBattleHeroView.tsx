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
import WaitingBeat from '../components/WaitingBeat'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { haptics } from '../../../lib/utils/haptics'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import type { SocialContentStatus } from '@shared/socialIcebreaker'
import { useGeneratingLiveCopy } from '../hooks/useGeneratingLiveCopy'
import { useIcebreakerDraft } from '../hooks/useIcebreakerDraft'
import { buildIcebreakerDraftKey } from '../viewModels/draftPersistence'
import { formatAwayWaitSuffix } from '../viewModels/rejoinCatchUpModel'
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
  /**
   * Wave 3 (contract AC-07): server-owned generation lifecycle for the
   * prompts (`quipContentStatus`), present only while the
   * `icebreakerContentStatusEnabled` flag is on. Undefined → the waiting
   * state renders the pre-Wave-3 static copy unchanged.
   */
  contentStatus?: SocialContentStatus
  /**
   * Wave 2 P1 (contract AC-01): writes ride the page's shared action
   * dispatcher — success syncs + refetches immediately (the post-write
   * `onRefresh` calls are gone), `null` = failure (inline copy below),
   * `undefined` = mutex-skipped.
   */
  onGenerate: () => Promise<unknown>
  onSubmit: (answers: Array<{ promptId: string; answerText: string }>) => Promise<unknown>
  onVote: (votes: Array<{ answerId: string; promptId: string }>) => Promise<unknown>
  isGenerating?: boolean
  isSubmitting?: boolean
  isVoting?: boolean
  /**
   * Wave 2 P1 (contract AC-02b / 补5): away-member displayNames rendered as
   * 「 · 等 {名}（暂离）」 next to the waiting counts.
   */
  awayNames?: string[]
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

// ── AC-03⑤ (sprint icebreaker-polish-p1): pre-submit vote preview step ────
// The stack only walks forward, so a mis-swipe used to be irreversible. The
// 汇总步 below lists every viewed card with its vote state; tapping a row
// flips the vote before submission — swipe stays the fast path, the preview
// is the correction path.

export interface QuipVotePreviewItem {
  /** voteMap key: `${answerUserId}::${promptId}`. */
  key: string
  promptId: string
  promptText: string
  displayName: string
  answerText: string
  voted: boolean
}

export interface QuipVotePreview {
  votedCount: number
  items: QuipVotePreviewItem[]
}

export function buildQuipVotePreview(
  stack: Array<{ prompt: QuipBattlePrompt; answer: QuipBattleAnswer }>,
  voteMap: Record<string, string>,
): QuipVotePreview {
  const items = stack.map(({ prompt, answer }) => {
    const key = `${answer.userId}::${prompt.id}`
    return {
      key,
      promptId: prompt.id,
      promptText: prompt.promptText,
      displayName: answer.displayName,
      answerText: answer.answerText,
      voted: Object.prototype.hasOwnProperty.call(voteMap, key),
    }
  })
  return { votedCount: items.filter((item) => item.voted).length, items }
}

/** Toggle one card's vote in the map (immutable — returns a new map). */
export function toggleQuipVoteInMap(
  voteMap: Record<string, string>,
  key: string,
  promptId: string,
): Record<string, string> {
  if (Object.prototype.hasOwnProperty.call(voteMap, key)) {
    const next = { ...voteMap }
    delete next[key]
    return next
  }
  return { ...voteMap, [key]: promptId }
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
  contentStatus,
  onGenerate,
  onSubmit,
  onVote,
  isGenerating = false,
  isSubmitting = false,
  isVoting = false,
  awayNames = [],
}: QuipBattleHeroViewProps) {
  // P0 E1 (2026-10-20): draft persistence — a host advance / app kill no
  // longer wipes in-progress answers. Restore on mount, debounced write on
  // input, clear on submit success or phase switch (hook unmount).
  const draftKey = socialSessionId && userId
    ? buildIcebreakerDraftKey(socialSessionId, 'quip_battle', userId)
    : null
  const draft = useIcebreakerDraft(draftKey)
  const [answerMap, setAnswerMap] = useState<Record<string, string>>(() => {
    const raw = draft.readDraft()
    if (!raw) return {}
    try {
      const parsed = JSON.parse(raw) as Record<string, string>
      return parsed && typeof parsed === 'object' ? parsed : {}
    } catch {
      return {}
    }
  })
  const [voteMap, setVoteMap] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [showChampion, setShowChampion] = useState(false)
  const [stackIndex, setStackIndex] = useState(0)
  const [burstTrigger, setBurstTrigger] = useState(false)
  const burstTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const [selectedReaction, setSelectedReaction] = useState<number | undefined>()
  // AC-03⑤: pre-submit preview step — expandable 汇总 of my votes, each row
  // tap-to-flip (the correction path the forward-only stack never had).
  const [votePreviewOpen, setVotePreviewOpen] = useState(false)

  // Wave 3 (AC-07): live 「悦仔正在出题…」 copy while the server reports the
  // prompts as generating (flag-gated field; absent → null → static copy).
  const generatingLiveCopy = useGeneratingLiveCopy('quip_battle', contentStatus)

  useEffect(() => {
    return () => {
      if (burstTimeoutRef.current) {
        clearTimeout(burstTimeoutRef.current)
        burstTimeoutRef.current = undefined
      }
    }
  }, [])

  // P0 E1: latest-wins debounced draft write (remount restores above).
  useEffect(() => {
    draft.writeDraftDebounced(JSON.stringify(answerMap))
  }, [answerMap, draft])

  // W3: an opted-out / silent player is appended to the phase completion array
  // (`quipBattleVotedUserIds`) but never submits an answer, so the submit gate
  // must read submitted ∪ completed — otherwise one opt-out deadlocks everyone
  // else on "等待其他玩家". Voting implies submitting, so the union is sound.
  const submittedOrCompleted = new Set([...submittedUserIds, ...votedUserIds])
  const hasSubmitted = userId ? submittedOrCompleted.has(userId) : false
  const hasVoted = userId ? votedUserIds.includes(userId) : false
  const allSubmitted = submittedOrCompleted.size >= playerCount
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

  // AC-01: writes ride the shared dispatcher (props) — success syncs +
  // refetches instantly (the old post-write `onRefresh` is absorbed);
  // `null` = failed (inline copy); `undefined` = mutex-skipped.
  const handleGenerate = async () => {
    setError('')
    const result = await onGenerate()
    if (result === null) setError('题目没生成成功')
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

    setError('')
    const result = await onSubmit(answersToSubmit)
    if (result) {
      draft.clearDraft() // P0 E1: submit success cleans the stored draft
    } else if (result === null) {
      setError('提交没成功，再试一次')
    }
  }

  const handleVote = async () => {
    if (!userId) return
    const votesToSubmit = buildQuipBattleVotes(voteMap)

    setError('')
    const result = await onVote(votesToSubmit)
    if (result === null) setError('投票没成功，再试试')
  }

  // Read-only reveal fetch (contract AC-01 exempts reads); the follow-up
  // onRefresh reconciles the polled state.
  const handleReveal = async () => {
    try {
      await apiRequest({ path: buildSocialPath(socialSessionId, '/quip-battle/results'), method: 'GET' })
      onRefresh?.()
    } catch {
      setError('揭晓遇到小状况')
    }
  }

  const handleSwipeRight = useCallback(() => {
    if (isVoting) return
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
  }, [stackIndex, swipeStack, isVoting])

  const handleSwipeLeft = useCallback(() => {
    if (isVoting) return
    setStackIndex((i) => Math.min(i + 1, swipeStack.length))
  }, [swipeStack.length, isVoting])

  // AC-03⑤: preview derivation + tap-to-flip correction path.
  const votePreview = useMemo(() => buildQuipVotePreview(swipeStack, voteMap), [swipeStack, voteMap])
  const handleToggleVotePreview = useCallback(() => {
    haptics('light')
    setVotePreviewOpen((open) => !open)
  }, [])
  const handlePreviewItemTap = useCallback((key: string, promptId: string) => {
    haptics('light')
    setVoteMap((prev) => toggleQuipVoteInMap(prev, key, promptId))
  }, [])

  // Wave 2 (AC-10): fake local counts removed — expressive taps only.
  const handleReaction = useCallback((index: number) => {
    setSelectedReaction(index)
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
              ? (generatingLiveCopy ?? (isHost
                ? '生成题目后开始作答'
                : '等待主持人生成题目…'))
              : `已提交 ${submittedOrCompleted.size}/${playerCount} 人`
          }
          doneCount={submittedOrCompleted.size}
          totalCount={playerCount}
          actions={
            <>
              {prompts.length === 0 && isHost ? (
                <Button variant='primary' onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
                  {isGenerating ? '生成中…' : '生成题目'}
                </Button>
              ) : null}
              {prompts.length > 0 ? (
                <Button variant='primary' onClick={handleSubmit} disabled={isSubmitting} loading={isSubmitting}>
                  {isSubmitting ? '提交中…' : '提交答案'}
                </Button>
              ) : null}
            </>
          }
        >
          {prompts.length === 0 && !isHost ? <WaitingBeat variant='host' /> : null}
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
            <Button variant='primary' onClick={handleVote} disabled={isVoting || !votingState.canSubmit} loading={isVoting}>
              {isVoting ? '提交中…' : '提交投票'}
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
          {/* AC-03⑤: pre-submit preview step — every viewed card with its
              vote state; tap a row to flip before submitting. Renders only
              once the stack is fully viewed (the 汇总步 gate). */}
          {votingState.canSubmit && votePreview.items.length > 0 ? (
            <View className='quip-battle-hero__vote-preview'>
              <View
                className='quip-battle-hero__vote-preview-toggle'
                hoverClass='quip-battle-hero__vote-preview-toggle--pressed'
                hoverStartTime={0}
                onClick={handleToggleVotePreview}
                role='button'
                aria-expanded={votePreviewOpen}
                aria-label={`你投出 ${votePreview.votedCount} 票，点查看`}
              >
                <Text className='quip-battle-hero__vote-preview-toggle-text'>
                  你投出 {votePreview.votedCount} 票
                </Text>
                <Text className='quip-battle-hero__vote-preview-toggle-hint'>
                  {votePreviewOpen ? '收起' : '点查看'}
                </Text>
              </View>
              {votePreviewOpen ? (
                <View className='quip-battle-hero__vote-preview-list'>
                  {votePreview.items.map((item) => (
                    <View
                      key={item.key}
                      className={`quip-battle-hero__vote-preview-item${item.voted ? ' quip-battle-hero__vote-preview-item--voted' : ''}`}
                      hoverClass='quip-battle-hero__vote-preview-item--pressed'
                      hoverStartTime={0}
                      onClick={() => handlePreviewItemTap(item.key, item.promptId)}
                      role='button'
                      aria-pressed={item.voted}
                      aria-label={`${item.displayName} 的回答，${item.voted ? '已投，点按取消' : '未投，点按投票'}`}
                    >
                      <View className='quip-battle-hero__vote-preview-item-copy'>
                        <Text className='quip-battle-hero__vote-preview-item-prompt'>
                          {item.promptText}
                        </Text>
                        <Text className='quip-battle-hero__vote-preview-item-answer'>
                          {item.displayName}：“{item.answerText}”
                        </Text>
                      </View>
                      <Text className='quip-battle-hero__vote-preview-item-state'>
                        {item.voted ? '已投' : '未投'}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          ) : null}
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
          statusText={`已提交 ${submittedUserIds.length}/${playerCount}${formatAwayWaitSuffix(awayNames)}`}
          doneCount={submittedOrCompleted.size}
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
          statusText={`已投票 ${votedUserIds.length}/${playerCount}${formatAwayWaitSuffix(awayNames)}`}
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
              reactions={REACTIONS}
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
