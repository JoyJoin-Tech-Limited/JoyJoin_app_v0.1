import { View, Text } from '@tarojs/components'
import { useCallback, useEffect, useRef, useState } from 'react'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Card from '../../../components/ui/Card'
import Chip from '../../../components/ui/Chip'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'
import type { PersonalityDiceChallenge, PersonalityDiceChallengeGroup } from '@shared/socialIcebreaker'
import { getArchetypeHSL } from '@shared/archetypeColors'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'
import { CardFlip, ParticleBurst } from '../../../components/reveal'
import { SwipeCard, TapReaction } from '../../../components/gesture'
import './PersonalityDicePhaseView.scss'

// ─── Helpers ──────────────────────────────────────────────────────

function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color)
      .toString(16)
      .padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const REACTION_ITEMS = [
  { emoji: '👏', label: '鼓掌' },
  { emoji: '🎉', label: '庆祝' },
  { emoji: '😂', label: '好笑' },
  { emoji: '🔥', label: '燃' },
]

// ─── Types ────────────────────────────────────────────────────────

export interface PersonalityDicePhaseViewProps {
  participants: import('../phaseUtils').SessionParticipant[]
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
  /** Optional: spectator reaction callback */
  onReact?: (emoji: string) => void
  /** Optional: reaction counts keyed by emoji */
  reactions?: Record<string, number>
  /** Optional: override archetype for particle colour */
  currentPlayerArchetype?: string
  /** Optional: host CTA to advance phase (e.g. into recap) */
  onAdvance?: () => void
  /** Choose-Your-Prompt variant (behind PERSONALITY_DICE_CHOOSE_MODE_ENABLED) */
  chooseModeEnabled?: boolean
  challengeGroups?: PersonalityDiceChallengeGroup[]
  selectedOption?: Record<string, number>
  onChoose?: (optionIndex: number) => void
  isChoosing?: boolean
}

