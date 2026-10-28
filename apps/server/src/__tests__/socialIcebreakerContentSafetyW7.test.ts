/**
 * Sprint gm-debrief W7 — Content safety & fallback quality
 *
 * Covers:
 * - AC-W7.2: banned-vocab post-filter (匹配/社交/灵魂/撮合/AI) on visible AI
 *   strings, degrade-to-curated on hit, structured non-PII trace.
 * - AC-W7.3: fallbacks are vibe-aware and specific (name a shared interest when
 *   available); pair-explanation fallback is no longer horoscope-only.
 * - M1.1: the retired W7.4 process-global window cannot leak serving memory;
 *   caller-owned exact/normalized avoid keys drive live and curated dedupe.
 * - AC-W7.5: dead `FALLBACK_MICRO_CHALLENGES` symbol removed.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import * as serviceModule from '../socialIcebreakerAIService';

// ─── Mock the provider router / trace / logger (no credentials in tests) ─────
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
  createAiCorrelationId: vi.fn(() => 'trace-w7'),
  logAITrace: vi.fn(),
}));

vi.mock('../lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock('../ai/aiQualityGate', () => ({
  evaluateContent: vi.fn().mockResolvedValue(null),
  formatQualityMetrics: vi.fn(),
}));

const {
  generateWarmupTopics,
  getCuratedWarmupTopics,
  resetWarmupTopicDedupe,
  hasBraveTopic,
} = await import('../socialIcebreakerAIService');
const { moderateGeneratedContent } = await import('../lib/aiContentModeration');
const { findReviewBlockedVocab } = await import('@shared/copy/terms');
const { generateFallbackPairCopy } = await import('../matchExplanationService');
const { logAITrace } = await import('../lib/aiTraceLogger');

const mockLogAITrace = logAITrace as unknown as ReturnType<typeof vi.fn>;

function mockLlmTopics(topics: Array<Record<string, unknown>>) {
  mockCreate.mockResolvedValue({
    choices: [{ message: { content: JSON.stringify(topics) } }],
  });
}

const CLEAN_TOPICS = [
  { id: 't1', question: '最近有什么让你笑到停不下来的事？', mood: 'relaxed', emoji: '🌅', depthLevel: 1 },
  { id: 't2', question: '明天要是突然不用上班，第一件事做什么？', mood: 'relaxed', emoji: '✨', depthLevel: 1 },
  { id: 't3', question: '你一般怎么给自己充电？', mood: 'relaxed', emoji: '💫', depthLevel: 2 },
  { id: 't4', question: '什么样的环境让你瞬间放松下来？', mood: 'relaxed', emoji: '🌱', depthLevel: 2 },
  { id: 't5', question: '最近有没有觉得累，却不好意思说出来的时刻？', mood: 'relaxed', emoji: '🌙', depthLevel: 2, safety: 'reflective' },
];

// ─── AC-W7.2 ────────────────────────────────────────────────────────────────

describe('W7.2 — review-blocked vocabulary filter', () => {
  beforeEach(() => {
    mockLogAITrace.mockClear();
  });

  it.each(['匹配', '社交', '灵魂', '撮合', 'AI'])('findReviewBlockedVocab catches injected token %s', (token) => {
    expect(findReviewBlockedVocab(`一句包含${token}的内容`)).toBe(token);
  });

  it('does not false-positive on English words containing the AI substring', () => {
    expect(findReviewBlockedVocab('email the detail of the wait')).toBeNull();
  });

  it('degrades when enforceReviewVocab is on', () => {
    const result = moderateGeneratedContent(
      [{ field: 'question', text: '系统已经完成匹配，请查看结果' }],
      {
        domain: 'icebreaker',
        feature: 'testFeature',
        provider: 'deepseek',
        promptVersion: 'test-v1',
        traceId: 'trace-w7',
        enforceReviewVocab: true,
      },
    );
    expect(result.safe).toBe(false);
    if (!result.safe) {
      expect(result.field).toBe('question');
      expect(result.blockedWord).toBe('匹配');
    }
  });

  it('is opt-in — surfaces without the flag keep prior behaviour', () => {
    const result = moderateGeneratedContent(
      [{ field: 'question', text: '系统已经完成匹配，请查看结果' }],
      {
        domain: 'icebreaker',
        feature: 'testFeature',
        provider: 'deepseek',
        promptVersion: 'test-v1',
      },
    );
    expect(result.safe).toBe(true);
  });

  it('logs a structured non-PII trace (banned_vocab + length, not the body)', () => {
    const body = '这是一段包含灵魂二字的长文本';
    moderateGeneratedContent(
      [{ field: 'question', text: body }],
      {
        domain: 'icebreaker',
        feature: 'testFeature',
        provider: 'deepseek',
        promptVersion: 'test-v1',
        traceId: 'trace-w7',
        enforceReviewVocab: true,
      },
    );

    expect(mockLogAITrace).toHaveBeenCalledWith(
      expect.objectContaining({
        traceId: 'trace-w7',
        errorCode: 'banned_vocab',
        fallbackUsed: true,
        extra: expect.objectContaining({
          field: 'question',
          blockedWord: '灵魂',
          textLength: body.length,
        }),
      }),
    );
    const traceArg = mockLogAITrace.mock.calls.at(-1)?.[0] as { extra?: Record<string, unknown> };
    expect(JSON.stringify(traceArg.extra)).not.toContain(body);
  });

  it('integrated: a live LLM string carrying a banned token degrades to curated fallback', async () => {
    mockCreate.mockReset();
    mockLlmTopics([
      { id: 'bad1', question: '来聊聊你们的匹配经历吧', mood: 'relaxed', emoji: '✨', depthLevel: 1 },
      ...CLEAN_TOPICS.slice(1),
    ]);

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
    });

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.meta.evaluatorRejectionReason).toBe('banned_vocab');
    expect(result.data.some((t) => t.question.includes('匹配'))).toBe(false);
  });
});

// ─── AC-W7.3 ────────────────────────────────────────────────────────────────

describe('W7.3 — specific, vibe-aware fallbacks', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    resetWarmupTopicDedupe();
  });

  it('curated fallback names a shared interest when one is available', () => {
    const topics = getCuratedWarmupTopics('life', 'balanced', { sharedInterests: ['咖啡'] });
    expect(topics.some((t) => t.question.includes('咖啡'))).toBe(true);
  });

  it('generateWarmupTopics fallback path carries the roster shared interest', async () => {
    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));

    const result = await generateWarmupTopics({
      mood: 'life',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
      roster: [
        { archetype: '慢热龟', interests: ['咖啡', '徒步'] },
        { archetype: '社牛柯基', interests: ['咖啡', '摄影'] },
      ],
    });

    expect(result.meta.fallbackUsed).toBe(true);
    expect(result.data.some((t) => t.question.includes('咖啡'))).toBe(true);
    expect(hasBraveTopic(result.data)).toBe(true);
  });

  it('game vibe fallback stays light (no depth-3 cards)', async () => {
    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));
    const result = await generateWarmupTopics({
      mood: 'funny',
      eventType: '活动',
      participantCount: 4,
      vibe: 'game',
    });
    expect(result.data.every((t) => t.depthLevel !== 3)).toBe(true);
  });

  it('chat vibe fallback includes deep-chat depth', async () => {
    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));
    const result = await generateWarmupTopics({
      mood: 'life',
      eventType: '活动',
      participantCount: 4,
      vibe: 'chat',
    });
    expect(result.data.some((t) => (t.depthLevel ?? 1) >= 2)).toBe(true);
  });

  it('pair-explanation fallback names a shared interest (no horoscope-only copy)', () => {
    const withInterest = generateFallbackPairCopy(80, ['咖啡']);
    expect(withInterest.explanation).toContain('咖啡');
    expect(withInterest.explanation).not.toContain('社交');
  });

  it('pair-explanation fallback names a connection point when no shared interest exists', () => {
    const withConnection = generateFallbackPairCopy(80, [], ['都养猫']);
    expect(withConnection.explanation).toContain('都养猫');
  });

  it('pair-explanation fallback still produces non-empty copy with no concrete hook', () => {
    const generic = generateFallbackPairCopy(40, [], []);
    expect(generic.explanation.length).toBeGreaterThan(0);
    expect(generic.explanation).not.toContain('社交');
  });
});

// ─── M1.1 / retired AC-W7.4 process-memory behavior ─────────────────────────

describe('M1.1 — caller-owned warmup dedupe without process-global serving memory', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    resetWarmupTopicDedupe();
    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));
  });

  it('two sessions with the same legacy dedupeKey do not influence each other', async () => {
    const first = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
      dedupeKey: 'shared-legacy-key',
    });
    const second = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
      dedupeKey: 'shared-legacy-key',
    });

    expect(second.data.map((topic) => [topic.id, topic.question])).toEqual(
      first.data.map((topic) => [topic.id, topic.question]),
    );
    expect(first.data).toHaveLength(5);
    expect(hasBraveTopic(first.data)).toBe(true);
    expect(hasBraveTopic(second.data)).toBe(true);
  });

  it('a generated but uncommitted deck leaves no trace in later curated selection', async () => {
    const baseline = getCuratedWarmupTopics('relaxed', 'balanced');
    mockLlmTopics(baseline.map((topic, index) => ({
      ...topic,
      id: `uncommitted-${index}`,
    })));

    const generated = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
      dedupeKey: 'shared-legacy-key',
    });
    expect(generated.meta.fallbackUsed).toBe(false);
    // Deliberately no commitWholeTopicSet here: this candidate may be abandoned
    // by a revision conflict and must not become serving history.

    mockCreate.mockRejectedValue(new Error('LLM service unavailable'));
    const later = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
      dedupeKey: 'shared-legacy-key',
    });

    expect(later.data.map((topic) => [topic.id, topic.question])).toEqual(
      baseline.map((topic) => [topic.id, topic.question]),
    );
  });

  it('curated fallback honors exact and normalized avoid ID/question aliases without a dedupeKey', () => {
    const result = getCuratedWarmupTopics('relaxed', 'balanced', {
      avoidKeys: [
        'id:w21',
        'id:W6',
        '描述一下你理想的周末，越具体越好',
        '  明天要是突然不用上班, 第一件事做什么?  ',
        'q:你一般怎么给自己充电',
      ],
    });

    expect(result.map((topic) => topic.id)).not.toContain('w21');
    expect(result.map((topic) => topic.id)).not.toContain('w6');
    expect(result.map((topic) => topic.question)).not.toContain('描述一下你理想的周末，越具体越好');
    expect(result.map((topic) => topic.question)).not.toContain('明天要是突然不用上班，第一件事做什么？');
    expect(result.map((topic) => topic.question)).not.toContain('你一般怎么给自己"充电"？');
  });

  it('live generation filters exact and normalized avoidTopics aliases without a dedupeKey', async () => {
    mockLlmTopics([
      { id: 'exact-id', question: '全新的精确编号问题', mood: 'relaxed', depthLevel: 1 },
      { id: 'fresh-exact-q', question: '精确问题文本', mood: 'relaxed', depthLevel: 1 },
      { id: 'Legacy-ID', question: '全新的归一编号问题', mood: 'relaxed', depthLevel: 1 },
      { id: 'fresh-normalized-q', question: '相同问题文本', mood: 'relaxed', depthLevel: 2 },
      { id: 'fresh-brave', question: '最近有没有觉得累，却不好意思说出来的时刻？', mood: 'relaxed', depthLevel: 2, safety: 'reflective' },
      { id: 'fresh-final', question: '周末有什么新的安排', mood: 'relaxed', depthLevel: 2 },
    ]);

    const result = await generateWarmupTopics({
      mood: 'relaxed',
      eventType: '活动',
      participantCount: 4,
      vibe: 'balanced',
      avoidTopics: [
        'id:exact-id',
        '精确问题文本',
        'id:legacy-id',
        ' 相同, 问题文本？ ',
      ],
    });

    expect(result.meta.fallbackUsed).toBe(false);
    expect(result.data).toHaveLength(5);
    expect(result.data.map((topic) => topic.id)).not.toContain('exact-id');
    expect(result.data.map((topic) => topic.id)).not.toContain('Legacy-ID');
    expect(result.data.map((topic) => topic.question)).not.toContain('精确问题文本');
    expect(result.data.map((topic) => topic.question)).not.toContain('相同问题文本');
  });
});

// ─── AC-W7.5 ────────────────────────────────────────────────────────────────

describe('W7.5 — dead fallback bank removed', () => {
  it('FALLBACK_MICRO_CHALLENGES is gone from the AI service module', () => {
    expect('FALLBACK_MICRO_CHALLENGES' in serviceModule).toBe(false);
  });
});
