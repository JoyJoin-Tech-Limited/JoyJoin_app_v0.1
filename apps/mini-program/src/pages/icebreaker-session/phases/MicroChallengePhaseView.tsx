import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon } from '../phaseUtils'

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
