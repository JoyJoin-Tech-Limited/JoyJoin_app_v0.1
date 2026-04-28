import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  chatCreateMock,
  getTagGenerationProviderMock,
  isProviderAvailableMock,
  getMiniMaxClientMock,
  logAITraceMock,
} = vi.hoisted(() => ({
  chatCreateMock: vi.fn(),
  getTagGenerationProviderMock: vi.fn(),
  isProviderAvailableMock: vi.fn(),
  getMiniMaxClientMock: vi.fn(),
  logAITraceMock: vi.fn(),
}));

vi.mock('openai', () => ({
  default: function MockOpenAI() {
    return {
      chat: {
        completions: {
          create: chatCreateMock,
        },
      },
    };
  },
}));

vi.mock('../ai/creativeModelRouter', () => ({
  getTagGenerationProvider: getTagGenerationProviderMock,
  isProviderAvailable: isProviderAvailableMock,
}));

vi.mock('../ai/minimaxClient', () => ({
  getMiniMaxClient: getMiniMaxClientMock,
  MINIMAX_MODEL: 'minimax-m2.7',
}));

vi.mock('../lib/aiTraceLogger', () => ({
  logAITrace: logAITraceMock,
}));

import { generateSocialTags } from '../tagGenerationService';

describe('tagGenerationService trace coverage', () => {
  const input = {
    archetype: 'corgi',
    profession: {
      occupationId: 'designer',
    },
    hobbies: [{ name: '摄影', heat: 25 }],
  };

  beforeEach(() => {
    vi.clearAllMocks();
    getTagGenerationProviderMock.mockReturnValue('deepseek');
    isProviderAvailableMock.mockReturnValue(true);
    getMiniMaxClientMock.mockReturnValue(null);
  });

  it('traces provider_unavailable before deterministic fallback', async () => {
    isProviderAvailableMock.mockReturnValue(false);

    const result = await generateSocialTags(input);

    expect(result.isFallback).toBe(true);
    expect(result.tags.length).toBeGreaterThan(0);
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        domain: 'creative_identity',
        feature: 'generateSocialTags',
        provider: null,
        success: false,
        fallbackUsed: true,
        promptVersion: 'social-tags-v1',
        errorCode: 'provider_unavailable',
      }),
    );
  });

  it('traces parse_error when the creative provider returns malformed JSON', async () => {
    chatCreateMock.mockResolvedValue({
      choices: [{ message: { content: 'not-json' } }],
    });

    const result = await generateSocialTags(input);

    expect(result.isFallback).toBe(true);
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        success: false,
        fallbackUsed: true,
        promptVersion: 'social-tags-v1',
        errorCode: 'parse_error',
      }),
    );
  });

  it('traces partial_valid_output when only one safe AI tag survives filtering', async () => {
    chatCreateMock.mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            tags: [
              {
                descriptor: '镜头漫游者',
                archetypeNickname: 'corgi',
                fullTag: '镜头漫游者·corgi',
                reasoning: '把摄影热爱带进社交里',
              },
              {
                descriptor: '政治观察员',
                archetypeNickname: 'corgi',
                fullTag: '政治观察员·corgi',
                reasoning: '这条会被黑名单过滤',
              },
            ],
          }),
        },
      }],
    });

    const result = await generateSocialTags(input);

    expect(result.isFallback).toBe(true);
    expect(result.tags.length).toBeGreaterThanOrEqual(2);
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        success: true,
        fallbackUsed: true,
        promptVersion: 'social-tags-v1',
        errorCode: 'partial_valid_output',
      }),
    );
  });

  it('traces llm_error when the creative provider throws', async () => {
    chatCreateMock.mockRejectedValue(new Error('provider down'));

    const result = await generateSocialTags(input);

    expect(result.isFallback).toBe(true);
    expect(logAITraceMock).toHaveBeenCalledWith(
      expect.objectContaining({
        provider: 'deepseek',
        model: 'deepseek-v4-flash',
        success: false,
        fallbackUsed: true,
        promptVersion: 'social-tags-v1',
        errorCode: 'llm_error',
      }),
    );
  });
});
