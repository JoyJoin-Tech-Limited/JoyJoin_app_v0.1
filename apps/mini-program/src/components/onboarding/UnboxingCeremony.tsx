import { View, Text, Image } from '@tarojs/components'
import { useCallback, useEffect, useRef, useState } from 'react'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { haptics } from '../../lib/utils/haptics'
import {
  BLIND_BOX_BODY_ASSET,
  BLIND_BOX_INTERIOR_ASSET,
  BLIND_BOX_LID_ASSET,
  BLIND_BOX_ALT,
} from '../../lib/mascot/blindBoxAssets'
import './UnboxingCeremony.scss'

/**
 * UnboxingCeremony — the onboarding completion payoff (Phase 3, Bet 2):
 * the "second box opening". After profile-review's 入场卡 is confirmed,
 * a sealed box (the same layered Lovart art as squad-unboxing) lifts its
 * lid and the user's compact entry card rises out — the physical-world
 * counterpart of the archetype-card reveal.
 *
 * Timing: auto-advances after AUTO_ADVANCE_MS or immediately on tap
 * (user-paced). The parent owns what happens next (routing).
 *
 * Subpackage WXSS trap (AGENTS §15): consuming pages MUST also @use
 * UnboxingCeremony.scss in their own page SCSS.
 */

const AUTO_ADVANCE_MS = 2400

interface UnboxingCeremonyProps {
  visible: boolean
  displayName: string
  archetypeName?: string
  accentText?: string
  onComplete: () => void
}

export default function UnboxingCeremony({
  visible,
  displayName,
  archetypeName,
  accentText,
  onComplete,
}: UnboxingCeremonyProps) {
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  const { isDegradation } = useDeviceTier()
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // Hold the callback in a ref: parents pass inline arrows (new identity per
  // render), and re-subscribing the auto-advance timer on every parent
  // render would push the 2.4s advance out indefinitely and re-arm the
  // one-shot guard.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete

  const finish = useCallback(() => {
    if (completedRef.current) return
    completedRef.current = true
    onCompleteRef.current()
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    completedRef.current = false
    timerRef.current = setTimeout(finish, AUTO_ADVANCE_MS)
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
    }
  }, [visible, finish])

  if (!visible) return null

  const rootClass = [
    'unboxing-ceremony',
    reduceMotion ? 'unboxing-ceremony--rm' : '',
    isDegradation ? 'unboxing-ceremony--low-end' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View
      className={rootClass}
      onClick={() => {
        haptics('light')
        finish()
      }}
      role='button'
      aria-label='开盒完成，轻触继续'
    >
      <View className='unboxing-ceremony__halo' aria-hidden='true' />

      <View className='unboxing-ceremony__stage' aria-hidden='true'>
        <Image
          className='unboxing-ceremony__interior'
          src={BLIND_BOX_INTERIOR_ASSET}
          mode='aspectFit'
          lazyLoad={false}
        />
        <Image
          className='unboxing-ceremony__body'
          src={BLIND_BOX_BODY_ASSET}
          mode='aspectFit'
          lazyLoad={false}
          ariaLabel={BLIND_BOX_ALT.body}
        />
        <Image
          className='unboxing-ceremony__lid'
          src={BLIND_BOX_LID_ASSET}
          mode='aspectFit'
          lazyLoad={false}
          ariaLabel={BLIND_BOX_ALT.lid}
        />
      </View>

      <View className='unboxing-ceremony__card'>
        <Text className='unboxing-ceremony__eyebrow'>开盒完成</Text>
        {/* The payoff is the archetype — it gets the display slot; the
            display name demotes to the sub-line (2026-08-01 design audit:
            the card previously headlined the user's name and demoted the
            identity they just earned). */}
        {archetypeName ? (
          <Text
            className='unboxing-ceremony__archetype'
            style={accentText ? { color: accentText } : undefined}
          >
            {archetypeName}
          </Text>
        ) : null}
        <Text className='unboxing-ceremony__name'>
          {displayName} · 入场卡已生效
        </Text>
      </View>

      <Text className='unboxing-ceremony__hint'>轻触继续，去看为你准备的局</Text>
    </View>
  )
}
