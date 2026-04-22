import { View, Text, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../lib/xiaoyueExpressions'
import './XiaoyueChatBubble.scss'

export type XiaoyuePose = 'thinking' | 'casual' | 'pointing'

const POSE_TO_EXPRESSION: Record<XiaoyuePose, XiaoyueExpressionId> = {
  thinking: 'loadingSystem',
  casual: 'coachGuide',
  pointing: 'coachGuide',
}

export interface XiaoyueChatBubbleProps {
  /** Chat bubble text content */
  content: string
  /** Mascot pose/expression */
  pose?: XiaoyuePose
  /** Layout direction */
  horizontal?: boolean
  /** Whether to show pulsing ring glow */
  showGlow?: boolean
  /** Stagger delay per sentence (ms) */
  staggerDelay?: number
  className?: string
}

/**
 * XiaoyueChatBubble — animated mascot coaching bubble for onboarding.
 *
 * Pixel specs:
 * - Avatar size: 96rpx (horizontal), 120rpx (vertical)
 * - Bubble radius: 24rpx
 * - Bubble padding: 24rpx
 * - Glow ring: 4rpx border, pulsing opacity 0.3→0.6
 * - Stagger: 80ms per sentence
 */
export default function XiaoyueChatBubble({
  content,
  pose = 'casual',
  horizontal = true,
  showGlow = true,
  staggerDelay = 80,
  className = '',
}: XiaoyueChatBubbleProps) {
  const expressionId = POSE_TO_EXPRESSION[pose]
  const sentences = content.split(/[。.]/).filter((s) => s.trim().length > 0)

  return (
    <View className={`xiaoyue-chat-bubble ${horizontal ? 'xiaoyue-chat-bubble--horizontal' : 'xiaoyue-chat-bubble--vertical'} ${className}`}>
      {/* Avatar with glow */}
      <View className={`xiaoyue-chat-bubble__avatar-wrap ${showGlow ? 'xiaoyue-chat-bubble__avatar-wrap--glow' : ''}`}>
        <Image
          className='xiaoyue-chat-bubble__avatar'
          mode='aspectFit'
          src={getXiaoyueExpressionAsset(expressionId)}
        />
      </View>

      {/* Bubble */}
      <View className='xiaoyue-chat-bubble__bubble'>
        {sentences.map((sentence, i) => (
          <Text
            key={i}
            className='xiaoyue-chat-bubble__sentence'
            style={{ animationDelay: `${i * staggerDelay}ms` }}
          >
            {sentence.trim()}
            {i < sentences.length - 1 ? '。' : ''}
          </Text>
        ))}
      </View>
    </View>
  )
}
