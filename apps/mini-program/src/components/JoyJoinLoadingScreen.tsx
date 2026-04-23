import { View, Text, Image } from '@tarojs/components'
import { getXiaoyueExpressionAsset } from '../lib/xiaoyueExpressions'
import './JoyJoinLoadingScreen.scss'

interface JoyJoinLoadingScreenProps {
  /** Primary status message (e.g. "加载中…") */
  title?: string
  /** Secondary hint (e.g. "正在为你匹配最合适的活动") */
  subtitle?: string
  /** Xiaoyue expression for the loading state */
  xiaoyueExpression?: 'loadingSystem' | 'loadingReveal' | 'homeWelcome'
  /** Whether to show skeleton placeholder lines */
  showSkeleton?: boolean
  /** Number of skeleton lines (default 3) */
  skeletonLines?: number
  className?: string
}

/**
 * JoyJoinLoadingScreen — premium full-page loading state.
 *
 * Features:
 * - Animated Xiaoyue mascot (breathing scale)
 * - 3 pulsing orbit dots (staggered animation)
 * - Optional skeleton placeholder lines
 * - Brand gradient background
 * - Safe area padding
 * - prefers-reduced-motion support
 */
export default function JoyJoinLoadingScreen({
  title = '加载中…',
  subtitle,
  xiaoyueExpression = 'loadingSystem',
  showSkeleton = true,
  skeletonLines = 3,
  className = '',
}: JoyJoinLoadingScreenProps) {
  const lineWidths = ['100%', '76%', '52%', '64%', '88%']

  return (
    <View className={`joyjoin-loading-screen ${className}`}>
      <View className='joyjoin-loading-screen__content'>
        {/* Xiaoyue mascot */}
        <Image
          className='joyjoin-loading-screen__mascot'
          src={getXiaoyueExpressionAsset(xiaoyueExpression)}
          mode='aspectFit'
        />

        {/* Pulsing orbit dots */}
        <View className='joyjoin-loading-screen__orbit'>
          {[1, 2, 3].map((i) => (
            <View
              key={i}
              className={`joyjoin-loading-screen__dot joyjoin-loading-screen__dot--${i}`}
            />
          ))}
        </View>

        {/* Status text */}
        <Text className='joyjoin-loading-screen__title'>{title}</Text>
        {subtitle ? (
          <Text className='joyjoin-loading-screen__subtitle'>{subtitle}</Text>
        ) : null}

        {/* Skeleton placeholder */}
        {showSkeleton ? (
          <View className='joyjoin-loading-screen__skeleton'>
            {Array.from({ length: skeletonLines }).map((_, i) => (
              <View
                key={i}
                className='joyjoin-loading-screen__skeleton-line'
                style={{ width: lineWidths[i % lineWidths.length] }}
              />
            ))}
          </View>
        ) : null}
      </View>
    </View>
  )
}
