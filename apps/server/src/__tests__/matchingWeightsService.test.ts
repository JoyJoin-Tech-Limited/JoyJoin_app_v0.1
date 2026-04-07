import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  matchingWeightsConfigTable,
  matchingWeightsHistoryTable,
  mockState,
} = vi.hoisted(() => ({
  matchingWeightsConfigTable: {
    __table: 'matchingWeightsConfig',
    id: 'id',
    configName: 'configName',
    isActive: 'isActive',
  },
  matchingWeightsHistoryTable: {
    __table: 'matchingWeightsHistory',
    configId: 'configId',
    changeReason: 'changeReason',
    recordedAt: 'recordedAt',
  },
  mockState: {
    configRows: [] as any[],
    historyRows: [] as any[],
    updateCalls: [] as Array<{ table: string; values: Record<string, unknown>; condition: any }>,
    insertCalls: [] as Array<{ table: string; values: Record<string, unknown> }>,
    transactionCalls: 0,
  },
}));

const MAX_WEIGHT_DELTA_TOLERANCE = 3.0001;

function cloneRow<T>(row: T): T {
  return JSON.parse(JSON.stringify(row));
}

function applyWhere(rows: any[], condition: { field: string; value: unknown } | undefined) {
  if (!condition) return rows;
  return rows.filter((row) => row[condition.field] === condition.value);
}

function sortByRecordedAtDesc(rows: any[], field: string) {
  return [...rows].sort((a, b) => String(b[field] ?? '').localeCompare(String(a[field] ?? '')));
}

function makeQueryResult(rows: any[]) {
  return {
    limit: (count: number) => Promise.resolve(rows.slice(0, count).map(cloneRow)),
    orderBy: (order: { field: string }) => makeQueryResult(sortByRecordedAtDesc(rows, order.field)),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows.map(cloneRow)).then(resolve, reject),
  };
}

function buildDbFacade(): any {
  return {
    select: () => ({
      from: (table: any) => ({
        where: (condition: any) => {
          if (table.__table === 'matchingWeightsConfig') {
            return makeQueryResult(applyWhere(mockState.configRows, condition));
          }
          if (table.__table === 'matchingWeightsHistory') {
            return makeQueryResult(applyWhere(mockState.historyRows, condition));
          }
          return makeQueryResult([]);
        },
        orderBy: (order: any) => {
          if (table.__table === 'matchingWeightsHistory') {
            return makeQueryResult(sortByRecordedAtDesc(mockState.historyRows, order.field));
          }
          return makeQueryResult([]);
        },
      }),
    }),
    update: (table: any) => ({
      set: (values: Record<string, unknown>) => ({
        where: async (condition: any) => {
          const rows = table.__table === 'matchingWeightsConfig' ? mockState.configRows : mockState.historyRows;
          rows.forEach((row) => {
            if (!condition || row[condition.field] === condition.value) {
              Object.assign(row, values);
            }
          });
          mockState.updateCalls.push({ table: table.__table, values, condition });
          return [];
        },
      }),
    }),
    insert: (table: any) => ({
      values: async (values: Record<string, unknown>) => {
        const target = table.__table === 'matchingWeightsConfig' ? mockState.configRows : mockState.historyRows;
        const nextId = values.id ?? `${table.__table}-${target.length + 1}`;
        const row = {
          ...values,
          id: nextId,
          recordedAt:
            table.__table === 'matchingWeightsHistory'
              ? values.recordedAt ?? `2026-04-02T12:00:0${target.length}Z`
              : values.recordedAt,
        };
        target.push(row);
        mockState.insertCalls.push({ table: table.__table, values: row });
        return [cloneRow(row)];
      },
    }),
    transaction: async (callback: (tx: ReturnType<typeof buildDbFacade>) => Promise<unknown>) => {
      mockState.transactionCalls += 1;
      return callback(buildDbFacade());
    },
  };
}

vi.mock('@shared/schema', () => ({
  matchingWeightsConfig: matchingWeightsConfigTable,
  matchingWeightsHistory: matchingWeightsHistoryTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (field: string, value: unknown) => ({ field, value }),
  desc: (field: string) => ({ field }),
}));

vi.mock('../db', () => ({
  db: buildDbFacade(),
}));

const {
  buildShadowRecommendation,
  MatchingWeightsService,
  SHADOW_RECOMMENDATION_REASON,
} = await import('../matchingWeightsService');

