import { View, Text } from '@tarojs/components'
import Card from '../../components/Card'
import Button from '../../components/Button'
import {
  type AtmosphereMood,
  type LieDetectivePlayer,
  type LieDetectiveReveal,
  type LieDetectiveVote,
  type PersonalityDiceChallenge,
  type SocialIcebreakerPhase,
} from '@shared/socialIcebreaker'

export type SessionPhase = 'waiting' | SocialIcebreakerPhase | 'ended'

export interface SessionParticipant {
  userId: string
  displayName?: string
  archetype?: string
  interests?: string[]
  isHost?: boolean
  isActive?: boolean
  [key: string]: unknown
}

const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; emoji: string; label: string }> = [
  { mood: 'funny', emoji: '😂', label: '搞笑' },
  { mood: 'life', emoji: '☕', label: '生活' },
  { mood: 'relaxed', emoji: '✨', label: '轻松' },
  { mood: 'emotional', emoji: '💫', label: '情感' },
]

export function getPhaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case 'waiting':
      return '等待中'
    case 'warmup':
      return '🌅 热身'
    case 'micro_challenge':
      return '⚡ 挑战'
    case 'lie_detective':
      return '🕵️ 谎言侦探'
    case 'personality_dice':
      return '🎲 人格骰子'
    case 'auction':
      return '🎪 拍卖'
    case 'mini_script_beta':
      return '🧪 剧本体验'
    case 'recap':
      return '✨ 回顾'
    case 'ended':
      return '已结束'
    default:
      return phase
  }
}

export function getMoodLabel(mood?: AtmosphereMood | null): string {
  switch (mood) {
    case 'funny':
      return '搞笑'
    case 'life':
      return '生活'
    case 'relaxed':
      return '轻松'
    case 'emotional':
      return '情感'
    default:
      return '待选择'
  }
}

export function WarmupPhaseView({
  topics,
  currentIndex,
  readyUserIds,
  participants,
  currentUserId,
  selectedMood,
  isHost,
  onGenerateTopics,
  onToggleReady,
  onNextTopic,
  isGeneratingTopics,
  isUpdatingReady,
  isAdvancingTopic,
}: {
  topics: Array<{ question: string; emoji?: string; mood?: string }>
  currentIndex: number
  readyUserIds: string[]
  participants: SessionParticipant[]
  currentUserId: string
  selectedMood?: AtmosphereMood
  isHost: boolean
  onGenerateTopics: (mood: AtmosphereMood) => void
  onToggleReady: () => void
  onNextTopic: () => void
  isGeneratingTopics: boolean
  isUpdatingReady: boolean
  isAdvancingTopic: boolean
}) {
  const currentTopic = topics[currentIndex]
  const isReady = readyUserIds.includes(currentUserId)
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  const moodLabel = getMoodLabel(selectedMood)

  return (
    <View className='icebreaker__warmup'>
      {currentTopic ? (
        <Card className='icebreaker__warmup-card'>
          <Text className='icebreaker__warmup-emoji'>
            {currentTopic.emoji ?? '🌅'}
          </Text>
          <Text className='icebreaker__warmup-question'>
            {currentTopic.question}
          </Text>
          <Text className='icebreaker__warmup-index'>
            {currentIndex + 1} / {topics.length}
          </Text>
          {selectedMood ? (
            <Text className='icebreaker__warmup-mood'>今晚氛围 · {moodLabel}</Text>
          ) : null}
        </Card>
      ) : (
        <Card className='icebreaker__warmup-card'>
          <Text className='icebreaker__warmup-emoji'>🌅</Text>
          <Text className='icebreaker__warmup-question'>
            热身话题准备中…
          </Text>
        </Card>
      )}

      <View className='icebreaker__warmup-status'>
        <Text className='icebreaker__warmup-ready-count'>
          ✅ {readyUserIds.length} / {participants.length} 人已准备
        </Text>
        {isReady && (
          <Text className='icebreaker__warmup-ready-badge'>你已准备</Text>
        )}
      </View>

      {participants.length > 0 && (
        <View className='icebreaker__participants'>
          {participants.map((p) => (
            <View
              key={p.userId}
              className={
                'icebreaker__participant' +
                (readyUserIds.includes(p.userId) ? ' icebreaker__participant--ready' : '')
              }
            >
              <Text className='icebreaker__participant-name'>
                {p.displayName ?? '匿名'}
              </Text>
              {p.isHost && (
                <Text className='icebreaker__participant-host'>👑</Text>
              )}
              {readyUserIds.includes(p.userId) && (
                <Text className='icebreaker__participant-check'>✅</Text>
              )}
            </View>
          ))}
        </View>
      )}

      <View className='icebreaker__action-stack'>
        {!currentTopic ? (
          isHost ? (
            <>
              <View className='icebreaker__mood-grid'>
                {MOOD_OPTIONS.map((option) => (
                  <View
                    key={option.mood}
                    className={
                      'icebreaker__mood-option' +
                      (selectedMood === option.mood ? ' icebreaker__mood-option--active' : '') +
                      (isGeneratingTopics ? ' icebreaker__mood-option--disabled' : '')
                    }
                    onClick={() => {
                      if (!isGeneratingTopics) {
                        onGenerateTopics(option.mood)
                      }
                    }}
                  >
                    <Text className='icebreaker__mood-option-emoji'>{option.emoji}</Text>
                    <Text className='icebreaker__mood-option-label'>{option.label}</Text>
                  </View>
                ))}
              </View>
              <Text className='icebreaker__helper-text'>
                {isGeneratingTopics ? '小悦正在根据你选的氛围出题…' : '先选一个氛围，小悦会生成这一轮的热身题目。'}
              </Text>
            </>
          ) : (
            <Text className='icebreaker__helper-text'>
              {selectedMood
                ? `主持人选择了${moodLabel}氛围，正在生成热身话题…`
                : '等待主持人选择今晚的热身氛围…'}
            </Text>
          )
        ) : (
          <>
            <Button
              variant={isReady ? 'secondary' : 'primary'}
              className='icebreaker__action-btn'
              onClick={onToggleReady}
              disabled={isUpdatingReady}
              loading={isUpdatingReady}
            >
              {isUpdatingReady ? '提交中…' : isReady ? '取消准备' : '我准备好了'}
            </Button>

            {isHost && everyoneReady && currentIndex < topics.length - 1 ? (
              <Button
                variant='secondary'
                className='icebreaker__action-btn'
                onClick={onNextTopic}
                disabled={isAdvancingTopic}
                loading={isAdvancingTopic}
              >
                {isAdvancingTopic ? '切换中…' : '切换下一题'}
              </Button>
            ) : null}

            {isHost && everyoneReady && currentIndex >= topics.length - 1 ? (
              <Text className='icebreaker__helper-text'>所有热身已完成，可以使用下方按钮进入下一阶段。</Text>
            ) : null}

            {!isHost && !everyoneReady ? (
              <Text className='icebreaker__helper-text'>大家都准备好后，主持人才可以推进下一步。</Text>
            ) : null}
          </>
        )}
      </View>
    </View>
  )
}

