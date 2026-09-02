import { Image, View } from '@tarojs/components'
import type { XiaoyueExpressionId } from '../../../lib/mascot/xiaoyueExpressions'
import {
  getArchetypeSpritesheetLocalPath,
  getXiaoyueExpressionAsset,
  PERSONALITY_TEST_QUESTION_EXPRESSION,
} from './visuals'

// Only the expressions actually rendered on this page: the per-question mascot
// pose is always `choice` (getQuestionMascotPose), and `loading` appears in the
// submission echo overlay.
const PRELOAD_EXPRESSIONS: XiaoyueExpressionId[] = [
  PERSONALITY_TEST_QUESTION_EXPRESSION.choice,
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
      {/* WS-4 (2026-09-02): decode the slot-machine spritesheet during the
          quiz so the results-page reel never opens on a blank decode window.
          This hidden <Image> primes the webview cache; the native cache is
          primed alongside via getImageInfo in personality-test/index.tsx
          (mirrors the dual-cache strategy documented on the results page). */}
      <Image
        className='personality-test__preload-image'
        src={getArchetypeSpritesheetLocalPath()}
        mode='aspectFit'
        lazyLoad={false}
        aria-hidden='true'
      />
    </View>
  )
}
