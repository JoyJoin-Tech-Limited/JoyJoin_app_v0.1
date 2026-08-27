import React, { useMemo } from 'react'
import { View, Text } from '@tarojs/components'
import type { JoinedEventSummary } from '@shared/api'
import { haptics } from '../../lib/utils/haptics'
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
        {isSparse && (
          <Text className='footprint-oracle-card__rail-hint footprint-oracle-card__rail-hint--placeholder'>
            待公布
          </Text>
        )}
        <Text className='footprint-oracle-card__rail-cue' aria-hidden='true'>
          ›
        </Text>
      </>
    )
  }, [displayDateTime, event.dateTime, event.finalDateTime, event.id, groupSize, isTerminal, price, status])

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
