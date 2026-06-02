import { beforeEach, describe, expect, it, vi } from 'vitest';

// ============================================================
// Mock Infrastructure (vi.hoisted)
// ============================================================
const {
  mockState,
  mockMatchEventPool,
  mockSaveMatchResults,
  mockPlanPredictiveRerank,
  mockGetPredictiveRerankAutoDisableReason,
  mockGetOutcomeCalibrationSnapshot,
  mockCountMatchingShadowExperimentPools,
  mockGetPredictiveRerankOutcomeMetrics,
  eventPoolsTableSym,
  eventPoolRegistrationsTableSym,
  matchingThresholdsTableSym,
  poolMatchingLogsTableSym,
} = vi.hoisted(() => ({
  mockState: {
    poolRows: [] as any[],
    registrationRows: [] as any[],
    thresholdConfigRows: [] as any[],
    logInsertCalls: [] as any[],
    thresholdUpdateCalls: [] as any[],
  },
  mockMatchEventPool: vi.fn(),
  mockSaveMatchResults: vi.fn(),
  mockPlanPredictiveRerank: vi.fn(),
  mockGetPredictiveRerankAutoDisableReason: vi.fn(),
  mockGetOutcomeCalibrationSnapshot: vi.fn(),
  mockCountMatchingShadowExperimentPools: vi.fn(),
  mockGetPredictiveRerankOutcomeMetrics: vi.fn(),
  eventPoolsTableSym: Symbol('eventPools'),
  eventPoolRegistrationsTableSym: Symbol('eventPoolRegistrations'),
  matchingThresholdsTableSym: Symbol('matchingThresholds'),
  poolMatchingLogsTableSym: Symbol('poolMatchingLogs'),
}));

// ============================================================
// @shared/schema mock
// ============================================================
vi.mock('@shared/schema', () => ({
  eventPools: eventPoolsTableSym,
  eventPoolRegistrations: eventPoolRegistrationsTableSym,
  matchingThresholds: matchingThresholdsTableSym,
  poolMatchingLogs: poolMatchingLogsTableSym,
}));

// ============================================================
// drizzle-orm mock
// ============================================================
vi.mock('drizzle-orm', () => ({
  eq: (_field: unknown, value: unknown) => ({ type: 'eq', value }),
  and: (...conditions: unknown[]) => ({ type: 'and', conditions }),
}));

// ============================================================
// DB mock helpers
// ============================================================
function makeAwaitable(value: unknown) {
  return {
    limit: () => Promise.resolve(value),
    then: (resolve: (v: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

// ============================================================
// ../db mock
// ============================================================
vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => ({
        where: (condition: any) => {
          if (table === matchingThresholdsTableSym) {
            if (condition?.type === 'eq' && condition.value === true) {
              const row = mockState.thresholdConfigRows.find(r => r.isActive === true);
              return makeAwaitable(row ? [row] : []);
            }
            return makeAwaitable([]);
          }
          if (table === eventPoolRegistrationsTableSym) {
            if (condition?.type === 'and' && Array.isArray(condition.conditions)) {
              const eqValues = condition.conditions
                .filter((c: any) => c?.type === 'eq')
                .map((c: any) => c.value);
              const rows = mockState.registrationRows.filter(r =>
                eqValues.every((v: any) => r.poolId === v || r.matchStatus === v),
              );
              return makeAwaitable(rows);
            }
            return makeAwaitable(mockState.registrationRows);
          }
          if (table === eventPoolsTableSym) {
            // eq(eventPools.status, "active")
            if (condition?.type === 'eq' && condition.value === 'active') {
              const rows = mockState.poolRows.filter(r => r.status === 'active');
              return makeAwaitable(rows);
            }
            return makeAwaitable([]);
          }
          return makeAwaitable([]);
        },
      }),
    }),
    query: {
      eventPools: {
        findFirst: ({ where: condition }: any) => {
          if (condition?.type === 'eq') {
            return Promise.resolve(mockState.poolRows.find(r => r.id === condition.value) ?? null);
          }
          return Promise.resolve(null);
        },
      },
    },
    insert: (table: unknown) => ({
      values: async (values: any) => {
        if (table === poolMatchingLogsTableSym) {
          mockState.logInsertCalls.push(values);
        }
      },
    }),
    update: (table: unknown) => ({
      set: (values: any) => ({
        where: async (_condition: any) => {
          if (table === matchingThresholdsTableSym) {
            mockState.thresholdUpdateCalls.push({ values });
            const activeRow = mockState.thresholdConfigRows.find(r => r.isActive === true);
            if (activeRow) {
              Object.assign(activeRow, values);
            }
          }
        },
      }),
    }),
  },
}));

