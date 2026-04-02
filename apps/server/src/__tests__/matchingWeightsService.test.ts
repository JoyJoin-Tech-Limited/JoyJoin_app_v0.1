import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockState, matchingWeightsConfigTable, matchingWeightsHistoryTable } = vi.hoisted(() => ({
  mockState: {
    configRows: [] as any[],
    historyRows: [] as any[],
    updateCalls: [] as Array<{ table: string; values: Record<string, unknown>; condition: any }>,
    insertCalls: [] as Array<{ table: string; values: Record<string, unknown> }>,
  },
  matchingWeightsConfigTable: {
    __table: 'matchingWeightsConfig',
    id: 'id',
    configName: 'configName',
    isActive: 'isActive',
  },
  matchingWeightsHistoryTable: {
    __table: 'matchingWeightsHistory',
    configId: 'configId',
    recordedAt: 'recordedAt',
  },
}));

function cloneRow<T>(row: T): T {
  return JSON.parse(JSON.stringify(row));
}

const MAX_WEIGHT_DELTA_TOLERANCE = 3.0001;

function applyWhere(rows: any[], condition: { field: string; value: unknown } | undefined) {
  if (!condition) return rows;
  return rows.filter((row) => row[condition.field] === condition.value);
}

function makeQueryResult(rows: any[]) {
  return {
    limit: (count: number) => Promise.resolve(rows.slice(0, count).map(cloneRow)),
    orderBy: (order: { field: string }) =>
      makeQueryResult(
        [...rows].sort((a, b) => String(b[order.field] ?? '').localeCompare(String(a[order.field] ?? ''))),
      ),
    then: (resolve: (value: unknown) => unknown, reject?: (reason: unknown) => unknown) =>
      Promise.resolve(rows.map(cloneRow)).then(resolve, reject),
  };
}

const {
  matchingWeightsConfigTable,
  matchingWeightsHistoryTable,
  mockState,
} = vi.hoisted(() => ({
  matchingWeightsConfigTable: Symbol('matchingWeightsConfig'),
  matchingWeightsHistoryTable: Symbol('matchingWeightsHistory'),
  mockState: {
    activeConfig: {
      id: 'config-1',
      configName: 'default',
      isActive: true,
      personalityWeight: '0.23',
      interestsWeight: '0.24',
      intentWeight: '0.13',
      backgroundWeight: '0.15',
      cultureWeight: '0.10',
      conversationSignatureWeight: '0.15',
      personalityAlpha: 5,
      personalityBeta: 2,
      interestsAlpha: 4,
      interestsBeta: 2,
      intentAlpha: 3,
      intentBeta: 2,
      backgroundAlpha: 2,
      backgroundBeta: 2,
      cultureAlpha: 3,
      cultureBeta: 3,
      conversationSignatureAlpha: 2,
      conversationSignatureBeta: 2,
      totalMatches: 12,
      successfulMatches: 8,
      averageSatisfaction: '4.2000',
      createdAt: new Date(),
      updatedAt: new Date(),
    } as any,
    historyRows: [] as any[],
    insertedValues: [] as any[],
    updateCalls: 0,
  },
}));

vi.mock('@shared/schema', () => ({
  matchingWeightsConfig: matchingWeightsConfigTable,
  matchingWeightsHistory: matchingWeightsHistoryTable,
}));

vi.mock('drizzle-orm', () => ({
  eq: (field: string, value: unknown) => ({ field, value }),
  desc: (field: string) => ({ field }),
}));

vi.mock('../db', () => ({
  db: {
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
            return makeQueryResult(
              [...mockState.historyRows].sort((a, b) =>
                String(b[order.field] ?? '').localeCompare(String(a[order.field] ?? '')),
              ),
            );
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
      },
    }),
  },
}));

const { MatchingWeightsService } = await import('../matchingWeightsService');

