import { View, Text } from '@tarojs/components'
import { useState, useMemo } from 'react'
import { DEFAULT_MASCOT_DISPLAY_NAME } from '@shared/mascotConfig'
import { ANALYZING_MIN_DURATION_MS, ANALYZING_SKIP_DELAY_MS } from '../../lib/utils/uiConstants'
import { useChoreographedWait } from '../../hooks/useChoreographedWait'
import JoyJoinIcon from '../ui/JoyJoinIcon'
import './AnalyzingAnimation.scss'

export interface AnalyzingAnimationProps {
  /** Primary text label */
  label?: string
  /** Subtitle text */
  subtitle?: string
  /** Minimum display duration in ms before auto-advance */
  minDuration?: number
  /** Called when animation should be considered complete */
  onComplete?: () => void
  /** Whether to disable animations for accessibility */
  shouldReduceMotion?: boolean
}

const SPARKLES = [1, 2, 3, 4, 5, 6, 7, 8]

/**
 * AnalyzingAnimation — magical "AI synthesizing your profile" moment.
 *
 * Taro-native equivalent of web SpiralWaveAnimation.
 * Uses concentric breathing rings + sparkle particles (CSS-only, GPU-safe).
 *
 * Pixel specs:
 * - Canvas: 400rpx × 400rpx
 * - Ring count: 5
 * - Ring stroke: 4rpx
 * - Sparkle count: 8
 * - Min duration: 1200ms (skippable after 600ms)
 */
export default function AnalyzingAnimation({
  label = '正在生成你的专属画像',
  subtitle = `${DEFAULT_MASCOT_DISPLAY_NAME}正在分析你的性格密码...`,
  minDuration = ANALYZING_MIN_DURATION_MS,
  onComplete,
  shouldReduceMotion = false,
}: AnalyzingAnimationProps) {
  // PR-7: shared choreographed-wait contract (min display + tap-through).
  // Also fixes the legacy double-fire: onComplete used to fire again when
  // the min-duration timer landed after a manual skip.
  const { canSkip, skip, isSkippable } = useChoreographedWait({
    minDuration,
    skipDelay: ANALYZING_SKIP_DELAY_MS,
    onComplete,
  })

  const rings = [1, 2, 3, 4, 5]

  const sparklePositions = useMemo(
    () =>
      SPARKLES.map(() => ({
        top: `${20 + Math.random() * 60}%`,
        left: `${20 + Math.random() * 60}%`,
      })),
    [],
  )

  if (shouldReduceMotion) {
    return (
      <View className='analyzing-animation analyzing-animation--reduced'>
        <JoyJoinIcon emoji='✨' tier='mood' size={48} className='analyzing-animation__emoji' />
        <Text className='analyzing-animation__label'>{label}</Text>
      </View>
    )
  }

  return (
    <View
      className='analyzing-animation'
      onClick={() => {
        if (isSkippable()) {
          skip()
        }
      }}
    >
      {/* Breathing rings */}
      <View className='analyzing-animation__rings'>
        {rings.map((i) => (
          <View
            key={i}
            className='analyzing-animation__ring'
            style={{
              width: `${i * 80}rpx`,
              height: `${i * 80}rpx`,
              animationDelay: `${i * 0.15}s`,
            }}
          />
        ))}
      </View>

      {/* Sparkle particles */}
      {SPARKLES.map((i) => (
        <View
          key={`sparkle-${i}`}
          className='analyzing-animation__sparkle'
          style={{
            animationDelay: `${i * 0.2}s`,
            top: sparklePositions[i - 1].top,
            left: sparklePositions[i - 1].left,
          }}
        />
      ))}

      {/* Text */}
      <View className='analyzing-animation__text'>
        <Text className='analyzing-animation__label'>{label}</Text>
        <Text className='analyzing-animation__subtitle'>{subtitle}</Text>
        {canSkip && (
          <Text className='analyzing-animation__skip-hint'>点击跳过</Text>
        )}
      </View>
    </View>
  )
}
