import type { JoinedEventSummary } from '@shared/api'
import { describe, expect, it } from 'vitest'
import { partitionJoinedEventsByDateTime } from './eventPartition'

const REFERENCE_TIME = new Date('2026-04-13T12:00:00+08:00')

function createJoinedEvent(id: string, dateTime?: string): JoinedEventSummary {
  return {
    id,
    title: id,
    dateTime,
  }
}

describe('partitionJoinedEventsByDateTime', () => {
  it('splits future joined events from past joined events', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('future', '2026-04-14T19:30:00+08:00'),
        createJoinedEvent('past', '2026-04-12T19:30:00+08:00'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.upcoming.map((event) => event.id)).toEqual(['future'])
    expect(buckets.completed.map((event) => event.id)).toEqual(['past'])
  })

  it('treats an event starting now as upcoming', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [createJoinedEvent('now', '2026-04-13T12:00:00+08:00')],
      REFERENCE_TIME,
    )

    expect(buckets.upcoming.map((event) => event.id)).toEqual(['now'])
    expect(buckets.completed).toEqual([])
  })

  // Guards against regression: joined events without a parseable date must
  // remain visible on the upcoming tab instead of disappearing from the page.
  it('fails safe into upcoming when dateTime is missing or invalid', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('missing'),
        createJoinedEvent('invalid', 'not-a-real-date'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.upcoming.map((event) => event.id)).toEqual(['missing', 'invalid'])
    expect(buckets.completed).toEqual([])
  })
})