describe('MatchingWeightsService', () => {
  let service: InstanceType<typeof MatchingWeightsService>;

  beforeEach(() => {
    mockState.configRows = [];
    mockState.historyRows = [];
    mockState.updateCalls = [];
    mockState.insertCalls = [];
    service = new MatchingWeightsService();
    service.invalidateCache();
  });

  it('normalizes stored decimal weights into runtime percentages and exposes rollout status', async () => {
    mockState.configRows = [
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        personalityWeight: '0.20',
        interestsWeight: '0.25',
        intentWeight: '0.12',
        backgroundWeight: '0.18',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
      },
    ];

    await expect(service.getActiveWeights()).resolves.toEqual({
      personalityWeight: 20,
      interestsWeight: 25,
      intentWeight: 12,
      backgroundWeight: 18,
      cultureWeight: 10,
      conversationSignatureWeight: 15,
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
        personalityWeight: '0.23',
        interestsWeight: '0.24',
        intentWeight: '0.13',
        backgroundWeight: '0.15',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
        totalMatches: 49,
        successfulMatches: 20,
        averageSatisfaction: '4.0000',
        personalityAlpha: 4,
        personalityBeta: 1,
        interestsAlpha: 1,
        interestsBeta: 4,
        intentAlpha: 1,
        intentBeta: 4,
        backgroundAlpha: 1,
        backgroundBeta: 4,
        cultureAlpha: 1,
        cultureBeta: 4,
        conversationSignatureAlpha: 1,
        conversationSignatureBeta: 4,
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
      personality: 80,
      interests: 40,
      intent: 40,
      background: 40,
      culture: 40,
      conversationSignature: 40,
    });

    const activeRow = mockState.configRows[0];
    const runtimeWeights = {
      personalityWeight: Number(activeRow.personalityWeight) * 100,
      interestsWeight: Number(activeRow.interestsWeight) * 100,
      intentWeight: Number(activeRow.intentWeight) * 100,
      backgroundWeight: Number(activeRow.backgroundWeight) * 100,
      cultureWeight: Number(activeRow.cultureWeight) * 100,
      conversationSignatureWeight: Number(activeRow.conversationSignatureWeight) * 100,
    };

    expect(Math.abs(runtimeWeights.personalityWeight - 23)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.interestsWeight - 24)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.intentWeight - 13)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.backgroundWeight - 15)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.cultureWeight - 10)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(Math.abs(runtimeWeights.conversationSignatureWeight - 15)).toBeLessThanOrEqual(MAX_WEIGHT_DELTA_TOLERANCE);
    expect(
      Object.values(runtimeWeights).reduce((sum, value) => sum + value, 0),
    ).toBeCloseTo(100, 3);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_bandit_bounded');
  });

  it('uses the kill switch to reactivate deterministic default weights', async () => {
    mockState.configRows = [
      {
        id: 'default-1',
        configName: 'default',
        isActive: false,
        personalityWeight: '0.23',
        interestsWeight: '0.24',
        intentWeight: '0.13',
        backgroundWeight: '0.15',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
      },
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        personalityWeight: '0.26',
        interestsWeight: '0.21',
        intentWeight: '0.13',
        backgroundWeight: '0.15',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
      },
    ];

    const rollout = await service.setAdaptiveWeightsEnabled(false);

    expect(rollout.adaptiveWeightsEnabled).toBe(false);
    expect(rollout.liveConfigName).toBe('default');
    expect(mockState.configRows.find((row) => row.configName === 'default')?.isActive).toBe(true);
    expect(mockState.configRows.find((row) => row.configName === 'adaptive_live')?.isActive).toBe(false);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_disabled');
  });

  it('rolls back the live adaptive config to the previous history snapshot', async () => {
    mockState.configRows = [
      {
        id: 'adaptive-1',
        configName: 'adaptive_live',
        isActive: true,
        personalityWeight: '0.26',
        interestsWeight: '0.21',
        intentWeight: '0.13',
        backgroundWeight: '0.15',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
      },
    ];
    mockState.historyRows = [
      {
        id: 'history-current',
        configId: 'adaptive-1',
        personalityWeight: '0.26',
        interestsWeight: '0.21',
        intentWeight: '0.13',
        backgroundWeight: '0.15',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
        recordedAt: '2026-04-02T12:00:10.000Z',
      },
      {
        id: 'history-previous',
        configId: 'adaptive-1',
        personalityWeight: '0.23',
        interestsWeight: '0.24',
        intentWeight: '0.13',
        backgroundWeight: '0.15',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
        recordedAt: '2026-04-02T11:59:10.000Z',
      },
    ];

    const rollout = await service.rollbackAdaptiveWeights();

    expect(rollout.adaptiveWeightsEnabled).toBe(true);
    expect(rollout.activeWeights.personalityWeight).toBeCloseTo(23, 3);
    expect(rollout.activeWeights.interestsWeight).toBeCloseTo(24, 3);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_rollback');
  eq: (_field: unknown, value: unknown) => ({ value }),
  desc: (field: unknown) => ({ field, direction: 'desc' }),
}));

