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
 * - campfire-vault-card-pr1: brave-but-safe guarantee (A1), 悦仔说
 *   permissionLine attachment + determinism (A2/A3), safety filter + v4
 *   promptVersion observability (A4), permission-line pool shape
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  buildWarmupTopicsPrompt,
  WARMUP_TOPICS_PROMPT_VERSION,
  WARMUP_TOPICS_CHAT_PROMPT_VERSION,
} from '../ai/socialIcebreakerPrompts';
import {
  selectPermissionLineForTopic,
  YUEZAI_PERMISSION_LINES,
} from '@shared/socialIcebreakerYuezaiCopy';
import { filterContent } from '../contentFilter';
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
const { generateWarmupTopics, hasBraveTopic, FALLBACK_WARMUP_TOPICS } = await import('../socialIcebreakerAIService');
const { logAITrace } = await import('../lib/aiTraceLogger');
const { getClientForFunction } = await import('../ai/socialModelRouter');
const mockLogAITrace = logAITrace as unknown as ReturnType<typeof vi.fn>;
const mockGetClientForFunction = getClientForFunction as unknown as ReturnType<typeof vi.fn>;

/** Helper: mock a successful LLM response carrying the given topic array. */
function mockLlmTopics(topics: Array<Record<string, unknown>>) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(topics) } }],
  });
}

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
    mockGetClientForFunction.mockImplementation(() => ({
      client: { chat: { completions: { create: mockCreate } } },
      model: 'deepseek-mock',
      provider: 'deepseek' as const,
    }));
  });

  it('uses curated topics when provider selection fails', async () => {
    mockGetClientForFunction.mockImplementationOnce(() => {
      throw new Error('AI provider is not configured');
    });

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 6,
      vibe: 'balanced',
    });

    expect(result.data).toHaveLength(5);
    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('provider_unavailable');
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
    expect(result.meta.promptVersion).toBe(WARMUP_TOPICS_CHAT_PROMPT_VERSION);
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

// ─── campfire-vault-card-pr1: brave-but-safe guarantee (A1) ─────────────────

describe('campfire-vault-card A1 — brave guarantee on the LLM-shaped path', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockLogAITrace.mockClear();
  });

  it('repairs an LLM set with no reflective topic so the served set has ≥1 brave topic', async () => {
    mockLlmTopics([
      { id: 't1', question: '最近有什么让你笑到停不下来的事？', mood: 'relaxed', emoji: '🌅', depthLevel: 1 },
      { id: 't2', question: '明天要是突然不用上班，第一件事做什么？', mood: 'relaxed', emoji: '✨', depthLevel: 1 },
      { id: 't3', question: '你一般怎么给自己充电？', mood: 'relaxed', emoji: '💫', depthLevel: 2 },
      { id: 't4', question: '什么样的环境让你瞬间放松下来？', mood: 'relaxed', emoji: '🌱', depthLevel: 2 },
      { id: 't5', question: '用三个词形容下今天的心情呗', mood: 'relaxed', emoji: '🔥', depthLevel: 1 },
    ]);

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.data.length).toBe(5); // repair replaces the final card, count preserved
    expect(hasBraveTopic(result.data)).toBe(true);
    const brave = result.data.filter((t) => t.safety === 'reflective');
    expect(brave.length).toBeGreaterThanOrEqual(1);
    // Repair injects the curated brave topic for the requested mood
    expect(brave[0].question).toBe('最近有没有觉得累，却不好意思说出来的时刻？');
    expect(brave[0].mood).toBe('relaxed');
    // Earlier LLM cards are preserved
    expect(result.data[0].question).toBe('最近有什么让你笑到停不下来的事？');
  });

  it('leaves an LLM set that already contains a brave topic untouched', async () => {
    const braveQuestion = '有没有哪一刻，你突然觉得自己被落下了？';
    mockLlmTopics([
      { id: 't1', question: braveQuestion, mood: 'life', emoji: '🍂', depthLevel: 3, safety: 'reflective' },
      { id: 't2', question: '最近尝试了什么新鲜事物？', mood: 'life', emoji: '✨', depthLevel: 2 },
      { id: 't3', question: '用三个词形容下今天的心情呗', mood: 'life', emoji: '💭', depthLevel: 1 },
      { id: 't4', question: '描述一下你理想的周末', mood: 'life', emoji: '☀️', depthLevel: 2 },
      { id: 't5', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', depthLevel: 2 },
    ]);

    const result = await generateWarmupTopics({
      mood: 'life',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.data.length).toBe(5);
    expect(result.data[0].question).toBe(braveQuestion);
    expect(result.data.filter((t) => t.safety === 'reflective').length).toBe(1);
  });

  it('hasBraveTopic validator keys on safety reflective', () => {
    expect(hasBraveTopic([{ safety: 'reflective' } as never])).toBe(true);
    expect(hasBraveTopic([{ safety: 'gentle' } as never, { safety: 'open' } as never])).toBe(false);
    expect(hasBraveTopic([])).toBe(false);
  });
});

