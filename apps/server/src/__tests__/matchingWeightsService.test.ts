import { beforeEach, describe, expect, it, vi } from 'vitest';

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
