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

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}));

// Import AFTER the mocks are registered (vi.mock calls are hoisted by Vitest)
import { getClientForFunction } from '../ai/socialModelRouter';
import { logger } from '../lib/logger';

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

beforeEach(() => {
  vi.mocked(logger.warn).mockClear();
  vi.mocked(logger.info).mockClear();
});

afterEach(() => {
  delete process.env.SOCIAL_AI_PROVIDER;
  delete process.env.MINIMAX_API_KEY;
  delete process.env.MINIMAX_MODEL;
  delete process.env.DEEPSEEK_API_KEY;
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
        'generateAuctionLots',
        'generateProfileTagline',
        'generateConversationTopics',
        'generateWelcomeMessage',
        'generateClosingMessage',
      ] as const;

      for (const fn of fns) {
        const result = getClientForFunction(fn);
        expect(result.provider).toBe('deepseek');
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
        'generateAuctionLots',
        'generateMiniScriptFramework',
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
      expect(logger.warn).toHaveBeenCalledWith(
        'MINIMAX_API_KEY is not set, falling back to deepseek',
        expect.any(Object)
      );
    });
  });

  describe('SOCIAL_AI_PROVIDER=hybrid (default)', () => {
    it('routes all functions to deepseek by default', () => {
      setEnv({});

      const fns = [
        'generateWarmupTopics',
        'generateXiaoYueComment',
        'generateRecapSummary',
        'generateLieDetectiveStatements',
        'generateProfileTagline',
        'generateConversationTopics',
        'generateWelcomeMessage',
        'generateClosingMessage',
      ] as const;

      for (const fn of fns) {
        const result = getClientForFunction(fn);
        expect(result.provider, `${fn} should be deepseek`).toBe('deepseek');
      }
    });

    it('routes analyzeComplexSemantics to deepseek even when MINIMAX_API_KEY is set', () => {
      setEnv({ MINIMAX_API_KEY: 'sk-minimax-test', DEEPSEEK_API_KEY: 'sk-deepseek-test' });

      const result = getClientForFunction('analyzeComplexSemantics');
      expect(result.provider).toBe('deepseek');
    });

    it('routes structured icebreaker functions to deepseek by default', () => {
      setEnv({});

      for (const fn of ['generateMicroChallenges', 'generatePersonalityDiceChallenges', 'generateAuctionLots', 'generateMiniScriptFramework'] as const) {
        const result = getClientForFunction(fn);
        expect(result.provider, `${fn} should be deepseek`).toBe('deepseek');
      }
    });
  });

  describe('SOCIAL_AI_PROVIDER=<unrecognized>', () => {
    it('warns about the invalid value and defaults to hybrid behaviour', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'hybridx' });

      getClientForFunction('generateWarmupTopics');

      expect(logger.warn).toHaveBeenCalledWith(
        'Unrecognized SOCIAL_AI_PROVIDER, defaulting to hybrid',
        expect.objectContaining({ value: 'hybridx' })
      );
    });

    it('uses deepseek for all functions (hybrid fallback) by default', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'bad_value' });

      const result = getClientForFunction('generateWarmupTopics');
      expect(result.provider).toBe('deepseek');
    });

    it('uses deepseek for structural icebreaker functions by default', () => {
      setEnv({ SOCIAL_AI_PROVIDER: 'bad_value' });

      const result = getClientForFunction('generateMicroChallenges');
      expect(result.provider).toBe('deepseek');
    });
  });

  describe('model name resolution', () => {
    it('uses deepseek-v4-flash model for flash-tier functions', () => {
      setEnv({});

      const result = getClientForFunction('generateProfileTagline');
      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-v4-flash');
    });

    it('uses deepseek-v4-flash model for thinking-tier functions', () => {
      setEnv({});

      const result = getClientForFunction('generateMicroChallenges');
      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-v4-flash');
    });
  });
});
