import { View, Text, Image } from '@tarojs/components'
import { useState } from 'react'
import { localAsset } from '../../../lib/utils/cdnAssets'
import { getXiaoyueExpressionAsset } from '../../../lib/mascot/xiaoyueExpressions'
import type { TierMachineId } from '@shared/socialIcebreakerTierManifest'
import type { VibeId } from '../../../lib/vibeMapping'
import Card from '../../../components/ui/Card'
import Button from '../../../components/ui/Button'
import IcebreakerTierSelector from './IcebreakerTierSelector'
import { GLANCE_L1_WORD_WAITING } from '../viewModels/glanceStackModel'

export interface WaitingPhaseProps {
  playerCount: number
  hostName?: string
  isHost: boolean
  currentTier: TierMachineId
  currentVibe?: VibeId
  canChangeTier: boolean
  onChangeTier: () => void
  onAdvance: () => void
  /** S3 glance-stack pilot (flag-gated): L1 word「等人齐」+ sequenced 悦仔
   *  cameo; count/host line demotes to a hairline fragment. */
  glanceMode?: boolean
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
  glanceMode = false,
}: WaitingPhaseProps) {
  const [cameoFailed, setCameoFailed] = useState(false)
  // S3 glance treatment (spec §1.1 row 1): one L1 word + the waiting cameo.
  // The tier selector (host tool) and start CTA (ACT) stay pinned (§4.2).
  if (glanceMode) {
    return (
      <View className='icebreaker__waiting'>
        <View className='icebreaker__waiting-l1'>
          <Image
            src={cameoFailed ? localAsset('/assets/xiaoyue-expressions/xiaoyue-home-welcome.webp') : getXiaoyueExpressionAsset('matchWaiting')}
            mode='aspectFit'
            lazyLoad
            className='icebreaker__waiting-cameo'
            onError={() => setCameoFailed(true)}
          />
          <Text className='icebreaker__waiting-l1-word'>{GLANCE_L1_WORD_WAITING}</Text>
          <Text className='icebreaker__waiting-l3'>
            {`当前 ${playerCount} 人已加入${hostName ? ` · 主持人：${hostName}` : ''}`}
          </Text>
        </View>
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
        {isHost && (
          <Button variant='primary' className='icebreaker__start-btn' onClick={onAdvance}>
            开始破冰
          </Button>
        )}
      </View>
    )
  }

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