export function MicroChallengePhaseView({
  challenge,
  completedBy,
  currentUserId,
  playerCount,
  onComplete,
  isCompleting,
}: {
  challenge: { title: string; description: string; durationSeconds: number; completionCTA: string; visualHint?: string } | null
  completedBy: string[]
  currentUserId: string
  playerCount: number
  onComplete: () => void
  isCompleting: boolean
}) {
  const hasCompleted = completedBy.includes(currentUserId)

  return (
    <View className='icebreaker__challenge'>
      {challenge ? (
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>⚡</Text>
          <Text className='icebreaker__challenge-title'>{challenge.title}</Text>
          <Text className='icebreaker__challenge-desc'>{challenge.description}</Text>
          {challenge.visualHint && (
            <Text className='icebreaker__challenge-hint'>💡 {challenge.visualHint}</Text>
          )}
          <View className='icebreaker__challenge-meta'>
            <Text className='icebreaker__challenge-duration'>
              ⏱ {challenge.durationSeconds}秒
            </Text>
            <Text className='icebreaker__challenge-completed'>
              ✅ {completedBy.length} 人已完成
            </Text>
          </View>
          {hasCompleted && (
            <View className='icebreaker__challenge-done-badge'>
              <Text className='icebreaker__challenge-done-text'>
                你已完成！
              </Text>
            </View>
          )}
        </Card>
      ) : (
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>⚡</Text>
          <Text className='icebreaker__challenge-title'>挑战准备中…</Text>
        </Card>
      )}

      <View className='icebreaker__action-stack'>
        {!hasCompleted ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onComplete}
            disabled={isCompleting}
            loading={isCompleting}
          >
            {isCompleting ? '提交中…' : challenge?.completionCTA ?? '我已完成挑战'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>已记录你的完成状态，等待其他玩家完成或主持人推进下一阶段。</Text>
        )}

        <Text className='icebreaker__helper-text'>已完成 {completedBy.length} / {playerCount} 人</Text>
      </View>
    </View>
  )
}

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
          <Text className='icebreaker__detective-emoji'>🕵️</Text>
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
          <Text className='icebreaker__detective-emoji'>🕵️</Text>
          <Text className='icebreaker__detective-waiting'>等待侦探回合开启…</Text>
        </Card>
      </View>
    )
  }

  return (
    <View className='icebreaker__detective'>
      <Card className='icebreaker__detective-card'>
        <Text className='icebreaker__detective-emoji'>🕵️</Text>
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
            <Text className='icebreaker__detective-voted'>✅ 已提交猜测，再次点击可修改答案</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex === myVoteIndex && (
            <Text className='icebreaker__detective-correct'>🎉 猜对了！</Text>
          )}
          {isRevealed && hasVoted && reveal?.lieIndex !== myVoteIndex && (
            <Text className='icebreaker__detective-wrong'>😅 猜错了</Text>
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
          <Text className='icebreaker__helper-text'>所有侦探回合已完成，可以进入下一阶段。</Text>
        ) : null}
      </View>

      <Text className='icebreaker__detective-progress'>
        {currentPlayerIndex + 1} / {players.length} 位玩家
      </Text>
    </View>
  )
}

