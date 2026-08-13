/**
 * Regression tests for DeepSeek thinking-control helpers.
 *
 * Locks the 2026-08-11 fix: DeepSeek V4 models reason by default when a request
 * carries no thinking control, which burns the completion budget on
 * `reasoning_content` and returns empty/truncated `message.content` at
 * production max_tokens budgets. Non-thinking tiers must explicitly send
 * `thinking: { type: 'disabled' }`.
 */

import { describe, it, expect } from 'vitest';
import {
  buildThinkingExtraBody,
  getReasoningEffort,
  isDeepSeekThinkingTier,
} from '../aiModels';

describe('isDeepSeekThinkingTier', () => {
  it('classifies tiers correctly', () => {
    expect(isDeepSeekThinkingTier('flash')).toBe(false);
    expect(isDeepSeekThinkingTier('flash-thinking')).toBe(true);
    expect(isDeepSeekThinkingTier('pro-thinking')).toBe(true);
  });
});

describe('getReasoningEffort', () => {
  it('returns undefined for non-thinking tiers', () => {
    expect(getReasoningEffort('flash')).toBeUndefined();
  });

  it('defaults medium for flash-thinking and high for pro-thinking', () => {
    expect(getReasoningEffort('flash-thinking')).toBe('medium');
    expect(getReasoningEffort('pro-thinking')).toBe('high');
  });

  it('honors explicit overrides', () => {
    expect(getReasoningEffort('flash-thinking', 'max')).toBe('max');
    expect(getReasoningEffort('pro-thinking', 'max')).toBe('max');
  });
});

describe('buildThinkingExtraBody', () => {
  it('explicitly disables thinking for the flash tier (2026-08-11 regression)', () => {
    expect(buildThinkingExtraBody('flash')).toEqual({
      thinking: { type: 'disabled' },
    });
  });

  it('enables thinking with default effort for thinking tiers', () => {
    expect(buildThinkingExtraBody('flash-thinking')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'medium',
    });
    expect(buildThinkingExtraBody('pro-thinking')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'high',
    });
  });

  it('honors the reasoning-effort override on thinking tiers', () => {
    expect(buildThinkingExtraBody('flash-thinking', 'max')).toEqual({
      thinking: { type: 'enabled' },
      reasoning_effort: 'max',
    });
  });
});
