import type { JoinedEventSummary } from '@shared/api'
import { getJoinedEventDisplayDateTime, isJoinedEventTerminal } from '../../lib/utils/eventDisplay'

export interface JoinedEventBuckets {
  upcoming: JoinedEventSummary[]
  completed: JoinedEventSummary[]
}

function getJoinedEventTime(event: JoinedEventSummary): number | null {
  const displayDateTime = getJoinedEventDisplayDateTime(event)
  if (typeof displayDateTime !== 'string' || displayDateTime.trim().length === 0) {
    return null
  }

  const timestamp = new Date(displayDateTime).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function partitionJoinedEventsByDateTime(
  events: JoinedEventSummary[],
  referenceTime = new Date(),
): JoinedEventBuckets {
  const now = referenceTime.getTime()

  return events.reduce<JoinedEventBuckets>(
    (buckets, event) => {
      // Terminal statuses always belong to the completed bucket, regardless of dateTime.
      const canonicalStatus = event.displayStatus ?? event.status ?? ''
      if (isJoinedEventTerminal(canonicalStatus)) {
        buckets.completed.push(event)
        return buckets
      }

      const eventTime = getJoinedEventTime(event)

      if (eventTime === null || eventTime >= now) {
        buckets.upcoming.push(event)
      } else {
        buckets.completed.push(event)
      }

      return buckets
    },
    { upcoming: [], completed: [] },
  )
}
