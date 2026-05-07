import { Image, Text, View } from '@tarojs/components'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import Card from '../../../../../components/ui/Card'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../../visuals'

interface BridgeStageProps {
  displayArchetypeName: string
  confidenceLabel?: string
  phaseText?: string
}

export default function BridgeStage({ displayArchetypeName, confidenceLabel, phaseText }: BridgeStageProps) {
  return (
    <View className='personality-results__immersive-shell personality-results__immersive-shell--bridge'>
      <Text className='personality-results__immersive-eyebrow'>结果已锁定</Text>
      <Text className='personality-results__immersive-title'>你的 {displayArchetypeName} 已经准备好了</Text>
      <Text className='personality-results__immersive-copy'>
        先把这份气场翻成一张更好分享的 JoyJoin 卡面，再把完整结果交到你手上。
      </Text>

      <Card className='personality-results__bridge-card'>
        <View className='personality-results__bridge-figure'>
          <View className='personality-results__bridge-halo' />
          <Image
            className='personality-results__bridge-mascot'
            mode='aspectFit'
            src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsCoach)}
          />
        </View>

        <View className='personality-results__bridge-copy'>
          <Text className='personality-results__bridge-title'>{`${DEFAULT_MASCOT_DISPLAY_NAME}正在替你装裱这张卡`}</Text>
          <Text className='personality-results__bridge-text'>
            {phaseText || `我已经把 ${displayArchetypeName} 的气场关键词、分享语和后续提示收进同一张卡里，马上展开给你。`}
          </Text>

          <View className='personality-results__bridge-badges'>
            <Text className='personality-results__bridge-badge personality-results__bridge-badge--accent'>
              {displayArchetypeName}
            </Text>
            <Text className='personality-results__bridge-badge'>{confidenceLabel || '结果已锁定'}</Text>
          </View>
        </View>
      </Card>
    </View>
  )
}
