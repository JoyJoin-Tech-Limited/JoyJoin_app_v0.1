import { View, Text, Image } from '@tarojs/components'
import { memo, type ReactNode } from 'react'
import JoyJoinIcon from '../ui/JoyJoinIcon'
// Styles are owned by consuming page SCSS (@use) so the ticket rules co-compile
// into each surface's page WXSS — a component-level import would additionally
// hoist a duplicate copy into main-package common.wxss (subpackage
// style-splitting + main package 2048KB source-size budget). See
// scripts/verify-subpackage-styles.mjs and the TablemateCard precedent.

/** One 订座 ticket meta cell (地点 / 时间). `hint` renders only when the value
 *  is still 待定 (e.g. 「排桌完成后 24 小时内公布」). */
export interface ReservationTicketMetaCell {
  key: string
  label: string
  value: string
  hint?: string
  align?: 'left' | 'right'
}

/** Banner slot: hero image + scrim + type badge + title. All optional — a
 *  surface may render badge + title with no hero image (`--no-image` lays the
 *  badge/title out statically instead of over the image). */
export interface ReservationTicketBanner {
  imageSrc?: string
  /** Image-error hook so a surface can swap in a fallback asset (e.g. the
   *  payment success hero's webp→png degradation). */
  onImageError?: () => void
  badgeEmoji?: string
  badgeText?: string
  title?: string
}

export interface ReservationTicketProps {
  /** Omit entirely for banner-less surfaces (confirm modal, Phase 3). */
  banner?: ReservationTicketBanner
  meta?: ReservationTicketMetaCell[]
  /** Notched perforation divider between banner and body (default true). */
  showPerforation?: boolean
  /** Adds the `--entrance` rise-in class. Surfaces with their own reveal
   *  timeline (confirm modal card pop + row stagger) leave this false. */
  motionEnabled?: boolean
  /** `card` (default) renders the full ticket chrome (surface bg, radius,
   *  shadow, page margin). `flat` strips the chrome for embedding inside an
   *  already-carded surface (the confirm modal). */
  variant?: 'card' | 'flat'
  className?: string
  /** Body slot, rendered under the meta grid. */
  children?: ReactNode
  /** Footer slot, rendered after the body but still inside the card chrome
   *  (payment page: coupon stub + tail vignette/barcode). */
  footer?: ReactNode
}

/**
 * ReservationTicket — the shared physical 载体 of the 「订座」 ceremony
 * (Phase 3, 2026-08-17; spec: docs/design/registration-ceremony-spec-20260817.md).
 * One ticket follows the user: confirm modal → payment ticket → success seal
 * (Phase 4). Purely presentational: no data fetching, no analytics.
 */
function ReservationTicket({
  banner,
  meta,
  showPerforation = true,
  motionEnabled = false,
  variant = 'card',
  className,
  children,
  footer,
}: ReservationTicketProps) {
  const rootClass = [
    'reservation-ticket',
    variant === 'flat' ? 'reservation-ticket--flat' : '',
    motionEnabled ? 'reservation-ticket--entrance' : '',
    className ?? '',
  ]
    .filter(Boolean)
    .join(' ')

  const bannerImageSrc = banner?.imageSrc
  const hasBannerImage = Boolean(bannerImageSrc)

  return (
    <View className={rootClass}>
      {banner ? (
        <View
          className={`reservation-ticket__banner${hasBannerImage ? '' : ' reservation-ticket__banner--no-image'}`}
        >
          {bannerImageSrc ? (
            <Image
              className='reservation-ticket__banner-image'
              src={bannerImageSrc}
              mode='aspectFill'
              lazyLoad={false}
              aria-hidden='true'
              onError={banner?.onImageError}
            />
          ) : null}
          {bannerImageSrc ? <View className='reservation-ticket__banner-scrim' /> : null}
          {banner.badgeText ? (
            <View className='reservation-ticket__type-badge'>
              {banner.badgeEmoji ? (
                <View className='reservation-ticket__type-badge-icon'>
                  <JoyJoinIcon emoji={banner.badgeEmoji} tier='category' size={40} />
                </View>
              ) : null}
              <Text className='reservation-ticket__type-badge-text'>{banner.badgeText}</Text>
            </View>
          ) : null}
          {banner.title ? (
            <View className='reservation-ticket__banner-title-wrap'>
              <Text className='reservation-ticket__banner-title'>{banner.title}</Text>
            </View>
          ) : null}
        </View>
      ) : null}

      {showPerforation ? (
        <View className='reservation-ticket__perforation' aria-hidden='true'>
          <View className='reservation-ticket__notch reservation-ticket__notch--left' />
          <View className='reservation-ticket__dash-line' />
          <View className='reservation-ticket__notch reservation-ticket__notch--right' />
        </View>
      ) : null}

      <View className='reservation-ticket__body'>
        {meta && meta.length > 0 ? (
          <View className='reservation-ticket__meta-grid'>
            {meta.map((cell) => (
              <View
                key={cell.key}
                className={`reservation-ticket__meta-cell${cell.align === 'right' ? ' reservation-ticket__meta-cell--right' : ''}`}
              >
                <Text className='reservation-ticket__meta-label'>{cell.label}</Text>
                <Text className='reservation-ticket__meta-value'>{cell.value}</Text>
                {cell.hint ? (
                  <Text className='reservation-ticket__meta-hint'>{cell.hint}</Text>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}
        {children}
      </View>

      {footer}
    </View>
  )
}

export default memo(ReservationTicket)
