/**
 * Unit tests for the AI Call Trace Logger
 *
 * Verifies that logAITrace emits well-formed structured records and that
 * the output format is consistent and machine-readable.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logAITrace, type AICallTrace } from '../lib/aiTraceLogger';

describe('logAITrace', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleSpy.mockRestore();
  });

  function captureTraceRecord(): AICallTrace {
    expect(consoleSpy).toHaveBeenCalledOnce();
    const [line] = consoleSpy.mock.calls[0] as [string];
    expect(line).toMatch(/^\[AITrace\] /);
    return JSON.parse(line.replace('[AITrace] ', '')) as AICallTrace;
  }

  it('should emit a line prefixed with [AITrace]', () => {
    logAITrace({
      domain: 'match_explanation',
      feature: 'generatePairExplanation',
      provider: 'deepseek',
      latencyMs: 120,
      success: true,
      fallbackUsed: false,
      fromCache: false,
    });
    const [line] = consoleSpy.mock.calls[0] as [string];
    expect(line.startsWith('[AITrace] ')).toBe(true);
  });

  it('should include required fields in the record', () => {
    logAITrace({
      domain: 'match_explanation',
      feature: 'generatePairExplanation',
      provider: 'minimax',
      model: 'minimax-m2.7',
      latencyMs: 200,
      success: true,
      fallbackUsed: false,
      fromCache: false,
    });

    const record = captureTraceRecord();
    expect(record.domain).toBe('match_explanation');
    expect(record.feature).toBe('generatePairExplanation');
    expect(record.provider).toBe('minimax');
    expect(record.model).toBe('minimax-m2.7');
    expect(record.latencyMs).toBe(200);
    expect(record.success).toBe(true);
    expect(record.fallbackUsed).toBe(false);
    expect(record.fromCache).toBe(false);
  });

  it('should auto-populate traceId and timestamp when not provided', () => {
    logAITrace({
      domain: 'icebreaker',
      feature: 'generateWarmupTopics',
      provider: 'deepseek',
      latencyMs: 80,
      success: true,
      fallbackUsed: false,
      fromCache: false,
    });

    const record = captureTraceRecord();
    expect(typeof record.traceId).toBe('string');
    expect(record.traceId.length).toBeGreaterThan(0);
    expect(typeof record.timestamp).toBe('string');
    // ISO-8601 format check
    expect(() => new Date(record.timestamp)).not.toThrow();
    expect(new Date(record.timestamp).toISOString()).toBe(record.timestamp);
  });

  it('should use provided traceId and timestamp when given', () => {
    const customTraceId = 'custom-trace-123';
    const customTimestamp = '2025-01-01T12:00:00.000Z';

    logAITrace({
      traceId: customTraceId,
      timestamp: customTimestamp,
      domain: 'icebreaker',
      feature: 'generateMicroChallenges',
      provider: 'deepseek',
      latencyMs: 50,
      success: true,
      fallbackUsed: false,
      fromCache: false,
    });

    const record = captureTraceRecord();
    expect(record.traceId).toBe(customTraceId);
    expect(record.timestamp).toBe(customTimestamp);
  });

  it('should record fallback traces correctly', () => {
    logAITrace({
      domain: 'match_explanation',
      feature: 'generatePairExplanation',
      provider: null,
      latencyMs: 500,
      success: false,
      fallbackUsed: true,
      fromCache: false,
      errorCode: 'llm_error',
    });

    const record = captureTraceRecord();
    expect(record.provider).toBeNull();
    expect(record.success).toBe(false);
    expect(record.fallbackUsed).toBe(true);
    expect(record.errorCode).toBe('llm_error');
  });

  it('should record cache-hit traces correctly', () => {
    logAITrace({
      domain: 'match_explanation',
      feature: 'generateGroupAnalysis',
      provider: null,
      latencyMs: 2,
      success: true,
      fallbackUsed: false,
      fromCache: true,
    });

    const record = captureTraceRecord();
    expect(record.fromCache).toBe(true);
    expect(record.success).toBe(true);
  });

  it('should omit undefined optional fields from the emitted JSON', () => {
    logAITrace({
      domain: 'icebreaker',
      feature: 'generateWarmupTopics',
      provider: 'deepseek',
      latencyMs: 100,
      success: true,
      fallbackUsed: false,
      fromCache: false,
    });

    const record = captureTraceRecord();
    // Optional fields not provided should not appear in output
    expect('model' in record).toBe(false);
    expect('promptVersion' in record).toBe(false);
    expect('errorCode' in record).toBe(false);
  });

  it('should include optional fields when provided', () => {
    logAITrace({
      domain: 'icebreaker',
      feature: 'generateWarmupTopics',
      provider: 'deepseek',
      model: 'deepseek-v4-flash',
      latencyMs: 95,
      success: true,
      fallbackUsed: false,
      fromCache: false,
      promptVersion: 'v1.2',
    });

    const record = captureTraceRecord();
    expect(record.model).toBe('deepseek-v4-flash');
    expect(record.promptVersion).toBe('v1.2');
  });

  it('should produce unique traceIds across multiple calls', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 10; i++) {
      consoleSpy.mockClear();
      logAITrace({
        domain: 'test',
        feature: 'test_fn',
        provider: 'deepseek',
        latencyMs: 1,
        success: true,
        fallbackUsed: false,
        fromCache: false,
      });
      const record = captureTraceRecord();
      ids.add(record.traceId);
      consoleSpy.mockClear();
    }
    // All 10 should have different IDs
    expect(ids.size).toBe(10);
  });
});
