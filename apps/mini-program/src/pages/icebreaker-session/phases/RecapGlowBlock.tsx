/**
 * RecapGlowBlock — 「今晚的高光」 recap block (Wave 4 高光值,
 * sprint wave4-sessionGlow, locked contract AC-12/AC-13/AC-15, spec D3/D4).
 *
 * Renders ONLY when the session snapshot carried `recapSnapshot.glow`
 * (sessionGlowEnabled ON). Flag-off sessions render the legacy medal grid in
 * RecapPhaseView byte-identical — this component never mounts there.
 *
 * Structure (spec D3):
 *   table-level title + server-derived tableLine
 *   → per-person cards in ROSTER order (never glow order), self-outlined,
 *     tier word per card, that person's medals embedded in their card
 *   → the viewer's own per-source breakdown, collapsed by default
 *     (self card only; labels stand alone — numbers never on screen, AC-17)
 *
 * Rhythm (AC-13): stagger fade-in per card; prefers-reduced-motion renders
 * every card statically. One-shot `socialCelebration` haptic on block
 * entrance ONLY (gated by icebreakerHapticGrammarEnabled); zero per-card
 * haptics. No countdown, no auto-advance of the session phase.
 *
 * Styles are @use'd by the page SCSS (index.scss) — sub-common.wxss canon.
 */

import { Text, View } from '@tarojs/components'
import { useEffect, useMemo, useRef, useState } from 'react'
import type { GlowPointBreakdown } from '@shared/socialIcebreaker'
import {
  GLOW_BLOCK_TITLE,
  GLOW_DETAIL_COLLAPSE_LABEL,
  GLOW_DETAIL_EXPAND_LABEL,
  GLOW_EMPTY_STATE_LINE,
  GLOW_FLOOR_TIER_LINE,
} from '@shared/copy/sessionGlow'
import JoyJoinIcon from '../../../components/ui/JoyJoinIcon'
import Card from '../../../components/ui/Card'
import { useMiniRevealMotion } from '../../../hooks/useMiniRevealMotion'
import { haptics, socialHaptics } from '../../../lib/utils/haptics'
import { socialIcebreakerAnalytics } from '../../../lib/analytics/socialIcebreakerAnalytics'
import { PhaseHeaderIcon } from '../phaseUtils'
import {
  buildGlowCards,
  isFloorOnlyTable,
  resolveGlowCardRevealDelayMs,
  resolveGlowMedalSource,
  type GlowRosterEntry,
  type SessionGlowSnapshot,
} from '../viewModels/sessionGlowModel'

/** Self-card badge glyph. Single-glyph affordance label; hoisting to
 *  @shared/copy/sessionGlow deferred to the AC-11(a) 🔴 copy review. */
const GLOW_SELF_BADGE = '你'

/**
 * Medal emblem renderer — shared by this block and the legacy medal grid
 * (RecapPhaseView imports it from here). The Wave 4 data medals map to their
 * phase emblems; flag-off sessions never produce those titles, so the legacy
 * grid renders byte-identical.
 */
export function MedalIcon({ title, emoji }: { title: string; emoji: string }) {
  switch (title) {
    case '最佳侦探':
      return <PhaseHeaderIcon phase='lie_detective' size={48} />
    case '挑战先锋':
      return <PhaseHeaderIcon phase='micro_challenge' size={48} />
    case '话题王':
      return <PhaseHeaderIcon phase='warmup' size={48} />
    case '接梗王':
      return <PhaseHeaderIcon phase='quip_battle' size={48} />
    case '暖心雷达':
      return <PhaseHeaderIcon phase='group_mirror' size={48} />
    case '豪气担当':
      return <PhaseHeaderIcon phase='auction' size={48} />
    default:
      return <JoyJoinIcon emoji={emoji} size={48} />
  }
}

interface RecapGlowBlockProps {
  glow: SessionGlowSnapshot
  roster: ReadonlyArray<GlowRosterEntry>
  currentUserId?: string
  /** Viewer's own per-source breakdown (server trims everyone else's). */
  ownBreakdown?: GlowPointBreakdown
  socialSessionId?: string | null
  /** S1 haptic grammar flag — gates the one-shot entrance celebration. */
  hapticGrammarEnabled?: boolean
}

