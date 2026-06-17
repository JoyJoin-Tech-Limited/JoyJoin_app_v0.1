import { View, Image, Text } from '@tarojs/components'
import { useState } from 'react'
import { cdnAsset, localAsset } from '@/lib/utils/cdnAssets'

export type XiaoyueEmptyStateEmotion =
  | 'coaching'
  | 'celebration'
  | 'waiting'
  | 'reassure'
  | 'curious'
  | 'events'

export interface XiaoyueEmptyStateProps {
  emotion: XiaoyueEmptyStateEmotion
  title: string
  subtitle?: string
  actionLabel?: string
  onAction?: () => void
  disabled?: boolean
  loading?: boolean
  loadingLabel?: string
  size?: 'sm' | 'md' | 'lg'
  /** Disable the infinite mascot breathe animation (e.g. on degradation-tier devices). */
  disableBreathe?: boolean
  /** Explicit reduced-motion override. CSS media query is the primary guard. */
  motionReduced?: boolean
  /** Show a small celebration badge on the mascot (e.g. feedback-complete). */
  showCelebrationBadge?: boolean
}

const SIZE_MAP = { sm: 160, md: 200, lg: 240 }

const EMOTION_MAP: Record<XiaoyueEmptyStateEmotion, string> = {
  coaching: 'xiaoyue-coach-guide',
  celebration: 'xiaoyue-match-success',
  waiting: 'xiaoyue-match-waiting',
  reassure: 'xiaoyue-opt-out-reassure',
  curious: 'xiaoyue-connections-empty',
  events: 'xiaoyue-events-empty',
}

function classNames(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(' ')
}

export default function XiaoyueEmptyState({
  emotion,
  title,
  subtitle,
  actionLabel,
  onAction,
  disabled = false,
  loading = false,
  loadingLabel,
  size = 'md',
  disableBreathe = false,
  motionReduced = false,
  showCelebrationBadge = false,
}: XiaoyueEmptyStateProps) {
  const [imgError, setImgError] = useState(false)
  const dim = SIZE_MAP[size]
  const isActionDisabled = disabled || loading
  const mascotClass = classNames(
    'xiaoyue-empty-state__mascot',
    disableBreathe && 'xiaoyue-empty-state__mascot--no-breathe',
    motionReduced && 'xiaoyue-empty-state__mascot--reduced',
    showCelebrationBadge && 'xiaoyue-empty-state__mascot--celebrate'
  )

  return (
    <View className='xiaoyue-empty-state'>
      <View className='xiaoyue-empty-state__mascot-wrap'>
        {!imgError ? (
          <Image
            className={mascotClass}
            src={cdnAsset(`/assets/personality/xiaoyue/${EMOTION_MAP[emotion]}.webp`)}
            style={{ width: `${dim}rpx`, height: `${dim}rpx` }}
            mode='aspectFit'
            lazyLoad={false}
            aria-label='悦仔'
            onError={() => setImgError(true)}
          />
        ) : (
          <View
            className='xiaoyue-empty-state__mascot-fallback'
            style={{ width: `${dim}rpx`, height: `${dim}rpx`, '--fallback-size': `${dim * 0.35}rpx` } as React.CSSProperties}
            aria-label='悦仔 mascot'
          >
            <Text className='xiaoyue-empty-state__mascot-fallback-text'>
              悦
            </Text>
          </View>
        )}
        {showCelebrationBadge && (
          <View className='xiaoyue-empty-state__mascot-badge' aria-label='完成'>
            <Image
              className='xiaoyue-empty-state__mascot-badge-icon'
              src={localAsset('/assets/icons/ui/icon-check.webp')}
              mode='aspectFit'
            />
          </View>
        )}
      </View>
      <Text className='xiaoyue-empty-state__title'>{title}</Text>
      {subtitle && <Text className='xiaoyue-empty-state__subtitle'>{subtitle}</Text>}
      {actionLabel && onAction && (
        <View
          className={classNames(
            'xiaoyue-empty-state__action',
            isActionDisabled && 'xiaoyue-empty-state__action--disabled'
          )}
          hoverClass='xiaoyue-empty-state__action--active'
          hoverStayTime={100}
          onClick={isActionDisabled ? undefined : onAction}
          role='button'
          aria-label={loading && loadingLabel ? loadingLabel : actionLabel}
          aria-disabled={isActionDisabled}
        >
          {loading && <View className='xiaoyue-empty-state__action-spinner' aria-hidden='true' />}
          <Text className='xiaoyue-empty-state__action-text'>
            {loading && loadingLabel ? loadingLabel : actionLabel}
          </Text>
        </View>
      )}
    </View>
  )
}
