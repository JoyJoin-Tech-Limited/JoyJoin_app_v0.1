import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { UserAttributeMap } from '../types';
import {
  clearShadowFallbackLogs,
  getShadowFallbackLogs,
  runShadowLLMFallbackInference,
} from '../llmFallbackInference';
import { _resetMetricsForTest, getMetricsText } from '../../middleware/metrics';

describe('LLM fallback shadow mode', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    process.env.LLM_FALLBACK_INFERENCE_MODE = 'shadow';
    clearShadowFallbackLogs();
    _resetMetricsForTest();
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    delete process.env.LLM_FALLBACK_INFERENCE_MODE;
    clearShadowFallbackLogs();
    _resetMetricsForTest();
    consoleSpy.mockRestore();
  });

  it('only runs when shadow mode is enabled', async () => {
    delete process.env.LLM_FALLBACK_INFERENCE_MODE;
    const executeInference = vi.fn();

    const summary = await runShadowLLMFallbackInference({
      userMessage: '我在互联网做产品，想认识聊得来的人',
      conversationHistory: [{ role: 'user', content: '先认识一下' }],
      currentState: {},
      matcherConfidence: 0.2,
      executeInference,
    });

    expect(summary.mode).toBe('disabled');
    expect(summary.triggered).toBe(false);
    expect(executeInference).not.toHaveBeenCalled();
    expect(getShadowFallbackLogs()).toHaveLength(0);
  });

  it('records inspectable shadow inference logs and metrics without mutating canonical state', async () => {
    const timestamp = new Date('2026-04-02T00:00:00.000Z');
    const currentState: UserAttributeMap = {
      occupationHint: {
        value: '产品',
        source: 'inferred',
        confidence: 0.4,
        evidence: '我在互联网做产品',
        timestamp,
      },
    };
    const originalState = structuredClone(currentState);

    const summary = await runShadowLLMFallbackInference({
      sessionId: 'session-shadow-1',
      userMessage: '我在互联网做产品，想认识聊得来的人',
      conversationHistory: [
        { role: 'assistant', content: '你平时是做什么的呀？' },
        { role: 'user', content: '我在互联网做产品' },
      ],
      currentState,
      matcherConfidence: 0.35,
      executeInference: vi.fn(async ({ dimension }) => ({
        success: true,
        insights:
          dimension === 'career'
            ? ['互联网产品经理']
            : ['期待认识聊得来的人'],
        confidence: dimension === 'career' ? 0.82 : 0.76,
        reasoning: `${dimension}-shadow-reasoning`,
      })),
    });

    expect(summary.mode).toBe('shadow');
    expect(summary.triggered).toBe(true);
    expect(summary.calls).toHaveLength(2);
    expect(summary.calls.map((call) => call.dimension).sort()).toEqual(['career', 'expectation']);
    const careerCall = summary.calls.find((call) => call.dimension === 'career');
    expect(careerCall?.inferredAttributes).toEqual(['互联网产品经理']);
    expect(careerCall?.confidence).toBe(0.82);
    expect(careerCall?.reasoning).toBe('career-shadow-reasoning');
    expect(careerCall?.estimatedCostUsd).toBeGreaterThan(0);
    expect(currentState).toEqual(originalState);

    const logs = getShadowFallbackLogs();
    expect(logs).toHaveLength(2);
    const careerLog = logs.find((entry) => entry.dimension === 'career');
    const expectationLog = logs.find((entry) => entry.dimension === 'expectation');
    expect(careerLog?.sessionId).toBe('session-shadow-1');
    expect(careerLog?.provider).toBe('deepseek');
    expect(careerLog?.mode).toBe('shadow');
    expect(careerLog?.sourceConfidence).toBe(0.4);
    expect(expectationLog?.sourceInsightsCount).toBe(0);

    expect(consoleSpy).toHaveBeenCalledTimes(2);
    const [firstTraceLine] = consoleSpy.mock.calls[0] as [string];
    expect(firstTraceLine).toContain('[AITrace]');
    expect(firstTraceLine).toContain('"domain":"attribute_inference"');
    expect(firstTraceLine).toContain('"feature":"shadowLLMFallbackInference"');

    const metricsText = await getMetricsText();
    expect(metricsText).toContain('llm_fallback_inference_requests_total');
    expect(metricsText).toContain('llm_fallback_inference_latency_ms');
    expect(metricsText).toContain('llm_fallback_inference_estimated_cost_usd_total');
    expect(metricsText).toContain('provider="deepseek"');
    expect(metricsText).toContain('mode="shadow"');
  });
});