describe('campfire-vault-card A1 — curated fallback bank brave coverage', () => {
  const MOODS = ['funny', 'life', 'relaxed', 'emotional'] as const;

  beforeEach(() => {
    mockCreate.mockReset();
  });

  it.each(MOODS)('fallback bank contains ≥1 brave (safety reflective) topic for mood %s', (mood) => {
    const braveForMood = FALLBACK_WARMUP_TOPICS.filter(
      (t) => t.mood === mood && t.safety === 'reflective',
    );
    expect(braveForMood.length).toBeGreaterThanOrEqual(1);
  });

  it.each(MOODS)('served fallback set always contains ≥1 brave topic for mood %s', async (mood) => {
    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));

    const result = await generateWarmupTopics({
      mood,
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.meta.fallbackUsed).toBe(true);
    expect(hasBraveTopic(result.data)).toBe(true);
    // The brave card is register-matched to the requested mood
    expect(result.data.some((t) => t.safety === 'reflective' && t.mood === mood)).toBe(true);
  });

  it('every curated bank question passes the content filter (no blocked terms)', () => {
    for (const topic of FALLBACK_WARMUP_TOPICS) {
      const filtered = filterContent(topic.question);
      expect(filtered.isViolation, `bank question tripped filter: ${topic.question}`).toBe(false);
    }
  });
});

// ─── campfire-vault-card-pr1: 悦仔说 permissionLine (A2/A3) ──────────────────

