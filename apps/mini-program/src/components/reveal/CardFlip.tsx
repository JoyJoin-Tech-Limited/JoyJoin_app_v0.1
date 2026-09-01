import { type ReactNode, useCallback } from 'react'
import { View } from '@tarojs/components'
import Taro from '@tarojs/taro'
import { getSystemReducedMotionCompat } from '../../lib/utils/systemInfo'
// No SCSS side-effect import: Taro's per-subpackage chunking would strand it
// in a page-invisible sub-common.wxss. Consuming pages must @use
// '../../components/reveal/CardFlip.scss' in their page SCSS.

function prefersReducedMotion(): boolean {
  try {
    if (getSystemReducedMotionCompat()) return true
  } catch {
    // ignore
  }
  return false
}

const REDUCED_MOTION = prefersReducedMotion()

export interface CardFlipProps {
  /** Content shown on the front face */
  front: ReactNode
  /** Content shown on the back face */
  back: ReactNode
  /** Whether the card is flipped to show the back */
  flipped: boolean
  /** Called when the card is tapped (toggle flip) */
  onFlip?: () => void
  /** Transition duration in ms (default 400) */
  duration?: number
  /** Override reduced-motion detection for testing */
  reducedMotion?: boolean
}

/**
 * CardFlip — dramatic 3D card flip reveal.
 *
 * Used across lie_detective, undercover_word, mini_script, personality_dice.
 * CSS `rotateY` with `backface-visibility: hidden` for GPU-safe 3D.
 * Reduced motion: instant opacity swap.
 */
export default function CardFlip({
  front,
  back,
  flipped,
  onFlip,
  duration = 400,
  reducedMotion,
}: CardFlipProps) {
  const isReduced = reducedMotion ?? REDUCED_MOTION
  const handleTap = useCallback(() => {
    onFlip?.()
  }, [onFlip])

  if (isReduced) {
    return (
      <View className='reveal-card-flip reveal-card-flip--reduced' onClick={handleTap}>
        <View
          className='reveal-card-flip__face reveal-card-flip__face--front'
          style={{ opacity: flipped ? 0 : 1 }}
        >
          {front}
        </View>
        <View
          className='reveal-card-flip__face reveal-card-flip__face--back'
          style={{ opacity: flipped ? 1 : 0 }}
        >
          {back}
        </View>
      </View>
    )
  }

  const wrapperStyle = {
    transitionDuration: `${duration}ms`,
  }

  return (
    <View className='reveal-card-flip' onClick={handleTap}>
      <View
        className={`reveal-card-flip__wrapper${flipped ? ' reveal-card-flip__wrapper--flipped' : ''}`}
        style={wrapperStyle}
      >
        <View className='reveal-card-flip__face reveal-card-flip__face--front'>
          {front}
        </View>
        <View className='reveal-card-flip__face reveal-card-flip__face--back'>
          {back}
        </View>
      </View>
    </View>
  )
}
