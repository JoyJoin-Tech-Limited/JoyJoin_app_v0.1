import { View, Text, Image } from '@tarojs/components'
import { useState } from 'react'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'

/**
 * GuidanceTipCard — shared coachmark visual for the C4 guidance queue
 * (2026-08-27, contract C4).
 *
 * Visual extracted from the discover first-visit arrival coachmark pattern
 * (pages/discover): mascot + kicker + voiced title + explainer rows + inline
 * dismiss + bottom anchor arrow.
 *
 * Motion spec (locked): slide-up 16rpx enter, 300ms
 * cubic-bezier(0.22,1,0.36,1); 6s dwell owned by the queue hook; 200ms
 * fade + translateY(8rpx) exit via the `--exiting` modifier. Reduced-motion
 * tier renders the static card with the same dwell (`--rm` + media query).
 *
 * Subpackage WXSS rule: this component deliberately does NOT side-effect
 * import its SCSS — every consuming page SCSS must `@use`
 * 'components/guidance/GuidanceTipCard.scss' so the rules compile into the
 * page's own WXSS (see AGENTS §15 / verify-subpackage-styles gate).
 */

export interface GuidanceTipCardRow {
  eyebrow: string
  line: string
}

interface GuidanceTipCardProps {
  kicker: string
  title: string
  rows: readonly GuidanceTipCardRow[]
  dismissLabel: string
  mascotSrc: string
  onMascotError?: () => void
  /** True while the 200ms exit animation runs (persist already committed). */
  exiting: boolean
  ariaLabel: string
  /** 'auto' dismissal is owned by the queue hook's dwell timer. */
  onDismiss: (reason: 'button' | 'tap_through') => void
}

export default function GuidanceTipCard({
  kicker,
  title,
  rows,
  dismissLabel,
  mascotSrc,
  onMascotError,
  exiting,
  ariaLabel,
  onDismiss,
}: GuidanceTipCardProps) {
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  const rootClass = [
    'guidance-tip-card',
    exiting ? 'guidance-tip-card--exiting' : '',
    reduceMotion ? 'guidance-tip-card--rm' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View
      className={rootClass}
      onClick={() => onDismiss('tap_through')}
      hoverClass='guidance-tip-card--pressed'
      role='button'
      aria-label={ariaLabel}
    >
      <View className='guidance-tip-card__mascot' aria-hidden='true'>
        <Image
          className='guidance-tip-card__mascot-img'
          src={mascotSrc}
          mode='aspectFit'
          onError={onMascotError}
        />
      </View>
      <View className='guidance-tip-card__body'>
        <Text className='guidance-tip-card__kicker'>{kicker}</Text>
        <Text className='guidance-tip-card__title'>{title}</Text>
        {rows.map((row) => (
          <View className='guidance-tip-card__row' key={row.eyebrow}>
            <Text className='guidance-tip-card__eyebrow'>{row.eyebrow}</Text>
            <Text className='guidance-tip-card__line'>{row.line}</Text>
          </View>
        ))}
      </View>
      <Text
        className='guidance-tip-card__dismiss'
        onClick={(e) => {
          e.stopPropagation()
          onDismiss('button')
        }}
      >
        {dismissLabel}
      </Text>
      <View className='guidance-tip-card__anchor' aria-hidden='true' />
    </View>
  )
}
