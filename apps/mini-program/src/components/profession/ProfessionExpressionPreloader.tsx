import { View, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'

/**
 * Off-screen 2rpx mount that warms the Xiaoyue expression image cache, so the
 * first reaction bubble does not flicker on device.
 *
 * Extracted from `ProfessionChatOverlay.tsx` (no behavior change). The caller
 * still gates it on `visible && !isClosing && !isDegradation`.
 */
const PRELOAD_EXPRESSIONS: XiaoyueExpressionId[] = [
  'coachGuide',
  'loadingSystem',
  'homeWelcome',
  'testCurious',
  'testListening',
  'matchSuccess',
]

export default function ProfessionExpressionPreloader() {
  return (
    <View style={{ position: 'absolute', left: '-9999rpx', top: 0, width: '2rpx', height: '2rpx', opacity: 0, pointerEvents: 'none' }}>
      {PRELOAD_EXPRESSIONS.map((expressionId) => (
        <Image
          key={expressionId}
          src={getXiaoyueExpressionAsset(expressionId)}
          mode='aspectFill'
          style={{ width: '2rpx', height: '2rpx' }}
        />
      ))}
    </View>
  )
}
