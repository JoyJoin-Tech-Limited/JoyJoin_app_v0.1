import { Image, View } from '@tarojs/components'
import type { XiaoyueExpressionId } from '../../../lib/mascot/xiaoyueExpressions'
import { getXiaoyueExpressionAsset, PERSONALITY_TEST_QUESTION_EXPRESSION } from './visuals'

const PRELOAD_EXPRESSIONS: XiaoyueExpressionId[] = [
  PERSONALITY_TEST_QUESTION_EXPRESSION.choice,
  PERSONALITY_TEST_QUESTION_EXPRESSION.slider,
  PERSONALITY_TEST_QUESTION_EXPRESSION.emoji_tap,
  PERSONALITY_TEST_QUESTION_EXPRESSION.loading,
]

export default function PersonalityTestPreloadLayer() {
  return (
    <View className='personality-test__preload-layer' aria-hidden='true'>
      {PRELOAD_EXPRESSIONS.map((expr) => (
        <Image
          key={expr}
          className='personality-test__preload-image'
          src={getXiaoyueExpressionAsset(expr)}
          mode='aspectFit'
          lazyLoad={false}
          aria-hidden='true'
        />
      ))}
    </View>
  )
}
