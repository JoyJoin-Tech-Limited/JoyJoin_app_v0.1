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
    expect(Object.values(runtimeWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(100, 3);
    expect(mockState.historyRows.at(-1)?.changeReason).toBe('adaptive_bandit_bounded');
  });

  it('uses a transaction for the kill switch back to deterministic default weights', async () => {
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
        isActive: false,
        personalityWeight: '0.23',
        interestsWeight: '0.24',
        intentWeight: '0.13',
        backgroundWeight: '0.15',
        cultureWeight: '0.10',
        conversationSignatureWeight: '0.15',
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
  });

  it('builds normalized shadow recommendations from outcome signals', () => {
    const activeConfig = {
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
    expect(Object.values(recommendation!.recommendedWeights).reduce((sum, value) => sum + value, 0)).toBeCloseTo(1, 4);
  });

  it('records shadow recommendations without changing live weights', async () => {
    mockState.configRows = [
      {
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
  });

  it('returns only shadow recommendation history for admin inspection', async () => {
    mockState.historyRows = [
      { id: 'shadow-1', configId: 'config-1', changeReason: SHADOW_RECOMMENDATION_REASON, recordedAt: '2026-04-02T12:00:10.000Z' },
      { id: 'live-1', configId: 'config-1', changeReason: 'bandit_exploration', recordedAt: '2026-04-02T12:00:09.000Z' },
    ];

    const history = await service.getShadowRecommendations(10);

    expect(history).toEqual([mockState.historyRows[0]]);
  });
});