export function PersonalityDicePhaseView({
  participants,
  challenges,
  currentPlayerIndex,
  completedBy,
  currentUserId,
  isHost,
  onGenerate,
  onComplete,
  isGenerating,
  isCompleting,
}: {
  participants: SessionParticipant[]
  challenges: PersonalityDiceChallenge[]
  currentPlayerIndex: number
  completedBy: string[]
  currentUserId: string
  isHost: boolean
  onGenerate: () => void
  onComplete: () => void
  isGenerating: boolean
  isCompleting: boolean
}) {
  const currentChallenge = challenges[currentPlayerIndex] ?? null
  const allCompleted = challenges.length > 0 && completedBy.length >= challenges.length
  const isMyChallenge = currentChallenge?.userId === currentUserId
  const hasCompleted = completedBy.includes(currentUserId)

  if (challenges.length === 0) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>🎲</Text>
          <Text className='icebreaker__challenge-title'>人格骰子</Text>
          <Text className='icebreaker__challenge-desc'>
            掷出命运骰子，为每位玩家生成一个专属挑战。
          </Text>
        </Card>

        <View className='icebreaker__action-stack'>
          {isHost ? (
            <Button
              variant='primary'
              className='icebreaker__action-btn'
              onClick={onGenerate}
              disabled={isGenerating}
              loading={isGenerating}
            >
              {isGenerating ? '生成中…' : '掷出人格骰子'}
            </Button>
          ) : (
            <Text className='icebreaker__helper-text'>等待主持人掷出人格骰子…</Text>
          )}
        </View>
      </View>
    )
  }

  if (allCompleted) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card'>
          <Text className='icebreaker__challenge-emoji'>🎲</Text>
          <Text className='icebreaker__challenge-title'>人格骰子完成</Text>
          <Text className='icebreaker__challenge-desc'>
            {participants.length} 位玩家都完成了自己的专属挑战。
          </Text>
        </Card>
        <Text className='icebreaker__helper-text'>主持人现在可以进入回顾阶段。</Text>
      </View>
    )
  }

  return (
    <View className='icebreaker__challenge'>
      <Card className='icebreaker__challenge-card'>
        <Text className='icebreaker__challenge-emoji'>{currentChallenge?.challengeEmoji ?? '🎲'}</Text>
        <Text className='icebreaker__challenge-title'>
          {currentChallenge?.displayName ?? '玩家'} 的挑战
        </Text>
        <Text className='icebreaker__challenge-desc'>
          {currentChallenge?.challengeTitle ?? '挑战准备中'}
        </Text>
        {currentChallenge?.challengeBody ? (
          <Text className='icebreaker__challenge-hint'>{currentChallenge.challengeBody}</Text>
        ) : null}
        <View className='icebreaker__challenge-meta'>
          <Text className='icebreaker__challenge-duration'>
            {currentPlayerIndex + 1} / {challenges.length}
          </Text>
          <Text className='icebreaker__challenge-completed'>
            ✅ {completedBy.length} 人已完成
          </Text>
        </View>
      </Card>

      <View className='icebreaker__action-stack'>
        {isMyChallenge && !hasCompleted ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onComplete}
            disabled={isCompleting}
            loading={isCompleting}
          >
            {isCompleting ? '提交中…' : '我完成了挑战'}
          </Button>
        ) : null}

        {isMyChallenge && hasCompleted ? (
          <Text className='icebreaker__helper-text'>已记录你的挑战完成状态，等待其他玩家完成。</Text>
        ) : null}

        {!isMyChallenge ? (
          <Text className='icebreaker__helper-text'>等待 {currentChallenge?.displayName ?? '当前玩家'} 完成挑战…</Text>
        ) : null}
      </View>
    </View>
  )
}

