import { View, Text, Image } from '@tarojs/components'
import { useState, useEffect, useMemo } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { getXiaoyueExpressionAsset } from '../../lib/mascot/xiaoyueExpressions'
import { localAsset } from '../../lib/utils/cdnAssets'
import { getRandomWhisper } from '../../lib/utils/loadingWhispers'
import { logInfo } from '../../lib/utils/logger'
import './JoyJoinLoadingScreen.scss'

interface JoyJoinLoadingScreenProps {
  /** Primary status message (e.g. "悦仔正在赶来…") */
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
  /** User archetype for personalized whisper copy */
  archetype?: string
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
 * - 6s settle timeout (A4)
 * - CDN fallback to local joyjoin-logo (A3)
 * - Archetype-aware whisper copy (B2)
 */
export default function JoyJoinLoadingScreen({
  title = `${DEFAULT_MASCOT_DISPLAY_NAME}正在赶来…`,
  subtitle,
  xiaoyueExpression = 'loadingSystem',
  showSkeleton = true,
  skeletonLines = 3,
  className = '',
  archetype,
}: JoyJoinLoadingScreenProps) {
  const lineWidths = ['100%', '76%', '52%', '64%', '88%']
  const [imgSrc, setImgSrc] = useState(getXiaoyueExpressionAsset(xiaoyueExpression))
  const [settled, setSettled] = useState(false)

  // A4: settle animations after 6s to save battery on stalled loads
  useEffect(() => {
    const t = setTimeout(() => setSettled(true), 6000)
    return () => clearTimeout(t)
  }, [])

  // A5: prefers-reduced-motion is handled by CSS @media (prefers-reduced-motion: reduce).
  // WeChat Mini Program does not expose this API reliably via JS.

  const displaySubtitle = useMemo(
    () => subtitle ?? (archetype ? getRandomWhisper(archetype) : getRandomWhisper()),
    [subtitle, archetype],
  )

  return (
    <View className={`joyjoin-loading-screen ${settled ? 'joyjoin-loading-screen--settled' : ''} ${className}`}>
      <View className='joyjoin-loading-screen__content'>
        {/* Xiaoyue mascot */}
        <Image
          className='joyjoin-loading-screen__mascot'
          src={imgSrc}
          mode='aspectFit'
          onError={() => {
            logInfo('[JoyJoinLoadingScreen] CDN fallback triggered', { original: imgSrc })
            setImgSrc(localAsset('/assets/xiaoyue-expressions/xiaoyue-loading-system.webp'))
          }}
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
        {displaySubtitle ? (
          <Text className='joyjoin-loading-screen__subtitle'>{displaySubtitle}</Text>
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
