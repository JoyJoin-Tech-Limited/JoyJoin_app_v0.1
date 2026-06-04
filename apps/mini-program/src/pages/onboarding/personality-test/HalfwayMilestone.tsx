import { useEffect, useRef } from 'react'
import { View, Text, Image } from '@tarojs/components'
import { MILESTONE_BADGES } from '../../../lib/milestoneBadges'
import type { Phase } from './types'
import './HalfwayMilestone.scss'

interface HalfwayMilestoneProps {
  progressPercent: number
  phase: Phase
  answered: number
  estimatedTotal: number
  /**
   * Fires exactly once per session, the first time the test crosses 50%
   * progress in the testing phase. Parent owns side-effects (haptic, log,
   * analytics) so this component stays pure presentation.
   */
  onMilestoneReached?: (info: { answered: number; estimatedTotal: number }) => void
}

type ConfettiShape = 'star' | 'sparkle' | 'dot' | 'ribbon'

/**
 * 9 hand-tuned confetti particles around the badge. Each entry's
 * `top`/`left` are rpx offsets relative to the stage's safe-area-inline
 * box. The stage has `overflow: hidden`, so any accidental overflow is
 * clipped on narrow screens.
 */
const HALFWAY_CONFETTI: ReadonlyArray<{
  shape: ConfettiShape
  top: number
  left: number
  delayMs: number
  rotate?: number
}> = [
  { shape: 'star',    top: 6,   left: 28,  delayMs: 40  },
  { shape: 'sparkle', top: -8,  left: 96,  delayMs: 120 },
  { shape: 'dot',     top: 18,  left: 156, delayMs: 200 },
  { shape: 'ribbon',  top: 56,  left: 8,   delayMs: 280, rotate: 15  },
  { shape: 'star',    top: 90,  left: 60,  delayMs: 360 },
  { shape: 'sparkle', top: 70,  left: 120, delayMs: 440 },
  { shape: 'dot',     top: 4,   left: 200, delayMs: 520 },
  { shape: 'ribbon',  top: 102, left: 180, delayMs: 600, rotate: -12 },
  { shape: 'sparkle', top: 36,  left: 240, delayMs: 680 },
]

export function HalfwayMilestone({
  progressPercent,
  phase,
  answered,
  estimatedTotal,
  onMilestoneReached,
}: HalfwayMilestoneProps) {
  const halfwayShownRef = useRef(false)

  useEffect(() => {
    if (progressPercent >= 50 && !halfwayShownRef.current && phase === 'testing') {
      halfwayShownRef.current = true
      onMilestoneReached?.({ answered, estimatedTotal })
    }
  }, [progressPercent, phase, answered, estimatedTotal, onMilestoneReached])

  if (progressPercent < 50 || phase !== 'testing' || !halfwayShownRef.current) {
    return null
  }

  return (
    <View className='halfway-milestone__stage' role='region' aria-label='测验已完成一半，半程已过，继续加油'>
      <View className='halfway-milestone__confetti-container' aria-hidden='true'>
        {HALFWAY_CONFETTI.map((c, i) => (
          <View
            key={i}
            className={`halfway-milestone__confetti halfway-milestone__confetti--${c.shape}`}
            style={{
              '--halfway-confetti-top': `${c.top}rpx`,
              '--halfway-confetti-left': `${c.left}rpx`,
              '--halfway-confetti-delay': `${c.delayMs}ms`,
              '--halfway-confetti-rotate': `${c.rotate ?? 0}deg`,
            } as React.CSSProperties}
          />
        ))}
      </View>
      <View className='halfway-milestone__badge'>
        <View className='halfway-milestone__badge-halo' aria-hidden='true' />
        <Image
          className='halfway-milestone__badge-img'
          mode='aspectFit'
          src={MILESTONE_BADGES.quizHalfway}
          lazyLoad={false}
        />
      </View>
      <View className='halfway-milestone__text'>
        <Text className='halfway-milestone__text-eyebrow'>半程已过</Text>
        <Text className='halfway-milestone__text-main'>走到一半了，继续走～</Text>
      </View>
    </View>
  )
}
