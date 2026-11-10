import React, { useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { JoinedEventSummary } from '@shared/api'
import { getArchetypeTokens } from '@shared/archetypeColorTokens'
import { haptics } from '../../lib/utils/haptics'
import { trackFeedbackEvent } from '../../lib/analytics/feedbackAnalytics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import {
  getJoinedEventDisplayDateTime,
  isJoinedEventTerminal,
} from '../../lib/utils/eventDisplay'
import EventSummaryCard from './EventSummaryCard'
import ArchetypeHead from '../mascot/ArchetypeHead'
import './FootprintOracleCard.scss'

// groupSize is the viewer's assigned table size, never pool registrations or
// a configured formation target. It is meaningful only with an assigned group.
const ASSIGNED_TABLE_VISIBLE_STATUSES = new Set([
  'matched',
  'confirmed',
  'venue_unlocked',
  'completed',
  'attended',
])

export interface FootprintOracleCardProps {
  event: JoinedEventSummary
  index?: number
  onClick?: (event: JoinedEventSummary) => void
  isDegradation?: boolean
  /** Presentation-only context for past-day records in the completed bucket. */
  isHistorical?: boolean
}

export default React.memo(function FootprintOracleCard({
  event,
  index = 0,
  onClick,
  isDegradation = false,
  isHistorical = false,
}: FootprintOracleCardProps) {
  const { isDegradation: deviceIsDegradation } = useDeviceTier()
  const effectiveDegradation = isDegradation || deviceIsDegradation
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])

  const status = event.displayStatus ?? event.status ?? 'upcoming'
  const isTerminal = isJoinedEventTerminal(status)
  const isHistoricalNonterminal = isHistorical && !isTerminal

  const handleClick = React.useCallback(() => {
    haptics('light')
    onClick?.(event)
  }, [event, onClick])

  // 2026-10-16 feedback activation (PM plan §5.3): terminal + server-flagged
  // feedbackPending rows carry a persistent「去评价」entry — the recall channel
  // for users without push authorization. Brand-secondary pill, NOT a solid
  // primary CTA (the card itself stays the primary touch surface).
  const showFeedbackPill = isTerminal && event.feedbackPending === true

  // Impression mirrors corner_badge_impression discipline: once per mount.
  useEffect(() => {
    if (!showFeedbackPill) return
    trackFeedbackEvent('feedback_entry_shown', { eventId: event.id, state: 'open', surface: 'events_tab' })
  }, [showFeedbackPill, event.id])

  // stopPropagation: the pill must not trigger the card's own detail navigation.
  const handleFeedbackPillTap = React.useCallback(
    (e: { stopPropagation: () => void }) => {
      e.stopPropagation()
      haptics('light')
      trackFeedbackEvent('feedback_reminder_tap', { eventId: event.id, from: 'events_tab' })
      Taro.navigateTo({
        url: `/pages/event-feedback/index?id=${encodeURIComponent(event.id)}&from=events_tab`,
      })
    },
    [event.id],
  )

  const animDelay = !effectiveDegradation && !reduceMotion ? String(Math.min(index, 4) * 60) + 'ms' : undefined

  const displayDateTime = getJoinedEventDisplayDateTime(event)
  const groupSize = typeof event.groupSize === 'number' ? event.groupSize : undefined
  const price = typeof event.price === 'number' ? event.price : undefined
  const hasAssignedTable = Boolean(event.groupId)
    && groupSize != null
    && groupSize > 0
    && ASSIGNED_TABLE_VISIBLE_STATUSES.has(status)
  const groupSizeLabel = hasAssignedTable
    ? ((status === 'matched' || status === 'confirmed' || status === 'venue_unlocked') && !isHistoricalNonterminal
        ? `已排进 ${groupSize} 人桌`
        : `${groupSize} 人桌`)
    : undefined

  const railAriaParts = useMemo(() => {
    const parts: string[] = []
    if (!isHistoricalNonterminal && !isTerminal && Boolean(event.dateTime || event.finalDateTime)) {
      parts.push('含活动倒计时')
    }
    if (groupSizeLabel) {
      parts.push(groupSizeLabel)
    }
    if (price != null) {
      parts.push(price > 0 ? `费用 ¥${price}` : '免费')
    }
    return parts
  }, [event.dateTime, event.finalDateTime, groupSizeLabel, isHistoricalNonterminal, isTerminal, price])

  const railAriaLabel = railAriaParts.length > 0 ? railAriaParts.join('，') : undefined

  const hasPrice = price != null
  const tableFaces = Array.isArray(event.memberArchetypes)
    ? event.memberArchetypes.filter((archetype) => typeof archetype === 'string' && archetype.length > 0).slice(0, 6)
    : []
  const themePill = typeof event.theme === 'string' && event.theme.trim() ? event.theme.trim() : undefined
  // Phase 3 (2026-11-10): a state-aware affordance line. The card has no button,
  // so the footer carries the next step instead of inventing a fake CTA. The
  // row above already shows the faces, so the hint promises the layer the faces
  // cannot: who they are and how well you fit (designer B2).
  const ctaHint = status === 'completed' || status === 'attended'
    ? '翻翻这场回顾'
    : hasAssignedTable
      ? '看看这桌的合拍度'
      : undefined

  // The facts band's grammar is "left cluster ⇄ right number": faces illustrate
  // the table count, so without a count they are a dangling cluster, and a
  // price with no left fact reads as unloaded content. The band exists only
  // when the table count does (designer B1/B2, 2026-11-10).
  const metaAccessory = groupSizeLabel ? (
    <View className='footprint-oracle-card__facts'>
      {tableFaces.length > 0 && (
        <View className='footprint-oracle-card__table-faces' aria-hidden='true'>
          {tableFaces.map((archetype, faceIndex) => {
            const token = getArchetypeTokens(archetype)
            return (
              <View
                key={`${event.id}-face-${faceIndex}`}
                className='footprint-oracle-card__table-face'
                style={{ borderColor: token.primary }}
              >
                <ArchetypeHead
                  archetype={archetype}
                  size={40}
                  variant='head'
                  fallback='initial'
                  fallbackText={archetype.charAt(0).toUpperCase()}
                />
              </View>
            )
          })}
        </View>
      )}
      {groupSizeLabel && <Text className='footprint-oracle-card__fact'>{groupSizeLabel}</Text>}
      {hasPrice && (
        <Text className='footprint-oracle-card__fact footprint-oracle-card__fact--price'>
          {price > 0 ? `¥${price}` : '免费'}
        </Text>
      )}
    </View>
  ) : undefined

  const footerContent = showFeedbackPill ? (
    <View
      className='footprint-oracle-card__feedback-pill'
      hoverClass='footprint-oracle-card__feedback-pill--pressed'
      role='button'
      aria-label='去评价这场活动'
      onClick={handleFeedbackPillTap}
    >
      <Text className='footprint-oracle-card__feedback-pill-label'>去评价</Text>
    </View>
  ) : undefined

  return (
    <EventSummaryCard
      id={`footprint-card-${event.id}`}
      title={event.title}
      eventType={event.eventType}
      dateTime={displayDateTime}
      city={event.city}
      district={event.district}
      venueName={event.venueName}
      location={event.location}
      status={event.status}
      displayStatus={event.displayStatus}
      isHistorical={isHistorical}
      interactive
      onClick={handleClick}
      hoverClass='footprint-oracle-card--pressed'
      role='button'
      railAriaLabel={railAriaLabel}
      animationDelay={animDelay}
      isDegradation={effectiveDegradation}
      reduceMotion={reduceMotion}
      layout='split'
      themePill={themePill}
      footerHint={ctaHint}
      titleAccessory={(
        <Text className='footprint-oracle-card__title-cue' aria-hidden='true'>›</Text>
      )}
      metaAccessory={metaAccessory}
      footerContent={footerContent}
    />
  )
})
