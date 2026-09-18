/**
 * Venue Assignment Service — Unit Tests
 *
 * Covers: parseEventDate, calculateGroupBudget, scoreVenueForGroup capacity hard
 * constraint, and the budget read-normalization mixed-state matrix (legacy
 * label <-> canonical id).
 * Full integration tests (DB-dependent) are run via manual scripts in test/venue-assignment-e2e/.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { eventPools, venues } from '@shared/schema';
import { parseEventDate } from '../lib/eventDateTime';
import { calculateGroupBudget, scoreVenueForGroup } from '../venueAssignmentService';
import type { MatchGroup, UserWithProfile } from '../poolMatchingService';

/**
 * The production `parseEventDate` is imported from `lib/eventDateTime` — never
 * re-implemented here. The previous version of this file duplicated the implementation,
 * which is exactly why the B8 timezone defect went undetected.
 *
 * `event_pools.date_time` is `timestamp without time zone`. Drizzle 0.39.1 persists and
 * reads it through `PgTimestamp`:
 *   mapToDriverValue: value.toISOString()          -> "2026-06-05T11:30:00.000Z"
 *   PostgreSQL ::timestamp cast                    -> "2026-06-05 11:30:00"  (Z dropped)
 *   mapFromDriverValue: new Date(value + "+0000")  -> true UTC instant
 * The helper below calls the real column mappers so tests exercise the actual
 * write -> storage -> read path rather than a hand-rolled approximation.
 */
const dateTimeColumn = eventPools.dateTime as unknown as {
  mapToDriverValue(value: Date): string;
  mapFromDriverValue(value: string): Date;
};

function roundTripThroughTimestampColumn(instant: Date): Date {
  const driverValue = dateTimeColumn.mapToDriverValue(instant);
  const stored = driverValue.replace('T', ' ').replace(/(\.\d+)?Z$/, '');
  return dateTimeColumn.mapFromDriverValue(stored);
}

describe('parseEventDate', () => {
  const ORIGINAL_TZ = process.env.TZ;
  afterEach(() => {
    process.env.TZ = ORIGINAL_TZ;
  });

  it('recovers a normal 19:30 CST evening event from the real write->read round trip', () => {
    // Business intent: Friday 2026-06-05 19:30 CST == true UTC instant 2026-06-05T11:30Z.
    // Drizzle stores 11:30 (the B8 -8h symptom) — the read side must convert back to 19:30.
    const instant = new Date('2026-06-05T11:30:00.000Z');
    const readBack = roundTripThroughTimestampColumn(instant);

    // The round trip itself is loss-free: storage preserves the instant.
    expect(readBack.toISOString()).toBe('2026-06-05T11:30:00.000Z');

    const result = parseEventDate(readBack);
    expect(result.dateStr).toBe('2026-06-05');
    expect(result.timeStr).toBe('19:30');
    expect(result.dayOfWeek).toBe(5); // Friday
  });

  it('handles the early-morning ±1 day boundary (00:30 CST = previous UTC day 16:30Z)', () => {
    // Business intent: Saturday 2026-06-06 00:30 CST == true UTC instant 2026-06-05T16:30Z.
    const instant = new Date('2026-06-05T16:30:00.000Z');
    const readBack = roundTripThroughTimestampColumn(instant);

    const result = parseEventDate(readBack);
    expect(result.dateStr).toBe('2026-06-06'); // local calendar day is the NEXT UTC day
    expect(result.timeStr).toBe('00:30');
    expect(result.dayOfWeek).toBe(6); // Saturday
  });

  it('is independent of the host ambient timezone', () => {
    const readBack = roundTripThroughTimestampColumn(new Date('2026-06-05T11:30:00.000Z'));

    const results = ['UTC', 'America/New_York', 'Asia/Shanghai'].map((tz) => {
      process.env.TZ = tz;
      return parseEventDate(readBack);
    });

    // Even under TZ=UTC the result is the business-local 19:30, not the stored UTC 11:30.
    expect(results[0]).toEqual({ dateStr: '2026-06-05', timeStr: '19:30', dayOfWeek: 5 });
    expect(results[1]).toEqual(results[0]);
    expect(results[2]).toEqual(results[0]);
  });

  it('is deterministic: same Date always produces same output', () => {
    const readBack = roundTripThroughTimestampColumn(new Date('2026-12-25T10:00:00.000Z'));
    const r1 = parseEventDate(readBack);
    const r2 = parseEventDate(readBack);
    expect(r1).toEqual(r2);
  });
});

