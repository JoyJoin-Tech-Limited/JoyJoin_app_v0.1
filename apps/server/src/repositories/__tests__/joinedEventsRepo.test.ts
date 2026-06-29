import { describe, expect, it } from 'vitest'
import {
  derivePoolDisplayStatus,
  deriveLegacyDisplayStatus,
} from '../joinedEventsRepo'

describe('derivePoolDisplayStatus', () => {
  it('returns pending when matchStatus is pending', () => {
    expect(derivePoolDisplayStatus('pending', null, null, 'active')).toBe('pending')
    expect(derivePoolDisplayStatus('pending', null, null, 'matching')).toBe('pending')
  })

  it('returns matched when matchStatus is matched but venue is not assigned', () => {
    expect(derivePoolDisplayStatus('matched', 'pending', null, 'matched')).toBe('matched')
    expect(derivePoolDisplayStatus('matched', 'unassigned', null, 'matched')).toBe('matched')
  })

  it('returns matched when venue is assigned but venueName is missing', () => {
    expect(derivePoolDisplayStatus('matched', 'assigned', null, 'matched')).toBe('matched')
  })

  it('returns venue_unlocked when matchStatus is matched, venue assigned, and venueName exists', () => {
    expect(derivePoolDisplayStatus('matched', 'assigned', '测试餐厅', 'matched')).toBe('venue_unlocked')
    expect(derivePoolDisplayStatus('matched', 'manual_override', '测试餐厅', 'matched')).toBe('venue_unlocked')
  })

  it('returns cancelled when pool is cancelled regardless of match or venue state', () => {
    expect(derivePoolDisplayStatus('pending', null, null, 'cancelled')).toBe('cancelled')
    expect(derivePoolDisplayStatus('matched', 'assigned', '测试餐厅', 'cancelled')).toBe('cancelled')
  })

  it('returns attended when pool is completed regardless of match or venue state', () => {
    expect(derivePoolDisplayStatus('pending', null, null, 'completed')).toBe('attended')
    expect(derivePoolDisplayStatus('matched', 'assigned', '测试餐厅', 'completed')).toBe('attended')
  })

  it('returns cancelled for unmatched', () => {
    expect(derivePoolDisplayStatus('unmatched', null, null, 'matched')).toBe('cancelled')
  })

  it('returns undefined for unknown matchStatus', () => {
    expect(derivePoolDisplayStatus('unknown', null, null, 'active')).toBeUndefined()
  })
})

describe('deriveLegacyDisplayStatus', () => {
  it('maps confirmed attendance to confirmed', () => {
    expect(deriveLegacyDisplayStatus('confirmed', 'upcoming')).toBe('confirmed')
  })

  it('maps pending attendance to registered', () => {
    expect(deriveLegacyDisplayStatus('pending', 'upcoming')).toBe('registered')
  })

  it('maps completed or attended to attended', () => {
    expect(deriveLegacyDisplayStatus('completed', 'upcoming')).toBe('attended')
    expect(deriveLegacyDisplayStatus('attended', 'upcoming')).toBe('attended')
  })

  it('maps cancelled or declined to cancelled', () => {
    expect(deriveLegacyDisplayStatus('cancelled', 'upcoming')).toBe('cancelled')
    expect(deriveLegacyDisplayStatus('declined', 'upcoming')).toBe('declined')
  })

  it('maps no_show to no_show', () => {
    expect(deriveLegacyDisplayStatus('no_show', 'upcoming')).toBe('no_show')
  })

  it('falls back to eventStatus when attendanceStatus is missing', () => {
    expect(deriveLegacyDisplayStatus(null, 'cancelled')).toBe('cancelled')
    expect(deriveLegacyDisplayStatus(undefined, 'upcoming')).toBe('upcoming')
  })

  it('defaults to upcoming for unknown status', () => {
    expect(deriveLegacyDisplayStatus('unknown', 'unknown')).toBe('upcoming')
  })
})
