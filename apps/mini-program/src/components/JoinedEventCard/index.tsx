import React from 'react'
import type { JoinedEventSummary } from '@shared/api'
import FootprintOracleCard from '../events/FootprintOracleCard'

interface JoinedEventCardProps {
  event: JoinedEventSummary
  index?: number
  onClick?: () => void
  isDegradation?: boolean
}

/**
 * Legacy wrapper — now delegates to the Oracle Card redesign for 我的足迹.
 * Kept as a thin compatibility layer so existing consumers don't need to migrate
 * in a single sweep.
 */
export default React.memo(function JoinedEventCard({
  event,
  index = 0,
  onClick,
  isDegradation = false,
}: JoinedEventCardProps) {
  return (
    <FootprintOracleCard
      event={event}
      index={index}
      onClick={onClick ? () => onClick() : undefined}
      isDegradation={isDegradation}
    />
  )
})
