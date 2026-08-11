import type { ReactNode } from 'react'
import { useState } from 'react'
import { View, Text, Image } from '@tarojs/components'
import type { SocialIcebreakerPhase } from '@shared/socialIcebreaker'
import { PhaseHeaderIcon } from '../phaseUtils'
import { getPhaseFoilStyle, PHASE_ACCENTS } from '../phases/phaseAccents'
import { GlancePeek } from './GlancePeek'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import './PhaseHeroCard.scss'

/**
 * PhaseHeroCard (PR2/PR3 revamp) — one shared premium frame for every phase.
 *
 * Zone blueprint (updated 2026-07-19):
 *   A. header rail  — phase label + status chip
 *   B. hero zone    — ONE visual anchor (art band XOR 96rpx emblem) +
 *                     title (Alimama) + prompt + phase slot
 *   C. status zone  — ONE grammar: roster dots + one label line
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
  /** Contained art band URL (CDN webp). Renders only when provided. */
  artUrl?: string
  actions?: ReactNode
  children?: ReactNode
  className?: string
  /** S3 glance-stack pilot: L1/L2/L3 layout (default false = legacy 4-zone).
   *  Glance mode ignores `artUrl` (the L1 emblem is the one visual anchor)
   *  and demotes statusChip/statusText/dots behind a hold-to-peek L3.
   *  Pinned (spec §4.2): `actions` (ACT) and `children` (slot incl. the AIGC
   *  footer) render outside the peek, always. */
  glanceMode?: boolean
  /** Locked L2 framing fragment (spec §3.3) leading the reader-aloud script. */
  l2Framing?: string
}

export function PhaseHeroCard({
  phase,
  title,
  prompt,
  statusChip,
  statusText,
  doneCount,
  totalCount,
  artUrl,
  actions,
  children,
  className,
  glanceMode = false,
  l2Framing,
}: PhaseHeroCardProps) {
  const foil = getPhaseFoilStyle(phase)
  const accent = PHASE_ACCENTS[phase]
  const [artFailed, setArtFailed] = useState(false)
  const showDots =
    typeof doneCount === 'number' && typeof totalCount === 'number' && totalCount > 0

  // ── S3 glance stack (pilot): L1 signal / L2 script / L3 hold-to-peek ──
  if (glanceMode) {
    const hasL3 = !!statusChip || !!statusText || showDots
    const peekSummary = showDots ? `${doneCount}/${totalCount}` : ''
    return (
      <View
        className={`phase-hero-card phase-hero-card--glance phase-hero-card--deal-in${className ? ` ${className}` : ''}`}
        style={foil ? { borderColor: foil.borderColor, boxShadow: foil.boxShadow, background: foil.background } : undefined}
      >
        {/* L1 · Signal: the phase emblem at the sanctioned max display size —
            decodable from silhouette in one glance. The canonical label rides
            as a hairline caption (identity, not a fourth layer). */}
        <View className='phase-hero-card__l1'>
          <View
            className='phase-hero-card__l1-emblem'
            style={foil ? { background: foil.emblemBackground, borderColor: foil.borderColor } : undefined}
          >
            <PhaseHeaderIcon phase={phase} size={240} />
          </View>
          {accent?.label ? (
            <Text className='phase-hero-card__l1-label' style={{ color: foil?.accentDeep }}>
              {accent.label}
            </Text>
          ) : null}
        </View>

        {/* L2 · Script: quiet contrast, reader-facing — never required to act. */}
        <View className='phase-hero-card__l2'>
          {l2Framing ? <Text className='phase-hero-card__l2-framing'>{l2Framing}</Text> : null}
          <Text className='phase-hero-card__l2-title'>{title}</Text>
          {prompt ? <Text className='phase-hero-card__l2-prompt'>{prompt}</Text> : null}
        </View>

        {children ? <View className='phase-hero-card__slot'>{children}</View> : null}

        {/* ACT zone (pinned, ruling 1): exactly one obvious target per state. */}
        {actions ? <View className='phase-hero-card__actions'>{actions}</View> : null}

        {/* L3 · Context: counts/labels behind hold-to-peek (spec §4.1). */}
        {hasL3 ? (
          <GlancePeek className='phase-hero-card__l3' summary={peekSummary}>
            {statusChip ? <Text className='phase-hero-card__l3-chip'>{statusChip}</Text> : null}
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
            {statusText ? <Text className='phase-hero-card__l3-text'>{statusText}</Text> : null}
          </GlancePeek>
        ) : null}
      </View>
    )
  }

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

      {statusText || showDots ? <View className='phase-hero-card__divider' /> : null}

      {statusText || showDots ? (
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
        </View>
      ) : null}

      {actions ? <View className='phase-hero-card__actions'>{actions}</View> : null}
    </View>
  )
}
