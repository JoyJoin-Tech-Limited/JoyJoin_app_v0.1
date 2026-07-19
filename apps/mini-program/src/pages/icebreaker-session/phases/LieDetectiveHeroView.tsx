import { useEffect, useRef, useState, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
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
  onGenerateStatements: () => void
  isGeneratingStatements: boolean
  isHost: boolean
  canMoveToNextPlayer: boolean
  onNextPlayer: () => void
  isMovingNextPlayer: boolean
  onAdvance: () => void
  isAdvancing: boolean
  lieDetectiveMode?: 'v1' | 'v2'
  onSubmitTags?: (tags: [string, string]) => void
  isSubmittingTags?: boolean
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
  lieDetectiveMode = 'v1',
  onSubmitTags,
  isSubmittingTags,
  statementsMeta,
}: LieDetectiveHeroViewProps) {
  const everyoneGenerated = playerCount > 0 && players.length >= playerCount
  const currentPlayer = players[currentPlayerIndex]
  const isOwnTurn = currentPlayer?.userId === currentUserId
  const hasVoted = myVoteIndex !== null
  const isRevealed = !!reveal
  const isV2 = lieDetectiveMode === 'v2'

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

  // ── Tag input state (V2 only) ─────────────────────────────────────────────
  const [tag1, setTag1] = useState('')
  const [tag2, setTag2] = useState('')

  const tag1Trimmed = tag1.trim()
  const tag2Trimmed = tag2.trim()

  const tag1ValidLength = tag1Trimmed.length >= 2 && tag1Trimmed.length <= 20
  const tag2ValidLength = tag2Trimmed.length >= 2 && tag2Trimmed.length <= 20
  const tag1Profane = tag1Trimmed.length > 0 ? checkProfanity(tag1Trimmed) : false
  const tag2Profane = tag2Trimmed.length > 0 ? checkProfanity(tag2Trimmed) : false

  const canSubmitTags =
    tag1ValidLength && tag2ValidLength && !tag1Profane && !tag2Profane && !isSubmittingTags

  const handleTagSubmit = useCallback(() => {
    if (!canSubmitTags || !onSubmitTags) return
    onSubmitTags([tag1Trimmed, tag2Trimmed])
  }, [canSubmitTags, onSubmitTags, tag1Trimmed, tag2Trimmed])

  // ── Generation phase (V2 tag input / V1 generate) ─────────────────────────
  if (!everyoneGenerated) {
    const submitted = hasGeneratedStatements
    return (
      <View className='lie-detective-hero'>
        <PhaseHeroCard
          phase='lie_detective'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-lie-detective.webp')}
          title={
            isV2
              ? submitted
                ? '已提交，等待悦仔生成…'
                : '写下关于你的两个标签'
              : '等待所有玩家提交陈述…'
          }
          prompt={
            isV2
              ? submitted
                ? undefined
                : '悦仔会根据你的标签生成有趣的三句话，标签不会公开给其他玩家'
              : undefined
          }
          statusText={
            submitted
              ? isV2
                ? '你的标签已提交，等待其他玩家完成'
                : '你的陈述已提交，等待其他玩家完成'
              : '提交后自动进入投票环节'
          }
          doneCount={players.length}
          totalCount={playerCount}
          actions={
            <>
              {isV2 && !submitted ? (
                <View className='lie-detective-hero__tag-form'>
                  <View className='lie-detective-hero__tag-field'>
                    <Input
                      className={`lie-detective-hero__tag-input${(!tag1ValidLength && tag1Trimmed.length > 0) || tag1Profane ? ' lie-detective-hero__tag-input--error' : ''}`}
                      placeholder='比如：养猫、喜欢徒步'
                      value={tag1}
                      onInput={(e) => setTag1(e.detail.value)}
                      maxlength={20}
                      disabled={!!isSubmittingTags}
                    />
                    <Text className='lie-detective-hero__tag-counter'>{tag1Trimmed.length}/20</Text>
                    {!tag1ValidLength && tag1Trimmed.length > 0 && (
                      <Text className='lie-detective-hero__tag-error'>标签需要2-20个字</Text>
                    )}
                    {tag1Profane && (
                      <Text className='lie-detective-hero__tag-error'>标签包含敏感词，请修改</Text>
                    )}
                  </View>
                  <View className='lie-detective-hero__tag-field'>
                    <Input
                      className={`lie-detective-hero__tag-input${(!tag2ValidLength && tag2Trimmed.length > 0) || tag2Profane ? ' lie-detective-hero__tag-input--error' : ''}`}
                      placeholder='比如：去过20个国家'
                      value={tag2}
                      onInput={(e) => setTag2(e.detail.value)}
                      maxlength={20}
                      disabled={!!isSubmittingTags}
                    />
                    <Text className='lie-detective-hero__tag-counter'>{tag2Trimmed.length}/20</Text>
                    {!tag2ValidLength && tag2Trimmed.length > 0 && (
                      <Text className='lie-detective-hero__tag-error'>标签需要2-20个字</Text>
                    )}
                    {tag2Profane && (
                      <Text className='lie-detective-hero__tag-error'>标签包含敏感词，请修改</Text>
                    )}
                  </View>
                  <Button
                    variant='primary'
                    onClick={handleTagSubmit}
                    disabled={!canSubmitTags}
                    loading={isSubmittingTags}
                  >
                    {isSubmittingTags ? '悦仔正在编假话…' : '提交标签'}
                  </Button>
                </View>
              ) : null}
              {!isV2 && !submitted ? (
                <Button
                  variant='primary'
                  onClick={onGenerateStatements}
                  disabled={isGeneratingStatements}
                  loading={isGeneratingStatements}
                >
                  {isGeneratingStatements ? '生成中…' : '生成我的三句话'}
                </Button>
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
  const showZeroMessage = isRevealed && correctRate === 0 && totalPlayerVotes > 0 && isV2
  const showHundredMessage = isRevealed && correctRate === 1 && totalPlayerVotes > 0 && isV2

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
            {!hasGeneratedStatements && !isV2 ? (
              <Button
                variant='primary'
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
                  <Text className='lie-detective-hero__statement-index'>{stmt.index + 1}</Text>
                  {isRevealed && isLie && !isV2 && (
                    <Text className='lie-detective-hero__statement-tag lie-detective-hero__statement-tag--lie'>
                      谎言
                    </Text>
                  )}
                  {isRevealed && !isLie && !isV2 && (
                    <Text className='lie-detective-hero__statement-tag lie-detective-hero__statement-tag--truth'>
                      真话
                    </Text>
                  )}
                  {isV2 && isRevealed && isLie && (
                    <Text className='lie-detective-hero__statement-tag lie-detective-hero__statement-tag--ai'>
                      悦仔写的
                    </Text>
                  )}
                  {isV2 && isRevealed && !isLie && (
                    <Text className='lie-detective-hero__statement-tag lie-detective-hero__statement-tag--user'>
                      你写的
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
