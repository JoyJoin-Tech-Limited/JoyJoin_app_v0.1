import { View, Text } from '@tarojs/components'
import { useEffect, useRef, useState } from 'react'
import BrandLogo from '../ui/BrandLogo'
import './BoxLogoEntryScreen.scss'

type Phase = 'entering' | 'exiting' | 'done'

interface BoxLogoEntryScreenProps {
  /** Called after the exit fade completes (~1250ms total). */
  onComplete?: () => void
  /** When true, skip to exit phase immediately (e.g. offline detected). */
  abort?: boolean
  /** Status text shown below the logo (e.g. "正在检查网络…"). */
  statusText?: string
}

/** Time the entrance animation is allowed to play before starting exit.
 *  Extended to 1100ms so critical assets (fonts, archetype glyphs,
 *  onboarding images) have more background preload runway before the
 *  user reaches the LandingPage.
 */
const ENTRY_MS = 1100
/** Duration of the exit fade transition. */
const EXIT_MS = 150

/**
 * BoxLogoEntryScreen — branded cold-start splash with smooth exit fade.
 *
 * Warm Landing animation:
 * - Logo rises and settles (translateY + scale + opacity)
 * - Warm radial glow blooms behind it then fades
 * - Total visible time: ~1250ms (1100ms entrance + 150ms exit fade)
 * - Pure transform + opacity for Taro performance
 * - Reduced-motion: static fade-in only
 *
 * Network awareness via `abort` + `statusText`:
 * - While the parent checks network (launch-level), `statusText` shows below
 *   the logo so the user sees "正在检查网络…" instead of a dead silent splash.
 * - If offline is detected before the entrance animation completes, `abort`
 *   transitions to true and the screen fades out immediately, reducing the
 *   dead window before the offline banner appears on LandingPage.
 */
export default function BoxLogoEntryScreen({ onComplete, abort, statusText }: BoxLogoEntryScreenProps) {
  const [phase, setPhase] = useState<Phase>('entering')
  const entryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Trigger exit fade after entrance completes.
  useEffect(() => {
    entryTimerRef.current = setTimeout(() => setPhase('exiting'), ENTRY_MS)
    return () => {
      if (entryTimerRef.current) clearTimeout(entryTimerRef.current)
    }
  }, [])

  // When abort transitions to true during entrance, immediately skip to exit
  // so the offline banner appears sooner.
  useEffect(() => {
    if (abort && phase === 'entering') {
      if (entryTimerRef.current) clearTimeout(entryTimerRef.current)
      setPhase('exiting')
    }
  }, [abort, phase])

  // Notify parent and unmount after exit fade.
  useEffect(() => {
    if (phase !== 'exiting') return
    const t = setTimeout(() => {
      setPhase('done')
      onComplete?.()
    }, EXIT_MS)
    return () => clearTimeout(t)
  }, [phase, onComplete])

  if (phase === 'done') return null

  const isExiting = phase === 'exiting'

  return (
    <View className={`box-logo-entry ${isExiting ? 'box-logo-entry--exiting' : ''}`}>
      <View className='box-logo-entry__inner'>
        <View className='box-logo-entry__stage'>
          {/* Warm glow behind the logo */}
          <View className='box-logo-entry__glow' />

          {/* Box logo */}
          <BrandLogo
            size='lg'
            className='box-logo-entry__logo'
          />
        </View>
        {statusText && (
          <Text className='box-logo-entry__status'>{statusText}</Text>
        )}
      </View>
    </View>
  )
}
