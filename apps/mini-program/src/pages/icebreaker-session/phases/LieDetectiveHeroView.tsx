import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, Input, Textarea } from '@tarojs/components'
import type {
  LieDetectivePlayer,
  LieDetectiveReveal,
  LieDetectiveVote,
} from '@shared/socialIcebreaker'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import Button from '../../../components/ui/Button'
import { haptics } from '../../../lib/utils/haptics'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import WaitingBeat from '../components/WaitingBeat'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { resolveReadyParticipantIds } from '../viewModels/phaseOptOutModel'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

// ─── Minimal client-side profanity guard (subset of server filter) ──────────
const SENSITIVE_KEYWORDS = [
  '傻逼', '操你妈', '草泥马', '你妈死了', '去死', '滚蛋', '废物',
  '垃圾', '白痴', '智障', '脑残', '神经病', '变态', '恶心',
  '约炮', '一夜情', '做爱', '性交', '口交', '肛交', '自慰', '手淫',
  '嫖娼', '卖淫', '援交', '包养', '小三', '出轨',
  '杀人', '谋杀', '自杀', '枪击', '爆炸', '恐怖袭击', '绑架', '强奸',
  '毒品', '冰毒', '海洛因', '大麻', '赌博', '洗钱', '诈骗',
]

function checkProfanity(text: string): boolean {
  const lower = text.toLowerCase()
  return SENSITIVE_KEYWORDS.some((kw) => lower.includes(kw))
}

export interface LieDetectiveHeroViewProps {
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
  onGenerateStatements: (statements?: string[], lieIndex?: number) => void
  isGeneratingStatements: boolean
  isHost: boolean
  canMoveToNextPlayer: boolean
  onNextPlayer: () => void
  isMovingNextPlayer: boolean
  onAdvance: () => void
  isAdvancing: boolean
  onGenerateFromTag: (tag: string) => Promise<string | null>
  isGeneratingFromTag: boolean
  statementsMeta?: AIResponseMeta
  /**
   * W3: players who opted out / were auto-completed this phase. The server
   * appends them to `lieDetectiveCompletedUserIds`, so counting them here keeps
   * the ready counter honest and avoids a separate pass badge.
   */
  completedUserIds?: string[]
  /** W3 (AC-W3.4): late joiner refused by the phase-entry roster snapshot. */
  rosterLocked?: boolean
}