describe('campfire-vault-card A2/A3 — permissionLine attachment + determinism', () => {
  beforeEach(() => {
    mockCreate.mockReset();
  });

  it('attaches a non-empty permissionLine from the depth-matched register on the LLM path', async () => {
    mockLlmTopics([
      { id: 't1', question: '最近有什么让你笑到停不下来的事？', mood: 'relaxed', emoji: '🌅', depthLevel: 1 },
      { id: 't2', question: '明天要是突然不用上班，第一件事做什么？', mood: 'relaxed', emoji: '✨', depthLevel: 1 },
      { id: 't3', question: '你一般怎么给自己充电？', mood: 'relaxed', emoji: '💫', depthLevel: 2 },
      { id: 't4', question: '什么样的环境让你瞬间放松下来？', mood: 'relaxed', emoji: '🌱', depthLevel: 2 },
      { id: 't5', question: '用三个词形容下今天的心情呗', mood: 'relaxed', emoji: '🔥', depthLevel: 1 },
    ]);

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.data.length).toBe(5);
    for (const topic of result.data) {
      expect(typeof topic.permissionLine).toBe('string');
      expect(topic.permissionLine!.length).toBeGreaterThan(0);
      const register = topic.depthLevel === 2 || topic.depthLevel === 3 ? topic.depthLevel : 1;
      expect(YUEZAI_PERMISSION_LINES[register]).toContain(topic.permissionLine);
    }
  });

  it('attaches a non-empty permissionLine to every topic on the fallback path', async () => {
    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));

    const result = await generateWarmupTopics({
      mood: 'funny',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.data.length).toBeGreaterThan(0);
    for (const topic of result.data) {
      expect(typeof topic.permissionLine).toBe('string');
      expect(topic.permissionLine!.length).toBeGreaterThan(0);
    }
  });

  it('selector is deterministic — same question + depthLevel always selects the identical line', () => {
    const input = { question: '最近有没有觉得累，却不好意思说出来的时刻？', depthLevel: 2 as const };
    expect(selectPermissionLineForTopic(input)).toBe(selectPermissionLineForTopic(input));
    // Register pools are respected
    expect(YUEZAI_PERMISSION_LINES[2]).toContain(selectPermissionLineForTopic(input));
    expect(YUEZAI_PERMISSION_LINES[1]).toContain(
      selectPermissionLineForTopic({ question: '用三个词形容下今天的心情呗', depthLevel: 1 }),
    );
    expect(YUEZAI_PERMISSION_LINES[3]).toContain(
      selectPermissionLineForTopic({ question: '有没有哪一刻，你突然觉得自己被落下了？', depthLevel: 3 }),
    );
  });

  it('lines are stable across repeated generation calls with identical LLM output', async () => {
    const topics = [
      { id: 't1', question: '最近有什么让你笑到停不下来的事？', mood: 'relaxed', emoji: '🌅', depthLevel: 1 },
      { id: 't2', question: '明天要是突然不用上班，第一件事做什么？', mood: 'relaxed', emoji: '✨', depthLevel: 1 },
      { id: 't3', question: '你一般怎么给自己充电？', mood: 'relaxed', emoji: '💫', depthLevel: 2 },
      { id: 't4', question: '什么样的环境让你瞬间放松下来？', mood: 'relaxed', emoji: '🌱', depthLevel: 2 },
      { id: 't5', question: '用三个词形容下今天的心情呗', mood: 'relaxed', emoji: '🔥', depthLevel: 1 },
    ];
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: JSON.stringify(topics) } }],
    });

    const first = await generateWarmupTopics({ mood: 'relaxed', eventType: '活动', participantCount: 4, vibe: 'balanced' });
    const second = await generateWarmupTopics({ mood: 'relaxed', eventType: '活动', participantCount: 4, vibe: 'balanced' });

    expect(first.data.map((t) => [t.question, t.permissionLine])).toEqual(
      second.data.map((t) => [t.question, t.permissionLine]),
    );
  });
});

describe('campfire-vault-card A2/A3 — permission-line pool shape', () => {
  // Pictographs, misc symbols, dingbats, variation selector, ZWJ
  const EMOJI_RE = /[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE0F}\u{200D}]/u;

  it('has ≥6 lines per depth register (1/2/3)', () => {
    for (const register of [1, 2, 3] as const) {
      expect(YUEZAI_PERMISSION_LINES[register].length).toBeGreaterThanOrEqual(6);
    }
  });

  it('lines are ≤30 chars, zero emoji, and carry no 悦仔说 prefix (client renders the prefix)', () => {
    for (const register of [1, 2, 3] as const) {
      for (const line of YUEZAI_PERMISSION_LINES[register]) {
        expect(line.length).toBeLessThanOrEqual(30);
        expect(EMOJI_RE.test(line)).toBe(false);
        expect(line).not.toContain('悦仔说');
      }
    }
  });

  it('lines never name or pressure an individual', () => {
    const banned = ['你必须', '大家说', '每个人都要', '请你回答', '所有人'];
    for (const register of [1, 2, 3] as const) {
      for (const line of YUEZAI_PERMISSION_LINES[register]) {
        for (const phrase of banned) {
          expect(line).not.toContain(phrase);
        }
      }
    }
  });
});

// ─── campfire-vault-card-pr1: safety filter + v4 promptVersion (A4) ──────────

