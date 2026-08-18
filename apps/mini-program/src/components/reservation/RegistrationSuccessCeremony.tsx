import { memo, useEffect, useRef, useState } from 'react'
import { View, Text } from '@tarojs/components'
import type { ReactNode } from 'react'
import Button from '../ui/Button'
import ReservationTicket, {
  type ReservationTicketBanner,
  type ReservationTicketMetaCell,
} from './ReservationTicket'
import { socialHaptics } from '../../lib/utils/haptics'
// Styles are owned by consuming page SCSS (@use) so the ceremony rules
// co-compile into each surface's page WXSS — same subpackage style-splitting
// pattern as ReservationTicket (see scripts/verify-subpackage-styles.mjs).

// Motion timeline (spec docs/design/registration-ceremony-spec-20260817.md §3):
// the seal is the one focal animation — it stamps 0.92 → 1.04 → 1.0 over
// ~320ms after a short settle delay, and the celebration haptic fires on the
// visual beat (seal landing), not on the network response.
export const CEREMONY_SEAL_DELAY_MS = 240
export const CEREMONY_SEAL_DURATION_MS = 320
/** ms after mount at which the seal visually lands (and the haptic fires).
 *  The keyframe overshoots to scale(1.04) at 60% (~432ms), which is the visual
 *  "stamp" beat; the celebration haptic should land there, not after the
 *  animation settles at 560ms. */
export const CEREMONY_SEAL_LAND_MS = CEREMONY_SEAL_DELAY_MS + CEREMONY_SEAL_DURATION_MS * 0.6
// The paid-variant 票根 tears off once the seal has landed (~450ms, spec §3).
const STUB_TEAR_DELAY_MS = CEREMONY_SEAL_LAND_MS + 160

export interface RegistrationSuccessCeremonyProps {
  /** Ceremony headline above the ticket (已加入这场${eventType} / 双人成行已就位). */
  title: string
  /** Ticket banner: type badge + pool title + optional hero image.
   *  The seal is absolutely positioned at `top: 280rpx` to straddle the
   *  perforation, which assumes a 320rpx hero banner. Keep this in sync if the
   *  banner height ever changes. */
  banner: ReservationTicketBanner
  /** Optional fallback hero asset (payment: webp→png runtime degradation). */
  bannerImageFallbackSrc?: string
  /** 地点/时间 meta cells — the ticket now carries the event summary. */
  meta: ReservationTicketMetaCell[]
  /** Real seat ordinal from registrationCount/currentParticipants (🔴 real
   *  data only, spec §5). The 「你是第 N 位入座的人」 line hides when missing/0. */
  seatOrdinal?: number
  /** `paid` tears the 票根 stub off along the perforation; `standard` skips it.
   *  The seal + celebration haptic fire for BOTH variants. */
  variant?: 'standard' | 'paid'
  /** Degradation ladder (spec §4): false → static seal, no tear-off, haptic
   *  still fires (immediately, since there is no seal animation to sync to). */
  motionEnabled: boolean
  onCtaClick: () => void
  ctaDisabled?: boolean
  ctaLabel?: string
  className?: string
  /** Surface extras between the ticket and the CTA (notify block, pills,
   *  payment subtitle). */
  children?: ReactNode
  /** Content below the ceremony CTA (pool-registration: ChemistryMiniGrid). */
  after?: ReactNode
}

/**
 * RegistrationSuccessCeremony — the unified 「订座」 success climax
 * (Phase 4, 2026-08-17; spec: docs/design/registration-ceremony-spec-20260817.md).
 * One ticket, one 「已留座」 seal, one celebration haptic; the paid variant adds
 * the 票根 tear-off. Replaces the divergent PoolRegistrationSuccess /
 * TicketSuccessView surfaces. Presentational + seal/haptic timing only: data
 * fetching, analytics, and navigation stay in the consuming pages.
 */
function RegistrationSuccessCeremony({
  title,
  banner,
  bannerImageFallbackSrc,
  meta,
  seatOrdinal,
  variant = 'standard',
  motionEnabled,
  onCtaClick,
  ctaDisabled = false,
  ctaLabel = '查看我的局',
  className,
  children,
  after,
}: RegistrationSuccessCeremonyProps) {
  const [bannerImageFailed, setBannerImageFailed] = useState(false)
  const celebrationFiredRef = useRef(false)

  // Celebration haptic — one-shot per ceremony mount (spec §2: celebration is
  // rare by design; never a second one). Timed to the seal's visual landing;
  // with motion degraded the seal is static so the haptic fires immediately.
  useEffect(() => {
    if (celebrationFiredRef.current) return
    celebrationFiredRef.current = true
    if (!motionEnabled) {
      socialHaptics('socialCelebration')
      return
    }
    const timer = setTimeout(() => {
      socialHaptics('socialCelebration')
    }, CEREMONY_SEAL_LAND_MS)
    return () => clearTimeout(timer)
  }, [motionEnabled])

  const resolvedBanner: ReservationTicketBanner =
    bannerImageFailed && bannerImageFallbackSrc
      ? { ...banner, imageSrc: bannerImageFallbackSrc }
      : banner

  const showSeatLine = typeof seatOrdinal === 'number' && seatOrdinal > 0

  // 票根 stub — paid variant only, and only when motion is enabled (spec §3
  // fallback: the stub is simply absent under reduced motion / degradation).
  const stub =
    variant === 'paid' && motionEnabled ? (
      <View
        className='registration-ceremony__stub'
        style={{ animationDelay: `${STUB_TEAR_DELAY_MS}ms` }}
        aria-hidden='true'
      >
        <Text className='registration-ceremony__stub-label'>票根</Text>
        <View className='registration-ceremony__stub-barcode'>
          {Array.from({ length: 18 }).map((_, i) => (
            <View
              key={i}
              className='registration-ceremony__stub-barcode-line'
              style={{ width: `${2 + (i % 3) * 2}rpx` }}
            />
          ))}
        </View>
      </View>
    ) : undefined

  return (
    <View
      className={`registration-ceremony${className ? ` ${className}` : ''}`}
      role='status'
      aria-live='polite'
    >
      <Text className='registration-ceremony__title'>{title}</Text>

      <View className='registration-ceremony__ticket-wrap'>
        <ReservationTicket
          variant='card'
          banner={{
            ...resolvedBanner,
            onImageError: bannerImageFallbackSrc
              ? () => setBannerImageFailed(true)
              : resolvedBanner.onImageError,
          }}
          meta={meta}
          // No ticket entrance here: the seal is the one focal animation on
          // this screen (spec §3 motion principles).
          motionEnabled={false}
          footer={stub}
        >
          {showSeatLine ? (
            <Text className='registration-ceremony__seat-line'>
              你是第 {seatOrdinal} 位入座的人
            </Text>
          ) : null}
        </ReservationTicket>

        <View
          className={`registration-ceremony__seal${
            motionEnabled ? ' registration-ceremony__seal--stamp' : ''
          }`}
        >
          <Text className='registration-ceremony__seal-text'>已留座</Text>
        </View>
      </View>

      {children ? <View className='registration-ceremony__extras'>{children}</View> : null}

      <Button
        variant='primary'
        className='registration-ceremony__cta'
        disabled={ctaDisabled}
        onClick={onCtaClick}
      >
        {ctaLabel}
      </Button>

      {after ? <View className='registration-ceremony__after'>{after}</View> : null}
    </View>
  )
}

export default memo(RegistrationSuccessCeremony)
