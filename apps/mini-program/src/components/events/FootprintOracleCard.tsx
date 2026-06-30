import React, { useMemo } from 'react'
import type { JoinedEventSummary } from '@shared/api'
import { haptics } from '../../lib/utils/haptics'
import { getSystemReducedMotion } from '../../lib/utils/accessibility'
import { useDeviceTier } from '../../hooks/useDeviceTier'
import { getJoinedEventDisplayDateTime } from '../../lib/utils/eventDisplay'
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
  const isTerminal =
    status === 'completed' ||
    status === 'attended' ||
    status === 'cancelled' ||
    status === 'declined' ||
    status === 'no_show'

  const handleClick = React.useCallback(() => {
    haptics('light')
    onClick?.(event)
  }, [event, onClick])

  const animDelay = !effectiveDegradation && !reduceMotion ? String(Math.min(index, 4) * 60) + 'ms' : undefined
  const footerHint = isTerminal ? '点击查看详情与回顾' : '点击查看活动详情'

  return (
    <EventSummaryCard
      id={`footprint-card-${event.id}`}
      title={event.title}
      eventType={event.eventType}
      dateTime={getJoinedEventDisplayDateTime(event)}
      city={event.city}
      district={event.district}
      venueName={event.venueName}
      location={event.location}
      status={event.status}
      displayStatus={event.displayStatus}
      interactive
      onClick={handleClick}
      hoverClass='footprint-oracle-card--pressed'
      footerHint={footerHint}
      role='button'
      animationDelay={animDelay}
      isDegradation={effectiveDegradation}
      reduceMotion={reduceMotion}
    />
  )
})