describe('MatchingWeightsService', () => {
  let service: InstanceType<typeof MatchingWeightsService>;

  beforeEach(() => {
    mockState.configRows = [];
    mockState.historyRows = [];
    mockState.updateCalls = [];
    mockState.insertCalls = [];
    mockState.transactionCalls = 0;
    service = new MatchingWeightsService();
    service.invalidateCache();
  });

  it('uses active-flow dimension vocabulary — 6 dimensions matching poolMatchingService', async () => {
    mockState.configRows = [
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        chemistryWeight: '0.28',
        interestWeight: '0.28',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
      },
    ];

    const weights = await service.getActiveWeights();
    // Confirm the 6 active-flow dimension keys are present
    expect(Object.keys(weights)).toEqual(
      expect.arrayContaining([
        'chemistryWeight',
        'interestWeight',
        'socialAffinityWeight',
        'backgroundDiversityWeight',
        'preferenceWeight',
        'languageWeight',
      ]),
    );
    // Confirm old vocabulary keys are absent
    expect(Object.keys(weights)).not.toContain('personalityWeight');
    expect(Object.keys(weights)).not.toContain('interestsWeight');
    expect(Object.keys(weights)).not.toContain('intentWeight');
    expect(Object.keys(weights)).not.toContain('cultureWeight');
    expect(Object.keys(weights)).not.toContain('conversationSignatureWeight');
  });

  it('normalizes stored decimal weights into runtime percentages and exposes rollout status', async () => {
    mockState.configRows = [
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        chemistryWeight: '0.20',
        interestWeight: '0.25',
        socialAffinityWeight: '0.22',
        backgroundDiversityWeight: '0.18',
        preferenceWeight: '0.08',
        languageWeight: '0.07',
      },
    ];

    await expect(service.getActiveWeights()).resolves.toEqual({
      chemistryWeight: 20,
      interestWeight: 25,
      socialAffinityWeight: 22,
      backgroundDiversityWeight: 18,
      preferenceWeight: 8,
      languageWeight: 7,
    });

    await expect(service.getRolloutStatus()).resolves.toMatchObject({
      adaptiveWeightsEnabled: true,
      liveConfigName: 'adaptive_live',
      maxWeightMovementPercent: 3,
    });
  });

  it('caps each bounded adaptive weight movement during recalculation', async () => {
    mockState.configRows = [
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        chemistryWeight: '0.28',
        interestWeight: '0.28',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
        totalMatches: 49,
        successfulMatches: 20,
        averageSatisfaction: '4.0000',
        chemistryAlpha: 4,
        chemistryBeta: 1,
        interestAlpha: 1,
        interestBeta: 4,
        socialAffinityAlpha: 1,
        socialAffinityBeta: 4,
        backgroundDiversityAlpha: 1,
        backgroundDiversityBeta: 4,
        preferenceAlpha: 1,
        preferenceBeta: 4,
        languageAlpha: 1,
        languageBeta: 4,
      },
    ];

    vi.spyOn(service as any, 'sampleBeta')
      .mockReturnValueOnce(0.9)
      .mockReturnValueOnce(0.02)
      .mockReturnValueOnce(0.02)
      .mockReturnValueOnce(0.02)
      .mockReturnValueOnce(0.02)
      .mockReturnValueOnce(0.02);

    await service.updateWeightsAfterFeedback(5, {
      chemistry: 80,
      interest: 40,
      socialAffinity: 40,
      backgroundDiversity: 40,
      preference: 40,
      language: 40,
    });

    const activeRow = mockState.configRows[0];
    const runtimeWeights = {
      chemistryWeight: Number(activeRow.chemistryWeight) * 100,
      interestWeight: Number(activeRow.interestWeight) * 100,
      socialAffinityWeight: Number(activeRow.socialAffinityWeight) * 100,
      backgroundDiversityWeight: Number(activeRow.backgroundDiversityWeight) * 100,
      preferenceWeight: Number(activeRow.preferenceWeight) * 100,
      languageWeight: Number(activeRow.languageWeight) * 100,
    };

    expect(Math.abs(runtimeWeights.chemistryWeight - 28)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.interestWeight - 28)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.socialAffinityWeight - 20)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.backgroundDiversityWeight - 15)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.preferenceWeight - 5)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.languageWeight - 4)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Object.values(runtimeWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 1);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_bandit_bounded');
  });

  it('uses a transaction for the kill switch back to deterministic default weights', async () => {
    mockState.configRows = [
      {
        id: 'default-1',
        configName: 'default',
        isActive: false,
        chemistryWeight: '0.28',
        interestWeight: '0.28',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
      },
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        chemistryWeight: '0.31',
        interestWeight: '0.25',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
      },
    ];

    const rollout = await service.setAdaptiveWeightsEnabled(false);

    expect(mockState.transactionCalls).toBe(1);
    expect(rollout.adaptiveWeightsEnabled).toBe(false);
    expect(rollout.liveConfigName).toBe('default');
    expect(mockState.configRows.find((row) => row.configName === 'default')?.isActive).toBe(true);
    expect(mockState.configRows.find((row) => row.configName === 'adaptive_live')?.isActive).toBe(false);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_disabled');
  });

  it('uses a transaction when enabling adaptive weights', async () => {
    mockState.configRows = [
      {
        id: 'default-1',
        configName: 'default',
        isActive: true,
        chemistryWeight: '0.28',
        interestWeight: '0.28',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
      },
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: false,
        chemistryWeight: '0.28',
        interestWeight: '0.28',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
      },
    ];

    const rollout = await service.setAdaptiveWeightsEnabled(true);

    expect(mockState.transactionCalls).toBe(1);
    expect(rollout.adaptiveWeightsEnabled).toBe(true);
    expect(mockState.configRows.find((row) => row.configName === 'adaptive_live')?.isActive).toBe(true);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_enabled');
  });

  it('rolls back the live adaptive config to the previous history snapshot', async () => {
    mockState.configRows = [
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        chemistryWeight: '0.31',
        interestWeight: '0.25',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
      },
    ];
    mockState.historyRows = [
      {
        id: 'history-current',
        configId: 'adaptive-1',
        chemistryWeight: '0.31',
        interestWeight: '0.25',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
        recordedAt: '2026-04-02T12:00:10.000Z',
      },
      {
        id: 'history-previous',
        configId: 'adaptive-1',
        chemistryWeight: '0.28',
        interestWeight: '0.28',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
        recordedAt: '2026-04-02T11:59:10.000Z',
      },
    ];

    const rollout = await service.rollbackAdaptiveWeights();

    expect(rollout.adaptiveWeightsEnabled).toBe(true);
    expect(rollout.activeWeights.chemistryWeight).toBeCloseTo(28, 3);
    expect(rollout.activeWeights.interestWeight).toBeCloseTo(28, 3);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_rollback');
  });

  it('builds normalized shadow recommendations from outcome signals using active-flow dimensions', () => {
    const activeConfig = {
      id: 'config-1',
      configName: 'default',
      isActive: true,
      chemistryWeight: '0.28',
      interestWeight: '0.28',
      socialAffinityWeight: '0.20',
      backgroundDiversityWeight: '0.15',
      preferenceWeight: '0.05',
      languageWeight: '0.04',
      chemistryAlpha: 5,
      chemistryBeta: 2,
      interestAlpha: 4,
      interestBeta: 2,
      socialAffinityAlpha: 3,
      socialAffinityBeta: 2,
      backgroundDiversityAlpha: 2,
      backgroundDiversityBeta: 2,
      preferenceAlpha: 3,
      preferenceBeta: 3,
      languageAlpha: 2,
      languageBeta: 2,
    } as any;

    const recommendation = buildShadowRecommendation(activeConfig, {
      eventId: 'event-1',
      feedbackId: 'feedback-1',
      wouldMeetAgain: true,
      wouldAttendAgain: true,
      hasNewConnections: true,
      atmosphereScore: 5,
      connectionStatus: '已交换联系方式',
      connectionCount: 2,
      mutualConnectionCount: 1,
      conversationComfort: 88,
      connectionRadar: {
        personalityMatch: 5,
        topicResonance: 4,
        backgroundDiversity: 4,
        overallFit: 5,
      },
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation?.outcomeScore).toBeGreaterThanOrEqual(4);
    expect(recommendation?.overallConfidence).toBeGreaterThan(0);

    // Recommended weights should sum to ~1 (ratio form)
    expect(Object.values(recommendation!.recommendedWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 4);

    // Confirm recommended weights use active-flow vocabulary
    expect(recommendation?.recommendedWeights).toHaveProperty('chemistryWeight');
    expect(recommendation?.recommendedWeights).toHaveProperty('interestWeight');
    expect(recommendation?.recommendedWeights).toHaveProperty('socialAffinityWeight');
    expect(recommendation?.recommendedWeights).toHaveProperty('backgroundDiversityWeight');
    expect(recommendation?.recommendedWeights).toHaveProperty('preferenceWeight');
    expect(recommendation?.recommendedWeights).toHaveProperty('languageWeight');

    // Confirm dimension metrics use active-flow vocabulary
    expect(recommendation?.dimensionMetrics).toHaveProperty('chemistry');
    expect(recommendation?.dimensionMetrics).toHaveProperty('interest');
    expect(recommendation?.dimensionMetrics).toHaveProperty('socialAffinity');
    expect(recommendation?.dimensionMetrics).toHaveProperty('backgroundDiversity');
    expect(recommendation?.dimensionMetrics).toHaveProperty('preference');
    expect(recommendation?.dimensionMetrics).toHaveProperty('language');
  });

  it('records shadow recommendations without changing live weights', async () => {
    mockState.configRows = [
      {
        id: 'config-1',
        configName: 'default',
        isActive: true,
        chemistryWeight: '0.28',
        interestWeight: '0.28',
        socialAffinityWeight: '0.20',
        backgroundDiversityWeight: '0.15',
        preferenceWeight: '0.05',
        languageWeight: '0.04',
        chemistryAlpha: 5,
        chemistryBeta: 2,
        interestAlpha: 4,
        interestBeta: 2,
        socialAffinityAlpha: 3,
        socialAffinityBeta: 2,
        backgroundDiversityAlpha: 2,
        backgroundDiversityBeta: 2,
        preferenceAlpha: 3,
        preferenceBeta: 3,
        languageAlpha: 2,
        languageBeta: 2,
      },
    ];

    const recommendation = await service.recordShadowRecommendation({
      eventId: 'event-2',
      feedbackId: 'feedback-2',
      userId: 'user-1',
      source: 'event_feedback',
      wouldMeetAgain: true,
      atmosphereScore: 4,
      hasNewConnections: true,
      connectionStatus: '有但还没联系',
      connectionCount: 1,
      mutualConnectionCount: 1,
      connectionRadar: {
        personalityMatch: 4,
        topicResonance: 4,
        backgroundDiversity: 3,
        overallFit: 4,
      },
    });

    expect(recommendation).not.toBeNull();
    expect(mockState.insertCalls.filter((entry) => entry.table === 'matchingWeightsHistory')).toHaveLength(1);
    expect(mockState.historyRows[0].changeReason).toBe(SHADOW_RECOMMENDATION_REASON);
    expect(mockState.historyRows[0].shadowMetadata.outcomeSignals.wouldMeetAgain).toBe(true);
    expect(mockState.updateCalls).toHaveLength(0);

    // Shadow history row should use active-flow vocabulary
    const historyRow = mockState.historyRows[0];
    expect(historyRow).toHaveProperty('chemistryWeight');
    expect(historyRow).toHaveProperty('interestWeight');
    expect(historyRow).toHaveProperty('socialAffinityWeight');
    expect(historyRow).toHaveProperty('backgroundDiversityWeight');
    expect(historyRow).toHaveProperty('preferenceWeight');
    expect(historyRow).toHaveProperty('languageWeight');
  });

  it('returns only shadow recommendation history for admin inspection', async () => {
    mockState.historyRows = [
      { id: 'shadow-1', configId: 'config-1', changeReason: SHADOW_RECOMMENDATION_REASON, recordedAt: '2026-04-02T12:00:10.000Z' },
      { id: 'live-1', configId: 'config-1', changeReason: 'bandit_exploration', recordedAt: '2026-04-02T12:00:09.000Z' },
    ];

    const history = await service.getShadowRecommendations(10);

    expect(history).toEqual([mockState.historyRows[0]]);
  });

  it('falls back to default active-flow weights when no config row exists', async () => {
    mockState.configRows = [];

    const weights = await service.getActiveWeights();

    // Should use active-flow default weights
    expect(weights.chemistryWeight).toBeCloseTo(28, 3);
    expect(weights.interestWeight).toBeCloseTo(28, 3);
    expect(weights.socialAffinityWeight).toBeCloseTo(20, 3);
    expect(weights.backgroundDiversityWeight).toBeCloseTo(15, 3);
    expect(weights.preferenceWeight).toBeCloseTo(5, 3);
    expect(weights.languageWeight).toBeCloseTo(4, 3);
  });

  it('returns runtime percentage defaults when fetching active weights fails', async () => {
    vi.spyOn(service, 'getActiveConfig').mockRejectedValueOnce(new Error('db unavailable'));

    await expect(service.getActiveWeights()).resolves.toEqual({
      chemistryWeight: 28,
      interestWeight: 28,
      socialAffinityWeight: 20,
      backgroundDiversityWeight: 15,
      preferenceWeight: 5,
      languageWeight: 4,
    });
  });
});
