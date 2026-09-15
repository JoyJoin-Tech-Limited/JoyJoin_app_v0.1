import { View, Text, Image, CustomWrapper } from '@tarojs/components'
import { getXiaoyueExpressionAsset, type XiaoyueExpressionId } from '../../lib/mascot/xiaoyueExpressions'
import type { ChatMessage } from '../../lib/onboarding/professionOverlayHelpers'

/**
 * A single chat turn (Xiaoyue avatar + bubble, or a right-aligned user bubble).
 *
 * Extracted verbatim from `ProfessionChatOverlay.tsx` (no behavior change).
 * Styles remain in `ProfessionChatOverlay.scss` — this component ships no SCSS
 * of its own so nothing can be chunked into a subpackage `sub-common.wxss`.
 */
export default function ProfessionChatMessage({ message }: { message: ChatMessage }) {
  return (
    <CustomWrapper>
      <View
        id={`msg-${message.id}`}
        className={`profession-overlay__message profession-overlay__message--${message.sender}`}
      >
        {message.sender === 'xiaoyue' && (
          <View className='profession-overlay__avatar' aria-label='悦仔'>
            <Image
              className='profession-overlay__avatar-img'
              src={getXiaoyueExpressionAsset(message.expressionId ?? 'coachGuide')}
              mode='aspectFill'
              lazyLoad
            />
          </View>
        )}
        <View className={[
          'profession-overlay__bubble',
          `profession-overlay__bubble--${message.sender}`,
          message.isFallback ? 'profession-overlay__bubble--fallback' : '',
        ].filter(Boolean).join(' ')}
        >
          <Text className='profession-overlay__bubble-text'>{message.text}</Text>
        </View>
      </View>
    </CustomWrapper>
  )
}

/**
 * The "Xiaoyue is thinking" bubble — three typing dots plus an optional
 * rotating status label. Anticipation expression is resolved by the caller
 * (it depends on the in-flight user text).
 */
export function ProfessionTypingBubble({
  expressionId,
  thinkingLabel,
}: {
  expressionId: XiaoyueExpressionId
  thinkingLabel: string | null
}) {
  return (
    <View className='profession-overlay__message profession-overlay__message--xiaoyue'>
      <View className='profession-overlay__avatar'>
        <Image
          className='profession-overlay__avatar-img'
          src={getXiaoyueExpressionAsset(expressionId)}
          mode='aspectFill'
          lazyLoad
        />
      </View>
      <View className='profession-overlay__bubble profession-overlay__bubble--xiaoyue'>
        <View className='profession-overlay__typing'>
          <View className='profession-overlay__typing-dot' />
          <View className='profession-overlay__typing-dot' />
          <View className='profession-overlay__typing-dot' />
          {thinkingLabel && (
            <Text className='profession-overlay__typing-label' aria-live='polite'>{thinkingLabel}</Text>
          )}
        </View>
      </View>
    </View>
  )
}
