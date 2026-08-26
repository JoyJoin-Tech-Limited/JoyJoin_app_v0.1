import { Image, Text, View } from '@tarojs/components'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { haptics } from '../../lib/utils/haptics'

interface XiaoyueInlineErrorProps {
  /**
   * 悦仔-voice message — resolve via `getErrorForSurface(code, 'inline-error')`
   * from `@shared/copy/errorBaselines` so copy stays governed.
   */
  message: string
  /** Optional compact retry action pinned to the row's trailing edge. */
  retryLabel?: string
  onRetry?: () => void
  className?: string
}

/**
 * Compact inline failure row (PR-8): small 悦仔 icon + speech-bubble copy,
 * replacing bare `Taro.showToast` error toasts across onboarding surfaces.
 *
 * SUBPACKAGE RULE: this component intentionally has NO `import './X.scss'`
 * side effect — every consuming page SCSS must `@use` the component SCSS so
 * the rules compile into that page's WXSS (subpackage style-splitting trap,
 * AGENTS §15 / verify-subpackage-styles gate).
 */
export default function XiaoyueInlineError({
  message,
  retryLabel,
  onRetry,
  className,
}: XiaoyueInlineErrorProps) {
  if (!message) {
    return null
  }

  return (
    <View
      className={['xiaoyue-inline-error', className ?? ''].filter(Boolean).join(' ')}
      role='alert'
      aria-live='polite'
    >
      <Image
        className='xiaoyue-inline-error__icon'
        src={getXiaoyueExpressionAsset('actionFailure')}
        mode='aspectFit'
        aria-hidden='true'
      />
      <View className='xiaoyue-inline-error__bubble'>
        <Text className='xiaoyue-inline-error__text'>{message}</Text>
      </View>
      {onRetry ? (
        <View
          className='xiaoyue-inline-error__retry'
          hoverClass='xiaoyue-inline-error__retry--hover'
          hoverStartTime={0}
          hoverStayTime={100}
          role='button'
          aria-label={retryLabel ?? '重试'}
          onClick={() => {
            haptics('light')
            onRetry()
          }}
        >
          <Text className='xiaoyue-inline-error__retry-text'>{retryLabel ?? '重试'}</Text>
        </View>
      ) : null}
    </View>
  )
}
