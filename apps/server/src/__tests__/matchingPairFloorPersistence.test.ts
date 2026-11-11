/**
 * D3 AC-8 — durable per-group cohort attribution.
 *
 * Every newly persisted group writes its already-computed `avg_pair_score`, its
 * at-commit `formed_member_count`, and an explicit `pair_floor_policy`. The
 * policy is never left undefined: a committed group with no resolved floor is
 * `legacy` (the prospective baseline), so a later flag-on cohort can be compared
 * against real data instead of log archaeology.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  state,
  eventPoolsTable,
  eventPoolGroupsTable,
  eventPoolRegistrationsTable,
  eventsTable,
  eventAttendanceTable,
  blindBoxEventsTable,
} = vi.hoisted(() => ({
  state: {
    poolRow: {
      id: 'pool-1',
      title: 'Test Pool',
      eventType: '饭局',
      city: '上海',
      district: '徐汇',
      dateTime: new Date('2026-12-01T11:00:00Z'),
      createdBy: 'host-1',
    } as any,
    inserts: [] as Array<{ table: unknown; values: any }>,
    groupIds: 0,
  },
  eventPoolsTable: Symbol('eventPools'),
  eventPoolGroupsTable: Symbol('eventPoolGroups'),
  eventPoolRegistrationsTable: Symbol('eventPoolRegistrations'),
  eventsTable: Symbol('events'),
  eventAttendanceTable: Symbol('eventAttendance'),
  blindBoxEventsTable: Symbol('blindBoxEvents'),
}));

vi.mock('@shared/schema', () => ({
  eventPools: eventPoolsTable,
  eventPoolGroups: eventPoolGroupsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  events: eventsTable,
  eventAttendance: eventAttendanceTable,
  blindBoxEvents: blindBoxEventsTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: 'inArray', values }),
  isNull: (_field: unknown) => ({ type: 'isNull' }),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: vi.fn().mockResolvedValue(false),
}));

vi.mock('../services/eventThemeTitleGenerator', () => ({
  generateEventThemeTitle: vi.fn().mockResolvedValue({
    eventThemeTitle: null,
    themeTagline: null,
    emoji: null,
    reasoning: null,
  }),
}));

vi.mock('../lib/matchingPostMatchEffects', () => ({
  executePostMatchCommitSideEffects: vi.fn().mockResolvedValue(undefined),
}));

const recordInsert = (table: unknown, values: any) => {
  state.inserts.push({ table, values });
  const id =
    table === eventPoolGroupsTable
      ? `group-${++state.groupIds}`
      : `row-${state.inserts.length}`;
  return { returning: () => Promise.resolve([{ id }]) };
};

vi.mock('../db', () => {
  const tx = {
    insert: (table: unknown) => ({ values: (values: any) => recordInsert(table, values) }),
    update: () => ({
      set: () => ({ where: () => Promise.resolve(undefined) }),
    }),
  };

  return {
    db: {
      select: () => ({
        from: (table: unknown) => ({
          where: () =>
            Promise.resolve(table === eventPoolsTable ? [state.poolRow] : []),
        }),
      }),
      // Execution guard: the pool CAS succeeds (returns the pool id).
      update: () => ({
        set: () => ({
          where: () => ({
            returning: () => Promise.resolve([{ id: 'pool-1' }]),
          }),
        }),
      }),
      transaction: async (callback: (tx: unknown) => unknown) => callback(tx),
    },
  };
});

const { saveMatchResults } = await import('../matching/matchPersistence');

function member(userId: string) {
  return {
    userId,
    registrationId: `reg-${userId}`,
    archetype: 'corgi',
    gender: 'male',
    industryNiche: 'tech',
  } as any;
}

function makeGroup(overrides: Record<string, unknown> = {}): any {
  return {
    members: [member('u1'), member('u2'), member('u3'), member('u4'), member('u5'), member('u6')],
    avgPairScore: 47,
    avgChemistryScore: 78,
    diversityScore: 62,
    communicationBalance: 71,
    overallScore: 66,
    temperatureLevel: 'mild',
    explanation: 'test group',
    ...overrides,
  };
}

function groupInserts() {
  return state.inserts
    .filter((row) => row.table === eventPoolGroupsTable)
    .map((row) => row.values);
}

describe('saveMatchResults — D3 pair-floor cohort columns', () => {
  beforeEach(() => {
    state.inserts = [];
    state.groupIds = 0;
  });

  it('persists avg_pair_score, formed_member_count, and the group policy', async () => {
    await saveMatchResults('pool-1', [
      makeGroup({ pairFloorPolicy: 'curve_v1' }),
    ]);

    const [values] = groupInserts();
    expect(values).toBeDefined();
    expect(values.avgPairScore).toBe(47);
    expect(values.formedMemberCount).toBe(6);
    expect(values.memberCount).toBe(6);
    expect(values.pairFloorPolicy).toBe('curve_v1');
  });

  it('falls back to the run-level policy when the group carries none', async () => {
    await saveMatchResults('pool-1', [makeGroup()], {
      predictiveExperimentArm: null,
      predictiveRerankApplied: false,
      predictiveRerankSummary: {},
      pairFloorPolicy: 'curve_v1',
    });

    const [values] = groupInserts();
    expect(values.pairFloorPolicy).toBe('curve_v1');
  });

  it('marks every group legacy by default (prospective baseline, never undefined)', async () => {
    // Two groups, one with a flag-off shape and one carrying an undefined policy
    // key — both must persist an explicit `legacy`, never NULL/undefined.
    await saveMatchResults('pool-1', [
      makeGroup(),
      makeGroup({ pairFloorPolicy: undefined, avgPairScore: 52, members: [member('a'), member('b'), member('c'), member('d')] }),
    ]);

    const rows = groupInserts();
    expect(rows).toHaveLength(2);
    expect(rows.every((row) => row.pairFloorPolicy === 'legacy')).toBe(true);
    // formed_member_count is the at-commit size, per group, not the pool total.
    expect(rows[0].formedMemberCount).toBe(6);
    expect(rows[1].formedMemberCount).toBe(4);
    // The already-computed pair score is persisted as-is (history stays readable).
    expect(rows[1].avgPairScore).toBe(52);
  });
});
