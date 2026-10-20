import { useEffect, useState, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Button from '../../../components/ui/Button'
import { CardFlip, IdentityReveal, ParticleBurst } from '../../../components/reveal'
import { SwipeCard, TapReaction } from '../../../components/gesture'
import { haptics } from '../../../lib/utils/haptics'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { useIcebreakerDraft } from '../hooks/useIcebreakerDraft'
import { buildIcebreakerDraftKey } from '../viewModels/draftPersistence'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { PHASE_ACCENTS } from './phaseAccents'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import type { SocialContentStatus } from '@shared/socialIcebreaker'
import { useGeneratingLiveCopy } from '../hooks/useGeneratingLiveCopy'
import { formatAwayWaitSuffix } from '../viewModels/rejoinCatchUpModel'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

interface UndercoverWordHeroViewProps {
  socialSessionId: string
  isHost: boolean
  userId?: string
  pair?: { civilianWord: string; undercoverWord: string; category: string } | null
  undercoverUserId?: string
  rounds?: Array<{ roundNumber: number; descriptions: Array<{ userId: string; displayName: string; text: string }> }>
  currentRound?: number
  votes?: Array<{ voterId: string; targetUserId: string }>
  votedUserIds?: string[]
  revealed?: boolean
  results?: {
    undercoverUserId: string
    undercoverDisplayName: string
    civilianWord: string
    undercoverWord: string
    voteCounts: Record<string, number>
    caught: boolean
  } | null
  playerCount?: number
  participants?: Array<{ userId: string; displayName?: string }>
  onAdvance?: () => void
  isAdvancing?: boolean
  pairMeta?: AIResponseMeta
  /**
   * W3: viewers who opted out / were auto-completed this phase. They are
   * appended to `undercoverWordVotedUserIds` server-side but never describe, so
   * they must count toward the describe gate or one opt-out blocks the host's
   * 进入投票. Only explicit markers are unioned (NOT round votes — that array is
   * reused across rounds).
   */
  completedUserIds?: string[]
  /**
   * Wave 3 (contract AC-07): server-owned generation lifecycle for the word
   * pair (`undercoverContentStatus`), present only while the
   * `icebreakerContentStatusEnabled` flag is on. Undefined → the waiting
   * state renders the pre-Wave-3 static copy unchanged.
   */
  contentStatus?: SocialContentStatus
  /**
   * Wave 2 P1 (contract AC-01): every write rides the page's shared action
   * dispatcher (`performSocialAction`) — success syncs + refetches
   * immediately, failures resolve `null` (the view keeps its inline error
   * copy), `undefined` means the mutex skipped the tap.
   */
  onGenerate: () => Promise<unknown>
  onDescribe: (text: string) => Promise<unknown>
  onVote: (targetUserId: string) => Promise<unknown>
  onReveal: () => Promise<unknown>
  isGenerating?: boolean
  isSubmitting?: boolean
  isVoting?: boolean
  isRevealing?: boolean
  /**
   * Wave 2 P1 (contract AC-02b / 补5): displayNames of away members —
   * rendered as 「 · 等 {名}（暂离）」 next to the waiting counts. Empty when
   * the flag is off / nobody is away.
   */
  awayNames?: string[]
}

const REACTION_ITEMS = [
  { emoji: '😂', label: '好笑' },
  { emoji: '🤔', label: '疑惑' },
  { emoji: '🔥', label: '精彩' },
  { emoji: '👏', label: '点赞' },
]

// P0 ① (2026-10-20): the identity card never auto-flips. A tap peeks; the
// peek auto-closes after 5s with a 300ms shrink/dim warning (transform /
// opacity only). Reduced-motion collapses the warning into a direct close.
const WORD_CARD_AUTO_CLOSE_MS = 5000
const WORD_CARD_WARN_BEFORE_CLOSE_MS = 300

export function UndercoverWordHeroView({
  socialSessionId,
  isHost,
  userId,
  pair,
  undercoverUserId,
  rounds = [],
  currentRound = 0,
  votes: _votes = [],
  votedUserIds = [],
  revealed = false,
  results,
  playerCount = 1,
  participants = [],
  onAdvance,
  isAdvancing = false,
  pairMeta,
  completedUserIds = [],
  contentStatus,
  onGenerate,
  onDescribe,
  onVote,
  onReveal,
  isGenerating = false,
  isSubmitting = false,
  isVoting = false,
  isRevealing = false,
  awayNames = [],
}: UndercoverWordHeroViewProps) {
  // P0 E1 (2026-10-20): description draft — restore on mount, debounced
  // write on input, clear on submit success or phase switch.
  const draftKey = socialSessionId && userId
    ? buildIcebreakerDraftKey(socialSessionId, 'undercover_word', userId)
    : null
  const draft = useIcebreakerDraft(draftKey)
  const [description, setDescription] = useState(() => draft.readDraft() ?? '')
  const [error, setError] = useState('')
  const [selectedTarget, setSelectedTarget] = useState('')
  const [showSecret, setShowSecret] = useState(false)

  const [cardFlipped, setCardFlipped] = useState(false)
  const [cardFlipWarn, setCardFlipWarn] = useState(false)
  const [inputFocused, setInputFocused] = useState(false)
  const [selectedReaction, setSelectedReaction] = useState<number | null>(null)
  const [burstTriggered, setBurstTriggered] = useState(false)
  const { shouldReduceMotion } = useMiniRevealMotion()

  // Wave 3 (AC-07): live 「悦仔正在想词…」 copy while the server reports the
  // word pair as generating (flag-gated field; absent → null → static copy).
  const generatingLiveCopy = useGeneratingLiveCopy('undercover_word', contentStatus)

  // ── Derived ──
  const isUndercover = userId === undercoverUserId
  const myWord = isUndercover ? pair?.undercoverWord : pair?.civilianWord
  const currentRoundData = rounds[currentRound]
  const hasSubmittedDesc = currentRoundData?.descriptions.some((d) => d.userId === userId)
  const hasVoted = userId ? votedUserIds.includes(userId) : false
  // W3: opted-out / silent players count toward the describe gate (they will
  // never describe) without reading round votes, which are reused across rounds.
  const describedUserIds = new Set([
    ...(currentRoundData?.descriptions.map((d) => d.userId) ?? []),
    ...completedUserIds,
  ])
  const allDescribed = currentRoundData ? describedUserIds.size >= playerCount : false
  const allVoted = votedUserIds.length >= playerCount
  const describedCount = currentRoundData ? describedUserIds.size : 0

  // ── Effects ──
  // P0 ①: pair (re)issue resets the card to face-down — never auto-flip.
  // Remount / re-show also lands face-down (useState initial), closing the
  // word-reminder plaintext backdoor the 500ms auto-flip used to open in the
  // describe / vote states (the same card renders there).
  useEffect(() => {
    setCardFlipped(false)
    setCardFlipWarn(false)
  }, [pair])

  // P0 ①: peek lifecycle — 5s auto-close with a 300ms shrink/dim warning;
  // reduced-motion skips the warning and closes directly. Manual toggles
  // cancel the schedule via the cleanup.
  useEffect(() => {
    if (!cardFlipped) return
    if (shouldReduceMotion) {
      const closeTimer = setTimeout(() => setCardFlipped(false), WORD_CARD_AUTO_CLOSE_MS)
      return () => clearTimeout(closeTimer)
    }
    const warnTimer = setTimeout(
      () => setCardFlipWarn(true),
      WORD_CARD_AUTO_CLOSE_MS - WORD_CARD_WARN_BEFORE_CLOSE_MS,
    )
    const closeTimer = setTimeout(() => {
      setCardFlipped(false)
      setCardFlipWarn(false)
    }, WORD_CARD_AUTO_CLOSE_MS)
    return () => {
      clearTimeout(warnTimer)
      clearTimeout(closeTimer)
    }
  }, [cardFlipped, shouldReduceMotion])

  const handleWordCardFlip = useCallback(() => {
    haptics('light')
    setCardFlipped((f) => !f)
    setCardFlipWarn(false)
  }, [])

  // P0 E1: latest-wins debounced draft write for the description input.
  useEffect(() => {
    draft.writeDraftDebounced(description)
  }, [description, draft])

  // Signature wow: unmask sheen fires with the reveal (CSS handles the sweep)
  useEffect(() => {
    if (revealed && results) {
      setShowSecret(true)
      setBurstTriggered(true)
    }
  }, [revealed, results])

  // ── Handlers ──
  // AC-01: every write goes through the shared dispatcher (props) — success
  // syncs + refetches instantly; `null` = failed (inline copy below);
  // `undefined` = mutex-skipped (ack toast already shown by the dispatcher).
  const handleGenerate = async () => {
    setError('')
    const result = await onGenerate()
    if (result === null) setError('词对没生成成功')
  }

  const handleDescribe = async () => {
    if (!userId || !description.trim()) return
    setError('')
    const result = await onDescribe(description.trim())
    if (result) {
      setDescription('')
      draft.clearDraft() // P0 E1: submit success cleans the stored draft
    } else if (result === null) {
      setError('提交没成功，再试一次')
    }
  }

  const handleVote = async () => {
    if (!userId || !selectedTarget) return
    setError('')
    const result = await onVote(selectedTarget)
    if (result === null) setError('投票没成功，再试试')
  }

  const handleReveal = async () => {
    if (!isHost) return
    setError('')
    const result = await onReveal()
    if (result === null) setError('揭晓遇到小状况')
  }

  // Wave 2 (AC-10): fake local counts removed — expressive taps only.
  const handleReact = useCallback((index: number) => {
    setSelectedReaction(index)
  }, [])

  // AC-03④: the vote target row is selectable by TAP as well as by swipe —
  // the swipe gesture stays, but accessibility / iOS gesture conflicts never
  // strand a voter. Tapping the selected row again deselects (mirrors the
  // left-swipe clear).
  const handleSwipeSelect = useCallback((targetId: string) => {
    haptics('light')
    setSelectedTarget(targetId)
  }, [])

  const handleTapSelect = useCallback((targetId: string) => {
    haptics('light')
    setSelectedTarget((current) => (current === targetId ? '' : targetId))
  }, [])

  const getDescriptionsForUser = (targetUserId: string) => {
    const out: string[] = []
    for (const r of rounds) {
      const d = r.descriptions.find((x) => x.userId === targetUserId)
      if (d) out.push(`第${r.roundNumber}轮：${d.text}`)
    }
    return out
  }

  const wordCard = (
    <View className={`undercover-hero__word-card${cardFlipped && cardFlipWarn ? ' undercover-hero__word-card--warn' : ''}`}>
      <CardFlip
        front={
          <View className='undercover-hero__word-front'>
            <JoyJoinIcon emoji='🕵️' tier='phase' size={56} />
            <Text className='undercover-hero__word-front-title'>你的身份是？</Text>
            <Text className='undercover-hero__word-front-hint'>轻触查看，看完记得翻回</Text>
          </View>
        }
        back={
          <View className={`undercover-hero__word-back${isUndercover ? ' undercover-hero__word-back--undercover' : ''}`}>
            <Text className='undercover-hero__word-back-word'>{myWord || '?'}</Text>
            <View className={`undercover-hero__word-back-pill${isUndercover ? ' undercover-hero__word-back-pill--undercover' : ''}`}>
              <Text className='undercover-hero__word-back-pill-text'>{isUndercover ? '卧底' : '平民'}</Text>
            </View>
            <Text className='undercover-hero__word-back-hint'>{isUndercover ? '不要暴露自己' : '找出卧底'}</Text>
          </View>
        }
        flipped={cardFlipped}
        onFlip={handleWordCardFlip}
        duration={400}
      />
    </View>
  )

  // ══ State 0 — waiting for pair ══
  if (!pair) {
    return (
      <View className='undercover-hero'>
        <PhaseHeroCard
          phase='undercover_word'
          title='谁是卧底'
          prompt='描述你的词，找出卧底'
          statusText={generatingLiveCopy ?? (isHost ? '生成词对后开始' : '等待主持人生成词对…')}
          actions={
            isHost ? (
              <Button variant='primary' onClick={handleGenerate} disabled={isGenerating} loading={isGenerating}>
                {isGenerating ? '生成中…' : '生成词对'}
              </Button>
            ) : undefined
          }
        />
        {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
      </View>
    )
  }

  // ══ State 4 — revealed ══
  if (revealed && results) {
    return (
      <View className='undercover-hero'>
        <IdentityReveal
          identity={results.undercoverDisplayName}
          label='卧底身份曝光'
          revealed={showSecret}
          spotlightColor={PHASE_ACCENTS.undercover_word?.accent}
        />
        {showSecret && (
          <View className='undercover-hero__burst'>
            <ParticleBurst
              trigger={burstTriggered}
              type={results.caught ? 'confetti' : 'roses'}
              spotlightColor={results.caught ? '#5FA88F' : '#E67E22'}
              count={48}
            />
          </View>
        )}

        <PhaseHeroCard
          phase='undercover_word'
          title={`卧底是：${results.undercoverDisplayName}`}
          prompt={`平民词：${results.civilianWord} · 卧底词：${results.undercoverWord}`}
          statusText={results.caught ? '卧底被抓住了！' : '卧底成功隐藏！'}
          actions={
            isHost && onAdvance ? (
              <Button variant='primary' onClick={onAdvance} disabled={isAdvancing} loading={isAdvancing}>
                {isAdvancing ? '切换中…' : '进入下一阶段 ›'}
              </Button>
            ) : undefined
          }
        >
          {/* Unmask sheen: one sweep across the identity card, then gone */}
          <View className='undercover-hero__identity-card'>
            <View className='undercover-hero__sheen' aria-hidden='true' />
            <View className='undercover-hero__vote-rows'>
              {participants.map((p) => (
                <View key={p.userId} className='undercover-hero__vote-row'>
                  <Text className='undercover-hero__vote-name'>{p.displayName}</Text>
                  <Text className='undercover-hero__vote-count'><Text className='undercover-hero__numeral'>{results.voteCounts[p.userId] || 0}</Text> 票</Text>
                </View>
              ))}
            </View>
          </View>
                  {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ══ State 3 — voting ══
  if (allDescribed && currentRound >= 1) {
    return (
      <View className='undercover-hero'>
        <PhaseHeroCard
          phase='undercover_word'
          title='投票环节'
          prompt='谁最有可能是卧底？'
          statusText={
            hasVoted
              ? `已投票，等待其他人… ${votedUserIds.length}/${playerCount}${formatAwayWaitSuffix(awayNames)}`
              : '右滑或点选目标'
          }
          doneCount={votedUserIds.length}
          totalCount={playerCount}
          actions={
            <>
              {!hasVoted ? (
                <Button variant='primary' onClick={handleVote} disabled={!selectedTarget || isVoting} loading={isVoting}>
                  {isVoting ? '提交中…' : selectedTarget ? '提交投票' : '请选择目标'}
                </Button>
              ) : null}
              {isHost && allVoted ? (
                <Button variant='primary' onClick={handleReveal} disabled={isRevealing} loading={isRevealing}>
                  {isRevealing ? '揭晓中…' : '揭晓结果'}
                </Button>
              ) : null}
            </>
          }
        >
          <View className='undercover-hero__word-reminder'>{wordCard}</View>

          {!hasVoted && (
            <View className='undercover-hero__targets'>
              {participants.map((p) => {
                const descs = getDescriptionsForUser(p.userId)
                const isSelected = selectedTarget === p.userId
                return (
                  <SwipeCard
                    key={p.userId}
                    onSwipeRight={() => handleSwipeSelect(p.userId)}
                    onSwipeLeft={() => setSelectedTarget('')}
                    threshold={0.35}
                  >
                    <View
                      className={`undercover-hero__target${isSelected ? ' undercover-hero__target--selected' : ''}`}
                      onClick={() => handleTapSelect(p.userId)}
                      hoverClass='undercover-hero__target--pressed'
                      hoverStartTime={0}
                      role='button'
                      aria-label={`投票给${p.displayName ?? '这位玩家'}`}
                    >
                      <View className='undercover-hero__target-avatar'>
                        <Text className='undercover-hero__target-avatar-text'>{(p.displayName || '?')[0]}</Text>
                      </View>
                      <View className='undercover-hero__target-info'>
                        <Text className='undercover-hero__target-name'>{p.displayName}</Text>
                        {descs.length > 0 && (
                          <Text className='undercover-hero__target-descs'>
                            {descs.join(' · ')}
                          </Text>
                        )}
                      </View>
                      {isSelected && (
                        <View className='undercover-hero__target-check'>
                          <JoyJoinIcon className='undercover-hero__target-check-icon' emoji='✓' tier='status' size={24} />
                        </View>
                      )}
                    </View>
                  </SwipeCard>
                )
              })}
            </View>
          )}
                  {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ══ State 2 — describing ══
  return (
    <View className='undercover-hero'>
      <PhaseHeroCard
        phase='undercover_word'
        title={`谁是卧底 · 第${currentRound + 1}轮`}
        statusText={
          hasSubmittedDesc
            ? `已提交，等待其他人… ${describedCount}/${playerCount}${formatAwayWaitSuffix(awayNames)}`
            : `已描述 ${describedCount}/${playerCount} 人`
        }
        doneCount={describedCount}
        totalCount={playerCount}
        actions={
          <>
            {!hasSubmittedDesc ? (
              <Button variant='primary' onClick={handleDescribe} disabled={!description.trim() || isSubmitting} loading={isSubmitting}>
                {isSubmitting ? '提交中…' : '提交描述'}
              </Button>
            ) : null}
            {isHost && allDescribed ? (
              <Button variant='primary' onClick={handleReveal} disabled={isRevealing} loading={isRevealing}>
                {isRevealing ? '处理中…' : currentRound >= 1 ? '进入投票' : '下一轮'}
              </Button>
            ) : null}
          </>
        }
      >
        <View className='undercover-hero__word-reminder'>{wordCard}</View>

        {currentRoundData && currentRoundData.descriptions.length > 0 && (
          <View className='undercover-hero__desc-list'>
            {currentRoundData.descriptions.map((d, i) => (
              <View key={i} className='undercover-hero__desc-item'>
                <Text className='undercover-hero__desc-name'>{d.displayName}</Text>
                <Text className='undercover-hero__desc-text'>“{d.text}”</Text>
              </View>
            ))}
          </View>
        )}

        <View className='undercover-hero__reactions'>
          <TapReaction
            reactions={REACTION_ITEMS}
            onReact={handleReact}
            selectedIndex={selectedReaction ?? undefined}
          />
        </View>

        {!hasSubmittedDesc && (
          <Input
            placeholder='用一句话描述你的词（不要直接说词）'
            value={description}
            onInput={(e) => setDescription(e.detail.value.slice(0, 100))}
            maxlength={100}
            onFocus={() => setInputFocused(true)}
            onBlur={() => setInputFocused(false)}
            className={`undercover-hero__input${inputFocused ? ' undercover-hero__input--focused' : ''}`}
          />
        )}
        <PhaseAigcRow meta={pairMeta} reason='AI 生成卧底词对' />
        {error ? <View className='undercover-hero__error' role='alert'><Text>{error}</Text></View> : null}
        </PhaseHeroCard>
    </View>
  )
}
