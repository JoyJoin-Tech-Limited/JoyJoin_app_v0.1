import { Image, Text, View } from '@tarojs/components'
import {
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_XIAOYUE_EXPRESSION,
} from '../visuals'

interface LoadingStageProps {
  phaseText?: string
}

export default function LoadingStage({ phaseText }: LoadingStageProps) {
  return (
    <View className='personality-results__centered-state'>
      <Image
        className='personality-results__network-xiaoyue'
        mode='aspectFit'
        src={getXiaoyueExpressionAsset(PERSONALITY_TEST_XIAOYUE_EXPRESSION.completing)}
      />
      <Text className='personality-results__state-title'>正在同步你的匿名结果</Text>
      <Text className='personality-results__state-copy'>
        {phaseText || '先把测试结果从当前设备和服务端对齐，再进入正式揭晓。'}
      </Text>
    </View>
  )
}
