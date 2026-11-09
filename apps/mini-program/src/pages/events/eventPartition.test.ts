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
  it('returns three empty buckets for empty input', () => {
    expect(partitionJoinedEventsByDateTime([], REFERENCE_TIME)).toEqual({
      ongoing: [],
      upcoming: [],
      completed: [],
    })
  })

  it('puts every future-day active workflow status into ongoing', () => {
    const buckets = partitionJoinedEventsByDateTime(
      ['pending', 'registered', 'matched'].map((status) =>
        createJoinedEvent(status, '2026-04-14T19:30:00+08:00', status)),
      REFERENCE_TIME,
    )

    expect(buckets.ongoing.map((event) => event.id)).toEqual(['pending', 'registered', 'matched'])
    expect(buckets.upcoming).toEqual([])
    expect(buckets.completed).toEqual([])
  })

  it('puts future-day scheduling statuses and unknown statuses into upcoming', () => {
    const statuses = ['confirmed', 'venue_unlocked', 'upcoming', 'unknown']
    const buckets = partitionJoinedEventsByDateTime(
      statuses.map((status) => createJoinedEvent(status, '2026-04-14T19:30:00+08:00', status)),
      REFERENCE_TIME,
    )

    expect(buckets.ongoing).toEqual([])
    expect(buckets.upcoming.map((event) => event.id)).toEqual(statuses)
    expect(buckets.completed).toEqual([])
  })

  it('keeps same-day nonterminal events ongoing at exact start and after start', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('exact-start', '2026-04-13T12:00:00+08:00', 'confirmed'),
        createJoinedEvent('already-started', '2026-04-13T09:00:00+08:00', 'venue_unlocked'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.ongoing.map((event) => event.id)).toEqual(['exact-start', 'already-started'])
    expect(buckets.upcoming).toEqual([])
    expect(buckets.completed).toEqual([])
  })

  it('puts past-day nonterminal events into completed regardless of workflow status', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('past-pending', '2026-04-12T19:30:00+08:00', 'pending'),
        createJoinedEvent('past-confirmed', '2026-04-12T23:59:59+08:00', 'confirmed'),
        createJoinedEvent('past-unknown', '2026-04-01T19:30:00+08:00', 'unknown'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.ongoing).toEqual([])
    expect(buckets.upcoming).toEqual([])
    expect(buckets.completed.map((event) => event.id)).toEqual([
      'past-pending',
      'past-confirmed',
      'past-unknown',
    ])
  })

  it('puts every terminal status into completed even when the date is future', () => {
    const statuses = ['completed', 'attended', 'cancelled', 'declined', 'no_show']
    const buckets = partitionJoinedEventsByDateTime(
      statuses.map((status) => createJoinedEvent(status, '2026-04-14T19:30:00+08:00', status)),
      REFERENCE_TIME,
    )

    expect(buckets.ongoing).toEqual([])
    expect(buckets.upcoming).toEqual([])
    expect(buckets.completed.map((event) => event.id)).toEqual(statuses)
  })

  it('uses active workflow status to classify missing and invalid dates', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('pending-missing', undefined, 'pending'),
        createJoinedEvent('registered-invalid', 'not-a-real-date', 'registered'),
        createJoinedEvent('matched-missing', undefined, 'matched'),
        createJoinedEvent('confirmed-missing', undefined, 'confirmed'),
        createJoinedEvent('venue-invalid', 'not-a-real-date', 'venue_unlocked'),
        createJoinedEvent('upcoming-missing', undefined, 'upcoming'),
        createJoinedEvent('unknown-invalid', 'not-a-real-date', 'unknown'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.ongoing.map((event) => event.id)).toEqual([
      'pending-missing',
      'registered-invalid',
      'matched-missing',
    ])
    expect(buckets.upcoming.map((event) => event.id)).toEqual([
      'confirmed-missing',
      'venue-invalid',
      'upcoming-missing',
      'unknown-invalid',
    ])
    expect(buckets.completed).toEqual([])
  })

  it('uses finalDateTime precedence in both directions', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent(
          'grouped-final-future',
          '2026-04-12T19:30:00+08:00',
          'matched',
          'group-1',
          '2026-04-14T19:30:00+08:00',
        ),
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

    expect(buckets.ongoing.map((event) => event.id)).toEqual(['grouped-final-future'])
    expect(buckets.upcoming).toEqual([])
    expect(buckets.completed.map((event) => event.id)).toEqual(['grouped-final-past'])
  })

  it('applies invalid-date rules to an invalid preferred finalDateTime without fallback', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent(
          'active-invalid-final',
          '2026-04-12T19:30:00+08:00',
          'matched',
          'group-1',
          'invalid-final-date',
        ),
        createJoinedEvent(
          'scheduled-invalid-final',
          '2026-04-12T19:30:00+08:00',
          'confirmed',
          'group-2',
          'invalid-final-date',
        ),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.ongoing.map((event) => event.id)).toEqual(['active-invalid-final'])
    expect(buckets.upcoming.map((event) => event.id)).toEqual(['scheduled-invalid-final'])
    expect(buckets.completed).toEqual([])
  })

  it('uses displayStatus over raw status for terminal and active classification', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent(
          'derived-cancelled-over-matched',
          '2026-04-14T19:30:00+08:00',
          'matched',
          'group-1',
          '2026-04-14T19:30:00+08:00',
          'cancelled',
        ),
        createJoinedEvent(
          'derived-attended-over-completed',
          '2026-04-14T19:30:00+08:00',
          'completed',
          'group-2',
          '2026-04-14T19:30:00+08:00',
          'attended',
        ),
        createJoinedEvent(
          'derived-active-over-unknown',
          '2026-04-14T19:30:00+08:00',
          'unknown',
          undefined,
          undefined,
          'matched',
        ),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.ongoing.map((event) => event.id)).toEqual(['derived-active-over-unknown'])
    expect(buckets.upcoming).toEqual([])
    expect(buckets.completed.map((event) => event.id)).toEqual([
      'derived-cancelled-over-matched',
      'derived-attended-over-completed',
    ])
  })

  it('defines synthetic unmatched and cancelled records without treating unmatched as terminal', () => {
    // The normal joined-events query excludes these synthetic pool outcomes;
    // keeping them here locks total partition behavior if a DTO ever includes them.
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('synthetic-unmatched', '2026-04-14T19:30:00+08:00', 'unmatched'),
        createJoinedEvent('synthetic-cancelled', '2026-04-14T19:30:00+08:00', 'cancelled'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.upcoming.map((event) => event.id)).toEqual(['synthetic-unmatched'])
    expect(buckets.completed.map((event) => event.id)).toEqual(['synthetic-cancelled'])
  })

  it('compares both sides of the UTC+8 midnight boundary', () => {
    const buckets = partitionJoinedEventsByDateTime(
      [
        createJoinedEvent('before-midnight', '2026-04-12T15:59:59Z', 'confirmed'),
        createJoinedEvent('at-midnight', '2026-04-12T16:00:00Z', 'confirmed'),
      ],
      REFERENCE_TIME,
    )

    expect(buckets.completed.map((event) => event.id)).toEqual(['before-midnight'])
    expect(buckets.ongoing.map((event) => event.id)).toEqual(['at-midnight'])
    expect(buckets.upcoming).toEqual([])
  })

  it('places every mixed input exactly once and preserves order within each bucket', () => {
    const events = [
      createJoinedEvent('terminal', '2026-04-14T19:30:00+08:00', 'cancelled'),
      createJoinedEvent('future-confirmed', '2026-04-14T19:30:00+08:00', 'confirmed'),
      createJoinedEvent('future-pending', '2026-04-14T19:30:00+08:00', 'pending'),
      createJoinedEvent('past-upcoming', '2026-04-12T19:30:00+08:00', 'upcoming'),
      createJoinedEvent('same-day', '2026-04-13T08:00:00+08:00', 'venue_unlocked'),
      createJoinedEvent('invalid-matched', 'invalid', 'matched'),
    ]

    const buckets = partitionJoinedEventsByDateTime(events, REFERENCE_TIME)

    expect(buckets.ongoing.map((event) => event.id)).toEqual([
      'future-pending',
      'same-day',
      'invalid-matched',
    ])
    expect(buckets.upcoming.map((event) => event.id)).toEqual(['future-confirmed'])
    expect(buckets.completed.map((event) => event.id)).toEqual(['terminal', 'past-upcoming'])

    const flattened = [...buckets.ongoing, ...buckets.upcoming, ...buckets.completed]
    expect(flattened).toHaveLength(events.length)
    expect(new Set(flattened.map((event) => event.id)).size).toBe(events.length)
    events.forEach((event) => {
      expect(flattened.filter((candidate) => candidate === event)).toHaveLength(1)
    })
  })
})
