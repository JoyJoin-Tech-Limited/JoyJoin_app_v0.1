import type { JoinedEventSummary } from '@shared/api'
import { describe, expect, it } from 'vitest'
import { partitionJoinedEventsByDateTime } from './eventPartition'

const REFERENCE_TIME = new Date('2026-04-13T12:00:00+08:00')

function createJoinedEvent(
  id: string,
  dateTime?: string,
  status?: string,
  groupId?: string,
  finalDateTime?: string,
  displayStatus?: JoinedEventSummary['displayStatus'],
): JoinedEventSummary {
  return {
    id,
    title: id,
    dateTime,
    status,
    displayStatus,
    groupId,
    finalDateTime,
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

  it('always sends cancelled/completed/attended events to the completed bucket', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('cancelled-future', '2026-04-14T19:30:00+08:00', 'cancelled'),
        createJoinedEvent('completed-future', '2026-04-14T19:30:00+08:00', 'completed'),
        createJoinedEvent('attended-future', '2026-04-14T19:30:00+08:00', 'attended'),
        createJoinedEvent('upcoming-future', '2026-04-14T19:30:00+08:00', 'upcoming'),
        createJoinedEvent('matched-past', '2026-04-12T19:30:00+08:00', 'matched'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.upcoming.map((event) => event.id)).toEqual(['upcoming-future'])
    expect(buckets.completed.map((event) => event.id)).toEqual([
      'cancelled-future',
      'completed-future',
      'attended-future',
      'matched-past',
    ])
  })

  it('uses displayStatus over raw status for terminal classification', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        // Pool status is 'matched' but derived displayStatus says cancelled → completed bucket.
        createJoinedEvent(
          'pool-matched-but-cancelled',
          '2026-04-14T19:30:00+08:00',
          'matched',
          'group-1',
          '2026-04-14T19:30:00+08:00',
          'cancelled',
        ),
        // Pool status is 'completed' but displayStatus says attended → completed bucket.
        createJoinedEvent(
          'pool-completed-attended',
          '2026-04-14T19:30:00+08:00',
          'completed',
          'group-2',
          '2026-04-14T19:30:00+08:00',
          'attended',
        ),
        // displayStatus is active even though raw status is unknown → upcoming bucket.
        createJoinedEvent(
          'display-active',
          '2026-04-14T19:30:00+08:00',
          'weird',
          undefined,
          undefined,
          'matched',
        ),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.upcoming.map((event) => event.id)).toEqual(['display-active'])
    expect(buckets.completed.map((event) => event.id)).toEqual([
      'pool-matched-but-cancelled',
      'pool-completed-attended',
    ])
  })

  it('prefers finalDateTime over dateTime for active grouped events', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        // dateTime is in the past, but finalDateTime is future → upcoming
        createJoinedEvent(
          'grouped-final-future',
          '2026-04-12T19:30:00+08:00',
          'matched',
          'group-1',
          '2026-04-14T19:30:00+08:00',
        ),
        // dateTime is future, but finalDateTime is past → completed
        createJoinedEvent(
          'grouped-final-past',
          '2026-04-14T19:30:00+08:00',
          'confirmed',
          'group-2',
          '2026-04-12T19:30:00+08:00',
        ),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.upcoming.map((event) => event.id)).toEqual(['grouped-final-future'])
    expect(buckets.completed.map((event) => event.id)).toEqual(['grouped-final-past'])
  })
})
