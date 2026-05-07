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
        当前设备里没有找到完整的匿名测试结果。重新完成一次测试，系统会重新生成并保存这次揭晓流程。
      </Text>
      <View className='personality-results__stack-actions'>
        <Button onClick={onRestart}>返回重新测试</Button>
      </View>
    </View>
  )
}
