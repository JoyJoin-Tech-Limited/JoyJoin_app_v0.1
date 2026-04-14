/**
 * Unit tests for Social Icebreaker Model Router
 * Covers routing table, SOCIAL_AI_PROVIDER modes, fallback behaviour, and env validation.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type OpenAI from 'openai';

// ─── Mock OpenAI so the constructor doesn't require real credentials ──────────
vi.mock('openai', () => {
  class MockOpenAI {
    chat = { completions: { create: vi.fn() } };
    constructor(_config: unknown) {}
  }
  return { default: MockOpenAI };
});

// ─── Mock minimaxClient so the router responds to env changes per-test ────────
// The getter pattern makes minimaxClient re-evaluate MINIMAX_API_KEY on every
// access, which lets us control it via process.env inside individual tests.
vi.mock('../ai/minimaxClient', () => ({
  get minimaxClient(): OpenAI | null {
    return process.env.MINIMAX_API_KEY
      ? ({ __isMinimax: true } as unknown as OpenAI)
      : null;
  },
  getMinimaxModel: () => process.env.MINIMAX_MODEL || 'minimax-m2.7',
  getMinimaxClient: (): OpenAI | null => {
    return process.env.MINIMAX_API_KEY
      ? ({ __isMinimax: true } as unknown as OpenAI)
      : null;
  },
  isMinimaxEnabled: (): boolean => {
    return Boolean(process.env.MINIMAX_API_KEY);
  },
  MINIMAX_DEFAULT_MODEL: 'minimax-m2.7',
}));

// Import AFTER the mocks are registered (vi.mock calls are hoisted by Vitest)
import { getClientForFunction } from '../ai/socialModelRouter';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function setEnv(overrides: Record<string, string | undefined>) {
  delete process.env.SOCIAL_AI_PROVIDER;
  delete process.env.MINIMAX_API_KEY;
  delete process.env.MINIMAX_MODEL;
  for (const [k, v] of Object.entries(overrides)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
}

const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

beforeEach(() => {
  consoleSpy.mockClear();
});

afterEach(() => {
  delete process.env.SOCIAL_AI_PROVIDER;
  delete process.env.MINIMAX_API_KEY;
  delete process.env.MINIMAX_MODEL;
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('socialModelRouter', () => {
  describe('SOCIAL_AI_PROVIDER=deepseek', () => {
    it('always returns deepseek for all functions, even when MINIMAX_API_KEY is set', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'deepseek', MINIMAX_API_KEY: 'sk-minimax-test' });

      const fns = [
        'generateWarmupTopics',
        'generateXiaoYueComment',
        'generateRecapSummary',
        'generateLieDetectiveStatements',
        'generateMicroChallenges',
        'generatePersonalityDiceChallenges',
        'generateProfileTagline',
        'generateConversationTopics',
        'generateWelcomeMessage',
        'generateClosingMessage',
      ] as const;

      for (const fn of fns) {
        const result = getClientForFunction(fn);
        expect(result.provider).toBe('deepseek');
        expect(result.model).toBe('deepseek-chat');
      }
    });
  });

  describe('SOCIAL_AI_PROVIDER=minimax', () => {
    it('returns minimax for all functions when MINIMAX_API_KEY is set', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'minimax', MINIMAX_API_KEY: 'sk-minimax-test' });

      const fns = [
        'generateWarmupTopics',
        'generateMicroChallenges',
        'generatePersonalityDiceChallenges',
        'generateProfileTagline',
        'generateConversationTopics',
        'generateWelcomeMessage',
        'generateClosingMessage',
      ] as const;

      for (const fn of fns) {
        const result = getClientForFunction(fn);
        expect(result.provider).toBe('minimax');
      }
    });

    it('falls back to deepseek and warns when MINIMAX_API_KEY is not set', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'minimax' });

      const result = getClientForFunction('generateWarmupTopics');
      expect(result.provider).toBe('deepseek');
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('MINIMAX_API_KEY is not set')
      );
    });
  });

  describe('SOCIAL_AI_PROVIDER=hybrid (default)', () => {
    it('routes MiniMax-designated functions to minimax when MINIMAX_API_KEY is set', () => {
      setEnv({ MINIMAX_API_KEY: 'sk-minimax-test' });

      const minimaxFns = [
        'generateWarmupTopics',
        'generateXiaoYueComment',
        'generateRecapSummary',
        'generateLieDetectiveStatements',
        'generateProfileTagline',
        'generateConversationTopics',
        'generateWelcomeMessage',
        'generateClosingMessage',
      ] as const;

      for (const fn of minimaxFns) {
        const result = getClientForFunction(fn);
        expect(result.provider, `${fn} should be minimax`).toBe('minimax');
      }
    });

    it('routes DeepSeek-designated functions to deepseek even when MINIMAX_API_KEY is set', () => {
      setEnv({ MINIMAX_API_KEY: 'sk-minimax-test' });

      const deepseekFns = [
        'generateMicroChallenges',
        'generatePersonalityDiceChallenges',
      ] as const;

      for (const fn of deepseekFns) {
        const result = getClientForFunction(fn);
        expect(result.provider, `${fn} should be deepseek`).toBe('deepseek');
      }
    });

    it('falls back to deepseek for MiniMax functions and warns when MINIMAX_API_KEY is not set', () => {
      setEnv({});

      const minimaxFns = [
        'generateWarmupTopics',
        'generateXiaoYueComment',
        'generateRecapSummary',
        'generateLieDetectiveStatements',
      ] as const;

      for (const fn of minimaxFns) {
        consoleSpy.mockClear();
        const result = getClientForFunction(fn);
        expect(result.provider, `${fn} should fall back to deepseek`).toBe('deepseek');
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('MINIMAX_API_KEY is not set')
        );
      }
    });
  });

  describe('SOCIAL_AI_PROVIDER=<unrecognized>', () => {
    it('warns about the invalid value and defaults to hybrid behaviour', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'hybridx', MINIMAX_API_KEY: 'sk-minimax-test' });

      getClientForFunction('generateWarmupTopics'); // triggers resolveMode()

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Unrecognized SOCIAL_AI_PROVIDER="hybridx"')
      );
    });

    it('uses minimax for MiniMax functions (hybrid fallback) when key is set', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'bad_value', MINIMAX_API_KEY: 'sk-minimax-test' });

      const result = getClientForFunction('generateWarmupTopics');
      expect(result.provider).toBe('minimax');
    });

    it('uses deepseek for structural functions (hybrid fallback)', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'bad_value', MINIMAX_API_KEY: 'sk-minimax-test' });

      const result = getClientForFunction('generateMicroChallenges');
      expect(result.provider).toBe('deepseek');
    });
  });

  describe('model name resolution', () => {
    it('uses minimax-m2.7 model by default', () => {
      setEnv({ MINIMAX_API_KEY: 'sk-minimax-test' });

      const result = getClientForFunction('generateWarmupTopics');
      expect(result.provider).toBe('minimax');
      expect(result.model).toBe('minimax-m2.7');
    });

    it('uses deepseek-chat model for DeepSeek functions', () => {
      setEnv({});

      const result = getClientForFunction('generateMicroChallenges');
      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-chat');
    });
  });
});


