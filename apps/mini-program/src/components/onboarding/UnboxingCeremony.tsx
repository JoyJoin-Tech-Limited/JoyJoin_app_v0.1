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
 * Timing: auto-advances after AUTO_ADVANCE_MS, or on tap once TAP_GUARD_MS
 * has elapsed (taps inside the guard window are ignored so an accidental
 * touch can't skip the reveal; the 轻触继续 hint fades in at the guard
 * boundary). The parent owns what happens next (routing).
 *
 * Subpackage WXSS trap (AGENTS §15): consuming pages MUST also @use
 * UnboxingCeremony.scss in their own page SCSS.
 */

const AUTO_ADVANCE_MS = 3200

/**
 * Taps inside this window are ignored — the lid lift and card rise are still
 * settling and an accidental tap must not skip the reveal. The 轻触继续 hint
 * fades in exactly at this moment so the affordance never lies about the
 * guard window.
 *
 * Analytics note (2026-08-18): onAdvance('auto'|'tap') distribution will
 * shift vs the pre-retune baseline (4000ms, no guard). Dashboards comparing
 * ceremony completion modes across releases must use a 2026-08-18 boundary.
 * Rollback of the pacing = revert this constant + TAP_GUARD_MS only.
 */
const TAP_GUARD_MS = 2400

/**
 * Local copy of WelcomeGiftCard's discount formatter. Deliberately NOT
 * imported from WelcomeGiftCard.tsx: that module side-effect-imports
 * WelcomeGiftCard.scss, and pulling it in here would drag the gift-card WXSS
 * back into the onboarding subpackage chunk graph (sub-common.wxss trap).
 */
function formatGiftDiscount(discountValue: number): { value: string; unit: string } {
  if (discountValue > 0 && discountValue <= 100) {
    const zhe = Math.round((100 - discountValue) / 10)
    if (zhe >= 1 && zhe <= 9) {
      return { value: `${zhe}`, unit: '折' }
    }
  }
  return { value: `${discountValue}`, unit: '%' }
}

interface UnboxingCeremonyProps {
  visible: boolean
  displayName: string
  archetypeName?: string
  accentText?: string
  /**
   * 拆盒即得礼: the welcome coupon folds into the rising entry card. When
   * omitted (claim failed), the card simply renders without the gift row —
   * the ceremony never blocks on the coupon network call.
   */
  giftDiscountValue?: number | null
  /** True while the welcome-coupon claim is still in flight. */
  giftLoading?: boolean
  /**
   * Analytics-only hook: fired once per ceremony with how the advance
   * happened — 'auto' (AUTO_ADVANCE_MS elapsed) or 'tap' (user-paced).
   */
  onAdvance?: (mode: 'auto' | 'tap') => void
  onComplete: () => void
}

export default function UnboxingCeremony({
  visible,
  displayName,
  archetypeName,
  accentText,
  giftDiscountValue = null,
  giftLoading = false,
  onAdvance,
  onComplete,
}: UnboxingCeremonyProps) {
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  const { isDegradation } = useDeviceTier()
  const completedRef = useRef(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const hintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  // When the ceremony became visible — the tap-guard measures from here.
  const visibleAtRef = useRef(0)
  const [hintVisible, setHintVisible] = useState(false)
  // Hold the callback in a ref: parents pass inline arrows (new identity per
  // render), and re-subscribing the auto-advance timer on every parent
  // render would push the 4s advance out indefinitely and re-arm the
  // one-shot guard.
  const onCompleteRef = useRef(onComplete)
  onCompleteRef.current = onComplete
  const onAdvanceRef = useRef(onAdvance)
  onAdvanceRef.current = onAdvance

  const finish = useCallback((mode: 'auto' | 'tap') => {
    if (completedRef.current) return
    completedRef.current = true
    onAdvanceRef.current?.(mode)
    onCompleteRef.current()
  }, [])

  useEffect(() => {
    if (!visible) return undefined
    completedRef.current = false
    visibleAtRef.current = Date.now()
    // RM shows the hint statically; motion mode reveals it at the guard
    // boundary so the affordance never promises an earlier tap.
    setHintVisible(reduceMotion)
    timerRef.current = setTimeout(() => finish('auto'), AUTO_ADVANCE_MS)
    if (!reduceMotion) {
      hintTimerRef.current = setTimeout(() => setHintVisible(true), TAP_GUARD_MS)
    }
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current)
        timerRef.current = null
      }
      if (hintTimerRef.current) {
        clearTimeout(hintTimerRef.current)
        hintTimerRef.current = null
      }
    }
  }, [visible, finish, reduceMotion])

  if (!visible) return null

  const giftDiscount = giftDiscountValue != null ? formatGiftDiscount(giftDiscountValue) : null

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
        if (Date.now() - visibleAtRef.current < TAP_GUARD_MS) return
        haptics('light')
        finish('tap')
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
        {giftDiscount ? (
          <View className='unboxing-ceremony__gift'>
            <Text className='unboxing-ceremony__gift-eyebrow'>拆盒即得礼</Text>
            <Text className='unboxing-ceremony__gift-text'>
              悦仔见面礼 · <Text className='unboxing-ceremony__gift-discount'>{giftDiscount.value}{giftDiscount.unit}</Text>券，报名可用
            </Text>
          </View>
        ) : giftLoading ? (
          <View className='unboxing-ceremony__gift unboxing-ceremony__gift--loading' aria-hidden='true'>
            <View className='unboxing-ceremony__gift-shimmer' />
          </View>
        ) : null}
      </View>

      <Text className={hintVisible ? 'unboxing-ceremony__hint unboxing-ceremony__hint--visible' : 'unboxing-ceremony__hint'}>轻触继续，去看为你准备的局</Text>
    </View>
  )
}