export function LieDetectiveHeroView({
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
  onAdvance,
  isAdvancing,
  onGenerateFromTag,
  isGeneratingFromTag,
  statementsMeta,
  completedUserIds,
  rosterLocked = false,
}: LieDetectiveHeroViewProps) {
  const completedSet = new Set(completedUserIds ?? [])
  const { readyCount } = resolveReadyParticipantIds(
    players.map((player) => player.userId),
    completedUserIds,
  )
  const everyoneGenerated = playerCount > 0 && readyCount >= playerCount
  const currentPlayer = players[currentPlayerIndex]
  const isOwnTurn = currentPlayer?.userId === currentUserId
  const hasVoted = myVoteIndex !== null
  const isRevealed = !!reveal

  // ── Signature wow: statement flip-to-reveal on vote completion ────────────
  const prevRevealedRef = useRef(false)
  const [flipIn, setFlipIn] = useState(false)
  useEffect(() => {
    if (isRevealed && !prevRevealedRef.current) {
      setFlipIn(true)
      const timer = setTimeout(() => setFlipIn(false), 900)
      prevRevealedRef.current = true
      return () => clearTimeout(timer)
    }
    if (!isRevealed) {
      prevRevealedRef.current = false
    }
  }, [isRevealed])

  // ── Wave 2 (AC-04): two-step compose — write (AI first, handwrite secondary)
  //    then pick the lie on a SEPARATE screen. Replaces the old 3行×4控件
  //    dual-path tiling. ──
  const [composeStep, setComposeStep] = useState<'choose' | 'edit' | 'lie'>('choose')
  const [assistTags, setAssistTags] = useState(['', '', ''])
  const [assistOpenRow, setAssistOpenRow] = useState<number | null>(null)
  const [generatingRow, setGeneratingRow] = useState<number | null>(null)
  const [customStatements, setCustomStatements] = useState(['', '', ''])
  const [customLieIndex, setCustomLieIndex] = useState<number | null>(null)
  // AI prefill lands via the poll (the generate call saves server-side); the
  // ref makes it one-shot per compose entry so user edits are never clobbered.
  const aiPrefillRef = useRef(false)
  const lieSubmitSigRef = useRef<string | null>(null)

  const myPlayer = players.find((player) => player.userId === currentUserId)

  const normalizedCustomStatements = customStatements.map((statement) => statement.trim())
  const hasDuplicateCustomStatements =
    normalizedCustomStatements.every((statement) => statement.length >= 2) &&
    new Set(normalizedCustomStatements).size !== 3
  const customStatementsValid =
    normalizedCustomStatements.every((statement) =>
      statement.length >= 2 && statement.length <= 80 && !checkProfanity(statement)
    ) &&
    new Set(normalizedCustomStatements).size === 3
  const canSubmitCustomSet =
    customStatementsValid && customLieIndex !== null && !isGeneratingStatements

  // AI prefill: entering the edit step after 「悦仔帮我写三句」, adopt the
  // generated set once it appears in the polled session state.
  const myStatementsSignature = myPlayer?.statements.map((statement) => statement.text.trim()).join('') ?? ''
  useEffect(() => {
    if (composeStep !== 'edit' || aiPrefillRef.current) return
    if (!myPlayer || myPlayer.statements.length === 0) return
    setCustomStatements([
      myPlayer.statements[0]?.text ?? '',
      myPlayer.statements[1]?.text ?? '',
      myPlayer.statements[2]?.text ?? '',
    ])
    aiPrefillRef.current = true
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [composeStep, myStatementsSignature])

  // Settle the lie-step submit (MiniScript vote-signature precedent): only a
  // poll that confirms OUR exact statement set closes the compose flow — a
  // failed submit keeps the lie step open for a retry.
  const wasGeneratingRef = useRef(isGeneratingStatements)
  useEffect(() => {
    if (wasGeneratingRef.current && !isGeneratingStatements && composeStep === 'lie' && lieSubmitSigRef.current) {
      if (myStatementsSignature === lieSubmitSigRef.current) {
        setComposeStep('choose')
        lieSubmitSigRef.current = null
      }
    }
    wasGeneratingRef.current = isGeneratingStatements
  }, [isGeneratingStatements, composeStep, myStatementsSignature])

  // The table moved on (everyone submitted) — the turn UI takes over; the
  // already-saved set (AI or custom) stands as the submission.
  useEffect(() => {
    if (everyoneGenerated && composeStep !== 'choose') {
      setComposeStep('choose')
      aiPrefillRef.current = false
    }
  }, [everyoneGenerated, composeStep])

  const updateCustomStatement = useCallback((index: number, value: string) => {
    setCustomStatements((current) =>
      current.map((statement, statementIndex) => statementIndex === index ? value : statement)
    )
  }, [])

  const updateAssistTag = useCallback((index: number, value: string) => {
    setAssistTags((current) =>
      current.map((tag, tagIndex) => tagIndex === index ? value : tag)
    )
  }, [])

  const handleAssistGenerate = useCallback(async (index: number) => {
    const tag = assistTags[index]?.trim()
    if (!tag || tag.length > 20 || checkProfanity(tag) || isGeneratingFromTag) return
    setGeneratingRow(index)
    try {
      const text = await onGenerateFromTag(tag)
      if (text) {
        updateCustomStatement(index, text)
        setAssistOpenRow(null)
      }
    } finally {
      setGeneratingRow(null)
    }
  }, [assistTags, isGeneratingFromTag, onGenerateFromTag, updateCustomStatement])

  const handleAiCompose = useCallback(() => {
    haptics('medium')
    aiPrefillRef.current = false
    setComposeStep('edit')
    onGenerateStatements()
  }, [onGenerateStatements])

  const handleHandwriteCompose = useCallback(() => {
    haptics('light')
    aiPrefillRef.current = true // nothing to prefill on the handwrite path
    setComposeStep('edit')
  }, [])

  const handleComposeNext = useCallback(() => {
    if (!customStatementsValid) return
    haptics('light')
    setComposeStep('lie')
  }, [customStatementsValid])

  const handleCustomSubmit = useCallback(() => {
    if (!canSubmitCustomSet || customLieIndex === null) return
    lieSubmitSigRef.current = normalizedCustomStatements.join('')
    onGenerateStatements(normalizedCustomStatements, customLieIndex)
  }, [canSubmitCustomSet, customLieIndex, normalizedCustomStatements, onGenerateStatements])

  if (!everyoneGenerated) {
    const submitted = hasGeneratedStatements || completedSet.has(currentUserId)
    const optedOut = completedSet.has(currentUserId) && !hasGeneratedStatements
    const composing = composeStep !== 'choose'

    // W3 (AC-W3.4): a player who joined after phase entry is excluded from the
    // turn rotation — show an observer state instead of a dead submit button.
    if (rosterLocked && !hasGeneratedStatements) {
      return (
        <View className='lie-detective-hero'>
          <PhaseHeroCard
            phase='lie_detective'
            artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-lie-detective.webp')}
            title='这一轮已经开始'
            statusText='你加入得晚了一点，先看看大家的陈述'
            doneCount={readyCount}
            totalCount={playerCount}
            actions={
              <Text className='phase-hero-card__ghost-link'>下一轮再加入也不迟</Text>
            }
          />
        </View>
      )
    }

    return (
      <View className='lie-detective-hero'>
        <PhaseHeroCard
          phase='lie_detective'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-lie-detective.webp')}
          title={
            composing
              ? composeStep === 'lie'
                ? '最后一步：哪句是谎言？'
                : '我的三句话'
              : '等待所有玩家提交陈述…'
          }
          statusText={
            submitted && !composing
              ? optedOut
                ? '本轮先旁听，等待其他玩家完成'
                : '你的陈述已提交，等待其他玩家完成'
              : composeStep === 'lie'
                ? '只有揭晓时才会公开答案'
                : '提交后自动进入投票环节'
          }
          doneCount={readyCount}
          totalCount={playerCount}
          actions={
            composeStep === 'choose' && !submitted ? (
              <Button
                variant='primary'
                onClick={handleAiCompose}
                disabled={isGeneratingStatements}
                loading={isGeneratingStatements}
              >
                {isGeneratingStatements ? '悦仔写稿中…' : '悦仔帮我写三句'}
              </Button>
            ) : composeStep === 'edit' ? (
              <Button
                variant='primary'
                onClick={handleComposeNext}
                disabled={!customStatementsValid || isGeneratingStatements}
              >
                选好了，下一步
              </Button>
            ) : composeStep === 'lie' ? (
              <Button
                variant='primary'
                onClick={handleCustomSubmit}
                disabled={!canSubmitCustomSet}
                loading={isGeneratingStatements}
              >
                {isGeneratingStatements ? '正在提交…' : '提交我的三句话'}
              </Button>
            ) : isGeneratingStatements ? (
              <Text className='phase-hero-card__ghost-link'>悦仔生成中…</Text>
            ) : undefined
          }
        >
          {composeStep === 'choose' && !submitted ? (
            <View className='lie-detective-hero__custom-form'>
              <Text className='lie-detective-hero__custom-guide'>
                两句真话、一句谎言。悦仔可以按你的资料起草，改到顺口再提交。
              </Text>
              <View
                className='lie-detective-hero__ghost-entry'
                hoverClass='lie-detective-hero__ghost-entry--pressed'
                onClick={handleHandwriteCompose}
                role='button'
                aria-label='自己写三句'
              >
                <Text className='lie-detective-hero__ghost-entry-text'>自己写三句 ›</Text>
              </View>
            </View>
          ) : composeStep === 'edit' ? (
            <View className='lie-detective-hero__custom-form'>
              <Text className='lie-detective-hero__custom-guide'>
                改到顺口为止，下一步再点出哪句是谎言。
              </Text>
              {customStatements.map((statement, index) => {
                const trimmed = statement.trim()
                const assistTag = assistTags[index]?.trim() ?? ''
                const assistTagInvalid =
                  assistTag.length > 20 || (assistTag.length > 0 && checkProfanity(assistTag))
                const invalid =
                  trimmed.length > 0 &&
                  (trimmed.length < 2 || checkProfanity(trimmed))
                return (
                  <View className='lie-detective-hero__custom-field' key={index}>
                    <View className='lie-detective-hero__custom-field-head'>
                      <Text className='lie-detective-hero__custom-label'>第 {index + 1} 句</Text>
                      <View
                        className='lie-detective-hero__assist-toggle'
                        hoverClass='lie-detective-hero__assist-toggle--pressed'
                        onClick={() => {
                          haptics('light')
                          setAssistOpenRow((current) => (current === index ? null : index))
                        }}
                        role='button'
                        aria-expanded={assistOpenRow === index}
                        aria-label={`悦仔帮我写第 ${index + 1} 句`}
                      >
                        <Text className='lie-detective-hero__assist-toggle-text'>
                          {assistOpenRow === index ? '收起' : '帮我写这句'}
                        </Text>
                      </View>
                    </View>
                    <Textarea
                      className={`lie-detective-hero__custom-input${invalid ? ' lie-detective-hero__custom-input--error' : ''}`}
                      placeholder={index === 0 ? '一句关于你的真话或谎言' : '再来一句'}
                      value={statement}
                      onInput={(event) => updateCustomStatement(index, event.detail.value)}
                      maxlength={80}
                      autoHeight
                      disabled={isGeneratingStatements || generatingRow === index}
                    />
                    {assistOpenRow === index ? (
                      <View className='lie-detective-hero__assist-row'>
                        <Input
                          className='lie-detective-hero__assist-input'
                          placeholder='输个标签，悦仔帮你起一句'
                          value={assistTags[index]}
                          onInput={(event) => updateAssistTag(index, event.detail.value)}
                          maxlength={20}
                          disabled={generatingRow === index}
                        />
                        <View
                          className={`lie-detective-hero__assist-button${!assistTag || assistTagInvalid || isGeneratingFromTag ? ' lie-detective-hero__assist-button--disabled' : ''}`}
                          role='button'
                          aria-label={`根据第 ${index + 1} 个标签生成句子`}
                          onClick={() => void handleAssistGenerate(index)}
                        >
                          <Text>{generatingRow === index ? '生成中…' : '标签生成'}</Text>
                        </View>
                      </View>
                    ) : null}
                    {assistTagInvalid ? (
                      <Text className='lie-detective-hero__tag-error'>请换一个 20 字以内的友好标签</Text>
                    ) : null}
                    <Text className='lie-detective-hero__tag-counter'>{trimmed.length}/80</Text>
                  </View>
                )
              })}
              {hasDuplicateCustomStatements ? (
                <Text className='lie-detective-hero__tag-error'>三句话不能重复</Text>
              ) : null}
            </View>
          ) : composeStep === 'lie' ? (
            <View className='lie-detective-hero__custom-form'>
              <Text className='lie-detective-hero__custom-guide'>
                点选哪句是谎言。只有揭晓时才会公开答案。
              </Text>
              <View className='lie-detective-hero__statements'>
                {normalizedCustomStatements.map((statement, index) => {
                  const isLie = customLieIndex === index + 1
                  return (
                    <View
                      key={index}
                      className={`lie-detective-hero__statement${isLie ? ' lie-detective-hero__statement--selected' : ''}`}
                      hoverClass='lie-detective-hero__statement--pressed'
                      onClick={() => {
                        haptics('light')
                        setCustomLieIndex(index + 1)
                      }}
                      role='button'
                      aria-pressed={isLie}
                      aria-label={`第 ${index + 1} 句，${isLie ? '已设为谎言' : '设为谎言'}`}
                    >
                      <View className='lie-detective-hero__statement-header'>
                        <Text className='lie-detective-hero__statement-index'>{index + 1}</Text>
                        {isLie ? (
                          <Text className='lie-detective-hero__statement-tag lie-detective-hero__statement-tag--lie'>
                            谎言
                          </Text>
                        ) : null}
                      </View>
                      <Text className='lie-detective-hero__statement-text'>{statement}</Text>
                    </View>
                  )
                })}
              </View>
              {customLieIndex === null ? (
                <Text className='lie-detective-hero__tag-error'>请选择其中一句作为谎言</Text>
              ) : null}
              <View
                className='lie-detective-hero__ghost-entry'
                hoverClass='lie-detective-hero__ghost-entry--pressed'
                onClick={() => {
                  haptics('light')
                  setComposeStep('edit')
                }}
                role='button'
                aria-label='返回改句子'
              >
                <Text className='lie-detective-hero__ghost-entry-text'>‹ 返回改句子</Text>
              </View>
            </View>
          ) : (
            <WaitingBeat variant='peers' />
          )}
        </PhaseHeroCard>
      </View>
    )
  }

  if (!currentPlayer) {
    return (
      <View className='lie-detective-hero'>
        <PhaseHeroCard
          phase='lie_detective'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-lie-detective.webp')}
          title='等待侦探回合开启…'
        >
          {!isHost ? <WaitingBeat variant='host' /> : null}
        </PhaseHeroCard>
      </View>
    )
  }

  // ── Compute group correct rate for V2 edge messages ───────────────────────
  const playerVotes = votes.filter((v) => v.targetUserId === currentPlayer.userId)
  const totalPlayerVotes = playerVotes.length
  const correctPlayerVotes = isRevealed
    ? playerVotes.filter((v) => v.guessedStatementIndex === reveal.lieIndex).length
    : 0
  const correctRate = totalPlayerVotes > 0 ? correctPlayerVotes / totalPlayerVotes : 0
  const showZeroMessage = isRevealed && correctRate === 0 && totalPlayerVotes > 0
  const showHundredMessage = isRevealed && correctRate === 1 && totalPlayerVotes > 0

  const statusText = isRevealed
    ? hasVoted
      ? reveal?.lieIndex === myVoteIndex
        ? '猜对了！'
        : '猜错了'
      : '本回合已揭晓'
    : isOwnTurn
      ? '其他人正在猜测你的谎言…'
      : hasVoted
        ? '已提交猜测，再次点击可修改答案'
        : '哪句是谎言？点击你的答案'

  return (
    <View className='lie-detective-hero'>
      <PhaseHeroCard
        phase='lie_detective'
        artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-lie-detective.webp')}
        title={`${currentPlayer.displayName} 的回合`}
        statusChip={`第 ${currentPlayerIndex + 1} / ${players.length} 位玩家`}
        statusText={statusText}
        doneCount={(votes.filter((v) => v.targetUserId === currentPlayer.userId)).length + (isOwnTurn ? 1 : 0)}
        totalCount={playerCount}
        actions={
          <>
            {!hasGeneratedStatements ? (
              <Button
                variant='primary'
                onClick={() => onGenerateStatements()}
                disabled={isGeneratingStatements}
                loading={isGeneratingStatements}
              >
                {isGeneratingStatements ? '生成中…' : '生成我的三句话'}
              </Button>
            ) : null}
            {isHost && canMoveToNextPlayer ? (
              <Button
                variant='secondary'
                onClick={onNextPlayer}
                disabled={isMovingNextPlayer}
                loading={isMovingNextPlayer}
              >
                {isMovingNextPlayer ? '切换中…' : '下一位玩家'}
              </Button>
            ) : null}
            {isHost && isRevealed && !canMoveToNextPlayer ? (
              <Button
                variant='primary'
                onClick={onAdvance}
                disabled={isAdvancing}
                loading={isAdvancing}
              >
                {isAdvancing ? '切换中…' : '进入下一阶段'}
              </Button>
            ) : null}
          </>
        }
      >
        <View className='lie-detective-hero__statements'>
          {currentPlayer.statements.map((stmt, stmtPosition) => {
            const isSelected = myVoteIndex === stmt.index
            const isLie = isRevealed && reveal?.lieIndex === stmt.index
            const voteCount = isRevealed
              ? votes.filter(
                  (v) => v.targetUserId === currentPlayer.userId && v.guessedStatementIndex === stmt.index,
                ).length
              : 0

            let cardModifier = ''
            if (isRevealed && isLie) cardModifier = ' lie-detective-hero__statement--lie'
            else if (isRevealed && !isLie) cardModifier = ' lie-detective-hero__statement--truth'
            else if (isSelected) cardModifier = ' lie-detective-hero__statement--selected'
            if (flipIn) cardModifier += ' lie-detective-hero__statement--flip-in'

            return (
              <View
                key={stmt.index}
                className={'lie-detective-hero__statement' + cardModifier}
                style={flipIn ? { animationDelay: `${stmtPosition * 90}ms` } : undefined}
                onClick={() => {
                  if (!isOwnTurn && !isVoting && !isRevealed) {
                    haptics('light')
                    onVote(stmt.index)
                  }
                }}
              >
                <View className='lie-detective-hero__statement-header'>
                  <Text className='lie-detective-hero__statement-index'>{stmt.index}</Text>
                  {isRevealed && isLie && (
                    <Text className='lie-detective-hero__statement-tag lie-detective-hero__statement-tag--lie'>
                      谎言
                    </Text>
                  )}
                  {isRevealed && !isLie && (
                    <Text className='lie-detective-hero__statement-tag lie-detective-hero__statement-tag--truth'>
                      真话
                    </Text>
                  )}
                </View>
                <Text className='lie-detective-hero__statement-text'>{stmt.text}</Text>
                {isRevealed && (
                  <Text className='lie-detective-hero__statement-votes'>{voteCount} 人选择</Text>
                )}
              </View>
            )
          })}
        </View>

        {showZeroMessage ? (
          <View className='lie-detective-hero__edge-msg'>
            <Text className='lie-detective-hero__edge-text'>大家都被悦仔骗了！</Text>
          </View>
        ) : null}
        {showHundredMessage ? (
          <View className='lie-detective-hero__edge-msg'>
            <Text className='lie-detective-hero__edge-text'>火眼金睛！全对！</Text>
          </View>
        ) : null}
        <PhaseAigcRow meta={statementsMeta} reason='AI 生成侦探陈述' />
      </PhaseHeroCard>
    </View>
  )
}