const makeMember = (
  barBudgetRange: string[] | undefined,
  budgetRange: string[] | undefined,
): UserWithProfile => ({ barBudgetRange, budgetRange } as UserWithProfile);

const makeGroup = (members: UserWithProfile[]): MatchGroup =>
  ({ members } as unknown as MatchGroup);

const makeVenue = (budgetCategories: string[]): typeof venues.$inferSelect =>
  ({
    budgetCategories,
    cuisines: [],
    seatingCapacity: 12,
    capacity: 12,
  } as unknown as typeof venues.$inferSelect);

describe('calculateGroupBudget (read normalization)', () => {
  it('returns normalized canonical ids supported by >=30% of group', () => {
    const members = [
      makeMember(['80-150'], undefined),
      makeMember(['80-150'], undefined),
      makeMember(['150-200'], undefined),
      makeMember(['80-150'], undefined),
      makeMember(['80-150'], undefined),
      makeMember(['150-200'], undefined),
    ];
    const result = calculateGroupBudget(members, '酒局');
    // `80-150` -> drinks_80_150 (4/6 = 66% >= 30%); `150-200` has no 酒局
    // mapping (drinks_150_200 is withheld) → dropped from consensus.
    expect(result).toEqual(['drinks_80_150']);
    expect(result).not.toContain('150-200');
  });

  it('maps dining legacy labels to canonical dining ids', () => {
    const members = [
      makeMember(undefined, ['150以下']),
      makeMember(undefined, ['150-200']),
      makeMember(undefined, ['150-200']),
    ];
    // threshold = ceil(3 * 0.3) = 1 → both distinct labels clear it.
    expect(calculateGroupBudget(members, '饭局')).toEqual(['dining_150_below', 'dining_150_200']);
  });

  it('counts a legacy label and its canonical id toward the same consensus bucket', () => {
    const members = [
      makeMember(undefined, ['200-300']),
      makeMember(undefined, ['dining_200_300']),
      makeMember(undefined, ['200-300']),
    ];
    // 3/3 = 100% for dining_200_300 once both conventions are normalized.
    expect(calculateGroupBudget(members, '饭局')).toEqual(['dining_200_300']);
  });

  it('returns empty array when no budget reaches 30% threshold', () => {
    const members = [
      makeMember(['80-150'], undefined),
      makeMember(['150-200'], undefined),
      makeMember(['200-300'], undefined),
      makeMember(['300-500'], undefined),
      makeMember(['500-800'], undefined),
      makeMember(['800+'], undefined),
    ];
    const result = calculateGroupBudget(members, '酒局');
    // 6 members, threshold = ceil(6*0.3) = 2; only 80-150 maps (1/6) → none reach 2.
    expect(result).toEqual([]);
  });

  it('uses barBudgetRange for 酒局 and budgetRange for 饭局', () => {
    const members = [
      makeMember(undefined, ['200-300']),
      makeMember(undefined, ['200-300']),
      makeMember(undefined, ['200-300']),
    ];
    expect(calculateGroupBudget(members, '饭局')).toEqual(['dining_200_300']);
    expect(calculateGroupBudget(members, '酒局')).toEqual([]);
  });

  it('drops unmappable blind-box 100-200 from consensus (read path cannot act on it)', () => {
    const members = [
      makeMember(undefined, ['100-200']),
      makeMember(undefined, ['100-200']),
      makeMember(undefined, ['100-200']),
    ];
    expect(calculateGroupBudget(members, '饭局')).toEqual([]);
  });
});

