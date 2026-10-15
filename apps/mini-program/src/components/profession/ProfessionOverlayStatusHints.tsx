import { View, Text } from '@tarojs/components'
import { haptics } from '../../lib/utils/haptics'
import { MAX_SEND_SKIP_BANNER_COPY } from '../../lib/onboarding/professionOverlayCopy'

/**
 * Non-blocking status hints layered over the profession overlay: offline
 * banner, "write a bit more" nudge, max-send notice, and the retry bar.
 *
 * Extracted from `ProfessionChatOverlay.tsx` (no behavior change). Rendered as
 * a fragment so the overlay's flex column layout keeps the exact same child
 * sequence. Styles remain in `ProfessionChatOverlay.scss`.
 */
export default function ProfessionOverlayStatusHints({
  isOnline,
  showShortHint,
  isSubmitting,
  showMaxSendHint,
  retryMessageId,
  showRevealCard,
  onRetry,
  maxSendSkippable = false,
  onMaxSendSkip,
}: {
  isOnline: boolean
  showShortHint: boolean
  isSubmitting: boolean
  showMaxSendHint: boolean
  retryMessageId: string | null
  showRevealCard: boolean
  onRetry: () => void
  /**
   * R6 dead-end: true when the send quota is exhausted with no usable
   * classification — the banner swaps to the skip copy and becomes tappable.
   */
  maxSendSkippable?: boolean
  /** Executed when the tappable dead-end banner is pressed (runs skip). */
  onMaxSendSkip?: () => void
}) {
  const maxSendActionable = maxSendSkippable && !!onMaxSendSkip
  return (
    <>
      {!isOnline && (
        <View className='profession-overlay__offline-banner'>
          <Text className='profession-overlay__offline-banner-text'>网络已断开，请检查连接</Text>
        </View>
      )}

      {showShortHint && !isSubmitting && (
        <View className='profession-overlay__short-hint'>
          <Text className='profession-overlay__short-hint-text'>多写一点，悦仔才能更懂你～</Text>
        </View>
      )}

      {showMaxSendHint && (
        maxSendActionable ? (
          <View
            className='profession-overlay__max-send-hint profession-overlay__max-send-hint--action'
            onClick={() => { haptics('light'); onMaxSendSkip() }}
            role='button'
            aria-label='跳过职业输入'
            hoverClass='profession-overlay__max-send-hint--active'
            hoverStartTime={0}
            hoverStayTime={100}
          >
            <Text className='profession-overlay__max-send-hint-text profession-overlay__max-send-hint-text--action'>
              {MAX_SEND_SKIP_BANNER_COPY}
            </Text>
          </View>
        ) : (
          <View className='profession-overlay__max-send-hint'>
            <Text className='profession-overlay__max-send-hint-text'>已达到最大重试次数，先继续吧～</Text>
          </View>
        )
      )}

      {retryMessageId && !isSubmitting && !showRevealCard && (
        <View className='profession-overlay__retry-bar'>
          <View className='profession-overlay__retry-btn' onClick={() => { haptics('medium'); onRetry() }} aria-label='重试' hoverClass='profession-overlay__retry-btn--active' hoverStartTime={0} hoverStayTime={100}>
            <Text className='profession-overlay__retry-btn-text'>重试</Text>
          </View>
        </View>
      )}
    </>
  )
}