export function RecapGlowBlock({
  glow,
  roster,
  currentUserId,
  ownBreakdown,
  socialSessionId,
  hapticGrammarEnabled = false,
}: RecapGlowBlockProps) {
  const { shouldReduceMotion } = useMiniRevealMotion()
  const cards = useMemo(
    () => buildGlowCards({ glow, roster, currentUserId, ownBreakdown }),
    [glow, roster, currentUserId, ownBreakdown],
  )
  const floorOnly = isFloorOnlyTable(cards)
  const [detailExpanded, setDetailExpanded] = useState(false)
  const entranceFiredRef = useRef(false)

  // Block entrance (AC-13/AC-15): ONE socialCelebration haptic (flag-gated,
  // never per-card) + one glow_recap_revealed event carrying the viewer's
  // own tier word-machine value (anonymous-aggregate safe).
  useEffect(() => {
    if (entranceFiredRef.current) return
    entranceFiredRef.current = true
    if (hapticGrammarEnabled) {
      socialHaptics('socialCelebration')
    }
    const ownTier = cards.find((card) => card.isSelf)?.tier
    socialIcebreakerAnalytics.track(
      'glow_recap_revealed',
      socialSessionId ?? undefined,
      undefined,
      'recap',
      ownTier ? { tier: ownTier } : undefined,
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Medal award events (AC-15): fire per medal as its card reveals,
  // stagger-aligned with the same timing the cards use (RM → immediate).
  useEffect(() => {
    const timers: Array<ReturnType<typeof setTimeout>> = []
    cards.forEach((card, index) => {
      if (card.medals.length === 0) return
      const delay = resolveGlowCardRevealDelayMs(index, shouldReduceMotion)
      timers.push(
        setTimeout(() => {
          card.medals.forEach((medal) => {
            socialIcebreakerAnalytics.track(
              'glow_medal_awarded',
              socialSessionId ?? undefined,
              undefined,
              'recap',
              {
                medal: medal.title,
                dataDerived: true,
                source: resolveGlowMedalSource(medal.title),
              },
            )
          })
        }, delay),
      )
    })
    return () => timers.forEach((timer) => clearTimeout(timer))
  }, [cards, shouldReduceMotion, socialSessionId])

  const handleDetailToggle = () => {
    setDetailExpanded((prev) => {
      const next = !prev
      if (next) {
        haptics('light')
        socialIcebreakerAnalytics.track(
          'glow_detail_expanded',
          socialSessionId ?? undefined,
          undefined,
          'recap',
        )
      }
      return next
    })
  }

  return (
    <Card className='icebreaker__recap-section recap-glow'>
      <Text className='icebreaker__recap-section-title icebreaker__recap-section-title--center'>
        <JoyJoinIcon emoji='✨' tier='reveal' size={28} /> {GLOW_BLOCK_TITLE}
      </Text>
      <Text className='recap-glow__table-line'>
        {glow.tableLine || GLOW_EMPTY_STATE_LINE}
      </Text>
      {floorOnly ? (
        <Text className='recap-glow__floor-line'>{GLOW_FLOOR_TIER_LINE}</Text>
      ) : null}

      <View className='recap-glow__cards'>
        {cards.map((card, index) => (
          <View
            key={card.userId}
            className={`recap-glow__card${card.isSelf ? ' recap-glow__card--self' : ''}${shouldReduceMotion ? '' : ' recap-glow__card--stagger'}`}
            style={
              shouldReduceMotion
                ? undefined
                : {
                    animationDelay: `${resolveGlowCardRevealDelayMs(index, false)}ms`,
                  }
            }
          >
            <View className='recap-glow__card-head'>
              <Text className='recap-glow__card-name'>
                {card.displayName}
                {card.isSelf ? (
                  <Text className='recap-glow__self-badge'>{GLOW_SELF_BADGE}</Text>
                ) : null}
              </Text>
              <Text className={`recap-glow__tier recap-glow__tier--${card.tier}`}>
                {card.tierWord}
              </Text>
            </View>

            {card.medals.length > 0 ? (
              <View className='recap-glow__medals'>
                {card.medals.map((medal) => (
                  <View className='recap-glow__medal' key={medal.title}>
                    <MedalIcon title={medal.title} emoji={medal.emoji} />
                    <Text className='recap-glow__medal-title'>{medal.title}</Text>
                    <Text className='recap-glow__medal-desc'>{medal.description}</Text>
                  </View>
                ))}
              </View>
            ) : null}

            {card.isSelf && card.ownSourceLabels && card.ownSourceLabels.length > 0 ? (
              <View className='recap-glow__detail'>
                <View
                  className='recap-glow__detail-toggle'
                  hoverClass='recap-glow__detail-toggle--hover'
                  onClick={handleDetailToggle}
                  role='button'
                  aria-expanded={detailExpanded}
                >
                  <Text className='recap-glow__detail-toggle-text'>
                    {detailExpanded
                      ? GLOW_DETAIL_COLLAPSE_LABEL
                      : GLOW_DETAIL_EXPAND_LABEL}
                  </Text>
                </View>
                {detailExpanded ? (
                  <View className='recap-glow__detail-body'>
                    <View className='recap-glow__detail-sources'>
                      {card.ownSourceLabels.map((label) => (
                        <Text className='recap-glow__detail-source' key={label}>
                          {label}
                        </Text>
                      ))}
                    </View>
                  </View>
                ) : null}
              </View>
            ) : null}
          </View>
        ))}
      </View>
    </Card>
  )
}