// ─── Component ────────────────────────────────────────────────────

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
  onReact,
  reactions,
  currentPlayerArchetype,
  onAdvance,
  chooseModeEnabled = false,
  challengeGroups = [],
  selectedOption = {},
  onChoose,
  isChoosing = false,
}: PersonalityDicePhaseViewProps) {
  const currentChallenge = challenges[currentPlayerIndex] ?? null
  const currentDisplayName =
    currentChallenge?.displayName ??
    participants[currentPlayerIndex]?.displayName ??
    '当前玩家'
  const archetype = currentPlayerArchetype ?? currentChallenge?.archetype
  const hsl = getArchetypeHSL(archetype)
  const spotlightColor = hslToHex(hsl.h, hsl.s, hsl.l)

  // ── Optimistic state ────────────────────────────────────────────
  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [showPassReveal, setShowPassReveal] = useState(false)
  const [shakeCard, setShakeCard] = useState(false)
  const [burstTrigger, setBurstTrigger] = useState(false)
  const [selectedReaction, setSelectedReaction] = useState<number | null>(null)
  const [showReveal, setShowReveal] = useState(false)
  const [flipped, setFlipped] = useState(() => challenges.length > 0)
  const prevChallengesLenRef = useRef(0)
  const prevGroupsLenRef = useRef(0)
  const prevIsCompletingRef = useRef(false)

  const effectiveCompletedBy =
    pendingUserId && !passedBy.includes(pendingUserId)
      ? [...completedBy, pendingUserId]
      : completedBy

  const effectivePassedBy =
    pendingUserId && !completedBy.includes(pendingUserId)
      ? [...passedBy, pendingUserId]
      : passedBy

  const isMyChallenge =
    chooseModeEnabled && challengeGroups.length > 0
      ? participants[currentPlayerIndex]?.userId === currentUserId
      : currentChallenge?.userId === currentUserId
  const hasCompleted = effectiveCompletedBy.includes(currentUserId)
  const hasPassed = effectivePassedBy.includes(currentUserId)
  const hasResponded = hasCompleted || hasPassed
  const allCompleted = chooseModeEnabled && challengeGroups.length > 0
    ? challengeGroups.length > 0 &&
      (effectiveCompletedBy.length + effectivePassedBy.length) >= challengeGroups.length
    : challenges.length > 0 &&
      (effectiveCompletedBy.length + effectivePassedBy.length) >= challenges.length

  // ── Effects ─────────────────────────────────────────────────────

  useEffect(() => {
    const hasContent = challenges.length > 0 || challengeGroups.length > 0
    const prevHadContent = prevChallengesLenRef.current > 0 || prevGroupsLenRef.current > 0
    if (hasContent && !prevHadContent) {
      setShowReveal(true)
      setFlipped(true)
    }
    prevChallengesLenRef.current = challenges.length
    prevGroupsLenRef.current = challengeGroups.length
  }, [challenges.length, challengeGroups.length])

  // Clear pending when server confirms
  useEffect(() => {
    if (
      pendingUserId &&
      (completedBy.includes(pendingUserId) || passedBy.includes(pendingUserId))
    ) {
      setPendingUserId(null)
    }
  }, [completedBy, passedBy, pendingUserId])

  // Shake + revert on server rejection
  useEffect(() => {
    if (prevIsCompletingRef.current && !isCompleting && pendingUserId) {
      const wasConfirmed =
        completedBy.includes(pendingUserId) || passedBy.includes(pendingUserId)
      if (!wasConfirmed) {
        setShakeCard(true)
        setTimeout(() => setShakeCard(false), 500)
        setShowPassReveal(false)
        setBurstTrigger(false)
      }
      setPendingUserId(null)
    }
    prevIsCompletingRef.current = isCompleting
  }, [isCompleting, pendingUserId, completedBy, passedBy])

  // ── Handlers ────────────────────────────────────────────────────

  const handleAccept = useCallback(() => {
    if (isCompleting || pendingUserId) return
    setPendingUserId(currentUserId)
    setBurstTrigger(true)
    setTimeout(() => setBurstTrigger(false), 2500)
    onComplete(false)
  }, [isCompleting, pendingUserId, currentUserId, onComplete])

  const handlePass = useCallback(() => {
    if (isCompleting || pendingUserId) return
    setPendingUserId(currentUserId)
    setShowPassReveal(true)
    onComplete(true)
  }, [isCompleting, pendingUserId, currentUserId, onComplete])

  const handleReaction = useCallback(
    (index: number) => {
      setSelectedReaction(index)
      onReact?.(REACTION_ITEMS[index].emoji)
    },
    [onReact],
  )

  // ── Render helpers ──────────────────────────────────────────────

  const diceFace = (
    <View className='personality-dice__dice-face'>
      <JoyJoinIcon emoji='🎲' size={56} className='personality-dice__dice-emoji' />
      <Text className='personality-dice__dice-title'>人格骰子</Text>
      <Text className='personality-dice__dice-desc'>
        掷出命运骰子，为每位玩家生成一个专属挑战。
      </Text>
    </View>
  )

  const challengeFace = (
    <View
      key={currentPlayerIndex}
      className='personality-dice__challenge-face'
    >
      <JoyJoinIcon emoji={currentChallenge?.challengeEmoji ?? '🎲'} size={48} className='personality-dice__challenge-emoji' />
      <Text className='personality-dice__challenge-player'>
        {currentChallenge?.displayName ?? '玩家'} 的挑战
      </Text>
      <Text className='personality-dice__challenge-title'>
        {currentChallenge?.challengeTitle ?? '挑战准备中'}
      </Text>
      {currentChallenge?.challengeBody ? (
        <Text className='personality-dice__challenge-body'>
          {currentChallenge.challengeBody}
        </Text>
      ) : null}
      {currentChallenge?.passLine ? (
        <Text className='personality-dice__challenge-pass-line'>
          或者你可以{currentChallenge.passLine}
        </Text>
      ) : null}
      <View className='personality-dice__challenge-meta'>
        <Text className='personality-dice__challenge-meta-item'>
          {currentPlayerIndex + 1} / {challenges.length}
        </Text>
        <Text className='personality-dice__challenge-meta-item personality-dice__challenge-meta-item--completed'>
          {effectiveCompletedBy.length} 人已完成
        </Text>
      </View>
    </View>
  )

  // ── All-completed summary ───────────────────────────────────────

  if (allCompleted) {
    const completedPlayers = (chooseModeEnabled && challengeGroups.length > 0 ? challengeGroups : challenges)
      .filter((c: any) => effectiveCompletedBy.includes(c.userId))
      .map((c: any) => ({ name: c.displayName, passed: false }))
    const passedPlayers = (chooseModeEnabled && challengeGroups.length > 0 ? challengeGroups : challenges)
      .filter((c: any) => effectivePassedBy.includes(c.userId))
      .map((c: any) => ({ name: c.displayName, passed: true }))

    return (
      <View className='personality-dice'>
        <View className='personality-dice__burst-container personality-dice__burst-container--summary'>
          <ParticleBurst trigger={true} type='confetti' count={50} />
        </View>
        <Card className='personality-dice__summary-card'>
          <View className='personality-dice__summary-emoji'>
            <PhaseHeaderIcon phase='personality_dice' size={80} />
          </View>
          <Text className='personality-dice__summary-title'>
            人格骰子完成
          </Text>
          <Text className='personality-dice__summary-subtitle'>
            {participants.length} 位玩家都完成了自己的专属挑战
          </Text>

          <View className='personality-dice__summary-list'>
            {completedPlayers.map((p, i) => (
              <View
                key={`c-${i}`}
                className='personality-dice__summary-row'
                style={{ animationDelay: `${i * 80}ms` }}
              >
                <Text className='personality-dice__summary-check'>✅</Text>
                <Text className='personality-dice__summary-name'>
                  {p.name}
                </Text>
                <Text className='personality-dice__summary-tag personality-dice__summary-tag--completed'>
                  完成
                </Text>
              </View>
            ))}
            {passedPlayers.map((p, i) => (
              <View
                key={`p-${i}`}
                className='personality-dice__summary-row'
                style={{
                  animationDelay: `${(completedPlayers.length + i) * 80}ms`,
                }}
              >
                <JoyJoinIcon emoji='😅' size={24} className='personality-dice__summary-check' />
                <Text className='personality-dice__summary-name'>
                  {p.name}
                </Text>
                <Text className='personality-dice__summary-tag personality-dice__summary-tag--passed'>
                  认怂
                </Text>
              </View>
            ))}
          </View>

          {isHost && onAdvance ? (
            <Button
              variant='primary'
              className='personality-dice__summary-cta'
              onClick={onAdvance}
            >
              进入回顾
            </Button>
          ) : null}
        </Card>
      </View>
    )
  }

  // ── Main active view ────────────────────────────────────────────

  return (
    <View className='personality-dice'>
      <CelebrationOverlay
        visible={showReveal}
        frameKey='dice_reveal'
        title='人格骰子已掷出'
        subtitle={
          currentChallenge
            ? `${currentChallenge.displayName} 的挑战已揭晓`
            : challengeGroups.length > 0
              ? '看看有哪些挑战可以选择'
              : '看看命运为你准备了什么挑战'
        }
        autoDismissMs={1500}
        onDismiss={() => setShowReveal(false)}
      />

      <View
        className={`personality-dice__card${shakeCard ? ' personality-dice__card--shake' : ''}`}
      >
        <CardFlip
          front={diceFace}
          back={challengeFace}
          flipped={challenges.length > 0 && flipped && !chooseModeEnabled && challengeGroups.length === 0}
          duration={400}
        />
      </View>

      <View className='personality-dice__burst-container'>
        <ParticleBurst
          trigger={burstTrigger}
          type='confetti'
          count={40}
          spotlightColor={spotlightColor}
        />
      </View>

      {chooseModeEnabled && challengeGroups.length > 0 && (
        <View className='personality-dice__card'>
          <View className='personality-dice__dice-face personality-dice__dice-face--choose'>
            <JoyJoinIcon emoji='🎲' size={56} className='personality-dice__dice-emoji' />
            <Text className='personality-dice__dice-title'>人格骰子</Text>
            <Text className='personality-dice__dice-desc'>
              选择你的挑战难度，命运在你手中。
            </Text>
          </View>
        </View>
      )}

      <View className='personality-dice__action-area'>
        {challenges.length === 0 && challengeGroups.length === 0 ? (
          <View className='personality-dice__action-stack'>
            {isHost ? (
              <Button
                variant='primary'
                className='personality-dice__action-btn'
                onClick={onGenerate}
                disabled={isGenerating}
                loading={isGenerating}
              >
                {isGenerating ? '生成中…' : '掷出人格骰子'}
              </Button>
            ) : (
              <Text className='personality-dice__helper-text'>
                等待主持人掷出人格骰子…
              </Text>
            )}
          </View>
        ) : (
          <>
            {isMyChallenge && !hasResponded && (
              <>
                {chooseModeEnabled && challengeGroups.length > 0 ? (
                  <View className='personality-dice__choose-area'>
                    {(() => {
                      const currentPlayer = participants[currentPlayerIndex]
                      const currentGroup = challengeGroups.find(
                        (g) => g.userId === currentPlayer?.userId,
                      )
                      if (!currentGroup) {
                        return (
                          <Text className='personality-dice__helper-text'>
                            等待你的挑战卡片…
                          </Text>
                        )
                      }
                      const mySelectedIdx = selectedOption[currentUserId]
                      const hasChosen = mySelectedIdx !== undefined
                      return (
                        <>
                          <Text className='personality-dice__choose-header'>
                            选择一个挑战难度
                          </Text>
                          <View className='personality-dice__choose-cards'>
                            {currentGroup.options.map((option, idx) => {
                              const difficultyLabel =
                                option.difficulty === 'easy'
                                  ? '简单'
                                  : option.difficulty === 'medium'
                                    ? '中等'
                                    : '困难'
                              const chipLevel =
                                option.difficulty === 'easy'
                                  ? 1
                                  : option.difficulty === 'medium'
                                    ? 2
                                    : 3
                              const isSelected = hasChosen && mySelectedIdx === idx
                              const isDimmed = hasChosen && mySelectedIdx !== idx
                              const isLoading = isChoosing && !hasChosen
                              return (
                                <View
                                  key={idx}
                                  className={`personality-dice__choose-card${isSelected ? ' personality-dice__choose-card--selected' : ''}${isDimmed ? ' personality-dice__choose-card--dimmed' : ''}${isLoading ? ' personality-dice__choose-card--loading' : ''}`}
                                  onClick={() => {
                                    if (!hasChosen && onChoose) onChoose(idx)
                                  }}
                                >
                                  <View className='personality-dice__choose-card-top'>
                                    <Chip
                                      label={difficultyLabel}
                                      level={chipLevel as 1 | 2 | 3}
                                      compact
                                    />
                                    {isSelected && (
                                      <Text className='personality-dice__choose-card-check'>
                                        ✅
                                      </Text>
                                    )}
                                  </View>
                                  <View className='personality-dice__choose-card-emoji'>
                                    <JoyJoinIcon
                                      emoji={option.challengeEmoji}
                                      size={40}
                                    />
                                  </View>
                                  <Text className='personality-dice__choose-card-title'>
                                    {option.challengeTitle}
                                  </Text>
                                  <Text className='personality-dice__choose-card-body'>
                                    {option.challengeBody}
                                  </Text>
                                  {option.passLine && (
                                    <Text className='personality-dice__choose-card-pass'>
                                      认怂: {option.passLine}
                                    </Text>
                                  )}
                                  {isLoading && (
                                    <View className='personality-dice__choose-card-spinner' />
                                  )}
                                </View>
                              )
                            })}
                          </View>
                        </>
                      )
                    })()}
                  </View>
                ) : (
                  <>
                    <SwipeCard
                      onSwipeRight={handleAccept}
                      onSwipeLeft={handlePass}
                      threshold={0.4}
                    >
                      <View className='personality-dice__swipe-area'>
                        <Text className='personality-dice__swipe-hint'>
                          👈 认怂 ｜ 接受挑战 👉
                        </Text>
                        <Text className='personality-dice__swipe-subhint'>
                          左右滑动卡片做出选择
                        </Text>
                      </View>
                    </SwipeCard>
                    <View className='personality-dice__tap-fallback'>
                      <Text className='personality-dice__tap-fallback-text'>
                        我再想想
                      </Text>
                    </View>
                  </>
                )}
              </>
            )}

            {isMyChallenge && hasCompleted && chooseModeEnabled && challengeGroups.length > 0 && (
              <View className='personality-dice__choose-area'>
                {(() => {
                  const currentPlayer = participants[currentPlayerIndex]
                  const currentGroup = challengeGroups.find(
                    (g) => g.userId === currentPlayer?.userId,
                  )
                  if (!currentGroup) return null
                  const mySelectedIdx = selectedOption[currentUserId]
                  return (
                    <>
                      <Text className='personality-dice__choose-header personality-dice__choose-header--chosen'>
                        已选择挑战
                      </Text>
                      <View className='personality-dice__choose-cards'>
                        {currentGroup.options.map((option, idx) => {
                          const difficultyLabel =
                            option.difficulty === 'easy'
                              ? '简单'
                              : option.difficulty === 'medium'
                                ? '中等'
                                : '困难'
                          const chipLevel =
                            option.difficulty === 'easy'
                              ? 1
                              : option.difficulty === 'medium'
                                ? 2
                                : 3
                          const isSelected = mySelectedIdx === idx
                          const isDimmed = mySelectedIdx !== idx
                          return (
                            <View
                              key={idx}
                              className={`personality-dice__choose-card${isSelected ? ' personality-dice__choose-card--selected' : ''}${isDimmed ? ' personality-dice__choose-card--dimmed' : ''}`}
                            >
                              <View className='personality-dice__choose-card-top'>
                                <Chip
                                  label={difficultyLabel}
                                  level={chipLevel as 1 | 2 | 3}
                                  compact
                                />
                                {isSelected && (
                                  <Text className='personality-dice__choose-card-check'>
                                    ✅
                                  </Text>
                                )}
                              </View>
                              <View className='personality-dice__choose-card-emoji'>
                                <JoyJoinIcon
                                  emoji={option.challengeEmoji}
                                  size={40}
                                />
                              </View>
                              <Text className='personality-dice__choose-card-title'>
                                {option.challengeTitle}
                              </Text>
                              <Text className='personality-dice__choose-card-body'>
                                {option.challengeBody}
                              </Text>
                              {option.passLine && (
                                <Text className='personality-dice__choose-card-pass'>
                                  认怂: {option.passLine}
                                </Text>
                              )}
                            </View>
                          )
                        })}
                      </View>
                    </>
                  )
                })()}
              </View>
            )}

            {isMyChallenge && hasCompleted && !chooseModeEnabled && (
              <View className='personality-dice__status-badge personality-dice__status-badge--accept'>
                <JoyJoinIcon emoji='✨' tier='reveal' size={24} className='personality-dice__status-emoji' />
                <Text className='personality-dice__status-text'>
                  已完成挑战
                </Text>
              </View>
            )}

            {isMyChallenge && hasPassed && (
              <View className='personality-dice__status-badge personality-dice__status-badge--pass'>
                <JoyJoinIcon emoji='😅' size={24} className='personality-dice__status-emoji' />
                <Text className='personality-dice__status-text'>
                  已认怂
                </Text>
              </View>
            )}

            {!isMyChallenge && (
              <>
                <Text className='personality-dice__spectator-hint'>
                  {hasResponded
                    ? hasPassed
                      ? `${currentDisplayName} 认怂了`
                      : `${currentDisplayName} 已选择了挑战`
                    : `等待 ${currentDisplayName} 做出选择…`}
                </Text>
                {!hasResponded && onReact && (
                  <View className='personality-dice__reaction-row'>
                    <TapReaction
                      reactions={REACTION_ITEMS.map((item) => ({
                        emoji: item.emoji,
                        label: item.label,
                        count: reactions?.[item.emoji] ?? 0,
                      }))}
                      onReact={handleReaction}
                      selectedIndex={selectedReaction ?? undefined}
                    />
                  </View>
                )}
              </>
            )}

            {showPassReveal && currentChallenge?.passConsequence && (
              <View className='personality-dice__pass-reveal'>
                <Text className='personality-dice__pass-reveal-label'>
                  认怂后果
                </Text>
                <Text className='personality-dice__pass-reveal-text'>
                  {currentChallenge.passConsequence}
                </Text>
              </View>
            )}

            {hasResponded && (
              <Text className='personality-dice__next-hint'>
                即将进入下一个挑战…
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  )
}
