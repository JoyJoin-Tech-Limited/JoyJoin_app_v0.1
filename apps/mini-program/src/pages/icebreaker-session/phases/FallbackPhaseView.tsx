import { View, Text } from '@tarojs/components'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon, getPhaseLabel, type SessionPhase } from '../phaseUtils'

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
