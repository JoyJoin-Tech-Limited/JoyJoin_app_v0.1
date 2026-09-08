import { View, Text, Image } from '@tarojs/components'
import { useState } from 'react'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { haptics } from '../../lib/utils/haptics'
import { localAsset } from '../../lib/utils/cdnAssets'
import type { GuidanceTipRowKey } from '@shared/copy/guidanceCopy'

/**
 * GuidanceTipCard — shared coachmark visual for the C4 guidance queue
 * (2026-08-27, contract C4; vertical welcome-card redesign 2026-09-07).
 *
 * Anatomy (top → bottom): header row (56rpx mascot + kicker + × close
 * pinned right) → archetype-voiced title → two TAPPABLE play-mode rows
 * (icon slot + title/caption stack + CSS chevron). The card body itself is
 * INERT — dismissal only via the ×, a row tap, or the queue's 6s dwell.
 *
 * Row icons reuse the bundled `src/assets/icons/ui/` glyphs via direct
 * `localAsset()` Image (same pattern as the discover location pill) instead
 * of JoyJoinIcon: the icon registry routes the `ui` tier CDN-primary, and a
 * cold-start first visit — exactly when this card shows — could flash the
 * emoji fallback. Zero new bundled assets.
 *
 * Motion spec (locked): slide-up 16rpx enter, 300ms
 * cubic-bezier(0.22,1,0.36,1) + inner cascade (title +60ms, rows
 * +120/+180ms, transform/opacity only); 6s dwell owned by the queue
 * hook; 200ms fade + translateY(8rpx) exit via the `--exiting` modifier.
 * Reduced-motion tier renders the static card with the same dwell
 * (`--rm` + media query).
 *
 * Subpackage WXSS rule: this component deliberately does NOT side-effect
 * import its SCSS — every consuming page SCSS must `@use`
 * 'components/guidance/GuidanceTipCard.scss' so the rules compile into the
 * page's own WXSS (see AGENTS §15 / verify-subpackage-styles gate).
 */

/** Single source of truth lives in shared copy (`GuidanceTipRowKey`). */
export type GuidanceTipCardRowKey = GuidanceTipRowKey

export interface GuidanceTipCardRow {
  key: GuidanceTipCardRowKey
  title: string
  caption: string
  /** Optional bundled ui-glyph filename (no path/extension) overriding the
   *  per-key default icon; falls back to an 8rpx brand dot when neither the
   *  override nor the default resolves. */
  iconKey?: string
}

interface GuidanceTipCardProps {
  kicker: string
  title: string
  rows: readonly GuidanceTipCardRow[]
  mascotSrc: string
  onMascotError?: () => void
  /** True while the 200ms exit animation runs (persist already committed). */
  exiting: boolean
  ariaLabel: string
  /** 'auto' dismissal is owned by the queue hook's dwell timer. */
  onDismiss: (reason: 'button' | 'tap_through') => void
  /**
   * Row-tap routing. The card haptics + delegates; the page dismisses the
   * tip (reason 'tap_through') and runs the destination action. When
   * omitted, a row tap degrades to a plain tap-through dismiss.
   */
  onRowTap?: (key: GuidanceTipCardRowKey) => void
}

/** Default bundled ui glyphs per row key (device-reliable via localAsset). */
const ROW_ICON_ASSET: Record<GuidanceTipCardRowKey, string> = {
  event: '/assets/icons/ui/icon-people.webp',
  street: '/assets/icons/ui/icon-footprint.webp',
}

function resolveRowIcon(row: GuidanceTipCardRow): string | null {
  if (row.iconKey) return localAsset(`/assets/icons/ui/${row.iconKey}.webp`)
  const asset = ROW_ICON_ASSET[row.key]
  return asset ? localAsset(asset) : null
}

export default function GuidanceTipCard({
  kicker,
  title,
  rows,
  mascotSrc,
  onMascotError,
  exiting,
  ariaLabel,
  onDismiss,
  onRowTap,
}: GuidanceTipCardProps) {
  const [reduceMotion] = useState(() => getSystemReducedMotion())
  // Row-icon resilience: a glyph that fails to decode demotes that row to
  // the 8rpx brand dot instead of rendering a broken image.
  const [failedRowIcons, setFailedRowIcons] = useState<readonly string[]>([])
  const rootClass = [
    'guidance-tip-card',
    exiting ? 'guidance-tip-card--exiting' : '',
    reduceMotion ? 'guidance-tip-card--rm' : '',
  ]
    .filter(Boolean)
    .join(' ')

  return (
    <View className={rootClass} role='note' aria-label={ariaLabel}>
      <View className='guidance-tip-card__header'>
        <View className='guidance-tip-card__mascot' aria-hidden='true'>
          <Image
            className='guidance-tip-card__mascot-img'
            src={mascotSrc}
            mode='aspectFit'
            onError={onMascotError}
          />
        </View>
        <Text className='guidance-tip-card__kicker'>{kicker}</Text>
        <View
          className='guidance-tip-card__close'
          hoverClass='guidance-tip-card__close--hover'
          role='button'
          aria-label='收起提示'
          onClick={(e) => {
            e.stopPropagation()
            if (exiting) return
            haptics('light')
            onDismiss('button')
          }}
        >
          <View className='guidance-tip-card__close-glyph' aria-hidden='true' />
        </View>
      </View>
      <Text className='guidance-tip-card__title'>{title}</Text>
      <View className='guidance-tip-card__rows'>
        {rows.map((row, index) => {
          const iconSrc = failedRowIcons.includes(row.key)
            ? null
            : resolveRowIcon(row)
          const staggerClass =
            index === 1
              ? ' guidance-tip-card__row--stagger-2'
              : index >= 2
                ? ' guidance-tip-card__row--stagger-3'
                : ''
          return (
            <View
              className={`guidance-tip-card__row${staggerClass}`}
              key={row.key}
              hoverClass='guidance-tip-card__row--pressed'
              role='button'
              aria-label={`${row.title}。${row.caption}。点击进入`}
              onClick={(e) => {
                e.stopPropagation()
                if (exiting) return
                haptics('light')
                if (onRowTap) {
                  onRowTap(row.key)
                } else {
                  onDismiss('tap_through')
                }
              }}
            >
              <View className='guidance-tip-card__row-icon' aria-hidden='true'>
                {iconSrc ? (
                  <Image
                    className='guidance-tip-card__row-icon-img'
                    src={iconSrc}
                    mode='aspectFit'
                    lazyLoad={false}
                    onError={() =>
                      setFailedRowIcons((prev) =>
                        prev.includes(row.key) ? prev : [...prev, row.key]
                      )
                    }
                  />
                ) : (
                  <View className='guidance-tip-card__row-dot' />
                )}
              </View>
              <View className='guidance-tip-card__row-text'>
                <Text className='guidance-tip-card__row-title'>{row.title}</Text>
                <Text className='guidance-tip-card__row-caption'>{row.caption}</Text>
              </View>
              <View className='guidance-tip-card__row-chevron' aria-hidden='true' />
            </View>
          )
        })}
      </View>
    </View>
  )
}