// ============================================================
// ../poolMatchingService mock
// ============================================================
vi.mock('../poolMatchingService', async () => ({
  matchEventPool: mockMatchEventPool,
  saveMatchResults: mockSaveMatchResults,
}));

// ============================================================
// ../predictiveRerankingService mock
// ============================================================
vi.mock('../predictiveRerankingService', () => ({
  getPredictiveRerankAutoDisableReason: mockGetPredictiveRerankAutoDisableReason,
  planPredictiveRerank: mockPlanPredictiveRerank,
}));

// ============================================================
// ../repositories/matchingShadowExperimentsRepo mock
// ============================================================
vi.mock('../repositories/matchingShadowExperimentsRepo', () => ({
  countMatchingShadowExperimentPools: mockCountMatchingShadowExperimentPools,
  getOutcomeCalibrationSnapshot: mockGetOutcomeCalibrationSnapshot,
  getPredictiveRerankOutcomeMetrics: mockGetPredictiveRerankOutcomeMetrics,
}));

// ============================================================
// Import the service under test
// ============================================================
const { scanPoolAndMatch, scanAllActivePools } = await import(
  '../poolRealtimeMatchingService'
);

// ============================================================
// Helpers
// ============================================================
function makePool(overrides: Partial<any> = {}) {
  return {
    id: 'pool-1',
    title: 'Test Pool',
    status: 'active',
    dateTime: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    minGroupSize: 4,
    predictiveRerankEnabledOverride: null,
    ...overrides,
  };
}

function makeThresholdConfig(overrides: Partial<any> = {}) {
  return {
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
    ...overrides,
  };
}

function makeMatchGroup(overrides: Partial<any> = {}): any {
  return {
    members: Array.from({ length: 4 }, (_, i) => ({ id: `user-${i}`, profile: {} })),
    avgPairScore: 85,
    avgChemistryScore: 80,
    diversityScore: 70,
    communicationBalance: 75,
    overallScore: 82,
    temperatureLevel: 'warm',
    explanation: 'Test group',
    ...overrides,
  };
}

function makeRegistration(overrides: Partial<any> = {}) {
  return {
    id: 'reg-1',
    poolId: 'pool-1',
    userId: 'user-1',
    matchStatus: 'pending',
    ...overrides,
  };
}

function setupDefaultConfig() {
  mockState.thresholdConfigRows = [makeThresholdConfig()];
}

function setupSufficientRegistrations(count = 6) {
  mockState.registrationRows = Array.from({ length: count }, (_, i) =>
    makeRegistration({ id: `reg-${i}`, userId: `user-${i}` }),
  );
}