function makeAwaitable<T>(value: T) {
  return {
    limit: () => Promise.resolve(value),
    then: (resolve: (resolved: T) => unknown, reject?: (error: unknown) => unknown) =>
      Promise.resolve(value).then(resolve, reject),
  };
}

vi.mock('../db', () => ({
  db: {
    select: () => ({
      from: (table: unknown) => {
        if (table === matchingWeightsConfigTable) {
          return {
            where: () => makeAwaitable(mockState.activeConfig ? [mockState.activeConfig] : []),
          };
        }

        if (table === matchingWeightsHistoryTable) {
          return {
            where: (condition: any) => ({
              orderBy: () => ({
                limit: () => Promise.resolve(
                  mockState.historyRows.filter((row) =>
                    condition?.value ? row.changeReason === condition.value : true,
                  ),
                ),
              }),
            }),
          };
        }

        return {
          where: () => makeAwaitable([]),
        };
      },
    }),
    insert: (_table: unknown) => ({
      values: (values: any) => {
        mockState.insertedValues.push(values);
        return Promise.resolve([values]);
      },
    }),
    update: () => {
      mockState.updateCalls += 1;
      return {
        set: () => ({
          where: () => Promise.resolve([]),
        }),
      };
    },
  },
}));

const {
  buildShadowRecommendation,
  matchingWeightsService,
  SHADOW_RECOMMENDATION_REASON,
} = await import('../matchingWeightsService');

describe('matchingWeightsService shadow recommendations', () => {
  beforeEach(() => {
    mockState.historyRows = [];
    mockState.insertedValues = [];
    mockState.updateCalls = 0;
  });

  it('builds normalized shadow recommendations from outcome signals', () => {
    const recommendation = buildShadowRecommendation(mockState.activeConfig, {
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

    const totalWeight = Object.values(recommendation!.recommendedWeights).reduce((sum, value) => sum + value, 0);
    expect(totalWeight).toBeCloseTo(1, 4);
    expect(recommendation?.dimensionMetrics.personality.sampleCount).toBeGreaterThan(0);
    expect(recommendation?.dimensionMetrics.personality.recommendedWeight).toBeGreaterThan(0);
  });

  it('records shadow recommendations without changing the active live weights', async () => {
    const recommendation = await matchingWeightsService.recordShadowRecommendation({
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
    expect(mockState.insertedValues).toHaveLength(1);
    expect(mockState.insertedValues[0].changeReason).toBe(SHADOW_RECOMMENDATION_REASON);
    expect(mockState.insertedValues[0].shadowMetadata.outcomeSignals.wouldMeetAgain).toBe(true);
    expect(mockState.updateCalls).toBe(0);
  });

  it('does not penalize dimensions that have no outcome signal data', () => {
    const recommendation = buildShadowRecommendation(mockState.activeConfig, {
      eventId: 'event-3',
      feedbackId: 'feedback-3',
      atmosphereScore: 2,
    });

    expect(recommendation).not.toBeNull();
    expect(recommendation?.signalCoverage).toBeLessThan(1);
    expect(recommendation?.dimensionMetrics.personality.hasSignal).toBe(false);
    expect(recommendation?.dimensionMetrics.personality.score).toBeNull();
    expect(recommendation?.dimensionMetrics.personality.posteriorAlpha).toBe(mockState.activeConfig.personalityAlpha);
    expect(recommendation?.dimensionMetrics.personality.posteriorBeta).toBe(mockState.activeConfig.personalityBeta);
    expect(recommendation?.dimensionMetrics.culture.hasSignal).toBe(true);
    expect(recommendation?.dimensionMetrics.culture.posteriorBeta).toBeGreaterThan(mockState.activeConfig.cultureBeta);
  });

  it('returns only shadow recommendation history for admin inspection', async () => {
    mockState.historyRows = [
      { id: 'shadow-1', changeReason: SHADOW_RECOMMENDATION_REASON, recordedAt: new Date().toISOString() },
      { id: 'live-1', changeReason: 'bandit_exploration', recordedAt: new Date().toISOString() },
    ];

    const history = await matchingWeightsService.getShadowRecommendations(10);

    expect(history).toEqual([mockState.historyRows[0]]);
  });
});
