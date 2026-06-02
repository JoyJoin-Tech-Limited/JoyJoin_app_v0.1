import { useState, useCallback } from 'react'
import { View, Text, Input } from '@tarojs/components'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Taro from '@tarojs/taro'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'
import type {
  LieDetectivePlayer,
  LieDetectiveReveal,
  LieDetectiveVote,
} from '@shared/socialIcebreaker'

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

function prefersReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    if ((info as any).reduceMotion) return true
  } catch {
    // ignore
  }
  return false
}

const REDUCED_MOTION = prefersReducedMotion()

// ─── Component ──────────────────────────────────────────────────────────────

export function LieDetectivePhaseView({
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
  onAdvance: () => void
  isAdvancing: boolean
  lieDetectiveMode?: 'v1' | 'v2'
  onSubmitTags?: (tags: [string, string]) => void
  isSubmittingTags?: boolean
}) {
  const everyoneGenerated = playerCount > 0 && players.length >= playerCount
  const currentPlayer = players[currentPlayerIndex]
  const isOwnTurn = currentPlayer?.userId === currentUserId
  const hasVoted = myVoteIndex !== null
  const isRevealed = !!reveal
  const isV2 = lieDetectiveMode === 'v2'

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
    tag1ValidLength &&
    tag2ValidLength &&
    !tag1Profane &&
    !tag2Profane &&
    !isSubmittingTags

  const handleTagSubmit = useCallback(() => {
    if (!canSubmitTags || !onSubmitTags) return
    onSubmitTags([tag1Trimmed, tag2Trimmed])
  }, [canSubmitTags, onSubmitTags, tag1Trimmed, tag2Trimmed])

  // ── V2: show tag input during generation phase ────────────────────────────
  if (!everyoneGenerated && isV2) {
    const showTagInput = !hasGeneratedStatements

    return (
      <View className='icebreaker__detective'>
        <Card className='icebreaker__detective-card'>
          <View className='icebreaker__detective-emoji'>
            <PhaseHeaderIcon phase="lie_detective" size={80} />
          </View>
          <Text className='icebreaker__detective-player'>
            {showTagInput ? '写下关于你的两个标签' : '✅ 已提交，等待悦仔生成…'}
          </Text>
          <Text className='icebreaker__detective-hint'>
            {showTagInput
              ? '悦仔会根据你的标签生成有趣的三句话'
              : `当前已提交 ${players.length} / ${playerCount} 人`}
          </Text>
        </Card>

        {showTagInput && (
          <View className='icebreaker__tag-form'>
            <View className='icebreaker__tag-field'>
              <Input
                className={`icebreaker__tag-input ${!tag1ValidLength && tag1Trimmed.length > 0 ? 'icebreaker__tag-input--error' : ''} ${tag1Profane ? 'icebreaker__tag-input--error' : ''}`}
                placeholder='比如：养猫、喜欢徒步'
                value={tag1}
                onInput={(e) => setTag1(e.detail.value)}
                maxlength={20}
                disabled={!!isSubmittingTags}
              />
              <Text className='icebreaker__tag-counter'>
                {tag1Trimmed.length}/20
              </Text>
              {!tag1ValidLength && tag1Trimmed.length > 0 && (
                <Text className='icebreaker__tag-error'>标签需要2-20个字</Text>
              )}
              {tag1Profane && (
                <Text className='icebreaker__tag-error'>标签包含敏感词，请修改</Text>
              )}
            </View>

            <View className='icebreaker__tag-field'>
              <Input
                className={`icebreaker__tag-input ${!tag2ValidLength && tag2Trimmed.length > 0 ? 'icebreaker__tag-input--error' : ''} ${tag2Profane ? 'icebreaker__tag-input--error' : ''}`}
                placeholder='比如：去过20个国家'
                value={tag2}
                onInput={(e) => setTag2(e.detail.value)}
                maxlength={20}
                disabled={!!isSubmittingTags}
              />
              <Text className='icebreaker__tag-counter'>
                {tag2Trimmed.length}/20
              </Text>
              {!tag2ValidLength && tag2Trimmed.length > 0 && (
                <Text className='icebreaker__tag-error'>标签需要2-20个字</Text>
              )}
              {tag2Profane && (
                <Text className='icebreaker__tag-error'>标签包含敏感词，请修改</Text>
              )}
            </View>
          </View>
        )}

        <View className='icebreaker__action-stack'>
          {showTagInput ? (
            <Button
              variant='primary'
              className='icebreaker__action-btn'
              onClick={handleTagSubmit}
              disabled={!canSubmitTags}
              loading={isSubmittingTags}
            >
              {isSubmittingTags ? '悦仔正在编假话…' : '提交标签'}
            </Button>
          ) : (
            <Text className='icebreaker__helper-text'>
              你的标签已提交，等待其他玩家完成。
            </Text>
          )}
        </View>
      </View>
    )
  }

  // ── V1 generation phase (unchanged) ───────────────────────────────────────
  if (!everyoneGenerated) {
    return (
      <View className='icebreaker__detective'>
        <Card className='icebreaker__detective-card'>
          <View className='icebreaker__detective-emoji'><PhaseHeaderIcon phase="lie_detective" size={80} /></View>
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
          <View className='icebreaker__detective-emoji'><PhaseHeaderIcon phase="lie_detective" size={80} /></View>
          <Text className='icebreaker__detective-waiting'>等待侦探回合开启…</Text>
        </Card>
      </View>
    )
  }

  // ── Compute group correct rate for edge messages ──────────────────────────
  const playerVotes = votes.filter((v) => v.targetUserId === currentPlayer.userId)
  const totalPlayerVotes = playerVotes.length
  const correctPlayerVotes = isRevealed
    ? playerVotes.filter((v) => v.guessedStatementIndex === reveal.lieIndex).length
    : 0
  const correctRate = totalPlayerVotes > 0 ? correctPlayerVotes / totalPlayerVotes : 0
  const showZeroMessage = isRevealed && correctRate === 0 && totalPlayerVotes > 0 && isV2
  const showHundredMessage = isRevealed && correctRate === 1 && totalPlayerVotes > 0 && isV2

  return (
    <View className='icebreaker__detective'>
      <Card className='icebreaker__detective-card'>
        <View className='icebreaker__detective-emoji'><PhaseHeaderIcon phase="lie_detective" size={80} /></View>
        <Text className='icebreaker__detective-player'>
          {currentPlayer.displayName} 的回合
        </Text>
        <Text className='icebreaker__detective-hint'>
          {isOwnTurn
            ? '其他人正在猜测你的谎言…'
            : '哪句是谎言？点击你的答案'}
        </Text>
      </Card>

      {/* V2 edge messages */}
      {showZeroMessage && (
        <View className={`icebreaker__detective-edge-msg icebreaker__detective-edge-msg--zero ${REDUCED_MOTION ? '' : 'icebreaker__detective-edge-msg--animate'}`}>
          <View className='jj-icon-text'>
            <JoyJoinIcon emoji='🎭' size={28} />
            <Text className='icebreaker__detective-edge-text'>大家都被悦仔骗了！</Text>
          </View>
        </View>
      )}
      {showHundredMessage && (
        <View className={`icebreaker__detective-edge-msg icebreaker__detective-edge-msg--hundred ${REDUCED_MOTION ? '' : 'icebreaker__detective-edge-msg--animate'}`}>
          <View className='jj-icon-text'>
            <JoyJoinIcon emoji='🔥' tier='reaction' size={28} />
            <Text className='icebreaker__detective-edge-text'>火眼金睛！全对！</Text>
          </View>
        </View>
      )}

      <View className='icebreaker__detective-statements'>
        {currentPlayer.statements.map((stmt) => {
          const isSelected = myVoteIndex === stmt.index
          const isLie = isRevealed && reveal?.lieIndex === stmt.index
          const voteCount = isRevealed
            ? votes.filter(
                (v) => v.targetUserId === currentPlayer.userId && v.guessedStatementIndex === stmt.index,
              ).length
            : 0

          let cardModifier = ''
          if (isRevealed && isLie) cardModifier = ' icebreaker__statement--lie'
          else if (isRevealed && !isLie) cardModifier = ' icebreaker__statement--truth'
          else if (isSelected) cardModifier = ' icebreaker__statement--selected'

          // V2 reveal: emerald glow on AI-generated statement
          const isAiStatement = isV2 && isRevealed && isLie
          if (isAiStatement && !REDUCED_MOTION) {
            cardModifier += ' icebreaker__statement--ai-glow'
          }

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
                {isRevealed && isLie && !isV2 && (
                  <Text className='icebreaker__statement-tag icebreaker__statement-tag--lie'>
                    谎言
                  </Text>
                )}
                {isRevealed && !isLie && !isV2 && (
                  <Text className='icebreaker__statement-tag icebreaker__statement-tag--truth'>
                    真话
                  </Text>
                )}
                {/* V2 badges */}
                {isV2 && isRevealed && isLie && (
                  <Text className='icebreaker__statement-tag icebreaker__statement-tag--ai'>
                    🤖 悦仔写的
                  </Text>
                )}
                {isV2 && isRevealed && !isLie && (
                  <Text className='icebreaker__statement-tag icebreaker__statement-tag--user'>
                    ✅ 你写的
                  </Text>
                )}
              </View>
              <Text className='icebreaker__statement-text'>{stmt.text}</Text>
              {isRevealed && (
                <Text className={`icebreaker__statement-votes ${!REDUCED_MOTION ? 'icebreaker__statement-votes--animate' : ''}`}>
                  {voteCount} 人选择
                </Text>
              )}
            </View>
          )
        })}
      </View>

      {!isOwnTurn && (
        <View className='icebreaker__detective-status'>
          {hasVoted && !isRevealed && (
            <Text className='icebreaker__detective-voted'>已提交猜测，再次点击可修改答案</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex === myVoteIndex && (
            <Text className='icebreaker__detective-correct'>猜对了！</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex !== myVoteIndex && (
            <Text className='icebreaker__detective-wrong'>猜错了</Text>
          )}
        </View>
      )}

      {isOwnTurn && !isRevealed ? (
        <Text className='icebreaker__helper-text'>轮到你被猜测啦，等其他玩家投票完成后会自动揭晓。</Text>
      ) : null}

      <View className='icebreaker__action-stack'>
        {!hasGeneratedStatements && !isV2 ? (
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
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onAdvance}
            disabled={isAdvancing}
            loading={isAdvancing}
          >
            {isAdvancing ? '切换中…' : '进入下一阶段'}
          </Button>
        ) : null}
      </View>

      <Text className='icebreaker__detective-progress'>
        {currentPlayerIndex + 1} / {players.length} 位玩家
      </Text>
    </View>
  )
}
