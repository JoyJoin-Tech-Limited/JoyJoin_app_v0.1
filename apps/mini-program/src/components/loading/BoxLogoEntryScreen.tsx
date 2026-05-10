import { View } from '@tarojs/components'
import BrandLogo from '../ui/BrandLogo'
import { useEffect, useState } from 'react'
import './BoxLogoEntryScreen.scss'

type Phase = 'entering' | 'exiting' | 'done'

interface BoxLogoEntryScreenProps {
  /** Called after the exit fade completes (~950ms total). */
  onComplete?: () => void
}

/** Time the entrance animation is allowed to play before starting exit. */
const ENTRY_MS = 800
/** Duration of the exit fade transition. */
const EXIT_MS = 150

/**
 * BoxLogoEntryScreen — branded cold-start splash with smooth exit fade.
 *
 * Warm Landing animation (deliberation consensus):
 * - Logo rises and settles (translateY + scale + opacity)
 * - Warm radial glow blooms behind it then fades
 * - Total visible time: ~950ms (800ms entrance + 150ms exit fade)
 * - Pure transform + opacity for Taro performance
 * - Reduced-motion: static fade-in only
 */
export default function BoxLogoEntryScreen({ onComplete }: BoxLogoEntryScreenProps) {
  const [phase, setPhase] = useState<Phase>('entering')

  // Trigger exit fade after entrance completes.
  useEffect(() => {
    const t = setTimeout(() => setPhase('exiting'), ENTRY_MS)
    return () => clearTimeout(t)
  }, [])

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
      <View className='box-logo-entry__stage'>
        {/* Warm glow behind the logo */}
        <View className='box-logo-entry__glow' />

        {/* Box logo */}
        <BrandLogo
          size='lg'
          className='box-logo-entry__logo'
        />
      </View>
    </View>
  )
}
