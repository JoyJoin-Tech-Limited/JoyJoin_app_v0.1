import { useEffect, useState } from 'react'
import { View, Text } from '@tarojs/components'
import { PhaseHeaderIcon, getPhaseLabel } from './phaseViews'
import type { SessionPhase } from './phaseViews'

const OVERLAY_DURATION_MS = 1600
const FADE_OUT_START_MS = 1200

/** Full-screen phase intro overlay — flashes when entering a new phase
 *
 * Shows the phase icon at 160rpx with a dramatic fade-in/scale-up animation,
 * holds for ~1.2s, then fades out. Total duration ~1.6s.
 */
export function PhaseIntroOverlay({
  phase,
  visible,
}: {
  phase: SessionPhase
  visible: boolean
}) {
  const [show, setShow] = useState(false)
  const [fadingOut, setFadingOut] = useState(false)
  const [animKey, setAnimKey] = useState(0)

  useEffect(() => {
    if (!visible) {
      setShow(false)
      setFadingOut(false)
      return
    }

    // Force remount on rapid transitions — prevents stale timer overlap
    setAnimKey((k) => k + 1)
    setShow(true)
    setFadingOut(false)

    const fadeOutTimer = setTimeout(() => {
      setFadingOut(true)
    }, FADE_OUT_START_MS)

    const hideTimer = setTimeout(() => {
      setShow(false)
      setFadingOut(false)
    }, OVERLAY_DURATION_MS)

    return () => {
      clearTimeout(fadeOutTimer)
      clearTimeout(hideTimer)
    }
  }, [visible])

  if (!show) return null

  return (
    <View
      key={animKey}
      className={`phase-intro-overlay ${fadingOut ? 'phase-intro-overlay--out' : ''}`}
      catchMove
    >
      <View className='phase-intro-overlay__content'>
        <PhaseHeaderIcon phase={phase} size={160} />
        <Text className='phase-intro-overlay__label'>{getPhaseLabel(phase)}</Text>
      </View>
    </View>
  )
}
