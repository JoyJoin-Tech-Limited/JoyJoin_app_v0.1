import type { JoinedEventSummary } from '@shared/api'
import { getHongKongDateForComparison } from '@shared/hongKongTime'
import { getJoinedEventDisplayDateTime, isJoinedEventTerminal } from '../../lib/utils/eventDisplay'

export interface JoinedEventBuckets {
  ongoing: JoinedEventSummary[]
  upcoming: JoinedEventSummary[]
  completed: JoinedEventSummary[]
}

const ACTIVE_WORKFLOW_STATUSES = new Set(['pending', 'registered', 'matched'])

function getHongKongCalendarDay(value: string | Date): string | null {
  const parsed = value instanceof Date ? value : new Date(value)
  if (!Number.isFinite(parsed.getTime())) {
    return null
  }

  return getHongKongDateForComparison(parsed).toISOString().slice(0, 10)
}

export function partitionJoinedEventsByDateTime(
  events: JoinedEventSummary[],
  referenceTime = new Date(),
): JoinedEventBuckets {
  const referenceDay = getHongKongCalendarDay(referenceTime)

  return events.reduce<JoinedEventBuckets>(
    (buckets, event) => {
      // Terminal statuses always belong to the completed bucket, regardless of dateTime.
      const canonicalStatus = event.displayStatus ?? event.status ?? ''
      if (isJoinedEventTerminal(canonicalStatus)) {
        buckets.completed.push(event)
        return buckets
      }

      const displayDateTime = getJoinedEventDisplayDateTime(event)
      const eventDay = typeof displayDateTime === 'string'
        ? getHongKongCalendarDay(displayDateTime)
        : null
      const isActiveWorkflow = ACTIVE_WORKFLOW_STATUSES.has(canonicalStatus)

      // An invalid preferred finalDateTime intentionally follows this rule;
      // getJoinedEventDisplayDateTime owns precedence and no fallback is made here.
      if (eventDay === null || referenceDay === null) {
        buckets[isActiveWorkflow ? 'ongoing' : 'upcoming'].push(event)
      } else if (eventDay < referenceDay) {
        buckets.completed.push(event)
      } else if (eventDay === referenceDay || isActiveWorkflow) {
        buckets.ongoing.push(event)
      } else {
        buckets.upcoming.push(event)
      }

      return buckets
    },
    { ongoing: [], upcoming: [], completed: [] },
  )
}
