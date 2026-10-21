import { Image, Text, View } from '@tarojs/components'
import React from 'react'
import { cdnAsset } from '../../lib/utils/cdnAssets'
import { formatDateTimeParts } from '../../lib/matching/groupDisplay'
import type { GuestEventPreviewItem } from '@shared/api'
import type { GuestPreviewCardVariant } from '../../lib/analytics/discoverAnalytics'

/**
 * GuestEventPreviewCard — 转化 P1c (2026-10-20).
 *
 * Read-only guest-facing event card extracted from OracleCard's L1 hero /
 * L3 decision-facts / L4 title shell. Deliberately NOT OracleCard itself:
 * no corner registration badge, no count-up, no high-chemistry badge, no
 * discover analytics keys, no personalised narrative — every one of those is
 * coupled to logged-in Discover context.
 *
 * Subpackage discipline: NO TSX-side SCSS import — this file's styles are
 * @use'd by pages/onboarding/personality-test/results/index.scss
 * (see verify-subpackage-styles.mjs).
 */

/** Event-type hero vignette — reuses existing CDN manifest entries
 *  (pool-registration ceremony heroes); zero new assets. */
const GUEST_PREVIEW_HERO_ASSETS: Record<string, string> = {
  '饭局': '/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp',
  '酒局': '/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp',
  dinner: '/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp',
  dining: '/assets/ceremony/lovart-pool-registration-hero-dining-20260702-v2.webp',
  drinks: '/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp',
  bar: '/assets/ceremony/lovart-pool-registration-hero-drinks-20260702-v2.webp',
}

/** Mirrors OracleCard's EVENT_TYPE_LABELS (machine id ↔ display label). */
const GUEST_PREVIEW_EVENT_TYPE_LABELS: Record<string, string> = {
  '饭局': '饭局', '酒局': '酒局', '其他': '其他',
  dinner: '饭局', dining: '饭局', drinks: '酒局', bar: '酒局', other: '其他',
}

/** Stagger gap between card entrances (design §5.3.5 — locked). */
export const GUEST_PREVIEW_CARD_STAGGER_MS = 90

export type GuestEventPreviewMotionPhase = 'pre' | 'entered' | 'static'

/** CDN vignette path for an event type; undefined = cream fallback variant. */
export function getGuestPreviewHeroAsset(eventType?: string): string | undefined {
  if (!eventType) return undefined
  const path = GUEST_PREVIEW_HERO_ASSETS[eventType]
  return path ? cdnAsset(path) : undefined
}

/** Impression-metadata variant for the section's aggregate event. */
export function getGuestPreviewCardVariant(eventType?: string): GuestPreviewCardVariant {
  return GUEST_PREVIEW_HERO_ASSETS[eventType ?? ''] ? 'vignette' : 'fallback'
}

export function getGuestPreviewEventTypeLabel(eventType?: string): string {
  if (!eventType) return '其他'
  return GUEST_PREVIEW_EVENT_TYPE_LABELS[eventType] ?? '其他'
}

interface GuestEventPreviewCardProps {
  item: GuestEventPreviewItem
  index: number
  motionPhase: GuestEventPreviewMotionPhase
  onTap: () => void
}

export default React.memo(function GuestEventPreviewCard({
  item,
  index,
  motionPhase,
  onTap,
}: GuestEventPreviewCardProps) {
  const [heroImageFailed, setHeroImageFailed] = React.useState(false)
  const [heroImageLoaded, setHeroImageLoaded] = React.useState(false)
  const heroAsset = getGuestPreviewHeroAsset(item.eventType)
  const showVignette = Boolean(heroAsset) && !heroImageFailed

  const { date: dateLabel, time: timeLabel } = formatDateTimeParts(item.dateTime)
  const eventTypeLabel = getGuestPreviewEventTypeLabel(item.eventType)
  const titleLabel = (item.title ?? '').trim()
  const districtLabel = (item.district ?? '').trim()

  // Four guest facts: 什么时候 / 在哪 / 什么局 / 还剩几座 (live query, quiet
  // fact — never urgency-flavored per the factual-not-scarcity principle).
  const metaParts = [
    eventTypeLabel,
    districtLabel,
  ].filter(Boolean).join(' · ')
  const seatsLabel = `还剩 ${item.spotsLeft} 座`

  // Entrance delay applies to the card AND its Ken Burns settle (same frame).
  const entranceDelay =
    motionPhase === 'entered' ? { animationDelay: `${index * GUEST_PREVIEW_CARD_STAGGER_MS}ms` } : undefined

  const cardClass = [
    'guest-event-card',
    motionPhase === 'pre' ? 'guest-event-card--pre' : '',
    motionPhase === 'entered' ? 'guest-event-card--entered' : '',
  ].filter(Boolean).join(' ')

  const cardAriaLabel = [
    dateLabel,
    timeLabel,
    eventTypeLabel,
    districtLabel,
    seatsLabel,
    titleLabel,
    '点击微信登录后查看',
  ].filter(Boolean).join('，')

  return (
    <View
      className={cardClass}
      style={entranceDelay}
      hoverClass='guest-event-card--hover'
      role='button'
      aria-label={cardAriaLabel}
      onClick={onTap}
    >
      <View className='guest-event-card__hero'>
        {showVignette && heroAsset ? (
          <View
            className={`guest-event-card__hero-media ${motionPhase === 'entered' ? 'guest-event-card__hero-media--entered' : ''}`}
            style={entranceDelay}
            aria-hidden='true'
          >
            {/* Loading placeholder: GPU-safe opacity shimmer (repo pattern);
                flat cream under reduced-motion via the page-level class. */}
            {!heroImageLoaded && (
              <View className='guest-event-card__hero-shimmer' aria-hidden='true' />
            )}
            <Image
              className='guest-event-card__hero-img'
              src={heroAsset}
              mode='aspectFill'
              onLoad={() => setHeroImageLoaded(true)}
              onError={() => setHeroImageFailed(true)}
            />
          </View>
        ) : (
          <View className='guest-event-card__hero-fallback' aria-hidden='true' />
        )}
        {/* Brand cream scrim — copy never sits on raw art; the fallback
            variant reads identical so text always lands on cream. */}
        <View className='guest-event-card__hero-scrim' aria-hidden='true' />
        {titleLabel ? (
          <Text className='guest-event-card__title' numberOfLines={1}>
            {titleLabel}
          </Text>
        ) : null}
      </View>

      <View className='guest-event-card__facts'>
        <Text className='guest-event-card__fact-line'>
          {dateLabel}{timeLabel ? ` · ${timeLabel}` : ''}{metaParts ? ` · ${metaParts}` : ''}
        </Text>
        <Text className='guest-event-card__fact-line guest-event-card__fact-seats'>
          {seatsLabel}
        </Text>
      </View>
    </View>
  )
})
