import React, { useEffect, useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import Taro from '@tarojs/taro'
import type { JoinedEventSummary } from '@shared/api'
import { haptics } from '../../lib/utils/haptics'
import { trackFeedbackEvent } from '../../lib/analytics/feedbackAnalytics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import {
  getJoinedEventDisplayDateTime,
  isJoinedEventTerminal,
} from '../../lib/utils/eventDisplay'
import SegmentedCountdownClock from '../ui/SegmentedCountdownClock'
import EventSummaryCard from './EventSummaryCard'
import './FootprintOracleCard.scss'

export interface FootprintOracleCardProps {
  event: JoinedEventSummary
  index?: number
  onClick?: (event: JoinedEventSummary) => void
  isDegradation?: boolean
}

export default React.memo(function FootprintOracleCard({
  event,
  index = 0,
  onClick,
  isDegradation = false,
}: FootprintOracleCardProps) {
  const { isDegradation: deviceIsDegradation } = useDeviceTier()
  const effectiveDegradation = isDegradation || deviceIsDegradation
  const reduceMotion = useMemo(() => getSystemReducedMotion(), [])

  const status = event.displayStatus ?? event.status ?? 'upcoming'
  const isTerminal = isJoinedEventTerminal(status)

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

  const railAriaParts = useMemo(() => {
    const parts: string[] = []
    if (!isTerminal && Boolean(event.dateTime || event.finalDateTime)) {
      parts.push('含活动倒计时')
    }
    if (groupSize != null && groupSize > 0) {
      parts.push(
        status === 'matched' || status === 'confirmed' || status === 'venue_unlocked'
          ? `${groupSize} 人小队`
          : `已报名 ${groupSize} 人`,
      )
    }
    if (price != null) {
      parts.push(price > 0 ? `费用 ¥${price}` : '免费')
    }
    return parts
  }, [event.dateTime, event.finalDateTime, groupSize, isTerminal, price, status])

  const railAriaLabel = railAriaParts.length > 0 ? railAriaParts.join('，') : undefined

  // ─── Right-side info rail ──────────────────────────────────────
  const rightRail = useMemo(() => {
    const hasCountdown = !isTerminal && Boolean(event.dateTime || event.finalDateTime)
    const hasGroupSize = groupSize != null && groupSize > 0
    const hasPrice = price != null
    const isSparse = !hasCountdown && !hasGroupSize && !hasPrice

    return (
      <>
        {hasCountdown && (
          <SegmentedCountdownClock
            target={displayDateTime ?? null}
            enabled={hasCountdown}
            clockId={`footprint-rail-clock-${event.id}`}
            compact
          />
        )}
        {showFeedbackPill && (
          <View
            className='footprint-oracle-card__feedback-pill'
            hoverClass='footprint-oracle-card__feedback-pill--pressed'
            role='button'
            aria-label='去评价这场活动'
            onClick={handleFeedbackPillTap}
          >
            <Text className='footprint-oracle-card__feedback-pill-label'>去评价</Text>
          </View>
        )}
        {hasGroupSize && (
          <Text className='footprint-oracle-card__rail-hint'>
            {status === 'matched' || status === 'confirmed' || status === 'venue_unlocked'
              ? `${groupSize} 人小队`
              : `已报名 ${groupSize} 人`}
          </Text>
        )}
        {hasPrice && (
          <Text className='footprint-oracle-card__rail-price'>
            {price > 0 ? `¥${price}` : '免费'}
          </Text>
        )}
        {isSparse && !showFeedbackPill && (
          <Text className='footprint-oracle-card__rail-hint footprint-oracle-card__rail-hint--placeholder'>
            待公布
          </Text>
        )}
        {/* The generic › cue is superseded when the pill is present — the pill
            IS the affordance; stacking both reads as two competing CTAs. */}
        {!showFeedbackPill && (
          <Text className='footprint-oracle-card__rail-cue' aria-hidden='true'>
            ›
          </Text>
        )}
      </>
    )
  }, [displayDateTime, event.dateTime, event.finalDateTime, event.id, groupSize, handleFeedbackPillTap, isTerminal, price, showFeedbackPill, status])

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
      interactive
      onClick={handleClick}
      hoverClass='footprint-oracle-card--pressed'
      role='button'
      railAriaLabel={railAriaLabel}
      animationDelay={animDelay}
      isDegradation={effectiveDegradation}
      reduceMotion={reduceMotion}
      railMode
      rightRail={rightRail}
    />
  )
})
