import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinedEventSummary } from '@shared/api'
import { buildEventCardUrl, navigateToEventCard } from '../eventCardNavigation'

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
      expect(buildEventCardUrl(event)).toBe('/pages/matching-status/index?registrationId=reg-1')
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
      expect(buildEventCardUrl(event)).toBe('/pages/matching-status/index?registrationId=reg%201%262')
    })

    it('encodes event id for safety', () => {
      const event = makeEvent({ id: 'ev 1&2', displayStatus: 'completed' })
      expect(buildEventCardUrl(event)).toBe('/pages/event-detail/index?id=ev%201%262')
    })
  })
})

describe('eventCardNavigation historical context', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('preserves matching-status navigation by default for a nonterminal registration', () => {
    const event = makeEvent({
      status: 'matched',
      displayStatus: 'matched',
      registrationId: 'registration-1',
    })

    expect(buildEventCardUrl(event)).toBe(
      '/pages/matching-status/index?registrationId=registration-1',
    )
    expect(buildEventCardUrl(event, { isHistorical: false })).toBe(
      '/pages/matching-status/index?registrationId=registration-1',
    )
  })

  it('resolves a historical nonterminal registration to event-detail without mutating the DTO', () => {
    const event = makeEvent({
      id: 'past-event',
      status: 'matched',
      displayStatus: 'matched',
      registrationId: 'registration-1',
    })
    const originalEvent = { ...event }

    expect(buildEventCardUrl(event, { isHistorical: true })).toBe(
      '/pages/event-detail/index?id=past-event',
    )
    navigateToEventCard(event, { isHistorical: true })

    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/event-detail/index?id=past-event',
    })
    expect(event).toEqual(originalEvent)
    expect(event.registrationId).toBe('registration-1')
    expect(event.displayStatus).toBe('matched')
  })

  it('keeps genuine terminal navigation unchanged when historical context is supplied', () => {
    const event = makeEvent({
      id: 'terminal-event',
      status: 'completed',
      displayStatus: 'completed',
    })

    expect(buildEventCardUrl(event)).toBe('/pages/event-detail/index?id=terminal-event')
    expect(buildEventCardUrl(event, { isHistorical: true })).toBe(
      '/pages/event-detail/index?id=terminal-event',
    )
  })
})
