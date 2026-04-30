import { View, Text, Input, Image } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import JoyJoinIcon from '../../components/JoyJoinIcon'
import ArchetypeGlyph from '../../components/ArchetypeGlyph'
import Card from '../../components/Card'
import Button from '../../components/Button'
import {
  PHASE_CONFIG,
  type AtmosphereMood,
  type LieDetectivePlayer,
  type LieDetectiveReveal,
  type LieDetectiveVote,
  type PersonalityDiceChallenge,
  type SocialIcebreakerPhase,
  type SocialSessionState,
} from '@shared/socialIcebreaker'
import type { MiniScriptStoryFrameworkPublic } from '@shared/miniscriptStoryFramework'
import { useEffect, useRef, useState } from 'react'
import { apiRequest } from '../../lib/api'
import { buildSocialPath } from './icebreakerSessionModel'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import MomentCardView from './MomentCardView'
import { CelebrationOverlay } from './CelebrationOverlay'

export type SessionPhase = 'waiting' | SocialIcebreakerPhase | 'ended'

// Re-export expansion phase views
export { default as QuipBattlePhaseView } from './QuipBattlePhaseView'
export { default as UndercoverWordPhaseView } from './UndercoverWordPhaseView'
export { default as GroupMirrorPhaseView } from './GroupMirrorPhaseView'

export interface SessionParticipant {
  userId: string
  displayName?: string
  archetype?: string
  interests?: string[]
  isHost?: boolean
  isActive?: boolean
}

const MOOD_OPTIONS: Array<{ mood: AtmosphereMood; label: string; asset: string }> = [
  { mood: 'funny', label: '搞笑', asset: require('../../assets/icons/mood-icons/mood-funny.png') },
  { mood: 'life', label: '生活', asset: require('../../assets/icons/mood-icons/mood-life.png') },
  { mood: 'relaxed', label: '轻松', asset: require('../../assets/icons/mood-icons/mood-relaxed.png') },
  { mood: 'emotional', label: '情感', asset: require('../../assets/icons/mood-icons/mood-emotional.png') },
]

export function getPhaseLabel(phase: SessionPhase): string {
  switch (phase) {
    case 'waiting':
      return '等待中'
    case 'warmup':
      return '热身'
    case 'micro_challenge':
      return '挑战'
    case 'lie_detective':
      return '谎言侦探'
    case 'personality_dice':
      return '人格骰子'
    case 'auction':
      return '拍卖'
    case 'quip_battle':
      return '机智对决'
    case 'undercover_word':
      return '谁是卧底'
    case 'group_mirror':
      return '群像镜像'
    case 'mini_script':
      return '迷你剧本杀'
    case 'recap':
      return '回顾'
    case 'ended':
      return '已结束'
    default:
      return phase
  }
}

const PHASE_EMOJI_MAP: Record<SessionPhase, string> = {
  waiting: '',
  warmup: '',
  micro_challenge: '',
  lie_detective: '',
  personality_dice: '',
  auction: '',
  mini_script: '',
  quip_battle: '',
  undercover_word: '',
  group_mirror: '',
  recap: '',
  ended: '',
}

/** Render a phase icon (Lovart 240px source, Taro downscales)
 *
 * Source assets are 240×240px PNG with transparent background.
 * Recommended display sizes:
 *   - 40–48rpx: inline / list / header (default)
 *   - 80rpx:  phase card header
 *   - 120rpx: hero / modal / loading
 *   - 240rpx: full-screen feature (e.g., phase intro)
 */
