/**
 * Unit tests for the Social Icebreaker AI benchmark harness.
 *
 * Uses mocked callSocialAI so no real network calls are made.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('../../ai/socialModelRouter', () => ({
  callSocialAI: vi.fn(),
}));

import {
  runSocialAIBenchmark,
  formatBenchmarkReport,
  BENCHMARK_FIXTURES,
  getDefaultModelConfigs,
  type BenchmarkModelConfig,
} from '../socialAIBenchmark';
import { callSocialAI } from '../../ai/socialModelRouter';

describe('getDefaultModelConfigs', () => {
  afterEach(() => {
    delete process.env.BENCHMARK_MODELS;
  });

  it('returns the default three-model matrix when env is unset', () => {
    const configs = getDefaultModelConfigs();
    expect(configs).toHaveLength(3);
    expect(configs.map((c) => c.label)).toEqual([
      'minimax-m2.7',
      'minimax-m2.7-highspeed',
      'deepseek-v4-flash',
    ]);
  });

  it('parses BENCHMARK_MODELS as comma-separated labels', () => {
    process.env.BENCHMARK_MODELS = 'custom-model,deepseek-v4-flash';
    const configs = getDefaultModelConfigs();
    expect(configs).toHaveLength(2);
    expect(configs[0].label).toBe('custom-model');
    expect(configs[0].provider).toBe('minimax');
    expect(configs[1].label).toBe('deepseek-v4-flash');
    expect(configs[1].provider).toBe('deepseek');
  });
});

describe('runSocialAIBenchmark', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const mockCallSocialAI = () => vi.mocked(callSocialAI);

  afterEach(() => {
    delete process.env.BENCHMARK_MODELS;
  });

  it('runs all fixtures against all models for the requested iterations', async () => {
    mockCallSocialAI().mockResolvedValue({
      content: '大家好，开始破冰吧！🌟',
      provider: 'minimax',
      model: 'minimax-m2.7',
      latencyMs: 120,
      fallbackUsed: false,
    });

    const models: BenchmarkModelConfig[] = [
      { label: 'fast-model', provider: 'minimax', model: 'minimax-fast' },
    ];

    const report = await runSocialAIBenchmark({
      iterations: 2,
      models,
      fixtures: BENCHMARK_FIXTURES,
    });

    // 3 fixtures × 1 model × 2 iterations = 6 calls
    expect(mockCallSocialAI()).toHaveBeenCalledTimes(6);
    expect(report.iterationsPerFixture).toBe(2);
    expect(report.models).toEqual(models);
    expect(report.results).toHaveLength(6);
  });

  it('marks validation invalid when JSON fixtures return non-JSON', async () => {
    mockCallSocialAI().mockResolvedValue({
      content: 'not valid json',
      provider: 'minimax',
      model: 'minimax-m2.7',
      latencyMs: 100,
      fallbackUsed: false,
    });

    const models: BenchmarkModelConfig[] = [
      { label: 'bad-model', provider: 'minimax', model: 'minimax-bad' },
    ];

    const report = await runSocialAIBenchmark({
      iterations: 1,
      models,
      fixtures: BENCHMARK_FIXTURES.filter((f) => f.id === 'warmup-topics'),
    });

    const result = report.results[0];
    expect(result.success).toBe(true);
    expect(result.validationValid).toBe(false);
    expect(result.validationError).toBe('json_parse');
  });

  it('marks success=false when callSocialAI throws', async () => {
    mockCallSocialAI().mockRejectedValue(new Error('timeout'));

    const models: BenchmarkModelConfig[] = [
      { label: 'error-model', provider: 'minimax', model: 'minimax-err' },
    ];

    const report = await runSocialAIBenchmark({
      iterations: 1,
      models,
      fixtures: BENCHMARK_FIXTURES.filter((f) => f.id === 'xiaoyue-comment'),
    });

    const result = report.results[0];
    expect(result.success).toBe(false);
    expect(result.error).toContain('timeout');
    expect(result.validationValid).toBe(false);
  });

  it('computes latency percentiles correctly', async () => {
    let callIndex = 0;
    const latencies = [50, 100, 150, 200, 250];
    mockCallSocialAI().mockImplementation(() => {
      const latency = latencies[callIndex % latencies.length];
      callIndex += 1;
      return Promise.resolve({
        content: 'sample',
        provider: 'minimax',
        model: 'minimax-m2.7',
        latencyMs: latency,
        fallbackUsed: false,
      });
    });

    const models: BenchmarkModelConfig[] = [
      { label: 'latency-model', provider: 'minimax', model: 'minimax-lat' },
    ];

    const report = await runSocialAIBenchmark({
      iterations: 5,
      models,
      fixtures: BENCHMARK_FIXTURES.filter((f) => f.id === 'xiaoyue-comment'),
    });

    const summary = report.summary[0];
    expect(summary.p50LatencyMs).toBe(150);
    expect(summary.p95LatencyMs).toBe(240); // 0.95 * 4 = 3.8 → 200*0.2 + 250*0.8 = 240
    expect(summary.minLatencyMs).toBe(50);
    expect(summary.maxLatencyMs).toBe(250);
  });

  it('passes modelOverride to callSocialAI for each config', async () => {
    mockCallSocialAI().mockResolvedValue({
      content: 'ok',
      provider: 'minimax',
      model: 'minimax-m2.7-highspeed',
      latencyMs: 80,
      fallbackUsed: false,
    });

    const models: BenchmarkModelConfig[] = [
      { label: 'highspeed', provider: 'minimax', model: 'minimax-m2.7-highspeed' },
    ];

    await runSocialAIBenchmark({
      iterations: 1,
      models,
      fixtures: BENCHMARK_FIXTURES.filter((f) => f.id === 'xiaoyue-comment'),
    });

    expect(mockCallSocialAI()).toHaveBeenCalledWith(
      expect.objectContaining({
        modelOverride: 'minimax-m2.7-highspeed',
        callerTag: 'xiaoyue-comment',
      })
    );
  });
});

describe('formatBenchmarkReport', () => {
  it('produces a human-readable summary', () => {
    const report = {
      ranAt: '2024-01-01T00:00:00.000Z',
      iterationsPerFixture: 2,
      models: [{ label: 'm1', provider: 'minimax', model: 'minimax-m2.7' }],
      results: [
        {
          fixtureId: 'xiaoyue-comment',
          modelLabel: 'm1',
          provider: 'minimax',
          model: 'minimax-m2.7',
          iteration: 0,
          latencyMs: 100,
          success: true,
          validationValid: true,
          contentSample: 'hello',
        },
        {
          fixtureId: 'xiaoyue-comment',
          modelLabel: 'm1',
          provider: 'minimax',
          model: 'minimax-m2.7',
          iteration: 1,
          latencyMs: 120,
          success: true,
          validationValid: true,
          contentSample: 'world',
        },
      ],
      summary: [
        {
          fixtureId: 'xiaoyue-comment',
          modelLabel: 'm1',
          provider: 'minimax',
          model: 'minimax-m2.7',
          iterations: 2,
          successCount: 2,
          validCount: 2,
          meanLatencyMs: 110,
          p50LatencyMs: 110,
          p95LatencyMs: 116,
          p99LatencyMs: 119,
          minLatencyMs: 100,
          maxLatencyMs: 120,
        },
      ],
    };

    const formatted = formatBenchmarkReport(report as any);
    expect(formatted).toContain('JoyJoin Social Icebreaker AI Benchmark');
    expect(formatted).toContain('xiaoyue-comment');
    expect(formatted).toContain('success: 2/2');
    expect(formatted).toContain('mean=110ms');
  });
});
