import { Image, Text, View } from '@tarojs/components'
import Button from '../../../../components/ui/Button'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'

interface EmptyStageProps {
  onRestart: () => void
}

export default function EmptyStage({ onRestart }: EmptyStageProps) {
  return (
    <View className='personality-results__centered-state'>
      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.resultsSlotFallback)}
      />
      <Text className='personality-results__state-title'>这份结果还没准备好</Text>
      <Text className='personality-results__state-copy'>
        悦仔在这台设备上没找到完整的测试结果，重新测一次就好~
      </Text>
      <View className='personality-results__stack-actions'>
        <Button onClick={onRestart}>返回重新测试</Button>
      </View>
    </View>
  )
}
