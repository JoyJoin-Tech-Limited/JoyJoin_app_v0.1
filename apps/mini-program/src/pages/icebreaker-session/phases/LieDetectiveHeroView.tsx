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
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import './LieDetectiveHeroView.scss'

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
}: LieDetectiveHeroViewProps) {
  const everyoneGenerated = playerCount > 0 && players.length >= playerCount
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

  const [assistTags, setAssistTags] = useState(['', '', ''])
  const [generatingRow, setGeneratingRow] = useState<number | null>(null)
  const [customStatements, setCustomStatements] = useState(['', '', ''])
  const [customLieIndex, setCustomLieIndex] = useState<number | null>(null)

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
      if (text) updateCustomStatement(index, text)
    } finally {
      setGeneratingRow(null)
    }
  }, [assistTags, isGeneratingFromTag, onGenerateFromTag, updateCustomStatement])

  const handleCustomSubmit = useCallback(() => {
    if (!canSubmitCustomSet || customLieIndex === null) return
    onGenerateStatements(normalizedCustomStatements, customLieIndex)
  }, [canSubmitCustomSet, customLieIndex, normalizedCustomStatements, onGenerateStatements])

  if (!everyoneGenerated) {
    const submitted = hasGeneratedStatements
    return (
      <View className='lie-detective-hero'>
        <PhaseHeroCard
          phase='lie_detective'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-lie-detective.webp')}
          title='等待所有玩家提交陈述…'
          statusText={
            submitted
              ? '你的陈述已提交，等待其他玩家完成'
              : '提交后自动进入投票环节'
          }
          doneCount={players.length}
          totalCount={playerCount}
          actions={
            <>
              {!submitted ? (
                <View className='lie-detective-hero__custom-form'>
                  <Text className='lie-detective-hero__custom-guide'>
                    写下两句真话和一句谎言，再点选哪句是谎言。只有揭晓时才会公开答案。
                  </Text>
                  {customStatements.map((statement, index) => {
                    const trimmed = statement.trim()
                    const assistTag = assistTags[index]?.trim() ?? ''
                    const assistTagInvalid =
                      assistTag.length > 20 || (assistTag.length > 0 && checkProfanity(assistTag))
                    const invalid =
                      trimmed.length > 0 &&
                      (trimmed.length < 2 || checkProfanity(trimmed))
                    const isLie = customLieIndex === index + 1
                    return (
                      <View className='lie-detective-hero__custom-field' key={index}>
                        <View className='lie-detective-hero__custom-field-head'>
                          <Text className='lie-detective-hero__custom-label'>第 {index + 1} 句</Text>
                          <View
                            className={`lie-detective-hero__lie-picker${isLie ? ' lie-detective-hero__lie-picker--selected' : ''}`}
                            onClick={() => setCustomLieIndex(index + 1)}
                            role='button'
                            aria-label={`设为第 ${index + 1} 句谎言`}
                          >
                            <Text>{isLie ? '✓ 这是谎言' : '设为谎言'}</Text>
                          </View>
                        </View>
                        <Textarea
                          className={`lie-detective-hero__custom-input${invalid ? ' lie-detective-hero__custom-input--error' : ''}`}
                          placeholder='输入一句话，或者试试标签生成'
                          value={statement}
                          onInput={(event) => updateCustomStatement(index, event.detail.value)}
                          maxlength={80}
                          autoHeight
                          disabled={isGeneratingStatements || generatingRow === index}
                        />
                        <View className='lie-detective-hero__assist-row'>
                          <Input
                            className='lie-detective-hero__assist-input'
                            placeholder='用标签生成一句话，多点几次会有不同的思路'
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
                  {customStatementsValid && customLieIndex === null ? (
                    <Text className='lie-detective-hero__tag-error'>请选择其中一句作为谎言</Text>
                  ) : null}
                  <Button
                    variant='primary'
                    onClick={handleCustomSubmit}
                    disabled={!canSubmitCustomSet}
                    loading={isGeneratingStatements}
                  >
                    {isGeneratingStatements ? '正在提交…' : '提交我的三句话'}
                  </Button>
                </View>
              ) : null}
              {submitted && isGeneratingStatements ? (
                <Text className='phase-hero-card__ghost-link'>悦仔生成中…</Text>
              ) : null}
            </>
          }
        />
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
        />
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
