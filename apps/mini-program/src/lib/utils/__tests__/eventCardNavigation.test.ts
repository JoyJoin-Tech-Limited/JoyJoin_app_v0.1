import Taro from '@tarojs/taro'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { JoinedEventSummary } from '@shared/api'
import { buildEventCardUrl, navigateToEventCard, resolveTableEntryState } from '../eventCardNavigation'

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

// The sealed-card entry is a promise (the capsule) and a destination (the
// route). These rows lock them together: any row that resolves to `sealed`
// must also build the squad-unboxing URL, so the two can never drift.
describe('eventCardNavigation sealed table entry', () => {
  const NOW = Date.parse('2026-11-11T10:00:00+08:00')
  const FUTURE = '2026-11-14T22:02:00+08:00'

  function matchedEvent(overrides: Partial<JoinedEventSummary> = {}): JoinedEventSummary {
    return makeEvent({
      status: 'matched',
      displayStatus: 'matched',
      registrationId: 'registration-1',
      groupId: 'group-1',
      groupSize: 6,
      dateTime: FUTURE,
      ...overrides,
    })
  }

  type ResolveExtra = {
    hasOpened?: () => boolean
    openBoxEntryEnabled?: boolean
    isHistorical?: boolean
  }

  const resolve = (event: JoinedEventSummary, extra: ResolveExtra = {}) =>
    resolveTableEntryState(event, {
      openBoxEntryEnabled: true,
      hasOpened: () => false,
      now: NOW,
      ...extra,
    })

  // `displayStatus` carries the literal union; `status` is a loose string.
  type UpcomingStatus = NonNullable<JoinedEventSummary['displayStatus']>
  const sealedRows: Array<[string, UpcomingStatus]> = [
    ['matched', 'matched'],
    ['confirmed', 'confirmed'],
    ['venue_unlocked', 'venue_unlocked'],
  ]

  // `forEach` rather than `it.each`: each() widens a 2-tuple row's element type
  // to `string`, which then fails the status union. The loop keeps the literal.
  sealedRows.forEach(([label, status]) => {
    it(`seals an upcoming ${label} table that has not been opened`, () => {
      const event = matchedEvent({ status, displayStatus: status })

      expect(resolve(event)).toBe('sealed')
      expect(buildEventCardUrl(event, { tableEntryState: 'sealed' })).toBe(
        '/pages/squad-unboxing/index?groupId=group-1&from=card',
      )
    })
  })

  it('sends an already-opened table to its group detail, never back through the ceremony', () => {
    const event = matchedEvent()

    expect(resolve(event, { hasOpened: () => true })).toBe('revealed')
    expect(buildEventCardUrl(event, { tableEntryState: 'revealed' })).toBe(
      '/pages/pool-group-detail/index?groupId=group-1',
    )
  })

  // Server truth outranks the local cache (2026-11-11). The cache only covers
  // the frames before the list payload lands; it must never keep a table sealed
  // once the server says it was opened.
  it('prefers the server reveal fact over the local cache', () => {
    const event = matchedEvent({ revealedAt: '2026-11-11T09:30:00.000Z' })

    expect(resolve(event, { hasOpened: () => false })).toBe('revealed')
    expect(buildEventCardUrl(event, { tableEntryState: 'revealed' })).toBe(
      '/pages/pool-group-detail/index?groupId=group-1',
    )
  })

  it('falls back to the cached flag only while the server fact is absent', () => {
    // `null` and `undefined` both mean the payload carried no answer, so the
    // cache decides — true keeps the card settled, false keeps it sealed.
    expect(resolve(matchedEvent({ revealedAt: null }), { hasOpened: () => true })).toBe('revealed')
    expect(resolve(matchedEvent({ revealedAt: undefined }), { hasOpened: () => true })).toBe('revealed')
    expect(resolve(matchedEvent({ revealedAt: null }), { hasOpened: () => false })).toBe('sealed')
  })

  // Every row below is a state where the card must NOT promise a sealed table.
  // The expected URL is the legacy branch for that same state, so a row can
  // only pass when the sealed treatment is genuinely off.
  const unsealedRows: Array<[string, JoinedEventSummary, ResolveExtra, string]> = [
    ['flag off', matchedEvent(), { openBoxEntryEnabled: false }, '/pages/matching-status/index?registrationId=registration-1'],
    ['historical bucket', matchedEvent(), { isHistorical: true }, '/pages/event-detail/index?id=event-1'],
    ['already started', matchedEvent({ dateTime: '2026-11-11T09:00:00+08:00' }), {}, '/pages/matching-status/index?registrationId=registration-1'],
    ['missing group', matchedEvent({ groupId: undefined }), {}, '/pages/matching-status/index?registrationId=registration-1'],
    ['missing group size', matchedEvent({ groupSize: undefined }), {}, '/pages/matching-status/index?registrationId=registration-1'],
    ['zero group size', matchedEvent({ groupSize: 0 }), {}, '/pages/matching-status/index?registrationId=registration-1'],
    ['pending registration', matchedEvent({ status: 'pending', displayStatus: 'pending' }), {}, '/pages/matching-status/index?registrationId=registration-1'],
    ['completed table', matchedEvent({ status: 'completed', displayStatus: 'completed' }), {}, '/pages/event-detail/index?id=event-1'],
    ['cancelled table', matchedEvent({ status: 'cancelled', displayStatus: 'cancelled' }), {}, '/pages/event-detail/index?id=event-1'],
  ]

  it.each(unsealedRows)('leaves the card unsealed for %s', (_label, event, extra, expectedUrl) => {
    expect(resolve(event, extra)).toBe('none')
    // No promise means no capsule, so the destination must stay on the legacy
    // branch (waiting room for a live registration, detail otherwise).
    expect(buildEventCardUrl(event, { tableEntryState: 'none', isHistorical: extra.isHistorical })).toBe(expectedUrl)
  })

  it('treats a missing group size as unsealed even when a group id exists', () => {
    const event = matchedEvent({ groupSize: undefined })

    expect(resolve(event)).toBe('none')
  })

  it('falls back to event-detail for a sealed-shaped event with no registration id', () => {
    const event = matchedEvent({ registrationId: undefined, status: 'completed', displayStatus: 'completed' })

    expect(resolve(event)).toBe('none')
    expect(buildEventCardUrl(event, { tableEntryState: 'none' })).toBe(
      '/pages/event-detail/index?id=event-1',
    )
  })

  it('navigates with navigateTo so the back gesture returns to the list', () => {
    const event = matchedEvent()

    navigateToEventCard(event, { tableEntryState: 'sealed' })

    expect(Taro.navigateTo).toHaveBeenCalledWith({
      url: '/pages/squad-unboxing/index?groupId=group-1&from=card',
    })
  })
})