// ============================================================
// Tests
// ============================================================
describe('poolRealtimeMatchingService', () => {
  beforeEach(() => {
    mockState.poolRows = [];
    mockState.registrationRows = [];
    mockState.thresholdConfigRows = [];
    mockState.logInsertCalls = [];
    mockState.thresholdUpdateCalls = [];
    mockMatchEventPool.mockReset();
    mockSaveMatchResults.mockReset();
    mockPlanPredictiveRerank.mockReset();
    mockGetPredictiveRerankAutoDisableReason.mockReset();
    mockGetOutcomeCalibrationSnapshot.mockReset();
    mockCountMatchingShadowExperimentPools.mockReset();
    mockGetPredictiveRerankOutcomeMetrics.mockReset();
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  // ==========================================================
  // scanPoolAndMatch — pool validation
  // ==========================================================
  describe('scanPoolAndMatch — pool validation', () => {
    it('returns insufficient when pool is not found', async () => {
      const result = await scanPoolAndMatch('nonexistent', 'manual', 'admin_manual');

      expect(result.decision).toBe('insufficient');
      expect(result.reason).toContain('活动池不存在');
      expect(result.groupsFormed).toBe(0);
      expect(result.usersMatched).toBe(0);
      expect(result.avgGroupScore).toBe(0);
      expect(result.currentThreshold).toBe(0);
    });

    it('returns insufficient when pool status is "closed"', async () => {
      mockState.poolRows = [makePool({ status: 'closed' })];

      const result = await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

      expect(result.decision).toBe('insufficient');
      expect(result.reason).toContain('状态不是active');
    });

    it('returns insufficient when pool status is "cancelled"', async () => {
      mockState.poolRows = [makePool({ status: 'cancelled' })];

      const result = await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

      expect(result.decision).toBe('insufficient');
    });

    it('returns insufficient when pool status is "matched"', async () => {
      mockState.poolRows = [makePool({ status: 'matched' })];

      const result = await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

      expect(result.decision).toBe('insufficient');
    });
  });

  // ==========================================================
  // scanPoolAndMatch — insufficient users
  // ==========================================================
  describe('scanPoolAndMatch — insufficient users', () => {
    it('returns insufficient when pending users < minGroupSizeForMatch', async () => {
      mockState.poolRows = [makePool()];
      setupDefaultConfig();
      mockState.registrationRows = [
        makeRegistration(),
        makeRegistration({ id: 'reg-2', userId: 'user-2' }),
      ];

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('insufficient');
      expect(result.reason).toContain('人数不足');
      expect(result.reason).toContain('2/4');
      expect(result.groupsFormed).toBe(0);
      expect(mockState.logInsertCalls).toHaveLength(1);
      expect(mockState.logInsertCalls[0].decision).toBe('insufficient');
      expect(mockState.logInsertCalls[0].scanType).toBe('realtime');
      expect(mockState.logInsertCalls[0].triggeredBy).toBe('user_registration');
    });

    it('returns insufficient when zero pending users', async () => {
      mockState.poolRows = [makePool()];
      setupDefaultConfig();
      mockState.registrationRows = [];

      const result = await scanPoolAndMatch('pool-1', 'scheduled', 'cron_job');

      expect(result.decision).toBe('insufficient');
      expect(result.reason).toContain('0/4');
    });

    it('falls back to pool.minGroupSize when minGroupSizeForMatch is undefined', async () => {
      mockState.poolRows = [makePool({ minGroupSize: 6 })];
      mockState.thresholdConfigRows = [makeThresholdConfig({ minGroupSizeForMatch: undefined })];
      mockState.registrationRows = Array.from({ length: 5 }, (_, i) =>
        makeRegistration({ id: `reg-${i}`, userId: `user-${i}` }),
      );

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('insufficient');
      expect(result.reason).toContain('5/6');
    });

    it('uses minGroupSizeForMatch over pool.minGroupSize when both are set', async () => {
      // minGroupSizeForMatch (4) should take priority over pool.minGroupSize (8)
      mockState.poolRows = [makePool({ minGroupSize: 8 })];
      mockState.thresholdConfigRows = [makeThresholdConfig({ minGroupSizeForMatch: 4 })];
      mockState.registrationRows = Array.from({ length: 6 }, (_, i) =>
        makeRegistration({ id: `reg-${i}`, userId: `user-${i}` }),
      );

      // 6 >= 4, passes minGroupSizeForMatch check
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 92 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
    });

    it('includes currentThreshold in insufficient result', async () => {
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({ mediumCompatibilityThreshold: 70 })];
      mockState.registrationRows = [makeRegistration()];

      const result = await scanPoolAndMatch('pool-1', 'scheduled', 'cron_job');

      // currentThreshold computed from mediumCompatibilityThreshold + time decay
      expect(result.currentThreshold).toBeGreaterThan(0);
    });
  });

  // ==========================================================
  // scanPoolAndMatch — match algorithm errors
  // ==========================================================
  describe('scanPoolAndMatch — match algorithm errors', () => {
    it('returns insufficient when matchEventPool throws', async () => {
      mockState.poolRows = [makePool()];
      setupDefaultConfig();
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockRejectedValueOnce(new Error('algorithm crash'));

      const result = await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

      expect(result.decision).toBe('insufficient');
      expect(result.reason).toContain('匹配算法失败');
      expect(result.reason).toContain('algorithm crash');
      expect(mockState.logInsertCalls).toHaveLength(1);
      expect(mockState.logInsertCalls[0].decision).toBe('insufficient');
      expect(mockState.logInsertCalls[0].reason).toContain('algorithm crash');
      expect(mockState.logInsertCalls[0].groupsFormed).toBe(0);
      expect(mockState.logInsertCalls[0].usersMatched).toBe(0);
    });

    it('logs scan metadata even on match failure', async () => {
      mockState.poolRows = [makePool()];
      setupDefaultConfig();
      setupSufficientRegistrations(8);
      mockMatchEventPool.mockRejectedValueOnce(new Error('timeout'));

      await scanPoolAndMatch('pool-1', 'scheduled', 'cron_job');

      expect(mockState.logInsertCalls[0].scanType).toBe('scheduled');
      expect(mockState.logInsertCalls[0].triggeredBy).toBe('cron_job');
      expect(mockState.logInsertCalls[0].pendingUsersCount).toBe(8);
    });

    it('does not call saveMatchResults when match algorithm throws', async () => {
      mockState.poolRows = [makePool()];
      setupDefaultConfig();
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockRejectedValueOnce(new Error('crash'));

      await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');

      expect(mockSaveMatchResults).not.toHaveBeenCalled();
    });
  });

  // ==========================================================
  // scanPoolAndMatch — matched decision
  // ==========================================================
  describe('scanPoolAndMatch — matched decision', () => {
    it('matches when avg score >= highCompatibilityThreshold', async () => {
      const highGroup = makeMatchGroup({ overallScore: 95, members: Array(6).fill(null).map((_, i) => ({ id: `user-${i}`, profile: {} })) });
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({ highCompatibilityThreshold: 85 })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([highGroup]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      expect(result.reason).toContain('高兼容性匹配');
      expect(result.groupsFormed).toBe(1);
      expect(result.usersMatched).toBe(6);
      expect(result.avgGroupScore).toBe(95);
      expect(mockSaveMatchResults).toHaveBeenCalledWith('pool-1', [highGroup]);
      expect(mockState.logInsertCalls).toHaveLength(1);
      expect(mockState.logInsertCalls[0].decision).toBe('matched');
    });

    it('matches when avg score >= decayed threshold (medium compatibility)', async () => {
      const mediumGroup = makeMatchGroup({ overallScore: 68 });
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([mediumGroup]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      // 68 < 85 (high), but 68 >= 65 (decayed from 70 with ~7 days → 1 day decay = 5 pts → 70-5=65)
      expect(result.decision).toBe('matched');
      expect(result.reason).toContain('达到当前阈值');
    });

    it('computes correct avgGroupScore and totals for multiple groups', async () => {
      const groups = [
        makeMatchGroup({ overallScore: 90, members: Array(4).fill(null).map((_, i) => ({ id: `u${i}`, profile: {} })) }),
        makeMatchGroup({ overallScore: 80, members: Array(4).fill(null).map((_, i) => ({ id: `u${i + 4}`, profile: {} })) }),
      ];
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({ highCompatibilityThreshold: 85 })];
      mockState.registrationRows = Array.from({ length: 8 }, (_, i) =>
        makeRegistration({ id: `reg-${i}`, userId: `user-${i}` }),
      );
      mockMatchEventPool.mockResolvedValueOnce(groups);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      expect(result.avgGroupScore).toBe(85); // Math.round((90 + 80) / 2)
      expect(result.groupsFormed).toBe(2);
      expect(result.usersMatched).toBe(8);
    });
  });

  // ==========================================================
  // scanPoolAndMatch — waiting decision
  // ==========================================================
  describe('scanPoolAndMatch — waiting decision', () => {
    it('returns waiting when compatibility below threshold', async () => {
      const lowGroup = makeMatchGroup({ overallScore: 62 });
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: false,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([lowGroup]);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('waiting');
      expect(result.reason).toContain('兼容性未达标');
      expect(result.groupsFormed).toBe(0);
      expect(result.usersMatched).toBe(0);
      expect(mockSaveMatchResults).not.toHaveBeenCalled();
      expect(mockState.logInsertCalls).toHaveLength(1);
      expect(mockState.logInsertCalls[0].decision).toBe('waiting');
    });

    it('returns waiting when matchEventPool returns zero groups', async () => {
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: false,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([]);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('waiting');
      expect(result.reason).toContain('无法形成任何小组');
      expect(result.groupsFormed).toBe(0);
      expect(mockSaveMatchResults).not.toHaveBeenCalled();
    });

    it('logs avgGroupScore even when waiting', async () => {
      const lowGroup = makeMatchGroup({ overallScore: 55 });
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: false,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([lowGroup]);

      await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(mockState.logInsertCalls[0].avgGroupScore).toBe(55);
      expect(mockState.logInsertCalls[0].groupsFormed).toBe(0);
      expect(mockState.logInsertCalls[0].usersMatched).toBe(0);
    });
  });

  // ==========================================================
  // scanPoolAndMatch — time decay
  // ==========================================================
  describe('scanPoolAndMatch — time decay', () => {
    it('decays threshold based on hours until event', async () => {
      const pool = makePool({
        dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });
      const group = makeMatchGroup({ overallScore: 62 });
      mockState.poolRows = [pool];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: true,
        timeDecayRate: 5,
        minThresholdAfterDecay: 50,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([group]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      // 48 hours = 2 days → decay = 2 * 5 = 10 → threshold = max(70-10, 50) = 60
      expect(result.currentThreshold).toBe(60);
      expect(result.decision).toBe('matched');
    });

    it('does not decay below minThresholdAfterDecay', async () => {
      const pool = makePool({
        dateTime: new Date(Date.now() + 240 * 60 * 60 * 1000),
      });
      const group = makeMatchGroup({ overallScore: 52 });
      mockState.poolRows = [pool];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: true,
        timeDecayRate: 5,
        minThresholdAfterDecay: 50,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([group]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      // floor(240/24) = 10 days → 10 * 5 = 50, 70 - 50 = 20, max(20, 50) = 50
      expect(result.currentThreshold).toBe(50);
      expect(result.decision).toBe('matched');
    });

    it('does not decay when timeDecayEnabled is false', async () => {
      const pool = makePool({
        dateTime: new Date(Date.now() + 48 * 60 * 60 * 1000),
      });
      const group = makeMatchGroup({ overallScore: 68 });
      mockState.poolRows = [pool];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: false,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([group]);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.currentThreshold).toBe(70);
      expect(result.decision).toBe('waiting'); // 68 < 70, stays waiting
    });

    it('clamps hoursUntilEvent to 0 when event is in the past', async () => {
      const pool = makePool({
        dateTime: new Date(Date.now() - 1 * 60 * 60 * 1000),
      });
      const group = makeMatchGroup({ overallScore: 72 });
      mockState.poolRows = [pool];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: true,
        timeDecayRate: 5,
        minThresholdAfterDecay: 50,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([group]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      // hoursUntilEvent = max(0, floor(negative)) = 0, no decay
      expect(result.currentThreshold).toBe(70);
      expect(result.decision).toBe('matched'); // 72 >= 70
    });

    it('correctly decays for events starting near the boundary (just under 24h)', async () => {
      const pool = makePool({
        dateTime: new Date(Date.now() + 23.9 * 60 * 60 * 1000),
      });
      const group = makeMatchGroup({ overallScore: 72 });
      mockState.poolRows = [pool];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: true,
        timeDecayRate: 5,
        minThresholdAfterDecay: 50,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([group]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      // floor(23.9/24) = 0, no decay
      expect(result.currentThreshold).toBe(70);
      expect(result.decision).toBe('matched');
    });
  });

  // ==========================================================
  // scanPoolAndMatch — default config
  // ==========================================================
  describe('scanPoolAndMatch — default config fallback', () => {
    it('uses default thresholds when no config row exists', async () => {
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [];
      setupSufficientRegistrations(6);
      // Score 80 is >= default medium (67) but with 7 days of default decay (7*5=35, 67-35=32, max(32,50)=50)
      // So threshold = 50, and 80 >= 50 → matched (medium compatibility path)
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 80 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      // Default medium: 67, minus default time decay for ~7 days → floor(7) * 5 = 35 → 67-35=32 → max(32,50)=50
      expect(result.currentThreshold).toBe(50);
    });

    it('uses default thresholds when no active config row exists', async () => {
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({ isActive: false })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 80 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
    });
  });

  // ==========================================================
  // scanPoolAndMatch — boundary conditions
  // ==========================================================
  describe('scanPoolAndMatch — boundary conditions', () => {
    it('matches exactly at the threshold boundary', async () => {
      const group = makeMatchGroup({ overallScore: 70 });
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: false,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([group]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      // 70 >= 70 → matched via medium path
      expect(result.decision).toBe('matched');
      expect(result.reason).toContain('达到当前阈值');
    });

    it('one point below threshold stays waiting', async () => {
      const group = makeMatchGroup({ overallScore: 69 });
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: false,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([group]);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('waiting');
    });
  });

  // ==========================================================
  // scanPoolAndMatch — scan type / triggeredBy propagation
  // ==========================================================
  describe('scanPoolAndMatch — scan type and triggeredBy', () => {
    it('passes scanType and triggeredBy into the decision log', async () => {
      mockState.poolRows = [makePool()];
      setupDefaultConfig();
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 95 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');
      expect(mockState.logInsertCalls[0].scanType).toBe('realtime');
      expect(mockState.logInsertCalls[0].triggeredBy).toBe('user_registration');

      mockState.logInsertCalls = [];
      mockState.poolRows = [makePool({ id: 'pool-2' })];
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 95 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);
      await scanPoolAndMatch('pool-2', 'scheduled', 'cron_job');
      expect(mockState.logInsertCalls[0].scanType).toBe('scheduled');
      expect(mockState.logInsertCalls[0].triggeredBy).toBe('cron_job');
    });

    it('passes scanType in manual scan log', async () => {
      const poolId = 'pool-manual';
      mockState.poolRows = [makePool({ id: poolId })];
      setupDefaultConfig();
      mockState.registrationRows = Array.from({ length: 6 }, (_, i) =>
        makeRegistration({ id: `reg-${i}`, userId: `user-${i}`, poolId }),
      );
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 95 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch(poolId, 'manual', 'admin_manual');

      expect(result.decision).toBe('matched');
      expect(mockState.logInsertCalls[0].scanType).toBe('manual');
      expect(mockState.logInsertCalls[0].triggeredBy).toBe('admin_manual');
    });
  });

  // ==========================================================
  // scanPoolAndMatch — predictive rerank disabled (default path)
  // ==========================================================
  describe('scanPoolAndMatch — predictive rerank disabled', () => {
    it('skips predictive rerank when config.predictiveRerankEnabled is false', async () => {
      mockState.poolRows = [makePool({ predictiveRerankEnabledOverride: null })];
      mockState.thresholdConfigRows = [makeThresholdConfig({ predictiveRerankEnabled: false })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 95 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      expect(mockPlanPredictiveRerank).not.toHaveBeenCalled();
      expect(mockGetOutcomeCalibrationSnapshot).not.toHaveBeenCalled();
      expect(mockCountMatchingShadowExperimentPools).not.toHaveBeenCalled();
    });

    it('skips predictive rerank when pool override explicitly disables it', async () => {
      mockState.poolRows = [makePool({ predictiveRerankEnabledOverride: false })];
      mockState.thresholdConfigRows = [makeThresholdConfig({ predictiveRerankEnabled: true })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 95 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      expect(mockPlanPredictiveRerank).not.toHaveBeenCalled();
    });
  });

  // ==========================================================
  // scanPoolAndMatch — predictive rerank enabled
  // ==========================================================
  describe('scanPoolAndMatch — predictive rerank enabled', () => {
    it('invokes predictive rerank when config.predictiveRerankEnabled is true', async () => {
      mockState.poolRows = [makePool({ predictiveRerankEnabledOverride: null })];
      mockState.thresholdConfigRows = [makeThresholdConfig({ predictiveRerankEnabled: true })];
      setupSufficientRegistrations(6);
      const rawGroups = [makeMatchGroup({ overallScore: 95 })];
      mockMatchEventPool.mockResolvedValueOnce(rawGroups);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);
      mockGetOutcomeCalibrationSnapshot.mockResolvedValueOnce({});
      mockCountMatchingShadowExperimentPools.mockResolvedValueOnce(5);
      mockGetPredictiveRerankOutcomeMetrics.mockResolvedValueOnce([]);
      mockGetPredictiveRerankAutoDisableReason.mockReturnValueOnce(null);
      mockPlanPredictiveRerank.mockReturnValueOnce({
        groups: rawGroups,
        applied: false,
        arm: 'control',
        reason: 'below confidence threshold',
        modelVersion: 'v1.0.0',
        summary: { confidenceThreshold: 70, maxPositionShift: 2 },
        audits: [],
      });

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      expect(mockPlanPredictiveRerank).toHaveBeenCalledTimes(1);
      const callArgs = mockPlanPredictiveRerank.mock.calls[0][0];
      expect(callArgs.poolId).toBe('pool-1');
      expect(callArgs.groups).toEqual(rawGroups);
    });

    it('invokes predictive rerank when pool override forces it on', async () => {
      mockState.poolRows = [makePool({ predictiveRerankEnabledOverride: true })];
      mockState.thresholdConfigRows = [makeThresholdConfig({ predictiveRerankEnabled: false })];
      setupSufficientRegistrations(6);
      const rawGroups = [makeMatchGroup({ overallScore: 95 })];
      mockMatchEventPool.mockResolvedValueOnce(rawGroups);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);
      mockGetOutcomeCalibrationSnapshot.mockResolvedValueOnce({});
      mockPlanPredictiveRerank.mockReturnValueOnce({
        groups: rawGroups,
        applied: true,
        arm: 'treatment',
        reason: 'forced via override',
        modelVersion: 'v1.0.0',
        summary: {},
        audits: [],
      });

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      expect(mockPlanPredictiveRerank).toHaveBeenCalledTimes(1);
    });

    it('passes predictive rerank metadata to saveMatchResults', async () => {
      mockState.poolRows = [makePool({ predictiveRerankEnabledOverride: null })];
      mockState.thresholdConfigRows = [makeThresholdConfig({ predictiveRerankEnabled: true })];
      setupSufficientRegistrations(6);
      const rawGroups = [makeMatchGroup({ overallScore: 95 })];
      mockMatchEventPool.mockResolvedValueOnce(rawGroups);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);
      mockGetOutcomeCalibrationSnapshot.mockResolvedValueOnce({});
      mockCountMatchingShadowExperimentPools.mockResolvedValueOnce(5);
      mockGetPredictiveRerankOutcomeMetrics.mockResolvedValueOnce([]);
      mockGetPredictiveRerankAutoDisableReason.mockReturnValueOnce(null);
      mockPlanPredictiveRerank.mockReturnValueOnce({
        groups: rawGroups,
        applied: true,
        arm: 'treatment',
        reason: 'reranked',
        modelVersion: 'v2.0',
        summary: { confidenceThreshold: 70 },
        audits: [{ deterministicRank: 1, finalRank: 1, predictedRank: 1, predictedScore: 0.9, predictedOutcomeRate: 0.85, confidence: 0.9 }],
      });

      await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(mockSaveMatchResults).toHaveBeenCalledWith('pool-1', rawGroups, {
        predictiveExperimentArm: 'treatment',
        predictiveRerankApplied: true,
        predictiveRerankSummary: {
          reason: 'reranked',
          modelVersion: 'v2.0',
          confidenceThreshold: 70,
          audits: expect.any(Array),
        },
      });
    });

    it('auto-disables predictive rerank when outcome metrics trigger the reason', async () => {
      mockState.poolRows = [makePool({ predictiveRerankEnabledOverride: null })];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        predictiveRerankEnabled: true,
        predictiveRerankAutoDisableEnabled: true,
      })];
      setupSufficientRegistrations(6);
      const rawGroups = [makeMatchGroup({ overallScore: 95 })];
      mockMatchEventPool.mockResolvedValueOnce(rawGroups);

      // First call to saveMatchResults uses the first config
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      // Auto-disable chain
      mockGetOutcomeCalibrationSnapshot.mockResolvedValueOnce({});
      mockCountMatchingShadowExperimentPools.mockResolvedValueOnce(5);
      mockGetPredictiveRerankOutcomeMetrics.mockResolvedValueOnce([
        { arm: 'treatment', matchCount: 10, avgOutcomeScore: 0.3 },
        { arm: 'control', matchCount: 10, avgOutcomeScore: 0.85 },
      ]);
      // Returns a real reason, triggering auto-disable
      mockGetPredictiveRerankAutoDisableReason.mockReturnValueOnce(
        'Treatment arm underperforming control by >15%',
      );
      mockPlanPredictiveRerank.mockReturnValueOnce({
        groups: rawGroups,
        applied: false,
        arm: 'control',
        reason: 'disabled after auto-disable',
        modelVersion: 'v1.0',
        summary: {},
        audits: [],
      });

      const result = await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(result.decision).toBe('matched');
      // persistPredictiveRerankAutoDisable should have been called (via db.update)
      expect(mockState.thresholdUpdateCalls).toHaveLength(1);
      expect(mockState.thresholdUpdateCalls[0].values.predictiveRerankEnabled).toBe(false);
      expect(mockState.thresholdUpdateCalls[0].values.predictiveRerankAutoDisabledReason).toBe(
        'Treatment arm underperforming control by >15%',
      );
    });
  });

  // ==========================================================
  // scanAllActivePools
  // ==========================================================
  describe('scanAllActivePools', () => {
    it('scans all active pools and handles errors independently', async () => {
      mockState.poolRows = [
        makePool({ id: 'pool-1', title: 'Pool 1', status: 'active' }),
        makePool({ id: 'pool-2', title: 'Pool 2', status: 'active' }),
        makePool({ id: 'pool-3', title: 'Pool 3', status: 'cancelled' }),
      ];
      setupDefaultConfig();
      // Create registrations for both active pools
      mockState.registrationRows = [
        ...Array.from({ length: 6 }, (_, i) =>
          makeRegistration({ id: `reg-a-${i}`, userId: `user-a-${i}`, poolId: 'pool-1' }),
        ),
        ...Array.from({ length: 6 }, (_, i) =>
          makeRegistration({ id: `reg-b-${i}`, userId: `user-b-${i}`, poolId: 'pool-2' }),
        ),
      ];

      mockMatchEventPool
        .mockResolvedValueOnce([makeMatchGroup({ overallScore: 90, members: Array(4).fill(null).map((_, i) => ({ id: `a${i}`, profile: {} })) })])
        .mockRejectedValueOnce(new Error('pool-2 error'));
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      await scanAllActivePools();

      const pool1Logs = mockState.logInsertCalls.filter(l => l.poolId === 'pool-1');
      expect(pool1Logs).toHaveLength(1);
      expect(pool1Logs[0].decision).toBe('matched');

      const pool2Logs = mockState.logInsertCalls.filter(l => l.poolId === 'pool-2');
      expect(pool2Logs).toHaveLength(1);
      expect(pool2Logs[0].decision).toBe('insufficient');
      expect(pool2Logs[0].reason).toContain('pool-2 error');

      const pool3Logs = mockState.logInsertCalls.filter(l => l.poolId === 'pool-3');
      expect(pool3Logs).toHaveLength(0);
    });

    it('handles empty active pools gracefully', async () => {
      mockState.poolRows = [];

      await scanAllActivePools();

      expect(mockMatchEventPool).not.toHaveBeenCalled();
      expect(mockState.logInsertCalls).toHaveLength(0);
    });

    it('uses scheduled scanType and cron_job triggeredBy', async () => {
      mockState.poolRows = [makePool({ id: 'pool-1' })];
      setupDefaultConfig();
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 90, members: Array(4).fill(null).map((_, i) => ({ id: `a${i}`, profile: {} })) })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      await scanAllActivePools();

      expect(mockState.logInsertCalls[0].scanType).toBe('scheduled');
      expect(mockState.logInsertCalls[0].triggeredBy).toBe('cron_job');
    });

    it('only scans pools with status "active", not "matched" or other states', async () => {
      mockState.poolRows = [
        makePool({ id: 'pool-1', title: 'Pool 1', status: 'active' }),
        makePool({ id: 'pool-2', title: 'Pool 2', status: 'matched' }),
        makePool({ id: 'pool-3', title: 'Pool 3', status: 'closed' }),
      ];
      setupDefaultConfig();
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 90, members: Array(4).fill(null).map((_, i) => ({ id: `a${i}`, profile: {} })) })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);

      await scanAllActivePools();

      // Only pool-1 (active) should be scanned
      const scannedPoolIds = mockState.logInsertCalls.map(l => l.poolId);
      expect(scannedPoolIds).toEqual(['pool-1']);
      expect(mockMatchEventPool).toHaveBeenCalledTimes(1);
    });
  });

  // ==========================================================
  // Regression invariants
  // ==========================================================
  describe('regression invariants', () => {
    it('never calls saveMatchResults when decision is waiting', async () => {
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        highCompatibilityThreshold: 85,
        mediumCompatibilityThreshold: 70,
        timeDecayEnabled: false,
      })];
      setupSufficientRegistrations(6);
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 55 })]);

      await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(mockSaveMatchResults).not.toHaveBeenCalled();
    });

    it('never calls saveMatchResults when decision is insufficient', async () => {
      mockState.poolRows = [makePool()];
      mockState.registrationRows = [makeRegistration()];

      await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');

      expect(mockSaveMatchResults).not.toHaveBeenCalled();
    });

    it('always records a log entry on every scan', async () => {
      mockState.poolRows = [makePool()];
      mockState.thresholdConfigRows = [makeThresholdConfig({
        timeDecayEnabled: false,
      })];
      mockState.registrationRows = [makeRegistration()];

      await scanPoolAndMatch('pool-1', 'realtime', 'user_registration');
      expect(mockState.logInsertCalls).toHaveLength(1);

      mockState.logInsertCalls = [];
      mockState.registrationRows = Array.from({ length: 6 }, (_, i) =>
        makeRegistration({ id: `reg-${i}`, userId: `user-${i}` }),
      );
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 55 })]);
      await scanPoolAndMatch('pool-1', 'manual', 'admin_manual');
      expect(mockState.logInsertCalls).toHaveLength(1);

      mockState.logInsertCalls = [];
      mockMatchEventPool.mockResolvedValueOnce([makeMatchGroup({ overallScore: 95 })]);
      mockSaveMatchResults.mockResolvedValueOnce(undefined);
      await scanPoolAndMatch('pool-1', 'scheduled', 'cron_job');
      expect(mockState.logInsertCalls).toHaveLength(1);
    });
  });
});
