import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import {
  PhaseHeaderIcon,
  type SessionParticipant,
} from '../phaseUtils'
import type {
  LieDetectivePlayer,
  LieDetectiveReveal,
  LieDetectiveVote,
} from '@shared/socialIcebreaker'

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
}) {
  const everyoneGenerated = playerCount > 0 && players.length >= playerCount
  const currentPlayer = players[currentPlayerIndex]
  const isOwnTurn = currentPlayer?.userId === currentUserId
  const hasVoted = myVoteIndex !== null
  const isRevealed = !!reveal

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
