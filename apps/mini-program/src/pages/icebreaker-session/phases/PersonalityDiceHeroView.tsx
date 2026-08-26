import { View, Text } from '@tarojs/components'
import { useCallback, useEffect, useRef, useState } from 'react'
import type { PersonalityDiceChallenge, PersonalityDiceChallengeGroup } from '@shared/socialIcebreaker'
import type { AIResponseMeta } from '@shared/types/aiMeta'
import { getArchetypeHSL } from '@shared/archetypeColors'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Chip from '../../../components/ui/Chip'
import Button from '../../../components/ui/Button'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'
import { CardFlip, ParticleBurst } from '../../../components/reveal'
import { SwipeCard } from '../../../components/gesture'
import { PhaseHeroCard } from '../components/PhaseHeroCard'
import { haptics } from '../../../lib/utils/haptics'
import { PhaseAigcRow } from '../components/PhaseAigcRow'
import { cdnAsset } from '../../../lib/utils/cdnAssets'
import {
  canChoosePersonalityDiceOption,
  getPersonalityDiceCountdownSeconds,
} from '../viewModels/phaseProgressionModels'
// Styles are @use'd by the page SCSS (index.scss) — see sub-common.wxss note there.

function hslToHex(h: number, s: number, l: number): string {
  l /= 100
  const a = (s * Math.min(l, 1 - l)) / 100
  const f = (n: number) => {
    const k = (n + h / 30) % 12
    const color = l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1)
    return Math.round(255 * color).toString(16).padStart(2, '0')
  }
  return `#${f(0)}${f(8)}${f(4)}`
}

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: '简单',
  medium: '中等',
  hard: '困难',
}

export interface PersonalityDiceHeroViewProps {
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
  currentPlayerArchetype?: string
  onAdvance?: () => void
  chooseModeEnabled?: boolean
  challengeGroups?: PersonalityDiceChallengeGroup[]
  selectedOption?: Record<string, number>
  onChoose?: (optionIndex: number) => void
  onReady?: (ready: boolean) => void
  isChoosing?: boolean
  isReadying?: boolean
  revealOrder?: string[]
  revealCountdownEndsAt?: number
  revealReadyBy?: string[]
  onRevealReady?: (ready: boolean) => void
  isRevealReadying?: boolean
  challengesMeta?: AIResponseMeta
}

