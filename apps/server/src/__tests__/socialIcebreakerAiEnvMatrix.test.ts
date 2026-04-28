/**
 * Documents and locks **degraded** env behaviour for social / icebreaker AI routing.
 *
 * Recommended prod: MINIMAX_API_KEY + DEEPSEEK_API_KEY (see docs/LAUNCH_CONFIG.md).
 * MiniMax-only: DeepSeek missing — some paths fall back to DeepSeek client with dummy key
 * (never for forced-DeepSeek functions); miniscript has no DeepSeek recovery without a real key.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

vi.mock('openai', () => ({
  default: class {
    chat = { completions: { create: vi.fn() } };
  },
}));

vi.mock('../ai/minimaxClient', () => ({
  getMinimaxClient: vi.fn(() => null),
  getMinimaxModel: () => 'minimax-m2.7',
  isMinimaxEnabled: () => false,
  MINIMAX_DEFAULT_MODEL: 'minimax-m2.7',
}));

import { getClientForFunction } from '../ai/socialModelRouter';

function resetEnv() {
  delete process.env.SOCIAL_AI_PROVIDER;
  delete process.env.MINIMAX_API_KEY;
  delete process.env.MINIMAX_MODEL;
  delete process.env.DEEPSEEK_API_KEY;
}

describe('social icebreaker AI env matrix (degraded)', () => {
  beforeEach(() => {
    resetEnv();
  });

  afterEach(() => {
    resetEnv();
  });

  it('hybrid: no MiniMax key — warmup routes to DeepSeek when DEEPSEEK_API_KEY is set', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-ds-test';
    const sel = getClientForFunction('generateWarmupTopics');
    expect(sel.provider).toBe('deepseek');
    expect(sel.model).toBe('deepseek-v4-flash');
  });

  it('hybrid: no MiniMax key — micro-challenges still resolve to DeepSeek when key set', () => {
    process.env.DEEPSEEK_API_KEY = 'sk-ds-test';
    const sel = getClientForFunction('generateMicroChallenges');
    expect(sel.provider).toBe('deepseek');
  });
});
