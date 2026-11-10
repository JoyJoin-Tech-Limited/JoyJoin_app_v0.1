import { describe, expect, it } from 'vitest';
import {
  MIN_REGISTRATION_LEAD_HOURS,
  VENUE_TBD_DECISION_HOURS,
  validatePoolScheduleForVenuePromise,
} from '../lib/poolScheduleRules';

/**
 * The 24h venue promise is only deliverable when registration closes well
 * before the event. These assertions lock the table so the rule cannot silently
 * drift back to "deadline can be an hour before start".
 */

const HOUR = 60 * 60 * 1000;
const EVENT = new Date('2026-12-01T19:00:00+08:00');

function deadlineBefore(hours: number): Date {
  return new Date(EVENT.getTime() - hours * HOUR);
}

describe('pool schedule rules — 24h venue promise', () => {
  it('keeps the promise window at 24h with a 26h registration lead', () => {
    expect(VENUE_TBD_DECISION_HOURS).toBe(24);
    expect(MIN_REGISTRATION_LEAD_HOURS).toBe(26);
  });

  it('accepts a deadline at or before event − 26h', () => {
    expect(validatePoolScheduleForVenuePromise(EVENT, deadlineBefore(26))).toBeNull();
    expect(validatePoolScheduleForVenuePromise(EVENT, deadlineBefore(72))).toBeNull();
  });

  it('rejects a deadline inside the venue promise window', () => {
    expect(validatePoolScheduleForVenuePromise(EVENT, deadlineBefore(25))).toContain('26 小时');
    expect(validatePoolScheduleForVenuePromise(EVENT, deadlineBefore(2))).toContain('26 小时');
  });

  it('still rejects a deadline at or after the event start', () => {
    expect(validatePoolScheduleForVenuePromise(EVENT, EVENT)).toBe('活动时间必须晚于报名截止时间');
    expect(validatePoolScheduleForVenuePromise(EVENT, deadlineBefore(-1))).toBe('活动时间必须晚于报名截止时间');
  });
});
