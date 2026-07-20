import type { ReactNode } from 'react'
import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'
import { PhaseHeaderIcon } from '../phaseUtils'
import { getPhaseFoilStyle, PHASE_ACCENTS } from '../phases/phaseAccents'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import './PhaseHeroCard.scss'

/**
 * PhaseHeroCard (PR2/PR3 revamp) — one shared premium frame for every phase.
 *
 * Zone blueprint (updated 2026-07-19):
 *   A. header rail  — phase label + status chip
 *   B. hero zone    — ONE visual anchor (art band XOR 96rpx emblem) +
 *                     title (Alimama) + prompt + phase slot
 *   C. status zone  — ONE grammar: roster dots + one label line + countdown
 *   D. action zone  — solid CTA + ghost link (margin-top: auto)
 *
 * Quiet warm surface + per-phase foil frame; art is a contained band
 * (≤40% height, widthFix), never behind text. Foil colors ride inline from
 * `phases/phaseAccents.ts` (WeChat drops hsla(); rgba only).
 */

export interface PhaseHeroCardProps {
  phase: SocialIcebreakerPhase
  title: ReactNode
  prompt?: ReactNode
  /** Header-rail right chip (e.g. 「第 2 位玩家」). */
  statusChip?: string
  /** ONE status line (absorbs the legacy helper-text captions). */
  statusText?: string
  /** Roster dots numerator/denominator. Omit both to hide dots. */
  doneCount?: number
  totalCount?: number
  /** Mono countdown text (e.g. 剩余 2:30). */
  countdownText?: string
  countdownUrgent?: boolean
  /** Contained art band URL (CDN webp). Renders only when provided. */
  artUrl?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
}

export function PhaseHeroCard({
  phase,
  title,
  prompt,
  statusChip,
  statusText,
  doneCount,
  totalCount,
  countdownText,
  countdownUrgent,
  artUrl,
  actions,
  children,
  className,
}: PhaseHeroCardProps) {
  const foil = getPhaseFoilStyle(phase)
  const accent = PHASE_ACCENTS[phase]
  const [artFailed, setArtFailed] = useState(false)
  const showDots =
    typeof doneCount === 'number' && typeof totalCount === 'number' && totalCount > 0

  return (
    <View
      className={`phase-hero-card phase-hero-card--deal-in${className ? ` ${className}` : ''}`}
      style={foil ? { borderColor: foil.borderColor, boxShadow: foil.boxShadow, background: foil.background } : undefined}
    >
      <View className='phase-hero-card__header-rail'>
        <Text
          className='phase-hero-card__phase-label'
          style={foil ? { color: foil.accentDeep } : undefined}
        >
          {accent?.label ?? ''}
        </Text>
        {statusChip ? <Text className='phase-hero-card__status-chip'>{statusChip}</Text> : null}
      </View>

      <View className='phase-hero-card__hero'>
        {/* One visual anchor: the Lovart art band when available, otherwise
            the 96rpx accent-halo emblem. Never both. The art band reserves
            its aspect box (no layout shift) and falls back to the emblem on
            load failure (never a dead anchor). */}
        {artUrl && !artFailed ? (
          <Image
            className='phase-hero-card__art'
            src={artUrl}
            mode='aspectFill'
            onError={() => {
              setArtFailed(true)
              socialIcebreakerAnalytics.track('icebreaker_band_image_error', undefined, undefined, phase, {
                artUrl,
              })
            }}
          />
        ) : (
          <View
            className='phase-hero-card__emblem phase-hero-card__complete-badge'
            style={foil ? { background: foil.emblemBackground, borderColor: foil.borderColor, boxShadow: foil.boxShadow } : undefined}
          >
            <PhaseHeaderIcon phase={phase} size={72} />
          </View>
        )}
        <Text className='phase-hero-card__title'>{title}</Text>
        {prompt ? <Text className='phase-hero-card__prompt'>{prompt}</Text> : null}
        {children ? <View className='phase-hero-card__slot'>{children}</View> : null}
      </View>

      {statusText || showDots || countdownText ? <View className='phase-hero-card__divider' /> : null}

      {statusText || showDots || countdownText ? (
        <View className='phase-hero-card__status' role='status' aria-live='polite'>
          {showDots ? (
            <View className='phase-hero-card__status-dots' aria-hidden='true'>
              {Array.from({ length: totalCount }).map((_, index) => (
                <View
                  key={index}
                  className={`phase-hero-card__status-dot${index < (doneCount ?? 0) ? ' phase-hero-card__status-dot--done' : ''}`}
                  style={index < (doneCount ?? 0) && foil ? { color: foil.accentDeep } : undefined}
                />
              ))}
            </View>
          ) : null}
          {statusText ? <Text className='phase-hero-card__status-text'>{statusText}</Text> : null}
          {countdownText ? (
            <Text
              className={`phase-hero-card__status-countdown${countdownUrgent ? ' phase-hero-card__status-countdown--urgent' : ''}`}
              style={countdownUrgent && foil ? { color: foil.accentDeep } : undefined}
              aria-hidden='true'
            >
              {countdownText}
            </Text>
          ) : null}
        </View>
      ) : null}

      {actions ? <View className='phase-hero-card__actions'>{actions}</View> : null}
    </View>
  )
}