describe('campfire-vault-card A4 — safety filter gates brave questions', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockLogAITrace.mockClear();
  });

  it.each([
    ['self-harm', '聊聊你曾经想自杀的时刻', '自杀'],
    ['abuse', '分享一下你被虐待的经历吧', '虐待'],
    ['death/violence', '你见过杀人现场吗？', '杀人'],
  ])(
    'drops the whole LLM set to curated fallback when a topic contains %s content',
    async (_label, unsafeQuestion, blockedKeyword) => {
      mockLlmTopics([
        { id: 't1', question: unsafeQuestion, mood: 'life', emoji: '💫', depthLevel: 3, safety: 'reflective' },
        { id: 't2', question: '最近尝试了什么新鲜事物？', mood: 'life', emoji: '✨', depthLevel: 2 },
        { id: 't3', question: '用三个词形容下今天的心情呗', mood: 'life', emoji: '💭', depthLevel: 1 },
        { id: 't4', question: '描述一下你理想的周末', mood: 'life', emoji: '☀️', depthLevel: 2 },
        { id: 't5', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', depthLevel: 2 },
      ]);

      const result = await generateWarmupTopics({
        mood: 'life',
        eventType: '活动',
        participantCount: 4,
        vibe: 'balanced',
      });

      expect(result.meta.fallbackUsed).toBe(true);
      expect(result.meta.evaluatorRejectionReason).toBe('content_safety');
      // v4 promptVersion is recorded on the fallback meta (Observability)
      expect(result.meta.promptVersion).toBe(WARMUP_TOPICS_PROMPT_VERSION);
      // Served set is the curated fallback: unsafe question is gone,
      // brave guarantee and permission lines still hold
      expect(result.data.some((t) => t.question.includes(blockedKeyword))).toBe(false);
      expect(hasBraveTopic(result.data)).toBe(true);
      for (const topic of result.data) {
        expect(topic.permissionLine).toBeTruthy();
      }
    },
  );

  it('records the v4 promptVersion in AITrace for live generation', async () => {
    mockLlmTopics([
      { id: 't1', question: '有没有哪一刻，你突然觉得自己被落下了？', mood: 'life', emoji: '🍂', depthLevel: 3, safety: 'reflective' },
      { id: 't2', question: '最近尝试了什么新鲜事物？', mood: 'life', emoji: '✨', depthLevel: 2 },
      { id: 't3', question: '用三个词形容下今天的心情呗', mood: 'life', emoji: '💭', depthLevel: 1 },
      { id: 't4', question: '描述一下你理想的周末', mood: 'life', emoji: '☀️', depthLevel: 2 },
      { id: 't5', question: '如果今天能重来一件事，你会改什么？', mood: 'life', emoji: '🔄', depthLevel: 2 },
    ]);

    await generateWarmupTopics({ mood: 'life', eventType: '活动', participantCount: 4, vibe: 'balanced' });

    const warmupTraces = mockLogAITrace.mock.calls.filter(
      (call) => (call[0] as { feature?: string })?.feature === 'generateWarmupTopics',
    );
    expect(warmupTraces.length).toBeGreaterThan(0);
    expect((warmupTraces[0][0] as { promptVersion?: string }).promptVersion).toBe('social-warmup-topics-v4');
  });

  it('records the v4-chat promptVersion in AITrace for the chat vibe', async () => {
    mockLlmTopics([
      { id: 't1', question: '有没有哪一刻，你突然觉得自己被落下了？', mood: 'life', emoji: '🍂', depthLevel: 3, safety: 'reflective', promptTiers: { opener: 'O', followUp: 'F', reflection: 'R' } },
    ]);

    await generateWarmupTopics({ mood: 'life', eventType: '活动', participantCount: 4, vibe: 'chat' });

    const warmupTraces = mockLogAITrace.mock.calls.filter(
      (call) => (call[0] as { feature?: string })?.feature === 'generateWarmupTopics',
    );
    expect(warmupTraces.length).toBeGreaterThan(0);
    expect((warmupTraces[0][0] as { promptVersion?: string }).promptVersion).toBe('social-warmup-topics-v4-chat');
  });
});

describe('campfire-vault-card A1/A4 — v4 prompt content + version lock', () => {
  it('prompt versions are bumped to v4', () => {
    expect(WARMUP_TOPICS_PROMPT_VERSION).toBe('social-warmup-topics-v4');
    expect(WARMUP_TOPICS_CHAT_PROMPT_VERSION).toBe('social-warmup-topics-v4-chat');
  });

  it('v4 prompt requires a brave-but-safe question for every vibe', () => {
    for (const vibe of ['chat', 'balanced', 'game'] as const) {
      const prompt = buildWarmupTopicsPrompt({
        eventType: '测试活动',
        participantCount: 4,
        mood: 'life',
        vibe,
      });
      expect(prompt).toContain('勇敢但安全');
      expect(prompt).toContain('reflective');
      expect(prompt).toContain('死亡'); // explicit never-list: death/abuse/self-harm/explicit
    }
  });
});
