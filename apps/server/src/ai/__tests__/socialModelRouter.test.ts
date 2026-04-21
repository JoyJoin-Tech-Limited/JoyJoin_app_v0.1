/**
 * Unit tests for socialModelRouter — callSocialAI()
 *
 * Covers:
 *  1. MiniMax enabled + success → provider=minimax
 *  2. MiniMax enabled + failure → DeepSeek fallback → provider=deepseek
 *  3. MiniMax disabled → DeepSeek only → provider=deepseek
 *  4. Provider/latency logging
 *  5. No-DeepSeek-key guard throws a clear error
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

import { callSocialAI, getClientForFunction } from '../socialModelRouter';
import { isMinimaxEnabled, getMinimaxClient } from '../minimaxClient';

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

  // ── 1. MiniMax enabled ────────────────────────────────────────────────────

  describe('when MiniMax is enabled', () => {
    beforeEach(() => {
      vi.mocked(isMinimaxEnabled).mockReturnValue(true);
    });

    it('uses MiniMax and returns provider=minimax on success', async () => {
      mockMinimaxCreate.mockResolvedValue(minimaxResponse('Hello from MiniMax'));

      const result = await callSocialAI(baseParams);

      expect(result.content).toBe('Hello from MiniMax');
      expect(result.provider).toBe('minimax');
      expect(result.latencyMs).toBeGreaterThanOrEqual(0);
      expect(mockMinimaxCreate).toHaveBeenCalledOnce();
      expect(mockDeepseekCreate).not.toHaveBeenCalled();
    });

    it('passes correct messages, temperature and max_tokens to MiniMax', async () => {
      mockMinimaxCreate.mockResolvedValue(minimaxResponse('ok'));

      await callSocialAI({
        messages: [{ role: 'system', content: 'sys' }, { role: 'user', content: 'usr' }],
        temperature: 0.5,
        max_tokens: 200,
        callerTag: 'test',
      });

      expect(mockMinimaxCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'minimax-m2.7',
          temperature: 0.5,
          max_tokens: 200,
        })
      );
    });

    it('falls back to DeepSeek and returns provider=deepseek when MiniMax throws', async () => {
      mockMinimaxCreate.mockRejectedValue(new Error('MiniMax API error'));
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('DeepSeek fallback'));

      const result = await callSocialAI(baseParams);

      expect(result.content).toBe('DeepSeek fallback');
      expect(result.provider).toBe('deepseek');
      expect(result.fallbackUsed).toBe(true);
      expect(mockMinimaxCreate).toHaveBeenCalledOnce();
      expect(mockDeepseekCreate).toHaveBeenCalledOnce();
    });

    it('uses explicit socialFunction routing for minimax-preferred functions', async () => {
      mockMinimaxCreate.mockResolvedValue(minimaxResponse('Warm narrative'));

      const result = await callSocialAI({
        ...baseParams,
        socialFunction: 'generateConversationTopics',
      });

      expect(result.content).toBe('Warm narrative');
      expect(result.provider).toBe('minimax');
      expect(result.model).toBe('minimax-m2.7');
      expect(result.fallbackUsed).toBe(false);
      expect(mockMinimaxCreate).toHaveBeenCalledOnce();
      expect(mockDeepseekCreate).not.toHaveBeenCalled();
    });

    it('uses explicit socialFunction routing for minimax-preferred icebreaker JSON functions', async () => {
      mockMinimaxCreate.mockResolvedValue(minimaxResponse('[{"id":"x"}]'));

      const result = await callSocialAI({
        ...baseParams,
        socialFunction: 'generateMicroChallenges',
      });

      expect(result.content).toBe('[{"id":"x"}]');
      expect(result.provider).toBe('minimax');
      expect(result.model).toBe('minimax-m2.7');
      expect(result.fallbackUsed).toBe(false);
      expect(mockMinimaxCreate).toHaveBeenCalledOnce();
      expect(mockDeepseekCreate).not.toHaveBeenCalled();
    });

    it('throws a clear error when MiniMax fails and DEEPSEEK_API_KEY is not set', async () => {
      mockMinimaxCreate.mockRejectedValue(new Error('MiniMax unavailable'));
      delete process.env.DEEPSEEK_API_KEY;

      await expect(callSocialAI(baseParams)).rejects.toThrow('DEEPSEEK_API_KEY');
      expect(mockDeepseekCreate).not.toHaveBeenCalled();
    });
  });

  // ── 2. MiniMax disabled ───────────────────────────────────────────────────

  describe('when MiniMax is disabled', () => {
    beforeEach(() => {
      vi.mocked(isMinimaxEnabled).mockReturnValue(false);
    });

    it('routes directly to DeepSeek and returns provider=deepseek', async () => {
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('DeepSeek only'));

      const result = await callSocialAI(baseParams);

      expect(result.content).toBe('DeepSeek only');
      expect(result.provider).toBe('deepseek');
      expect(mockMinimaxCreate).not.toHaveBeenCalled();
      expect(mockDeepseekCreate).toHaveBeenCalledOnce();
    });

    it('throws a clear error when DEEPSEEK_API_KEY is not set', async () => {
      delete process.env.DEEPSEEK_API_KEY;

      await expect(callSocialAI(baseParams)).rejects.toThrow('DEEPSEEK_API_KEY');
      expect(mockDeepseekCreate).not.toHaveBeenCalled();
    });
  });

  // ── 3. Logging ────────────────────────────────────────────────────────────

  describe('provider logging', () => {
    it('logs provider=minimax and callerTag on MiniMax success', async () => {
      vi.mocked(isMinimaxEnabled).mockReturnValue(true);
      mockMinimaxCreate.mockResolvedValue(minimaxResponse('ok'));
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await callSocialAI({ ...baseParams, callerTag: 'myFunc' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('provider=minimax'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('myFunc'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringMatching(/latency=\d+ms/));
      logSpy.mockRestore();
    });

    it('logs provider=deepseek and callerTag on DeepSeek path', async () => {
      vi.mocked(isMinimaxEnabled).mockReturnValue(false);
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('ok'));
      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      await callSocialAI({ ...baseParams, callerTag: 'anotherFunc' });

      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('provider=deepseek'));
      expect(logSpy).toHaveBeenCalledWith(expect.stringContaining('anotherFunc'));
      logSpy.mockRestore();
    });

    it('logs a warning before falling back to DeepSeek', async () => {
      vi.mocked(isMinimaxEnabled).mockReturnValue(true);
      mockMinimaxCreate.mockRejectedValue(new Error('network error'));
      mockDeepseekCreate.mockResolvedValue(deepseekResponse('fallback'));
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      vi.spyOn(console, 'log').mockImplementation(() => {});

      await callSocialAI(baseParams);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('minimax failed'),
        expect.any(Error)
      );
      warnSpy.mockRestore();
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
    // Default: MiniMax available
    vi.mocked(getMinimaxClient).mockReturnValue(mockMinimaxClient as any);
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.SOCIAL_AI_PROVIDER;
  });

  // ── hybrid mode (default) ─────────────────────────────────────────────────

  describe('hybrid mode (default)', () => {
    it('routes generatePairExplanation to minimax when MiniMax is available', () => {
      const sel = getClientForFunction('generatePairExplanation');
      expect(sel.provider).toBe('minimax');
      expect(sel.model).toBe('minimax-m2.7');
    });

    it('routes generateIceBreakers to minimax when MiniMax is available', () => {
      const sel = getClientForFunction('generateIceBreakers');
      expect(sel.provider).toBe('minimax');
      expect(sel.model).toBe('minimax-m2.7');
    });

    it('routes analyzeComplexSemantics to deepseek even when MiniMax is available', () => {
      const sel = getClientForFunction('analyzeComplexSemantics');
      expect(sel.provider).toBe('deepseek');
      expect(sel.model).toBe('deepseek-chat');
    });

    it('falls back to deepseek for generatePairExplanation when MiniMax is not configured', () => {
      vi.mocked(getMinimaxClient).mockReturnValue(null);
      const sel = getClientForFunction('generatePairExplanation');
      expect(sel.provider).toBe('deepseek');
    });

    it('falls back to deepseek for generateIceBreakers when MiniMax is not configured', () => {
      vi.mocked(getMinimaxClient).mockReturnValue(null);
      const sel = getClientForFunction('generateIceBreakers');
      expect(sel.provider).toBe('deepseek');
    });
  });

  // ── minimax mode ──────────────────────────────────────────────────────────

  describe('SOCIAL_AI_PROVIDER=minimax', () => {
    beforeEach(() => {
      process.env.SOCIAL_AI_PROVIDER = 'minimax';
    });

    it('routes generatePairExplanation to minimax', () => {
      const sel = getClientForFunction('generatePairExplanation');
      expect(sel.provider).toBe('minimax');
    });

    it('routes generateIceBreakers to minimax', () => {
      const sel = getClientForFunction('generateIceBreakers');
      expect(sel.provider).toBe('minimax');
    });

    it('always routes analyzeComplexSemantics to deepseek (forced, not overridden by minimax mode)', () => {
      const sel = getClientForFunction('analyzeComplexSemantics');
      expect(sel.provider).toBe('deepseek');
    });

    it('falls back to deepseek for generateIceBreakers when MINIMAX_API_KEY is not set', () => {
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
