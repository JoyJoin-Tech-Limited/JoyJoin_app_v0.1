import { View, Text, Image } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'
import type { PersonalityDiceChallenge } from '@shared/socialIcebreaker'
import { CelebrationOverlay } from '../overlays/CelebrationOverlay'

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
                <Image src='/assets/lovart/icebreaker/icons/icon-dice-accept.png' mode='aspectFit' style={{ width: '36rpx', height: '36rpx' }} />
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
                <Image src='/assets/lovart/icebreaker/icons/icon-dice-pass.png' mode='aspectFit' style={{ width: '36rpx', height: '36rpx' }} />
                <Text>认怂</Text>
              </View>
            </Button>
          </View>
        ) : null}

        {isMyChallenge && hasCompleted ? (
          <View className='icebreaker__dice-badge icebreaker__dice-badge--accept'>
            <Image src='/assets/lovart/icebreaker/icons/icon-dice-accept.png' mode='aspectFit' style={{ width: '28rpx', height: '28rpx' }} />
            <Text className='icebreaker__dice-badge-text'>已完成挑战</Text>
          </View>
        ) : null}

        {isMyChallenge && hasPassed ? (
          <View className='icebreaker__dice-badge icebreaker__dice-badge--pass'>
            <Image src='/assets/lovart/icebreaker/icons/icon-dice-pass.png' mode='aspectFit' style={{ width: '28rpx', height: '28rpx' }} />
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
