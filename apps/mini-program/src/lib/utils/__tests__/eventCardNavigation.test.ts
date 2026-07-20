import type { JoinedEventSummary } from '@shared/api'
import { describe, expect, it } from 'vitest'
import { buildEventCardUrl } from '../eventCardNavigation'

function makeEvent(overrides: Partial<JoinedEventSummary> = {}): JoinedEventSummary {
  return {
    id: 'event-1',
    title: 'Test Event',
    status: 'registered',
    displayStatus: 'registered',
    dateTime: '2026-07-20T19:00:00+08:00',
    ...overrides,
  } as JoinedEventSummary
}

describe('eventCardNavigation', () => {
  describe('buildEventCardUrl', () => {
    it('routes non-terminal registered events to matching-status', () => {
      const event = makeEvent({ registrationId: 'reg-1', displayStatus: 'registered' })
      expect(buildEventCardUrl(event)).toBe('/subpackages/matching-status/index?registrationId=reg-1')
    })

    it('routes terminal events to event-detail even when registrationId exists', () => {
      const event = makeEvent({ registrationId: 'reg-1', displayStatus: 'completed' })
      expect(buildEventCardUrl(event)).toBe('/pages/event-detail/index?id=event-1')
    })

    it('routes attended events to event-detail even when registrationId exists', () => {
      const event = makeEvent({ registrationId: 'reg-1', displayStatus: 'attended' })
      expect(buildEventCardUrl(event)).toBe('/pages/event-detail/index?id=event-1')
    })

    it('routes events without registrationId to event-detail', () => {
      const event = makeEvent({ displayStatus: 'registered' })
      expect(buildEventCardUrl(event)).toBe('/pages/event-detail/index?id=event-1')
    })

    it('encodes registrationId for safety', () => {
      const event = makeEvent({ registrationId: 'reg 1&2', displayStatus: 'registered' })
      expect(buildEventCardUrl(event)).toBe('/subpackages/matching-status/index?registrationId=reg%201%262')
    })

    it('encodes event id for safety', () => {
      const event = makeEvent({ id: 'ev 1&2', displayStatus: 'completed' })
      expect(buildEventCardUrl(event)).toBe('/pages/event-detail/index?id=ev%201%262')
    })
  })
})
