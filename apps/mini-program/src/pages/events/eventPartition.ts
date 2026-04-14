import type { JoinedEventSummary } from '@shared/api'

export interface JoinedEventBuckets {
  upcoming: JoinedEventSummary[]
  completed: JoinedEventSummary[]
}

function getJoinedEventTime(dateTime?: string): number | null {
  if (typeof dateTime !== 'string' || dateTime.trim().length === 0) {
    return null
  }

  const timestamp = new Date(dateTime).getTime()
  return Number.isFinite(timestamp) ? timestamp : null
}

export function partitionJoinedEventsByDateTime(
  events: JoinedEventSummary[],
  referenceTime = new Date(),
): JoinedEventBuckets {
  const now = referenceTime.getTime()

  return events.reduce<JoinedEventBuckets>(
    (buckets, event) => {
      const eventTime = getJoinedEventTime(event.dateTime)

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
