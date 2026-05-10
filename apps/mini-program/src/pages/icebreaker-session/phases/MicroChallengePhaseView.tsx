import { useState, useEffect, useCallback } from 'react'
import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import { PhaseHeaderIcon } from '../phaseUtils'
import { TapRhythm } from '../../../components/gesture'
import { ParticleBurst } from '../../../components/reveal'

const TAP_TARGET = 5

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
  const [optimisticCompletedBy, setOptimisticCompletedBy] = useState<string[]>(completedBy)
  const [localTapCount, setLocalTapCount] = useState(0)
  const [showBurst, setShowBurst] = useState(false)
  const [burstKey, setBurstKey] = useState(0)

  // Sync with server state
  useEffect(() => {
    setOptimisticCompletedBy(completedBy)
  }, [completedBy])

  // Reset local state when challenge changes
  useEffect(() => {
    setLocalTapCount(0)
    setShowBurst(false)
  }, [challenge?.title])

  const hasCompleted = optimisticCompletedBy.includes(currentUserId)
  const completionPercent = playerCount > 0 ? (optimisticCompletedBy.length / playerCount) * 100 : 0

  const handleTap = useCallback(() => {
    if (hasCompleted || isCompleting) return
    const nextTap = localTapCount + 1
    if (nextTap >= TAP_TARGET) {
      // Optimistic sync: immediately reflect completion
      setOptimisticCompletedBy((prev) =>
        prev.includes(currentUserId) ? prev : [...prev, currentUserId]
      )
      setShowBurst(true)
      setBurstKey((k) => k + 1)
      setLocalTapCount(0)
      onComplete()
    } else {
      setLocalTapCount(nextTap)
    }
  }, [hasCompleted, isCompleting, localTapCount, currentUserId, onComplete])

  return (
    <View className='icebreaker__challenge'>
      {challenge ? (
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--micro-challenge'>
          <View className='icebreaker__challenge-emoji icebreaker__challenge-stagger icebreaker__challenge-stagger--delay-0'>
            <PhaseHeaderIcon phase="micro_challenge" size={80} />
          </View>
          <Text className='icebreaker__challenge-title icebreaker__challenge-stagger icebreaker__challenge-stagger--delay-1'>
            {challenge.title}
          </Text>
          <Text className='icebreaker__challenge-desc icebreaker__challenge-stagger icebreaker__challenge-stagger--delay-2'>
            {challenge.description}
          </Text>
          {challenge.visualHint && (
            <Text className='icebreaker__challenge-hint icebreaker__challenge-stagger icebreaker__challenge-stagger--delay-3'>
              提示：{challenge.visualHint}
            </Text>
          )}
          <View className='icebreaker__challenge-meta icebreaker__challenge-stagger icebreaker__challenge-stagger--delay-4'>
            <Text className='icebreaker__challenge-duration'>
              ⏱ {challenge.durationSeconds}秒
            </Text>
            <Text className='icebreaker__challenge-completed'>
              {optimisticCompletedBy.length} 人已完成
            </Text>
          </View>
          {hasCompleted && (
            <View className='icebreaker__challenge-done-badge icebreaker__challenge-stagger icebreaker__challenge-stagger--delay-3'>
              <Text className='icebreaker__challenge-done-text'>
                你已完成！
              </Text>
            </View>
          )}

          {/* V2: Team progress bar */}
          <View className='icebreaker__challenge-progress icebreaker__challenge-stagger icebreaker__challenge-stagger--delay-4'>
            <View className='icebreaker__challenge-progress-track'>
              <View
                className='icebreaker__challenge-progress-fill'
                style={{ width: `${completionPercent}%` }}
              />
            </View>
            <Text className='icebreaker__challenge-progress-text'>
              团队进度 {optimisticCompletedBy.length} / {playerCount}
            </Text>
          </View>

          {/* V2: Particle burst on completion */}
          {showBurst && (
            <View className='icebreaker__challenge-burst'>
              <ParticleBurst
                key={burstKey}
                trigger={showBurst}
                type="confetti"
                count={40}
                spotlightColor="#8B5CF6"
              />
            </View>
          )}
        </Card>
      ) : (
        <Card className='icebreaker__challenge-card icebreaker__challenge-card--micro-challenge'>
          <View className='icebreaker__challenge-emoji'>
            <PhaseHeaderIcon phase="micro_challenge" size={80} />
          </View>
          <Text className='icebreaker__challenge-title'>挑战准备中…</Text>
        </Card>
      )}

      <View className='icebreaker__action-stack'>
        {!hasCompleted ? (
          <View className='icebreaker__challenge-tap-area'>
            <TapRhythm
              onTap={handleTap}
              tapCount={localTapCount}
              targetCount={TAP_TARGET}
              emoji="🎯"
            />
            {isCompleting && (
              <Text className='icebreaker__helper-text'>提交中…</Text>
            )}
          </View>
        ) : (
          <>
            <Text className='icebreaker__helper-text'>
              已记录你的完成状态，等待其他玩家完成或主持人推进下一阶段。
            </Text>
            <Text className='icebreaker__helper-text'>
              已完成 {optimisticCompletedBy.length} / {playerCount} 人
            </Text>
          </>
        )}
      </View>
    </View>
  )
}
