import { describe, expect, it } from 'vitest'
import {
  derivePoolDisplayStatus,
  deriveLegacyDisplayStatus,
  isPoolFeedbackPending,
  isLegacyFeedbackPending,
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

  it('returns attended for a completed registration even if the pool status lags', () => {
    expect(derivePoolDisplayStatus('completed', null, null, 'matched')).toBe('attended')
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

// feedbackPending predicates (2026-10-16 feedback activation, plan D8) — the
// footprint 去评价 pill. Eligibility + the +3h window mirror
// lib/feedbackStateResolver (D5/D1); the resolver remains the authority for
// the detail page and POST gate.
const EVENT_TIME = new Date('2026-10-15T11:30:00.000Z')
const THREE_HOURS_MS = 3 * 60 * 60 * 1000
const AFTER_OPEN = EVENT_TIME.getTime() + THREE_HOURS_MS + 60_000
const BEFORE_OPEN = EVENT_TIME.getTime() + THREE_HOURS_MS - 60_000

describe('isPoolFeedbackPending', () => {
  const base = {
    matchStatus: 'matched',
    poolStatus: 'matched',
    dateTime: EVENT_TIME,
    hasCanonicalEventId: true,
    hasSubmittedFeedback: false,
  }

  it('is true for a matched registration past the +3h window with no feedback', () => {
    expect(isPoolFeedbackPending({ ...base, nowMs: AFTER_OPEN })).toBe(true)
  })

  it('is true for a completed registration (post-sweep status)', () => {
    expect(isPoolFeedbackPending({ ...base, matchStatus: 'completed', poolStatus: 'completed', nowMs: AFTER_OPEN })).toBe(true)
  })

  it('is false before the window opens', () => {
    expect(isPoolFeedbackPending({ ...base, nowMs: BEFORE_OPEN })).toBe(false)
  })

  it('is false once feedback exists (pill disappears after submission)', () => {
    expect(isPoolFeedbackPending({ ...base, hasSubmittedFeedback: true, nowMs: AFTER_OPEN })).toBe(false)
  })

  it('is false for pending/unmatched registrations (未成行)', () => {
    expect(isPoolFeedbackPending({ ...base, matchStatus: 'pending', nowMs: AFTER_OPEN })).toBe(false)
    expect(isPoolFeedbackPending({ ...base, matchStatus: 'unmatched', nowMs: AFTER_OPEN })).toBe(false)
  })

  it('is false for cancelled or archived pools', () => {
    expect(isPoolFeedbackPending({ ...base, poolStatus: 'cancelled', nowMs: AFTER_OPEN })).toBe(false)
    expect(isPoolFeedbackPending({ ...base, poolStatus: 'archived', nowMs: AFTER_OPEN })).toBe(false)
  })

  it('is false without a canonical event id (no group projection to attach feedback to)', () => {
    expect(isPoolFeedbackPending({ ...base, hasCanonicalEventId: false, nowMs: AFTER_OPEN })).toBe(false)
  })

  it('is false when the pool has no dateTime', () => {
    expect(isPoolFeedbackPending({ ...base, dateTime: null, nowMs: AFTER_OPEN })).toBe(false)
  })
})

describe('isLegacyFeedbackPending', () => {
  const base = {
    attendanceStatus: 'confirmed',
    eventStatus: 'upcoming',
    dateTime: EVENT_TIME,
    hasSubmittedFeedback: false,
  }

  it('is true for a non-cancelled legacy event past the window', () => {
    expect(isLegacyFeedbackPending({ ...base, nowMs: AFTER_OPEN })).toBe(true)
  })

  it('is false before the window opens', () => {
    expect(isLegacyFeedbackPending({ ...base, nowMs: BEFORE_OPEN })).toBe(false)
  })

  it('is false for cancelled attendance or a cancelled event', () => {
    expect(isLegacyFeedbackPending({ ...base, attendanceStatus: 'cancelled', nowMs: AFTER_OPEN })).toBe(false)
    expect(isLegacyFeedbackPending({ ...base, eventStatus: 'cancelled', nowMs: AFTER_OPEN })).toBe(false)
  })

  it('is false once feedback exists', () => {
    expect(isLegacyFeedbackPending({ ...base, hasSubmittedFeedback: true, nowMs: AFTER_OPEN })).toBe(false)
  })
})
