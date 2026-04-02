import { beforeEach, describe, expect, it } from 'vitest';
import { applyRuntimeLLMFallbackPolicy, getRuntimeLLMFallbackConfig, getRuntimeLLMFallbackStats, resetRuntimeLLMFallbackStatsForTest } from '../runtimeLLMFallback';
import { stateManager } from '../stateManager';

describe('runtimeLLMFallback', () => {
  beforeEach(() => {
    resetRuntimeLLMFallbackStatsForTest();
  });

  it('only applies approved fallback fields above the configured confidence threshold', () => {
    // guards against regression: runtime fallback must stay bounded to approved fields
    const { acceptedInferred, evaluation } = applyRuntimeLLMFallbackPolicy(
      [
        {
          field: 'occupation',
          value: '产品经理',
          confidence: 0.82,
          evidence: 'LLM inferred',
        },
        {
          field: 'gender',
          value: '女',
          confidence: 0.93,
          evidence: 'LLM inferred',
        },
        {
          field: 'industry',
          value: '科技互联网',
          confidence: 0.61,
          evidence: 'LLM inferred',
        },
      ],
      {},
      {
        sessionId: 'session-1',
        config: {
          enableRuntimeLLMFallback: true,
          runtimeLLMFallbackMinConfidence: 0.75,
          runtimeLLMFallbackApprovedFields: ['occupation', 'industry'],
        },
      },
    );

    expect(acceptedInferred).toEqual([
      expect.objectContaining({
        field: 'occupation',
        value: '产品经理',
        source: 'llm_fallback',
      }),
    ]);
    expect(evaluation.applied).toBe(1);
    expect(evaluation.rejectedFields.sort()).toEqual(['gender', 'industry']);
  });

  it('tracks fallback stats and skips fields already declared by the user', () => {
    applyRuntimeLLMFallbackPolicy(
      [
        {
          field: 'occupation',
          value: '产品经理',
          confidence: 0.82,
          evidence: 'LLM inferred',
        },
        {
          field: 'lifeStage',
          value: '创业中',
          confidence: 0.9,
          evidence: 'LLM inferred',
        },
      ],
      {
        lifeStage: {
          value: '职场新人',
          source: 'explicit',
          confidence: 1,
          evidence: '用户直接提供',
          timestamp: new Date(),
        },
      },
      {
        config: {
          enableRuntimeLLMFallback: true,
          runtimeLLMFallbackMinConfidence: 0.75,
          runtimeLLMFallbackApprovedFields: ['occupation', 'lifeStage'],
        },
      },
    );

    const stats = getRuntimeLLMFallbackStats();
    expect(stats.totals.attempts).toBe(2);
    expect(stats.totals.applied).toBe(1);
    expect(stats.totals.skippedUserDeclared).toBe(1);
    expect(stats.byField.lifeStage.skipped_user_declared).toBe(1);
    expect(stats.byField.occupation.applied).toBe(1);
  });

  it('trims the env toggle before interpreting disabled values', () => {
    // guards against regression: whitespace in the env flag must not re-enable runtime fallback
    const original = process.env.INFERENCE_RUNTIME_LLM_FALLBACK_ENABLED;
    process.env.INFERENCE_RUNTIME_LLM_FALLBACK_ENABLED = ' false ';

    try {
      const config = getRuntimeLLMFallbackConfig();
      expect(config.enabled).toBe(false);
    } finally {
      if (original === undefined) {
        delete process.env.INFERENCE_RUNTIME_LLM_FALLBACK_ENABLED;
      } else {
        process.env.INFERENCE_RUNTIME_LLM_FALLBACK_ENABLED = original;
      }
    }
  });

  it('does not silently overwrite user-declared values with llm fallback output', () => {
    // guards against regression: explicit user data must always win over fallback inference
    const currentState = {
      industry: {
        value: '教育',
        source: 'explicit' as const,
        confidence: 1,
        evidence: '用户直接提供',
        timestamp: new Date(Date.now() - 10_000),
      },
    };

    const { newState, conflicts } = stateManager.updateInferred(currentState, [
      {
        field: 'industry',
        value: '科技互联网',
        confidence: 0.99,
        evidence: 'LLM inferred',
        source: 'llm_fallback',
      },
    ]);

    expect(newState.industry.value).toBe('教育');
    expect(newState.industry.source).toBe('explicit');
    expect(conflicts).toEqual([
      expect.objectContaining({
        field: 'industry',
        resolution: 'keep_existing',
        reason: '用户直接提供的信息不会被静默覆盖',
      }),
    ]);
  });
});
