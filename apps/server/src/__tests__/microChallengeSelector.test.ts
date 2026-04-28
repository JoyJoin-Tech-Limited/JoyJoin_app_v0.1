/**
 * Integration tests for generateMicroChallenges with the deterministic selector.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

const mockCreate = vi.fn();

vi.mock('../ai/minimaxClient', () => ({
  isMinimaxEnabled: vi.fn(() => true),
  getMinimaxClient: vi.fn(() => ({
    chat: { completions: { create: mockCreate } },
  })),
  getMinimaxModel: () => 'minimax-m2.7',
  minimaxClient: null,
  MINIMAX_DEFAULT_MODEL: 'minimax-m2.7',
}));

vi.mock('openai', () => ({
  default: function MockOpenAI() {
    return {
      chat: { completions: { create: mockCreate } },
    };
  },
}));

import { generateMicroChallenges } from '../socialIcebreakerAIService';

describe('generateMicroChallenges with selector', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DEEPSEEK_API_KEY = 'sk-test';
    delete process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED;
  });

  afterEach(() => {
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED;
  });

  it('returns selector challenges when AI is disabled', async () => {
    process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED = 'false';

    const result = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 6,
      seed: 'test-session',
    });

    expect(result.data).toHaveLength(3);
    expect(result.meta.provider).toBeNull();
    expect(result.meta.fallbackUsed).toBe(false);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('returns AI challenges when AI succeeds and is enabled', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[{"id":"ai1","title":"AI Challenge","description":"AI desc","durationSeconds":120,"completionCTA":"Done"}]' } }],
    });

    const result = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 6,
      seed: 'test-session',
    });

    expect(result.data).toHaveLength(1);
    expect(result.data[0].title).toBe('AI Challenge');
    expect(result.meta.provider).not.toBeNull();
    expect(mockCreate).toHaveBeenCalled();
  });

  it('falls back to selector when AI returns empty response', async () => {
    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '' } }],
    });

    const result = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 6,
      seed: 'fallback-test',
    });

    expect(result.data).toHaveLength(3);
    expect(result.meta.fallbackUsed).toBe(true);
  });

  it('falls back to selector when AI throws', async () => {
    mockCreate.mockRejectedValue(new Error('timeout'));

    const result = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 6,
      seed: 'error-test',
    });

    expect(result.data).toHaveLength(3);
    expect(result.meta.fallbackUsed).toBe(true);
  });

  it('produces deterministic selector output for the same seed', async () => {
    process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED = 'false';

    const r1 = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 5,
      seed: 'deterministic-seed',
    });
    const r2 = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 5,
      seed: 'deterministic-seed',
    });

    expect(r1.data.map((c) => c.id)).toEqual(r2.data.map((c) => c.id));
  });

  it('excludes completed challenge IDs from selector output', async () => {
    process.env.SOCIAL_MICRO_CHALLENGE_LLM_ENABLED = 'false';

    const first = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 6,
      seed: 'completed-test',
    });

    const second = await generateMicroChallenges({
      eventType: '饭局',
      participantCount: 6,
      seed: 'completed-test',
      completedChallengeIds: [first.data[0].id],
    });

    expect(second.data.map((c) => c.id)).not.toContain(first.data[0].id);
  });
});
