import { View, Text, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
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
  /** Direct expression override (takes precedence over pose) */
  expressionId?: XiaoyueExpressionId
  /** Layout direction */
  horizontal?: boolean
  /** Wide vertical layout: avatar stacked above full-width bubble */
  wide?: boolean
  /** Whether to show pulsing ring glow */
  showGlow?: boolean
  /** Whether the bubble is in a loading state (dims bubble, swaps avatar to thinking) */
  isLoading?: boolean
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
  expressionId: expressionIdProp,
  horizontal = true,
  wide = false,
  showGlow = true,
  isLoading = false,
  staggerDelay = 80,
  className = '',
}: XiaoyueChatBubbleProps) {
  const resolvedExpressionId = isLoading
    ? 'loadingSystem'
    : expressionIdProp ?? POSE_TO_EXPRESSION[pose]
  const sentences = content.split(/[。.]/).filter((s) => s.trim().length > 0)

  const layoutClass = wide
    ? 'xiaoyue-chat-bubble--wide'
    : horizontal
      ? 'xiaoyue-chat-bubble--horizontal'
      : 'xiaoyue-chat-bubble--vertical'

  return (
    <View className={`xiaoyue-chat-bubble ${layoutClass} ${className}`}>
      {/* Avatar with glow */}
      <View
        className={`xiaoyue-chat-bubble__avatar-wrap ${showGlow ? 'xiaoyue-chat-bubble__avatar-wrap--glow' : ''} ${isLoading ? 'xiaoyue-chat-bubble__avatar-wrap--loading' : ''}`}
      >
        <Image
          className='xiaoyue-chat-bubble__avatar'
          mode='aspectFit'
          src={getXiaoyueExpressionAsset(resolvedExpressionId)}
          onError={() => {
            // Graceful degradation: avatar hides, bubble remains
          }}
        />
      </View>

      {/* Bubble */}
      <View className={`xiaoyue-chat-bubble__bubble ${isLoading ? 'xiaoyue-chat-bubble__bubble--loading' : ''}`}>
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
