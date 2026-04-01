import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockState,
  eventPoolsTable,
  eventPoolRegistrationsTable,
  eventPoolGroupsTable,
  eventsTable,
  eventAttendanceTable,
  usersTable,
  userInterestsTable,
  invitationUsesTable,
  invitationsTable,
  couponsTable,
  userCouponsTable,
} = vi.hoisted(() => ({
  mockState: {
    userInterestsByUserId: new Map<string, any>(),
    updateSetCalls: [] as any[],
    updateReturningQueue: [] as any[],
    updateWhereQueue: [] as any[],
    poolRow: { id: 'pool-1', title: 'Test Pool', eventType: '饭局', city: '上海', district: '徐汇', dateTime: new Date(), createdBy: 'host-1' } as any | null,
    throwCouponsSelect: false,
    transactionImpl: vi.fn(),
  },
  eventPoolsTable: Symbol('eventPools'),
  eventPoolRegistrationsTable: Symbol('eventPoolRegistrations'),
  eventPoolGroupsTable: Symbol('eventPoolGroups'),
  eventsTable: Symbol('events'),
  eventAttendanceTable: Symbol('eventAttendance'),
  usersTable: Symbol('users'),
  userInterestsTable: Symbol('userInterests'),
  invitationUsesTable: Symbol('invitationUses'),
  invitationsTable: Symbol('invitations'),
  couponsTable: Symbol('coupons'),
  userCouponsTable: Symbol('userCoupons'),
}));

vi.mock('@shared/schema', () => ({
  eventPools: eventPoolsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  eventPoolGroups: eventPoolGroupsTable,
  events: eventsTable,
  eventAttendance: eventAttendanceTable,
  users: usersTable,
  userInterests: userInterestsTable,
  invitationUses: invitationUsesTable,
  invitations: invitationsTable,
  coupons: couponsTable,
  userCoupons: userCouponsTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
  inArray: (_field: unknown, values: unknown[]) => ({ type: 'inArray', values }),
}));

function makeAwaitable(value: unknown) {
  return {
    limit: () => Promise.resolve(value),
    returning: () => Promise.resolve(value),
    then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: any) => {
          if (table === eventPoolsTable) {
            return makeAwaitable(mockState.poolRow ? [mockState.poolRow] : []);
          }
          if (table === userInterestsTable) {
            if (condition?.type === 'inArray') {
              const rows = (condition.values as string[])
                .map((userId) => mockState.userInterestsByUserId.get(userId))
                .filter(Boolean);
              return makeAwaitable(rows);
            }
            const row = mockState.userInterestsByUserId.get(condition?.value);
            return {
              limit: () => Promise.resolve(row ? [row] : []),
              then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(row ? [row] : []).then(resolve, reject),
            };
          }
          if (table === couponsTable && mockState.throwCouponsSelect) {
            throw new Error('coupon lookup failed');
          }
          return makeAwaitable([]);
        },
      }),
    }),
    update: (_table: unknown) => ({
      set: (values: any) => {
        mockState.updateSetCalls.push(values);
        return {
          where: () => {
            const returningValue = mockState.updateReturningQueue.shift();
            const whereValue = mockState.updateWhereQueue.shift() ?? [];
            return {
              returning: () => Promise.resolve(returningValue ?? []),
              then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
                Promise.resolve(whereValue).then(resolve, reject),
            };
          },
        };
      },
    }),
    transaction: (...args: any[]) => mockState.transactionImpl(...args),
  },
}));

vi.mock('../wsService', () => ({
  wsService: { broadcastToUser: vi.fn() },
}));
vi.mock('../venueAssignmentService', () => ({
  assignVenuesToGroups: vi.fn(),
  saveVenueAssignments: vi.fn(),
}));
vi.mock('../eventThemeGeneratorService', () => ({
  generateAndSaveEventTheme: vi.fn(),
}));
vi.mock('../services/eventThemeTitleGenerator', () => ({
  generateEventThemeTitle: vi.fn().mockResolvedValue({
    eventThemeTitle: null,
    themeTagline: null,
    emoji: null,
    reasoning: null,
  }),
}));
vi.mock('../archetypeChemistry', () => ({
  chemistryMatrix: { '暖心熊': { '暖心熊': 90 } },
  ARCHETYPE_ENERGY: { '暖心熊': 60 },
}));

const { calculateInterestScoreAsync, preloadUserInterests, saveMatchResults } = await import('../poolMatchingService');

describe('poolMatchingService', () => {
  beforeEach(() => {
    mockState.userInterestsByUserId = new Map([
      ['u1', { userId: 'u1', selections: [{ topicId: 't1', heat: 25 }, { topicId: 't2', heat: 10 }] }],
      ['u2', { userId: 'u2', selections: [{ topicId: 't1', heat: 25 }, { topicId: 't3', heat: 10 }] }],
    ]);
    mockState.updateSetCalls.length = 0;
    mockState.updateReturningQueue.length = 0;
    mockState.updateWhereQueue.length = 0;
    mockState.poolRow = { id: 'pool-1', title: 'Test Pool', eventType: '饭局', city: '上海', district: '徐汇', dateTime: new Date(), createdBy: 'host-1' };
    mockState.throwCouponsSelect = false;
    mockState.transactionImpl.mockReset();
  });

  it('returns the same interest score with preloaded cache as without cache', async () => {
    const uncached = await calculateInterestScoreAsync('u1', 'u2');
    const cache = await preloadUserInterests(['u1', 'u2']);
    const cached = await calculateInterestScoreAsync('u1', 'u2', cache);

    expect(cached).toBe(uncached);
  });

  it('rejects duplicate/concurrent saveMatchResults runs when the pool guard is already held', async () => {
    mockState.updateReturningQueue.push([]); // guard CAS updated 0 rows

    await expect(saveMatchResults('pool-1', [])).rejects.toThrow(/Guard rejected/);
    expect(mockState.transactionImpl).not.toHaveBeenCalled();
  });

  it('throws a clear not-found error before attempting the pool guard', async () => {
    mockState.poolRow = null;

    await expect(saveMatchResults('missing-pool', [])).rejects.toThrow(/Pool not found/);
    expect(mockState.updateSetCalls).toHaveLength(0);
    expect(mockState.transactionImpl).not.toHaveBeenCalled();
  });

  it('resets the pool status back to active when the transactional match save fails', async () => {
    mockState.updateReturningQueue.push([{ id: 'pool-1' }]); // guard acquisition
    mockState.updateWhereQueue.push([]); // reset status update
    mockState.transactionImpl.mockRejectedValueOnce(new Error('tx failed'));

    await expect(saveMatchResults('pool-1', [])).rejects.toThrow('tx failed');

    expect(mockState.updateSetCalls[0]).toMatchObject({ status: 'matching' });
    expect(mockState.updateSetCalls[1]).toMatchObject({ status: 'active' });
  });

  it('keeps match persistence successful when invitation reward processing fails', async () => {
    mockState.updateReturningQueue.push([{ id: 'pool-1' }]); // guard acquisition
    mockState.throwCouponsSelect = true;
    mockState.transactionImpl.mockResolvedValueOnce(undefined);

    await expect(saveMatchResults('pool-1', [])).resolves.toBeUndefined();

    expect(mockState.updateSetCalls[0]).toMatchObject({ status: 'matching' });
  });
});
