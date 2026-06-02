/**
 * Sprint 2 — Vibe-aware warmup prompt builder + AI service unit tests
 *
 * Covers:
 * - buildWarmupTopicsPrompt generates correct vibe-specific prompts
 * - generateWarmupTopics returns correct card counts per vibe
 * - generateWarmupTopics falls back to curated defaults on LLM failure/timeout
 * - 3s timeout on LLM calls
 * - archetypeMix context threaded into prompts
 * - getPhaseTimeoutMinutes uses runPlan allocatedMinutes when available
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildWarmupTopicsPrompt,
  WARMUP_TOPICS_PROMPT_VERSION,
  WARMUP_TOPICS_V3_PROMPT_VERSION,
} from '../ai/socialIcebreakerPrompts';
import type { SocialSessionState } from '@shared/socialIcebreaker';

// ─── Mock socialModelRouter so generateWarmupTopics doesn't need real credentials ───
const mockCreate = vi.fn();

vi.mock('../ai/socialModelRouter', () => ({
  getClientForFunction: vi.fn(() => ({
    client: { chat: { completions: { create: mockCreate } } },
    model: 'deepseek-mock',
    provider: 'deepseek' as const,
  })),
  getDeepseekSelection: vi.fn(),
}));

vi.mock('../lib/aiTraceLogger', () => ({
  createAiCorrelationId: vi.fn(() => 'trace-123'),
  logAITrace: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

vi.mock('../ai/aiQualityGate', () => ({
  evaluateContent: vi.fn().mockResolvedValue(null),
  formatQualityMetrics: vi.fn(),
}));

// Import after mocks
const { generateWarmupTopics } = await import('../socialIcebreakerAIService');

// ─── Prompt builder tests ───────────────────────────────────────────────────

describe('buildWarmupTopicsPrompt — vibe-aware prompt generation', () => {
  it('deep_chat vibe asks for 6-7 cards with 3-tier prompts', () => {
    const prompt = buildWarmupTopicsPrompt({
      eventType: '测试活动',
      participantCount: 4,
      mood: 'life',
      vibe: 'chat',
    });

    expect(prompt).toContain('深聊');
    expect(prompt).toContain('6-7');
    expect(prompt).toContain('promptTiers');
    expect(prompt).toContain('opener');
    expect(prompt).toContain('followUp');
    expect(prompt).toContain('reflection');
    expect(prompt).toContain('30秒');
    expect(prompt).toContain('60秒');
    expect(prompt).toContain('90秒');
  });

  it('play_fun vibe asks for 4 cards with rapid-fire single prompts', () => {
    const prompt = buildWarmupTopicsPrompt({
      eventType: '测试活动',
      participantCount: 4,
      mood: 'funny',
      vibe: 'game',
    });

    expect(prompt).toContain('暢玩');
    expect(prompt).toContain('4');
    expect(prompt).not.toContain('promptTiers');
    expect(prompt).not.toContain('opener');
    expect(prompt).toContain('快速暖场');
  });

  it('balanced vibe asks for 5 cards with standard single prompts', () => {
    const prompt = buildWarmupTopicsPrompt({
      eventType: '测试活动',
      participantCount: 4,
      mood: 'relaxed',
      vibe: 'balanced',
    });

    expect(prompt).toContain('均衡');
    expect(prompt).toContain('5');
    expect(prompt).not.toContain('promptTiers');
    expect(prompt).not.toContain('opener');
  });

  it('includes archetypeMix context when provided', () => {
    const prompt = buildWarmupTopicsPrompt({
      eventType: '测试活动',
      participantCount: 4,
      mood: 'life',
      vibe: 'chat',
      sessionContext: { mixText: '社牛柯基×2、小太阳鸡×1', diversityScore: 0.5 },
    });

    expect(prompt).toContain('本组画像');
    expect(prompt).toContain('社牛柯基×2、小太阳鸡×1');
  });

  it('uses default balanced vibe when vibe is omitted', () => {
    const prompt = buildWarmupTopicsPrompt({
      eventType: '测试活动',
      participantCount: 4,
      mood: 'relaxed',
    });

    expect(prompt).toContain('均衡');
    expect(prompt).toContain('5');
  });
});

// ─── AI service tests ───────────────────────────────────────────────────────

describe('generateWarmupTopics — vibe-aware generation', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('deep_chat returns 6-7 cards from mocked LLM response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { id: 't1', question: 'Q1', mood: 'life', emoji: '🌅', depthLevel: 1, promptTiers: { opener: 'O1', followUp: 'F1', reflection: 'R1' } },
            { id: 't2', question: 'Q2', mood: 'life', emoji: '✨', depthLevel: 2, promptTiers: { opener: 'O2', followUp: 'F2', reflection: 'R2' } },
            { id: 't3', question: 'Q3', mood: 'life', emoji: '💫', depthLevel: 2, promptTiers: { opener: 'O3', followUp: 'F3', reflection: 'R3' } },
            { id: 't4', question: 'Q4', mood: 'life', emoji: '🌱', depthLevel: 3, promptTiers: { opener: 'O4', followUp: 'F4', reflection: 'R4' } },
            { id: 't5', question: 'Q5', mood: 'life', emoji: '🔥', depthLevel: 3, promptTiers: { opener: 'O5', followUp: 'F5', reflection: 'R5' } },
            { id: 't6', question: 'Q6', mood: 'life', emoji: '🎯', depthLevel: 2, promptTiers: { opener: 'O6', followUp: 'F6', reflection: 'R6' } },
          ]),
        },
      }],
    });

    const result = await generateWarmupTopics({
      mood: 'life',
      eventType: '活动',
      participantCount: 4,
      vibe: 'chat',
    });

    expect(result.data.length).toBeGreaterThanOrEqual(6);
    expect(result.data.length).toBeLessThanOrEqual(7);
    expect(result.data[0].promptTiers).toBeDefined();
    expect(result.data[0].promptTiers?.opener).toBeDefined();
    expect(result.meta.promptVersion).toBe(WARMUP_TOPICS_V3_PROMPT_VERSION);
    expect(result.meta.fallbackUsed).toBe(false);
  });

  it('play_fun returns 4 cards from mocked LLM response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { id: 't1', question: 'Q1', mood: 'funny', emoji: '😂', depthLevel: 1 },
            { id: 't2', question: 'Q2', mood: 'funny', emoji: '🎉', depthLevel: 1 },
            { id: 't3', question: 'Q3', mood: 'funny', emoji: '🤔', depthLevel: 2 },
            { id: 't4', question: 'Q4', mood: 'funny', emoji: '🚀', depthLevel: 2 },
          ]),
        },
      }],
    });

    const result = await generateWarmupTopics({
      mood: 'funny',
      eventType: '活动',
      participantCount: 4,
      vibe: 'game',
    });

    expect(result.data.length).toBe(4);
    expect(result.data[0].promptTiers).toBeUndefined();
    expect(result.meta.promptVersion).toBe(WARMUP_TOPICS_PROMPT_VERSION);
  });

  it('balanced returns 5 cards from mocked LLM response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { id: 't1', question: 'Q1', mood: 'relaxed', emoji: '🌅', depthLevel: 1 },
            { id: 't2', question: 'Q2', mood: 'relaxed', emoji: '✨', depthLevel: 2 },
            { id: 't3', question: 'Q3', mood: 'relaxed', emoji: '💫', depthLevel: 2 },
            { id: 't4', question: 'Q4', mood: 'relaxed', emoji: '🌱', depthLevel: 3 },
            { id: 't5', question: 'Q5', mood: 'relaxed', emoji: '🔥', depthLevel: 1 },
          ]),
        },
      }],
    });

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.data.length).toBe(5);
    expect(result.data[0].promptTiers).toBeUndefined();
  });

  it('deep_chat depth curve is L2-L3 dominant', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { id: 't1', question: 'Q1', mood: 'life', emoji: '1', depthLevel: 1, promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
            { id: 't2', question: 'Q2', mood: 'life', emoji: '2', depthLevel: 2, promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
            { id: 't3', question: 'Q3', mood: 'life', emoji: '3', depthLevel: 2, promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
            { id: 't4', question: 'Q4', mood: 'life', emoji: '4', depthLevel: 3, promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
            { id: 't5', question: 'Q5', mood: 'life', emoji: '5', depthLevel: 3, promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
            { id: 't6', question: 'Q6', mood: 'life', emoji: '6', depthLevel: 2, promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
          ]),
        },
      }],
    });

    const result = await generateWarmupTopics({
      mood: 'life',
      eventType: '活动',
      participantCount: 4,
      vibe: 'chat',
    });

    const l1 = result.data.filter((t) => t.depthLevel === 1).length;
    const l2 = result.data.filter((t) => t.depthLevel === 2).length;
    const l3 = result.data.filter((t) => t.depthLevel === 3).length;

    expect(l1).toBe(1); // 1× L1 opener
    expect(l2 + l3).toBeGreaterThanOrEqual(4); // L2-L3 dominant
    expect(l3).toBeGreaterThanOrEqual(2); // at least 2 L3
  });

  it('play_fun depth curve is L1-L2 light', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { id: 't1', question: 'Q1', mood: 'funny', emoji: '1', depthLevel: 1 },
            { id: 't2', question: 'Q2', mood: 'funny', emoji: '2', depthLevel: 1 },
            { id: 't3', question: 'Q3', mood: 'funny', emoji: '3', depthLevel: 2 },
            { id: 't4', question: 'Q4', mood: 'funny', emoji: '4', depthLevel: 2 },
          ]),
        },
      }],
    });

    const result = await generateWarmupTopics({
      mood: 'funny',
      eventType: '活动',
      participantCount: 4,
      vibe: 'game',
    });

    const l1 = result.data.filter((t) => t.depthLevel === 1).length;
    const l2 = result.data.filter((t) => t.depthLevel === 2).length;
    const l3 = result.data.filter((t) => t.depthLevel === 3).length;

    expect(l3).toBe(0); // no L3 for play_fun
    expect(l1 + l2).toBe(4);
  });

  it('falls back to curated defaults on LLM error', async () => {
    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.data.length).toBe(5);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('llm_error');
  });

  it('falls back to curated defaults on LLM timeout (3s)', async () => {
    mockCreate.mockImplementation(() => new Promise((_resolve, reject) => {
      const err = new Error('Request aborted');
      (err as any).name = 'AbortError';
      reject(err);
    }));

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.data.length).toBe(5);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('timeout');
  });

  it('falls back to curated defaults on empty LLM response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.data.length).toBe(5);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('empty_response');
  });

  it('archetypeMix is threaded through roster to prompt', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { id: 't1', question: 'Q1', mood: 'life', emoji: '1', depthLevel: 2, promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
          ]),
        },
      }],
    });

    const result = await generateWarmupTopics({
      mood: 'life',
      eventType: '活动',
      participantCount: 3,
      vibe: 'chat',
      roster: [
        { archetype: '社牛柯基' },
        { archetype: '社牛柯基' },
        { archetype: '小太阳鸡' },
      ],
    });

    // Verify the prompt was called with archetype mix context
    const promptArg = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptArg).toContain('本组画像');
    expect(promptArg).toContain('社牛柯基');
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });

  it('handles empty roster gracefully (no archetypeMix)', async () => {
    mockCreate.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify([
            { id: 't1', question: 'Q1', mood: 'relaxed', emoji: '1', depthLevel: 1 },
          ]),
        },
      }],
    });

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
      roster: [],
    });

    const promptArg = mockCreate.mock.calls[0][0].messages[0].content as string;
    expect(promptArg).not.toContain('本组画像');
    expect(result.data.length).toBeGreaterThanOrEqual(1);
  });
});

// ─── getPhaseTimeoutMinutes tests ────────────────────────────────────────────

describe('getPhaseTimeoutMinutes — run plan allocatedMinutes', () => {
  it('uses allocatedMinutes from run plan when available', async () => {
    const { getPhaseTimeoutMinutes } = await import('../xiaoyueAdaptiveEngine');

    const state: Partial<SocialSessionState> = {
      runPlan: {
        version: 2,
        segments: [
          { phase: 'warmup', allocatedMinutes: 18, energyWeight: 1 },
          { phase: 'micro_challenge', allocatedMinutes: 10, energyWeight: 2 },
          { phase: 'recap', allocatedMinutes: 5, energyWeight: 1 },
        ],
        totalMinutes: 33,
        compiledAt: new Date().toISOString(),
        compilerId: 'test',
      },
    };

    expect(getPhaseTimeoutMinutes('warmup', state as SocialSessionState)).toBe(18);
    expect(getPhaseTimeoutMinutes('micro_challenge', state as SocialSessionState)).toBe(10);
  });

  it('falls back to PHASE_CONFIG when run plan is missing', async () => {
    const { getPhaseTimeoutMinutes } = await import('../xiaoyueAdaptiveEngine');

    const state: Partial<SocialSessionState> = {};
    expect(getPhaseTimeoutMinutes('warmup', state as SocialSessionState)).toBe(20);
  });

  it('falls back to PHASE_CONFIG when phase is not in run plan', async () => {
    const { getPhaseTimeoutMinutes } = await import('../xiaoyueAdaptiveEngine');

    const state: Partial<SocialSessionState> = {
      runPlan: {
        version: 2,
        segments: [
          { phase: 'warmup', allocatedMinutes: 18, energyWeight: 1 },
        ],
        totalMinutes: 18,
        compiledAt: new Date().toISOString(),
        compilerId: 'test',
      },
    };

    expect(getPhaseTimeoutMinutes('lie_detective', state as SocialSessionState)).toBe(25);
  });
});
