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
      {phaseText ? (
        <Text className='personality-results__network-copy'>{phaseText}</Text>
      ) : (
        <View className='personality-results__skeleton'>
          <View className='personality-results__skeleton-progress' />
          <View className='personality-results__skeleton-frame' />
          <View className='personality-results__skeleton-text' />
        </View>
      )}
    </View>
  )
}