export function PersonalityDiceHeroView({
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
  currentPlayerArchetype,
  onAdvance,
  chooseModeEnabled = false,
  challengeGroups = [],
  selectedOption = {},
  onChoose,
  onReady,
  isChoosing = false,
  isReadying = false,
  revealOrder = [],
  revealCountdownEndsAt,
  revealReadyBy = [],
  onRevealReady,
  isRevealReadying = false,
  challengesMeta,
}: PersonalityDiceHeroViewProps) {
  const currentChallenge = challenges[currentPlayerIndex] ?? null
  const currentDisplayName =
    currentChallenge?.displayName ?? participants[currentPlayerIndex]?.displayName ?? '当前玩家'
  const archetype = currentPlayerArchetype ?? currentChallenge?.archetype
  const hsl = getArchetypeHSL(archetype)
  const spotlightColor = hslToHex(hsl.h, hsl.s, hsl.l)

  const [pendingUserId, setPendingUserId] = useState<string | null>(null)
  const [showPassReveal, setShowPassReveal] = useState(false)
  const [shakeCard, setShakeCard] = useState(false)
  const [burstTrigger, setBurstTrigger] = useState(false)
  const [showReveal, setShowReveal] = useState(false)
  const [flipped, setFlipped] = useState(() => challenges.length > 0)
  const [countdownNow, setCountdownNow] = useState(Date.now())
  const prevChallengesLenRef = useRef(0)
  const prevGroupsLenRef = useRef(0)
  const prevIsCompletingRef = useRef(false)
  // F6: ref-tracked timeouts — no setState-after-unmount.
  const shakeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const burstTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    return () => {
      if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
      if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    }
  }, [])

  useEffect(() => {
    if (!revealCountdownEndsAt || Date.now() >= revealCountdownEndsAt) return
    const timer = setInterval(() => {
      const now = Date.now()
      setCountdownNow(now)
      if (now >= revealCountdownEndsAt) clearInterval(timer)
    }, 200)
    return () => clearInterval(timer)
  }, [revealCountdownEndsAt])

  const effectiveCompletedBy =
    pendingUserId && !passedBy.includes(pendingUserId) ? [...completedBy, pendingUserId] : completedBy
  const effectivePassedBy =
    pendingUserId && !completedBy.includes(pendingUserId) ? [...passedBy, pendingUserId] : passedBy

  const isMyChallenge =
    chooseModeEnabled && challengeGroups.length > 0
      ? participants[currentPlayerIndex]?.userId === currentUserId
      : currentChallenge?.userId === currentUserId
  const hasCompleted = effectiveCompletedBy.includes(currentUserId)
  const hasPassed = effectivePassedBy.includes(currentUserId)
  const hasResponded = hasCompleted || hasPassed
  const allCompleted =
    chooseModeEnabled && challengeGroups.length > 0
      ? challengeGroups.length > 0 &&
        effectiveCompletedBy.length + effectivePassedBy.length >= challengeGroups.length
      : challenges.length > 0 &&
        effectiveCompletedBy.length + effectivePassedBy.length >= challenges.length

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

  useEffect(() => {
    if (pendingUserId && (completedBy.includes(pendingUserId) || passedBy.includes(pendingUserId))) {
      setPendingUserId(null)
    }
  }, [completedBy, passedBy, pendingUserId])

  useEffect(() => {
    if (prevIsCompletingRef.current && !isCompleting && pendingUserId) {
      const wasConfirmed = completedBy.includes(pendingUserId) || passedBy.includes(pendingUserId)
      if (!wasConfirmed) {
        setShakeCard(true)
        if (shakeTimerRef.current) clearTimeout(shakeTimerRef.current)
        shakeTimerRef.current = setTimeout(() => setShakeCard(false), 500)
        setShowPassReveal(false)
        setBurstTrigger(false)
      }
      setPendingUserId(null)
    }
    prevIsCompletingRef.current = isCompleting
  }, [isCompleting, pendingUserId, completedBy, passedBy])

  const handleAccept = useCallback(() => {
    if (isCompleting || pendingUserId) return
    haptics('medium')
    setPendingUserId(currentUserId)
    setBurstTrigger(true)
    if (burstTimerRef.current) clearTimeout(burstTimerRef.current)
    burstTimerRef.current = setTimeout(() => setBurstTrigger(false), 2500)
    onComplete(false)
  }, [isCompleting, pendingUserId, currentUserId, onComplete])

  const handlePass = useCallback(() => {
    if (isCompleting || pendingUserId) return
    haptics('light')
    setPendingUserId(currentUserId)
    setShowPassReveal(true)
    onComplete(true)
  }, [isCompleting, pendingUserId, currentUserId, onComplete])

  // Signature wow: dice settle — chosen dare lands with a squash + haptic
  const handleChooseWithSettle = useCallback(
    (idx: number) => {
      if (!onChoose) return
      haptics('medium')
      onChoose(idx)
    },
    [onChoose],
  )

  const diceFace = (
    <View className='personality-dice-hero__dice-face'>
      <JoyJoinIcon emoji='🎲' tier='phase' size={56} />
      <Text className='personality-dice-hero__dice-desc'>
        掷出命运骰子，为每位玩家生成一个专属挑战。
      </Text>
    </View>
  )

  const challengeFace = (
    <View key={currentPlayerIndex} className='personality-dice-hero__challenge-face'>
      <JoyJoinIcon emoji={currentChallenge?.challengeEmoji ?? '🎲'} size={48} />
      <Text className='personality-dice-hero__challenge-player'>
        {currentChallenge?.displayName ?? '玩家'} 的挑战
      </Text>
      <Text className='personality-dice-hero__challenge-title'>
        {currentChallenge?.challengeTitle ?? '挑战准备中'}
      </Text>
      {currentChallenge?.challengeBody ? (
        <Text className='personality-dice-hero__challenge-body'>{currentChallenge.challengeBody}</Text>
      ) : null}
      {currentChallenge?.passLine ? (
        <Text className='personality-dice-hero__challenge-pass'>或者你可以{currentChallenge.passLine}</Text>
      ) : null}
    </View>
  )

  const chooseCards = (readOnly: boolean) => {
    const currentPlayer = participants[currentPlayerIndex]
    const currentGroup = challengeGroups.find((g) => g.userId === currentPlayer?.userId)
    if (!currentGroup) {
      return readOnly ? null : (
        <Text className='personality-dice-hero__helper'>等待你的挑战卡片…</Text>
      )
    }
    const mySelectedIdx = selectedOption[currentUserId]
    const hasChosen = mySelectedIdx !== undefined
    return (
      <View className='personality-dice-hero__choose-cards'>
        {currentGroup.options.map((option, idx) => {
          const isSelected = mySelectedIdx === idx
          const isDimmed = readOnly && hasChosen && mySelectedIdx !== idx
          const isLoading = isChoosing && !hasChosen && !readOnly
          return (
            <View
              key={idx}
              className={`personality-dice-hero__choose-card${isSelected ? ' personality-dice-hero__choose-card--selected personality-dice-hero__choose-card--settle' : ''}${isDimmed ? ' personality-dice-hero__choose-card--dimmed' : ''}${isLoading ? ' personality-dice-hero__choose-card--loading' : ''}`}
              hoverClass='personality-dice-hero__choose-card--pressed'
              onClick={() => {
                if (canChoosePersonalityDiceOption(readOnly, isChoosing, mySelectedIdx, idx)) {
                  handleChooseWithSettle(idx)
                }
              }}
            >
              <View className='personality-dice-hero__choose-card-top'>
                <Chip
                  label={DIFFICULTY_LABELS[option.difficulty] ?? option.difficulty}
                  level={(option.difficulty === 'easy' ? 1 : option.difficulty === 'medium' ? 2 : 3) as 1 | 2 | 3}
                  compact
                />
                {isSelected && <JoyJoinIcon className='personality-dice-hero__choose-card-check' emoji='✓' tier='status' size={20} />}
              </View>
              <View className='personality-dice-hero__choose-card-emoji'>
                <JoyJoinIcon emoji={option.challengeEmoji} size={40} />
              </View>
              <Text className='personality-dice-hero__choose-card-title'>{option.challengeTitle}</Text>
              <Text className='personality-dice-hero__choose-card-body'>{option.challengeBody}</Text>
              {option.passLine && (
                <Text className='personality-dice-hero__choose-card-pass'>认怂: {option.passLine}</Text>
              )}
              {isLoading && <View className='personality-dice-hero__choose-card-spinner' />}
            </View>
          )
        })}
      </View>
    )
  }

  if (allCompleted && chooseModeEnabled && challengeGroups.length > 0) {
    const countdownRemaining = getPersonalityDiceCountdownSeconds(revealCountdownEndsAt, countdownNow)
    if (countdownRemaining > 0) {
      return (
        <View className='personality-dice-hero personality-dice-hero--countdown'>
          <View className='personality-dice-hero__countdown'>
            <Text className='personality-dice-hero__countdown-number'>{countdownRemaining}</Text>
            <Text className='personality-dice-hero__countdown-label'>准备揭晓大家的选择</Text>
          </View>
        </View>
      )
    }

    const orderedGroups = (revealOrder.length > 0 ? revealOrder : challengeGroups.map((group) => group.userId))
      .map((userId) => challengeGroups.find((group) => group.userId === userId))
      .filter((group): group is PersonalityDiceChallengeGroup => Boolean(group))

    const isRevealReady = revealReadyBy.includes(currentUserId)
    const allRevealReady = challengeGroups.every((group) => revealReadyBy.includes(group.userId))

    return (
      <View className='personality-dice-hero'>
        <View className='personality-dice-hero__burst'>
          <ParticleBurst trigger type='confetti' count={50} />
        </View>
        <PhaseHeroCard
          phase='personality_dice'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-personality-dice.webp')}
          title='全员选择揭晓'
          prompt='挑战卡已打乱顺序，看看每个人今晚选了什么'
          statusText='选择已揭晓'
          doneCount={participants.length}
          totalCount={participants.length}
        >
          <View className='personality-dice-hero__reveal-list'>
            {orderedGroups.map((group) => {
              const option = group.options[selectedOption[group.userId]]
              if (!option) return null
              return (
                <View key={group.userId} className='personality-dice-hero__choose-card personality-dice-hero__reveal-card'>
                  <View className='personality-dice-hero__reveal-identity'>
                    <Text className='personality-dice-hero__reveal-name'>{group.displayName}</Text>
                  </View>
                  <View className='personality-dice-hero__choose-card-top'>
                    <Chip
                      label={DIFFICULTY_LABELS[option.difficulty] ?? option.difficulty}
                      level={(option.difficulty === 'easy' ? 1 : option.difficulty === 'medium' ? 2 : 3) as 1 | 2 | 3}
                      compact
                    />
                  </View>
                  <View className='personality-dice-hero__choose-card-emoji'>
                    <JoyJoinIcon emoji={option.challengeEmoji} size={40} />
                  </View>
                  <Text className='personality-dice-hero__choose-card-title'>{option.challengeTitle}</Text>
                  <Text className='personality-dice-hero__choose-card-body'>{option.challengeBody}</Text>
                </View>
              )
            })}
            </View>
        </PhaseHeroCard>
        <View className='personality-dice-hero__fixed-action'>
          {allRevealReady ? (
            isHost && onAdvance ? (
              <Button variant='primary' onClick={onAdvance}>进入下一游戏</Button>
            ) : (
              <Button variant='secondary' disabled>等待主持人进入下一游戏</Button>
            )
          ) : (
            <Button
              variant={isRevealReady ? 'secondary' : 'primary'}
              onClick={() => onRevealReady?.(!isRevealReady)}
              disabled={!onRevealReady || isRevealReadying}
              loading={isRevealReadying}
            >
              {isRevealReady
                ? `取消准备（${revealReadyBy.length}/${participants.length}）`
                : `准备进入下一游戏（${revealReadyBy.length}/${participants.length}）`}
            </Button>
          )}
        </View>
      </View>
    )
  }

  // ── All-completed summary ──
  if (allCompleted) {
    const source = chooseModeEnabled && challengeGroups.length > 0 ? challengeGroups : challenges
    const completedPlayers = source
      .filter((c: any) => effectiveCompletedBy.includes(c.userId))
      .map((c: any) => ({ name: c.displayName }))
    const passedPlayers = source
      .filter((c: any) => effectivePassedBy.includes(c.userId))
      .map((c: any) => ({ name: c.displayName }))

    return (
      <View className='personality-dice-hero'>
        <View className='personality-dice-hero__burst'>
          <ParticleBurst trigger type='confetti' count={50} />
        </View>
        <PhaseHeroCard
          phase='personality_dice'
          artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-personality-dice.webp')}
          title='人格骰子完成'
          prompt={`${participants.length} 位玩家都完成了自己的专属挑战`}
          statusText='本环节已完成'
          doneCount={participants.length}
          totalCount={participants.length}
          actions={
            isHost && onAdvance ? (
              <Button variant='primary' onClick={onAdvance}>
                进入回顾
              </Button>
            ) : undefined
          }
        >
          <View className='personality-dice-hero__summary-list'>
            {completedPlayers.map((p, i) => (
              <View key={`c-${i}`} className='personality-dice-hero__summary-row'>
                <Text className='personality-dice-hero__summary-name'>{p.name}</Text>
                <Text className='personality-dice-hero__summary-tag personality-dice-hero__summary-tag--completed'>
                  完成
                </Text>
              </View>
            ))}
            {passedPlayers.map((p, i) => (
              <View key={`p-${i}`} className='personality-dice-hero__summary-row'>
                <Text className='personality-dice-hero__summary-name'>{p.name}</Text>
                <Text className='personality-dice-hero__summary-tag personality-dice-hero__summary-tag--passed'>
                  认怂
                </Text>
              </View>
            ))}
          </View>
        </PhaseHeroCard>
      </View>
    )
  }

  const hasContent = challenges.length > 0 || challengeGroups.length > 0
  const statusText = !hasContent
    ? isHost
      ? '掷出骰子后开始'
      : '等待主持人掷出人格骰子…'
    : isMyChallenge
      ? hasResponded
        ? '你的选择已记录'
        : '轮到你做选择'
      : hasResponded
        ? hasPassed
          ? `${currentDisplayName} 认怂了`
          : `${currentDisplayName} 已选择了挑战`
        : `等待 ${currentDisplayName} 做出选择…`

  return (
    <View className='personality-dice-hero'>
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

      <View className='personality-dice-hero__burst'>
        <ParticleBurst trigger={burstTrigger} type='confetti' count={40} spotlightColor={spotlightColor} />
      </View>

      <PhaseHeroCard
        phase='personality_dice'
        artUrl={cdnAsset('/assets/lovart/icebreaker/bands/band-personality-dice.webp')}
        title={
          hasContent
            ? isMyChallenge
              ? '你的专属挑战'
              : `${currentDisplayName} 的挑战`
            : '人格骰子'
        }
        statusChip={hasContent && !chooseModeEnabled ? `${currentPlayerIndex + 1} / ${challenges.length}` : undefined}
        statusText={statusText}
        doneCount={effectiveCompletedBy.length + effectivePassedBy.length}
        totalCount={participants.length}
        actions={
          <>
            {!hasContent && isHost ? (
              <Button variant='primary' onClick={onGenerate} disabled={isGenerating} loading={isGenerating}>
                {isGenerating ? '生成中…' : '掷出人格骰子'}
              </Button>
            ) : null}
            {hasContent && isMyChallenge && !hasResponded && !chooseModeEnabled ? (
              <SwipeCard onSwipeRight={handleAccept} onSwipeLeft={handlePass} threshold={0.4}>
                <View className='personality-dice-hero__swipe-area'>
                  <Text className='personality-dice-hero__swipe-hint'>认怂 ｜ 接受挑战</Text>
                  <Text className='personality-dice-hero__swipe-subhint'>左右滑动卡片做出选择</Text>
                </View>
              </SwipeCard>
            ) : null}
            {hasContent && isMyChallenge && hasCompleted && !chooseModeEnabled ? (
              <View className='personality-dice-hero__status-badge personality-dice-hero__status-badge--accept'>
                <JoyJoinIcon emoji='✨' tier='reveal' size={24} />
                <Text className='personality-dice-hero__status-badge-text'>已完成挑战</Text>
              </View>
            ) : null}
            {hasContent && isMyChallenge && hasPassed ? (
              <View className='personality-dice-hero__status-badge personality-dice-hero__status-badge--pass'>
                <Text className='personality-dice-hero__status-badge-text'>已认怂</Text>
              </View>
            ) : null}
            {hasContent && chooseModeEnabled && isMyChallenge && hasChosen(selectedOption[currentUserId]) && onReady ? (
              <Button
                variant={hasCompleted ? 'secondary' : 'primary'}
                onClick={() => onReady(!hasCompleted)}
                disabled={isReadying}
                loading={isReadying}
              >
                {hasCompleted ? '取消准备' : '准备好了'}
              </Button>
            ) : null}
          </>
        }
      >
        {hasContent && !chooseModeEnabled ? (
          <View className={`personality-dice-hero__card${shakeCard ? ' personality-dice-hero__card--shake' : ''}`}>
            <CardFlip
              front={diceFace}
              back={challengeFace}
              flipped={challenges.length > 0 && flipped}
              duration={400}
            />
          </View>
        ) : null}

        {hasContent && chooseModeEnabled && challengeGroups.length > 0 ? (
          <View className='personality-dice-hero__choose-area'>
            <Text className='personality-dice-hero__choose-header'>
              {isMyChallenge && !hasChosen(selectedOption[currentUserId])
                ? '选择一个挑战难度'
                : '已选择挑战'}
            </Text>
            {isMyChallenge ? chooseCards(hasCompleted) : chooseCards(true)}
          </View>
        ) : null}

        {showPassReveal && currentChallenge?.passConsequence ? (
          <View className='personality-dice-hero__pass-reveal'>
            <Text className='personality-dice-hero__pass-reveal-label'>认怂后果</Text>
            <Text className='personality-dice-hero__pass-reveal-text'>
              {currentChallenge.passConsequence}
            </Text>
          </View>
        ) : null}
        {hasContent ? <PhaseAigcRow meta={challengesMeta} reason='AI 生成人格骰子挑战' /> : null}
      </PhaseHeroCard>
    </View>
  )
}

function hasChosen(value: number | undefined): boolean {
  return value !== undefined
}
