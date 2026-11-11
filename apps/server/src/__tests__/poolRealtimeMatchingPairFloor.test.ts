/**
 * D3 AC-9/AC-10 — the scan is the only place that resolves the pair floor.
 *
 * Flag OFF (or a non-target pool in `pilot` scope) must pass an explicit `null`
 * into `matchEventPool` and log `pair_floor: null`; failure to distinguish
 * "undefined" from "null" would let `matchEventPool` re-resolve the floor and
 * silently enable the curve for pools the rollout never exposed.
 *
 * One `getFeatureFlag('pairFloorCurveEnabled')` resolution per scan is locked
 * too — the resolve happens once, before the formation call.
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  state,
  mockMatchEventPool,
  mockSaveMatchResults,
  mockGetFeatureFlag,
  mockGetMatchingThresholdConfig,
  mockFillBotsForTesting,
  eventPoolsTable,
  eventPoolRegistrationsTable,
  matchingThresholdsTable,
  poolMatchingLogsTable,
} = vi.hoisted(() => ({
  state: {
    poolRows: [] as any[],
    registrationRows: [] as any[],
    logInserts: [] as any[],
  },
  mockMatchEventPool: vi.fn(),
  mockSaveMatchResults: vi.fn(),
  mockGetFeatureFlag: vi.fn(),
  mockGetMatchingThresholdConfig: vi.fn(),
  mockFillBotsForTesting: vi.fn(),
  eventPoolsTable: Symbol('eventPools'),
  eventPoolRegistrationsTable: Symbol('eventPoolRegistrations'),
  matchingThresholdsTable: Symbol('matchingThresholds'),
  poolMatchingLogsTable: Symbol('poolMatchingLogs'),
}));

vi.mock('@shared/schema', () => ({
  eventPools: eventPoolsTable,
  eventPoolRegistrations: eventPoolRegistrationsTable,
  matchingThresholds: matchingThresholdsTable,
  poolMatchingLogs: poolMatchingLogsTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
}));

vi.mock('../db', () => {
  const insert = (table: unknown) => ({
    values: async (values: any) => {
      if (table === poolMatchingLogsTable) state.logInserts.push(values);
    },
  });
  const dbMock: any = {
    select: () => ({
      from: (table: unknown) => ({
        where: () =>
          Promise.resolve(table === eventPoolRegistrationsTable ? state.registrationRows : []),
      }),
    }),
    query: {
      eventPools: {
        findFirst: () => Promise.resolve(state.poolRows[0] ?? null),
      },
    },
    insert,
    update: () => ({ set: () => ({ where: async () => undefined }) }),
  };
  dbMock.transaction = async (callback: (tx: unknown) => unknown) => callback({ insert });
  return { db: dbMock };
});

vi.mock('../poolMatchingService', () => ({
  matchEventPool: mockMatchEventPool,
  saveMatchResults: mockSaveMatchResults,
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../lib/featureFlags', () => ({
  getFeatureFlag: mockGetFeatureFlag,
}));

vi.mock('../lib/matchingThresholds', () => ({
  getMatchingThresholdConfig: mockGetMatchingThresholdConfig,
}));

vi.mock('../lib/wecomNotifications', () => ({
  notifyLowRegistration: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../repositories/matchingShadowExperimentsRepo', () => ({
  countMatchingShadowExperimentPools: vi.fn().mockResolvedValue(0),
  getOutcomeCalibrationSnapshot: vi.fn().mockResolvedValue({}),
  getPredictiveRerankOutcomeMetrics: vi.fn().mockResolvedValue([]),
}));

vi.mock('../predictiveRerankingService', () => ({
  getPredictiveRerankAutoDisableReason: vi.fn().mockReturnValue(null),
  planPredictiveRerank: vi.fn(),
}));

vi.mock('../services/botFillService', () => ({
  fillBotsForTesting: mockFillBotsForTesting,
}));

const { scanPoolAndMatch } = await import('../poolRealtimeMatchingService');
import {
  PAIR_FLOOR_CURVE_FLAG,
  PAIR_FLOOR_PILOT_POOL_ENV,
  PAIR_FLOOR_ROLLOUT_SCOPE_ENV,
} from '../lib/pairFloorRollout';

const HOURS_24_MS = 24 * 60 * 60 * 1000;

function makePendingRegistrations(count = 6) {
  return Array.from({ length: count }, (_, i) => ({
    id: `reg-${i}`,
    poolId: 'pool-1',
    userId: `user-${i}`,
    matchStatus: 'pending',
  }));
}

describe('scanPoolAndMatch — D3 pair-floor resolution', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV];
    delete process.env[PAIR_FLOOR_PILOT_POOL_ENV];

    state.poolRows = [
      {
        id: 'pool-1',
        title: 'Test Pool',
        status: 'active',
        dateTime: new Date(Date.now() + HOURS_24_MS),
        minGroupSize: 4,
        targetGroups: 1,
        maxGroupSize: 6,
        predictiveRerankEnabledOverride: null,
      },
    ];
    state.registrationRows = makePendingRegistrations();
    state.logInserts = [];

    mockMatchEventPool.mockResolvedValue([]);
    mockSaveMatchResults.mockResolvedValue(undefined);
    mockFillBotsForTesting.mockResolvedValue({ filledCount: 0, botUserIds: [] });
    mockGetMatchingThresholdConfig.mockResolvedValue({
      id: 'threshold-1',
      isActive: true,
      highCompatibilityThreshold: 85,
      mediumCompatibilityThreshold: 70,
      lowCompatibilityThreshold: 55,
      timeDecayEnabled: true,
      timeDecayRate: 5,
      minThresholdAfterDecay: 50,
      minGroupSizeForMatch: 4,
      optimalGroupSize: 6,
      predictiveRerankEnabled: false,
      predictiveRerankExposurePercent: 50,
      predictiveRerankMaxPositionShift: 2,
      predictiveRerankConfidenceThreshold: 70,
      predictiveRerankAutoDisableEnabled: true,
      predictiveRerankMinShadowExperiments: 10,
      predictiveRerankAutoDisabledAt: null,
      predictiveRerankAutoDisabledReason: null,
    });
    // `getFeatureFlag(key, default)` — default OFF for every flag.
    mockGetFeatureFlag.mockImplementation((_key: string, defaultValue: boolean) =>
      Promise.resolve(defaultValue),
    );
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('passes an explicit null when the master flag is off', async () => {
    await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

    expect(mockMatchEventPool).toHaveBeenCalledTimes(1);
    expect(mockMatchEventPool.mock.calls[0]).toEqual(['pool-1', null]);
    const lastLog = state.logInserts.at(-1);
    expect(lastLog).toMatchObject({ pairFloor: null, poolId: 'pool-1' });
  });

  it('passes the resolved curve number for the allowlisted pilot pool', async () => {
    mockGetFeatureFlag.mockImplementation((key: string, defaultValue: boolean) =>
      Promise.resolve(key === PAIR_FLOOR_CURVE_FLAG ? true : defaultValue),
    );
    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = 'pilot';
    process.env[PAIR_FLOOR_PILOT_POOL_ENV] = 'pool-1';

    await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

    // ~24h out → group threshold 55 → pair floor 42 → clamped to 45.
    expect(mockMatchEventPool.mock.calls[0]).toEqual(['pool-1', 45]);
    expect(state.logInserts.at(-1)).toMatchObject({ pairFloor: 45 });

    // AC-10: exactly one resolver call per scan.
    const curveFlagCalls = mockGetFeatureFlag.mock.calls.filter(
      ([key]) => key === PAIR_FLOOR_CURVE_FLAG,
    );
    expect(curveFlagCalls).toHaveLength(1);
  });

  it('stays legacy for a non-target pool in pilot scope', async () => {
    mockGetFeatureFlag.mockImplementation((key: string, defaultValue: boolean) =>
      Promise.resolve(key === PAIR_FLOOR_CURVE_FLAG ? true : defaultValue),
    );
    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = 'pilot';
    process.env[PAIR_FLOOR_PILOT_POOL_ENV] = 'some-other-pool';

    await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

    expect(mockMatchEventPool.mock.calls[0]).toEqual(['pool-1', null]);
    expect(state.logInserts.at(-1)).toMatchObject({ pairFloor: null });
  });

  it('lets the master switch win over global scope', async () => {
    mockGetFeatureFlag.mockImplementation((_key: string, defaultValue: boolean) =>
      Promise.resolve(defaultValue),
    );
    process.env[PAIR_FLOOR_ROLLOUT_SCOPE_ENV] = 'global';

    await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

    expect(mockMatchEventPool.mock.calls[0]).toEqual(['pool-1', null]);
    expect(state.logInserts.at(-1)).toMatchObject({ pairFloor: null });
  });
});