export function FallbackPhaseView({
  phase,
  isHost,
  onAdvance,
}: {
  phase: SessionPhase
  isHost: boolean
  onAdvance: () => void
}) {
  return (
    <View className='icebreaker__challenge'>
      <Card className='icebreaker__challenge-card'>
        <Text className='icebreaker__challenge-emoji'>🧩</Text>
        <Text className='icebreaker__challenge-title'>{getPhaseLabel(phase)}</Text>
        <Text className='icebreaker__challenge-desc'>这个阶段暂时使用精简版展示。</Text>
      </Card>

      {isHost ? (
        <Button variant='primary' className='icebreaker__action-btn' onClick={onAdvance}>
          继续下一步
        </Button>
      ) : (
        <Text className='icebreaker__helper-text'>等待主持人推进当前阶段。</Text>
      )}
    </View>
  )
}

export function RecapPhaseView({
  recapData,
  summary,
  medals,
  playerCount,
  onLeave,
}: {
  recapData: {
    topicsDiscussed: string[]
    challengesCompleted: number
    lieDetectiveWinner?: string
    funMoments: string[]
  } | null
  summary: {
    headline?: string
    moments?: string[]
    closingLine?: string
  } | null
  medals: Array<{
    emoji: string
    title: string
    recipientDisplayName: string
    description: string
  }>
  playerCount: number
  onLeave: () => void
}) {
  const recapMoments = summary?.moments ?? recapData?.funMoments ?? []

  return (
    <View className='icebreaker__recap'>
      <Card className='icebreaker__recap-card'>
        <Text className='icebreaker__recap-emoji'>✨</Text>
        <Text className='icebreaker__recap-title'>破冰回顾</Text>
        {summary?.headline ? (
          <Text className='icebreaker__recap-subtitle'>{summary.headline}</Text>
        ) : null}
        <Text className='icebreaker__recap-subtitle'>
          今晚 {playerCount} 人一起度过了愉快的破冰时光！
        </Text>
        {summary?.closingLine ? (
          <Text className='icebreaker__recap-subtitle'>{summary.closingLine}</Text>
        ) : null}
      </Card>

      {(recapData || medals.length > 0 || recapMoments.length > 0) && (
        <View className='icebreaker__recap-details'>
          {medals.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>🏅 今晚奖项</Text>
              {medals.map((medal) => (
                <Text key={`${medal.title}-${medal.recipientDisplayName}`} className='icebreaker__recap-item'>
                  {medal.emoji} {medal.title} · {medal.recipientDisplayName} · {medal.description}
                </Text>
              ))}
            </Card>
          )}

          {recapData?.topicsDiscussed.length ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                💬 讨论话题
              </Text>
              {recapData.topicsDiscussed.map((topic, i) => (
                <Text key={i} className='icebreaker__recap-item'>
                  • {topic}
                </Text>
              ))}
            </Card>
          ) : null}

          {(recapData?.challengesCompleted ?? 0) > 0 ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                ⚡ 完成挑战
              </Text>
              <Text className='icebreaker__recap-stat'>
                {recapData?.challengesCompleted} 个挑战
              </Text>
            </Card>
          ) : null}

          {recapData?.lieDetectiveWinner ? (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                🕵️ 最佳侦探
              </Text>
              <Text className='icebreaker__recap-stat'>
                🏆 {recapData.lieDetectiveWinner}
              </Text>
            </Card>
          ) : null}

          {recapMoments.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                😂 精彩瞬间
              </Text>
              {recapMoments.map((moment, i) => (
                <Text key={i} className='icebreaker__recap-item'>
                  • {moment}
                </Text>
              ))}
            </Card>
          )}
        </View>
      )}

      {!recapData && (
        <Card className='icebreaker__recap-section'>
          <Text className='icebreaker__recap-section-title'>
            感谢参与今晚的破冰！
          </Text>
          <Text className='icebreaker__recap-item'>
            希望你和新朋友们建立了更深的连接 🎉
          </Text>
        </Card>
      )}

      <Button variant='primary' className='icebreaker__recap-leave-btn' onClick={onLeave}>
        返回活动
      </Button>
    </View>
  )
}