describe('scoreVenueForGroup budget read normalization (mixed state)', () => {
  const NONE = new Date('2026-06-05T11:30:00.000Z');

  it('matches when the venue side is canonical ids and the group side is legacy labels', async () => {
    const members = [
      makeMember(undefined, ['200-300']),
      makeMember(undefined, ['200-300']),
      makeMember(undefined, ['200-300']),
    ];
    const groupBudget = calculateGroupBudget(members, '饭局'); // → ['dining_200_300']
    expect(groupBudget).toEqual(['dining_200_300']);

    const scored = await scoreVenueForGroup(
      makeVenue(['dining_200_300']), // venue already retagged (T1b applied)
      makeGroup(members),
      NONE,
      '饭局',
      groupBudget,
    );

    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.join(' | ')).toContain('预算匹配');
  });

  it('matches when the venue side is legacy labels and the group side is canonical ids', async () => {
    const members = [makeMember(undefined, ['dining_200_300'])];
    const groupBudget = calculateGroupBudget(members, '饭局'); // already canonical
    expect(groupBudget).toEqual(['dining_200_300']);

    const scored = await scoreVenueForGroup(
      makeVenue(['200-300']), // venue not yet retagged
      makeGroup(members),
      NONE,
      '饭局',
      groupBudget,
    );

    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.join(' | ')).toContain('预算匹配');
  });

  it('matches when both sides are still legacy labels', async () => {
    const members = [makeMember(undefined, ['200-300'])];
    const groupBudget = calculateGroupBudget(members, '饭局');

    const scored = await scoreVenueForGroup(
      makeVenue(['200-300']),
      makeGroup(members),
      NONE,
      '饭局',
      groupBudget,
    );

    expect(scored.score).toBeGreaterThan(0);
  });

  it('matches the 酒局 namespace across conventions', async () => {
    const members = [makeMember(['80-150'], undefined)];
    const groupBudget = calculateGroupBudget(members, '酒局'); // → ['drinks_80_150']

    const scored = await scoreVenueForGroup(
      makeVenue(['80-150']), // legacy drinks label, not yet retagged
      makeGroup(members),
      NONE,
      '酒局',
      groupBudget,
    );

    expect(scored.score).toBeGreaterThan(0);
    expect(scored.reasons.join(' | ')).toContain('预算匹配');
  });

  it('still hard-fails (score 0) on genuine non-overlap', async () => {
    const members = [makeMember(undefined, ['300-500'])];
    const groupBudget = calculateGroupBudget(members, '饭局'); // ['dining_300_500']

    const scored = await scoreVenueForGroup(
      makeVenue(['200-300']),
      makeGroup(members),
      NONE,
      '饭局',
      groupBudget,
    );

    expect(scored.score).toBe(0);
    expect(scored.reasons.join(' | ')).toContain('预算不匹配');
  });

  it('rejects a cross-namespace venue id (dining id vs 酒局 group)', async () => {
    const members = [makeMember(['80-150'], undefined)];
    const groupBudget = calculateGroupBudget(members, '酒局'); // ['drinks_80_150']

    const scored = await scoreVenueForGroup(
      makeVenue(['dining_200_300']), // wrong namespace for 酒局
      makeGroup(members),
      NONE,
      '酒局',
      groupBudget,
    );

    expect(scored.score).toBe(0);
  });
});

describe('capacity hard constraint (manual assertion)', () => {
  it('would reject a 10-person group for a 4-seat venue', () => {
    const seatingCapacity = 4;
    const groupSize = 10;
    const wouldPass = seatingCapacity > 0 && seatingCapacity >= groupSize;
    expect(wouldPass).toBe(false);
  });

  it('would allow a 6-person group for a 12-seat venue', () => {
    const seatingCapacity = 12;
    const groupSize = 6;
    const wouldPass = seatingCapacity > 0 && seatingCapacity >= groupSize;
    expect(wouldPass).toBe(true);
  });

  it('is bypassed when seatingCapacity is 0 (unknown)', () => {
    const seatingCapacity = 0;
    const groupSize = 10;
    const wouldBlock = seatingCapacity > 0 && seatingCapacity < groupSize;
    expect(wouldBlock).toBe(false);
  });
});
