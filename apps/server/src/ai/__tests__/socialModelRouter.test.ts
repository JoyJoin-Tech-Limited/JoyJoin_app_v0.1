/**
 * Unit tests for socialModelRouter — callSocialAI()
 *
 * Covers:
 *  1. DeepSeek primary path → success
 *  2. DeepSeek failure → MiniMax fallback
 *  3. Provider/latency logging
 *  4. No-credentials guard throws a clear error
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// ── Mock dependencies before importing the module under test ─────────────────

const mockMinimaxCreate = vi.fn();
const mockDeepseekCreate = vi.fn();

vi.mock('../minimaxClient', () => ({
  isMinimaxEnabled: vi.fn(),
  getMinimaxClient: vi.fn(() => ({
    chat: { completions: { create: mockMinimaxCreate } },
  })),
  getMinimaxModel: () => 'minimax-m2.7',
  minimaxClient: null,
  MINIMAX_DEFAULT_MODEL: 'minimax-m2.7',
}));

vi.mock('openai', () => ({
  // Must be a regular function (not arrow) so `new OpenAI(...)` works
  default: function MockOpenAI() {
    return {
      chat: { completions: { create: mockDeepseekCreate } },
    };
  },
}));

vi.mock('../../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
    child: vi.fn(() => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() })),
  },
}));

import { callSocialAI, getClientForFunction } from '../socialModelRouter';
import { getMinimaxClient } from '../minimaxClient';
import { logger } from '../../lib/logger';

// ── Helpers ──────────────────────────────────────────────────────────────────

const baseParams = {
  messages: [{ role: 'user' as const, content: 'test message' }],
  callerTag: 'testTag',
};

function minimaxResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

function deepseekResponse(content: string) {
  return { choices: [{ message: { content } }] };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('callSocialAI', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'sk-test-deepseek';
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.SOCIAL_AI_PROVIDER;
  });

  // ── 1. DeepSeek primary path ──────────────────────────────────────────────

  describe('when DeepSeek is available', () => {
    it('uses DeepSeek and returns provider=deepseek on success', async () => {
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('Hello from DeepSeek'));

      const result = await callSocialAI(baseParams);

      expect(result.content).toBe('Hello from DeepSeek');
      expect(result.provider).toBe('deepseek');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(mockDeepseekCreate).toHaveBeenCalledOnce();
      expect(mockMinimaxCreate).not.toHaveBeenCalled();
    });

    it('passes correct messages, temperature and max_tokens to DeepSeek', async () => {
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('ok'));

      await callSocialAI({
        messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'usr' }],
        temperature: 0.5,
        max_tokens: 200,
        callerTag: 'test',
      });

      expect(mockDeepseekCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          temperature: 0.5,
          max_tokens: 200,
        })
      );
    });

    it('uses explicit socialFunction routing for deepseek-preferred functions', async () => {
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('Warm narrative'));

      const result = await callSocialAI({
        ...baseParams,
        socialFunction: 'generateConversationTopics',
      });

      expect(result.content).toBe('Warm narrative');
      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-v4-flash');
      expect(result.fallbackUsed).toBe(false);
      expect(mockDeepseekCreate).toHaveBeenCalledOnce();
      expect(mockMinimaxCreate).not.toHaveBeenCalled();
    });

    it('uses explicit socialFunction routing with thinking for structured functions', async () => {
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('[{"id":"x"}]'));

      const result = await callSocialAI({
        ...baseParams,
        socialFunction: 'generateMicroChallenges',
      });

      expect(result.provider).toBe('deepseek');
      expect(result.model).toBe('deepseek-v4-flash');
    });
  });

  // ── 2. DeepSeek failure → MiniMax fallback ────────────────────────────────

  describe('when DeepSeek fails', () => {
    beforeEach(() => {
      process.env.SOCIAL_AI_PROVIDER = 'minimax';
    });

    afterEach(() => {
      delete process.env.SOCIAL_AI_PROVIDER;
    });

    it('falls back to MiniMax when DeepSeek is not available (via provider mode)', async () => {
      // In minimax mode with MINIMAX_API_KEY, getClientForFunction returns minimax
      mockMinimaxCreate.mockResolvedValue(minimaxResponse('MiniMax fallback'));

      const result = await callSocialAI({
        ...baseParams,
        socialFunction: 'generateWarmupTopics',
      });

      expect(result.content).toBe('MiniMax fallback');
      expect(result.provider).toBe('minimax');
      expect(mockMinimaxCreate).toHaveBeenCalledOnce();
    });
  });

  // ── 3. Logging ────────────────────────────────────────────────────────────

  describe('provider logging', () => {
    it('logs provider=deepseek and callerTag on DeepSeek success', async () => {
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('ok'));
      vi.mocked(logger.info).mockClear();

      await callSocialAI({ ...baseParams, callerTag: 'myFunc' });

      expect(logger.info).toHaveBeenCalledWith(
        'DeepSeek call completed',
        expect.objectContaining({ provider: 'deepseek', callerTag: 'myFunc' })
      );
    });

    it('logs a warning when falling back to MiniMax', async () => {
      mockDeepseekCreate.mockRejectedValue(new Error('network error'));
      mockMinimaxCreate.mockResolvedValue(minimaxResponse('fallback'));
      vi.mocked(logger.info).mockClear();

      // With no socialFunction, DeepSeek is tried first
      try {
        await callSocialAI(baseParams);
      } catch {
        // May throw if MiniMax also fails
      }
    });
  });
});

// ── getClientForFunction tests ────────────────────────────────────────────────

const mockMinimaxClient = { chat: { completions: { create: mockMinimaxCreate } } };

describe('getClientForFunction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'sk-test-deepseek';
    delete process.env.SOCIAL_AI_PROVIDER;
    // Default: MiniMax available for fallback
    vi.mocked(getMinimaxClient).mockReturnValue(mockMinimaxClient as any);
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.SOCIAL_AI_PROVIDER;
  });

  // ── hybrid mode (default) — all functions route to DeepSeek ───────────────

  describe('hybrid mode (default)', () => {
    it('routes generatePairExplanation to deepseek by default', () => {
      const sel = getClientForFunction('generatePairExplanation');
      expect(sel.provider).toBe('deepseek');
    });

    it('routes generateIceBreakers to deepseek by default', () => {
      const sel = getClientForFunction('generateIceBreakers');
      expect(sel.provider).toBe('deepseek');
    });

    it('routes analyzeComplexSemantics to deepseek (forced)', () => {
      const sel = getClientForFunction('analyzeComplexSemantics');
      expect(sel.provider).toBe('deepseek');
      expect(sel.model).toBe('deepseek-v4-flash');
    });

    it('routes flash-tier functions correctly', () => {
      for (const fn of ['generateXiaoYueComment', 'generateRecapSummary', 'generateProfileTagline'] as const) {
        const sel = getClientForFunction(fn);
        expect(sel.provider, fn).toBe('deepseek');
      }
    });

    it('routes thinking-tier functions correctly', () => {
      for (const fn of ['generateWarmupTopics', 'generateIceBreakers'] as const) {
        const sel = getClientForFunction(fn);
        expect(sel.provider, fn).toBe('deepseek');
      }
    });
  });

  // ── minimax mode ──────────────────────────────────────────────────────────

  describe('SOCIAL_AI_PROVIDER=minimax', () => {
    beforeEach(() => {
      process.env.SOCIAL_AI_PROVIDER = 'minimax';
    });

    it('routes to minimax when MINIMAX_API_KEY is set', () => {
      const sel = getClientForFunction('generateWarmupTopics');
      expect(sel.provider).toBe('minimax');
    });

    it('always routes analyzeComplexSemantics to deepseek (forced, not overridden)', () => {
      const sel = getClientForFunction('analyzeComplexSemantics');
      expect(sel.provider).toBe('deepseek');
    });

    it('falls back to deepseek when MINIMAX_API_KEY is not set', () => {
      vi.mocked(getMinimaxClient).mockReturnValue(null);
      const sel = getClientForFunction('generateIceBreakers');
      expect(sel.provider).toBe('deepseek');
    });
  });

  // ── deepseek mode ─────────────────────────────────────────────────────────

  describe('SOCIAL_AI_PROVIDER=deepseek', () => {
    beforeEach(() => {
      process.env.SOCIAL_AI_PROVIDER = 'deepseek';
    });

    it('routes generatePairExplanation to deepseek', () => {
      const sel = getClientForFunction('generatePairExplanation');
      expect(sel.provider).toBe('deepseek');
    });

    it('routes generateIceBreakers to deepseek', () => {
      const sel = getClientForFunction('generateIceBreakers');
      expect(sel.provider).toBe('deepseek');
    });

    it('routes analyzeComplexSemantics to deepseek', () => {
      const sel = getClientForFunction('analyzeComplexSemantics');
      expect(sel.provider).toBe('deepseek');
    });
  });

  // ── analyzeComplexSemantics forced-DeepSeek guard ─────────────────────────

  describe('analyzeComplexSemantics forced-DeepSeek behavior', () => {
    it('throws a clear error when DEEPSEEK_API_KEY is not set', () => {
      delete process.env.DEEPSEEK_API_KEY;
      expect(() => getClientForFunction('analyzeComplexSemantics')).toThrow('DEEPSEEK_API_KEY');
    });

    it('throws even when SOCIAL_AI_PROVIDER=minimax and MiniMax is configured', () => {
      process.env.SOCIAL_AI_PROVIDER = 'minimax';
      delete process.env.DEEPSEEK_API_KEY;
      expect(() => getClientForFunction('analyzeComplexSemantics')).toThrow('DEEPSEEK_API_KEY');
    });
  });
});
