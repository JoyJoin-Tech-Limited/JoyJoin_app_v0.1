import { useState, useCallback, useRef, useEffect } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import JoyJoinIcon from '../ui/JoyJoinIcon'
// No SCSS side-effect import: Taro's per-subpackage chunking would strand it
// in a page-invisible sub-common.wxss. Consuming pages must @use
// '../../components/gesture/TapRhythm.scss' in their page SCSS.

function prefersReducedMotion(): boolean {
  try {
    const info = Taro.getSystemInfoSync()
    if ((info as any).reduceMotion) return true
  } catch {
    // ignore
  }
  return false
}

const REDUCED_MOTION = prefersReducedMotion()

export interface TapRhythmProps {
  /** Called on every tap */
  onTap?: () => void
  /** Current accumulated tap count (controlled) */
  tapCount?: number
  /** Target count to reach */
  targetCount?: number
  /** Emoji shown inside the tap target (rendered via JoyJoinIcon) */
  emoji?: string
  /** JoyJoinIcon tier for the target glyph */
  tier?: 'phase' | 'reaction' | 'achievement' | 'intent' | 'semantic'
  /** Override reduced-motion detection for testing */
  reducedMotion?: boolean
}

/**
 * TapRhythm — rapid-tap meter for group cheer/boo actions.
 *
 * Used in micro_challenge, group_mirror.
 * Each tap triggers a scale pulse + opacity flash.
 * Reduced motion: static color change only.
 */
export default function TapRhythm({
  onTap,
  tapCount = 0,
  tier = 'achievement',
  targetCount,
  emoji = '👏',
  reducedMotion,
}: TapRhythmProps) {
  const isReduced = reducedMotion ?? REDUCED_MOTION
  const [pulsing, setPulsing] = useState(false)
  const [colorFlash, setColorFlash] = useState(false)
  const timeoutsRef = useRef<ReturnType<typeof setTimeout>[]>([])

  const clearAll = () => {
    timeoutsRef.current.forEach(clearTimeout)
    timeoutsRef.current = []
  }

  const handleTap = useCallback(() => {
    onTap?.()

    if (!isReduced) {
      setPulsing(true)
      setColorFlash(true)
      clearAll()
      timeoutsRef.current.push(setTimeout(() => setPulsing(false), 150))
      timeoutsRef.current.push(setTimeout(() => setColorFlash(false), 150))
    } else {
      setColorFlash(true)
      clearAll()
      timeoutsRef.current.push(setTimeout(() => setColorFlash(false), 150))
    }
  }, [onTap, isReduced])

  useEffect(() => {
    return () => clearAll()
  }, [])

  const progress = targetCount && targetCount > 0
    ? Math.min(tapCount / targetCount, 1)
    : 0

  return (
    <View className='gesture-tap-rhythm'>
      <View
        className={`gesture-tap-rhythm__target${pulsing ? ' gesture-tap-rhythm__target--pulse' : ''}${colorFlash ? ' gesture-tap-rhythm__target--flash' : ''}`}
        onClick={handleTap}
      >
        <JoyJoinIcon emoji={emoji} tier={tier} size={72} />
      </View>

      {typeof targetCount === 'number' && targetCount > 0 && (
        <View className='gesture-tap-rhythm__meter'>
          <View className='gesture-tap-rhythm__track'>
            <View
              className='gesture-tap-rhythm__fill'
              style={{ transform: `scaleX(${progress})` }}
            />
          </View>
          <Text className='gesture-tap-rhythm__count'>
            {tapCount} / {targetCount}
          </Text>
        </View>
      )}
    </View>
  )
}
