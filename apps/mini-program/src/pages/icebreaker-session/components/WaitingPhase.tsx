import { View, Text, Image } from '@tarojs/components'
import { localAsset } from '../../../lib/utils/cdnAssets'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { VibeId } from '../../../lib/vibeMapping'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import IcebreakerTierSelector from './IcebreakerTierSelector'

export interface WaitingPhaseProps {
  playerCount: number
  hostName?: string
  isHost: boolean
  currentTier: TierMachineId
  currentVibe?: VibeId
  canChangeTier: boolean
  onChangeTier: () => void
  onAdvance: () => void
}

export default function WaitingPhase({
  playerCount,
  hostName,
  isHost,
  currentTier,
  currentVibe,
  canChangeTier,
  onChangeTier,
  onAdvance,
}: WaitingPhaseProps) {
  return (
    <View className='icebreaker__waiting'>
      <Card className='icebreaker__waiting-card'>
        <Image
          src={localAsset('/assets/icons/status-icons/status-waiting.webp')}
          style={{ width: '80rpx', height: '80rpx' }}
          lazyLoad
          className='icebreaker__waiting-emoji'
        />
        <Text className='icebreaker__waiting-title'>等待更多玩家加入…</Text>
        <Text className='icebreaker__waiting-count'>
          当前 {playerCount} 人已加入
        </Text>
        {hostName && (
          <Text className='icebreaker__waiting-host'>
            主持人：{hostName}
          </Text>
        )}
        <View className='icebreaker__waiting-tier'>
          <IcebreakerTierSelector
            currentTier={currentTier}
            currentVibe={currentVibe}
            isHost={isHost}
            canChange={canChangeTier}
            disabledHint='热身已开始，模式不可更换'
            onChangeRequest={onChangeTier}
          />
        </View>
      </Card>
      {isHost && (
        <Button variant='primary' className='icebreaker__start-btn' onClick={onAdvance}>
          开始破冰
        </Button>
      )}
    </View>
  )
}
