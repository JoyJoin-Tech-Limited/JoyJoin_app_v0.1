import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../llmFallbackInference', () => ({
  buildShadowFallbackCandidates: vi.fn(),
  getLLMFallbackInferenceMode: vi.fn(),
  getShadowFallbackLogs: vi.fn(() => []),
  runShadowLLMFallbackInference: vi.fn(),
}));

import { InferenceEngine } from '../engine';
import {
  buildShadowFallbackCandidates,
  getLLMFallbackInferenceMode,
  runShadowLLMFallbackInference,
} from '../llmFallbackInference';

describe('InferenceEngine shadow fallback scheduling', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('schedules shadow fallback without awaiting the user request path', async () => {
    vi.mocked(getLLMFallbackInferenceMode).mockReturnValue('shadow');
    vi.mocked(buildShadowFallbackCandidates).mockReturnValue([
      {
        dimension: 'career',
        confidence: 0.4,
        insightsCount: 1,
        questionsAsked: 2,
      },
    ]);

    let resolveShadowRun: ((value: {
      mode: 'shadow';
      triggered: true;
      totalLatencyMs: number;
      calls: [];
      scheduledDimensions: ['career'];
    }) => void) | undefined;

    vi.mocked(runShadowLLMFallbackInference).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveShadowRun = resolve as typeof resolveShadowRun;
        }),
    );

    const engine = new InferenceEngine({
      enableLLMFallback: false,
      enableLogging: false,
    });

    const result = await engine.process(
      '我做产品',
      [{ role: 'user', content: '我做产品' }],
      {},
      { sessionId: 'shadow-schedule-session' },
    );

    expect(result.debug.shadowLLMFallback).toEqual({
      mode: 'shadow',
      triggered: false,
      scheduled: true,
      totalLatencyMs: 0,
      scheduledDimensions: ['career'],
      calls: [],
    });
    expect(runShadowLLMFallbackInference).toHaveBeenCalledOnce();
    expect(resolveShadowRun).toBeTypeOf('function');

    resolveShadowRun?.({
      mode: 'shadow',
      triggered: true,
      totalLatencyMs: 25,
      calls: [],
      scheduledDimensions: ['career'],
    });
  });
});
