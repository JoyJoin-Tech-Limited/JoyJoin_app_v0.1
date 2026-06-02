import { View, Text, Image } from '@tarojs/components'
import { localAsset } from '../../../lib/utils/cdnAssets'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import { PhaseHeaderIcon, getPhaseLabel, type SessionPhase } from '../phaseUtils'

export function FallbackPhaseView({
  phase,
  isHost,
  onAdvance,
  onReturnToWarmup,
}: {
  phase: SessionPhase
  isHost: boolean
  onAdvance: () => void
  onReturnToWarmup?: () => void
}) {
  return (
    <View className='icebreaker__challenge'>
      <Card className={`icebreaker__challenge-card icebreaker__challenge-card--${phase}`}>
        <Image
          className='icebreaker__fallback-hero'
          src={localAsset('/assets/personality/xiaoyue/xiaoyue-coach-guide.webp')}
          mode='aspectFit'
          style={{ width: '160rpx', height: '160rpx' }}
        />
        <Text className='icebreaker__challenge-title' style={{ marginTop: '16rpx' }}>
          这个环节还在筹备中
        </Text>
        <Text className='icebreaker__challenge-desc'>
          悦仔先带你回暖场，或者主持人可以直接推进到下一阶段
        </Text>
      </Card>

      {onReturnToWarmup ? (
        <Button
          variant='secondary'
          className='icebreaker__action-btn'
          onClick={onReturnToWarmup}
        >
          返回暖场
        </Button>
      ) : null}

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