export function PhaseHeaderIcon({
  phase,
  size = 48,
  className,
}: {
  phase: SessionPhase
  size?: number
  className?: string
}) {
  const sizeStr = `${size}rpx`
  // Canonical filename mapping — WebP primary (~90% smaller than PNG)
  // Fallback to PNG if WebP unsupported (WeChat base lib < 2.9.0, extremely rare)
  const srcMap: Record<string, string> = {
    warmup: require('../../assets/icons/phase-icons/phase-warmup.webp'),
    micro_challenge: require('../../assets/icons/phase-icons/phase-micro-challenge.webp'),
    lie_detective: require('../../assets/icons/phase-icons/phase-lie-detective.webp'),
    personality_dice: require('../../assets/icons/phase-icons/phase-personality-dice.webp'),
    auction: require('../../assets/icons/phase-icons/phase-auction.webp'),
    quip_battle: require('../../assets/icons/phase-icons/phase-quip-battle.webp'),
    undercover_word: require('../../assets/icons/phase-icons/phase-undercover-word.webp'),
    group_mirror: require('../../assets/icons/phase-icons/phase-group-mirror.webp'),
    mini_script: require('../../assets/icons/phase-icons/phase-mini-script.webp'),
    recap: require('../../assets/icons/phase-icons/phase-recap.webp'),
  }
  const src = srcMap[phase]
  if (src) {
    return (
      <Image
        src={src}
        mode='aspectFit'
        className={className}
        style={{ width: sizeStr, height: sizeStr, verticalAlign: 'middle' }}
        lazyLoad
      />
    )
  }
  // Zero-emoji policy: render nothing if asset missing
  return null
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
  onAdvance,
  isGeneratingTopics,
  isUpdatingReady,
  isAdvancingTopic,
  isAdvancing,
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
  onAdvance: () => void
  isGeneratingTopics: boolean
  isUpdatingReady: boolean
  isAdvancingTopic: boolean
  isAdvancing: boolean
}) {
  const currentTopic = topics[currentIndex]
  const isReady = readyUserIds.includes(currentUserId)
  const everyoneReady = participants.length > 0 && readyUserIds.length >= participants.length
  const moodLabel = getMoodLabel(selectedMood)

  return (
    <View className='icebreaker__warmup'>
      {currentTopic ? (
        <Card className='icebreaker__warmup-card'>
          <View className='icebreaker__warmup-emoji'>
            <JoyJoinIcon emoji={currentTopic.emoji ?? ''} size={48} />
          </View>
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
          <View className='icebreaker__warmup-emoji'><PhaseHeaderIcon phase="warmup" size={80} /></View>
          <Text className='icebreaker__warmup-question'>
            热身话题准备中…
          </Text>
        </Card>
      )}

      <View className='icebreaker__warmup-status'>
        <Text className='icebreaker__warmup-ready-count'>
          {readyUserIds.length} / {participants.length} 人已准备
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
              {p.archetype && (
                <ArchetypeGlyph archetype={p.archetype} size={16} />
              )}
              {p.isHost && (
                <Image
                  src={require('../../assets/icons/status-icons/status-crown.png')}
                  style={{ width: '20rpx', height: '20rpx', marginLeft: '4rpx' }}
                  lazyLoad
                  className='icebreaker__participant-host'
                />
              )}
              {readyUserIds.includes(p.userId) && (
                <Text className='icebreaker__participant-check'>已加入</Text>
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
                    <Image
                      src={option.asset}
                      style={{ width: '48rpx', height: '48rpx' }}
                      lazyLoad
                      className='icebreaker__mood-option-emoji'
                    />
                    <Text className='icebreaker__mood-option-label'>{option.label}</Text>
                  </View>
                ))}
              </View>
              <Text className='icebreaker__helper-text'>
                {isGeneratingTopics ? `${DEFAULT_MASCOT_DISPLAY_NAME}正在根据你选的氛围出题…` : `先选一个氛围，${DEFAULT_MASCOT_DISPLAY_NAME}会生成这一轮的热身题目。`}
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
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--micro-challenge'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="micro_challenge" size={80} /></View>
          <Text className='icebreaker__challenge-title'>{challenge.title}</Text>
          <Text className='icebreaker__challenge-desc'>{challenge.description}</Text>
          {challenge.visualHint && (
            <Text className='icebreaker__challenge-hint'>提示：{challenge.visualHint}</Text>
          )}
          <View className='icebreaker__challenge-meta'>
            <Text className='icebreaker__challenge-duration'>
              ⏱ {challenge.durationSeconds}秒
            </Text>
            <Text className='icebreaker__challenge-completed'>
              {completedBy.length} 人已完成
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
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--micro-challenge'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="micro_challenge" size={80} /></View>
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

export function PersonalityDicePhaseView({
  participants,
  challenges,
  currentPlayerIndex,
  completedBy,
  passedBy,
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
  passedBy: string[]
  currentUserId: string
  isHost: boolean
  onGenerate: () => void
  onComplete: (pass?: boolean) => void
  isGenerating: boolean
  isCompleting: boolean
}) {
  const currentChallenge = challenges[currentPlayerIndex] ?? null
  const isMyChallenge = currentChallenge?.userId === currentUserId
  const hasCompleted = completedBy.includes(currentUserId)
  const hasPassed = passedBy.includes(currentUserId)
  const hasResponded = hasCompleted || hasPassed
  const allCompleted = challenges.length > 0 && (completedBy.length + passedBy.length) >= challenges.length
  const [showReveal, setShowReveal] = useState(false)
  const [showPassModal, setShowPassModal] = useState(false)
  const prevChallengesLenRef = useRef(0)

  useEffect(() => {
    if (challenges.length > 0 && prevChallengesLenRef.current === 0) {
      setShowReveal(true)
    }
    prevChallengesLenRef.current = challenges.length
  }, [challenges.length])

  if (challenges.length === 0) {
    return (
      <View className='icebreaker__challenge'>
        <CelebrationOverlay
          visible={showReveal}
          frameKey='dice_reveal'
          title='人格骰子已掷出'
          subtitle='看看命运为你准备了什么挑战'
          autoDismissMs={2500}
          onDismiss={() => setShowReveal(false)}
        />
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--personality-dice icebreaker__challenge-card--has-bg'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="personality_dice" size={80} /></View>
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
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--personality-dice icebreaker__challenge-card--has-bg'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="personality_dice" size={80} /></View>
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
      <CelebrationOverlay
        visible={showReveal}
        frameKey='dice_reveal'
        title='人格骰子已掷出'
        subtitle={`${currentChallenge?.displayName ?? ''} 的挑战已揭晓`}
        autoDismissMs={2500}
        onDismiss={() => setShowReveal(false)}
      />
      <Card className='icebreaker__challenge-card icebreaker__challenge-card--personality-dice icebreaker__challenge-card--has-bg'>
        <View className='icebreaker__challenge-emoji'>
          <PhaseHeaderIcon phase="personality_dice" size={48} />
        </View>
        <Text className='icebreaker__challenge-title'>
          {currentChallenge?.displayName ?? '玩家'} 的挑战
        </Text>
        <Text className='icebreaker__challenge-desc'>
          {currentChallenge?.challengeTitle ?? '挑战准备中'}
        </Text>
        {currentChallenge?.challengeBody ? (
          <Text className='icebreaker__challenge-hint'>{currentChallenge.challengeBody}</Text>
        ) : null}
        {currentChallenge?.passLine ? (
          <Text className='icebreaker__challenge-hint' style={{ opacity: 0.8 }}>
            或者你可以{currentChallenge.passLine}
          </Text>
        ) : null}
        <View className='icebreaker__challenge-meta'>
          <Text className='icebreaker__challenge-duration'>
            {currentPlayerIndex + 1} / {challenges.length}
          </Text>
          <Text className='icebreaker__challenge-completed'>
            {completedBy.length} 人已完成
          </Text>
        </View>
      </Card>

      {/* Pass confirm modal */}
      {showPassModal && currentChallenge?.passConsequence ? (
        <View className='icebreaker__modal-backdrop' catchMove>
          <View className='icebreaker__modal-card'>
            <Text className='icebreaker__modal-title'>确定要认怂？</Text>
            <Text className='icebreaker__modal-body'>
              认怂后果：{currentChallenge.passConsequence}
            </Text>
            <View className='icebreaker__modal-actions'>
              <Button
                variant='secondary'
                className='icebreaker__modal-btn'
                onClick={() => setShowPassModal(false)}
              >
                我再想想
              </Button>
              <Button
                variant='primary'
                className='icebreaker__modal-btn'
                onClick={() => {
                  setShowPassModal(false)
                  onComplete(true)
                }}
                disabled={isCompleting}
                loading={isCompleting}
              >
                {isCompleting ? '提交中…' : '确认认怂'}
              </Button>
            </View>
          </View>
        </View>
      ) : null}

      <View className='icebreaker__action-stack'>
        {isMyChallenge && !hasResponded ? (
          <View style={{ display: 'flex', flexDirection: 'column', gap: '16rpx', width: '100%' }}>
            <Button
              variant='primary'
              className='icebreaker__action-btn'
              onClick={() => onComplete(false)}
              disabled={isCompleting}
              loading={isCompleting}
            >
              <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8rpx' }}>
                <Image src={require('../../assets/lovart/icebreaker/icons/icon-dice-accept.png')} mode='aspectFit' style={{ width: '36rpx', height: '36rpx' }} />
                <Text>{isCompleting ? '提交中…' : '接受挑战'}</Text>
              </View>
            </Button>
            <Button
              variant='secondary'
              className='icebreaker__action-btn'
              onClick={() => setShowPassModal(true)}
              disabled={isCompleting}
            >
              <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8rpx' }}>
                <Image src={require('../../assets/lovart/icebreaker/icons/icon-dice-pass.png')} mode='aspectFit' style={{ width: '36rpx', height: '36rpx' }} />
                <Text>认怂</Text>
              </View>
            </Button>
          </View>
        ) : null}

        {isMyChallenge && hasCompleted ? (
          <View className='icebreaker__dice-badge icebreaker__dice-badge--accept'>
            <Image src={require('../../assets/lovart/icebreaker/icons/icon-dice-accept.png')} mode='aspectFit' style={{ width: '28rpx', height: '28rpx' }} />
            <Text className='icebreaker__dice-badge-text'>已完成挑战</Text>
          </View>
        ) : null}

        {isMyChallenge && hasPassed ? (
          <View className='icebreaker__dice-badge icebreaker__dice-badge--pass'>
            <Image src={require('../../assets/lovart/icebreaker/icons/icon-dice-pass.png')} mode='aspectFit' style={{ width: '28rpx', height: '28rpx' }} />
            <Text className='icebreaker__dice-badge-text'>已认怂</Text>
          </View>
        ) : null}

        {!isMyChallenge && hasResponded ? (
          <Text className='icebreaker__helper-text'>
            {hasPassed
              ? `${currentChallenge?.displayName ?? 'TA'} 认怂了：${currentChallenge?.passConsequence ?? ''}`
              : `${currentChallenge?.displayName ?? 'TA'} 接受了挑战，正在执行中…`}
          </Text>
        ) : null}

        {!isMyChallenge && !hasResponded ? (
          <Text className='icebreaker__helper-text'>等待 {currentChallenge?.displayName ?? '当前玩家'} 完成挑战…</Text>
        ) : null}
      </View>
    </View>
  )
}

export interface AuctionBidRecord {
  userId: string
  displayName: string
  amount: number
  at: number
}

export function AuctionPhaseView({
  session,
  currentUserId,
  isHost,
  onGenerateLots,
  onPlaceBid,
  onCloseLot,
  onAdvance,
  isAdvancing,
  isGeneratingLots,
  isPlacingBid,
  isClosingLot,
}: {
  session: SocialSessionState
  currentUserId: string
  isHost: boolean
  onGenerateLots: () => void
  onPlaceBid: (amount: number) => void
  onCloseLot: () => void
  onAdvance: () => void
  isAdvancing: boolean
  isGeneratingLots: boolean
  isPlacingBid: boolean
  isClosingLot: boolean
}) {
  const [bidText, setBidText] = useState('10')
  const [bidError, setBidError] = useState('')
  const [showSold, setShowSold] = useState(false)
  const [showLotSold, setShowLotSold] = useState(false)
  const [timeLeft, setTimeLeft] = useState(30)
  const [bidHistory, setBidHistory] = useState<AuctionBidRecord[]>([])
  const lots = session.auctionLots ?? []
  const idx = session.auctionCurrentLotIndex ?? 0
  const currentLot = lots[idx]
  const high = session.auctionHighBid
  const balance = session.auctionBalances?.[currentUserId] ?? 0
  const allClosed = session.auctionAllLotsClosed ?? false
  const prevAllClosedRef = useRef(false)
  const prevIdxRef = useRef(idx)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const nameOf = (uid: string) =>
    session.joinedParticipants?.find((p) => p.userId === uid)?.displayName ?? '匿名'

  // Countdown timer: 30s per lot
  useEffect(() => {
    setTimeLeft(30)
    if (timerRef.current) {
      clearInterval(timerRef.current)
    }
    timerRef.current = setInterval(() => {
      setTimeLeft((prev) => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current)
          return 0
        }
        return prev - 1
      })
    }, 1000)
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [idx])

  useEffect(() => {
    setBidText('10')
    setBidError('')
    // Detect lot change (host closed previous lot)
    if (idx > prevIdxRef.current && prevIdxRef.current >= 0) {
      setShowLotSold(true)
      setBidHistory([])
    }
    prevIdxRef.current = idx
  }, [idx])

  useEffect(() => {
    if (allClosed && !prevAllClosedRef.current) {
      setShowSold(true)
    }
    prevAllClosedRef.current = allClosed
  }, [allClosed])

  // Sync bid history from server high bid
  useEffect(() => {
    if (!high) return
    setBidHistory((prev) => {
      if (prev.length > 0) {
        const last = prev[prev.length - 1]
        if (last.amount === high.amount && last.userId === high.userId) {
          return prev
        }
      }
      return [
        ...prev,
        { userId: high.userId, displayName: nameOf(high.userId), amount: high.amount, at: Date.now() },
      ]
    })
  }, [high?.amount, high?.userId])

  if (lots.length === 0) {
    return (
      <View className='icebreaker__challenge'>
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--auction icebreaker__challenge-card--has-bg'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="auction" size={80} /></View>
          <Text className='icebreaker__challenge-title'>脑洞拍卖会</Text>
          <Text className='icebreaker__challenge-desc'>
            虚拟币竞拍，仅供娱乐。主持人生成竞拍条目后，大家按轮出价。
          </Text>
        </Card>
        {isHost ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onGenerateLots}
            disabled={isGeneratingLots}
            loading={isGeneratingLots}
          >
            {isGeneratingLots ? '生成中…' : '生成竞拍条目'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>等待主持人生成竞拍条目…</Text>
        )}
      </View>
    )
  }

  if (allClosed) {
    return (
      <View className='icebreaker__challenge'>
        <CelebrationOverlay
          visible={showSold}
          frameKey='auction_sold'
          title='拍卖圆满结束'
          subtitle='所有竞拍条目均已成交'
          autoDismissMs={3000}
          onDismiss={() => setShowSold(false)}
        />
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--auction icebreaker__challenge-card--has-bg'>
          <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="auction" size={80} /></View>
          <Text className='icebreaker__challenge-title'>拍卖结束</Text>
          <Text className='icebreaker__challenge-desc'>全部竞拍已完成。</Text>
        </Card>
        {isHost ? (
          <Button
            variant='primary'
            className='icebreaker__action-btn'
            onClick={onAdvance}
            disabled={isAdvancing}
            loading={isAdvancing}
          >
            {isAdvancing ? '切换中…' : '进入下一阶段'}
          </Button>
        ) : (
          <Text className='icebreaker__helper-text'>等待主持人进入下一阶段…</Text>
        )}
      </View>
    )
  }

  const timerUrgent = timeLeft <= 10 && timeLeft > 0
  const timerExpired = timeLeft <= 0
  const minBid = (high?.amount ?? 0) + 1
  const canBid = !isHost && !timerExpired && balance >= minBid

  const handleQuickBid = (amount: number) => {
    if (amount <= (high?.amount ?? 0)) {
      setBidError('出价须高于当前最高')
      return
    }
    if (amount > balance) {
      setBidError('余额不足')
      return
    }
    setBidError('')
    onPlaceBid(amount)
  }

  return (
    <View className='icebreaker__challenge'>
      <CelebrationOverlay
        visible={showLotSold}
        frameKey='auction_sold'
        title='成交！'
        subtitle={high ? `${nameOf(high.userId)} 以 ${high.amount} 币拍下` : '本标无人出价'}
        autoDismissMs={2000}
        onDismiss={() => setShowLotSold(false)}
      />

      <Card className='icebreaker__challenge-card icebreaker__challenge-card--auction icebreaker__challenge-card--has-bg'>
        <View className='icebreaker__challenge-emoji'><PhaseHeaderIcon phase="auction" size={80} /></View>
        <Text className='icebreaker__challenge-title'>第 {idx + 1} / {lots.length} 标</Text>
        <Text className='icebreaker__challenge-desc'>{currentLot?.title ?? ''}</Text>
        {currentLot?.teaser ? (
          <Text className='icebreaker__challenge-hint'>{currentLot.teaser}</Text>
        ) : null}

        {/* Timer */}
        <View className={`icebreaker__auction-timer${timerUrgent ? ' icebreaker__auction-timer--urgent' : ''}${timerExpired ? ' icebreaker__auction-timer--expired' : ''}`}>
          <Text className='icebreaker__auction-timer-value'>
            {timerExpired ? '时间到' : `00:${timeLeft.toString().padStart(2, '0')}`}
          </Text>
        </View>

        <View className='icebreaker__challenge-meta'>
          <Text className='icebreaker__challenge-duration'>
            <Image src={require('../../assets/lovart/icebreaker/icons/icon-coin-single.png')} mode='aspectFit' style={{ width: '28rpx', height: '28rpx', marginRight: '6rpx', verticalAlign: 'middle' }} />
            当前最高：{high ? `${high.amount}` : '暂无'}
          </Text>
          <Text className='icebreaker__challenge-completed'>
            <Image src={require('../../assets/lovart/icebreaker/icons/icon-coin-stack.png')} mode='aspectFit' style={{ width: '28rpx', height: '28rpx', marginRight: '6rpx', verticalAlign: 'middle' }} />
            余额：{balance}
          </Text>
        </View>
      </Card>

      {/* Bid history */}
      {bidHistory.length > 0 && (
        <View className='icebreaker__auction-history'>
          <Text className='icebreaker__auction-history-title'>出价记录</Text>
          {bidHistory.slice(-5).map((bid, i) => (
            <View key={`${bid.userId}-${bid.amount}-${i}`} className='icebreaker__auction-history-row'>
              <Text className='icebreaker__auction-history-name'>{bid.displayName}</Text>
              <Text className='icebreaker__auction-history-amount'>{bid.amount} 币</Text>
            </View>
          ))}
        </View>
      )}

      {!isHost ? (
        <View className='icebreaker__action-stack'>
          {timerExpired ? (
            <Text className='icebreaker__helper-text'>时间到，等待主持人落槌…</Text>
          ) : (
            <>
              <Text className='icebreaker__helper-text'>选择快捷出价或自定义金额</Text>

              {/* Quick-bid buttons */}
              <View className='icebreaker__auction-quick-bids'>
                <Button
                  variant='secondary'
                  className='icebreaker__auction-quick-btn'
                  onClick={() => handleQuickBid((high?.amount ?? 0) + 5)}
                  disabled={!canBid || isPlacingBid || balance < ((high?.amount ?? 0) + 5)}
                >
                  +5
                </Button>
                <Button
                  variant='secondary'
                  className='icebreaker__auction-quick-btn'
                  onClick={() => handleQuickBid((high?.amount ?? 0) + 10)}
                  disabled={!canBid || isPlacingBid || balance < ((high?.amount ?? 0) + 10)}
                >
                  +10
                </Button>
                <Button
                  variant='secondary'
                  className='icebreaker__auction-quick-btn'
                  onClick={() => handleQuickBid(balance)}
                  disabled={!canBid || isPlacingBid || balance <= (high?.amount ?? 0)}
                >
                  ALL IN
                </Button>
              </View>

              <Input
                type='number'
                className='icebreaker__input'
                value={bidText}
                onInput={(e) => setBidText(e.detail.value)}
                placeholder={`最低出价 ${minBid}`}
              />
              {bidError ? (
                <View style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8rpx', marginBottom: '8rpx' }}>
                  <Image src={require('../../assets/lovart/icebreaker/icons/icon-coin-empty.png')} mode='aspectFit' style={{ width: '32rpx', height: '32rpx' }} />
                  <Text className='icebreaker__error'>{bidError}</Text>
                </View>
              ) : null}
              <Button
                variant='primary'
                className='icebreaker__action-btn'
                onClick={() => {
                  const n = Number.parseInt(bidText, 10)
                  if (!Number.isFinite(n) || n <= 0) {
                    setBidError('出价须为正整数')
                    return
                  }
                  if (high && n <= high.amount) {
                    setBidError(`出价须高于当前最高 ${high.amount} 币`)
                    return
                  }
                  if (n > balance) {
                    setBidError(`余额不足，当前余额 ${balance} 币`)
                    return
                  }
                  setBidError('')
                  onPlaceBid(n)
                }}
                disabled={isPlacingBid || timerExpired}
                loading={isPlacingBid}
              >
                {isPlacingBid ? '提交中…' : '出价'}
              </Button>
            </>
          )}
        </View>
      ) : null}

      {isHost ? (
        <Button
          variant='secondary'
          className='icebreaker__action-btn'
          onClick={onCloseLot}
          disabled={isClosingLot}
          loading={isClosingLot}
        >
          {isClosingLot ? '处理中…' : timerExpired ? '时间到，落槌' : '关闭本标（落槌）'}
        </Button>
      ) : null}
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
      <Card className={`icebreaker__challenge-card icebreaker__challenge-card--${phase}`}>
        <PhaseHeaderIcon phase={phase} size={48} />
        <Text className='icebreaker__challenge-title' style={{ marginTop: '12rpx' }}>{getPhaseLabel(phase)}</Text>
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

function RecapAiFeedbackBar({
  socialSessionId,
  recapMeta,
}: {
  socialSessionId: string
  recapMeta?: AIResponseMeta | null
}) {
  const [done, setDone] = useState(false)
  const [busy, setBusy] = useState(false)
  if (!recapMeta?.promptVersion || !recapMeta.aiCorrelationId) {
    return null
  }
  if (done) {
    return (
      <Card className='icebreaker__recap-section'>
        <Text className='icebreaker__recap-item'>感谢你的反馈</Text>
      </Card>
    )
  }
  const submit = async (rating: 'helpful' | 'neutral' | 'awkward') => {
    if (busy) return
    setBusy(true)
    try {
      await apiRequest({
        path: buildSocialPath(socialSessionId, '/ai-feedback'),
        method: 'POST',
        data: {
          phase: 'recap',
          promptVersion: recapMeta.promptVersion,
          aiCorrelationId: recapMeta.aiCorrelationId,
          rating,
        },
      })
      setDone(true)
    } catch {
      setBusy(false)
    }
  }
  return (
    <Card className='icebreaker__recap-section'>
      <Text className='icebreaker__recap-section-title'>这场 AI 回顾有帮助吗？</Text>
      <View className='icebreaker__feedback-row'>
        <Button variant='secondary' disabled={busy} onClick={() => void submit('helpful')}>
          有帮助
        </Button>
        <Button variant='secondary' disabled={busy} onClick={() => void submit('neutral')}>
          一般
        </Button>
        <Button variant='secondary' disabled={busy} onClick={() => void submit('awkward')}>
          略尴尬
        </Button>
      </View>
    </Card>
  )
}

export function RecapPhaseView({
  recapData,
  summary,
  medals,
  playerCount,
  onLeave,
  socialSessionId,
  recapMeta,
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
  socialSessionId?: string | null
  recapMeta?: AIResponseMeta | null
}) {
  const recapMoments = summary?.moments ?? recapData?.funMoments ?? []

  return (
    <View className='icebreaker__recap'>
      <Card className='icebreaker__recap-card'>
        <View className='icebreaker__recap-emoji'><PhaseHeaderIcon phase="recap" size={120} /></View>
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

      {socialSessionId ? (
        <RecapAiFeedbackBar socialSessionId={socialSessionId} recapMeta={recapMeta} />
      ) : null}

      {(recapData || medals.length > 0 || recapMoments.length > 0) && (
        <View className='icebreaker__recap-details'>
          {medals.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>今晚奖项</Text>
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
                讨论话题
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
              <View className='icebreaker__recap-section-title' style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                <PhaseHeaderIcon phase="micro_challenge" size={36} />
                <Text>完成挑战</Text>
              </View>
              <Text className='icebreaker__recap-stat'>
                {recapData?.challengesCompleted} 个挑战
              </Text>
            </Card>
          ) : null}

          {recapData?.lieDetectiveWinner ? (
            <Card className='icebreaker__recap-section'>
              <View className='icebreaker__recap-section-title' style={{ display: 'flex', alignItems: 'center', gap: '8rpx' }}>
                <PhaseHeaderIcon phase="lie_detective" size={36} />
                <Text>最佳侦探</Text>
              </View>
              <Text className='icebreaker__recap-stat'>
                {recapData.lieDetectiveWinner}
              </Text>
            </Card>
          ) : null}

          {recapMoments.length > 0 && (
            <Card className='icebreaker__recap-section'>
              <Text className='icebreaker__recap-section-title'>
                精彩瞬间
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
            希望你和新朋友们建立了更深的连接
          </Text>
        </Card>
      )}

      {socialSessionId && (
        <MomentCardCTA socialSessionId={socialSessionId} />
      )}

      <Button variant='primary' className='icebreaker__recap-leave-btn' onClick={onLeave}>
        返回活动
      </Button>
    </View>
  )
}
// Append MomentCardCTA component

// ---------------------------------------------------------------------------
// Moment Card CTA (embedded in RecapPhaseView)
// ---------------------------------------------------------------------------

function MomentCardCTA({ socialSessionId }: { socialSessionId: string }) {
  const [showCard, setShowCard] = useState(false);
  const [payload, setPayload] = useState<any>(null);

  const handleOpen = async () => {
    try {
      const res = await apiRequest<any>({
        path: buildSocialPath(socialSessionId, '/moment-card'),
      });
      if (res?.payload) {
        setPayload(res.payload);
        setShowCard(true);
      }
    } catch {
      // Silently fail — Moment Card is a bonus, not a blocker
    }
  };

  return (
    <>
      <Card
        className='icebreaker__recap-section'
        style={{ backgroundColor: '#1a1a2e', borderColor: '#ffd700' }}
      >
        <View style={{ display: 'flex', alignItems: 'center', gap: '16rpx' }}>
          <View style={{ width: '40rpx', height: '40rpx', borderRadius: '20rpx', backgroundColor: '#ffd700' }} />
          <View style={{ flex: 1 }}>
            <Text className='icebreaker__recap-section-title' style={{ color: '#ffd700' }}>
              生成专属回忆卡
            </Text>
            <Text className='icebreaker__recap-item' style={{ color: '#aaaaaa' }}>
              保存今晚的专属记忆，分享给朋友
            </Text>
          </View>
          <Button variant='primary' onClick={handleOpen}>
            生成
          </Button>
        </View>
      </Card>

      {payload && (
        <MomentCardView
          payload={payload}
          visible={showCard}
          onClose={() => setShowCard(false)}
        />
      )}
    </>
  );
}
