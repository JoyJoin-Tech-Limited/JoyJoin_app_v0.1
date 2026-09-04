import { View, Text, Image } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { useMemo } from 'react'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import { MASCOT_SIZE } from '../../lib/mascot/mascotSizes'
import './XiaoyueChatBubble.scss'
import { getSystemReducedMotionCompat } from '../../lib/utils/systemInfo'

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
  /** Show speech tail pointing to the mascot avatar */
  tail?: boolean
  /** Hide the mascot avatar and render only the bubble.
   *  Useful when another component (e.g. XiaoyueCoachCard) already owns the mascot for the screen section,
   *  avoiding duplicate mascot crowding. */
  hideAvatar?: boolean
  /** Override avatar size (e.g. '200rpx'). When set, controls both the avatar wrap container
   *  and the avatar image size. Falls back to 96rpx (horizontal) / 120rpx (vertical/wide). */
  avatarSize?: string
}

/**
 * XiaoyueChatBubble — animated mascot coaching bubble for onboarding.
 *
 * Pixel specs (shared speech-bubble tokens in _variables.scss):
 * - Avatar size: 96rpx (horizontal), 120rpx (vertical), overridable via avatarSize prop
 * - Bubble radius: 24rpx (=$bubble-radius), padding 24rpx (=$bubble-padding)
 * - Bubble border: 2rpx solid rgba($color-primary, 0.14) (=$bubble-border-*)
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
  tail = false,
  hideAvatar = false,
  avatarSize,
}: XiaoyueChatBubbleProps) {
  const resolvedExpressionId = isLoading
    ? 'loadingSystem'
    : expressionIdProp ?? POSE_TO_EXPRESSION[pose]
  const sentences = content.split(/[。.]/).filter((s) => s.trim().length > 0)

  const prefersReducedMotion = useMemo(() => {
    try {
      return getSystemReducedMotionCompat()
    } catch {
      return false
    }
  }, [])
  const effectiveStaggerDelay = prefersReducedMotion ? 0 : staggerDelay

  // 120rpx is not on the mascot size ramp — intentional legacy value for the
  // wide/vertical stacked layout; do not move it onto the ramp.
  const resolvedAvatarSize = avatarSize ?? (wide ? '120rpx' : MASCOT_SIZE.sm)

  const layoutClass = wide
    ? 'xiaoyue-chat-bubble--wide'
    : horizontal
      ? 'xiaoyue-chat-bubble--horizontal'
      : 'xiaoyue-chat-bubble--vertical'

  // Large horizontal avatars (>=152rpx, i.e. onboarding lg+) sit at the
  // bubble's natural center (mascot head zone) instead of top-aligned.
  const centerAvatar = horizontal && !wide && !hideAvatar && parseInt(resolvedAvatarSize, 10) >= 152

  return (
    <View
      className={`xiaoyue-chat-bubble ${layoutClass} ${hideAvatar ? 'xiaoyue-chat-bubble--no-avatar' : ''} ${centerAvatar ? 'xiaoyue-chat-bubble--center-avatar' : ''} ${className}`}
      role='status'
      aria-live='polite'
      aria-atomic='true'
    >
      {/* Avatar with glow */}
      {!hideAvatar && (
        <View
          className={`xiaoyue-chat-bubble__avatar-wrap ${showGlow ? 'xiaoyue-chat-bubble__avatar-wrap--glow' : ''} ${isLoading ? 'xiaoyue-chat-bubble__avatar-wrap--loading' : ''}`}
          style={avatarSize ? { width: avatarSize, height: avatarSize } : undefined}
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
      )}

      {/* Bubble */}
      <View className={`xiaoyue-chat-bubble__bubble ${isLoading ? 'xiaoyue-chat-bubble__bubble--loading' : ''} ${tail && horizontal && !wide && !hideAvatar ? 'xiaoyue-chat-bubble__bubble--tail' : ''}`}>
        {sentences.map((sentence, i) => (
          <Text
            key={i}
            className='xiaoyue-chat-bubble__sentence'
            style={{ animationDelay: `${i * effectiveStaggerDelay}ms` }}
          >
            {sentence.trim()}
            {i < sentences.length - 1 ? '。' : ''}
          </Text>
        ))}
      </View>
    </View>
  )
}
